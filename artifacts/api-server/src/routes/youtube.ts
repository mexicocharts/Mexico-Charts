import { Router } from "express";
import { db } from "@workspace/db";
import { youtubeChannels, youtubeVideos } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// YouTube Data API v3 — enrichment provider only
// Search is admin-only. Public endpoints only serve pre-saved IDs from DB.

const YT_BASE    = "https://www.googleapis.com/youtube/v3";
const API_KEY    = () => process.env["YOUTUBE_API_KEY"] ?? "";
const ADMIN_KEY  = () => process.env["YOUTUBE_ADMIN_KEY"] ?? "";

// TTLs
const VIDEO_TTL_MS   =  6 * 60 * 60 * 1000; //  6 hours
const CHANNEL_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const SEARCH_TTL_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days

// In-memory search cache (admin only, large TTL)
interface SearchCacheEntry { results: unknown[]; cachedAt: number }
const searchCache = new Map<string, SearchCacheEntry>();

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtCount(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

// Parse ISO 8601 duration (e.g. PT4M23S) to "4:23"
function fmtDuration(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  const mm = String(min).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function isAdminAuthed(req: { headers: Record<string, string | string[] | undefined>; query: Record<string, unknown> }): boolean {
  const key = ADMIN_KEY();
  if (!key) return false;
  const header = req.headers["x-admin-key"];
  const qkey   = req.query["adminKey"];
  return header === key || qkey === key;
}

async function ytFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({ ...params, key: API_KEY() });
  const url = `${YT_BASE}${path}?${qs.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ── Channel helpers ────────────────────────────────────────────────────────

interface YtChannel {
  id: string;
  snippet: {
    title: string;
    thumbnails: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
    customUrl?: string;
    publishedAt?: string;
  };
  statistics: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

async function fetchChannelFromYt(channelId: string): Promise<YtChannel | null> {
  const data = await ytFetch("/channels", {
    part: "snippet,statistics",
    id: channelId,
    maxResults: "1",
  }) as { items?: YtChannel[] };
  return data.items?.[0] ?? null;
}

function channelToRow(artistKey: string, ch: YtChannel) {
  const thumb =
    ch.snippet.thumbnails.high?.url ??
    ch.snippet.thumbnails.medium?.url ??
    ch.snippet.thumbnails.default?.url ??
    null;
  const subscriberCount = ch.statistics.hiddenSubscriberCount
    ? null
    : ch.statistics.subscriberCount != null
      ? parseInt(ch.statistics.subscriberCount, 10)
      : null;
  return {
    artistKey,
    channelId:       ch.id,
    title:           ch.snippet.title,
    thumbnailUrl:    thumb,
    subscriberCount,
    viewCount:       ch.statistics.viewCount       != null ? parseInt(ch.statistics.viewCount, 10)  : null,
    videoCount:      ch.statistics.videoCount      != null ? parseInt(ch.statistics.videoCount, 10) : null,
    customUrl:       ch.snippet.customUrl ?? null,
    publishedAt:     ch.snippet.publishedAt ? new Date(ch.snippet.publishedAt) : null,
    cachedAt:        new Date(),
  };
}

function channelDbToResponse(row: typeof youtubeChannels.$inferSelect) {
  return {
    channelId:       row.channelId,
    title:           row.title,
    thumbnailUrl:    row.thumbnailUrl,
    subscriberCount: row.subscriberCount,
    viewCount:       row.viewCount,
    videoCount:      row.videoCount,
    customUrl:       row.customUrl,
    publishedAt:     row.publishedAt?.toISOString() ?? null,
    cachedAt:        row.cachedAt.toISOString(),
    subscribersFmt:  fmtCount(row.subscriberCount),
    viewsFmt:        fmtCount(row.viewCount),
    channelUrl:      `https://www.youtube.com/channel/${row.channelId}`,
  };
}

// ── Video helpers ──────────────────────────────────────────────────────────

interface YtVideo {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    publishedAt?: string;
    thumbnails: { default?: { url: string }; medium?: { url: string }; maxres?: { url: string }; high?: { url: string } };
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails: {
    duration?: string;
  };
}

