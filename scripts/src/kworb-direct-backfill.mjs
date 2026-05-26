import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg");

const METADATA_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";

const BLOCKED_ARTIST_KEYS = new Set([
  "jesse", "bandatoro", "jonathancaro", "baektowo", "josemejia",
  "elfrizian", "los2primos", "elgerryoficial", "lupeborbonysublindaje7",
  "juanchito", "meloleon", "badguychapo",
]);

const TIER_A_SLUGS = new Set([
  "pesopluma", "fuerzaregida", "grupofrontera", "juniorh", "natanaelcano",
  "carinleon", "eslabonarmado", "gabitoballesteros", "titodoublep", "oscarmaydon",
  "xavi", "grupofirme", "ynglvcas", "luisrconriquez", "grupomarcaregistrada",
  "edenmunoz", "christiannodal", "angelaaguilar", "dannylux", "ivancornejo",
  "calle24", "leninramirez", "bandamsdesergiolizarraga", "chinopacas",
  "elbogueto", "gerardoortiz", "virlangarcia", "luismiguel",
]);

const SNAPSHOT_TTL_MS = {
  A: 26 * 3_600_000,
  B: 3.5 * 24 * 3_600_000,
  C: 8 * 24 * 3_600_000,
  D: 30 * 24 * 3_600_000,
};

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, rawValue] = arg.replace(/^--/, "").split("=");
    return [key, rawValue ?? "true"];
  }),
);

const limit = Number(args.get("limit") ?? 0);
const offset = Number(args.get("offset") ?? 0);
const concurrency = Math.max(1, Math.min(Number(args.get("concurrency") ?? 8), 20));
const onlyMissing = args.get("onlyMissing") === "true";
const dryRun = args.get("dryRun") === "true";

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseCommaNum(value) {
  if (!value) return 0;
  return parseInt(String(value).replace(/,/g, "").trim(), 10) || 0;
}

