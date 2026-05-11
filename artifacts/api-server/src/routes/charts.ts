import { Router } from "express";

const router = Router();

/* ── Cover cache (in-memory, survives requests) ──────────────────────────── */
const coverCache = new Map<string, string | null>();
let enrichmentRunning = false;

/* ── Album art via Deezer (free, no auth) ────────────────────────────────── */
async function fetchCoverViaDeezer(artist: string, title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${artist} ${title}`);
    const resp = await fetch(`https://api.deezer.com/search/track?q=${q}&limit=3`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as {
      data?: Array<{ album: { cover_medium: string; cover_xl: string } }>;
    };
    if (!data.data?.length) return null;
    const hit = data.data[0];
    const url = hit.album.cover_xl || hit.album.cover_medium;
    if (!url || url.includes("/noimage/")) return null;
    return url;
  } catch {
    return null;
  }
}

/* ── Enrich entries that don't yet have a cover (background job) ─────────── */
async function enrichCovers(
  entries: Omit<ChartEntry, "coverUrl">[]
): Promise<void> {
  if (enrichmentRunning) return;
  enrichmentRunning = true;
  try {
    const todo = entries.filter(e => !coverCache.has(e.trackId));
    for (let i = 0; i < todo.length; i += 4) {
      const batch = todo.slice(i, i + 4);
      await Promise.all(
        batch.map(async e => {
          if (coverCache.has(e.trackId)) return;
          const url = await fetchCoverViaDeezer(e.artist, e.title);
          coverCache.set(e.trackId, url);
        })
      );
      // Rate-limit: 300ms between batches
      if (i + 4 < todo.length) await new Promise(r => setTimeout(r, 300));
    }
  } finally {
    enrichmentRunning = false;
  }
}

/* ── Chart entry type ────────────────────────────────────────────────────── */
interface ChartEntry {
  pos: number;
  posChange: string;
  artist: string;
  title: string;
  features: string[];
  trackId: string;
  artistId: string;
  streams: string;
  totalStreams: string;
  coverUrl: string | null;
}

/* ── Parsed (un-enriched) chart cache ────────────────────────────────────── */
const CHART_TTL = 60 * 60 * 1000; // 1 hour
interface RawSlot { data: Omit<ChartEntry, "coverUrl">[]; fetchedAt: number }
const rawCache = new Map<string, RawSlot>();

/* ── Parse kworb HTML ───────────────────────────────────────────────────── */
function parseKworbChart(html: string): Omit<ChartEntry, "coverUrl">[] {
  const entries: Omit<ChartEntry, "coverUrl">[] = [];
  const rowRe = /<tr><td class="np">(\d+)<\/td>\s*<td class="np">([^<]*)<\/td>\s*<td class="text mp"><div>([\s\S]*?)<\/div><\/td>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const pos = parseInt(m[1]);
    const posChange = m[2].trim() || "=";
    const cellHtml = m[3];
    const restHtml = m[4];

    const artistM = cellHtml.match(/href="\.\.\/artist\/([A-Za-z0-9]+)\.html">([^<]+)<\/a>/);
    const trackM  = cellHtml.match(/href="\.\.\/track\/([A-Za-z0-9]+)\.html">([^<]+)<\/a>/);
    if (!artistM || !trackM) continue;

    const artistId = artistM[1];
    const artist   = artistM[2];
    const trackId  = trackM[1];
    const title    = trackM[2];

    const allArtists = [...cellHtml.matchAll(/href="\.\.\/artist\/[A-Za-z0-9]+\.html">([^<]+)<\/a>/g)];
    const features = allArtists.slice(1).map(a => a[1]);

    const tds = [...restHtml.matchAll(/<td[^>]*>([^<]*)<\/td>/g)];
    const streams     = tds[3]?.[1]?.trim() || "—";
    const totalStreams = tds[7]?.[1]?.trim() || "—";

    entries.push({ pos, posChange, artist, title, features, trackId, artistId, streams, totalStreams });
  }
  return entries;
}

/* ── Fetch kworb (fast, no Deezer wait) ──────────────────────────────────── */
async function fetchRawChart(period: "daily" | "weekly"): Promise<Omit<ChartEntry, "coverUrl">[]> {
  const cached = rawCache.get(period);
  if (cached && Date.now() - cached.fetchedAt < CHART_TTL) return cached.data;

  const url = `https://kworb.net/spotify/country/mx_${period}.html`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`kworb ${period}: HTTP ${resp.status}`);
  const html = await resp.text();
  const data = parseKworbChart(html);
  rawCache.set(period, { data, fetchedAt: Date.now() });
  return data;
}

/* ── Route: GET /api/charts/mx-spotify?period=daily|weekly ──────────────── */
router.get("/charts/mx-spotify", async (req, res) => {
  const period = req.query["period"] === "weekly" ? "weekly" : "daily";
  try {
    // 1. Get chart data fast (kworb only — no Deezer wait)
    const raw = await fetchRawChart(period);

    // 2. Build response: attach whatever covers we already have cached
    const entries: ChartEntry[] = raw.map(e => ({
      ...e,
      coverUrl: coverCache.has(e.trackId) ? coverCache.get(e.trackId)! : null,
    }));

    // 3. Fire-and-forget: enrich covers in background for next request
    void enrichCovers(raw);

    const cached = rawCache.get(period)!;
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.json({ period, fetchedAt: new Date(cached.fetchedAt).toISOString(), entries });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch chart data", detail: String(err) });
  }
});

export default router;