async function fetchVideoFromYt(videoId: string): Promise<YtVideo | null> {
  const data = await ytFetch("/videos", {
    part: "snippet,statistics,contentDetails",
    id: videoId,
    maxResults: "1",
  }) as { items?: YtVideo[] };
  return data.items?.[0] ?? null;
}

function videoToRow(videoId: string, songKey: string | null, v: YtVideo) {
  const thumb =
    v.snippet.thumbnails.maxres?.url ??
    v.snippet.thumbnails.high?.url ??
    v.snippet.thumbnails.medium?.url ??
    v.snippet.thumbnails.default?.url ??
    null;
  return {
    videoId,
    songKey,
    channelId:    v.snippet.channelId,
    title:        v.snippet.title,
    thumbnailUrl: thumb,
    viewCount:    v.statistics.viewCount    != null ? parseInt(v.statistics.viewCount, 10)    : null,
    likeCount:    v.statistics.likeCount    != null ? parseInt(v.statistics.likeCount, 10)    : null,
    commentCount: v.statistics.commentCount != null ? parseInt(v.statistics.commentCount, 10) : null,
    duration:     v.contentDetails.duration ?? null,
    publishedAt:  v.snippet.publishedAt ? new Date(v.snippet.publishedAt) : null,
    cachedAt:     new Date(),
  };
}

function videoDbToResponse(row: typeof youtubeVideos.$inferSelect) {
  return {
    videoId:      row.videoId,
    songKey:      row.songKey,
    channelId:    row.channelId,
    title:        row.title,
    thumbnailUrl: row.thumbnailUrl,
    viewCount:    row.viewCount,
    likeCount:    row.likeCount,
    commentCount: row.commentCount,
    duration:     row.duration,
    publishedAt:  row.publishedAt?.toISOString() ?? null,
    cachedAt:     row.cachedAt.toISOString(),
    videoUrl:     `https://www.youtube.com/watch?v=${row.videoId}`,
    viewsFmt:     fmtCount(row.viewCount),
    likesFmt:     fmtCount(row.likeCount),
    commentsFmt:  fmtCount(row.commentCount),
    durationFmt:  fmtDuration(row.duration),
  };
}

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════

// GET /api/providers/youtube/channel?artistKey=peso+pluma
// Returns saved channel data for an artist, refreshing stats if stale.
router.get("/providers/youtube/channel", async (req, res) => {
  const artistKey = (req.query["artistKey"] as string | undefined)?.trim().toLowerCase();
  if (!artistKey) { res.status(400).json({ error: "artistKey is required" }); return; }

  const [row] = await db.select().from(youtubeChannels).where(eq(youtubeChannels.artistKey, artistKey));
  if (!row) { res.status(404).json({ error: "No YouTube channel linked for this artist" }); return; }

  const stale = Date.now() - row.cachedAt.getTime() > CHANNEL_TTL_MS;
  if (!stale) {
    res.setHeader("X-Cache", "HIT");
    res.json(channelDbToResponse(row));
    return;
  }

  // Refresh stats from YouTube
  try {
    const ch = await fetchChannelFromYt(row.channelId);
    if (ch) {
      const updated = channelToRow(artistKey, ch);
      await db.update(youtubeChannels).set(updated).where(eq(youtubeChannels.artistKey, artistKey));
      const [fresh] = await db.select().from(youtubeChannels).where(eq(youtubeChannels.artistKey, artistKey));
      res.setHeader("X-Cache", "REFRESHED");
      res.json(channelDbToResponse(fresh!));
      logger.info({ artistKey, channelId: row.channelId }, "[youtube] channel stats refreshed");
      return;
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message, artistKey }, "[youtube] channel refresh failed, returning stale");
  }

  res.setHeader("X-Cache", "STALE");
  res.json(channelDbToResponse(row));
});

