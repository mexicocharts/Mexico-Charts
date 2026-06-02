import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  };
};

async function main() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chart_snapshots (
        id serial PRIMARY KEY,
        source text NOT NULL,
        chart_type text NOT NULL,
        country text NOT NULL DEFAULT 'MX',
        chart_date text NOT NULL,
        imported_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS chart_snapshots_source_chart_country_date_unique
      ON chart_snapshots (source, chart_type, country, chart_date);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS chart_snapshots_chart_date_idx
      ON chart_snapshots (chart_date);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chart_snapshot_rows (
        id serial PRIMARY KEY,
        snapshot_id integer NOT NULL REFERENCES chart_snapshots(id) ON DELETE CASCADE,
        rank integer NOT NULL,
        title text NOT NULL DEFAULT '',
        artist_names jsonb NOT NULL DEFAULT '[]'::jsonb,
        external_song_id text,
        external_artist_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS chart_snapshot_rows_snapshot_rank_unique
      ON chart_snapshot_rows (snapshot_id, rank);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS chart_snapshot_rows_snapshot_idx
      ON chart_snapshot_rows (snapshot_id);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS artist_candidates (
        id serial PRIMARY KEY,
        artist_name text NOT NULL,
        normalized_name text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        confidence_score integer NOT NULL DEFAULT 0,
        first_seen_date text,
        last_seen_date text,
        total_appearances integer NOT NULL DEFAULT 0,
        source_count integer NOT NULL DEFAULT 0,
        notes text,
        matched_artist_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS artist_candidates_normalized_name_unique
      ON artist_candidates (normalized_name);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS artist_candidates_status_idx
      ON artist_candidates (status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS artist_candidates_confidence_idx
      ON artist_candidates (confidence_score);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS official_artists (
        artist_key text PRIMARY KEY,
        artist_name text NOT NULL,
        normalized_name text NOT NULL,
        source text NOT NULL DEFAULT 'manual_discovery_review',
        discovery_candidate_id integer REFERENCES artist_candidates(id) ON DELETE SET NULL,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS official_artists_normalized_name_unique
      ON official_artists (normalized_name);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS official_artists_discovery_candidate_idx
      ON official_artists (discovery_candidate_id);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS artist_candidate_audit_entries (
        id serial PRIMARY KEY,
        candidate_id integer NOT NULL REFERENCES artist_candidates(id) ON DELETE CASCADE,
        action text NOT NULL,
        artist_key text,
        previous_status text,
        next_status text,
        note text,
        actor text NOT NULL DEFAULT 'admin',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS artist_candidate_audit_entries_candidate_idx
      ON artist_candidate_audit_entries (candidate_id, created_at DESC);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS artist_candidate_events (
        id serial PRIMARY KEY,
        candidate_id integer NOT NULL REFERENCES artist_candidates(id) ON DELETE CASCADE,
        source text NOT NULL,
        chart_type text NOT NULL,
        chart_date text NOT NULL,
        rank integer,
        song_or_video_title text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS artist_candidate_events_candidate_idx
      ON artist_candidate_events (candidate_id);
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS artist_candidate_events_candidate_source_chart_date_rank_title_unique
      ON artist_candidate_events (candidate_id, source, chart_type, chart_date, rank, song_or_video_title);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS artist_candidate_signals (
        id serial PRIMARY KEY,
        candidate_id integer NOT NULL REFERENCES artist_candidates(id) ON DELETE CASCADE,
        signal_type text NOT NULL,
        source text NOT NULL,
        value text NOT NULL,
        confidence_weight integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS artist_candidate_signals_candidate_idx
      ON artist_candidate_signals (candidate_id);
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS artist_candidate_signals_candidate_type_source_value_unique
      ON artist_candidate_signals (candidate_id, signal_type, source, value);
    `);

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'chart_snapshots',
          'chart_snapshot_rows',
          'artist_candidates',
          'artist_candidate_events',
          'artist_candidate_signals',
          'artist_candidate_audit_entries',
          'official_artists'
        )
      ORDER BY table_name;
    `);

    console.log(`Artist discovery tables ready: ${tables.rows.map(row => (row as { table_name: string }).table_name).join(", ")}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
