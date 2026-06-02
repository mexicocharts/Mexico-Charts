import { pool } from "@workspace/db";
import { logger } from "./logger";

type PgClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  release: () => void;
};

interface ArtistRow {
  artist_key: string;
  artist_name: string;
  spotify_artist_id: string | null;
}

interface SpotifySnapshotStats {
  totalStreams: number;
  dailyStreams: number;
  trackCount: number;
}

const LOCK_KEY = 392_410_603;
const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_MS = 60 * 60 * 1000;

let schedulerStarted = false;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export interface SpotifyKworbSnapshotRunSummary {
  status: "complete" | "already_complete" | "locked" | "failed";
  snapshotDate: string;
  reason: string;
  artists: number;
  fetched: number;
  saved: number;
  missing: number;
  dateRows: number;
  dailyStreamsTotal: number;
  error?: string;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function automationEnabled() {
  return process.env["SPOTIFY_KWORB_SNAPSHOT_AUTOMATION"] !== "false";
}

function scheduledHourUtc() {
  const raw = Number(process.env["SPOTIFY_KWORB_SNAPSHOT_HOUR_UTC"] ?? "10");
  return Number.isFinite(raw) ? Math.max(0, Math.min(23, raw)) : 10;
}

function isScheduledHour() {
  return new Date().getUTCHours() >= scheduledHourUtc();
}

async function ensureSnapshotTable(client: PgClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS spotify_kworb_daily_snapshots (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      spotify_artist_id text,
      snapshot_date text NOT NULL,
      source_type text NOT NULL DEFAULT 'kworb_spotify_artist',
      total_streams bigint,
      daily_streams bigint,
      track_count integer,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS spotify_kworb_daily_snapshots_artist_date_unique
    ON spotify_kworb_daily_snapshots (artist_key, snapshot_date);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS spotify_kworb_daily_snapshots_spotify_date_idx
    ON spotify_kworb_daily_snapshots (spotify_artist_id, snapshot_date);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS spotify_kworb_daily_snapshots_artist_date_idx
    ON spotify_kworb_daily_snapshots (artist_key, snapshot_date);
  `);
}

function parseCommaNum(value: string | undefined): number {
  if (!value) return 0;
  return parseInt(value.replace(/,/g, "").trim(), 10) || 0;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").trim();
}

function parseTableRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseSpotifyKworbPage(html: string): SpotifySnapshotStats | null {
  const rows = parseTableRows(html);
  let totalStreams = 0;
  let dailyStreams = 0;
  let trackCount = 0;

  for (const cells of rows) {
    const first = cells[0] ?? "";
    if (first === "Streams" && cells[1]) totalStreams = parseCommaNum(cells[1]);
    else if (first === "Daily" && cells[1]) dailyStreams = parseCommaNum(cells[1]);
    else if (first === "Tracks" && cells[1]) trackCount = parseCommaNum(cells[1]);
  }

  return totalStreams ? { totalStreams, dailyStreams, trackCount } : null;
}

async function fetchKworbSpotify(spotifyArtistId: string): Promise<SpotifySnapshotStats | null> {
  const response = await fetch(`https://kworb.net/spotify/artist/${spotifyArtistId}_songs.html`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)",
      "Accept": "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return parseSpotifyKworbPage(await response.text());
}

async function saveSnapshot(
  client: PgClient,
  artist: ArtistRow,
  kworb: SpotifySnapshotStats,
  snapshotDate: string,
) {
  await client.query(
    `
      INSERT INTO spotify_kworb_daily_snapshots (
        artist_key, spotify_artist_id, snapshot_date, source_type,
        total_streams, daily_streams, track_count, fetched_at, updated_at
      )
      VALUES ($1,$2,$3,'kworb_spotify_artist',$4,$5,$6,now(),now())
      ON CONFLICT (artist_key, snapshot_date) DO UPDATE SET
        spotify_artist_id = excluded.spotify_artist_id,
        total_streams = excluded.total_streams,
        daily_streams = excluded.daily_streams,
        track_count = excluded.track_count,
        fetched_at = excluded.fetched_at,
        updated_at = now()
    `,
    [
      artist.artist_key,
      artist.spotify_artist_id,
      snapshotDate,
      kworb.totalStreams,
      kworb.dailyStreams,
      kworb.trackCount,
    ],
  );
}

async function snapshotCounts(client: PgClient, snapshotDate: string) {
  const counts = await client.query<{ artists: number; snapshots: number }>(
    `
      SELECT
        (
          SELECT count(*)::int
          FROM kworb_coverage c
          LEFT JOIN spotify_artists s ON s.artist_key = c.artist_key
          WHERE COALESCE(c.spotify_id, s.spotify_artist_id) IS NOT NULL
            AND COALESCE(c.has_spotify, false) = true
        ) AS artists,
        (SELECT count(*)::int FROM spotify_kworb_daily_snapshots WHERE snapshot_date = $1) AS snapshots
    `,
    [snapshotDate],
  );
  return {
    artists: counts.rows[0]?.artists ?? 0,
    snapshots: counts.rows[0]?.snapshots ?? 0,
  };
}

export async function runDailySpotifyKworbSnapshots(reason: string): Promise<SpotifyKworbSnapshotRunSummary> {
  const snapshotDate = todayIso();
  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    if (!lock.rows[0]?.locked) {
      logger.info({ snapshotDate, reason }, "[spotify-kworb:snapshots] another worker owns snapshot lock");
      return {
        status: "locked",
        snapshotDate,
        reason,
        artists: 0,
        fetched: 0,
        saved: 0,
        missing: 0,
        dateRows: 0,
        dailyStreamsTotal: 0,
      };
    }

    try {
      await ensureSnapshotTable(client);
      const before = await snapshotCounts(client, snapshotDate);
      if (before.artists <= 0 || before.snapshots >= before.artists) {
        logger.info({ snapshotDate, reason }, "[spotify-kworb:snapshots] already complete for today");
        return {
          status: "already_complete",
          snapshotDate,
          reason,
          artists: before.artists,
          fetched: 0,
          saved: 0,
          missing: 0,
          dateRows: before.snapshots,
          dailyStreamsTotal: 0,
        };
      }

      const artistRows = await client.query<ArtistRow>(`
        SELECT
          c.artist_key,
          c.artist_name,
          COALESCE(c.spotify_id, s.spotify_artist_id) AS spotify_artist_id
        FROM kworb_coverage c
        LEFT JOIN spotify_artists s ON s.artist_key = c.artist_key
        WHERE COALESCE(c.spotify_id, s.spotify_artist_id) IS NOT NULL
          AND COALESCE(c.has_spotify, false) = true
        ORDER BY c.tier, c.artist_key
      `);

      let fetched = 0;
      let saved = 0;
      let missing = 0;
      let dailyStreamsTotal = 0;

      for (const artist of artistRows.rows) {
        if (!artist.spotify_artist_id) continue;
        const kworb = await fetchKworbSpotify(artist.spotify_artist_id);
        if (!kworb) {
          missing += 1;
          continue;
        }

        await saveSnapshot(client, artist, kworb, snapshotDate);
        fetched += 1;
        saved += 1;
        dailyStreamsTotal += kworb.dailyStreams;
      }

      logger.info(
        { snapshotDate, reason, artists: artistRows.rows.length, fetched, saved, missing, dailyStreamsTotal },
        "[spotify-kworb:snapshots] daily snapshots complete",
      );
      const after = await snapshotCounts(client, snapshotDate);
      return {
        status: "complete",
        snapshotDate,
        reason,
        artists: artistRows.rows.length,
        fetched,
        saved,
        missing,
        dateRows: after.snapshots,
        dailyStreamsTotal,
      };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, snapshotDate, reason }, "[spotify-kworb:snapshots] daily snapshot job failed");
    return {
      status: "failed",
      snapshotDate,
      reason,
      artists: 0,
      fetched: 0,
      saved: 0,
      missing: 0,
      dateRows: 0,
      dailyStreamsTotal: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    client.release();
  }
}

function scheduleInitialRun() {
  const delay = Number(process.env["SPOTIFY_KWORB_SNAPSHOT_STARTUP_DELAY_MS"] ?? "420000");
  setTimeout(() => {
    if (isScheduledHour()) {
      void runDailySpotifyKworbSnapshots("startup");
    }
  }, Math.max(0, delay)).unref();
}

export function startSpotifyKworbSnapshotScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (!automationEnabled()) {
    logger.info("[spotify-kworb:snapshots] daily snapshot automation disabled");
    return;
  }

  scheduleInitialRun();
  schedulerTimer = setInterval(() => {
    if (isScheduledHour()) {
      void runDailySpotifyKworbSnapshots("hourly-check");
    }
  }, CHECK_MS);
  schedulerTimer.unref();

  logger.info(
    { hourUtc: scheduledHourUtc(), intervalHours: CHECK_MS / DAY_MS * 24 },
    "[spotify-kworb:snapshots] daily snapshot automation enabled",
  );
}