// GET /api/providers/youtube/video?videoId=abc123
// Returns saved video data, refreshing stats if stale.
router.get("/providers/youtube/video", async (req, res) => {
  const videoId = (req.query["videoId"] as string | undefined)?.trim();
  if (!videoId) { res.status(400).json({ error: "videoId is required" }); return; }

  const [row] = await db.select().from(youtubeVideos).where(eq(youtubeVideos.videoId, videoId));
  if (!row) { res.status(404).json({ error: "No YouTube video saved for this ID" }); return; }

  const stale = Date.now() - row.cachedAt.getTime() > VIDEO_TTL_MS;
  if (!stale) {
    res.setHeader("X-Cache", "HIT");
    res.json(videoDbToResponse(row));
    return;
  }

  try {
    const v = await fetchVideoFromYt(videoId);
    if (v) {
      const updated = videoToRow(videoId, row.songKey, v);
      await db.update(youtubeVideos).set(updated).where(eq(youtubeVideos.videoId, videoId));
      const [fresh] = await db.select().from(youtubeVideos).where(eq(youtubeVideos.videoId, videoId));
      res.setHeader("X-Cache", "REFRESHED");
      res.json(videoDbToResponse(fresh!));
      logger.info({ videoId }, "[youtube] video stats refreshed");
      return;
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message, videoId }, "[youtube] video refresh failed, returning stale");
  }

  res.setHeader("X-Cache", "STALE");
  res.json(videoDbToResponse(row));
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS — require X-Admin-Key header or ?adminKey= query param
// ══════════════════════════════════════════════════════════════════════════

function requireAdmin(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): boolean {
  if (!isAdminAuthed(req as Parameters<typeof isAdminAuthed>[0])) {
    res.status(403).json({ error: "Forbidden — provide X-Admin-Key header" });
    return false;
  }
  return true;
}

// GET /api/admin/youtube/search/channels?q=peso+pluma
router.get("/admin/youtube/search/channels", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const q = (req.query["q"] as string | undefined)?.trim();
  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  const cacheKey = `ch:${q.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < SEARCH_TTL_MS) {
    res.setHeader("X-Cache", "HIT");
    res.json({ results: cached.results });
    return;
  }

  try {
    const data = await ytFetch("/search", {
      part: "snippet",
      type: "channel",
      q,
      maxResults: "10",
      regionCode: "MX",
    }) as { items?: Array<{
      id: { channelId: string };
      snippet: { title: string; description: string; thumbnails: { default?: { url: string }; medium?: { url: string } } };
    }> };

    const results = (data.items ?? []).map(item => ({
      channelId:    item.id.channelId,
      title:        item.snippet.title,
      description:  item.snippet.description?.slice(0, 100) ?? "",
      thumbnailUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? null,
    }));

    searchCache.set(cacheKey, { results, cachedAt: Date.now() });
    res.json({ results });
    logger.info({ q, count: results.length }, "[youtube] channel search");
  } catch (err) {
    logger.error({ err: (err as Error).message, q }, "[youtube] channel search failed");
    res.status(502).json({ error: "YouTube API error" });
  }
});

// GET /api/admin/youtube/search/videos?q=peso+pluma+ella+baila+sola
router.get("/admin/youtube/search/videos", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const q = (req.query["q"] as string | undefined)?.trim();
  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  const cacheKey = `v:${q.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < SEARCH_TTL_MS) {
    res.setHeader("X-Cache", "HIT");
    res.json({ results: cached.results });
    return;
  }

  try {
    const data = await ytFetch("/search", {
      part: "snippet",
      type: "video",
      videoCategoryId: "10", // Music
      q,
      maxResults: "10",
      regionCode: "MX",
    }) as { items?: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails: { medium?: { url: string }; high?: { url: string } };
      };
    }> };

    const results = (data.items ?? []).map(item => ({
      videoId:      item.id.videoId,
      title:        item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      publishedAt:  item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails.high?.url ?? item.snippet.thumbnails.medium?.url ?? null,
    }));

    searchCache.set(cacheKey, { results, cachedAt: Date.now() });
    res.json({ results });
    logger.info({ q, count: results.length }, "[youtube] video search");
  } catch (err) {
    logger.error({ err: (err as Error).message, q }, "[youtube] video search failed");
    res.status(502).json({ error: "YouTube API error" });
  }
});

