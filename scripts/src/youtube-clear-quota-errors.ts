import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

function parseArgs() {
  const artistKeys = process.argv
    .slice(2)
    .map((arg) => arg.trim())
    .filter(Boolean);

  if (artistKeys.length === 0) {
    throw new Error("Pass one or more artist_key values to clear.");
  }

  return { artistKeys };
}

async function main() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("Missing DATABASE_URL.");

  const { artistKeys } = parseArgs();
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query<{ artist_key: string; status: string }>(
      `delete from youtube_channel_candidates
       where status = 'error'
         and artist_key = any($1::text[])
         and (
           lower(coalesce(error, '')) like '%quota%'
           or lower(coalesce(error, '')) like '%rate limit%'
           or lower(coalesce(error, '')) like '%youtube api 429%'
         )
       returning artist_key, status`,
      [artistKeys],
    );

    console.log(`cleared=${result.rows.length}`);
    for (const row of result.rows) {
      console.log(`CLEARED,${row.artist_key},${row.status}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
