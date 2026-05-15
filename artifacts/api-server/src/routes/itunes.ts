import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const router = Router();

// iTunes Search / Lookup — metadata provider only (NOT chart data)
// Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/

const ITUNES_SEARCH_BASE = "https://itunes.apple.com/search";
const ITUNES_LOOKUP_BASE  = "https://itunes.apple.com/lookup";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT     = 200;

// search results: cached 7 days; lookup results: cached 30 days
const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOOKUP_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Rate-limit: max 20 outbound requests per 60 s window
const RL_WINDOW_MS   = 60_000;
const RL_MAX_PER_WIN = 20;

// Admin secret — must match ITUNES_ADMIN_KEY env var for mutating endpoints
const ADMIN_KEY = () => process.env["ITUNES_ADMIN_KEY"] ?? "";

interface CacheEntry {
  results: NormalizedItem[];
  cachedAt: number;
  ttl: number;
}

const cache       = new Map<string, CacheEntry>();
const rlTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  while (rlTimestamps.length && rlTimestamps[0]! < now - RL_WINDOW_MS) rlTimestamps.shift();
  return rlTimestamps.length >= RL_MAX_PER_WIN;
}
function recordRequest(): void {
  rlTimestamps.push(Date.now());
}

interface DebugEntry {
  kind: "search" | "lookup";
  cacheKey: string;
  cacheHit: boolean;
  rateLimited: boolean;
  resultCount: number;
  error: string | null;
  requestedAt: string;
}
const debugLog: DebugEntry[] = [];
function logDebug(entry: DebugEntry): void {
  debugLog.unshift(entry);
  if (debugLog.length > 20) debugLog.pop();
}

interface RawItunesItem {
  wrapperType?: string;
  kind?: string;
  artistId?: number;
  collectionId?: number;
  trackId?: number;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  artistLinkUrl?: string;
  artistViewUrl?: string;
  collectionViewUrl?: string;
  trackViewUrl?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  country?: string;
  [key: string]: unknown;
}

interface NormalizedItem {
  provider: "itunes";
  type: "artist" | "track" | "album" | "music_video";
  appleId: string | null;
  title: string | null;
  artistName: string | null;
  albumName: string | null;
  artworkUrl: string | null;
  artworkUrlHd: string | null;
  appleUrl: string | null;
  previewUrl: string | null;
  releaseDate: string | null;
  primaryGenreName: string | null;
  country: string;
  fetchedAt: string;
}

function resolveType(item: RawItunesItem): NormalizedItem["type"] {
  const wt   = item.wrapperType ?? "";
  const kind = item.kind ?? "";
  if (wt === "artist")     return "artist";
  if (wt === "collection") return "album";
  if (kind === "music-video") return "music_video";
  return "track";
}

function hdArtwork(url: string | undefined | null): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\./, "/600x600bb.");
}

function normalize(item: RawItunesItem, fetchedAt: string): NormalizedItem {
  const type = resolveType(item);
  let appleId: string | null = null;
  let title: string | null   = null;
  let appleUrl: string | null = null;
  let albumName: string | null = null;

  if (type === "artist") {
    appleId  = item.artistId    != null ? String(item.artistId)    : null;
    title    = item.artistName  ?? null;
    appleUrl = item.artistLinkUrl ?? item.artistViewUrl ?? null;
  } else if (type === "album") {
    appleId   = item.collectionId != null ? String(item.collectionId) : null;
    title     = item.collectionName ?? null;
    appleUrl  = item.collectionViewUrl ?? null;
    albumName = item.collectionName ?? null;
  } else {
    appleId   = item.trackId    != null ? String(item.trackId)    : null;
    title     = item.trackName  ?? null;
    appleUrl  = item.trackViewUrl ?? null;
    albumName = item.collectionName ?? null;
  }

  const rawArtwork = item.artworkUrl100 as string | undefined;
  return {
    provider:         "itunes",
    type,
    appleId,
    title,
    artistName:       item.artistName ?? null,
    albumName,
    artworkUrl:       rawArtwork ?? null,
    artworkUrlHd:     hdArtwork(rawArtwork),
    appleUrl,
    previewUrl:       (item.previewUrl    as string | undefined) ?? null,
    releaseDate:      (item.releaseDate   as string | undefined) ?? null,
    primaryGenreName: item.primaryGenreName ?? null,
    country:          (item.country as string | undefined) ?? "MX",
    fetchedAt,
  };
}

