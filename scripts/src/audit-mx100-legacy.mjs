import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg");

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const OUT_DIR = path.join(ROOT, "tmp", "chart-audits");
const METADATA_API = "https://mexicochart.com/api/artists/metadata";
const CHARTS_HUB_API = "https://mexicochart.com/api/charts/hub";
const TOURING_API = "https://mexicochart.com/api/touring/concerts";
const KWORB_BATCH_API = "https://mexicochart.com/api/kworb/batch-streams";

function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toSlug(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseNum(raw) {
  if (raw == null) return 0;
  const s = String(raw).trim().toUpperCase();
  if (!s) return 0;
  if (s.endsWith("B")) return Math.round(parseFloat(s) * 1_000_000_000);
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s.replace(/[^0-9.-]/g, ""), 10) || 0;
}

function compact(value) {
  if (!value) return "0";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scale(value, max, points) {
  if (max <= 0) return 0;
  return clamp((value / max) * points, 0, points);
}

function scaleSqrt(value, max, points) {
  if (value <= 0 || max <= 0) return 0;
  return clamp(Math.sqrt(value / max) * points, 0, points);
}

function scaleLog(value, max, points) {
  if (value <= 0 || max <= 0) return 0;
  return clamp((Math.log10(value + 1) / Math.log10(max + 1)) * points, 0, points);
}

function scaleSocial(value, max, points) {
  if (value <= 0 || max <= 0) return 0;
  return clamp(Math.pow(value / max, 0.35) * points, 0, points);
}

function rankScore(rank, maxRank, points) {
  if (!rank || rank > maxRank) return 0;
  return ((maxRank + 1 - rank) / maxRank) * points;
}

function rankSort(rank) {
  return rank ?? 9999;
}

function socialReach(meta) {
  return (
    parseNum(meta.tiktok_followers) +
    parseNum(meta.instagram_followers) +
    parseNum(meta.youtube_subscribers) +
    parseNum(meta.facebook_followers) +
    parseNum(meta.spotify_followers)
  );
}

function normalizeMeta(row) {
  return {
    raw: row,
    artistKey: String(row.artist_key ?? row.artist_name ?? "").trim(),
    displayName: String(row.artist_name ?? "").trim(),
    country: String(row.source_country ?? "").trim(),
    genre: String(row.genre ?? "").trim(),
    subgenre: String(row.subgenre ?? "").trim(),
    spotifyListeners: parseNum(row.spotify_monthly_listeners),
    spotifyFollowers: parseNum(row.spotify_followers),
    spotifyStreams: parseNum(row.spotify_total_streams),
    youtubeSubscribers: parseNum(row.youtube_subscribers),
    youtubeViews: parseNum(row.youtube_views),
    tiktokFollowers: parseNum(row.tiktok_followers),
    instagramFollowers: parseNum(row.instagram_followers),
    facebookFollowers: parseNum(row.facebook_followers),
  };
}

function buildNameMap(items, nameGetter) {
  const map = new Map();
  for (const item of items) {
    const name = nameGetter(item);
    if (name) map.set(normalizeName(name), item);
  }
  return map;
}

function buildSpotifyArtistMap(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const name = String(row.Artist ?? row["Artist Name"] ?? "").trim();
    const rank = parseInt(row.Rank ?? row.rank ?? "", 10);
    if (name && rank) map.set(normalizeName(name), { rank, row });
  }
  return map;
}

function buildYoutubeArtistMap(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const name = String(row["Artist Name"] ?? row.Artist ?? "").trim();
    const rank = parseInt(row.Rank ?? row.rank ?? "", 10);
    if (name && rank) map.set(normalizeName(name), { rank, views: parseNum(row.Views), row });
  }
  return map;
}