function fmtNum(n) {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted && ch === "\"" && next === "\"") {
      cell += "\"";
      i++;
    } else if (ch === "\"") {
      quoted = !quoted;
    } else if (!quoted && ch === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
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

function parseSpotifyPage(html) {
  const rows = parseTableRows(html);
  let totalStreams = 0;
  let dailyStreams = 0;
  let trackCount = 0;
  const topTracks = [];

  for (const cells of rows) {
    const first = cells[0] ?? "";
    if (first === "Streams" && cells[1]) totalStreams = parseCommaNum(cells[1]);
    else if (first === "Daily" && cells[1]) dailyStreams = parseCommaNum(cells[1]);
    else if (first === "Tracks" && cells[1]) trackCount = parseCommaNum(cells[1]);
    else if (topTracks.length < 10 && cells.length >= 2 && first && cells[1] && /^\d[\d,]+$/.test(cells[1])) {
      const streams = parseCommaNum(cells[1]);
      const daily = cells[2] ? parseCommaNum(cells[2]) : 0;
      topTracks.push({
        title: first.replace(/^\* /, ""),
        streams,
        streamsFmt: fmtNum(streams),
        daily,
        dailyFmt: fmtNum(daily),
      });
    }
  }

  if (!totalStreams) return null;
  return {
    totalStreams,
    totalStreamsFmt: fmtNum(totalStreams),
    dailyStreams,
    dailyStreamsFmt: fmtNum(dailyStreams),
    trackCount,
    topTracks,
  };
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

const PLATFORM_MARKERS = [
  ["Spotify:", "spotifyMx"],
  ["Apple Music:", "appleMusicMx"],
  ["YouTube:", "youtubeMx"],
  ["iTunes:", "itunesMx"],
  ["Deezer:", "deezerMx"],
];

function parseItunesPage(html) {
  const positions = [];
  for (const match of html.matchAll(/<td[^>]*>(.*?)<\/td>/gs)) {
    const raw = match[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (!raw) continue;
    const firstPlatformIdx = PLATFORM_MARKERS.reduce((min, [marker]) => {
      const idx = raw.indexOf(marker);
      return idx >= 0 && idx < min ? idx : min;
    }, raw.length);
    const song = raw.slice(0, firstPlatformIdx).replace(/\n/g, " ").trim();
    if (!song || song.length > 80 || /^Album:|^Álbum:/i.test(song)) continue;
    const entry = { song };
    let hasMexico = false;
    for (const [marker, field] of PLATFORM_MARKERS) {
      const start = raw.indexOf(marker);
      if (start < 0) continue;
      let end = raw.length;
      for (const [nextMarker] of PLATFORM_MARKERS) {
        const nextIdx = raw.indexOf(nextMarker, start + marker.length);
        if (nextIdx >= 0 && nextIdx < end) end = nextIdx;
      }
      const mxMatch = raw.slice(start, end).match(/#(\d+)\s*Mexico/);
      if (mxMatch) {
        entry[field] = parseInt(mxMatch[1], 10);
        hasMexico = true;
      }
    }
    if (hasMexico) positions.push(entry);
  }
  const seen = new Set();
  const deduped = positions.filter(position => {
    const key = position.song.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.length ? deduped.slice(0, 10) : null;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)",
      "Accept": "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return response.text();
}

async function loadSpotifyIndex() {
  const map = new Map();
  const html = await fetchPage("https://kworb.net/spotify/artists.html");
  if (!html) return map;
  const re = /href="\/spotify\/artist\/([A-Za-z0-9]{22})_songs\.html"[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    map.set(toSlug(match[2].trim()), match[1]);
  }
  return map;
}

async function loadArtists() {
  const response = await fetch(METADATA_SHEET_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Metadata sheet HTTP ${response.status}`);
  const rows = parseCsv(await response.text());
  const headers = (rows[0] ?? []).map(header => header.toLowerCase().trim());
  const nameIdx = headers.indexOf("artist_name");
  if (nameIdx < 0) throw new Error("artist_name column not found in metadata sheet");
  const seen = new Set();
  const artists = [];
  for (const row of rows.slice(1)) {
    const name = (row[nameIdx] ?? "").trim();
    const slug = toSlug(name);
    if (!name || !slug || BLOCKED_ARTIST_KEYS.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    artists.push({ name, slug, tier: TIER_A_SLUGS.has(slug) ? "A" : "B" });
  }
  return artists;
}

async function ensureKworbTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kworb_coverage (
      artist_key text PRIMARY KEY,
      artist_name text NOT NULL,
      spotify_id text,
      has_spotify boolean NOT NULL DEFAULT false,
      has_youtube boolean NOT NULL DEFAULT false,
      has_itunes boolean NOT NULL DEFAULT false,
      tier text NOT NULL DEFAULT 'B',
      status text NOT NULL DEFAULT 'pending',
      consecutive_failures integer NOT NULL DEFAULT 0,
      last_discovered_at timestamp with time zone,
      last_fetch_at timestamp with time zone,
      last_failed_at timestamp with time zone,
      created_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kworb_snapshots (
      artist_key text NOT NULL,
      metric_type text NOT NULL,
      value jsonb NOT NULL,
      fetched_at timestamp with time zone NOT NULL DEFAULT now(),
      expires_at timestamp with time zone NOT NULL,
      PRIMARY KEY (artist_key, metric_type)
    )
  `);
}

async function saveSnapshot(pool, artist, metricType, value) {
  const expiresAt = new Date(Date.now() + (SNAPSHOT_TTL_MS[artist.tier] ?? SNAPSHOT_TTL_MS.B));
  await pool.query(`
    INSERT INTO kworb_snapshots (artist_key, metric_type, value, expires_at)
    VALUES ($1, $2, $3::jsonb, $4)
    ON CONFLICT (artist_key, metric_type)
    DO UPDATE SET value = EXCLUDED.value, fetched_at = now(), expires_at = EXCLUDED.expires_at
  `, [artist.slug, metricType, JSON.stringify(value), expiresAt]);
}

async function saveCoverage(pool, artist, spotifyId, spotify, youtube, itunes) {
  const status = spotify || youtube || itunes ? "active" : "not_found";
  await pool.query(`
    INSERT INTO kworb_coverage (
      artist_key, artist_name, spotify_id, has_spotify, has_youtube, has_itunes,
      tier, status, consecutive_failures, last_discovered_at, last_fetch_at, last_failed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, $11)
    ON CONFLICT (artist_key)
    DO UPDATE SET
      artist_name = EXCLUDED.artist_name,
      spotify_id = COALESCE(EXCLUDED.spotify_id, kworb_coverage.spotify_id),
      has_spotify = kworb_coverage.has_spotify OR EXCLUDED.has_spotify,
      has_youtube = kworb_coverage.has_youtube OR EXCLUDED.has_youtube,
      has_itunes = kworb_coverage.has_itunes OR EXCLUDED.has_itunes,
      tier = EXCLUDED.tier,
      status = CASE
        WHEN EXCLUDED.status = 'active' OR kworb_coverage.status = 'active' THEN 'active'
        ELSE EXCLUDED.status
      END,
      consecutive_failures = CASE
        WHEN EXCLUDED.status = 'active' THEN 0
        ELSE kworb_coverage.consecutive_failures + 1
      END,
      last_discovered_at = now(),
      last_fetch_at = COALESCE(EXCLUDED.last_fetch_at, kworb_coverage.last_fetch_at),
      last_failed_at = CASE
        WHEN EXCLUDED.status = 'active' THEN NULL
        ELSE EXCLUDED.last_failed_at
      END
  `, [
    artist.slug,
    artist.name,
    spotifyId,
    Boolean(spotify),
    Boolean(youtube),
    Boolean(itunes),
    artist.tier,
    status,
    status === "active" ? 0 : 1,
    status === "active" ? new Date() : null,
    status === "active" ? null : new Date(),
  ]);
}

async function fetchArtist(pool, spotifyIndex, artist) {
  let spotifyId = spotifyIndex.get(artist.slug) ?? null;
  let spotify = null;
  let youtube = null;
  let itunes = null;
  const errors = [];

  try {
    if (spotifyId) {
      const html = await fetchPage(`https://kworb.net/spotify/artist/${spotifyId}_songs.html`);
      if (html) spotify = parseSpotifyPage(html);
    }
  } catch (error) {
    errors.push(`spotify: ${(error).message ?? String(error)}`);
  }

  try {
    const html = await fetchPage(`https://kworb.net/youtube/artist/${artist.slug}.html`);
    if (html) youtube = parseYouTubePage(html);
  } catch (error) {
    errors.push(`youtube: ${(error).message ?? String(error)}`);
  }

  try {
    const html = await fetchPage(`https://kworb.net/itunes/artist/${artist.slug}.html`);
    if (html) {
      itunes = parseItunesPage(html);
      if (!spotifyId) {
        const match = html.match(/\/spotify\/artist\/([A-Za-z0-9]{22})_songs\.html/);
        if (match?.[1]) spotifyId = match[1];
      }
    }
  } catch (error) {
    errors.push(`charts: ${(error).message ?? String(error)}`);
  }

  if (!spotify && spotifyId) {
    try {
      const html = await fetchPage(`https://kworb.net/spotify/artist/${spotifyId}_songs.html`);
      if (html) spotify = parseSpotifyPage(html);
    } catch (error) {
      errors.push(`spotify-late: ${(error).message ?? String(error)}`);
    }
  }

  if (!dryRun) {
    if (spotify) await saveSnapshot(pool, artist, "spotify", spotify);
    if (youtube) await saveSnapshot(pool, artist, "youtube", youtube);
    if (itunes) await saveSnapshot(pool, artist, "itunes", itunes);
    await saveCoverage(pool, artist, spotifyId, spotify, youtube, itunes);
  }

  return { artist, spotifyId, spotify, youtube, itunes, errors };
}

async function getExistingMissingSet(pool) {
  if (!onlyMissing) return null;
  const { rows } = await pool.query(`
    SELECT artist_key
    FROM kworb_coverage c
    WHERE NOT EXISTS (
      SELECT 1 FROM kworb_snapshots s WHERE s.artist_key = c.artist_key
    )
    OR NOT (has_spotify OR has_youtube OR has_itunes)
  `);
  return new Set(rows.map(row => row.artist_key));
}

function printResult(result, stats) {
  const parts = [];
  if (result.spotify) parts.push(`Spotify ${fmtNum(result.spotify.dailyStreams)}/day`);
  if (result.youtube) parts.push(`YouTube ${fmtNum(result.youtube.dailyAvg)}/day`);
  if (result.itunes) parts.push(`Charts ${result.itunes.length}`);
  if (!parts.length) parts.push("no Kworb data");
  if (result.errors.length) parts.push(`errors ${result.errors.length}`);
  console.log(`[${stats.checked}/${stats.total}] ${result.artist.name} — ${parts.join(" · ")}`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing DATABASE_URL");

  const pool = new Pool({ connectionString: databaseUrl });
  await ensureKworbTables(pool);

  console.log("[kworb-direct] Loading active artist sheet");
  let artists = await loadArtists();
  const existingMissing = await getExistingMissingSet(pool);
  if (existingMissing) artists = artists.filter(artist => existingMissing.has(artist.slug));
  artists = artists.slice(offset, limit > 0 ? offset + limit : undefined);

  console.log("[kworb-direct] Loading Kworb Spotify artist index");
  const spotifyIndex = await loadSpotifyIndex();

  const stats = {
    total: artists.length,
    checked: 0,
    spotify: 0,
    youtube: 0,
    charts: 0,
    any: 0,
    none: 0,
    errors: 0,
  };

  console.log(`[kworb-direct] Starting: artists=${stats.total} concurrency=${concurrency} dryRun=${dryRun} onlyMissing=${onlyMissing}`);

  let cursor = 0;
  async function worker() {
    while (cursor < artists.length) {
      const artist = artists[cursor++];
      const result = await fetchArtist(pool, spotifyIndex, artist);
      stats.checked++;
      if (result.spotify) stats.spotify++;
      if (result.youtube) stats.youtube++;
      if (result.itunes) stats.charts++;
      if (result.spotify || result.youtube || result.itunes) stats.any++;
      else stats.none++;
      if (result.errors.length) stats.errors++;
      printResult(result, stats);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  console.log("");
  console.log("[kworb-direct] DONE");
  console.table(stats);

  const { rows } = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE has_spotify) AS spotify,
      COUNT(*) FILTER (WHERE has_youtube) AS youtube,
      COUNT(*) FILTER (WHERE has_itunes) AS charts,
      COUNT(*) FILTER (WHERE has_spotify OR has_youtube OR has_itunes) AS any_data,
      COUNT(*) FILTER (WHERE NOT has_spotify AND NOT has_youtube AND NOT has_itunes) AS no_data
    FROM kworb_coverage
  `);
  console.log("[kworb-direct] Coverage table now");
  console.table(rows[0]);

  await pool.end();
}

main().catch(error => {
  console.error("[kworb-direct] Fatal:", error);
  process.exit(1);
});
