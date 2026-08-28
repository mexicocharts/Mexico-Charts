import { pool } from "@workspace/db";
import { logger } from "./logger";
import { configuredSongstatsMonthlyArtistLimit } from "./songstats-billing-guard";
import {
  ensureSongstatsTables,
  syncSongstatsCurrentStats,
  type SongstatsSyncSummary,
} from "./songstats-snapshot-service";
import { syncSongstatsExtendedData } from "./songstats-extended-service";

const LOCK_KEY = 831_905_224;
const INTELLIGENCE_LOCK_KEY = 831_905_225;
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const RETRY_INTERVAL_MINUTES = 60;
const MAX_DAILY_ATTEMPTS = 6;

let schedulerStarted = false;
let schedulerRunning = false;
let lastStartedAt: string | null = null;
let lastFinishedAt: string | null = null;
let lastError: string | null = null;
let lastResult: unknown = null;
let intelligenceRunning = false;
let intelligenceLastStartedAt: string | null = null;
let intelligenceLastFinishedAt: string | null = null;
let intelligenceLastError: string | null = null;
let intelligenceLastResult: unknown = null;
function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysBefore(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function automationEnabled(): boolean {
  // The old deployment carried SONGSTATS_SNAPSHOT_AUTOMATION=false from the
  // one-time/manual-sync phase. Daily refresh is now the production default;
  // keep a deliberately named emergency kill switch for incident response.
  return process.env["SONGSTATS_SNAPSHOT_AUTOMATION_DISABLED"] !== "true";
}

function scheduledHourEt(): number {
  const parsed = Number(process.env["SONGSTATS_SNAPSHOT_HOUR_ET"] ?? "7");
  return Number.isFinite(parsed) ? Math.max(0, Math.min(23, Math.floor(parsed))) : 7;
}

function currentHourEt(): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date()));
}

function syncLimit(): number {
  return configuredSongstatsMonthlyArtistLimit();
}

async function snapshotProgress(
  snapshotDate: string,
  limit: number,
): Promise<{ saved: number; target: number; remainingArtistKeys: string[] }> {
  await ensureSongstatsTables();
  const result = await pool.query<{
    saved: number;
    target: number;
    remaining_artist_keys: string[] | null;
  }>(
    `
      WITH target_artists AS (
        SELECT c.artist_key
        FROM kworb_coverage c
        LEFT JOIN spotify_artists s ON s.artist_key = c.artist_key
        WHERE COALESCE(c.spotify_id, s.spotify_artist_id) IS NOT NULL
          AND (COALESCE(c.has_spotify, false) = true OR s.spotify_artist_id IS NOT NULL)
          AND COALESCE(c.songstats_eligible, true) = true
        ORDER BY c.tier, c.artist_key
        LIMIT $2
      ), completed AS (
        SELECT DISTINCT snapshots.artist_key
        FROM songstats_artist_daily_snapshots snapshots
        INNER JOIN target_artists targets ON targets.artist_key = snapshots.artist_key
        WHERE snapshots.snapshot_date = $1
      )
      SELECT
        (SELECT count(*)::int FROM completed) AS saved,
        (SELECT count(*)::int FROM target_artists) AS target,
        COALESCE(
          (
            SELECT json_agg(targets.artist_key ORDER BY targets.artist_key)
            FROM target_artists targets
            LEFT JOIN completed ON completed.artist_key = targets.artist_key
            WHERE completed.artist_key IS NULL
          ),
          '[]'::json
        ) AS remaining_artist_keys
    `,
    [snapshotDate, limit],
  );
  return {
    saved: result.rows[0]?.saved ?? 0,
    target: result.rows[0]?.target ?? 0,
    remainingArtistKeys: result.rows[0]?.remaining_artist_keys ?? [],
  };
}

