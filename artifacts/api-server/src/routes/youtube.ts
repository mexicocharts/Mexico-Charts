import { Router } from "express";
import { db, pool, publicReadPool } from "@workspace/db";
import { youtubeChannelDailySnapshots, youtubeChannels, youtubeVideos } from "@workspace/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { runDailyYoutubeChannelSnapshots } from "../lib/youtube-channel-snapshot-scheduler";
import { discoverYoutubeMusicArtist, ensureYoutubeShadowTables } from "../lib/youtube-music-shadow-discovery";
import {
  ensureYoutubeIntradayShadowTables,
  runYoutubeIntradayShadow,
  youtubeIntradayShadowAutomationEnabled,
  YOUTUBE_SHADOW_PILOT_ARTISTS,
} from "../lib/youtube-intraday-shadow-scheduler";
import { ensureYoutubeVideoTrackerTables } from "../lib/youtube-video-tracker-scheduler";
import { getDashboardAdminKey } from "../lib/admin-key";
import { reserveYoutubeApiUsage, youtubeApiDailyUsage } from "../lib/youtube-api-budget";
import { dedupeYoutubeMonitorRows } from "../lib/youtube-monitor-dedupe";

const router = Router();

// YouTube Data API v3 — enrichment provider only
// Search is admin-only. Public endpoints only serve pre-saved IDs from DB.

const YT_BASE    = "https://www.googleapis.com/youtube/v3";
const API_KEY    = () => process.env["YOUTUBE_API_KEY"] ?? "";
const ADMIN_KEY  = getDashboardAdminKey;

// TTLs
const VIDEO_TTL_MS   =  6 * 60 * 60 * 1000; //  6 hours
const CHANNEL_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const SEARCH_TTL_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days

// In-memory search cache (admin only, large TTL)
interface SearchCacheEntry { results: unknown[]; cachedAt: number }
const searchCache = new Map<string, SearchCacheEntry>();

interface ArtistMetadataRow {
  artist_key: string;
  artist_name: string;
  youtube_subscribers?: string;
  youtube_views?: string;
}

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

async function fetchArtistMetadataRows(): Promise<ArtistMetadataRow[]> {
  const PORT = process.env["PORT"] ?? "8080";
  const metaRes = await fetch(`http://localhost:${PORT}/api/artists/metadata`);
  if (!metaRes.ok) throw new Error(`metadata fetch failed: ${metaRes.status}`);
  const metaJson = await metaRes.json() as { artists?: ArtistMetadataRow[] };
  return metaJson.artists ?? [];
}

