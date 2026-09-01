import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: (sql: string) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  };
};

async function main() {
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS musicbrainz_artists (
        artist_key text PRIMARY KEY,
        mbid text NOT NULL UNIQUE,
        name text,
        sort_name text,
        disambiguation text,
        type text,
        country text,
        area_name text,
        begin_date text,
        end_date text,
        aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
        tags jsonb NOT NULL DEFAULT '[]'::jsonb,
        relations jsonb NOT NULL DEFAULT '[]'::jsonb,
        verified text NOT NULL DEFAULT 'auto',
        last_updated timestamptz NOT NULL DEFAULT now(),
        linked_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS musicbrainz_artist_candidates (
        artist_key text PRIMARY KEY,
        artist_name text NOT NULL,
        candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
        best_score integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'review',
        searched_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS musicbrainz_artist_candidates_status_idx
      ON musicbrainz_artist_candidates (status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS musicbrainz_artists_last_updated_idx
      ON musicbrainz_artists (last_updated);
    `);

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('musicbrainz_artists', 'musicbrainz_artist_candidates')
      ORDER BY table_name;
    `);
    console.log(`MusicBrainz tables ready: ${tables.rows.map(row => (row as { table_name: string }).table_name).join(", ")}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
