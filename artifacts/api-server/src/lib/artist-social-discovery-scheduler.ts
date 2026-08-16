import { pool } from "@workspace/db";
import { logger } from "./logger";
import { runArtistSocialDiscovery } from "./artist-social-discovery-service";

const LOCK_KEY = 831_905_225;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
let started = false;

function dateEt(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function runScheduledArtistSocialDiscovery() {
  const date = dateEt();
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) return { date, status: "locked" as const };
    await client.query(`CREATE TABLE IF NOT EXISTS artist_social_discovery_runs (
      run_date text PRIMARY KEY, completed_at timestamptz NOT NULL DEFAULT now(), summary jsonb NOT NULL DEFAULT '{}'::jsonb
    )`);
    const prior = await client.query("SELECT 1 FROM artist_social_discovery_runs WHERE run_date = $1", [date]);
    if ((prior.rowCount ?? 0) > 0) return { date, status: "already_complete" as const };
    const summary = await runArtistSocialDiscovery();
    await client.query(`INSERT INTO artist_social_discovery_runs(run_date, summary) VALUES ($1,$2::jsonb)
      ON CONFLICT (run_date) DO NOTHING`, [date, JSON.stringify(summary)]);
    return { date, status: "complete" as const, summary };
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}

async function check() {
  try { await runScheduledArtistSocialDiscovery(); }
  catch (error) { logger.error({ error }, "[artist-social-discovery] daily run failed"); }
}

export function startArtistSocialDiscoveryScheduler(): void {
  if (started || process.env["ARTIST_SOCIAL_DISCOVERY_AUTOMATION_DISABLED"] === "true") return;
  started = true;
  setTimeout(() => void check(), 15_000);
  setInterval(() => void check(), CHECK_INTERVAL_MS);
}
