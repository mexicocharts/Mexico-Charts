import { pool } from "@workspace/db";
import { logger } from "./logger";
import { finishDailySnapshotRunLog, startDailySnapshotRunLog } from "./daily-snapshot-run-log";
import { reserveYoutubeApiUsage } from "./youtube-api-budget";
import { safeErrorDetails } from "./safe-error";

type PgClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  release: () => void;
};

interface ChannelRow {
  artist_key: string;
  channel_id: string;
}

interface YoutubeChannelItem {
  id: string;
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

interface SnapshotStats {
  channelId: string;
  viewCount: number | null;
  subscriberCount: number | null;
  videoCount: number | null;
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const LOCK_KEY = 392_410_602;
const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_MS = 60 * 60 * 1000;

let schedulerStarted = false;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export interface YoutubeChannelSnapshotRunSummary {
  status: "complete" | "already_complete" | "locked" | "skipped" | "failed";
  snapshotDate: string;
  reason: string;
  channels: number;
  fetched: number;
  saved: number;
  missing: number;
  dateRows: number;
  dailyViewsTotal: number;
  error?: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function automationEnabled() {
  return process.env["YOUTUBE_CHANNEL_SNAPSHOT_AUTOMATION"] !== "false";
}

function scheduledHourUtc() {
  const raw = Number(process.env["YOUTUBE_CHANNEL_SNAPSHOT_HOUR_UTC"] ?? "9");
  return Number.isFinite(raw) ? Math.max(0, Math.min(23, raw)) : 9;
}

function isScheduledHour() {
  return new Date().getUTCHours() >= scheduledHourUtc();
}

async function ensureSnapshotTable(client: PgClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_channel_daily_snapshots (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      channel_id text NOT NULL,
      snapshot_date text NOT NULL,
      source_type text NOT NULL DEFAULT 'official_artist_channel',
      view_count bigint,
      subscriber_count bigint,
      video_count integer,
      daily_view_delta bigint,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS youtube_channel_daily_snapshots_artist_date_unique
    ON youtube_channel_daily_snapshots (artist_key, snapshot_date);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS youtube_channel_daily_snapshots_channel_date_idx
    ON youtube_channel_daily_snapshots (channel_id, snapshot_date);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS youtube_channel_daily_snapshots_artist_date_idx
    ON youtube_channel_daily_snapshots (artist_key, snapshot_date);
  `);
}

async function fetchYoutubeChannels(client: PgClient, channelIds: string[]): Promise<SnapshotStats[]> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");

  const params = new URLSearchParams({
    key: apiKey,
    part: "statistics",
    id: channelIds.join(","),
    maxResults: String(channelIds.length),
  });

  await reserveYoutubeApiUsage(client, { consumer: "daily_channel_snapshots", method: "channels.list" });
  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 240)}`);
  }

  const data = await res.json() as { items?: YoutubeChannelItem[] };
  return (data.items ?? []).map(item => ({
    channelId: item.id,
    viewCount: parseNumber(item.statistics?.viewCount),
    subscriberCount: item.statistics?.hiddenSubscriberCount ? null : parseNumber(item.statistics?.subscriberCount),
    videoCount: parseNumber(item.statistics?.videoCount),
  }));
}

function batch<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function previousViewCount(client: PgClient, artistKey: string, snapshotDate: string): Promise<number | null> {
  const prev = await client.query<{ view_count: string | number | null }>(
    `
      SELECT view_count
      FROM youtube_channel_daily_snapshots
      WHERE artist_key = $1
        AND snapshot_date < $2
        AND view_count IS NOT NULL
      ORDER BY snapshot_date DESC
      LIMIT 1
    `,
    [artistKey, snapshotDate],
  );
  const value = prev.rows[0]?.view_count;
  return value == null ? null : Number(value);
}

async function saveSnapshot(client: PgClient, channel: ChannelRow, stats: SnapshotStats, snapshotDate: string) {
  const prevViews = stats.viewCount == null ? null : await previousViewCount(client, channel.artist_key, snapshotDate);
  const dailyDelta = stats.viewCount == null || prevViews == null ? null : Math.max(0, stats.viewCount - prevViews);

  await client.query(
    `
      INSERT INTO youtube_channel_daily_snapshots (
        artist_key, channel_id, snapshot_date, source_type, view_count,
        subscriber_count, video_count, daily_view_delta, fetched_at, updated_at
      )
      VALUES ($1,$2,$3,'official_artist_channel',$4,$5,$6,$7,now(),now())
      ON CONFLICT (artist_key, snapshot_date) DO UPDATE SET
        channel_id = excluded.channel_id,
        view_count = excluded.view_count,
        subscriber_count = excluded.subscriber_count,
        video_count = excluded.video_count,
        daily_view_delta = excluded.daily_view_delta,
        fetched_at = excluded.fetched_at,
        updated_at = now()
    `,
    [
      channel.artist_key,
      channel.channel_id,
      snapshotDate,
      stats.viewCount,
      stats.subscriberCount,
      stats.videoCount,
      dailyDelta,
    ],
  );

  await client.query(
    `
      UPDATE youtube_channels
      SET view_count = $2,
          subscriber_count = $3,
          video_count = $4,
          cached_at = now()
      WHERE artist_key = $1
    `,
    [channel.artist_key, stats.viewCount, stats.subscriberCount, stats.videoCount],
  );

  return dailyDelta;
}

async function snapshotCounts(client: PgClient, snapshotDate: string) {
  const counts = await client.query<{ channels: number; snapshots: number }>(
    `
      SELECT
        (SELECT count(*)::int FROM youtube_channels WHERE channel_id IS NOT NULL) AS channels,
        (SELECT count(*)::int FROM youtube_channel_daily_snapshots WHERE snapshot_date = $1) AS snapshots
    `,
    [snapshotDate],
  );
  return {
    channels: counts.rows[0]?.channels ?? 0,
    snapshots: counts.rows[0]?.snapshots ?? 0,
  };
}

export async function runDailyYoutubeChannelSnapshots(reason: string): Promise<YoutubeChannelSnapshotRunSummary> {
  const snapshotDate = todayIso();
  const runLogId = await startDailySnapshotRunLog({ provider: "youtube", snapshotDate, reason });
  if (!process.env["YOUTUBE_API_KEY"]) {
    logger.warn("[youtube:snapshots] skipping daily channel snapshots; missing YOUTUBE_API_KEY");
    const summary = {
      status: "skipped",
      snapshotDate,
      reason,
      channels: 0,
      fetched: 0,
      saved: 0,
      missing: 0,
      dateRows: 0,
      dailyViewsTotal: 0,
      error: "Missing YOUTUBE_API_KEY.",
    } satisfies YoutubeChannelSnapshotRunSummary;
    await finishDailySnapshotRunLog(runLogId, {
      status: summary.status,
      expectedCount: summary.channels,
      fetchedCount: summary.fetched,
      savedCount: summary.saved,
      missingCount: summary.missing,
      dateRows: summary.dateRows,
      totalDailyValue: summary.dailyViewsTotal,
      error: summary.error,
    });
    return summary;
  }

  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    if (!lock.rows[0]?.locked) {
      logger.info({ snapshotDate, reason }, "[youtube:snapshots] another worker owns snapshot lock");
      const summary = {
        status: "locked",
        snapshotDate,
        reason,
        channels: 0,
        fetched: 0,
        saved: 0,
        missing: 0,
        dateRows: 0,
        dailyViewsTotal: 0,
      } satisfies YoutubeChannelSnapshotRunSummary;
      await finishDailySnapshotRunLog(runLogId, {
        status: summary.status,
        expectedCount: summary.channels,
        fetchedCount: summary.fetched,
        savedCount: summary.saved,
        missingCount: summary.missing,
        dateRows: summary.dateRows,
        totalDailyValue: summary.dailyViewsTotal,
      });
      return summary;
    }

    try {
      await ensureSnapshotTable(client);
      const before = await snapshotCounts(client, snapshotDate);
      if (before.channels <= 0 || before.snapshots >= before.channels) {
        logger.info({ snapshotDate, reason }, "[youtube:snapshots] already complete for today");
        const summary = {
          status: "already_complete",
          snapshotDate,
          reason,
          channels: before.channels,
          fetched: 0,
          saved: 0,
          missing: 0,
          dateRows: before.snapshots,
          dailyViewsTotal: 0,
        } satisfies YoutubeChannelSnapshotRunSummary;
        await finishDailySnapshotRunLog(runLogId, {
          status: summary.status,
          expectedCount: summary.channels,
          fetchedCount: summary.fetched,
          savedCount: summary.saved,
          missingCount: summary.missing,
          dateRows: summary.dateRows,
          totalDailyValue: summary.dailyViewsTotal,
        });
        return summary;
      }

      const channelRows = await client.query<ChannelRow>(`
        SELECT artist_key, channel_id
        FROM youtube_channels
        WHERE channel_id IS NOT NULL
        ORDER BY artist_key
      `);

      let fetched = 0;
      let saved = 0;
      let missing = 0;
      let dailyViewsTotal = 0;

      for (const group of batch(channelRows.rows, 50)) {
        const statsRows = await fetchYoutubeChannels(client, group.map(channel => channel.channel_id));
        fetched += statsRows.length;
        const statsById = new Map(statsRows.map(stats => [stats.channelId, stats]));

        for (const channel of group) {
          const stats = statsById.get(channel.channel_id);
          if (!stats) {
            missing += 1;
            continue;
          }

          const delta = await saveSnapshot(client, channel, stats, snapshotDate);
          saved += 1;
          dailyViewsTotal += delta ?? 0;
        }
      }

      logger.info(
        { snapshotDate, reason, channels: channelRows.rows.length, fetched, saved, missing, dailyViewsTotal },
        "[youtube:snapshots] daily channel snapshots complete",
      );
      const after = await snapshotCounts(client, snapshotDate);
      const summary = {
        status: "complete",
        snapshotDate,
        reason,
        channels: channelRows.rows.length,
        fetched,
        saved,
        missing,
        dateRows: after.snapshots,
        dailyViewsTotal,
      } satisfies YoutubeChannelSnapshotRunSummary;
      await finishDailySnapshotRunLog(runLogId, {
        status: summary.status,
        expectedCount: summary.channels,
        fetchedCount: summary.fetched,
        savedCount: summary.saved,
        missingCount: summary.missing,
        dateRows: summary.dateRows,
        totalDailyValue: summary.dailyViewsTotal,
      });
      return summary;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    }
  } catch (err) {
    logger.error(safeErrorDetails(err,{snapshotDate,reason,job:"daily-channel-snapshots"}), "[youtube:snapshots] daily channel snapshot job failed");
    const summary = {
      status: "failed",
      snapshotDate,
      reason,
      channels: 0,
      fetched: 0,
      saved: 0,
      missing: 0,
      dateRows: 0,
      dailyViewsTotal: 0,
      error: err instanceof Error ? err.message : String(err),
    } satisfies YoutubeChannelSnapshotRunSummary;
    await finishDailySnapshotRunLog(runLogId, {
      status: summary.status,
      expectedCount: summary.channels,
      fetchedCount: summary.fetched,
      savedCount: summary.saved,
      missingCount: summary.missing,
      dateRows: summary.dateRows,
      totalDailyValue: summary.dailyViewsTotal,
      error: summary.error,
    });
    return summary;
  } finally {
    client.release();
  }
}

function scheduleInitialRun() {
  const delay = Number(process.env["YOUTUBE_CHANNEL_SNAPSHOT_STARTUP_DELAY_MS"] ?? "300000");
  setTimeout(() => {
    if (isScheduledHour()) {
      void runDailyYoutubeChannelSnapshots("startup");
    }
  }, Math.max(0, delay)).unref();
}

export function startYoutubeChannelSnapshotScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (!automationEnabled()) {
    logger.info("[youtube:snapshots] daily channel snapshot automation disabled");
    return;
  }

  scheduleInitialRun();
  schedulerTimer = setInterval(() => {
    if (isScheduledHour()) {
      void runDailyYoutubeChannelSnapshots("hourly-check");
    }
  }, CHECK_MS);
  schedulerTimer.unref();

  logger.info(
    { hourUtc: scheduledHourUtc(), intervalHours: CHECK_MS / DAY_MS * 24 },
    "[youtube:snapshots] daily channel snapshot automation enabled",
  );
}