// POST /api/admin/youtube/link/channel
// Body: { artistKey: string, channelId: string }
router.post("/admin/youtube/link/channel", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { artistKey, channelId } = req.body as { artistKey?: string; channelId?: string };
  if (!artistKey?.trim() || !channelId?.trim()) {
    res.status(400).json({ error: "artistKey and channelId are required" });
    return;
  }
  const key = artistKey.trim().toLowerCase();
  const cid = channelId.trim();

  try {
    const ch = await fetchChannelFromYt(cid);
    if (!ch) { res.status(404).json({ error: "Channel not found on YouTube" }); return; }

    const row = { ...channelToRow(key, ch), linkedAt: new Date() };
    await db.insert(youtubeChannels).values(row).onConflictDoUpdate({
      target: youtubeChannels.artistKey,
      set: row,
    });

    const [saved] = await db.select().from(youtubeChannels).where(eq(youtubeChannels.artistKey, key));
    logger.info({ artistKey: key, channelId: cid, title: ch.snippet.title }, "[youtube] channel linked");
    res.json(channelDbToResponse(saved!));
  } catch (err) {
    logger.error({ err: (err as Error).message, artistKey: key, channelId: cid }, "[youtube] link channel failed");
    res.status(502).json({ error: (err as Error).message });
  }
});

// POST /api/admin/youtube/link/video
// Body: { videoId: string, songKey?: string }
router.post("/admin/youtube/link/video", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { videoId, songKey } = req.body as { videoId?: string; songKey?: string };
  if (!videoId?.trim()) { res.status(400).json({ error: "videoId is required" }); return; }
  const vid = videoId.trim();
  const skey = songKey?.trim() ?? null;

  try {
    const v = await fetchVideoFromYt(vid);
    if (!v) { res.status(404).json({ error: "Video not found on YouTube" }); return; }

    const row = { ...videoToRow(vid, skey, v), linkedAt: new Date() };
    await db.insert(youtubeVideos).values(row).onConflictDoUpdate({
      target: youtubeVideos.videoId,
      set: row,
    });

    const [saved] = await db.select().from(youtubeVideos).where(eq(youtubeVideos.videoId, vid));
    logger.info({ videoId: vid, songKey: skey, title: v.snippet.title }, "[youtube] video linked");
    res.json(videoDbToResponse(saved!));
  } catch (err) {
    logger.error({ err: (err as Error).message, videoId: vid }, "[youtube] link video failed");
    res.status(502).json({ error: (err as Error).message });
  }
});

// GET /api/admin/youtube/channels — list all linked channels
router.get("/admin/youtube/channels", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.select().from(youtubeChannels).orderBy(youtubeChannels.linkedAt);
  res.json({ channels: rows.map(channelDbToResponse) });
});

// GET /api/admin/youtube/videos — list all linked videos
router.get("/admin/youtube/videos", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.select().from(youtubeVideos).orderBy(youtubeVideos.linkedAt);
  res.json({ videos: rows.map(videoDbToResponse) });
});

// DELETE /api/admin/youtube/link/channel/:artistKey
router.delete("/admin/youtube/link/channel/:artistKey", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const key = req.params["artistKey"]?.toLowerCase();
  if (!key) { res.status(400).json({ error: "artistKey is required" }); return; }
  await db.delete(youtubeChannels).where(eq(youtubeChannels.artistKey, key));
  logger.info({ artistKey: key }, "[youtube] channel unlinked");
  res.json({ ok: true });
});

// DELETE /api/admin/youtube/link/video/:videoId
router.delete("/admin/youtube/link/video/:videoId", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const vid = req.params["videoId"];
  if (!vid) { res.status(400).json({ error: "videoId is required" }); return; }
  await db.delete(youtubeVideos).where(eq(youtubeVideos.videoId, vid));
  logger.info({ videoId: vid }, "[youtube] video unlinked");
  res.json({ ok: true });
});

export default router;
