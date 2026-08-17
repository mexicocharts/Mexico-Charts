import { pool } from "@workspace/db";
import { logger } from "./logger";
import { ensureMexicanIdentityTables, runMexicanIdentityDiscovery } from "./mexican-identity-discovery-service";

const LOCK_KEY = 831_905_226;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 60 * 1000;
let started = false;

function dateEt(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function runScheduledMexicanIdentityDiscovery() {
  const date = dateEt();
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) return { date, status: "locked" as const };
    await ensureMexicanIdentityTables();
    await client.query(`CREATE TABLE IF NOT EXISTS mexican_identity_discovery_runs (
      run_date text PRIMARY KEY, completed_at timestamptz NOT NULL DEFAULT now(), summary jsonb NOT NULL DEFAULT '{}'::jsonb
    )`);
    const prior = await client.query<{ summary: { catalogComplete?: boolean } }>(
      "SELECT summary FROM mexican_identity_discovery_runs WHERE run_date = $1",
      [date],
    );
    if (prior.rows[0]?.summary?.catalogComplete === true) {
      return { date, status: "already_complete" as const };
    }
    const limit = Math.max(1, Number(process.env["MEXICAN_IDENTITY_DAILY_LIMIT"] ?? 500));
    const summary = await runMexicanIdentityDiscovery(limit);
    const completedSummary = { ...summary, catalogComplete: summary.checked < limit };
    await client.query(`INSERT INTO mexican_identity_discovery_runs(run_date, summary) VALUES ($1,$2::jsonb)
      ON CONFLICT (run_date) DO UPDATE SET completed_at = now(), summary = excluded.summary`,
      [date, JSON.stringify(completedSummary)]);
    return { date, status: "complete" as const, summary: completedSummary };
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

async function check() {
  try { await runScheduledMexicanIdentityDiscovery(); }
  catch (error) {
    logger.error({ error }, "[mexican-identity-discovery] daily run failed; retrying soon");
    const retry = setTimeout(() => void check(), RETRY_INTERVAL_MS);
    retry.unref();
  }
}

export function startMexicanIdentityDiscoveryScheduler(): void {
  if (started || process.env["MEXICAN_IDENTITY_DISCOVERY_AUTOMATION_DISABLED"] === "true") return;
  started = true;
  const initial = setTimeout(() => void check(), 30_000);
  initial.unref();
  const interval = setInterval(() => void check(), CHECK_INTERVAL_MS);
  interval.unref();
}
