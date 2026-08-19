import { getTableName } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

function declaredTableNames(): Set<string> {
  const names = new Set<string>();
  for (const value of Object.values(schema)) {
    try {
      names.add(getTableName(value as Parameters<typeof getTableName>[0]));
    } catch {
      // Schema modules also export inferred TypeScript types and helpers.
    }
  }
  return names;
}

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL must be set for the schema preflight");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<{ tablename: string }>(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    const declared = declaredTableNames();
    const orphaned = result.rows
      .map(row => row.tablename)
      .filter(name => !declared.has(name) && name !== "__drizzle_migrations");

    if (orphaned.length > 0) {
      throw new Error(
        `Unsafe database drift: declare these live tables in lib/db/src/schema before publishing: ${orphaned.join(", ")}`,
      );
    }

    console.log(`Schema preflight passed: ${result.rowCount ?? 0} live tables are protected.`);
  } finally {
    await pool.end();
  }
}

await main();
