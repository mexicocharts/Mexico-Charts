import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  };
};

type PoolLike = InstanceType<typeof Pool>;

export async function ensureYoutubeVideoTrackerTables(pool: PoolLike) {
  await pool.query(`
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

  await pool.query(`
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

  await pool.query(`
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

  await pool.query(`
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

  await pool.query(`CREATE INDEX IF NOT EXISTS youtube_tracked_videos_channel_idx ON youtube_tracked_videos(channel_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS youtube_tracked_videos_updated_idx ON youtube_tracked_videos(updated_at);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS youtube_artist_video_links_artist_video_unique ON youtube_artist_video_links(artist_key, video_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_links_artist_idx ON youtube_artist_video_links(artist_key);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_links_video_idx ON youtube_artist_video_links(video_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_links_active_priority_idx ON youtube_artist_video_links(active, priority);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS youtube_video_daily_snapshots_video_date_unique ON youtube_video_daily_snapshots(video_id, snapshot_date);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS youtube_video_daily_snapshots_date_idx ON youtube_video_daily_snapshots(snapshot_date);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS youtube_video_daily_snapshots_video_date_idx ON youtube_video_daily_snapshots(video_id, snapshot_date);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS youtube_artist_video_daily_rollups_artist_date_unique ON youtube_artist_video_daily_rollups(artist_key, snapshot_date);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_daily_rollups_date_idx ON youtube_artist_video_daily_rollups(snapshot_date);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS youtube_artist_video_daily_rollups_artist_date_idx ON youtube_artist_video_daily_rollups(artist_key, snapshot_date);`);
}

async function main() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await ensureYoutubeVideoTrackerTables(pool);
    console.log("YouTube video tracker tables are ready.");
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
