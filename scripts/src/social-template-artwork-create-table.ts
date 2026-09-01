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
      CREATE TABLE IF NOT EXISTS social_template_artwork (
        template_key text NOT NULL,
        entity_type text NOT NULL,
        entity_key text NOT NULL,
        display_title text NOT NULL,
        display_artist text NOT NULL DEFAULT '',
        image_url text NOT NULL,
        image_data bytea,
        image_content_type text,
        source text NOT NULL,
        first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (template_key, entity_type, entity_key)
      );
    `);

    await pool.query(`
      ALTER TABLE social_template_artwork
      ADD COLUMN IF NOT EXISTS image_data bytea;
    `);

    await pool.query(`
      ALTER TABLE social_template_artwork
      ADD COLUMN IF NOT EXISTS image_content_type text;
    `);

    await pool.query(`
      ALTER TABLE social_template_artwork
      ADD COLUMN IF NOT EXISTS display_artist text NOT NULL DEFAULT '';
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS social_template_artwork_entity_idx
      ON social_template_artwork (entity_type, entity_key);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS social_template_artwork_seen_idx
      ON social_template_artwork (template_key, last_seen_at);
    `);

    const count = await pool.query(`
      SELECT count(*)::integer AS rows
      FROM social_template_artwork;
    `);
    const rows = (count.rows[0] as { rows?: number } | undefined)?.rows ?? 0;
    console.log(`Social template artwork table ready: ${rows} cached rows.`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
