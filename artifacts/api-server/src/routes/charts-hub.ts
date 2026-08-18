import { Router } from "express";
import {
  matchedMexicanArtists,
  normalizeChartArtistCredit,
  normalizeChartArtistName,
  splitChartArtistCredit,
} from "../lib/mexican-chart-credit-matching";
import { archiveOfficialCharts, ensureOfficialChartArchive } from "../lib/official-chart-archive";

const router = Router();
const SHEET_ID = "1pmfNth0H5qlXXs-6ZfYMC57YQXCoRQTk3_3NB8scHl4";
const CACHE_TTL    = 2 * 60 * 1000; // chart editions can change during the day
const MASTER_TTL   =  6 * 60 * 60 * 1000; // 6 hours

/* ── Sheet manifest (matches Chart_Manifest) ────────────────────────────── */
const SHEETS = [
  "YT_Artists_Weekly",
  "YT_Songs_Weekly",
  "YT_Videos_Daily",
  "YT_Shorts_Daily",
  "Spotify_Artists_Daily",
  "Spotify_Artists_Weekly",
  "Spotify_Regional_Daily",
  "Spotify_Regional_Weekly",
  "Spotify_Viral_Daily",
  "Apple_Songs",
  "Apple_Albums",
  "Deezer_Top_Mexico",
] as const;

// Maps internal key → actual Google Sheets tab name when they differ
const SHEET_TAB_NAMES: Partial<Record<SheetName, string>> = {
  Deezer_Top_Mexico: "Deezer Top Mexico",
};

type SheetName = typeof SHEETS[number];
type Row = Record<string, string>;

interface SheetData {
  headers: string[];
  rows: Row[];
  chartDate: string | null;
  fetchedAt: string | null;
}

interface CacheSlot {
  data: Record<SheetName, SheetData>;
  lastUpdated: string;
  fetchedAt: number;
}

let cache: CacheSlot | null = null;

