import { pool } from "@workspace/db";
import { logger } from "./logger";

const CHECK_MS = 60 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;
const ISO_WEEK_DEDUPE_PREFIX = "touring-weekly-summary:";
let started = false;

function configured() {
  return Boolean(process.env["RESEND_API_KEY"]?.trim() && process.env["RESEND_FROM_EMAIL"]?.trim());
}

function isoWeek(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  const monday = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate() - 3));
  return {
    key: `${year}-W${String(week).padStart(2, "0")}`,
    weekStart: monday.toISOString().slice(0, 10),
  };
}

async function ensureTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS touring_weekly_summaries (
    week_start date PRIMARY KEY, generated_at timestamptz NOT NULL DEFAULT now(),
    summary jsonb NOT NULL DEFAULT '{}'::jsonb, delivery_status text NOT NULL DEFAULT 'not_configured',
    delivered_at timestamptz, last_error text
  );
  CREATE TABLE IF NOT EXISTS touring_alert_outbox (
    id bigserial PRIMARY KEY, alert_type text NOT NULL, artist_id text, artist_name text,
    title text NOT NULL, message text NOT NULL, source_url text, event_id text,
    dedupe_key text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz, last_error text, recipient_count integer NOT NULL DEFAULT 0,
    last_attempt_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE touring_alert_outbox ADD COLUMN IF NOT EXISTS recipient_count integer NOT NULL DEFAULT 0;
  ALTER TABLE touring_alert_outbox ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;`);
}

async function eligibleRecipientCount() {
  const result = await pool.query<{ count: number }>(`SELECT count(DISTINCT email)::int count FROM (
    SELECT email FROM newsletter_subscribers WHERE status='active' AND source='touring'
    UNION
    SELECT u.email FROM touring_watchlists w
      JOIN user_accounts u ON u.clerk_user_id=w.clerk_user_id
      WHERE w.daily_digest=true AND u.email IS NOT NULL
  ) recipients WHERE trim(email) <> ''`);
  return Number(result.rows[0]?.count ?? 0);
}

export async function generateAndQueueTouringWeeklySummary(now = new Date()) {
  await ensureTables();
  if (!configured()) return { status: "disabled", reason: "missing_resend_configuration" } as const;
  const recipientCount = await eligibleRecipientCount();
  if (recipientCount === 0) return { status: "skipped", reason: "no_eligible_recipients" } as const;

  const { key, weekStart } = isoWeek(now);
  const [events, changes] = await Promise.all([
    pool.query(`SELECT count(*)::int events,count(DISTINCT artist_id)::int artists,
      count(DISTINCT city) FILTER (WHERE city IS NOT NULL)::int markets
      FROM touring_tm_events WHERE event_kind='concert' AND event_date>=current_date AND event_date<current_date+14`),
    pool.query(`SELECT count(*)::int changes FROM touring_review_queue WHERE created_at>=now()-interval '7 days'`),
  ]);
  const summary = {
    period: "last 7 days",
    upcoming14Days: events.rows[0],
    newReviewItems: changes.rows[0],
    sourcePolicy: "Public authorized metadata only; no inventory, sell-through or ticket sales.",
  };
  const result = await pool.query<{ id: string }>(`INSERT INTO touring_weekly_summaries(week_start,summary,delivery_status)
    VALUES($1,$2,'pending_delivery')
    ON CONFLICT(week_start) DO NOTHING RETURNING week_start`, [weekStart, JSON.stringify(summary)]);
  if (!result.rows.length) return { status: "already_queued", weekStart, dedupeKey: `${ISO_WEEK_DEDUPE_PREFIX}${key}` } as const;

  await pool.query(`INSERT INTO touring_alert_outbox(alert_type,artist_id,artist_name,title,message,dedupe_key)
    VALUES('weekly_summary',NULL,'Mexico Charts Touring',$1,$2,$3)
    ON CONFLICT(dedupe_key) DO NOTHING`, [
    `Resumen semanal de Touring · ${key}`,
    `Cambios y próximos eventos de Touring de los últimos 7 días.\n\n${JSON.stringify(summary, null, 2)}`,
    `${ISO_WEEK_DEDUPE_PREFIX}${key}`,
  ]);
  return { status: "queued", weekStart, dedupeKey: `${ISO_WEEK_DEDUPE_PREFIX}${key}`, recipientCount } as const;
}

async function check() {
  try {
    const result = await generateAndQueueTouringWeeklySummary();
    if (result.status !== "disabled") logger.info(result, "[touring-weekly] summary scheduling complete");
  } catch (error) {
    logger.error({ error }, "[touring-weekly] summary scheduling failed");
  }
}

export function startTouringWeeklySummaryScheduler() {
  if (started) return;
  started = true;
  setTimeout(() => void check(), INITIAL_DELAY_MS);
  const timer = setInterval(() => void check(), CHECK_MS);
  timer.unref();
}