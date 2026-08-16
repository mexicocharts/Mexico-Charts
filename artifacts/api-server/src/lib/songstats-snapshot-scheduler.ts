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
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

let schedulerStarted = false;
let schedulerRunning = false;
let lastStartedAt: string | null = null;
let lastFinishedAt: string | null = null;
let lastError: string | null = null;
let lastResult: unknown = null;
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
): Promise<{ saved: number; target: number }> {
  await ensureSongstatsTables();
  const result = await pool.query<{ saved: number; target: number }>(
    `
      SELECT
        (
          SELECT count(DISTINCT artist_key)::int
          FROM songstats_artist_daily_snapshots
          WHERE snapshot_date = $1
        ) AS saved,
        (
          SELECT least(count(*)::int, $2)
          FROM kworb_coverage c
          LEFT JOIN spotify_artists s ON s.artist_key = c.artist_key
          WHERE COALESCE(c.spotify_id, s.spotify_artist_id) IS NOT NULL
            AND (COALESCE(c.has_spotify, false) = true OR s.spotify_artist_id IS NOT NULL)
        ) AS target
    `,
    [snapshotDate, limit],
  );
  return {
    saved: result.rows[0]?.saved ?? 0,
    target: result.rows[0]?.target ?? 0,
  };
}

export async function runScheduledSongstatsSnapshot(): Promise<
  SongstatsSyncSummary | { snapshotDate: string; status: "already_complete" | "locked" | "too_early" }
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
    lastResult = summary
      ? {
          snapshotDate,
          requested: summary.requested,
          saved: summary.saved,
          failed: summary.failed,
        }
      : result;
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
    target: progress.target,
    saved: progress.saved,
    remaining: Math.max(0, progress.target - progress.saved),
    lastStartedAt,
    lastFinishedAt,
    lastError,
    lastResult,
  };
}

async function scheduledCheck(): Promise<void> {
  if (currentHourEt() < scheduledHourEt()) {
    return;
  }

  try {
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
