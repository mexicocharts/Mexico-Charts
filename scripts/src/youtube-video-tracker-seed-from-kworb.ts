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

interface SnapshotRow {
  artist_key: string;
  artist_name: string | null;
  value: {
    topVideos?: Array<{
      title?: string;
      videoId?: string | null;
      thumbnailUrl?: string | null;
      views?: number | string | null;
      daily?: number | string | null;
      published?: string | null;
    }>;
  };
}

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    artist: args.get("artist")?.trim().toLowerCase() || null,
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 1000), 5000)),
    write: args.get("write") === "true",
  };
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function publishedToDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function upsertVideo(pool: PoolLike, row: SnapshotRow, video: NonNullable<SnapshotRow["value"]["topVideos"]>[number]) {
  const videoId = video.videoId?.trim();
  if (!videoId) return false;

  const publishedAt = publishedToDate(video.published);
  const viewCount = asNumber(video.views);
  const metadata = {
    seedSource: "kworb_top_videos",
    kworbDailyViews: asNumber(video.daily),
    kworbPublishedText: video.published ?? null,
  };

  await pool.query(
    `
      INSERT INTO youtube_tracked_videos (
        video_id, title, thumbnail_url, published_at, view_count, metadata, last_seen_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,now(),now())
      ON CONFLICT (video_id) DO UPDATE SET
        title = COALESCE(NULLIF(excluded.title, ''), youtube_tracked_videos.title),
        thumbnail_url = COALESCE(excluded.thumbnail_url, youtube_tracked_videos.thumbnail_url),
        published_at = COALESCE(excluded.published_at, youtube_tracked_videos.published_at),
        view_count = COALESCE(excluded.view_count, youtube_tracked_videos.view_count),
        metadata = youtube_tracked_videos.metadata || excluded.metadata,
        last_seen_at = now(),
        updated_at = now()
    `,
    [videoId, video.title ?? "", video.thumbnailUrl ?? null, publishedAt, viewCount, JSON.stringify(metadata)],
  );

  await pool.query(
    `
      INSERT INTO youtube_artist_video_links (
        artist_key, artist_name, video_id, source_type, confidence_score, priority, active, metadata, updated_at
      )
      VALUES ($1,$2,$3,'kworb_top_videos',88,80,true,$4::jsonb,now())
      ON CONFLICT (artist_key, video_id) DO UPDATE SET
        artist_name = COALESCE(NULLIF(excluded.artist_name, ''), youtube_artist_video_links.artist_name),
        source_type = excluded.source_type,
        confidence_score = GREATEST(youtube_artist_video_links.confidence_score, excluded.confidence_score),
        priority = GREATEST(youtube_artist_video_links.priority, excluded.priority),
        active = true,
        metadata = youtube_artist_video_links.metadata || excluded.metadata,
        updated_at = now()
    `,
    [
      row.artist_key,
      row.artist_name ?? row.artist_key,
      videoId,
      JSON.stringify({ seedSource: "kworb_top_videos", title: video.title ?? "", views: viewCount }),
    ],
  );

  return true;
}

async function main() {
  const { artist, limit, write } = parseArgs();
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await ensureYoutubeVideoTrackerTables(pool);
    const rows = await pool.query<SnapshotRow>(
      `
        SELECT s.artist_key, c.artist_name, s.value
        FROM kworb_snapshots s
        LEFT JOIN kworb_coverage c ON c.artist_key = s.artist_key
        WHERE s.metric_type = 'youtube'
          AND ($1::text IS NULL OR lower(s.artist_key) = $1)
        ORDER BY s.fetched_at DESC NULLS LAST, s.artist_key
        LIMIT $2
      `,
      [artist, limit],
    );

    let seenVideos = 0;
    let savedVideos = 0;
    let skippedMissingId = 0;
    console.log(`${write ? "Writing" : "Dry run"} YouTube video tracker seed from Kworb: artists=${rows.rows.length}`);

    for (const row of rows.rows) {
      for (const video of row.value?.topVideos ?? []) {
        seenVideos += 1;
        if (!video.videoId?.trim()) {
          skippedMissingId += 1;
          continue;
        }
        if (write) {
          if (await upsertVideo(pool, row, video)) savedVideos += 1;
        } else {
          console.log(`SEED,${row.artist_key},${video.videoId},${video.title ?? ""},views=${video.views ?? ""}`);
        }
      }
    }

    console.log(`Done. seen=${seenVideos} saved=${savedVideos} missing_video_id=${skippedMissingId}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
