import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    end: () => Promise<void>;
  };
};

async function main() {
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spotify_artists (
        artist_key text PRIMARY KEY,
        spotify_artist_id text NOT NULL UNIQUE,
        spotify_name text,
        spotify_followers integer,
        spotify_popularity integer,
        spotify_url text,
        spotify_image_url text,
        spotify_uri text,
        spotify_genres jsonb NOT NULL DEFAULT '[]'::jsonb,
        spotify_api_capability text NOT NULL DEFAULT 'identity_profile',
        notes text,
        verified boolean NOT NULL DEFAULT true,
        verified_at timestamptz NOT NULL DEFAULT now(),
        spotify_last_updated timestamptz NOT NULL DEFAULT now(),
        linked_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      ALTER TABLE spotify_artists
      ADD COLUMN IF NOT EXISTS spotify_uri text;
    `);

    await pool.query(`
      ALTER TABLE spotify_artists
      ADD COLUMN IF NOT EXISTS spotify_api_capability text NOT NULL DEFAULT 'identity_profile';
    `);

    await pool.query(`
      ALTER TABLE spotify_artists
      ADD COLUMN IF NOT EXISTS notes text;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS spotify_artist_candidates (
        artist_key text PRIMARY KEY,
        artist_name text NOT NULL,
        candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
        best_score integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'review',
        searched_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS spotify_artist_candidates_status_idx
      ON spotify_artist_candidates (status);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS spotify_artists_last_updated_idx
      ON spotify_artists (spotify_last_updated);
    `);

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('spotify_artists', 'spotify_artist_candidates')
      ORDER BY table_name;
    `);
    console.log(`Spotify tables ready: ${tables.rows.map(row => (row as { table_name: string }).table_name).join(", ")}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
