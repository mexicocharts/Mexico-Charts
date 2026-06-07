import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  };
};

type PoolLike = InstanceType<typeof Pool>;

export async function ensureYoutubeKworbDailySnapshotTable(pool: PoolLike) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS youtube_kworb_daily_snapshots (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      snapshot_date text NOT NULL,
      source_type text NOT NULL DEFAULT 'kworb_youtube_artist',
      total_views bigint,
      daily_views bigint,
      video_count integer,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS youtube_kworb_daily_snapshots_artist_date_unique
    ON youtube_kworb_daily_snapshots (artist_key, snapshot_date);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS youtube_kworb_daily_snapshots_artist_date_idx
    ON youtube_kworb_daily_snapshots (artist_key, snapshot_date);
  `);
}

async function main() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await ensureYoutubeKworbDailySnapshotTable(pool);
    const count = await pool.query(`
      SELECT count(*)::integer AS rows
      FROM youtube_kworb_daily_snapshots;
    `);
    const rows = (count.rows[0] as { rows?: number } | undefined)?.rows ?? 0;
    console.log(`YouTube Kworb daily snapshot table ready: ${rows} rows.`);
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
