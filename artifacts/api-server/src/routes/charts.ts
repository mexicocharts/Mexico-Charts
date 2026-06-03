import { Router } from "express";

const router = Router();

/* ── Cover cache (in-memory, survives requests) ──────────────────────────── */
const coverCache = new Map<string, string | null>();
let enrichmentRunning = false;

/* ── Album art via Deezer (free, no auth) ────────────────────────────────── */
function cleanCoverQuery(value: string): string {
  return value
    .replace(/\([^)]*(?:remix|version|visualizer|video|audio|official|deluxe)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(?:remix|version|visualizer|video|audio|official|deluxe)[^\]]*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchScore(expectedArtist: string, expectedTitle: string, foundArtist: string, foundTitle: string): number {
  const artist = normalizeForMatch(expectedArtist);
  const title = normalizeForMatch(cleanCoverQuery(expectedTitle));
  const foundArtistNorm = normalizeForMatch(foundArtist);
  const foundTitleNorm = normalizeForMatch(cleanCoverQuery(foundTitle));

  let score = 0;
  if (foundArtistNorm === artist) score += 55;
  else if (foundArtistNorm.includes(artist) || artist.includes(foundArtistNorm)) score += 34;
  else {
    const artistTokens = artist.split(" ").filter(Boolean);
    const matchedTokens = artistTokens.filter(token => foundArtistNorm.includes(token));
    score += Math.min(24, matchedTokens.length * 8);
  }

  if (foundTitleNorm === title) score += 55;
  else if (foundTitleNorm.includes(title) || title.includes(foundTitleNorm)) score += 36;
  else {
    const titleTokens = title.split(" ").filter(token => token.length > 2);
    const matchedTokens = titleTokens.filter(token => foundTitleNorm.includes(token));
    score += Math.min(30, matchedTokens.length * 10);
  }

  return score;
}

async function fetchCoverViaDeezer(artist: string, title: string): Promise<string | null> {
  const queries = [
    `${artist} ${title}`,
    `${artist} ${cleanCoverQuery(title)}`,
    `${cleanCoverQuery(title)} ${artist}`,
  ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i);

  try {
    for (const query of queries) {
      const q = encodeURIComponent(query);
      const resp = await fetch(`https://api.deezer.com/search/track?q=${q}&limit=5`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!resp.ok) continue;
      const data = await resp.json() as {
        data?: Array<{
          title?: string;
          artist?: { name?: string };
          album: { cover?: string; cover_medium?: string; cover_big?: string; cover_xl?: string };
        }>;
      };
      const candidates = (data.data ?? [])
        .map(item => {
          const url = item.album.cover_xl || item.album.cover_big || item.album.cover_medium || item.album.cover;
          return {
            item,
            url,
            score: matchScore(artist, title, item.artist?.name ?? "", item.title ?? ""),
          };
        })
        .filter(candidate => candidate.url && !candidate.url.includes("/noimage/"))
        .sort((a, b) => b.score - a.score);
      const hit = candidates.find(candidate => candidate.score >= 45);
      const url = hit?.url;
      if (url) return url;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAlbumCoverViaItunes(artist: string, album: string): Promise<string | null> {
  const term = `${artist} ${album}`.trim();
  if (!term) return null;
  try {
    const url = `https://itunes.apple.com/search?country=mx&media=music&entity=album&limit=8&term=${encodeURIComponent(term)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;
    const data = await resp.json() as {
      results?: Array<{
        artistName?: string;
        collectionName?: string;
        artworkUrl100?: string;
      }>;
    };
    const candidates = (data.results ?? [])
      .map(item => ({
        item,
        score: matchScore(artist, album, item.artistName ?? "", item.collectionName ?? ""),
      }))
      .filter(candidate => candidate.item.artworkUrl100)
      .sort((a, b) => b.score - a.score);
    const hit = candidates.find(candidate => candidate.score >= 50);
    return hit?.item.artworkUrl100?.replace(/100x100bb\./, "1200x1200bb.") ?? null;
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
    const todo = entries.filter(e => !coverCache.has(e.trackId) || coverCache.get(e.trackId) === null);
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

async function enrichCoversForExport(
  entries: Omit<ChartEntry, "coverUrl">[],
  limit = 10
): Promise<void> {
  const todo = entries.slice(0, limit).filter(e => !coverCache.has(e.trackId) || coverCache.get(e.trackId) === null);
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    await Promise.all(
      batch.map(async e => {
        if (coverCache.has(e.trackId)) return;
        const url = await fetchCoverViaDeezer(e.artist, e.title);
        coverCache.set(e.trackId, url);
      })
    );
    if (i + 4 < todo.length) await new Promise(r => setTimeout(r, 300));
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
  const withCovers = req.query["withCovers"] === "1" || req.query["social"] === "1";
  try {
    // 1. Get chart data fast (kworb only — no Deezer wait)
    const raw = await fetchRawChart(period);

    // Social exports need the image URLs in the first response, otherwise the
    // PNG captures placeholders before the background cover job finishes.
    if (withCovers) {
      await enrichCoversForExport(raw, 10);
    }

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

router.post("/charts/social-artwork", async (req, res) => {
  const body = req.body as {
    type?: "track" | "album";
    items?: Array<{ id?: string; title?: string; artist?: string }>;
  };
  const type = body.type === "album" ? "album" : "track";
  const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];

  try {
    const results: Record<string, string | null> = {};
    for (let i = 0; i < items.length; i += 4) {
      const batch = items.slice(i, i + 4);
      const found = await Promise.all(batch.map(async item => {
        const id = item.id || `${item.artist ?? ""}::${item.title ?? ""}`;
        const artist = item.artist?.trim() ?? "";
        const title = item.title?.trim() ?? "";
        if (!artist || !title) return { id, url: null };
        const url = type === "album"
          ? await fetchAlbumCoverViaItunes(artist, title)
          : await fetchCoverViaDeezer(artist, title);
        return { id, url };
      }));
      for (const item of found) results[item.id] = item.url;
      if (i + 4 < items.length) await new Promise(r => setTimeout(r, 250));
    }

    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.json({ type, results });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch social artwork", detail: String(err) });
  }
});

export default router;