async function ytFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams({ ...params, key: API_KEY() });
  const url = `${YT_BASE}${path}?${qs.toString()}`;
  const quotaClient = await pool.connect();
  try {
    const resource = path.replace(/^\//, "");
    await reserveYoutubeApiUsage(quotaClient, {
      consumer: "admin_youtube",
      method: `${resource}.list`,
    });
  } finally {
    quotaClient.release();
  }
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

type YoutubeChannelHistoryPoint = {
  date: string;
  views: number | null;
  subscribers: number | null;
  videos: number | null;
  dailyViews: number | null;
};

function sumRecent(values: Array<number | null>, days: number): number | null {
  const recent = values.slice(-days).filter((value): value is number => value != null);
  if (!recent.length) return null;
  return recent.reduce((total, value) => total + value, 0);
}

function avgRecent(values: Array<number | null>, days: number): number | null {
  const recent = values.slice(-days).filter((value): value is number => value != null);
  if (!recent.length) return null;
  return Math.round(recent.reduce((total, value) => total + value, 0) / recent.length);
}

function changeBetween(history: YoutubeChannelHistoryPoint[], field: "views" | "subscribers", days: number): number | null {
  if (history.length < 2) return null;
  const latest = history.at(-1)?.[field];
  if (latest == null) return null;
  const baselineIndex = Math.max(0, history.length - 1 - days);
  const baseline = history[baselineIndex]?.[field];
  return baseline == null ? null : latest - baseline;
}

function percentChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function momentumFromAverages(avg7: number | null, avg30: number | null): "rising" | "steady" | "cooling" | "new" | null {
  if (avg7 == null) return null;
  if (avg30 == null) return "new";
  const pct = percentChange(avg7, avg30);
  if (pct == null) return "steady";
  if (pct >= 12) return "rising";
  if (pct <= -12) return "cooling";
  return "steady";
}

function deriveChannelMetrics(history: YoutubeChannelHistoryPoint[]) {
  const dailyViews = history.map(point => point.dailyViews);
  const subscriberCounts = history.map(point => point.subscribers);
  const avg7 = avgRecent(dailyViews, 7);
  const avg30 = avgRecent(dailyViews, 30);
  const previous7 = avgRecent(dailyViews.slice(0, -7), 7);
  const previous30 = avgRecent(dailyViews.slice(0, -30), 30);
  const weeklyViewGrowth = changeBetween(history, "views", 7);
  const monthlyViewGrowth = changeBetween(history, "views", 30);
  const subscriberWeeklyGrowth = changeBetween(history, "subscribers", 7);
  const subscriberMonthlyGrowth = changeBetween(history, "subscribers", 30);
  const avg7Vs30Pct = percentChange(avg7, avg30) ?? 0;
  const momentumScore = avg7 == null
    ? null
    : Math.round(avg7 * (1 + Math.max(-0.4, Math.min(0.8, avg7Vs30Pct / 100))));
  const biggestSpike = history
    .filter(point => point.dailyViews != null)
    .sort((a, b) => (b.dailyViews ?? 0) - (a.dailyViews ?? 0))[0] ?? null;

  const dailySubscriberChange = subscriberCounts.length >= 2
    ? (subscriberCounts.at(-1) ?? null) != null && (subscriberCounts.at(-2) ?? null) != null
      ? (subscriberCounts.at(-1) as number) - (subscriberCounts.at(-2) as number)
      : null
    : null;

  return {
    views: {
      average7Day: avg7,
      average7DayFmt: fmtCount(avg7),
      average30Day: avg30,
      average30DayFmt: fmtCount(avg30),
      weeklyGrowth: weeklyViewGrowth,
      weeklyGrowthFmt: fmtCount(weeklyViewGrowth),
      monthlyGrowth: monthlyViewGrowth,
      monthlyGrowthFmt: fmtCount(monthlyViewGrowth),
      average7DayChangePct: percentChange(avg7, previous7),
      average30DayChangePct: percentChange(avg30, previous30),
      biggestSpike: biggestSpike ? {
        date: biggestSpike.date,
        views: biggestSpike.dailyViews,
        viewsFmt: fmtCount(biggestSpike.dailyViews),
      } : null,
    },
    subscribers: {
      dailyChange: dailySubscriberChange,
      dailyChangeFmt: fmtCount(dailySubscriberChange),
      weeklyGrowth: subscriberWeeklyGrowth,
      weeklyGrowthFmt: fmtCount(subscriberWeeklyGrowth),
      monthlyGrowth: subscriberMonthlyGrowth,
      monthlyGrowthFmt: fmtCount(subscriberMonthlyGrowth),
    },
    momentum: {
      trend: momentumFromAverages(avg7, avg30),
      score: momentumScore,
      scoreFmt: fmtCount(momentumScore),
    },
    availableDays: dailyViews.filter(value => value != null).length,
  };
}

async function getChannelHistory(artistKey: string): Promise<YoutubeChannelHistoryPoint[]> {
  const rows = await db
    .select()
    .from(youtubeChannelDailySnapshots)
    .where(eq(youtubeChannelDailySnapshots.artistKey, artistKey))
    .orderBy(desc(youtubeChannelDailySnapshots.snapshotDate))
    .limit(30);

  return rows.reverse().map(row => ({
    date: row.snapshotDate,
    views: row.viewCount,
    subscribers: row.subscriberCount,
    videos: row.videoCount,
    dailyViews: row.dailyViewDelta,
  }));
}

async function channelDbToResponse(row: typeof youtubeChannels.$inferSelect) {
  const history = await getChannelHistory(row.artistKey);
  const latest = history.at(-1) ?? null;
  const analytics = deriveChannelMetrics(history);
  return {
    artistKey:       row.artistKey,
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
    dailyViews:      latest?.dailyViews ?? null,
    dailyViewsFmt:   fmtCount(latest?.dailyViews),
    snapshotDate:    latest?.date ?? null,
    analytics,
    history,
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
    res.json(await channelDbToResponse(row));
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
      res.json(await channelDbToResponse(fresh!));
      logger.info({ artistKey, channelId: row.channelId }, "[youtube] channel stats refreshed");
      return;
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message, artistKey }, "[youtube] channel refresh failed, returning stale");
  }

  res.setHeader("X-Cache", "STALE");
  res.json(await channelDbToResponse(row));
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
    res.json(await channelDbToResponse(saved!));
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
  res.json({ channels: await Promise.all(rows.map(channelDbToResponse)) });
});

// GET /api/admin/youtube/videos — list all linked videos
router.get("/admin/youtube/videos", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.select().from(youtubeVideos).orderBy(youtubeVideos.linkedAt);
  res.json({ videos: rows.map(videoDbToResponse) });
});

