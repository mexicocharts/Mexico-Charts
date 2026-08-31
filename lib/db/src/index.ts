import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
export type { PoolClient } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Long-running collectors intentionally keep clients checked out while they
// coordinate API and database work. Keep a small, bounded pool reserved for
// latency-sensitive public reads so a busy collector cannot starve HTTP
// requests. The application name also makes these sessions identifiable in
// production database diagnostics.
export const publicReadPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  application_name: "mexico-charts-public-read",
  max: 3,
  connectionTimeoutMillis: 3_000,
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
