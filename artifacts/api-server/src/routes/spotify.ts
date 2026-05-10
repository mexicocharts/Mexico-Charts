import { Router } from "express";

const router = Router();

/* ── In-memory image cache (lives for the process lifetime) ── */
const imageCache = new Map<string, string | null>();

/* ── Seed with known-good Spotify CDN URLs for the biggest names ── */
const SEED: Record<string, string> = {
  "Peso Pluma":         "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5ebe5283f5b671cf618b82a2696",
  "Fuerza Regida":      "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5ebce436c411ab2436c7ab2c04d",
  "Natanael Cano":      "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5eb0d4838ef7ef6c0f889266f60",
  "Junior H":           "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5eb5fbe9b7dc7d9a2295bd6022c",
  "Carin León":         "https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb69543997b9f68a0d2bb37a4a",
  "Grupo Frontera":     "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5ebb8bb50dc787d5893156689f6",
  "Luis R Conriquez":   "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5eb616b1d17ef24f784e60d99af",
  "Xavi":               "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5ebd024eb5ee433a89b19d54c2a",
  "Eslabon Armado":     "https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebefb9255bbd0acdcd6a32accb",
  "Gabito Ballesteros": "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5eba9e1da6d545e2f5b05878d31",
  "Tito Double P":      "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5eb6aaf8a0d393605e8489447f3",
  "Oscar Maydon":       "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5eb3dd468a8fb2641286c5b02a6",
  "Clave Especial":     "https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebc8f9f4334a8583d976aeff0d",
  "Jasiel Nuñez":       "https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb0476bece9f63717f55c976f1",
  "Yng Lvcas":          "https://image-cdn-fa.spotifycdn.com/image/ab6761610000e5eb442355e50167bc26afa179ac",
  "Santa Fe Klan":      "https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5ebcc8e116e76c85e1880d9889f",
  "Marca MP":           "https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb31b1b084ec2994040aec37d0",
  "Grupo Firme":        "https://image-cdn-ak.spotifycdn.com/image/ab6761610000e5eb7ab0eb0c8b52f4639b167363",
};
for (const [name, url] of Object.entries(SEED)) {
  imageCache.set(name.toLowerCase(), url);
}

/* ── Fetch one artist image from Deezer (free, no auth required) ── */
async function fetchDeezerImage(name: string): Promise<string | null> {
  try {
    const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json() as {
      data?: Array<{ name: string; picture_xl?: string; picture_medium?: string }>;
    };
    const items = data.data ?? [];
    if (!items.length) return null;

    // Prefer exact match (case-insensitive), fall back to first result
    const nameLower = name.toLowerCase();
    const exact = items.find((a) => a.name.toLowerCase() === nameLower);
    const best = exact ?? items[0];

    const img = best.picture_xl || best.picture_medium || null;
    // Reject Deezer's generic grey placeholder
    if (!img || img.includes("250x250-000000") || img.includes("/noimage/")) return null;
    return img;
  } catch {
    return null;
  }
}

/* ── Warm the cache for a list of names (runs at startup, silently) ── */
async function warmCache(names: string[]): Promise<void> {
  const toFetch = names.filter((n) => !imageCache.has(n.toLowerCase()));
  for (let i = 0; i < toFetch.length; i += 10) {
    const batch = toFetch.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (name) => ({ name, url: await fetchDeezerImage(name) }))
    );
    for (const { name, url } of results) {
      imageCache.set(name.toLowerCase(), url);
    }
  }
}

/* ── Fetch all artist names from the metadata sheet and pre-warm ── */
const METADATA_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata";

async function warmCacheFromSheet(): Promise<void> {
  try {
    const resp = await fetch(METADATA_SHEET_URL);
    if (!resp.ok) return;
    const csv = await resp.text();
    // Parse CSV header line then extract artist_name column
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
    await warmCache(names);
  } catch {
    // Non-fatal — fall back to on-demand fetching
  }
}

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

// Kick off cache warming in background — does not block server startup
void warmCacheFromSheet();

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
    const key = name.toLowerCase();
    if (imageCache.has(key)) {
      results[name] = imageCache.get(key)!;
    } else {
      toFetch.push(name);
    }
  }

  // Fetch any still-uncached artists (safety net for artists added after startup)
  for (let i = 0; i < toFetch.length; i += 10) {
    const batch = toFetch.slice(i, i + 10);
    const fetched = await Promise.all(
      batch.map(async (name) => ({ name, url: await fetchDeezerImage(name) }))
    );
    for (const { name, url } of fetched) {
      imageCache.set(name.toLowerCase(), url);
      results[name] = url;
    }
  }

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.json(results);
});

export default router;
