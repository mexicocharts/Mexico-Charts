import { readFile, writeFile } from "node:fs/promises";

const songsHtml = await readFile("/tmp/luis-miguel-songs.html", "utf8");
const albumsHtml = await readFile("/tmp/luis-miguel-albums.html", "utf8");
const outputPath = "artifacts/mexico-charts/src/data/luisMiguelMonitoringCatalog.ts";
const existingSource = await readFile(outputPath, "utf8").catch(() => "");

function existingRows(name, nextName) {
  const start = existingSource.indexOf(`export const ${name}`);
  if (start < 0) return [];
  const jsonStart = existingSource.indexOf("=", start) + 1;
  const end = nextName
    ? existingSource.indexOf(`export const ${nextName}`, jsonStart)
    : existingSource.length;
  const raw = existingSource.slice(jsonStart, end).trim().replace(/;$/, "").trim();
  try { return JSON.parse(raw); } catch { return []; }
}

const existingTracks = existingRows("LUIS_MIGUEL_TRACKS", "LUIS_MIGUEL_ALBUMS");
const existingAlbums = existingRows("LUIS_MIGUEL_ALBUMS");
const existingCoverById = new Map(
  [...existingTracks, ...existingAlbums]
    .filter(row => row.id && row.coverUrl)
    .map(row => [row.id, row.coverUrl]),
);

function decode(value) {
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

function rowsFrom(html, kind) {
  const rows = [];
  const pattern = /<tr><td class="text"><div>([\s\S]*?)<\/div><\/td><td>([\d,]+)<\/td><td>([\d,]+)<\/td><\/tr>/g;
  for (const match of html.matchAll(pattern)) {
    const cell = match[1];
    const href = cell.match(/href="([^"]+)"/)?.[1] ?? null;
    const title = decode(cell).replace(/^\*\s*/, "").replace(/^\^\s*/, "");
    rows.push({
      id: href?.match(new RegExp(`/${kind}/([A-Za-z0-9]+)`))?.[1] ?? null,
      title,
      spotifyUrl: href,
      coverUrl: existingCoverById.get(href?.match(new RegExp(`/${kind}/([A-Za-z0-9]+)`))?.[1] ?? "") ?? null,
      streams: Number(match[2].replaceAll(",", "")),
      daily: Number(match[3].replaceAll(",", "")),
      ...(kind === "album" ? { compilation: decode(cell).startsWith("^") } : {}),
    });
  }
  return rows;
}

const tracks = rowsFrom(songsHtml, "track");
const albums = rowsFrom(albumsHtml, "album");
const updated = songsHtml.match(/Last updated:\s*([\d/]+)/)?.[1]?.replaceAll("/", "-") ?? null;

if (tracks.length !== 313) throw new Error(`Expected 313 tracks, found ${tracks.length}`);
if (albums.length < 40) throw new Error(`Expected at least 40 albums, found ${albums.length}`);

async function fetchCover(row, attempt = 0) {
  if (!row.spotifyUrl || row.coverUrl) return row;
  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(row.spotifyUrl)}`, {
      headers: { "User-Agent": "MexicoChartsCatalogBuilder/1.0" },
    });
    if (!response.ok && attempt < 3) {
      const waitSeconds = response.status === 429
        ? Math.max(1, Number(response.headers.get("retry-after") ?? 2))
        : attempt + 1;
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
      return fetchCover(row, attempt + 1);
    }
    if (!response.ok) return row;
    const data = await response.json();
    return { ...row, coverUrl: typeof data.thumbnail_url === "string" ? data.thumbnail_url : null };
  } catch {
    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
      return fetchCover(row, attempt + 1);
    }
    return row;
  }
}

async function enrichAll(rows, concurrency = 3) {
  const output = new Array(rows.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < rows.length) {
      const index = cursor++;
      try {
        output[index] = await fetchCover(rows[index]);
      } catch {
        output[index] = rows[index];
      }
    }
  }));
  return output;
}

const enrichedTracks = await enrichAll(tracks);
const enrichedAlbums = await enrichAll(albums);

const output = `export interface MonitoringCatalogTrack {
  id: string | null;
  title: string;
  spotifyUrl: string | null;
  coverUrl: string | null;
  streams: number;
  daily: number;
}

export interface MonitoringCatalogAlbum extends MonitoringCatalogTrack {
  compilation: boolean;
}

export const LUIS_MIGUEL_CATALOG_UPDATED = ${JSON.stringify(updated)};
export const LUIS_MIGUEL_TRACKS: MonitoringCatalogTrack[] = ${JSON.stringify(enrichedTracks, null, 2)};
export const LUIS_MIGUEL_ALBUMS: MonitoringCatalogAlbum[] = ${JSON.stringify(enrichedAlbums, null, 2)};
`;

await writeFile(outputPath, output);
console.log(`Wrote ${enrichedTracks.length} tracks (${enrichedTracks.filter(row => row.coverUrl).length} covers) and ${enrichedAlbums.length} albums (${enrichedAlbums.filter(row => row.coverUrl).length} covers).`);
