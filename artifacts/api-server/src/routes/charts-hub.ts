import { Router } from "express";

const router = Router();
const SHEET_ID = "1pmfNth0H5qlXXs-6ZfYMC57YQXCoRQTk3_3NB8scHl4";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/* ── Sheet manifest (matches Chart_Manifest) ────────────────────────────── */
const SHEETS = [
  "YT_Artists_Weekly",
  "YT_Songs_Weekly",
  "YT_Videos_Daily",
  "YT_Shorts_Daily",
  "Spotify_Regional_Daily",
  "Spotify_Regional_Weekly",
  "Spotify_Viral_Daily",
  "Apple_Songs",
  "Apple_Albums",
  "Deezer_Top_Mexico",
] as const;

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

/* ── Fetch one sheet as CSV ─────────────────────────────────────────────── */
async function fetchSheet(name: SheetName): Promise<SheetData> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
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

/* ── Fetch all sheets in parallel ────────────────────────────────────────── */
async function fetchAll(): Promise<CacheSlot> {
  const results = await Promise.all(SHEETS.map(s => fetchSheet(s)));
  const data = {} as Record<SheetName, SheetData>;
  SHEETS.forEach((s, i) => { data[s] = results[i]; });
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
          // Serve stale on failure
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
