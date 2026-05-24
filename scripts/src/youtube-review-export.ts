import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

async function main() {
  if (!process.env["DATABASE_URL"]) throw new Error("Missing DATABASE_URL.");
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
  try {
    const rows = await pool.query<{
      artist_key: string;
      artist_name: string;
      status: string;
      best_channel_id: string | null;
      best_title: string | null;
      best_score: number | null;
      subscriber_count: string | null;
      reasons: unknown;
    }>(`
      select artist_key, artist_name, status, best_channel_id, best_title,
             best_score, subscriber_count, reasons
      from youtube_channel_candidates
      order by updated_at desc, artist_key
    `);

    for (const row of rows.rows) {
      console.log([
        row.artist_key,
        row.artist_name,
        row.status,
        row.best_score ?? "",
        row.best_channel_id ?? "",
        row.best_title ?? "",
        row.subscriber_count ?? "",
        JSON.stringify(row.reasons ?? []),
      ].join(" | "));
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