function extractLegacyNames() {
  const sourcePath = path.join(ROOT, "artifacts/mexico-charts/src/pages/LegacyActs.tsx");
  return fs.readFile(sourcePath, "utf8").then((source) => {
    const match = source.match(/const LEGACY_ACT_NAMES = \[([\s\S]*?)\];/);
    if (!match) throw new Error("Could not find LEGACY_ACT_NAMES in LegacyActs.tsx");
    return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsAudit/1.0)" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsAudit/1.0)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;
  return response.text();
}

function stripTags(value) {
  return String(value ?? "").replace(/<[^>]+>/g, "").trim();
}

function parseTableRows(html) {
  const rows = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((m) => stripTags(m[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseSpotifyKworb(html) {
  let totalStreams = 0;
  let dailyStreams = 0;
  for (const cells of parseTableRows(html ?? "")) {
    if (cells[0] === "Streams") totalStreams = parseNum(cells[1]);
    if (cells[0] === "Daily") dailyStreams = parseNum(cells[1]);
  }
  return totalStreams ? { totalStreams, dailyStreams } : null;
}

function parseYoutubeKworb(html) {
  let totalViews = 0;
  let dailyAvg = 0;
  for (const cells of parseTableRows(html ?? "")) {
    if (cells[0] === "Total views:") totalViews = parseNum(cells[1]);
    if (cells[0] === "Current daily avg:") dailyAvg = parseNum(cells[1]);
  }
  return totalViews ? { totalViews, dailyAvg } : null;
}

function extractYoutubeHref(html) {
  const match = String(html ?? "").match(/href="([^"]*\/youtube\/artist\/[^"]+\.html)"[^>]*>\s*YouTube stats/i);
  return match ? new URL(match[1], "https://kworb.net").toString() : null;
}

function youtubeSlugFromVideoTitle(title) {
  const artistPart = String(title ?? "")
    .replace(/^\*\s*/, "")
    .split(" - ")[0]
    ?.trim();
  if (!artistPart) return "";
  return artistPart
    .toLowerCase()
    .normalize("NFC")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9áéíóúñü]/gi, "");
}

function youtubeSlugFromSnapshot(snapshot) {
  const videos = Array.isArray(snapshot?.topVideos) ? snapshot.topVideos : [];
  const ownVideo = videos.find((video) => !String(video?.title ?? "").trim().startsWith("*"));
  return youtubeSlugFromVideoTitle((ownVideo ?? videos[0])?.title);
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchKworbBatch(names) {
  const out = {};
  for (let i = 0; i < names.length; i += 80) {
    const chunk = names.slice(i, i + 80);
    const url = `${KWORB_BATCH_API}?details=1&names=${encodeURIComponent(chunk.join(","))}`;
    Object.assign(out, await fetchJson(url));
  }
  return out;
}

function buildMx100(metadata, hub, touring) {
  const spotifyRows = hub.sheets?.Spotify_Artists_Weekly?.rows ?? [];
  const youtubeRows = hub.sheets?.YT_Artists_Weekly?.rows ?? [];
  const spotifyMap = buildSpotifyArtistMap(spotifyRows);
  const youtubeMap = buildYoutubeArtistMap(youtubeRows);
  const tourMap = buildNameMap(touring.artists ?? [], (a) => a.name);
  const candidates = [...new Map(metadata.map((m) => [normalizeName(m.displayName), m])).values()];
  const maxYoutubeViews = Math.max(...candidates.map((m) => youtubeMap.get(normalizeName(m.displayName))?.views ?? 0), 1);
  const maxSocial = Math.max(...candidates.map((m) => socialReach(m.raw)), 1);
  const maxTouring = Math.max(...(touring.artists ?? []).map((a) => a.events?.length ?? 0), 1);

  return candidates
    .map((meta) => {
      const key = normalizeName(meta.displayName);
      const spotify = spotifyMap.get(key);
      const youtube = youtubeMap.get(key);
      const tourDates = tourMap.get(key)?.events?.length ?? 0;
      const social = socialReach(meta.raw);
      const spotifyScore = rankScore(spotify?.rank, 100, 55);
      const youtubeScore = scaleSqrt(youtube?.views ?? 0, maxYoutubeViews, 25);
      const fanbaseScore = scaleSocial(social, maxSocial, 12);
      const touringScore = scale(tourDates, maxTouring, 8);
      const scoreRaw = spotifyScore + youtubeScore + fanbaseScore + touringScore;
      return {
        artist: meta.displayName,
        score: Math.round(scoreRaw),
        scoreRaw,
        spotifyRank: spotify?.rank ?? "",
        spotifyScore,
        youtubeRank: youtube?.rank ?? "",
        youtubeViews: youtube?.views ?? 0,
        youtubeScore,
        fanbase: social,
        fanbaseScore,
        touringDates: tourDates,
        touringScore,
      };
    })
    .filter((row) => row.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        rankSort(a.spotifyRank) - rankSort(b.spotifyRank) ||
        rankSort(a.youtubeRank) - rankSort(b.youtubeRank) ||
        b.youtubeViews - a.youtubeViews ||
        b.fanbase - a.fanbase,
    )
    .slice(0, 100)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function buildLegacy(metadata, legacyNames, snapshots) {
  const legacySet = new Set(legacyNames.map(normalizeName));
  const candidates = metadata.filter((m) => legacySet.has(normalizeName(m.displayName)));
  const values = candidates.map((meta) => {
    const snapshot = snapshots[meta.displayName] ?? {};
    const spotifyCatalog = snapshot.totalStreams ?? 0;
    const youtubeCatalog = snapshot.totalViews ?? 0;
    const youtubeSlugHint = youtubeSlugFromVideoTitle(snapshot.topVideos?.[0]?.title);
    const catalog = spotifyCatalog + youtubeCatalog;
    const audience = meta.spotifyListeners;
    const fanbase = meta.spotifyFollowers + meta.youtubeSubscribers + meta.instagramFollowers + meta.tiktokFollowers + meta.facebookFollowers;
    return { meta, catalog, spotifyCatalog, youtubeCatalog, audience, fanbase };
  });
  const maxCatalog = Math.max(...values.map((v) => v.catalog), 1);
  const maxAudience = Math.max(...values.map((v) => v.audience), 1);
  const maxFanbase = Math.max(...values.map((v) => v.fanbase), 1);
  return values
    .map((item) => {
      const catalogScore = scaleLog(item.catalog, maxCatalog, 70);
      const audienceScore = scaleLog(item.audience, maxAudience, 18);
      const fanbaseScore = clamp(Math.pow(item.fanbase / maxFanbase, 0.38) * 12, 0, 12);
      return {
        artist: item.meta.displayName,
        score: catalogScore + audienceScore + fanbaseScore,
        catalogScore,
        audienceScore,
        fanbaseScore,
        catalog: item.catalog,
        spotifyCatalog: item.spotifyCatalog,
        youtubeCatalog: item.youtubeCatalog,
        youtubeSlugHint: item.youtubeSlugHint,
        metadataSpotify: item.meta.spotifyStreams,
        metadataYoutube: item.meta.youtubeViews,
        metadataCatalog: item.meta.spotifyStreams + item.meta.youtubeViews,
        audience: item.audience,
        fanbase: item.fanbase,
      };
    })
    .sort((a, b) => b.score - a.score || b.audience - a.audience || b.catalog - a.catalog || b.fanbase - a.fanbase)
    .slice(0, 50)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function writeCsv(filename, rows) {
  if (!rows.length) {
    await fs.writeFile(path.join(OUT_DIR, filename), "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ].join("\n");
  await fs.writeFile(path.join(OUT_DIR, filename), csv);
}

async function loadCoverage() {
  if (!process.env.DATABASE_URL) return new Map();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(`
    SELECT
      c.artist_key,
      c.artist_name,
      c.spotify_id,
      c.has_spotify,
      c.has_youtube,
      s.value AS youtube_snapshot
    FROM kworb_coverage c
    LEFT JOIN kworb_snapshots s
      ON s.artist_key = c.artist_key
     AND s.metric_type = 'youtube'
  `);
  await pool.end();
  return new Map(rows.map((row) => [
    row.artist_key,
    {
      ...row,
      youtubeSlugHint: youtubeSlugFromSnapshot(row.youtube_snapshot),
    },
  ]));
}

async function liveAuditLegacy(legacyRows, coverageMap) {
  return mapLimit(legacyRows, 6, async (row) => {
    const key = toSlug(row.artist);
    const coverage = coverageMap.get(key);
    const spotifyHtml = coverage?.spotify_id
      ? await fetchText(`https://kworb.net/spotify/artist/${coverage.spotify_id}_songs.html`)
      : null;
    const youtubeUrl = extractYoutubeHref(spotifyHtml) ?? (
      coverage?.has_youtube || row.youtubeCatalog
        ? `https://kworb.net/youtube/artist/${encodeURIComponent(coverage?.youtubeSlugHint || row.youtubeSlugHint || row.artist.toLowerCase().normalize("NFC").replace(/[^a-z0-9áéíóúñü]/gi, ""))}.html`
        : null
    );
    const youtubeHtml = youtubeUrl ? await fetchText(youtubeUrl) : null;
    const liveSpotify = spotifyHtml ? parseSpotifyKworb(spotifyHtml) : null;
    const liveYoutube = youtubeHtml ? parseYoutubeKworb(youtubeHtml) : null;
    const liveCatalog = (liveSpotify?.totalStreams ?? 0) + (liveYoutube?.totalViews ?? 0);
    const cachedCatalog = row.catalog;
    const diff = liveCatalog ? cachedCatalog - liveCatalog : 0;
    const diffPct = liveCatalog ? diff / liveCatalog : 0;
    return {
      rank: row.rank,
      artist: row.artist,
      cachedCatalog,
      cachedCatalogFmt: compact(cachedCatalog),
      cachedSpotify: row.spotifyCatalog,
      cachedYoutube: row.youtubeCatalog,
      liveCatalog,
      liveCatalogFmt: compact(liveCatalog),
      liveSpotify: liveSpotify?.totalStreams ?? "",
      liveYoutube: liveYoutube?.totalViews ?? "",
      diff,
      diffPct: diffPct ? `${(diffPct * 100).toFixed(2)}%` : "",
      status:
        !liveCatalog ? "no-live-check" :
        Math.abs(diffPct) > 0.02 ? "mismatch-over-2pct" :
        "ok",
    };
  });
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const [metadataJson, hub, touring, legacyNames, coverageMap] = await Promise.all([
    fetchJson(METADATA_API),
    fetchJson(CHARTS_HUB_API),
    fetchJson(TOURING_API),
    extractLegacyNames(),
    loadCoverage(),
  ]);
  const metadata = (metadataJson.artists ?? []).map(normalizeMeta).filter((m) => m.displayName);

  const mx100 = buildMx100(metadata, hub, touring);
  const legacyCandidateNames = metadata
    .filter((m) => new Set(legacyNames.map(normalizeName)).has(normalizeName(m.displayName)))
    .map((m) => m.displayName);
  const snapshots = await fetchKworbBatch(legacyCandidateNames);
  const legacy = buildLegacy(metadata, legacyNames, snapshots);
  const legacyLive = await liveAuditLegacy(legacy, coverageMap);

  const mx100Top = mx100.slice(0, 20).map((row) => ({
    rank: row.rank,
    artist: row.artist,
    score: row.score,
    spotifyRank: row.spotifyRank,
    youtubeRank: row.youtubeRank,
    youtubeViews: row.youtubeViews,
    fanbase: row.fanbase,
    touringDates: row.touringDates,
  }));
  const mx100Suspicious = mx100
    .filter((row) => row.rank <= 25 && !row.spotifyRank && !row.youtubeRank)
    .map((row) => ({ rank: row.rank, artist: row.artist, score: row.score, fanbase: row.fanbase, touringDates: row.touringDates }));
  const legacySuspicious = legacyLive.filter((row) => row.status !== "ok");

  await writeCsv("mx100-audit.csv", mx100);
  await writeCsv("legacy-audit.csv", legacy);
  await writeCsv("legacy-live-kworb-audit.csv", legacyLive);
  await writeCsv("legacy-suspicious.csv", legacySuspicious);
  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    metadataCount: metadata.length,
    spotifyWeeklyRows: hub.sheets?.Spotify_Artists_Weekly?.rows?.length ?? 0,
    youtubeWeeklyRows: hub.sheets?.YT_Artists_Weekly?.rows?.length ?? 0,
    mx100Top,
    mx100Suspicious,
    legacyTop: legacy.slice(0, 20).map((row) => ({
      rank: row.rank,
      artist: row.artist,
      catalog: row.catalog,
      catalogFmt: compact(row.catalog),
      spotifyCatalog: row.spotifyCatalog,
      youtubeCatalog: row.youtubeCatalog,
    })),
    legacySuspicious,
  }, null, 2));

  console.log(JSON.stringify({
    outDir: OUT_DIR,
    metadataCount: metadata.length,
    mx100Top5: mx100Top.slice(0, 5),
    legacyTop5: legacy.slice(0, 5).map((row) => ({ rank: row.rank, artist: row.artist, catalogFmt: compact(row.catalog) })),
    legacySuspiciousCount: legacySuspicious.length,
    legacySuspicious: legacySuspicious.slice(0, 12),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