async function fetchItunes(url: string): Promise<{ results: NormalizedItem[]; error: string | null }> {
  const fetchedAt = new Date().toISOString();
  try {
    recordRequest();
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MexicoCharts/1.0; +https://mexicochart.com)",
        "Accept":     "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return { results: [], error: `iTunes returned HTTP ${resp.status}` };
    const data = await resp.json() as { resultCount: number; results: RawItunesItem[] };
    return { results: (data.results ?? []).map(item => normalize(item, fetchedAt)), error: null };
  } catch (err: unknown) {
    return { results: [], error: err instanceof Error ? err.message : String(err) };
  }
}

// Shared cache-hit helper to avoid repetition
function serveCacheHit(res: Parameters<Parameters<typeof router.get>[1]>[1], entry: CacheEntry, cachedAt: number): void {
  res.setHeader("X-Cache", "HIT");
  res.setHeader("X-Cache-Age", String(Math.round((Date.now() - cachedAt) / 1000)));
  res.json({ provider: "itunes", resultCount: entry.results.length, results: entry.results });
}

// GET /api/providers/itunes/search
router.get("/providers/itunes/search", async (req, res) => {
  const term = (req.query.term as string | undefined)?.trim();
  if (!term) { res.status(400).json({ error: "term is required" }); return; }

  const country  = (req.query.country  as string | undefined) || "mx";
  const media    = (req.query.media    as string | undefined) || "music";
  const entity   = (req.query.entity   as string | undefined) || undefined;
  const explicit = (req.query.explicit as string | undefined) || "Yes";
  const lang     = (req.query.lang     as string | undefined) || "en_us";
  const rawLimit = parseInt(req.query.limit as string, 10);
  const limit    = isNaN(rawLimit) ? DEFAULT_LIMIT : Math.min(MAX_LIMIT, Math.max(1, rawLimit));

  const cacheKey = [term, country, media, entity ?? "", explicit, lang, limit].join("|");
  const entry    = cache.get(cacheKey);

  if (entry && Date.now() - entry.cachedAt < entry.ttl) {
    logDebug({ kind: "search", cacheKey, cacheHit: true, rateLimited: false, resultCount: entry.results.length, error: null, requestedAt: new Date().toISOString() });
    serveCacheHit(res, entry, entry.cachedAt);
    return;
  }

  if (isRateLimited()) {
    const stale = cache.get(cacheKey);
    logDebug({ kind: "search", cacheKey, cacheHit: false, rateLimited: true, resultCount: stale?.results.length ?? 0, error: "rate-limited", requestedAt: new Date().toISOString() });
    if (stale) { res.setHeader("X-Cache", "STALE"); res.json({ provider: "itunes", resultCount: stale.results.length, results: stale.results }); return; }
    res.status(429).json({ error: "rate limit exceeded, no cached data available" });
    return;
  }

  const params = new URLSearchParams({ term, country, media, explicit, lang, limit: String(limit) });
  if (entity) params.set("entity", entity);
  const url = `${ITUNES_SEARCH_BASE}?${params.toString()}`;

  logger.info({ term, entity, limit }, "[itunes] search");
  const { results, error } = await fetchItunes(url);
  logDebug({ kind: "search", cacheKey, cacheHit: false, rateLimited: false, resultCount: results.length, error, requestedAt: new Date().toISOString() });

  if (error && results.length === 0) {
    logger.warn({ err: error }, "[itunes] search failed");
    const stale = cache.get(cacheKey);
    if (stale) { res.setHeader("X-Cache", "STALE"); res.json({ provider: "itunes", resultCount: stale.results.length, results: stale.results }); return; }
    res.status(502).json({ provider: "itunes", error, results: [] });
    return;
  }

  cache.set(cacheKey, { results, cachedAt: Date.now(), ttl: SEARCH_TTL_MS });
  res.setHeader("X-Cache", "MISS");
  res.json({ provider: "itunes", resultCount: results.length, results });
});

