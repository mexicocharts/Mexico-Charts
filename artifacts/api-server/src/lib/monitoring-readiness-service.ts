import { publicReadPool, type PgPool, type QueryResultRow } from "@workspace/db";
import {
  evaluateMonitoringReadiness,
  MONITORING_READINESS_POLICY_VERSION,
  type MonitoringReadinessResult,
} from "./monitoring-readiness-policy";
import {
  monitoringArtistAliasesMatch,
  songstatsArtistKeyCandidates,
} from "./songstats-artist-key";
import { isRequestDatabaseUnavailable } from "./request-database";

export { monitoringArtistAliasesMatch } from "./songstats-artist-key";

interface ReadinessRow {
  artist_key: string;
  artist_name: string | null;
  historic_stats: unknown;
  audience: unknown;
  audience_details: unknown;
  catalog: unknown;
  snapshot_date: string | null;
  spotify_followers: string | number | null;
  spotify_monthly_listeners: string | number | null;
  youtube_subscribers: string | number | null;
  youtube_channel_views: string | number | null;
  instagram_followers: string | number | null;
  tiktok_followers: string | number | null;
  facebook_followers: string | number | null;
  twitter_followers: string | number | null;
  soundcloud_followers: string | number | null;
  deezer_followers: string | number | null;
  stream_snapshot_date: string | null;
  track_count: number | null;
  album_count: number | null;
  track_daily_streams: string | number | null;
  track_total_streams: string | number | null;
  album_total_streams: string | number | null;
}

export interface MonitoringReadyArtist {
  artistKey: string;
  artistName: string;
  matchKeys: string[];
  readiness: MonitoringReadinessResult;
}

export interface ExistingMonitoringArtist {
  artistKey: string;
  artistName: string;
  matchKeys: string[];
}

const READINESS_CACHE_MS = 15 * 60 * 1000;
let completeCatalogCache: {
  expiresAt: number;
  value: Awaited<ReturnType<typeof runMonitoringReadinessAudit>>;
} | null = null;

export type MonitoringReadinessDiagnostic = {
  stage: "cache" | "db_acquisition" | "readiness_query" | "total";
  durationMs: number;
  outcome: "hit" | "miss" | "ok" | "timeout_or_unavailable" | "error";
};

type MonitoringReadinessAuditOptions = {
  artistKeys?: string[];
  readyOnly?: boolean;
  onDiagnostic?: (diagnostic: MonitoringReadinessDiagnostic) => void;
};

function roundedDuration(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 10) / 10;
}

export async function executeMonitoringReadinessQuery<T extends QueryResultRow>(
  readPool: Pick<PgPool, "connect">,
  text: string,
  values: unknown[],
  onDiagnostic?: MonitoringReadinessAuditOptions["onDiagnostic"],
): Promise<T[]> {
  const acquisitionStartedAt = performance.now();
  let client;
  try {
    client = await readPool.connect();
    onDiagnostic?.({
      stage: "db_acquisition",
      durationMs: roundedDuration(acquisitionStartedAt),
      outcome: "ok",
    });
  } catch (error) {
    onDiagnostic?.({
      stage: "db_acquisition",
      durationMs: roundedDuration(acquisitionStartedAt),
      outcome: isRequestDatabaseUnavailable(error) ? "timeout_or_unavailable" : "error",
    });
    throw error;
  }

  const queryStartedAt = performance.now();
  try {
    const result = await client.query<T>({ text, values });
    onDiagnostic?.({
      stage: "readiness_query",
      durationMs: roundedDuration(queryStartedAt),
      outcome: "ok",
    });
    return result.rows;
  } catch (error) {
    onDiagnostic?.({
      stage: "readiness_query",
      durationMs: roundedDuration(queryStartedAt),
      outcome: isRequestDatabaseUnavailable(error) ? "timeout_or_unavailable" : "error",
    });
    throw error;
  } finally {
    client.release();
  }
}

