import { Router } from "express";

const router = Router();
const SHEET_ID = "1pmfNth0H5qlXXs-6ZfYMC57YQXCoRQTk3_3NB8scHl4";
const CACHE_TTL    = 60 * 60 * 1000; // 1 hour
const MASTER_TTL   =  6 * 60 * 60 * 1000; // 6 hours

/* ── Sheet manifest (matches Chart_Manifest) ────────────────────────────── */
const SHEETS = [
  "YT_Artists_Weekly",
  "YT_Songs_Weekly",
  "YT_Videos_Daily",
  "YT_Shorts_Daily",
  "Spotify_Artists_Daily",
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

  const headers = splitRow(lines[0]);
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

/* ── Normalise movement values (Google Sheets adds leading ' to + values) ── */
function cleanMovement(val: string): string {
  return val.replace(/^'/, "").trim();
}

/* ── Mexican artist normalisation (identical to kworb's toSlug) ─────────── */
function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/* ── Split artist credit string into individual names ───────────────────── */
function splitCredit(credit: string): string[] {
  return credit
    .split(/,|&|\/|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+and\s+|\s+y\s+|\s+junto\s+a\s+/gi)
    .map(s => s.trim())
    .filter(s => s.length > 1);
}

/* ── Mexican_Artist_Master cache ─────────────────────────────────────────── */
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
    if (name) norms.add(normName(name));
    if (normalized) norms.add(normName(normalized));
  }
  masterCache = { norms, fetchedAt: Date.now() };
  console.log(`[charts-hub] Mexican_Artist_Master loaded — ${norms.size} normalised entries`);
  return norms;
}

/* ── Artist column name per sheet ────────────────────────────────────────── */
const ARTIST_FIELD: Partial<Record<SheetName, string>> = {
  YT_Artists_Weekly:       "Artist Name",
  YT_Songs_Weekly:         "Artist Names",
  YT_Videos_Daily:         "Artist Names",
  YT_Shorts_Daily:         "Artist Names",
  Spotify_Artists_Daily:   "Artist",
  Spotify_Regional_Daily:  "artist_names",
  Spotify_Regional_Weekly: "artist_names",
  Spotify_Viral_Daily:     "artist_names",
  Deezer_Top_Mexico:       "Artist",
};

/* ── Compute Contains Mexican Artist for sheets that don't have it ───────── */
function enrichSheet(
  sheetName: SheetName,
  data: SheetData,
  masterNorms: Set<string>,
): SheetData {
  // Already pre-computed in the sheet (Apple Music sheets)
  if (data.headers.includes("Contains Mexican Artist")) return data;

  const artistField = ARTIST_FIELD[sheetName];
  if (!artistField || !data.headers.includes(artistField)) return data;

  const rows = data.rows.map(row => {
    const credit = row[artistField] ?? "";
    const parts  = splitCredit(credit);
    const matched = parts.filter(p => masterNorms.has(normName(p)));
    return {
      ...row,
      "Contains Mexican Artist":  matched.length ? "TRUE" : "FALSE",
      "Matched Mexican Artists":  matched.join(", "),
    };
  });

  return {
    headers: [...data.headers, "Contains Mexican Artist", "Matched Mexican Artists"],
    rows,
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

  return parsed;
}

/* ── Fetch all sheets + enrich with Mexican artist flags ─────────────────── */
async function fetchAll(): Promise<CacheSlot> {
  const [results, masterNorms] = await Promise.all([
    Promise.all(SHEETS.map(s => fetchSheet(s))),
    fetchMasterNorms().catch(() => {
      console.warn("[charts-hub] Could not fetch Mexican_Artist_Master — filter will be limited");
      return new Set<string>();
    }),
  ]);

  const data = {} as Record<SheetName, SheetData>;
  SHEETS.forEach((s, i) => {
    data[s] = enrichSheet(s, results[i], masterNorms);
  });

  return { data, lastUpdated: new Date().toISOString(), fetchedAt: Date.now() };
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
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.json({ lastUpdated: cache!.lastUpdated, sheets: cache!.data });
  } catch (err) {
    res.status(502).json({ error: "Chart data unavailable", detail: String(err) });
  }
});

/* ── Warm cache on startup ───────────────────────────────────────────────── */
setTimeout(() => {
  fetchAll().then(c => { cache = c; }).catch(() => {});
}, 3000);

export default router;