// GET /api/admin/youtube/coverage
// Compares the artist metadata sheet against linked YouTube channels.
router.get("/admin/youtube/coverage", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const maxExamples = Math.min(parseInt((req.query["examples"] as string) ?? "25", 10), 100);
    const staleDays = Math.max(parseInt((req.query["staleDays"] as string) ?? "7", 10), 1);
    const staleMs = staleDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const [artists, linkedRows] = await Promise.all([
      fetchArtistMetadataRows(),
      db.select().from(youtubeChannels).orderBy(asc(youtubeChannels.cachedAt)),
    ]);

    const linkedByKey = new Map(linkedRows.map(row => [row.artistKey, row]));
    const linkedArtistKeys = new Set(linkedRows.map(row => row.artistKey));
    const missing = artists.filter(artist => artist.artist_key && !linkedArtistKeys.has(artist.artist_key));
    const stale = linkedRows.filter(row => now - row.cachedAt.getTime() > staleMs);
    const sheetYoutubeSubscribers = artists.filter(artist => Boolean(artist.youtube_subscribers?.trim())).length;
    const sheetYoutubeViews = artists.filter(artist => Boolean(artist.youtube_views?.trim())).length;

    res.json({
      source: "artist_metadata_active",
      totalArtists: artists.length,
      linkedChannels: linkedRows.length,
      missingChannels: missing.length,
      staleChannels: stale.length,
      staleDays,
      coveragePct: artists.length > 0 ? Number(((linkedRows.length / artists.length) * 100).toFixed(1)) : 0,
      sheetYoutubeSubscribers,
      sheetYoutubeViews,
      youtubeApiCanRefresh: linkedRows.length,
      youtubeApiNeedsLinking: missing.length,
      oldestCached: linkedRows[0]?.cachedAt.toISOString() ?? null,
      missingPreview: missing.slice(0, maxExamples).map(artist => ({
        artistKey: artist.artist_key,
        artistName: artist.artist_name,
        hasSheetSubscribers: Boolean(artist.youtube_subscribers?.trim()),
        hasSheetViews: Boolean(artist.youtube_views?.trim()),
      })),
      stalePreview: stale.slice(0, maxExamples).map(row => ({
        artistKey: row.artistKey,
        channelId: row.channelId,
        title: row.title,
        cachedAt: row.cachedAt.toISOString(),
      })),
      linkedPreview: artists
        .filter(artist => linkedByKey.has(artist.artist_key))
        .slice(0, maxExamples)
        .map(artist => {
          const row = linkedByKey.get(artist.artist_key)!;
          return {
            artistKey: artist.artist_key,
            artistName: artist.artist_name,
            channelId: row.channelId,
            title: row.title,
            subscribers: row.subscriberCount,
            views: row.viewCount,
            cachedAt: row.cachedAt.toISOString(),
          };
        }),
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "[youtube:coverage] failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/admin/youtube/channel-snapshots/run
// Forces today's official-channel snapshot job in the current environment.
router.post("/admin/youtube/channel-snapshots/run", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const summary = await runDailyYoutubeChannelSnapshots("admin-run-now");
  if (summary.status === "failed" || summary.status === "skipped") {
    res.status(500).json(summary);
    return;
  }

  res.json(summary);
});

// POST /api/admin/youtube/refresh-channels?limit=100&staleDays=7&dryRun=false
// Refreshes already-linked channels. This is cheap because channels.list costs
// 1 quota unit per request and does not use search.
router.post("/admin/youtube/refresh-channels", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "100", 10), 200);
  const staleDays = Math.max(parseInt((req.query["staleDays"] as string) ?? "7", 10), 1);
  const dryRun = (req.query["dryRun"] as string) === "true";
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - staleMs;

  try {
    const rows = await db.select().from(youtubeChannels).orderBy(asc(youtubeChannels.cachedAt));
    const staleRows = rows.filter(row => row.cachedAt.getTime() < cutoff);
    const toProcess = staleRows.slice(0, limit);

    if (dryRun) {
      res.json({
        totalLinked: rows.length,
        staleChannels: staleRows.length,
        staleDays,
        wouldRefresh: toProcess.length,
        preview: toProcess.map(row => ({
          artistKey: row.artistKey,
          channelId: row.channelId,
          title: row.title,
          cachedAt: row.cachedAt.toISOString(),
        })),
      });
      return;
    }

    const results: Array<{ artistKey: string; channelId: string; status: string; title?: string | null; subscribers?: string | null; error?: string }> = [];
    let quotaExhausted = false;

    for (const row of toProcess) {
      if (quotaExhausted) {
        results.push({ artistKey: row.artistKey, channelId: row.channelId, status: "skipped_quota" });
        continue;
      }

      try {
        const ch = await fetchChannelFromYt(row.channelId);
        if (!ch) {
          results.push({ artistKey: row.artistKey, channelId: row.channelId, status: "not_found" });
          continue;
        }

        const updated = channelToRow(row.artistKey, ch);
        await db.update(youtubeChannels).set(updated).where(eq(youtubeChannels.artistKey, row.artistKey));
        results.push({
          artistKey: row.artistKey,
          channelId: row.channelId,
          status: "refreshed",
          title: ch.snippet.title,
          subscribers: fmtCount(updated.subscriberCount),
        });
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes("403") || message.toLowerCase().includes("quota")) {
          quotaExhausted = true;
          results.push({ artistKey: row.artistKey, channelId: row.channelId, status: "skipped_quota", error: message });
          continue;
        }
        results.push({ artistKey: row.artistKey, channelId: row.channelId, status: "error", error: message });
      }

      await new Promise(r => setTimeout(r, 100));
    }

    res.json({
      totalLinked: rows.length,
      staleBeforeRun: staleRows.length,
      processed: toProcess.length,
      refreshed: results.filter(r => r.status === "refreshed").length,
      notFound: results.filter(r => r.status === "not_found").length,
      errors: results.filter(r => r.status === "error").length,
      quotaExhausted,
      remainingStaleEstimate: Math.max(0, staleRows.length - results.filter(r => r.status === "refreshed").length),
      results,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "[youtube:refresh-channels] failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/admin/youtube/backfill?limit=90&dryRun=false
// Reads the artist metadata sheet, finds artists without a linked YouTube channel,
// and links them one by one.  Tries a cheap forHandle lookup (1 quota unit) first;
// falls back to a search (100 units) only when that fails.
// Stops gracefully if the daily quota is exhausted and reports how many remain.
// Safe to call daily — idempotent, skips already-linked artists.
router.post("/admin/youtube/backfill", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const limit  = Math.min(parseInt((req.query["limit"]  as string) ?? "90",   10), 200);
  const dryRun = (req.query["dryRun"] as string) === "true";

  // Convert a display name to YouTube handle candidates (cheap 1-unit lookup)
  function toHandles(name: string): string[] {
    const clean  = name.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9 ]/g, "").trim();
    const nfkd   = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const camel  = clean.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    const lower  = clean.split(/\s+/).join("").toLowerCase();
    return [...new Set([camel, nfkd(camel), lower, nfkd(lower)])];
  }

  async function handleLookup(name: string): Promise<string | null> {
    for (const h of toHandles(name)) {
      const data = await ytFetch("/channels", {
        part: "id,statistics",
        forHandle: `@${h}`,
      }) as { items?: Array<{ id: string; statistics: { subscriberCount?: string } }> };
      const item = data.items?.[0];
      if (item && parseInt(item.statistics.subscriberCount ?? "0", 10) > 500) {
        return item.id as string;
      }
    }
    return null;
  }

  try {
    // Fetch artist list from the metadata API (already cached by the route)
    const allArtists = await fetchArtistMetadataRows();

    // Get already-linked keys
    const linked = await db.select({ artistKey: youtubeChannels.artistKey }).from(youtubeChannels);
    const linkedKeys = new Set(linked.map(r => r.artistKey));

    const unlinked  = allArtists.filter(a => a.artist_key && !linkedKeys.has(a.artist_key));
    const toProcess = unlinked.slice(0, limit);

    if (dryRun) {
      res.json({
        total: allArtists.length,
        linked: linkedKeys.size,
        remaining: unlinked.length,
        preview: toProcess.map(a => a.artist_name),
      });
      return;
    }

    const results: Array<{ name: string; status: string; channel?: string; subs?: string | null }> = [];
    let quotaExhausted = false;

    for (const artist of toProcess) {
      if (quotaExhausted) {
        results.push({ name: artist.artist_name, status: "skipped_quota" });
        continue;
      }

      let channelId: string | null = null;

      // 1 — cheap handle lookup
      try {
        channelId = await handleLookup(artist.artist_name);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg.includes("403") || msg.toLowerCase().includes("quota")) {
          quotaExhausted = true;
          results.push({ name: artist.artist_name, status: "skipped_quota" });
          continue;
        }
      }

      // 2 — search fallback (100 units)
      if (!channelId && !quotaExhausted) {
        try {
          const q        = `${artist.artist_name} oficial`;
          const cacheKey = `ch:${q.toLowerCase()}`;
          const cached   = searchCache.get(cacheKey);

          let hits: Array<{ channelId: string; title: string }> = [];
          if (cached && Date.now() - cached.cachedAt < SEARCH_TTL_MS) {
            hits = cached.results as typeof hits;
          } else {
            const data = await ytFetch("/search", {
              part:       "snippet",
              type:       "channel",
              q,
              maxResults: "5",
              regionCode: "MX",
            }) as { items?: Array<{ id: { channelId: string }; snippet: { title: string } }> };
            hits = (data.items ?? []).map(i => ({ channelId: i.id.channelId, title: i.snippet.title }));
            searchCache.set(cacheKey, { results: hits, cachedAt: Date.now() });
          }

          const nameLow = artist.artist_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          let best = hits[0];
          for (const r of hits) {
            const t = r.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (t === nameLow || t.startsWith((nameLow.split(" ")[0]) ?? "")) { best = r; break; }
          }
          channelId = best?.channelId ?? null;
        } catch (err) {
          const msg = (err as Error).message;
          if (msg.includes("403") || msg.toLowerCase().includes("quota")) {
            quotaExhausted = true;
            results.push({ name: artist.artist_name, status: "skipped_quota" });
            continue;
          }
        }
      }

      if (!channelId) {
        results.push({ name: artist.artist_name, status: "not_found" });
        continue;
      }

      // Link
      try {
        const ch = await fetchChannelFromYt(channelId);
        if (!ch) { results.push({ name: artist.artist_name, status: "channel_404" }); continue; }
        const row = { ...channelToRow(artist.artist_key, ch), linkedAt: new Date() };
        await db.insert(youtubeChannels).values(row).onConflictDoUpdate({
          target: youtubeChannels.artistKey,
          set:    row,
        });
        results.push({
          name:    artist.artist_name,
          status:  "linked",
          channel: ch.snippet.title,
          subs:    fmtCount(parseInt(ch.statistics.subscriberCount ?? "0", 10)),
        });
        logger.info({ artistKey: artist.artist_key, channelId }, "[youtube:backfill] linked");
      } catch (err) {
        results.push({ name: artist.artist_name, status: "error", channel: (err as Error).message });
      }

      await new Promise(r => setTimeout(r, 150));
    }

    const nLinked  = results.filter(r => r.status === "linked").length;
    const nMissing = results.filter(r => r.status === "not_found").length;
    const nSkipped = results.filter(r => r.status === "skipped_quota").length;

    res.json({
      processed:       toProcess.length,
      linked:          nLinked,
      not_found:       nMissing,
      quota_exhausted: quotaExhausted,
      skipped_quota:   nSkipped,
      remaining_after: Math.max(0, unlinked.length - nLinked),
      results,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "[youtube:backfill] failed");
    res.status(500).json({ error: (err as Error).message });
  }
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

// Private shadow-mode endpoints. These never create active public video links.
router.post("/admin/youtube/music-shadow/discover", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const body = req.body as { artistKey?: string; artistName?: string; browseId?: string; write?: boolean };
  const artistKey = body.artistKey?.trim().toLowerCase();
  const artistName = body.artistName?.trim();
  if (!artistKey || !artistName) {
    res.status(400).json({ error: "artistKey and artistName are required" });
    return;
  }
  const summary = await discoverYoutubeMusicArtist({
    artistKey,
    artistName,
    browseId: body.browseId?.trim() || null,
    write: body.write === true,
  });
  res.setHeader("Cache-Control", "no-store");
  res.status(summary.error ? 502 : 200).json({ publicDataChanged: false, shadowMode: true, ...summary });
});

router.post("/admin/youtube/music-shadow/intraday/run", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const summary = await runYoutubeIntradayShadow("admin-run-now", true, true);
  res.setHeader("Cache-Control", "no-store");
  res.status(summary.status === "failed" ? 500 : 200).json({ publicDataChanged: false, shadowMode: true, ...summary });
});