function numeric(value: string | number | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getExistingMonitoringArtist(artistKey: string): Promise<ExistingMonitoringArtist | null> {
  const candidates = songstatsArtistKeyCandidates(artistKey);
  if (!candidates.length) return null;
  const result = await publicReadPool.query<{ artist_key: string; artist_name: string | null }>(
    `SELECT c.artist_key, c.artist_name
     FROM kworb_coverage c
     WHERE COALESCE(c.spotify_id, '') <> ''
       AND (
         lower(c.artist_key) = ANY($1::text[])
         OR regexp_replace(
           translate(lower(c.artist_key), 'áéíóúüñ', 'aeiouun'),
           '[^a-z0-9]',
           '',
           'g'
         ) = ANY($1::text[])
       )
       AND EXISTS (
         SELECT 1
         FROM songstats_artist_daily_snapshots snapshot
         WHERE snapshot.artist_key = c.artist_key
       )
     ORDER BY
       (lower(c.artist_key) = ANY($1::text[])) DESC,
       c.artist_key
     LIMIT 1`,
    [candidates],
  );
  const artist = result.rows[0];
  if (!artist || !monitoringArtistAliasesMatch(artist.artist_key, artistKey)) return null;
  return {
    artistKey: artist.artist_key,
    artistName: artist.artist_name?.trim() || artist.artist_key,
    matchKeys: songstatsArtistKeyCandidates(artist.artist_key),
  };
}

function evaluateRow(row: ReadinessRow): MonitoringReadinessResult {
  return evaluateMonitoringReadiness({
    historicStats: row.historic_stats,
    audience: row.audience,
    audienceDetails: row.audience_details,
    catalog: row.catalog,
    currentSnapshotDate: row.snapshot_date,
    currentMetrics: {
      spotifyFollowers: numeric(row.spotify_followers),
      spotifyMonthlyListeners: numeric(row.spotify_monthly_listeners),
      youtubeSubscribers: numeric(row.youtube_subscribers),
      youtubeChannelViews: numeric(row.youtube_channel_views),
      instagramFollowers: numeric(row.instagram_followers),
      tiktokFollowers: numeric(row.tiktok_followers),
      facebookFollowers: numeric(row.facebook_followers),
      twitterFollowers: numeric(row.twitter_followers),
      soundcloudFollowers: numeric(row.soundcloud_followers),
      deezerFollowers: numeric(row.deezer_followers),
    },
    streamSnapshotDate: row.stream_snapshot_date,
    trackCount: row.track_count ?? 0,
    albumCount: row.album_count ?? 0,
    trackDailyStreams: numeric(row.track_daily_streams),
    trackTotalStreams: numeric(row.track_total_streams),
    albumTotalStreams: numeric(row.album_total_streams),
  });
}

async function runMonitoringReadinessAudit(options: MonitoringReadinessAuditOptions = {}): Promise<{
  policyVersion: number;
  audited: number;
  ready: MonitoringReadyArtist[];
  unavailable: MonitoringReadyArtist[];
}> {
  const candidates = [...new Set((options.artistKeys ?? []).flatMap(songstatsArtistKeyCandidates))];
  const params: unknown[] = [];
  const requestedFilter = candidates.length
    ? `AND (
        lower(c.artist_key) = ANY($${params.push(candidates)}::text[])
        OR regexp_replace(
          translate(lower(c.artist_key), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]',
          '',
          'g'
        ) = ANY($${params.length}::text[])
      )`
    : "";
  const rows = await executeMonitoringReadinessQuery<ReadinessRow>(
    publicReadPool,
    `SELECT
       c.artist_key,
       c.artist_name,
       e.historic_stats,
       e.audience,
       e.audience_details,
       e.catalog,
       current_snapshot.snapshot_date,
       current_snapshot.spotify_followers,
       current_snapshot.spotify_monthly_listeners,
       current_snapshot.youtube_subscribers,
       current_snapshot.youtube_channel_views,
       current_snapshot.instagram_followers,
       current_snapshot.tiktok_followers,
       current_snapshot.facebook_followers,
       current_snapshot.twitter_followers,
       current_snapshot.soundcloud_followers,
       current_snapshot.deezer_followers,
       stream_summary.snapshot_date AS stream_snapshot_date,
       stream_summary.track_count,
       stream_summary.album_count,
       stream_summary.track_daily_streams,
       stream_summary.track_total_streams,
       stream_summary.album_total_streams
     FROM kworb_coverage c
     JOIN songstats_artist_extended_data e ON e.artist_key = c.artist_key
     JOIN LATERAL (
       SELECT *
       FROM songstats_artist_daily_snapshots snapshot
       WHERE snapshot.artist_key = c.artist_key
       ORDER BY snapshot.snapshot_date DESC
       LIMIT 1
     ) current_snapshot ON true
     LEFT JOIN LATERAL (
       SELECT *
       FROM monitoring_stream_daily_artist_summaries summary
       WHERE summary.artist_key = c.artist_key
       ORDER BY summary.snapshot_date DESC
       LIMIT 1
     ) stream_summary ON true
     WHERE COALESCE(c.spotify_id, '') <> ''
       ${requestedFilter}
     ORDER BY c.artist_key`,
    params,
    options.onDiagnostic,
  );

  const evaluated = rows.map(row => ({
    artistKey: row.artist_key,
    artistName: row.artist_name?.trim() || row.artist_key,
    matchKeys: songstatsArtistKeyCandidates(row.artist_key),
    readiness: evaluateRow(row),
  }));
  const ready = evaluated.filter(artist => artist.readiness.ready);
  return {
    policyVersion: MONITORING_READINESS_POLICY_VERSION,
    audited: evaluated.length,
    ready,
    unavailable: options.readyOnly ? [] : evaluated.filter(artist => !artist.readiness.ready),
  };
}

export async function auditMonitoringReadiness(
  options: MonitoringReadinessAuditOptions = {},
): ReturnType<typeof runMonitoringReadinessAudit> {
  const totalStartedAt = performance.now();
  const cacheable = options.readyOnly === true && !(options.artistKeys?.length);
  if (cacheable && completeCatalogCache && completeCatalogCache.expiresAt > Date.now()) {
    options.onDiagnostic?.({ stage: "cache", durationMs: 0, outcome: "hit" });
    options.onDiagnostic?.({ stage: "total", durationMs: roundedDuration(totalStartedAt), outcome: "ok" });
    return completeCatalogCache.value;
  }
  if (cacheable) options.onDiagnostic?.({ stage: "cache", durationMs: 0, outcome: "miss" });
  try {
    const value = await runMonitoringReadinessAudit(options);
    if (cacheable) {
      completeCatalogCache = { expiresAt: Date.now() + READINESS_CACHE_MS, value };
    }
    options.onDiagnostic?.({ stage: "total", durationMs: roundedDuration(totalStartedAt), outcome: "ok" });
    return value;
  } catch (error) {
    options.onDiagnostic?.({
      stage: "total",
      durationMs: roundedDuration(totalStartedAt),
      outcome: isRequestDatabaseUnavailable(error) ? "timeout_or_unavailable" : "error",
    });
    throw error;
  }
}

export async function getMonitoringReadyArtist(artistKey: string): Promise<MonitoringReadyArtist | null> {
  const audit = await auditMonitoringReadiness({ artistKeys: [artistKey], readyOnly: true });
  return audit.ready[0] ?? null;
}
