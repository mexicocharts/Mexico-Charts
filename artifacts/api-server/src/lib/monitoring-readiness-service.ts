import { publicReadPool, type PgPool, type QueryResultRow } from "@workspace/db";
import { evaluateMonitoringReadinessRow, type ReadinessRow } from "./monitoring-readiness-row";
export { evaluateMonitoringReadinessRow, type ReadinessRow } from "./monitoring-readiness-row";
import {
  MONITORING_READINESS_POLICY_VERSION,
  type MonitoringReadinessResult,
  type MonitoringReadinessReason,
} from "./monitoring-readiness-policy";
import {
  songstatsArtistKeyCandidates,
} from "./songstats-artist-key";
import { isRequestDatabaseUnavailable } from "./request-database";
import { buildLatestMonitoringStreamSummarySql } from "./monitoring-stream-serving";
import { buildMonitoringCompactReadinessSql } from "./monitoring-compact-readiness";

export { monitoringArtistAliasesMatch } from "./songstats-artist-key";

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
  identityConflict?: boolean;
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

export async function getExistingMonitoringArtist(artistKey: string): Promise<ExistingMonitoringArtist | null> {
  // Internal entitlement authorizes inspection of the complete stored catalog.
  // Its identity lookup must not apply the public Spotify/readiness gate.
  const { getMonitoringCandidateIdentity } = await import("./monitoring-candidate-audit");
  return getMonitoringCandidateIdentity(artistKey);
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
       ,to_jsonb(compact_history) compact_history
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
       ${buildLatestMonitoringStreamSummarySql("ARRAY[c.artist_key]")}
     ) stream_summary ON true
     LEFT JOIN LATERAL (${buildMonitoringCompactReadinessSql("ARRAY[c.artist_key]")}) compact_history ON true
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
    readiness: evaluateMonitoringReadinessRow(row),
  }));
  // The legacy policy remains the necessary first gate. The same complete
  // source contract used by founder diagnostics is also required publicly.
  // Batch only legacy-ready artists here; missing data never becomes eligible
  // merely because the founder can render its profile.
  const legacyReady = evaluated.filter(artist => artist.readiness.ready);
  if (legacyReady.length) {
    const { getMonitoringCandidateDirectory } = await import("./monitoring-candidate-audit");
    for (let offset = 0; offset < legacyReady.length; offset += 25) {
      const selected = legacyReady.slice(offset, offset + 25);
      const audit = await getMonitoringCandidateDirectory({ artistKeys: selected.map(artist => artist.artistKey), limit: 25 }, { readPool: publicReadPool });
      for (const artist of selected) {
        const full = audit.artists.find(candidate => candidate.sourceKeys.includes(artist.artistKey));
        if (!full?.publicEligible) {
          artist.readiness = {
            ...artist.readiness,
            ready: false,
            reasons: (full?.readinessReasons.length ? full.readinessReasons : ["source_audit_incomplete"]) as MonitoringReadinessReason[],
          };
        }
      }
    }
  }
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