async function claimDailyAttempt(snapshotDate: string): Promise<{
  claimed: boolean;
  attempts: number;
  nextRetryAt: string | null;
  reason?: "cooldown" | "attempts_exhausted";
}> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_snapshot_scheduler_runs (
      snapshot_date text PRIMARY KEY,
      attempt_count integer NOT NULL DEFAULT 0,
      last_attempt_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const existing = await pool.query<{
    attempt_count: number;
    last_attempt_at: Date | null;
  }>(
    `SELECT attempt_count, last_attempt_at
     FROM songstats_snapshot_scheduler_runs
     WHERE snapshot_date = $1`,
    [snapshotDate],
  );
  const attempts = existing.rows[0]?.attempt_count ?? 0;
  const lastAttemptAt = existing.rows[0]?.last_attempt_at ?? null;
  const nextRetryAt = lastAttemptAt
    ? new Date(lastAttemptAt.getTime() + RETRY_INTERVAL_MINUTES * 60_000)
    : null;
  if (attempts >= MAX_DAILY_ATTEMPTS) {
    return {
      claimed: false,
      attempts,
      nextRetryAt: null,
      reason: "attempts_exhausted",
    };
  }
  if (nextRetryAt && nextRetryAt.getTime() > Date.now()) {
    return {
      claimed: false,
      attempts,
      nextRetryAt: nextRetryAt.toISOString(),
      reason: "cooldown",
    };
  }
  const claimed = await pool.query<{ attempt_count: number }>(
    `
      INSERT INTO songstats_snapshot_scheduler_runs (
        snapshot_date, attempt_count, last_attempt_at, updated_at
      ) VALUES ($1, 1, now(), now())
      ON CONFLICT (snapshot_date) DO UPDATE SET
        attempt_count = songstats_snapshot_scheduler_runs.attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
      RETURNING attempt_count
    `,
    [snapshotDate],
  );
  return {
    claimed: true,
    attempts: claimed.rows[0]?.attempt_count ?? attempts + 1,
    nextRetryAt: null,
  };
}

export async function runScheduledSongstatsSnapshot(): Promise<
  SongstatsSyncSummary | { snapshotDate: string; status: "already_complete" | "locked" | "too_early" | "cooldown" | "attempts_exhausted" }
> {
  const snapshotDate = todayIso();
  if (currentHourEt() < scheduledHourEt()) {
    return { snapshotDate, status: "too_early" };
  }

  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [LOCK_KEY],
    );
    locked = lock.rows[0]?.locked === true;
    if (!locked) return { snapshotDate, status: "locked" };
    const attempt = await claimDailyAttempt(snapshotDate);
    if (!attempt.claimed) {
      lastResult = {
        snapshotDate,
        status: attempt.reason,
        attempts: attempt.attempts,
        nextRetryAt: attempt.nextRetryAt,
      };
      return { snapshotDate, status: attempt.reason! };
    }
    schedulerRunning = true;
    lastStartedAt = new Date().toISOString();
    lastError = null;

    const limit = syncLimit();
    const progress = await snapshotProgress(snapshotDate, limit);
    const currentComplete = progress.target > 0 && progress.saved >= progress.target;
    const summary = currentComplete
      ? null
      : await syncSongstatsCurrentStats({ limit, snapshotDate });
    if (summary) {
      logger.info(
        {
          snapshotDate,
          requested: summary.requested,
          saved: summary.saved,
          failed: summary.failed,
        },
        "[songstats] daily current-stats snapshot complete",
      );
    }

    // The public growth cards are calculated from historic_stats. Refresh the
    // same 90-day series every day so their headline value and the audience
    // cards are based on one synchronized Songstats response for every artist.
    const historic = await syncSongstatsExtendedData({
      limit,
      endpoints: ["historic"],
      historyStartDate: daysBefore(snapshotDate, 90),
      historyEndDate: snapshotDate,
      countryCode: "MX",
      audienceDetailsSources: [],
      catalogLimit: 1,
    });
    logger.info(
      {
        snapshotDate,
        requested: historic.requested,
        saved: historic.saved,
        partial: historic.partial,
        failed: historic.failed,
      },
      "[songstats] daily historic-stats refresh complete",
    );

    const result = summary ?? { snapshotDate, status: "already_complete" as const };
    const finalProgress = await snapshotProgress(snapshotDate, limit);
    lastResult = {
      snapshotDate,
      current: {
        status: summary ? "processed" : "already_complete",
        requested: summary?.requested ?? 0,
        saved: finalProgress.saved,
        target: finalProgress.target,
        remaining: finalProgress.remainingArtistKeys.length,
        remainingArtistKeys: finalProgress.remainingArtistKeys,
        failedThisAttempt: summary?.failed ?? 0,
        failedArtistKeys: summary?.results
          .filter(item => item.status === "failed")
          .map(item => item.artistKey) ?? [],
      },
      historic: {
        requested: historic.requested,
        saved: historic.saved,
        partial: historic.partial,
        failed: historic.failed,
        incompleteArtistKeys: historic.results
          .filter(item => item.status !== "saved")
          .map(item => item.artistKey),
      },
    };
    return result;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    if (locked) {
      schedulerRunning = false;
      lastFinishedAt = new Date().toISOString();
    }
    if (locked) {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => undefined);
    }
    client.release();
  }
}

