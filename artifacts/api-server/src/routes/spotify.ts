import { Router } from "express";
import { db, artistImages } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

/* ── Two-tier cache ──────────────────────────────────────────────────────────
   imageCache : key → real CDN URL   (permanent — only stored when a real URL is found)
   missCache  : key → timestamp      (temporary — retry nulls after MISS_TTL ms)
   This prevents rate-limit / transient failures during startup warm-up from
   permanently suppressing images for artists that do have Deezer entries.
─────────────────────────────────────────────────────────────────────────── */
const imageCache = new Map<string, string>();
const missCache  = new Map<string, number>();
const MISS_TTL   = 5 * 60 * 1000; // 5 minutes before retrying a null result

/* ── Helpers ── */
function getCached(key: string): string | null | undefined {
  if (imageCache.has(key)) return imageCache.get(key)!;                // real URL
  const missAt = missCache.get(key);
  if (missAt !== undefined && Date.now() - missAt < MISS_TTL) return null; // recent miss
  return undefined;                                                      // not cached
}
function setCached(key: string, url: string | null): void {
  const k = key.toLowerCase().trim();
  if (url) { imageCache.set(k, url); missCache.delete(k); persistToDb(k, url); }
  else      { missCache.set(k, Date.now()); }
}

/* ── Persist a real URL to the DB (fire-and-forget) ── */
function persistToDb(artistKey: string, imageUrl: string): void {
  db.insert(artistImages)
    .values({ artistKey, imageUrl })
    .onConflictDoUpdate({ target: artistImages.artistKey, set: { imageUrl } })
    .catch((err) => logger.warn({ err, artistKey }, "[images] DB persist failed"));
}

/* ── Seed with stable Deezer CDN URLs (do NOT use Spotify CDN — those expire) ── */
const SEED: Record<string, string> = {
  "Peso Pluma":         "https://cdn-images.dzcdn.net/images/artist/dde2bf89c1e8da0aeb94436681bc3aac/1000x1000-000000-80-0-0.jpg",
  "Fuerza Regida":      "https://cdn-images.dzcdn.net/images/artist/171bf1e106d8a72d999146f6ace4ecc3/1000x1000-000000-80-0-0.jpg",
  "Natanael Cano":      "https://cdn-images.dzcdn.net/images/artist/3afa81d065245355854d803b55b66681/1000x1000-000000-80-0-0.jpg",
  "Junior H":           "https://cdn-images.dzcdn.net/images/artist/254f1f8b12256b9f4153bee44fefe41d/1000x1000-000000-80-0-0.jpg",
  "Carin León":         "https://cdn-images.dzcdn.net/images/artist/bc375ebd3f94dec3c986441da83baabf/1000x1000-000000-80-0-0.jpg",
  "Grupo Frontera":     "https://cdn-images.dzcdn.net/images/artist/229ce047a0a51ed9e73867ae5fb3468d/1000x1000-000000-80-0-0.jpg",
  "Luis R Conriquez":   "https://cdn-images.dzcdn.net/images/artist/58eb9e104f0a8c07daf705f0e0c12600/1000x1000-000000-80-0-0.jpg",
  "Xavi":               "https://cdn-images.dzcdn.net/images/artist/7d9dd6dfa1e8b7709877edaa90256c90/1000x1000-000000-80-0-0.jpg",
  "Eslabon Armado":     "https://cdn-images.dzcdn.net/images/artist/0bf23cbe60afa9d4fc6ffd152903fbe1/1000x1000-000000-80-0-0.jpg",
  "Gabito Ballesteros": "https://cdn-images.dzcdn.net/images/artist/8e4eac3351c94b8ae1de0fba0c119ff0/1000x1000-000000-80-0-0.jpg",
  "Tito Double P":      "https://cdn-images.dzcdn.net/images/artist/400be5bb76e1e7775a921c39569bd27b/1000x1000-000000-80-0-0.jpg",
  "Oscar Maydon":       "https://cdn-images.dzcdn.net/images/artist/a2507283ac70f758f913702f5f9ee394/1000x1000-000000-80-0-0.jpg",
  "Yng Lvcas":          "https://cdn-images.dzcdn.net/images/artist/f7fb7675b2d304061724bb31c2572d61/1000x1000-000000-80-0-0.jpg",
  "Santa Fe Klan":      "https://cdn-images.dzcdn.net/images/artist/fafd5b7bc22cf437291ac3b1ea683242/1000x1000-000000-80-0-0.jpg",
  "Marca MP":           "https://cdn-images.dzcdn.net/images/artist/ccb589d41f47d3e4e8baf119b9342e96/1000x1000-000000-80-0-0.jpg",
  "Grupo Firme":        "https://cdn-images.dzcdn.net/images/artist/bd8a34556a8cc37d8065b6045ca1fb56/1000x1000-000000-80-0-0.jpg",
  "Banda MS de Sergio Lizárraga": "https://cdn-images.dzcdn.net/images/artist/da1290662d2b260cc8a3b480f81dd253/1000x1000-000000-80-0-0.jpg",
};
for (const [name, url] of Object.entries(SEED)) {
  imageCache.set(name.toLowerCase(), url);
}

