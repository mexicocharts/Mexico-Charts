import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";
import { ensureYoutubeVideoTrackerTables } from "./youtube-video-tracker-create-tables";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

type PoolLike = InstanceType<typeof Pool>;

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

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    snapshotDate: args.get("date") ?? new Date().toISOString().slice(0, 10),
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 5000), 50000)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    write: args.get("write") === "true",
  };
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

async function fetchYoutubeVideos(videoIds: string[]): Promise<VideoStats[]> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");

  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("maxResults", String(videoIds.length));

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

async function previousViewCount(pool: PoolLike, videoId: string, snapshotDate: string): Promise<number | null> {
  const prev = await pool.query<{ view_count: string | number | null }>(
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

async function saveSnapshot(pool: PoolLike, stats: VideoStats, snapshotDate: string): Promise<number | null> {
  const previous = stats.viewCount == null ? null : await previousViewCount(pool, stats.videoId, snapshotDate);
  const dailyDelta = stats.viewCount == null || previous == null ? null : Math.max(0, stats.viewCount - previous);

  await pool.query(
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

  await pool.query(
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

async function rebuildArtistRollups(pool: PoolLike, snapshotDate: string) {
  await pool.query(
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

async function main() {
  const { snapshotDate, limit, offset, write } = parseArgs();
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await ensureYoutubeVideoTrackerTables(pool);
    const videoRows = await pool.query<VideoRow>(
      `
        SELECT l.video_id
        FROM youtube_artist_video_links l
        WHERE l.active = true
        GROUP BY l.video_id
        ORDER BY max(l.priority) DESC, l.video_id
        OFFSET $1
        LIMIT $2
      `,
      [offset, limit],
    );

    let fetched = 0;
    let saved = 0;
    let missing = 0;
    let dailyViewsTotal = 0;

    console.log(`${write ? "Writing" : "Dry run"} YouTube video daily snapshots: date=${snapshotDate} videos=${videoRows.rows.length}`);

    for (const group of batch(videoRows.rows, 50)) {
      const statsRows = await fetchYoutubeVideos(group.map(row => row.video_id));
      fetched += statsRows.length;
      const statsById = new Map(statsRows.map(stats => [stats.videoId, stats]));

      for (const row of group) {
        const stats = statsById.get(row.video_id);
        if (!stats) {
          missing += 1;
          console.log(`MISSING,${row.video_id}`);
          continue;
        }

        const delta = write ? await saveSnapshot(pool, stats, snapshotDate) : null;
        saved += write ? 1 : 0;
        dailyViewsTotal += delta ?? 0;
        console.log(`${write ? "SAVE" : "SNAPSHOT"},${stats.videoId},views=${stats.viewCount ?? ""},daily=${delta ?? ""},title=${stats.title}`);
      }
    }

    if (write) await rebuildArtistRollups(pool, snapshotDate);

    const dateRows = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM youtube_video_daily_snapshots WHERE snapshot_date = $1",
      [snapshotDate],
    );
    const rollupRows = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM youtube_artist_video_daily_rollups WHERE snapshot_date = $1",
      [snapshotDate],
    );
    console.log(`Done. fetched=${fetched} saved=${saved} missing=${missing} date_rows=${dateRows.rows[0]?.count ?? 0} rollups=${rollupRows.rows[0]?.count ?? 0} daily_views_total=${dailyViewsTotal}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