// GET /api/providers/itunes/lookup
router.get("/providers/itunes/lookup", async (req, res) => {
  const id     = (req.query.id     as string | undefined)?.trim();
  const upc    = (req.query.upc    as string | undefined)?.trim();
  const entity = (req.query.entity as string | undefined)?.trim();

  if (!id && !upc) { res.status(400).json({ error: "id or upc is required" }); return; }

  const cacheKey = `lookup|${id ?? ""}|${upc ?? ""}|${entity ?? ""}`;
  const entry    = cache.get(cacheKey);

  if (entry && Date.now() - entry.cachedAt < entry.ttl) {
    logDebug({ kind: "lookup", cacheKey, cacheHit: true, rateLimited: false, resultCount: entry.results.length, error: null, requestedAt: new Date().toISOString() });
    serveCacheHit(res, entry, entry.cachedAt);
    return;
  }

  if (isRateLimited()) {
    const stale = cache.get(cacheKey);
    logDebug({ kind: "lookup", cacheKey, cacheHit: false, rateLimited: true, resultCount: stale?.results.length ?? 0, error: "rate-limited", requestedAt: new Date().toISOString() });
    if (stale) { res.setHeader("X-Cache", "STALE"); res.json({ provider: "itunes", resultCount: stale.results.length, results: stale.results }); return; }
    res.status(429).json({ error: "rate limit exceeded, no cached data available" });
    return;
  }

  const params = new URLSearchParams();
  if (id)     params.set("id",  id);
  if (upc)    params.set("upc", upc);
  if (entity) params.set("entity", entity);
  const url = `${ITUNES_LOOKUP_BASE}?${params.toString()}`;

  logger.info({ id, upc, entity }, "[itunes] lookup");
  const { results, error } = await fetchItunes(url);
  logDebug({ kind: "lookup", cacheKey, cacheHit: false, rateLimited: false, resultCount: results.length, error, requestedAt: new Date().toISOString() });

  if (error && results.length === 0) {
    logger.warn({ err: error }, "[itunes] lookup failed");
    const stale = cache.get(cacheKey);
    if (stale) { res.setHeader("X-Cache", "STALE"); res.json({ provider: "itunes", resultCount: stale.results.length, results: stale.results }); return; }
    res.status(502).json({ provider: "itunes", error, results: [] });
    return;
  }

  cache.set(cacheKey, { results, cachedAt: Date.now(), ttl: LOOKUP_TTL_MS });
  res.setHeader("X-Cache", "MISS");
  res.json({ provider: "itunes", resultCount: results.length, results });
});

// Middleware: require ITUNES_ADMIN_KEY header for admin routes
function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const key = ADMIN_KEY();
  if (!key) { res.status(503).json({ error: "admin access not configured" }); return; }
  if (req.headers["x-admin-key"] !== key) { res.status(401).json({ error: "unauthorized" }); return; }
  next();
}

// GET /api/providers/itunes/admin/debug
router.get("/providers/itunes/admin/debug", requireAdminKey, (_req, res) => {
  const now = Date.now();
  const windowStart = now - RL_WINDOW_MS;
  const recentRequests = rlTimestamps.filter(t => t >= windowStart).length;

  const entries = Array.from(cache.entries()).map(([key, e]) => {
    const ageMs = now - e.cachedAt;
    return {
      key,
      resultCount:   e.results.length,
      cachedAt:      new Date(e.cachedAt).toISOString(),
      ageSecs:       Math.round(ageMs / 1000),
      ttlSecs:       Math.round(e.ttl / 1000),
      expiresInSecs: Math.round((e.ttl - ageMs) / 1000),
      expired:       ageMs > e.ttl,
    };
  });

  res.json({
    provider:         "itunes",
    cacheEntries:     entries.length,
    rateLimitWindow:  `${RL_WINDOW_MS / 1000}s`,
    rateLimitMax:     RL_MAX_PER_WIN,
    requestsInWindow: recentRequests,
    isRateLimited:    recentRequests >= RL_MAX_PER_WIN,
    recentLog:        debugLog,
    cache:            entries,
  });
});

// POST /api/providers/itunes/admin/cache/clear
router.post("/providers/itunes/admin/cache/clear", requireAdminKey, (_req, res) => {
  const count = cache.size;
  cache.clear();
  debugLog.length = 0;
  logger.info({ count }, "[itunes] cache cleared");
  res.json({ cleared: count });
});

export default router;