/* ── Strip special characters to produce a cleaner Deezer search query ── */
function cleanNameForSearch(name: string): string {
  return name
    .replace(/[$#@!]/g, "")          // remove common special chars ($HUPE → HUPE)
    .replace(/\s+/g, " ")
    .trim();
}

/* ── Try one Deezer search query, return best image URL or null ── */
async function deezerSearch(
  query: string,
  preferExact?: string
): Promise<string | null> {
  try {
    const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=5`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json() as {
      data?: Array<{ name: string; picture_xl?: string; picture_medium?: string }>;
    };
    const items = data.data ?? [];
    if (!items.length) return null;

    const needle = (preferExact ?? query).toLowerCase();
    const exact = items.find((a) => a.name.toLowerCase() === needle);
    const best = exact ?? items[0];

    const img = best.picture_xl || best.picture_medium || null;
    if (!img || img.includes("/artist//") || img.includes("/noimage/")) return null;
    return img;
  } catch {
    return null;
  }
}

/* ── Fetch one artist image from Deezer (free, no auth required) ── */
async function fetchDeezerImage(name: string): Promise<string | null> {
  // 1st attempt: exact display name
  const result = await deezerSearch(name, name);
  if (result) return result;

  // 2nd attempt: cleaned name (strips $, #, etc.)
  const cleaned = cleanNameForSearch(name);
  if (cleaned && cleaned.toLowerCase() !== name.toLowerCase()) {
    const result2 = await deezerSearch(cleaned, name);
    if (result2) return result2;
  }

  // 3rd attempt: first two words only (catches "Emmanuellcortess" → "Emmanuel", etc.)
  const words = cleaned.split(" ");
  if (words.length > 2) {
    const shortened = words.slice(0, 2).join(" ");
    const result3 = await deezerSearch(shortened, name);
    if (result3) return result3;
  }

  return null;
}

/* ── Fetch & cache one name (respects the miss TTL) ── */
async function resolveImage(name: string): Promise<string | null> {
  const key = name.toLowerCase();
  const cached = getCached(key);
  if (cached !== undefined) return cached;
  const url = await fetchDeezerImage(name);
  setCached(key, url);
  return url;
}

/* ── Seed in-memory cache from DB on startup ── */
async function seedCacheFromDb(): Promise<void> {
  try {
    const rows = await db.select().from(artistImages);
    for (const row of rows) {
      // Normalize key on read so lookups always match (all stored under lowercase).
      imageCache.set(row.artistKey.toLowerCase().trim(), row.imageUrl);
    }
    logger.info({ count: rows.length }, "[images] Seeded in-memory cache from DB");
  } catch (err) {
    logger.warn({ err }, "[images] DB seed failed — falling back to Deezer warm-up only");
  }
}

/* ── Warm the cache from the artist metadata sheet on startup ── */
const METADATA_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata";

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function warmCacheFromSheet(): Promise<void> {
  try {
    const resp = await fetch(METADATA_SHEET_URL);
    if (!resp.ok) return;
    const csv = await resp.text();
    const lines = csv.split("\n");
    if (!lines.length) return;
    const headers = parseCSVRow(lines[0]).map((h) => h.toLowerCase().trim());
    const nameIdx = headers.indexOf("artist_name");
    if (nameIdx < 0) return;
    const names: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVRow(lines[i]);
      const name = cols[nameIdx]?.trim();
      if (name) names.push(name);
    }
    // Fetch uncached artists in serial batches of 5 to avoid Deezer rate limits.
    // IMPORTANT: only store REAL image URLs — do NOT cache nulls here.
    // Rate-limited / transient failures during warm-up must not pollute missCache,
    // so the route handler can retry them fresh on the first actual user request.
    const uncached = names.filter((n) => getCached(n.toLowerCase()) === undefined);
    for (let i = 0; i < uncached.length; i += 5) {
      const batch = uncached.slice(i, i + 5);
      const results = await Promise.all(batch.map((n) => fetchDeezerImage(n)));
      for (let j = 0; j < batch.length; j++) {
        const url = results[j];
        if (url) {
          // setCached handles both in-memory and DB persistence
          setCached(batch[j], url);
        }
      }
      // Pause between batches to stay within Deezer's rate limit
      if (i + 5 < uncached.length) await new Promise((r) => setTimeout(r, 300));
    }
  } catch {
    // Non-fatal — on-demand fallback handles any artists not warmed
  }
}

// Seed from DB first (instant), then kick off background Deezer warm-up
seedCacheFromDb().then(() => {
  // 2 s delay gives the server time to bind before hitting external APIs
  setTimeout(() => void warmCacheFromSheet(), 2000);
}).catch(() => {
  setTimeout(() => void warmCacheFromSheet(), 2000);
});

/* ── Route: GET /api/spotify/artist-images?names=A,B,C ── */
router.get("/spotify/artist-images", async (req, res) => {
  const namesParam = req.query.names as string;
  if (!namesParam?.trim()) {
    res.status(400).json({ error: "names query parameter is required" });
    return;
  }

  const names = namesParam.split(",").map((n) => n.trim()).filter(Boolean);
  const results: Record<string, string | null> = {};
  const toFetch: string[] = [];

  for (const name of names) {
    const cached = getCached(name.toLowerCase());
    if (cached !== undefined) {
      results[name] = cached;
    } else {
      toFetch.push(name);
    }
  }

  // Resolve any uncached artists (or expired misses) in parallel batches
  for (let i = 0; i < toFetch.length; i += 10) {
    const batch = toFetch.slice(i, i + 10);
    const fetched = await Promise.all(
      batch.map(async (name) => ({ name, url: await resolveImage(name) }))
    );
    for (const { name, url } of fetched) {
      results[name] = url;
    }
  }

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.json(results);
});

export default router;
