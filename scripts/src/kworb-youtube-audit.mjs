import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg");

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, rawValue] = arg.replace(/^--/, "").split("=");
    return [key, rawValue ?? "true"];
  }),
);

const limit = Math.max(1, Number(args.get("limit") ?? 50));
const offset = Math.max(0, Number(args.get("offset") ?? 0));
const write = args.get("write") === "true";
const artistKeyArg = args.get("artistKey") ? toSlug(String(args.get("artistKey"))) : undefined;

const MANUAL_YOUTUBE_SLUG_BY_ARTIST_KEY = new Map([
  ["arielcamachoylosplebesdelrancho", "arielcamachoylosplebesdelrancho"],
]);

const STOP_TOKENS = new Set([
  "banda", "grupo", "los", "las", "del", "de", "el", "la", "y", "su", "sus",
  "the", "and", "of", "oficial", "official",
]);

const YOUTUBE_ARCHIVE_URL = "https://kworb.net/youtube/archive.html";

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function wordTokens(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function meaningfulTokens(name) {
  return [...new Set(wordTokens(name).filter(token => !STOP_TOKENS.has(token)))];
}

function slugVariants(artistName, artistKey) {
  const rawTokens = wordTokens(artistName);
  const meaningful = rawTokens.filter(token => !STOP_TOKENS.has(token));
  const variants = new Set([
    artistKey,
    toSlug(artistName),
    toSlug(rawTokens.filter(token => !["banda", "grupo"].includes(token)).join(" ")),
    toSlug(meaningful.join(" ")),
  ]);

  if (rawTokens.length > 2) variants.add(toSlug(rawTokens.slice(0, 2).join(" ")));
  if (rawTokens.length > 3) variants.add(toSlug(rawTokens.slice(0, 3).join(" ")));
  if (meaningful.length > 1) variants.add(toSlug(meaningful.slice(0, 2).join(" ")));
  if (meaningful.length > 2) variants.add(toSlug(meaningful.slice(0, 3).join(" ")));

  return [...variants].filter(slug => slug.length >= 5);
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").trim();
}

function parseCommaNum(value) {
  return parseInt(String(value ?? "").replace(/,/g, "").trim(), 10) || 0;
}

function parseTableRows(html, raw = false) {
  const rows = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)) {
      cells.push(raw ? cellMatch[1] : stripTags(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function extractYouTubeVideoId(cellHtml) {
  const direct = cellHtml.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (direct?.[1]) return direct[1];
  const kworb = cellHtml.match(/\/video\/([A-Za-z0-9_-]{11})\.html/);
  return kworb?.[1] ?? null;
}

function fmtNum(n) {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function parseYouTubePage(html) {
  const rows = parseTableRows(html, true);
  let totalViews = 0;
  let dailyAvg = 0;
  const topVideos = [];

  for (const cells of rows) {
    const first = stripTags(cells[0] ?? "");
    const second = cells[1] ? stripTags(cells[1]) : "";
    if (first === "Total views:" && second) totalViews = parseCommaNum(second);
    else if (first === "Current daily avg:" && second) dailyAvg = parseCommaNum(second);
    else if (topVideos.length < 10 && cells.length >= 2 && first && second && /^\d[\d,]+$/.test(second)) {
      const videoId = extractYouTubeVideoId(cells[0]);
      const views = parseCommaNum(second);
      const daily = cells[2] ? parseCommaNum(stripTags(cells[2])) : 0;
      topVideos.push({
        title: first,
        videoId,
        videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
        views,
        viewsFmt: fmtNum(views),
        daily,
        dailyFmt: fmtNum(daily),
        published: cells[3] ? stripTags(cells[3]) : "",
      });
    }
  }

  if (!totalViews) return null;
  return { totalViews, totalViewsFmt: fmtNum(totalViews), dailyAvg, dailyAvgFmt: fmtNum(dailyAvg), topVideos };
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return response.text();
}

async function loadYouTubeIndex() {
  const html = await fetchPage(YOUTUBE_ARCHIVE_URL);
  const index = [];
  if (!html) return index;

  for (const match of html.matchAll(/href="(artist\/([^"]+?)\.html)"[^>]*>([^<]+)<\/a>/g)) {
    const href = match[1];
    const rawSlug = match[2];
    const name = stripTags(match[3]);
    const cleanSlug = toSlug(decodeURIComponent(rawSlug));
    const cleanName = toSlug(name);
    const tokens = meaningfulTokens(name);
    if (!cleanSlug || !cleanName || tokens.length === 0) continue;
    index.push({ href, rawSlug, cleanSlug, cleanName, name, tokens });
  }

  return index;
}

function extractYouTubeArtistHrefFromSpotifyPage(html) {
  const match = html.match(/href="(\/?youtube\/artist\/[^"]+?\.html)"[^>]*>\s*YouTube stats\s*<\/a>/i);
  return match?.[1]?.replace(/^\//, "") ?? null;
}

function scoreIndexCandidate(artist, candidate) {
  const artistSlug = toSlug(artist.artist_name);
  const artistTokens = meaningfulTokens(artist.artist_name);
  if (artist.artist_key === candidate.cleanSlug || artistSlug === candidate.cleanName) return 1;
  if (
    artistTokens.length >= 2 &&
    candidate.tokens.length >= 2 &&
    artist.artist_key.length >= 8 &&
    candidate.cleanSlug.length >= 8 &&
    (artist.artist_key.includes(candidate.cleanSlug) || candidate.cleanSlug.includes(artist.artist_key))
  ) return 0.9;
  if (
    artistTokens.length >= 2 &&
    candidate.tokens.length >= 2 &&
    artistSlug.length >= 8 &&
    candidate.cleanName.length >= 8 &&
    (artistSlug.includes(candidate.cleanName) || candidate.cleanName.includes(artistSlug))
  ) return 0.88;

  const common = artistTokens.filter(token => candidate.tokens.includes(token));
  if (common.length < 2 || artistTokens.length < 2 || candidate.tokens.length < 2) return 0;
  return common.length / Math.max(artistTokens.length, candidate.tokens.length);
}

async function saveYouTube(pool, artist, data) {
  const ttl = 26 * 60 * 60 * 1000;
  await pool.query(
    `insert into kworb_snapshots (artist_key, metric_type, value, fetched_at, expires_at)
     values ($1, 'youtube', $2, now(), $3)
     on conflict (artist_key, metric_type) do update set
       value = excluded.value,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at`,
    [artist.artist_key, JSON.stringify(data), new Date(Date.now() + ttl)],
  );
  await pool.query(
    `update kworb_coverage
     set has_youtube = true,
         status = 'active',
         consecutive_failures = 0,
         last_fetch_at = now(),
         last_discovered_at = now(),
         last_failed_at = null
     where artist_key = $1`,
    [artist.artist_key],
  );
}

async function main() {
  const pool = new Pool({ connectionString: resolveDatabaseUrl() });

  try {
    const youtubeIndex = await loadYouTubeIndex();
    console.log(`Loaded Kworb YouTube index: ${youtubeIndex.length} artists`);

    const { rows: artists } = artistKeyArg
      ? await pool.query(
        `select artist_key, artist_name, spotify_id, has_spotify, has_itunes
         from kworb_coverage
         where artist_key = $1
         limit 1`,
        [artistKeyArg],
      )
      : await pool.query(
        `select artist_key, artist_name, spotify_id, has_spotify, has_itunes
         from kworb_coverage
         where not has_youtube
         order by has_itunes desc, has_spotify desc, artist_name
         limit $1 offset $2`,
        [limit, offset],
      );

    let found = 0;
    let saved = 0;
    let checked = 0;
    console.log(`${write ? "Writing" : "Dry run"} YouTube Kworb audit: artists=${artists.length} offset=${offset}`);

    for (const artist of artists) {
      checked += 1;
      let match = null;
      const manualSlug = MANUAL_YOUTUBE_SLUG_BY_ARTIST_KEY.get(artist.artist_key);
      if (manualSlug) {
        const html = await fetchPage(`https://kworb.net/youtube/artist/${manualSlug}.html`);
        const youtube = html ? parseYouTubePage(html) : null;
        if (youtube) {
          match = { slug: manualSlug, youtube, source: "manual" };
        }
      }

      if (!match && artist.spotify_id) {
        const spotifyHtml = await fetchPage(`https://kworb.net/spotify/artist/${artist.spotify_id}_songs.html`);
        const youtubeHref = spotifyHtml ? extractYouTubeArtistHrefFromSpotifyPage(spotifyHtml) : null;
        if (youtubeHref) {
          const html = await fetchPage(`https://kworb.net/${youtubeHref}`);
          const youtube = html ? parseYouTubePage(html) : null;
          if (youtube) {
            const slug = youtubeHref.match(/artist\/(.+?)\.html/)?.[1] ?? youtubeHref;
            match = { slug, youtube, source: "spotify-bridge" };
          }
        }
      }

      if (!match) {
        const indexCandidates = youtubeIndex
          .map(candidate => ({ ...candidate, score: scoreIndexCandidate(artist, candidate) }))
          .filter(candidate => candidate.score >= 0.86)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        for (const candidate of indexCandidates) {
          const html = await fetchPage(`https://kworb.net/youtube/${candidate.href}`);
          const youtube = html ? parseYouTubePage(html) : null;
          if (youtube) {
            match = { slug: candidate.rawSlug, youtube, source: `index:${candidate.name}:${candidate.score.toFixed(2)}` };
            break;
          }
        }
      }

      for (const slug of slugVariants(artist.artist_name, artist.artist_key)) {
        if (match) break;
        const html = await fetchPage(`https://kworb.net/youtube/artist/${slug}.html`);
        const youtube = html ? parseYouTubePage(html) : null;
        if (youtube) {
          match = { slug, youtube, source: "variant" };
          break;
        }
      }

      if (!match) {
        console.log(`MISS,${artist.artist_key},${artist.artist_name}`);
        continue;
      }

      found += 1;
      console.log(`${write ? "SAVE" : "FOUND"},${artist.artist_key},${artist.artist_name},${match.slug},${match.source},views=${fmtNum(match.youtube.totalViews)},daily=${fmtNum(match.youtube.dailyAvg)}`);
      if (write) {
        await saveYouTube(pool, artist, match.youtube);
        saved += 1;
      }
      await new Promise(resolve => setTimeout(resolve, 75));
    }

    console.log(`Done. checked=${checked} found=${found} saved=${saved}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