async function runSongstatsIntelligenceBackfill(): Promise<void> {
  if (intelligenceRunning) return;
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [INTELLIGENCE_LOCK_KEY],
    );
    locked = lock.rows[0]?.locked === true;
    if (!locked) return;

    intelligenceRunning = true;
    intelligenceLastStartedAt = new Date().toISOString();
    intelligenceLastError = null;
    const snapshotDate = todayIso();
    const intelligence = await syncSongstatsExtendedData({
      limit: syncLimit(),
      endpoints: ["audience", "audience_details", "catalog"],
      historyStartDate: daysBefore(snapshotDate, 90),
      historyEndDate: snapshotDate,
      countryCode: "MX",
      audienceDetailsSources: ["spotify"],
      catalogLimit: 100,
      refreshAfter: daysBefore(snapshotDate, 30),
    });
    intelligenceLastResult = {
      snapshotDate,
      requested: intelligence.requested,
      saved: intelligence.saved,
      partial: intelligence.partial,
      failed: intelligence.failed,
      incompleteArtistKeys: intelligence.results
        .filter(item => item.status !== "saved")
        .map(item => item.artistKey),
    };
    logger.info(intelligenceLastResult, "[songstats] full artist-intelligence backfill complete");
  } catch (error) {
    intelligenceLastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    intelligenceRunning = false;
    intelligenceLastFinishedAt = new Date().toISOString();
    if (locked) {
      await client.query("SELECT pg_advisory_unlock($1)", [INTELLIGENCE_LOCK_KEY]).catch(() => undefined);
    }
    client.release();
  }
}

export async function getSongstatsSchedulerStatus(): Promise<Record<string, unknown>> {
  const snapshotDate = todayIso();
  const limit = syncLimit();
  const progress = await snapshotProgress(snapshotDate, limit);
  return {
    enabled: automationEnabled(),
    apiKeyConfigured: Boolean(process.env["SONGSTATS_API_KEY"]),
    running: schedulerRunning,
    snapshotDate,
    scheduledHourEt: scheduledHourEt(),
    checkIntervalMinutes: CHECK_INTERVAL_MS / 60_000,
    retryIntervalMinutes: RETRY_INTERVAL_MINUTES,
    maxDailyAttempts: MAX_DAILY_ATTEMPTS,
    target: progress.target,
    saved: progress.saved,
    remaining: Math.max(0, progress.target - progress.saved),
    remainingArtistKeys: progress.remainingArtistKeys,
    lastStartedAt,
    lastFinishedAt,
    lastError,
    lastResult,
    intelligence: {
      running: intelligenceRunning,
      lastStartedAt: intelligenceLastStartedAt,
      lastFinishedAt: intelligenceLastFinishedAt,
      lastError: intelligenceLastError,
      lastResult: intelligenceLastResult,
    },
  };
}

async function scheduledCheck(): Promise<void> {
  if (currentHourEt() < scheduledHourEt()) {
    return;
  }

  try {
    await runSongstatsIntelligenceBackfill();
    await runScheduledSongstatsSnapshot();
  } catch (error) {
    logger.error({ error }, "[songstats] daily snapshot scheduler failed");
  }
}

export function kickSongstatsSnapshotScheduler(): void {
  if (schedulerRunning || !automationEnabled() || !process.env["SONGSTATS_API_KEY"]) {
    return;
  }
  void scheduledCheck();
}

export function startSongstatsSnapshotScheduler(): void {
  if (schedulerStarted || !automationEnabled()) return;
  if (!process.env["SONGSTATS_API_KEY"]) {
    logger.warn("[songstats] snapshot automation enabled without SONGSTATS_API_KEY");
    return;
  }

  schedulerStarted = true;
  logger.info(
    { hourEt: scheduledHourEt(), maxArtists: syncLimit() },
    "[songstats] daily snapshot scheduler started",
  );

  setTimeout(() => kickSongstatsSnapshotScheduler(), 5_000);
  setInterval(() => void scheduledCheck(), CHECK_INTERVAL_MS);
}
