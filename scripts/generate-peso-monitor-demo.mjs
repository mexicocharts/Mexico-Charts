import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUTPUT = resolve(
  ROOT,
  "artifacts/mexico-charts/src/data/pesoPlumaMonitorDemo.ts",
);
const SPOTIFY_ARTIST_ID = "12GqGscKJx3aE4t07u7eVZ";
const YOUTUBE_ENDPOINT =
  "https://mexicochart.com/api/providers/youtube/live-videos?artistKey=peso-pluma";

function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseNumber(value) {
  return Number(value.replaceAll(",", "")) || 0;
}

function parseCatalog(html, type) {
  const items = [];
  const pattern =
    /<tr[^>]*><td class="text"><div>([\s\S]*?)<\/div><\/td><td>([\d,]+)<\/td><td>([\d,]+)<\/td><\/tr>/g;
  for (const match of html.matchAll(pattern)) {
    const cell = match[1];
    const spotifyUrl = cell.match(/href="([^"]+)"/)?.[1] ?? null;
    const rawTitle = decodeHtml(cell);
    const title = rawTitle.replace(/^\*\s*/, "").replace(/^\^\s*/, "");
    if (!title || !spotifyUrl) continue;
    const id = spotifyUrl.match(
      new RegExp(`/${type === "track" ? "track" : "album"}/([A-Za-z0-9]+)`),
    )?.[1];
    if (!id) continue;
    items.push({
      type,
      id,
      title,
      spotifyUrl,
      total: parseNumber(match[2]),
      daily: parseNumber(match[3]),
      compilation: type === "album" && rawTitle.startsWith("^"),
    });
  }
  return items;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsMonitor/1.0)",
      Accept: "text/html,application/json",
    },
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

function normalizedTitle(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+-\s+(single|ep)$/i, "")
    .replace(/\([^)]*(deluxe|version|remaster)[^)]*\)/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function artworkUrl(value) {
  return typeof value === "string"
    ? value.replace(/100x100bb\./, "600x600bb.")
    : null;
}

function buildArtworkIndex(payload, type) {
  const index = new Map();
  for (const item of Array.isArray(payload?.results) ? payload.results : []) {
    const title = type === "track" ? item.trackName : item.collectionName;
    const image = artworkUrl(item.artworkUrl100);
    if (!title || !image) continue;
    const key = normalizedTitle(title);
    if (key && !index.has(key)) index.set(key, image);
  }
  return index;
}

async function mapConcurrent(items, concurrency, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return output;
}

async function resolveArtwork(item, artworkIndex) {
  const indexedArtwork = artworkIndex.get(normalizedTitle(item.title));
  if (indexedArtwork) return { ...item, artworkUrl: indexedArtwork };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(item.spotifyUrl)}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsMonitor/1.0)",
          },
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      return {
        ...item,
        artworkUrl:
          typeof payload.thumbnail_url === "string"
            ? payload.thumbnail_url
            : null,
      };
    } catch {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
  }
  return { ...item, artworkUrl: null };
}

function dedupeVideos(payload) {
  const videos = Array.isArray(payload?.videos) ? payload.videos : [];
  const byId = new Map();
  for (const video of videos) {
    if (!video?.video_id) continue;
    const current = byId.get(video.video_id);
    const canonicalUrl = String(video.canonical_url ?? "");
    if (!current || canonicalUrl.includes("www.youtube.com")) {
      const views = Number(video.view_count ?? 0);
      const milestone = Math.max(100_000_000, Math.ceil(views / 100_000_000) * 100_000_000);
      byId.set(video.video_id, {
        id: String(video.video_id),
        title: String(video.title ?? "Video de YouTube"),
        image:
          video.thumbnail_url ||
          `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`,
        url:
          canonicalUrl ||
          `https://www.youtube.com/watch?v=${video.video_id}`,
        views,
        delta: Number(video.view_delta ?? 0),
        secondsSincePrevious: Number(video.seconds_since_previous ?? 0),
        observedAt: video.observed_at ?? null,
        viewsTodayEt:
          video.views_today_et == null ? null : Number(video.views_today_et),
        views24h: video.views_24h == null ? null : Number(video.views_24h),
        milestone,
        progress: Number(((views / milestone) * 100).toFixed(1)),
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.views - a.views);
}

async function main() {
  const [songsHtml, albumsHtml, youtubeText, itunesSongsText, itunesAlbumsText] =
    await Promise.all([
    fetchText(
      `https://kworb.net/spotify/artist/${SPOTIFY_ARTIST_ID}_songs.html`,
    ),
    fetchText(
      `https://kworb.net/spotify/artist/${SPOTIFY_ARTIST_ID}_albums.html`,
    ),
      fetchText(YOUTUBE_ENDPOINT),
      fetchText(
        "https://itunes.apple.com/search?term=Peso%20Pluma&entity=song&limit=200&country=mx",
      ),
      fetchText(
        "https://itunes.apple.com/search?term=Peso%20Pluma&entity=album&limit=200&country=mx",
      ),
    ]);
  const rawTracks = parseCatalog(songsHtml, "track");
  const rawAlbums = parseCatalog(albumsHtml, "album");
  const trackArtwork = buildArtworkIndex(JSON.parse(itunesSongsText), "track");
  const albumArtwork = buildArtworkIndex(JSON.parse(itunesAlbumsText), "album");
  const [tracks, albums] = await Promise.all([
    mapConcurrent(rawTracks, 5, (item) => resolveArtwork(item, trackArtwork)),
    mapConcurrent(rawAlbums, 5, (item) => resolveArtwork(item, albumArtwork)),
  ]);
  const youtube = dedupeVideos(JSON.parse(youtubeText));
  const source = `// Generated by scripts/generate-peso-monitor-demo.mjs.\n// Public platform observations captured 29 August 2026.\n\nexport const pesoPlumaMonitorDemo = ${JSON.stringify(
    {
      capturedAt: "2026-08-29",
      spotify: { tracks, albums },
      youtube,
    },
    null,
    2,
  )} as const;\n`;
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, source);
  console.log(
    `Generated ${OUTPUT}: ${tracks.length} tracks, ${albums.length} albums, ${youtube.length} unique YouTube videos.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
