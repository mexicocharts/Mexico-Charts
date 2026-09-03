import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { databaseUrlConfiguration, resolveDatabaseUrl } from "./database-url.mjs";
import {
  defaultPoolOptions,
  monitoringReadPoolOptions,
  publicReadPoolOptions,
  schemaBootstrapPoolOptions,
} from "./pool-config";
import * as schema from "./schema";

const { Pool } = pg;
export type { Pool as PgPool, PoolClient, QueryResultRow } from "pg";

const databaseUrl = resolveDatabaseUrl();
export const databaseTargetConfiguration = Object.freeze(databaseUrlConfiguration());

export const pool = new Pool({
  connectionString: databaseUrl,
  ...defaultPoolOptions,
});

// Long-running collectors intentionally keep clients checked out while they
// coordinate API and database work. Keep a small, bounded pool reserved for
// latency-sensitive public reads so a busy collector cannot starve HTTP
// requests. The application name also makes these sessions identifiable in
// production database diagnostics.
export const publicReadPool = new Pool({
  connectionString: databaseUrl,
  ...publicReadPoolOptions,
});

// Artist Pro is a paid, latency-sensitive product. Keep its authenticated
// reads isolated from public readiness and YouTube traffic so public scans
// cannot consume every connection required to authorize and render a Monitor.
export const monitoringReadPool = new Pool({
  connectionString: databaseUrl,
  ...monitoringReadPoolOptions,
});

export const publicReadDb = drizzle(publicReadPool, { schema });

export function createSchemaBootstrapPool() {
  return new Pool({
    connectionString: databaseUrl,
    ...schemaBootstrapPoolOptions,
  });
}

// The five-minute YouTube observation collector must keep one client while it
// coordinates quota accounting, API reads, and atomic snapshot writes. Give
// that job one bounded connection so unrelated startup collectors cannot leave
// its scheduler tick waiting indefinitely on the shared application pool.
export const youtubeCollectorPool = new Pool({
  connectionString: databaseUrl,
  application_name: "mexico-charts-youtube-collector",
  max: 1,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

// Coverage maintenance is deliberately isolated from both observation writes
// and public reads. A slow summary refresh can therefore neither postpone a
// collector commit nor occupy the public monitor's small latency pool.
export const youtubeCoveragePool = new Pool({
  connectionString: databaseUrl,
  application_name: "mexico-charts-youtube-coverage",
  max: 1,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});

// Protected discovery validation performs a long, advisory-locked comparison
// pass. Isolate its single connection so unrelated API/startup work cannot
// prevent the scheduled snapshot from reaching the database.
export const youtubeValidationPool = new Pool({
  connectionString: databaseUrl,
  application_name: "mexico-charts-youtube-validation",
  max: 1,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });

export * from "./pool-config";
export * from "./schema";
