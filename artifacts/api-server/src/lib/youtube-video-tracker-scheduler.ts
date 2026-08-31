import { pool } from "@workspace/db";
import { finishDailySnapshotRunLog, startDailySnapshotRunLog } from "./daily-snapshot-run-log";
import { logger } from "./logger";
import { reserveYoutubeApiUsage } from "./youtube-api-budget";
import { safeErrorDetails } from "./safe-error";

type PgClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  release: () => void;
};

interface VideoRow {
  video_id: string;
}

interface YoutubeVideoItem {
  id: string;
  snippet?: {
    channelId?: string;
    title?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
}

interface VideoStats {
  videoId: string;
  channelId: string | null;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  duration: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
}

export interface YoutubeVideoSnapshotRunSummary {
  status: "complete" | "already_complete" | "locked" | "skipped" | "failed";
  snapshotDate: string;
  reason: string;
  videos: number;
  artists: number;
  fetched: number;
  saved: number;
  missing: number;
  dateRows: number;
  rollupRows: number;
  dailyViewsTotal: number;
  error?: string;
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const LOCK_KEY = 392_410_603;
const CHECK_MS = 60 * 60 * 1000;

let schedulerStarted = false;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function batch<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

function automationEnabled() {
  return process.env["YOUTUBE_VIDEO_TRACKER_AUTOMATION"] === "true";
}

function scheduledHourUtc() {
  const raw = Number(process.env["YOUTUBE_VIDEO_TRACKER_HOUR_UTC"] ?? "10");
  return Number.isFinite(raw) ? Math.max(0, Math.min(23, raw)) : 10;
}

function isScheduledHour() {
  return new Date().getUTCHours() >= scheduledHourUtc();
}

export async function ensureYoutubeVideoTrackerTables(client: PgClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_tracked_videos (
      video_id text PRIMARY KEY,
      channel_id text,
      title text NOT NULL DEFAULT '',
      thumbnail_url text,
      published_at timestamptz,
      duration text,
      view_count bigint,
      like_count bigint,
      comment_count bigint,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      last_seen_at timestamptz,
      last_snapshot_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_artist_video_links (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      artist_name text NOT NULL DEFAULT '',
      video_id text NOT NULL REFERENCES youtube_tracked_videos(video_id) ON DELETE cascade,
      source_type text NOT NULL DEFAULT 'youtube_uploads',
      confidence_score integer NOT NULL DEFAULT 80,
      priority integer NOT NULL DEFAULT 50,
      active boolean NOT NULL DEFAULT true,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_video_daily_snapshots (
      id serial PRIMARY KEY,
      video_id text NOT NULL REFERENCES youtube_tracked_videos(video_id) ON DELETE cascade,
      snapshot_date text NOT NULL,
      view_count bigint,
      like_count bigint,
      comment_count bigint,
      daily_view_delta bigint,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_artist_video_daily_rollups (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      snapshot_date text NOT NULL,
      tracked_video_count integer NOT NULL DEFAULT 0,
      videos_with_snapshot_count integer NOT NULL DEFAULT 0,
      videos_with_delta_count integer NOT NULL DEFAULT 0,
      frozen_video_count integer NOT NULL DEFAULT 0,
      total_tracked_views bigint NOT NULL DEFAULT 0,
      daily_view_delta bigint NOT NULL DEFAULT 0,
      coverage_score integer NOT NULL DEFAULT 0,
      source_type text NOT NULL DEFAULT 'youtube_video_tracker',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS youtube_tracked_videos_channel_idx ON youtube_tracked_videos(channel_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_tracked_videos_updated_idx ON youtube_tracked_videos(updated_at);`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS youtube_artist_video_links_artist_video_unique ON youtube_artist_video_links(artist_key, video_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_links_artist_idx ON youtube_artist_video_links(artist_key);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_links_video_idx ON youtube_artist_video_links(video_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_links_active_priority_idx ON youtube_artist_video_links(active, priority);`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS youtube_video_daily_snapshots_video_date_unique ON youtube_video_daily_snapshots(video_id, snapshot_date);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_video_daily_snapshots_date_idx ON youtube_video_daily_snapshots(snapshot_date);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_video_daily_snapshots_video_date_idx ON youtube_video_daily_snapshots(video_id, snapshot_date);`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS youtube_artist_video_daily_rollups_artist_date_unique ON youtube_artist_video_daily_rollups(artist_key, snapshot_date);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_daily_rollups_date_idx ON youtube_artist_video_daily_rollups(snapshot_date);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_daily_rollups_artist_date_idx ON youtube_artist_video_daily_rollups(artist_key, snapshot_date);`);
}

async function fetchYoutubeVideos(client: PgClient, videoIds: string[]): Promise<VideoStats[]> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");

  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("maxResults", String(videoIds.length));

  await reserveYoutubeApiUsage(client, { consumer: "daily_video_snapshots", method: "videos.list" });
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 240)}`);
  }

  const data = await res.json() as { items?: YoutubeVideoItem[] };
  return (data.items ?? []).map(item => {
    const thumbs = item.snippet?.thumbnails ?? {};
    return {
      videoId: item.id,
      channelId: item.snippet?.channelId ?? null,
      title: item.snippet?.title ?? "",
      thumbnailUrl: thumbs.maxres?.url ?? thumbs.standard?.url ?? thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null,
      publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null,
      duration: item.contentDetails?.duration ?? null,
      viewCount: parseNumber(item.statistics?.viewCount),
      likeCount: parseNumber(item.statistics?.likeCount),
      commentCount: parseNumber(item.statistics?.commentCount),
    };
  });
}

async function previousViewCount(client: PgClient, videoId: string, snapshotDate: string): Promise<number | null> {
  const prev = await client.query<{ view_count: string | number | null }>(
    `
      SELECT view_count
      FROM youtube_video_daily_snapshots
      WHERE video_id = $1
        AND snapshot_date < $2
        AND view_count IS NOT NULL
      ORDER BY snapshot_date DESC
      LIMIT 1
    `,
    [videoId, snapshotDate],
  );
  const value = prev.rows[0]?.view_count;
  return value == null ? null : Number(value);
}

async function saveVideoSnapshot(client: PgClient, stats: VideoStats, snapshotDate: string): Promise<number | null> {
  const previous = stats.viewCount == null ? null : await previousViewCount(client, stats.videoId, snapshotDate);
  const dailyDelta = stats.viewCount == null || previous == null ? null : Math.max(0, stats.viewCount - previous);

  await client.query(
    `
      INSERT INTO youtube_tracked_videos (
        video_id, channel_id, title, thumbnail_url, published_at, duration,
        view_count, like_count, comment_count, last_seen_at, last_snapshot_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now(),now())
      ON CONFLICT (video_id) DO UPDATE SET
        channel_id = COALESCE(excluded.channel_id, youtube_tracked_videos.channel_id),
        title = COALESCE(NULLIF(excluded.title, ''), youtube_tracked_videos.title),
        thumbnail_url = COALESCE(excluded.thumbnail_url, youtube_tracked_videos.thumbnail_url),
        published_at = COALESCE(excluded.published_at, youtube_tracked_videos.published_at),
        duration = COALESCE(excluded.duration, youtube_tracked_videos.duration),
        view_count = excluded.view_count,
        like_count = excluded.like_count,
        comment_count = excluded.comment_count,
        last_seen_at = now(),
        last_snapshot_at = now(),
        updated_at = now()
    `,
    [
      stats.videoId,
      stats.channelId,
      stats.title,
      stats.thumbnailUrl,
      stats.publishedAt,
      stats.duration,
      stats.viewCount,
      stats.likeCount,
      stats.commentCount,
    ],
  );

  await client.query(
    `
      INSERT INTO youtube_video_daily_snapshots (
        video_id, snapshot_date, view_count, like_count, comment_count, daily_view_delta, fetched_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,now(),now())
      ON CONFLICT (video_id, snapshot_date) DO UPDATE SET
        view_count = excluded.view_count,
        like_count = excluded.like_count,
        comment_count = excluded.comment_count,
        daily_view_delta = excluded.daily_view_delta,
        fetched_at = excluded.fetched_at,
        updated_at = now()
    `,
    [stats.videoId, snapshotDate, stats.viewCount, stats.likeCount, stats.commentCount, dailyDelta],
  );

  return dailyDelta;
}

async function rebuildArtistRollups(client: PgClient, snapshotDate: string) {
  await client.query(
    `
      INSERT INTO youtube_artist_video_daily_rollups (
        artist_key,
        snapshot_date,
        tracked_video_count,
        videos_with_snapshot_count,
        videos_with_delta_count,
        frozen_video_count,
        total_tracked_views,
        daily_view_delta,
        coverage_score,
        source_type,
        updated_at
      )
      SELECT
        l.artist_key,
        $1 AS snapshot_date,
        count(DISTINCT l.video_id)::int AS tracked_video_count,
        count(DISTINCT s.video_id)::int AS videos_with_snapshot_count,
        count(DISTINCT s.video_id) FILTER (WHERE s.daily_view_delta IS NOT NULL)::int AS videos_with_delta_count,
        count(DISTINCT s.video_id) FILTER (WHERE s.daily_view_delta = 0)::int AS frozen_video_count,
        COALESCE(sum(s.view_count), 0)::bigint AS total_tracked_views,
        COALESCE(sum(s.daily_view_delta), 0)::bigint AS daily_view_delta,
        CASE
          WHEN count(DISTINCT l.video_id) = 0 THEN 0
          ELSE round((count(DISTINCT s.video_id)::numeric / count(DISTINCT l.video_id)::numeric) * 100)::int
        END AS coverage_score,
        'youtube_video_tracker' AS source_type,
        now() AS updated_at
      FROM youtube_artist_video_links l
      LEFT JOIN youtube_video_daily_snapshots s
        ON s.video_id = l.video_id
       AND s.snapshot_date = $1
      WHERE l.active = true
      GROUP BY l.artist_key
      ON CONFLICT (artist_key, snapshot_date) DO UPDATE SET
        tracked_video_count = excluded.tracked_video_count,
        videos_with_snapshot_count = excluded.videos_with_snapshot_count,
        videos_with_delta_count = excluded.videos_with_delta_count,
        frozen_video_count = excluded.frozen_video_count,
        total_tracked_views = excluded.total_tracked_views,
        daily_view_delta = excluded.daily_view_delta,
        coverage_score = excluded.coverage_score,
        updated_at = now()
    `,
    [snapshotDate],
  );
}

async function snapshotCounts(client: PgClient, snapshotDate: string) {
  const counts = await client.query<{
    videos: number;
    artists: number;
    snapshots: number;
    rollups: number;
  }>(
    `
      SELECT
        (SELECT count(DISTINCT video_id)::int FROM youtube_artist_video_links WHERE active = true) AS videos,
        (SELECT count(DISTINCT artist_key)::int FROM youtube_artist_video_links WHERE active = true) AS artists,
        (SELECT count(*)::int FROM youtube_video_daily_snapshots WHERE snapshot_date = $1) AS snapshots,
        (SELECT count(*)::int FROM youtube_artist_video_daily_rollups WHERE snapshot_date = $1) AS rollups
    `,
    [snapshotDate],
  );
  return {
    videos: counts.rows[0]?.videos ?? 0,
    artists: counts.rows[0]?.artists ?? 0,
    snapshots: counts.rows[0]?.snapshots ?? 0,
    rollups: counts.rows[0]?.rollups ?? 0,
  };
}

export async function runDailyYoutubeVideoSnapshots(reason: string): Promise<YoutubeVideoSnapshotRunSummary> {
  const snapshotDate = todayIso();
  const runLogId = await startDailySnapshotRunLog({ provider: "youtube-video", snapshotDate, reason });
  if (!process.env["YOUTUBE_API_KEY"]) {
    const summary = {
      status: "skipped",
      snapshotDate,
      reason,
      videos: 0,
      artists: 0,
      fetched: 0,
      saved: 0,
      missing: 0,
      dateRows: 0,
      rollupRows: 0,
      dailyViewsTotal: 0,
      error: "Missing YOUTUBE_API_KEY.",
    } satisfies YoutubeVideoSnapshotRunSummary;
    await finishDailySnapshotRunLog(runLogId, {
      status: summary.status,
      expectedCount: summary.videos,
      fetchedCount: summary.fetched,
      savedCount: summary.saved,
      missingCount: summary.missing,
      dateRows: summary.dateRows,
      totalDailyValue: summary.dailyViewsTotal,
      error: summary.error,
    });
    return summary;
  }

  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    if (!lock.rows[0]?.locked) {
      const summary = {
        status: "locked",
        snapshotDate,
        reason,
        videos: 0,
        artists: 0,
        fetched: 0,
        saved: 0,
        missing: 0,
        dateRows: 0,
        rollupRows: 0,
        dailyViewsTotal: 0,
      } satisfies YoutubeVideoSnapshotRunSummary;
      await finishDailySnapshotRunLog(runLogId, {
        status: summary.status,
        expectedCount: summary.videos,
        fetchedCount: summary.fetched,
        savedCount: summary.saved,
        missingCount: summary.missing,
        dateRows: summary.dateRows,
        totalDailyValue: summary.dailyViewsTotal,
      });
      return summary;
    }

    try {
      await ensureYoutubeVideoTrackerTables(client);
      const before = await snapshotCounts(client, snapshotDate);
      if (before.videos <= 0 || before.snapshots >= before.videos) {
        logger.info({ snapshotDate, reason }, "[youtube-video:snapshots] already complete for today");
        const summary = {
          status: "already_complete",
          snapshotDate,
          reason,
          videos: before.videos,
          artists: before.artists,
          fetched: 0,
          saved: 0,
          missing: 0,
          dateRows: before.snapshots,
          rollupRows: before.rollups,
          dailyViewsTotal: 0,
        } satisfies YoutubeVideoSnapshotRunSummary;
        await finishDailySnapshotRunLog(runLogId, {
          status: summary.status,
          expectedCount: summary.videos,
          fetchedCount: summary.fetched,
          savedCount: summary.saved,
          missingCount: summary.missing,
          dateRows: summary.dateRows,
          totalDailyValue: summary.dailyViewsTotal,
        });
        return summary;
      }

      const videoRows = await client.query<VideoRow>(`
        SELECT l.video_id
        FROM youtube_artist_video_links l
        WHERE l.active = true
        GROUP BY l.video_id
        ORDER BY max(l.priority) DESC, l.video_id
      `);

      let fetched = 0;
      let saved = 0;
      let missing = 0;
      let dailyViewsTotal = 0;

      for (const group of batch(videoRows.rows, 50)) {
        const statsRows = await fetchYoutubeVideos(client, group.map(row => row.video_id));
        fetched += statsRows.length;
        const statsById = new Map(statsRows.map(stats => [stats.videoId, stats]));

        for (const row of group) {
          const stats = statsById.get(row.video_id);
          if (!stats) {
            missing += 1;
            continue;
          }
          const delta = await saveVideoSnapshot(client, stats, snapshotDate);
          saved += 1;
          dailyViewsTotal += delta ?? 0;
        }
      }

      await rebuildArtistRollups(client, snapshotDate);
      const after = await snapshotCounts(client, snapshotDate);
      const summary = {
        status: "complete",
        snapshotDate,
        reason,
        videos: videoRows.rows.length,
        artists: after.artists,
        fetched,
        saved,
        missing,
        dateRows: after.snapshots,
        rollupRows: after.rollups,
        dailyViewsTotal,
      } satisfies YoutubeVideoSnapshotRunSummary;
      await finishDailySnapshotRunLog(runLogId, {
        status: summary.status,
        expectedCount: summary.videos,
        fetchedCount: summary.fetched,
        savedCount: summary.saved,
        missingCount: summary.missing,
        dateRows: summary.dateRows,
        totalDailyValue: summary.dailyViewsTotal,
      });
      return summary;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    }
  } catch (err) {
    logger.error(safeErrorDetails(err,{snapshotDate,reason,job:"daily-video-snapshots"}), "[youtube-video:snapshots] daily video snapshot job failed");
    const summary = {
      status: "failed",
      snapshotDate,
      reason,
      videos: 0,
      artists: 0,
      fetched: 0,
      saved: 0,
      missing: 0,
      dateRows: 0,
      rollupRows: 0,
      dailyViewsTotal: 0,
      error: err instanceof Error ? err.message : String(err),
    } satisfies YoutubeVideoSnapshotRunSummary;
    await finishDailySnapshotRunLog(runLogId, {
      status: summary.status,
      expectedCount: summary.videos,
      fetchedCount: summary.fetched,
      savedCount: summary.saved,
      missingCount: summary.missing,
      dateRows: summary.dateRows,
      totalDailyValue: summary.dailyViewsTotal,
      error: summary.error,
    });
    return summary;
  } finally {
    client.release();
  }
}

function scheduleInitialRun() {
  const delay = Number(process.env["YOUTUBE_VIDEO_TRACKER_STARTUP_DELAY_MS"] ?? "420000");
  setTimeout(() => {
    if (isScheduledHour()) {
      void runDailyYoutubeVideoSnapshots("startup");
    }
  }, Math.max(0, delay)).unref();
}

export function startYoutubeVideoTrackerScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (!automationEnabled()) {
    logger.info("[youtube-video:snapshots] automation disabled; set YOUTUBE_VIDEO_TRACKER_AUTOMATION=true to enable");
    return;
  }

  scheduleInitialRun();
  schedulerTimer = setInterval(() => {
    if (isScheduledHour()) {
      void runDailyYoutubeVideoSnapshots("hourly-check");
    }
  }, CHECK_MS);
  schedulerTimer.unref();

  logger.info({ hourUtc: scheduledHourUtc() }, "[youtube-video:snapshots] automation enabled");
}