router.get("/admin/youtube/music-shadow/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const client = await pool.connect();
  try {
    await ensureYoutubeVideoTrackerTables(client);
    await ensureYoutubeShadowTables(client);
    await ensureYoutubeIntradayShadowTables(client);
    const unifiedQuota = await youtubeApiDailyUsage(client);
    const [counts, usage, artists, runs, rejectedCandidates, pilotArtists] = await Promise.all([
      client.query<{
        mappings: number; candidates: number; unique_videos: number; review: number; verified: number; rejected: number;
        observed: number; latest_observed_at: string | null;
      }>(`
        SELECT
          (SELECT count(*)::int FROM youtube_music_artist_candidates) mappings,
          (SELECT count(*)::int FROM youtube_music_catalog_candidates) candidates,
          (SELECT count(DISTINCT video_id)::int FROM youtube_music_catalog_candidates) unique_videos,
          (SELECT count(*)::int FROM youtube_music_catalog_candidates WHERE status='review') review,
          (SELECT count(*)::int FROM youtube_music_catalog_candidates WHERE status='verified') verified,
          (SELECT count(*)::int FROM youtube_music_catalog_candidates WHERE status='rejected') rejected,
          (SELECT count(DISTINCT video_id)::int FROM youtube_video_intraday_shadow_snapshots) observed,
          (SELECT max(observed_at)::text FROM youtube_video_intraday_shadow_snapshots) latest_observed_at
      `),
      client.query(`SELECT * FROM youtube_shadow_api_usage ORDER BY usage_date DESC LIMIT 7`),
      client.query(`
        SELECT
          cur.artist_key,
          cur.tracked_video_count,
          cur.videos_with_observations,
          cur.total_views,
          cur.latest_observed_at,
          cur.updated_at,
          COALESCE(candidate_counts.review_count, 0)::int review_count,
          COALESCE(candidate_counts.verified_count, 0)::int verified_count,
          COALESCE(candidate_counts.rejected_count, 0)::int rejected_count,
          COALESCE(candidate_counts.hot_count, 0)::int hot_count,
          COALESCE(candidate_counts.warm_count, 0)::int warm_count,
          COALESCE(candidate_counts.baseline_count, 0)::int baseline_count,
          COALESCE(latest_changes.latest_view_delta, 0)::bigint latest_view_delta
        FROM youtube_artist_intraday_shadow_current cur
        LEFT JOIN LATERAL (
          SELECT
            count(*) FILTER (WHERE status='review') review_count,
            count(*) FILTER (WHERE status='verified') verified_count,
            count(*) FILTER (WHERE status='rejected') rejected_count,
            count(*) FILTER (WHERE status IN ('review','verified') AND sampling_status='shadow' AND refresh_tier='hot') hot_count,
            count(*) FILTER (WHERE status IN ('review','verified') AND sampling_status='shadow' AND refresh_tier='warm') warm_count,
            count(*) FILTER (WHERE status IN ('review','verified') AND sampling_status='shadow' AND refresh_tier='baseline') baseline_count
          FROM youtube_music_catalog_candidates c
          WHERE c.artist_key=cur.artist_key
        ) candidate_counts ON true
        LEFT JOIN LATERAL (
          SELECT sum(latest.view_delta) latest_view_delta
          FROM (
            SELECT DISTINCT c.video_id
            FROM youtube_music_catalog_candidates c
            WHERE c.artist_key=cur.artist_key AND c.status IN ('review','verified') AND c.sampling_status='shadow'
          ) videos
          LEFT JOIN LATERAL (
            SELECT s.view_delta
            FROM youtube_video_intraday_shadow_snapshots s
            WHERE s.video_id=videos.video_id
            ORDER BY s.observed_at DESC
            LIMIT 1
          ) latest ON true
        ) latest_changes ON true
        ORDER BY cur.total_views DESC, cur.artist_key
      `),
      client.query(`SELECT * FROM youtube_music_shadow_runs ORDER BY started_at DESC LIMIT 10`),
      client.query(`
        SELECT artist_key, artist_name, video_id, title, canonical_url, rejection_reason, updated_at
        FROM youtube_music_catalog_candidates
        WHERE status='rejected'
        ORDER BY updated_at DESC, artist_key, title
        LIMIT 100
      `),
      client.query<{
        artist_key: string;
        artist_name: string;
        eligible_candidates: number;
        rejected_candidates: number;
        discovery_status: string | null;
        mapping_status: string | null;
        discovery_error: string | null;
        last_attempt_at: string | null;
      }>(`
        WITH pilots(artist_key, artist_name, ordinal) AS (VALUES
          ${YOUTUBE_SHADOW_PILOT_ARTISTS.map((pilot, index) => `('${pilot.artistKey}','${pilot.artistName.replaceAll("'", "''")}',${index})`).join(",")}
        )
        SELECT
          p.artist_key,
          p.artist_name,
          count(c.id) FILTER (WHERE c.status IN ('review','verified') AND c.sampling_status='shadow')::int eligible_candidates,
          count(c.id) FILTER (WHERE c.status='rejected')::int rejected_candidates,
          latest.status discovery_status,
          latest.summary->>'mappingStatus' mapping_status,
          latest.summary->>'error' discovery_error,
          latest.finished_at::text last_attempt_at
        FROM pilots p
        LEFT JOIN youtube_music_catalog_candidates c ON c.artist_key=p.artist_key
        LEFT JOIN LATERAL (
          SELECT status, summary, finished_at
          FROM youtube_music_shadow_runs
          WHERE run_type='discovery' AND artist_key=p.artist_key
          ORDER BY started_at DESC
          LIMIT 1
        ) latest ON true
        GROUP BY p.artist_key, p.artist_name, p.ordinal, latest.status, latest.summary, latest.finished_at
        ORDER BY p.ordinal
      `),
    ]);
    const readyPilotArtists = pilotArtists.rows.filter(row => Number(row.eligible_candidates) > 0).length;
    res.setHeader("Cache-Control", "no-store");
    res.json({
      publicDataChanged: false,
      shadowMode: true,
      automationEnabled: youtubeIntradayShadowAutomationEnabled(),
      catalogReady: readyPilotArtists === YOUTUBE_SHADOW_PILOT_ARTISTS.length,
      readyPilotArtists,
      totalPilotArtists: YOUTUBE_SHADOW_PILOT_ARTISTS.length,
      pilotArtists: pilotArtists.rows,
      counts: counts.rows[0],
      usage: usage.rows,
      unifiedQuota,
      artists: artists.rows,
      recentRuns: runs.rows,
      rejectedCandidates: rejectedCandidates.rows,
    });
  } finally {
    client.release();
  }
});

// Public read-only preview for every artist with approved shadow observations.
// The complete tracked set is reserved for the authenticated artist monitor.
// Discovery evidence, review notes, rejected candidates, and admin controls
// remain private.
router.get("/providers/youtube/live-videos", async (req, res) => {
  const artistKey = String(req.query["artistKey"] ?? "").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,100}$/.test(artistKey)) {
    res.status(400).json({ error: "artistKey inválido." });
    return;
  }

  const client = await publicReadPool.connect();
  try {
    const videos = await client.query(`
      WITH eastern_bounds AS (
        SELECT
          (date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York') today_start,
          ((date_trunc('day', now() AT TIME ZONE 'America/New_York') - interval '1 day') AT TIME ZONE 'America/New_York') previous_start
      ), matched_candidates AS (
        SELECT c.*,
          regexp_replace(translate(lower(c.artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g') logical_artist_key,
          row_number() OVER (
            PARTITION BY
              regexp_replace(translate(lower(c.artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g'),
              c.video_id
            ORDER BY
              (c.artist_key=$1) DESC,
              (c.status='verified') DESC,
              c.confidence_score DESC,
              (c.canonical_url LIKE 'https://www.youtube.com/watch?v=%') DESC,
              c.id
          ) candidate_rank
        FROM youtube_music_catalog_candidates c
        WHERE (
            c.artist_key=$1
            OR regexp_replace(
              translate(lower(c.artist_key), 'áéíóúüñ', 'aeiouun'),
              '[^a-z0-9]', '', 'g'
            ) = regexp_replace(
              translate(lower($1), 'áéíóúüñ', 'aeiouun'),
              '[^a-z0-9]', '', 'g'
            )
          )
          AND c.status IN ('review','verified')
          AND c.sampling_status='shadow'
      ), canonical_candidates AS (
        SELECT * FROM matched_candidates WHERE candidate_rank=1
      )
      SELECT
        c.artist_name,
        c.video_id,
        COALESCE(NULLIF(v.title, ''), c.title) title,
        v.thumbnail_url,
        'https://www.youtube.com/watch?v=' || c.video_id canonical_url,
        latest.view_count,
        latest.view_delta,
        latest.seconds_since_previous,
        latest.observed_at::text observed_at,
        CASE WHEN previous_start.view_count IS NULL OR today_start.view_count IS NULL THEN NULL
          ELSE GREATEST(0, today_start.view_count - previous_start.view_count) END views_24h,
        previous_start.observed_at::text views_24h_started_at,
        today_start.observed_at::text views_24h_ended_at,
        CASE WHEN today_start.view_count IS NULL OR latest.view_count IS NULL THEN NULL
          ELSE GREATEST(0, latest.view_count - today_start.view_count) END views_today_et,
        today_start.observed_at::text views_today_et_started_at,
        CASE WHEN today_start.observed_at IS NULL THEN NULL ELSE latest.observed_at::text END views_today_et_ended_at
      FROM canonical_candidates c
      CROSS JOIN eastern_bounds bounds
      JOIN youtube_tracked_videos v ON v.video_id=c.video_id
      JOIN LATERAL (
        SELECT s.view_count, s.view_delta, s.seconds_since_previous, s.observed_at
        FROM youtube_video_intraday_shadow_snapshots s
        WHERE s.video_id=c.video_id
        ORDER BY s.observed_at DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT s.view_count, s.observed_at
        FROM youtube_video_intraday_shadow_snapshots s
        WHERE s.video_id=c.video_id
          AND s.observed_at >= bounds.previous_start
          AND s.observed_at < bounds.previous_start + interval '30 minutes'
        ORDER BY s.observed_at
        LIMIT 1
      ) previous_start ON true
      LEFT JOIN LATERAL (
        SELECT s.view_count, s.observed_at
        FROM youtube_video_intraday_shadow_snapshots s
        WHERE s.video_id=c.video_id
          AND s.observed_at >= bounds.today_start
          AND s.observed_at < bounds.today_start + interval '30 minutes'
        ORDER BY s.observed_at
        LIMIT 1
      ) today_start ON true
      ORDER BY latest.view_count DESC, c.title
      LIMIT 10
    `, [artistKey]);

    const uniqueVideos = dedupeYoutubeMonitorRows(videos.rows as Array<{video_id:string;canonical_url?:string|null;observed_at?:string|null}>);
    const latestObservedAt = uniqueVideos.reduce<string | null>((latest, video) => {
      const observedAt = typeof video.observed_at === "string" ? video.observed_at : null;
      if (!observedAt) return latest;
      return !latest || new Date(observedAt).getTime() > new Date(latest).getTime() ? observedAt : latest;
    }, null);
    const fresh = latestObservedAt != null
      && Date.now() - new Date(latestObservedAt).getTime() <= 6 * 60 * 60 * 1000;

    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json({
      artistKey,
      artistName: videos.rows[0]?.artist_name ?? null,
      exact: true,
      fresh,
      latestObservedAt,
      videos: uniqueVideos,
      freeLimit: 10,
    });
  } finally {
    client.release();
  }
});

// Public operational coverage for the live-video feature. This intentionally
// exposes aggregate readiness only, never discovery evidence or credentials.
router.get("/providers/youtube/live-coverage", async (_req, res) => {
  const requestStartedAt = performance.now();
  const client = await publicReadPool.connect();
  const connectionAcquiredAt = performance.now();
  try {
    const coverage = await client.query(`
      WITH roster_keys AS MATERIALIZED (
        SELECT DISTINCT regexp_replace(
          translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]', '', 'g'
        ) artist_key
        FROM kworb_coverage
        WHERE status='active'
      ), approved_link_keys AS MATERIALIZED (
        SELECT DISTINCT regexp_replace(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g') artist_key
        FROM youtube_artist_video_links
        WHERE active=true AND confidence_score >= 80
      ), profile_channel_keys AS MATERIALIZED (
        SELECT DISTINCT regexp_replace(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g') artist_key
        FROM youtube_channels
        WHERE channel_id IS NOT NULL
      ), kworb_video_keys AS MATERIALIZED (
        SELECT DISTINCT regexp_replace(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g') artist_key
        FROM kworb_snapshots
        WHERE metric_type='youtube'
          AND jsonb_typeof(value->'topVideos')='array'
          AND jsonb_array_length(value->'topVideos') > 0
      ), mapping_totals AS (
        SELECT
          count(*) FILTER (
            WHERE link.artist_key IS NOT NULL
               OR channel.artist_key IS NOT NULL
               OR kworb.artist_key IS NOT NULL
          )::int mapped_artists,
          count(*) FILTER (WHERE link.artist_key IS NOT NULL)::int approved_link_artists,
          count(*) FILTER (WHERE channel.artist_key IS NOT NULL)::int profile_channel_artists,
          count(*) FILTER (WHERE kworb.artist_key IS NOT NULL)::int kworb_video_artists
        FROM roster_keys roster
        LEFT JOIN approved_link_keys link USING (artist_key)
        LEFT JOIN profile_channel_keys channel USING (artist_key)
        LEFT JOIN kworb_video_keys kworb USING (artist_key)
      ), eligible_candidates AS MATERIALIZED (
        SELECT DISTINCT candidate_key.artist_key, candidate_key.video_id
        FROM (
          SELECT
            regexp_replace(
              translate(lower(candidate.artist_key), 'áéíóúüñ', 'aeiouun'),
              '[^a-z0-9]', '', 'g'
            ) artist_key,
            candidate.video_id
          FROM youtube_music_catalog_candidates candidate
          WHERE candidate.status IN ('review','verified')
            AND candidate.sampling_status='shadow'
        ) candidate_key
        JOIN roster_keys roster USING (artist_key)
      ), eligible_video_ids AS MATERIALIZED (
        SELECT DISTINCT video_id
        FROM eligible_candidates
      ), snapshot_state AS MATERIALIZED (
        SELECT sample.video_id, max(sample.observed_at) latest_observed_at
        FROM youtube_video_intraday_shadow_snapshots sample
        JOIN eligible_video_ids eligible USING (video_id)
        GROUP BY sample.video_id
      ), candidate_totals AS (
        SELECT
          count(DISTINCT candidate.artist_key)::int catalog_artists,
          count(DISTINCT candidate.artist_key) FILTER (
            WHERE sample.video_id IS NOT NULL
          )::int observed_artists,
          count(DISTINCT candidate.artist_key) FILTER (
            WHERE sample.latest_observed_at >= now() - interval '6 hours'
          )::int fresh_artists,
          count(DISTINCT candidate.video_id)::int catalog_videos,
          count(DISTINCT candidate.video_id) FILTER (
            WHERE sample.video_id IS NOT NULL
          )::int observed_videos,
          count(DISTINCT candidate.video_id) FILTER (
            WHERE sample.latest_observed_at >= now() - interval '6 hours'
          )::int fresh_videos,
          max(sample.latest_observed_at)::text latest_observed_at
        FROM eligible_candidates candidate
        LEFT JOIN snapshot_state sample USING (video_id)
      )
      SELECT
        (SELECT count(*)::int FROM kworb_coverage WHERE status='active') roster_artists,
        mapping.*,
        candidate.*
      FROM mapping_totals mapping
      CROSS JOIN candidate_totals candidate
    `);
    const queryCompletedAt = performance.now();
    const row = coverage.rows[0] ?? {};
    const rosterArtists = Number(row.roster_artists ?? 0);
    const mappedArtists = Number(row.mapped_artists ?? 0);
    const catalogArtists = Number(row.catalog_artists ?? 0);
    const observedArtists = Number(row.observed_artists ?? 0);
    const freshArtists = Number(row.fresh_artists ?? 0);
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.setHeader(
      "Server-Timing",
      `db-acquire;dur=${(connectionAcquiredAt - requestStartedAt).toFixed(1)}, `
        + `db-query;dur=${(queryCompletedAt - connectionAcquiredAt).toFixed(1)}, `
        + `app;dur=${(performance.now() - queryCompletedAt).toFixed(1)}`,
    );
    res.json({
      rosterArtists,
      mappedArtists,
      approvedLinkArtists: Number(row.approved_link_artists ?? 0),
      profileChannelArtists: Number(row.profile_channel_artists ?? 0),
      kworbVideoArtists: Number(row.kworb_video_artists ?? 0),
      catalogArtists,
      observedArtists,
      freshArtists,
      awaitingVideoMapping: Math.max(0, rosterArtists - mappedArtists),
      awaitingFirstObservation: Math.max(0, catalogArtists - observedArtists),
      catalogVideos: Number(row.catalog_videos ?? 0),
      observedVideos: Number(row.observed_videos ?? 0),
      freshVideos: Number(row.fresh_videos ?? 0),
      latestObservedAt: row.latest_observed_at ?? null,
      collectionCadenceMinutes: 5,
      maxVideosPerPass: 250,
    });
  } finally {
    client.release();
  }
});

router.get("/admin/youtube/music-shadow/videos", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const artistKey = String(req.query["artistKey"] ?? "").trim();
  if (!/^[a-z0-9-]{1,100}$/.test(artistKey)) {
    res.status(400).json({ error: "artistKey inválido." });
    return;
  }

  const limit = Math.max(1, Math.min(250, Number(req.query["limit"] ?? 250) || 250));
  const offset = Math.max(0, Number(req.query["offset"] ?? 0) || 0);
  const client = await pool.connect();
  try {
    await ensureYoutubeVideoTrackerTables(client);
    await ensureYoutubeShadowTables(client);
    await ensureYoutubeIntradayShadowTables(client);
    const [videos, count] = await Promise.all([
      client.query(`
        WITH eastern_bounds AS (
          SELECT
            (date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York') today_start,
            ((date_trunc('day', now() AT TIME ZONE 'America/New_York') - interval '1 day') AT TIME ZONE 'America/New_York') previous_start
        )
        SELECT
          c.artist_key,
          c.artist_name,
          c.video_id,
          COALESCE(NULLIF(v.title, ''), c.title) title,
          v.thumbnail_url,
          c.canonical_url,
          c.status,
          c.refresh_tier,
          c.evidence_source,
          latest.view_count,
          latest.view_delta,
          latest.like_count,
          latest.comment_count,
          latest.seconds_since_previous,
          latest.observed_at::text observed_at,
          CASE WHEN previous_start.view_count IS NULL OR today_start.view_count IS NULL THEN NULL
            ELSE GREATEST(0, today_start.view_count - previous_start.view_count) END views_24h,
          CASE
            WHEN previous_start.observed_at IS NULL OR today_start.observed_at IS NULL THEN NULL
            ELSE round(extract(epoch FROM (today_start.observed_at - previous_start.observed_at)))::int
          END views_24h_span_seconds,
          previous_start.observed_at::text views_24h_started_at,
          today_start.observed_at::text views_24h_ended_at,
          CASE WHEN today_start.view_count IS NULL OR latest.view_count IS NULL THEN NULL
            ELSE GREATEST(0, latest.view_count - today_start.view_count) END views_today_et,
          CASE WHEN today_start.observed_at IS NULL OR latest.observed_at IS NULL THEN NULL
            ELSE round(extract(epoch FROM (latest.observed_at - today_start.observed_at)))::int
          END views_today_et_span_seconds,
          today_start.observed_at::text views_today_et_started_at,
          CASE WHEN today_start.observed_at IS NULL THEN NULL ELSE latest.observed_at::text END views_today_et_ended_at
        FROM youtube_music_catalog_candidates c
        CROSS JOIN eastern_bounds bounds
        JOIN youtube_tracked_videos v ON v.video_id=c.video_id
        LEFT JOIN LATERAL (
          SELECT
            s.view_count,
            s.view_delta,
            s.like_count,
            s.comment_count,
            s.seconds_since_previous,
            s.observed_at
          FROM youtube_video_intraday_shadow_snapshots s
          WHERE s.video_id=c.video_id
          ORDER BY s.observed_at DESC
          LIMIT 1
        ) latest ON true
        LEFT JOIN LATERAL (
          SELECT s.view_count, s.observed_at
          FROM youtube_video_intraday_shadow_snapshots s
          WHERE s.video_id=c.video_id
            AND s.observed_at >= bounds.previous_start
            AND s.observed_at < bounds.previous_start + interval '30 minutes'
          ORDER BY s.observed_at
          LIMIT 1
        ) previous_start ON true
        LEFT JOIN LATERAL (
          SELECT s.view_count, s.observed_at
          FROM youtube_video_intraday_shadow_snapshots s
          WHERE s.video_id=c.video_id
            AND s.observed_at >= bounds.today_start
            AND s.observed_at < bounds.today_start + interval '30 minutes'
          ORDER BY s.observed_at
          LIMIT 1
        ) today_start ON true
        WHERE c.artist_key=$1
          AND c.status IN ('review','verified')
          AND c.sampling_status='shadow'
        ORDER BY latest.view_delta DESC NULLS LAST, latest.view_count DESC NULLS LAST, c.title
        LIMIT $2 OFFSET $3
      `, [artistKey, limit, offset]),
      client.query<{ total: number }>(`
        SELECT count(*)::int total
        FROM youtube_music_catalog_candidates
        WHERE artist_key=$1
          AND status IN ('review','verified')
          AND sampling_status='shadow'
      `, [artistKey]),
    ]);

    res.setHeader("Cache-Control", "no-store");
    res.json({
      publicDataChanged: false,
      shadowMode: true,
      artistKey,
      total: count.rows[0]?.total ?? 0,
      limit,
      offset,
      videos: videos.rows,
    });
  } finally {
    client.release();
  }
});

export default router;