/* ── CSV parser (handles quoted fields with commas inside) ───────────────── */
function parseCSV(text: string): { headers: string[]; rows: Row[] } {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };

  function splitRow(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        fields.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  const headers = splitRow(lines[0]).map(h => h.replace(/^\uFEFF/, ""));
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitRow(lines[i]);
    if (vals.every(v => !v.trim())) continue;
    const row: Row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? "").trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function chartDateFromSheet(data: { rows: Row[] }): string | null {
  const first = data.rows[0];
  if (!first) return null;

  for (const key of ["Chart Date", "chart_date", "Date", "date", "Week Ending", "week_ending"]) {
    const value = first[key]?.trim();
    if (!value) continue;
    const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    if (iso) return iso;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  for (const key of ["Source File", "source_file"]) {
    const value = first[key]?.trim() ?? "";
    const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    if (iso) return iso;
  }

  return null;
}

/* ── Normalise movement values (Google Sheets adds leading ' to + values) ── */
function cleanMovement(val: string): string {
  return val.replace(/^'/, "").trim();
}

/* ── Mexican artist normalisation (identical to kworb's toSlug) ─────────── */
function normName(s: string): string {
  return normalizeChartArtistName(s);
}

// Spotify/YouTube sometimes interchange an ampersand with the Spanish
// conjunction in an otherwise identical official group name (for example,
// "Julion Alvarez & Su Norteño Banda" vs "... y Su Norteño Banda").
// Keep the strict form first, then use this connector-neutral form only for
// comparing the complete credit so collaborations are not over-matched.
function normCredit(s: string): string {
  return normalizeChartArtistCredit(s);
}

/* ── Verified Mexican-identity registry cache ──────────────────────────────
 * This lightweight registry is intentionally independent of artist profile
 * enrollment and provider monitoring. It can classify an official chart row
 * without creating a Songstats artist or a full Mexico Charts profile.
 */
let masterCache: { norms: Set<string>; fetchedAt: number } | null = null;

async function fetchMasterNorms(): Promise<Set<string>> {
  if (masterCache && Date.now() - masterCache.fetchedAt < MASTER_TTL) {
    return masterCache.norms;
  }
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Mexican_Artist_Master`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`Mexican_Artist_Master: HTTP ${resp.status}`);
  const { headers, rows } = parseCSV(await resp.text());

  // Columns: "Artist Name", "Normalized Name"
  const nameKey = headers.find(h => /artist.name/i.test(h)) ?? headers[0];
  const normKey = headers.find(h => /normalized/i.test(h)) ?? headers[1];

  const norms = new Set<string>();
  for (const row of rows) {
    const name = row[nameKey] ?? "";
    const normalized = row[normKey] ?? "";
    if (name) {
      norms.add(normName(name));
      norms.add(normCredit(name));
    }
    if (normalized) {
      norms.add(normName(normalized));
      norms.add(normCredit(normalized));
    }
  }
  try {
    const { loadVerifiedDiscoveredIdentityNorms } = await import("../lib/mexican-identity-discovery-service");
    const discovered = await loadVerifiedDiscoveredIdentityNorms();
    for (const norm of discovered) norms.add(norm);
  } catch {
    // The sheet remains the safe baseline while the optional discovery table
    // is unavailable or being created during a first deployment.
  }
  masterCache = { norms, fetchedAt: Date.now() };
  console.log(`[charts-hub] Mexican_Artist_Master loaded — ${norms.size} normalised entries`);
  return norms;
}

export async function getVerifiedMexicanIdentityNorms(): Promise<Set<string>> {
  return new Set(await fetchMasterNorms());
}

/* ── Artist column name per sheet ────────────────────────────────────────── */
const ARTIST_FIELD: Partial<Record<SheetName, string>> = {
  YT_Artists_Weekly:       "Artist Name",
  YT_Songs_Weekly:         "Artist Names",
  YT_Videos_Daily:         "Artist Names",
  YT_Shorts_Daily:         "Artist Names",
  Spotify_Artists_Daily:   "Artist",
  Spotify_Artists_Weekly:  "Artist",
  Spotify_Regional_Daily:  "artist_names",
  Spotify_Regional_Weekly: "artist_names",
  Spotify_Viral_Daily:     "artist_names",
  Apple_Songs:             "Artist",
  Apple_Albums:            "Artist",
  Deezer_Top_Mexico:       "Artist",
};

/* ── Compute Contains Mexican Artist for sheets that don't have it ───────── */
function enrichSheet(
  sheetName: SheetName,
  data: SheetData,
  masterNorms: Set<string>,
): SheetData {
  const artistField = ARTIST_FIELD[sheetName];
  if (!artistField || !data.headers.includes(artistField)) return data;

  const alreadyHasFlag = data.headers.includes("Contains Mexican Artist");
  const alreadyHasMatches = data.headers.includes("Matched Mexican Artists");
  const rows = data.rows.map(row => {
    const credit = row[artistField] ?? "";
    const dynamicallyMatched = matchedMexicanArtists(credit, masterNorms);
    const existingMatched = (row["Matched Mexican Artists"] ?? "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);
    const matched = [...new Set([...existingMatched, ...dynamicallyMatched])];
    const existingTrue = /^(?:true|yes|1)$/i.test(row["Contains Mexican Artist"] ?? "");
    return {
      ...row,
      "Contains Mexican Artist":  existingTrue || matched.length ? "TRUE" : "FALSE",
      "Matched Mexican Artists":  matched.join(", "),
    };
  });

  return {
    headers: [
      ...data.headers,
      ...(alreadyHasFlag ? [] : ["Contains Mexican Artist"]),
      ...(alreadyHasMatches ? [] : ["Matched Mexican Artists"]),
    ],
    rows,
    chartDate: data.chartDate,
    fetchedAt: data.fetchedAt,
  };
}

/* ── Fetch one sheet as CSV ─────────────────────────────────────────────── */
async function fetchSheet(name: SheetName): Promise<SheetData> {
  const tabName = SHEET_TAB_NAMES[name] ?? name;
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`Sheet ${name}: HTTP ${resp.status}`);
  const text = await resp.text();

  const parsed = parseCSV(text);

  // Normalise movement column if present
  const movKey = parsed.headers.find(h => h.toLowerCase() === "movement");
  if (movKey) {
    parsed.rows = parsed.rows.map(r => ({ ...r, [movKey]: cleanMovement(r[movKey] ?? "") }));
  }

  return { ...parsed, chartDate: chartDateFromSheet(parsed), fetchedAt: null };
}

interface AppleChartResult {
  artistName?: string;
  id?: string;
  name?: string;
  url?: string;
}

function mexicoDate(instant = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

async function fetchAppleChart(kind: "songs" | "albums"): Promise<SheetData> {
  const resp = await fetch(
    `https://rss.marketingtools.apple.com/api/v2/mx/music/most-played/100/${kind}.json`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!resp.ok) throw new Error(`Apple ${kind}: HTTP ${resp.status}`);

  const payload = await resp.json() as { feed?: { results?: AppleChartResult[] } };
  const results = payload.feed?.results ?? [];
  if (results.length !== 100) {
    throw new Error(`Apple ${kind}: expected 100 official rows, received ${results.length}`);
  }

  const fetchedAt = new Date().toISOString();
  const chartDate = mexicoDate(new Date(fetchedAt));
  const isAlbums = kind === "albums";
  const headers = [
    "Rank", "Movement", "Artist Names", "Title", "Platform", "Chart",
    "Geography", "Chart Source URL", "Fetched At", "Chart Date",
  ];
  const rows = results.map((item, index) => ({
    "Rank": String(index + 1),
    "Movement": "",
    "Artist Names": item.artistName ?? "",
    "Title": item.name ?? "",
    "Platform": "Apple Music",
    "Chart": isAlbums ? "Top Albums MX" : "Top Songs MX",
    "Geography": "Mexico",
    "Chart Source URL": item.url ?? (item.id ? `https://music.apple.com/mx/${isAlbums ? "album" : "song"}/${item.id}` : ""),
    "Fetched At": fetchedAt,
    "Chart Date": chartDate,
  }));

  return { headers, rows, chartDate, fetchedAt };
}

interface DeezerPlaylistTrack {
  id?: number;
  title?: string;
  duration?: number;
  explicit_lyrics?: boolean;
  preview?: string;
  link?: string;
  artist?: { id?: number; name?: string };
  album?: { id?: number; title?: string };
}

async function fetchDeezerTopMexico(): Promise<SheetData> {
  const resp = await fetch(
    "https://api.deezer.com/playlist/1111142361?limit=100",
    { signal: AbortSignal.timeout(15000) },
  );
  if (!resp.ok) throw new Error(`Deezer Top Mexico: HTTP ${resp.status}`);

  const payload = await resp.json() as { tracks?: { data?: DeezerPlaylistTrack[] } };
  const tracks = payload.tracks?.data ?? [];
  if (tracks.length < 1) throw new Error("Deezer Top Mexico: empty official playlist");

  const chartDate = new Date().toISOString().slice(0, 10);
  const fetchedAt = new Date().toISOString();
  const headers = [
    "Rank", "Title", "Artist", "Album", "Duration Seconds", "Duration",
    "Explicit", "Track ID", "Artist ID", "Album ID", "Preview URL",
    "Track Link", "Source", "Fetched At", "Chart Date",
  ];
  const rows = tracks.map((track, index) => {
    const duration = Math.max(0, Math.floor(track.duration ?? 0));
    return {
      "Rank": String(index + 1),
      "Title": track.title ?? "",
      "Artist": track.artist?.name ?? "",
      "Album": track.album?.title ?? "",
      "Duration Seconds": String(duration),
      "Duration": `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
      "Explicit": track.explicit_lyrics ? "TRUE" : "FALSE",
      "Track ID": track.id ? String(track.id) : "",
      "Artist ID": track.artist?.id ? String(track.artist.id) : "",
      "Album ID": track.album?.id ? String(track.album.id) : "",
      "Preview URL": track.preview ?? "",
      "Track Link": track.link ?? (track.id ? `https://www.deezer.com/track/${track.id}` : ""),
      "Source": "Deezer Top Mexico playlist",
      "Fetched At": fetchedAt,
      "Chart Date": chartDate,
    };
  });

  return { headers, rows, chartDate, fetchedAt };
}

/* ── Fetch all sheets + enrich with Mexican artist flags ─────────────────── */
async function fetchAll(): Promise<CacheSlot> {
  const [results, masterNorms] = await Promise.all([
    Promise.all(SHEETS.map(async s => {
      try {
        if (s === "Apple_Songs") return await fetchAppleChart("songs");
        if (s === "Apple_Albums") return await fetchAppleChart("albums");
        if (s === "Deezer_Top_Mexico") return await fetchDeezerTopMexico();
      } catch (error) {
        console.warn(`[charts-hub] Live ${s} fetch failed; using sheet fallback`, error);
      }
      return fetchSheet(s);
    })),
    fetchMasterNorms().catch(() => {
      console.warn("[charts-hub] Could not fetch verified Mexican-identity registry — filter will be limited");
      return new Set<string>();
    }),
  ]);

  const data = {} as Record<SheetName, SheetData>;
  SHEETS.forEach((s, i) => {
    data[s] = enrichSheet(s, results[i], masterNorms);
  });

  return { data, lastUpdated: new Date().toISOString(), fetchedAt: Date.now() };
}

export async function getOfficialChartArtistCredits(): Promise<string[]> {
  const slot = await fetchAll();
  const names = new Map<string, string>();
  for (const sheetName of SHEETS) {
    const field = ARTIST_FIELD[sheetName];
    if (!field) continue;
    for (const row of slot.data[sheetName].rows) {
      for (const part of splitChartArtistCredit(row[field] ?? "")) {
        const norm = normName(part);
        if (norm && !names.has(norm)) names.set(norm, part.trim());
      }
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

export type CurrentMexicanChartArtist = {
  artistKey: string;
  artistName: string;
  bestRank: number;
  chartSources: number;
  chartAppearances: number;
  latestChartDate: string | null;
};

export async function getCurrentMexicanChartArtists(): Promise<CurrentMexicanChartArtist[]> {
  if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL) cache = await fetchAll();
  const artists = new Map<string, {
    artistName: string; bestRank: number; sources: Set<string>;
    appearances: number; latestChartDate: string | null;
  }>();

  for (const sheetName of SHEETS) {
    const sheet = cache.data[sheetName];
    for (const row of sheet.rows) {
      if ((row["Contains Mexican Artist"] ?? "").toUpperCase() !== "TRUE") continue;
      const matched = (row["Matched Mexican Artists"] ?? "")
        .split(",").map(value => value.trim()).filter(Boolean);
      const rank = Number.parseInt(row["Rank"] ?? row["rank"] ?? "", 10);
      for (const artistName of matched) {
        const artistKey = normName(artistName);
        if (!artistKey) continue;
        const current = artists.get(artistKey) ?? {
          artistName, bestRank: Number.isFinite(rank) ? rank : 9999,
          sources: new Set<string>(), appearances: 0, latestChartDate: null,
        };
        current.bestRank = Math.min(current.bestRank, Number.isFinite(rank) ? rank : 9999);
        current.sources.add(sheetName);
        current.appearances += 1;
        if (sheet.chartDate && (!current.latestChartDate || sheet.chartDate > current.latestChartDate)) {
          current.latestChartDate = sheet.chartDate;
        }
        artists.set(artistKey, current);
      }
    }
  }

  return [...artists.entries()].map(([artistKey, artist]) => ({
    artistKey,
    artistName: artist.artistName,
    bestRank: artist.bestRank === 9999 ? 999 : artist.bestRank,
    chartSources: artist.sources.size,
    chartAppearances: artist.appearances,
    latestChartDate: artist.latestChartDate,
  }));
}

/* ── Route: GET /api/charts/hub ──────────────────────────────────────────── */
router.get("/charts/hub", async (_req, res) => {
  try {
    if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL) {
      try {
        cache = await fetchAll();
      } catch (err) {
        if (cache) {
          res.setHeader("X-Cache-Stale", "true");
        } else {
          throw err;
        }
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ lastUpdated: cache!.lastUpdated, sheets: cache!.data });
    void archiveOfficialCharts(cache!.data).catch(error => {
      console.warn("[charts-hub] official chart archive unavailable", error);
    });
  } catch (err) {
    res.status(502).json({ error: "Chart data unavailable", detail: String(err) });
  }
});

router.get("/charts/history", async (req, res) => {
  const chartKey = String(req.query["chart"] ?? "").trim();
  const requestedLimit = Number.parseInt(String(req.query["limit"] ?? "30"), 10);
  const limit = Math.min(365, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 30));
  try {
    await ensureOfficialChartArchive();
    const params: Array<string | number> = [];
    const where = chartKey ? `WHERE chart_key = $${params.push(chartKey)}` : "";
    params.push(limit);
    const result = await (await import("@workspace/db")).pool.query<{
      chart_key: string; chart_date: string; fetched_at: string; row_count: number;
    }>(`
      SELECT chart_key, chart_date, fetched_at::text, row_count
      FROM official_chart_snapshots
      ${where}
      ORDER BY chart_date DESC, chart_key ASC
      LIMIT $${params.length}
    `, params);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.json({ generatedAt: new Date().toISOString(), chart: chartKey || null, editions: result.rows.map(row => ({
      chartKey: row.chart_key, chartDate: row.chart_date, fetchedAt: row.fetched_at, rowCount: row.row_count,
    })) });
  } catch (error) {
    res.status(500).json({ error: "Chart history unavailable", detail: String(error) });
  }
});

router.get("/charts/history/:chartKey/:chartDate", async (req, res) => {
  try {
    await ensureOfficialChartArchive();
    const result = await (await import("@workspace/db")).pool.query<{
      chart_key: string; chart_date: string; fetched_at: string; row_count: number; payload: { headers: string[]; rows: Row[] };
    }>(`
      SELECT chart_key, chart_date, fetched_at::text, row_count, payload
      FROM official_chart_snapshots WHERE chart_key=$1 AND chart_date=$2 LIMIT 1
    `, [req.params["chartKey"], req.params["chartDate"]]);
    const edition = result.rows[0];
    if (!edition) { res.status(404).json({ error: "Chart edition not found" }); return; }
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.json({ chartKey: edition.chart_key, chartDate: edition.chart_date, fetchedAt: edition.fetched_at,
      rowCount: edition.row_count, ...edition.payload });
  } catch (error) {
    res.status(500).json({ error: "Chart edition unavailable", detail: String(error) });
  }
});

/* ── Warm cache on startup ───────────────────────────────────────────────── */
setTimeout(() => {
  fetchAll().then(c => { cache = c; }).catch(() => {});
}, 3000);

export default router;
