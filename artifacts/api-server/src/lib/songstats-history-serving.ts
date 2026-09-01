import { pool, type PoolClient } from "@workspace/db";
import {
  compactGrowthAtTarget,
  deterministicMinMaxDownsample,
  mergeCompactHistoryPoints,
  releaseImpactFromCompactHistory,
  RELEASE_IMPACT_ELIGIBLE_METRICS,
  RELEASE_IMPACT_MAX_PERCENTAGE,
  type CompactHistoryPoint,
  type CompactHistoryResolution,
} from "./monitoring-history-compact";

type Queryable = Pick<PoolClient, "query">;

const SNAPSHOT_COLUMNS: Readonly<Record<string, string>> = Object.freeze({
  spotifyFollowers: "spotify_followers",
  spotifyMonthlyListeners: "spotify_monthly_listeners",
  spotifyPopularity: "spotify_popularity",
  youtubeSubscribers: "youtube_subscribers",
  youtubeChannelViews: "youtube_channel_views",
  instagramFollowers: "instagram_followers",
  tiktokFollowers: "tiktok_followers",
  facebookFollowers: "facebook_followers",
  twitterFollowers: "twitter_followers",
  soundcloudFollowers: "soundcloud_followers",
  deezerFollowers: "deezer_followers",
});

const RANGE_DAYS = Object.freeze({
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "1y": 365,
} as const);

export type CompactHistoryRange = keyof typeof RANGE_DAYS | "all" | "custom";

function dateDays(date: string): number {
  return Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function validDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function numeric(value: string | number | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface OverviewRow {
  metric_definition_id: number;
  source: string;
  provider_field: string;
  metric_key: string;
  label: string;
  unit: string;
  behavior: string;
  definition_version: number;
  earliest_date: string | null;
  latest_date: string | null;
  observation_count: string;
  missing_date_count: string;
  gap_count: string;
  latest_value: string | null;
  peak_value: string | null;
  peak_date: string | null;
  baseline_7_date: string | null;
  baseline_7_value: string | null;
  baseline_30_date: string | null;
  baseline_30_value: string | null;
  baseline_90_date: string | null;
  baseline_90_value: string | null;
  baseline_182_date: string | null;
  baseline_182_value: string | null;
  baseline_365_date: string | null;
  baseline_365_value: string | null;
}

function growthFromRow(row: OverviewRow, days: 7 | 30 | 90 | 182 | 365) {
  if (!row.latest_date || row.latest_value == null) return null;
  const date = row[`baseline_${days}_date`];
  const value = numeric(row[`baseline_${days}_value`]);
  const latest = numeric(row.latest_value);
  if (!date || value == null || latest == null) return null;
  const target = shiftDate(row.latest_date, -days);
  if (dateDays(target) - dateDays(date) > 7 || dateDays(row.latest_date) - dateDays(date) < days) return null;
  const absolute = latest - value;
  return {
    requestedDays: days,
    absolute,
    percentage: value === 0 ? null : Math.round((absolute / value) * 10_000) / 100,
    baselineDate: date,
    latestDate: row.latest_date,
    actualDays: dateDays(row.latest_date) - dateDays(date),
  };
}

export async function loadCompactMonitoringHistoryOverview(
  artistKey: string,
  queryable: Queryable = pool,
  metricKey?: string,
) {
  const started = process.hrtime.bigint();
  const result = await queryable.query<OverviewRow>(`
    WITH active_definitions AS (
      SELECT id, source, provider_field, metric_key, label, unit, behavior, definition_version
      FROM songstats_history_metric_definitions
      WHERE ingestion_status='active'
        AND ($2::text IS NULL OR metric_key=$2)
    ), ordered AS (
      SELECT observation.metric_definition_id,
             observation.provider_observation_date,
             observation.value,
             lag(observation.provider_observation_date) OVER (
               PARTITION BY observation.metric_definition_id
               ORDER BY observation.provider_observation_date
             ) previous_date
      FROM songstats_historical_observations observation
      JOIN active_definitions selected_definition
        ON selected_definition.id=observation.metric_definition_id
      JOIN songstats_history_provider_identities identity
        ON identity.id=observation.provider_identity_id
       AND identity.validation_status='verified'
      WHERE observation.artist_key=$1
        AND observation.acquisition_mode='songstats_historical'
    ), coverage AS (
      SELECT metric_definition_id,
             min(provider_observation_date)::text earliest_date,
             max(provider_observation_date)::text latest_date,
             count(*)::text observation_count,
             COALESCE(sum(GREATEST(provider_observation_date-previous_date-1, 0)), 0)::text missing_date_count,
             count(*) FILTER (WHERE provider_observation_date-previous_date > 1)::text gap_count,
             max(value)::text peak_value
      FROM ordered GROUP BY metric_definition_id
    )
    SELECT definition.id metric_definition_id,
           definition.source, definition.provider_field, definition.metric_key,
           definition.label, definition.unit, definition.behavior,
           definition.definition_version,
           coverage.earliest_date, coverage.latest_date,
           COALESCE(coverage.observation_count, '0') observation_count,
           COALESCE(coverage.missing_date_count, '0') missing_date_count,
           COALESCE(coverage.gap_count, '0') gap_count,
           latest.value::text latest_value,
           coverage.peak_value,
           peak.provider_observation_date::text peak_date,
           baseline7.provider_observation_date::text baseline_7_date,
           baseline7.value::text baseline_7_value,
           baseline30.provider_observation_date::text baseline_30_date,
           baseline30.value::text baseline_30_value,
           baseline90.provider_observation_date::text baseline_90_date,
           baseline90.value::text baseline_90_value,
           baseline182.provider_observation_date::text baseline_182_date,
           baseline182.value::text baseline_182_value,
           baseline365.provider_observation_date::text baseline_365_date,
           baseline365.value::text baseline_365_value
    FROM active_definitions definition
    LEFT JOIN coverage ON coverage.metric_definition_id=definition.id
    LEFT JOIN LATERAL (
      SELECT provider_observation_date, value
      FROM songstats_historical_observations observation
      WHERE observation.artist_key=$1
        AND observation.metric_definition_id=definition.id
        AND observation.acquisition_mode='songstats_historical'
      ORDER BY provider_observation_date DESC LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT provider_observation_date
      FROM songstats_historical_observations observation
      WHERE observation.artist_key=$1
        AND observation.metric_definition_id=definition.id
        AND observation.value=coverage.peak_value::numeric
        AND observation.acquisition_mode='songstats_historical'
      ORDER BY provider_observation_date LIMIT 1
    ) peak ON true
    LEFT JOIN LATERAL (
      SELECT provider_observation_date, value FROM songstats_historical_observations observation
      WHERE observation.artist_key=$1 AND observation.metric_definition_id=definition.id
        AND observation.provider_observation_date <= latest.provider_observation_date-7
        AND observation.acquisition_mode='songstats_historical'
      ORDER BY provider_observation_date DESC LIMIT 1
    ) baseline7 ON true
    LEFT JOIN LATERAL (
      SELECT provider_observation_date, value FROM songstats_historical_observations observation
      WHERE observation.artist_key=$1 AND observation.metric_definition_id=definition.id
        AND observation.provider_observation_date <= latest.provider_observation_date-30
        AND observation.acquisition_mode='songstats_historical'
      ORDER BY provider_observation_date DESC LIMIT 1
    ) baseline30 ON true
    LEFT JOIN LATERAL (
      SELECT provider_observation_date, value FROM songstats_historical_observations observation
      WHERE observation.artist_key=$1 AND observation.metric_definition_id=definition.id
        AND observation.provider_observation_date <= latest.provider_observation_date-90
        AND observation.acquisition_mode='songstats_historical'
      ORDER BY provider_observation_date DESC LIMIT 1
    ) baseline90 ON true
    LEFT JOIN LATERAL (
      SELECT provider_observation_date, value FROM songstats_historical_observations observation
      WHERE observation.artist_key=$1 AND observation.metric_definition_id=definition.id
        AND observation.provider_observation_date <= latest.provider_observation_date-182
        AND observation.acquisition_mode='songstats_historical'
      ORDER BY provider_observation_date DESC LIMIT 1
    ) baseline182 ON true
    LEFT JOIN LATERAL (
      SELECT provider_observation_date, value FROM songstats_historical_observations observation
      WHERE observation.artist_key=$1 AND observation.metric_definition_id=definition.id
        AND observation.provider_observation_date <= latest.provider_observation_date-365
        AND observation.acquisition_mode='songstats_historical'
      ORDER BY provider_observation_date DESC LIMIT 1
    ) baseline365 ON true
    ORDER BY definition.source, definition.metric_key
  `, [artistKey, metricKey ?? null]);
  const metrics = result.rows.map(row => {
    const available = Number(row.observation_count) > 0;
    const spanDays = row.earliest_date && row.latest_date
      ? dateDays(row.latest_date) - dateDays(row.earliest_date) + 1
      : 0;
    return {
      metricDefinitionRef: `metric:${row.metric_definition_id}`,
      metricKey: row.metric_key,
      source: row.source,
      providerField: row.provider_field,
      label: row.label,
      unit: row.unit,
      behavior: row.behavior,
      definitionVersion: row.definition_version,
      status: available ? "available" as const : "unavailable" as const,
      earliestAvailableDate: row.earliest_date,
      latestAvailableDate: row.latest_date,
      observationCount: Number(row.observation_count),
      spanDays,
      coverage: {
        missingDateCount: Number(row.missing_date_count),
        gapCount: Number(row.gap_count),
        complete: available && Number(row.missing_date_count) === 0,
      },
      growth: {
        days7: growthFromRow(row, 7),
        days30: growthFromRow(row, 30),
        days90: growthFromRow(row, 90),
        months6: growthFromRow(row, 182),
        year1: growthFromRow(row, 365),
        yearOverYear: growthFromRow(row, 365),
      },
      historicalPeak: row.peak_date && row.peak_value != null ? {
        date: row.peak_date,
        value: Number(row.peak_value),
        label: "peak_in_available_history" as const,
      } : null,
      multiYear: spanDays >= 730,
      releaseImpactEligible: row.metric_key in RELEASE_IMPACT_ELIGIBLE_METRICS,
    };
  });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  return {
    artistKey,
    historyLabel: "Songstats available daily history",
    metricCount: metrics.length,
    availableMetricCount: metrics.filter(metric => metric.status === "available").length,
    unavailableMetricCount: metrics.filter(metric => metric.status === "unavailable").length,
    metrics,
    transport: {
      initialPointsIncluded: 0,
      exactDailyEndpoint: "/api/monitoring/history/:artistKey/:metricKey",
      multiYearDisplayMethod: "deterministic_min_max_bucket_v1",
    },
    queryLatencyMs: elapsedMs,
  };
}

interface StoredPointRow {
  date: string;
  value: string;
  import_chunk_id: number;
  provider_identity_id: number;
  songstats_artist_id: string;
  validation_status: "verified";
  metric_definition_id: number;
  source: string;
  provider_field: string;
  metric_key: string;
  label: string;
  unit: string;
  behavior: string;
  definition_version: number;
  response_hash: string;
  window_start_date: string;
  window_end_date: string;
  parser_version: number;
  schema_version: number;
  fetched_at: string;
}

export async function loadCompactMonitoringMetricHistory(input: {
  artistKey: string;
  metricKey: string;
  range?: CompactHistoryRange;
  startDate?: string;
  endDate?: string;
  resolution?: "auto" | CompactHistoryResolution;
  maximumDisplayPoints?: number;
  queryable?: Queryable;
  overview?: Awaited<ReturnType<typeof loadCompactMonitoringHistoryOverview>>;
}) {
  const queryable = input.queryable ?? pool;
  const overview = input.overview ?? await loadCompactMonitoringHistoryOverview(
    input.artistKey,
    queryable,
    input.metricKey,
  );
  const metric = overview.metrics.find(candidate => candidate.metricKey === input.metricKey);
  if (!metric) throw new Error("Unknown or quarantined historical metric");
  const snapshotColumn = SNAPSHOT_COLUMNS[input.metricKey];
  const snapshotBounds = snapshotColumn
    ? (await queryable.query<{ earliest_date: string | null; latest_date: string | null; observations: string }>(`
        SELECT min(snapshot_date)::text earliest_date,
               max(snapshot_date)::text latest_date,
               count(*) FILTER (WHERE ${snapshotColumn} IS NOT NULL)::text observations
        FROM songstats_artist_daily_snapshots
        WHERE artist_key=$1 AND ${snapshotColumn} IS NOT NULL
      `, [input.artistKey])).rows[0]
    : null;
  const earliestAvailableDate = [metric.earliestAvailableDate, snapshotBounds?.earliest_date]
    .filter((value): value is string => Boolean(value)).sort()[0] ?? null;
  const latestAvailableDate = [metric.latestAvailableDate, snapshotBounds?.latest_date]
    .filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  if (!earliestAvailableDate || !latestAvailableDate) {
    return {
      artistKey: input.artistKey,
      metric,
      status: "unavailable" as const,
      availabilityBySource: {
        songstatsHistorical: metric.status,
        mexicoChartsScheduled: "unavailable" as const,
      },
      points: [],
    };
  }
  const range = input.range ?? "all";
  let startDate = earliestAvailableDate;
  let endDate = latestAvailableDate;
  if (range === "custom") {
    if (!validDate(input.startDate) || !validDate(input.endDate) || input.startDate > input.endDate) {
      throw new Error("Custom history range requires valid startDate and endDate");
    }
    startDate = input.startDate;
    endDate = input.endDate;
  } else if (range !== "all") {
    // Include both the latest point and the exact N-day baseline.
    startDate = shiftDate(endDate, -RANGE_DAYS[range]);
    if (startDate < earliestAvailableDate) startDate = earliestAvailableDate;
  }
  const queryStarted = process.hrtime.bigint();
  const stored = await queryable.query<StoredPointRow>(`
    SELECT observation.provider_observation_date::text date,
           observation.value::text,
           observation.import_chunk_id,
           identity.id provider_identity_id,
           identity.songstats_artist_id,
           identity.validation_status,
           definition.id metric_definition_id,
           definition.source, definition.provider_field, definition.metric_key,
           definition.label, definition.unit, definition.behavior, definition.definition_version,
           chunk.response_hash,
           chunk.window_start_date::text, chunk.window_end_date::text,
           chunk.parser_version, chunk.schema_version,
           observation.fetched_at::text
    FROM songstats_historical_observations observation
    JOIN songstats_history_metric_definitions definition
      ON definition.id=observation.metric_definition_id
     AND definition.ingestion_status='active'
    JOIN songstats_history_provider_identities identity
      ON identity.id=observation.provider_identity_id
     AND identity.validation_status='verified'
    JOIN songstats_history_import_chunks chunk ON chunk.id=observation.import_chunk_id
    WHERE observation.artist_key=$1
      AND definition.metric_key=$2
      AND observation.provider_observation_date BETWEEN $3::date AND $4::date
      AND observation.acquisition_mode='songstats_historical'
    ORDER BY observation.provider_observation_date
  `, [input.artistKey, input.metricKey, startDate, endDate]);

  const candidates: CompactHistoryPoint[] = stored.rows.map(row => ({
    date: row.date,
    value: Number(row.value),
    provenanceRef: `chunk:${row.import_chunk_id}`,
    acquisitionMode: "songstats_historical",
  }));
  const snapshotRefs: Array<Record<string, unknown>> = [];
  if (snapshotColumn) {
    const snapshots = await queryable.query<{ date: string; value: string; fetched_at: string }>(`
      SELECT snapshot_date::text date, ${snapshotColumn}::text value, fetched_at::text
      FROM songstats_artist_daily_snapshots
      WHERE artist_key=$1
        AND snapshot_date::date BETWEEN $2::date AND $3::date
        AND ${snapshotColumn} IS NOT NULL
      ORDER BY snapshot_date
    `, [input.artistKey, startDate, endDate]);
    for (const row of snapshots.rows) {
      const ref = `snapshot:${input.metricKey}:${row.date}`;
      candidates.push({
        date: row.date,
        value: Number(row.value),
        provenanceRef: ref,
        acquisitionMode: "scheduled_current_snapshot",
      });
      snapshotRefs.push({
        ref,
        provider: "mexico_charts",
        source: "songstats_current_snapshot",
        granularity: "daily",
        acquisitionMode: "scheduled_current_snapshot",
        providerObservationDate: row.date,
        fetchedAt: row.fetched_at,
      });
    }
  }
  const exact = mergeCompactHistoryPoints(candidates);
  const spanDays = dateDays(endDate) - dateDays(startDate) + 1;
  const resolution: CompactHistoryResolution = input.resolution === "daily"
    ? "daily"
    : input.resolution === "minmax" || spanDays > 366
      ? "minmax"
      : "daily";
  const displayed = resolution === "minmax"
    ? deterministicMinMaxDownsample(exact, input.maximumDisplayPoints ?? 400)
    : exact;
  const chunkRefs = [...new Map(stored.rows.map(row => [row.import_chunk_id, {
    ref: `chunk:${row.import_chunk_id}`,
    provider: "songstats",
    source: row.source,
    granularity: "daily",
    acquisitionMode: "songstats_historical",
    providerIdentityRef: `identity:${row.provider_identity_id}`,
    metricDefinitionRef: `metric:${row.metric_definition_id}`,
    requestWindow: { startDate: row.window_start_date, endDate: row.window_end_date },
    responseHash: row.response_hash,
    parserVersion: row.parser_version,
    schemaVersion: row.schema_version,
    fetchedAt: row.fetched_at,
  }])).values()];
  const first = stored.rows[0];
  const queryLatencyMs = Number(process.hrtime.bigint() - queryStarted) / 1_000_000;
  const points = displayed.map(point => [
    point.date,
    point.value,
    point.provenanceRef,
    point.alternatives?.length ? point.alternatives : undefined,
  ] as const);
  return {
    artistKey: input.artistKey,
    metric,
    status: "available" as const,
    availabilityBySource: {
      songstatsHistorical: metric.status,
      mexicoChartsScheduled: Number(snapshotBounds?.observations ?? 0) > 0
        ? "available" as const : "unavailable" as const,
    },
    requestedRange: { preset: range, startDate, endDate },
    sourceGranularity: "daily" as const,
    resolution: {
      returned: resolution,
      method: resolution === "daily" ? "exact_daily" : "deterministic_min_max_bucket_v1",
      exactSourcePoints: exact.length,
      returnedDisplayPoints: points.length,
      sourceHistoryRetained: true,
    },
    points,
    pointTuple: ["date", "value", "provenanceRef", "alternatives?"],
    provenance: {
      metricDefinition: first ? {
        ref: `metric:${first.metric_definition_id}`,
        metricKey: first.metric_key,
        providerField: first.provider_field,
        source: first.source,
        label: first.label,
        unit: first.unit,
        behavior: first.behavior,
        definitionVersion: first.definition_version,
      } : {
        ref: metric.metricDefinitionRef,
        metricKey: metric.metricKey,
        providerField: metric.providerField,
        source: metric.source,
        label: metric.label,
        unit: metric.unit,
        behavior: metric.behavior,
        definitionVersion: metric.definitionVersion,
      },
      providerIdentity: first ? {
        ref: `identity:${first.provider_identity_id}`,
        songstatsArtistId: first.songstats_artist_id,
        validationStatus: first.validation_status,
      } : null,
      references: [...chunkRefs, ...snapshotRefs],
    },
    rangeCoverage: {
      observationCount: exact.length,
      missingDateCount: Math.max(0, spanDays - new Set(exact.map(point => point.date)).size),
      missingIntervals: missingIntervals(exact.map(point => point.date)),
    },
    derived: {
      days7: compactGrowthAtTarget(exact, 7),
      days30: compactGrowthAtTarget(exact, 30),
      days90: compactGrowthAtTarget(exact, 90),
      months6: compactGrowthAtTarget(exact, 182),
      year1: compactGrowthAtTarget(exact, 365),
      yearOverYear: compactGrowthAtTarget(exact, 365),
      historicalPeak: exact.reduce<CompactHistoryPoint | null>(
        (peak, point) => !peak || point.value > peak.value ? point : peak,
        null,
      ),
    },
    queryLatencyMs,
  };
}

function missingIntervals(dates: string[]) {
  const ordered = [...new Set(dates)].sort();
  return ordered.slice(1).flatMap((date, index) => {
    const previous = ordered[index]!;
    const days = dateDays(date) - dateDays(previous) - 1;
    if (days <= 0) return [];
    return [{ startDate: shiftDate(previous, 1), endDate: shiftDate(date, -1), days }];
  });
}

export async function loadCompactReleaseImpact(input: {
  artistKey: string;
  releaseDate: string;
  queryable?: Queryable;
}) {
  const queryable = input.queryable ?? pool;
  const overview = await loadCompactMonitoringHistoryOverview(input.artistKey, queryable);
  const results = await Promise.all(Object.keys(RELEASE_IMPACT_ELIGIBLE_METRICS).map(async metricKey => {
    const history = await loadCompactMonitoringMetricHistory({
      artistKey: input.artistKey,
      metricKey,
      range: "custom",
      startDate: shiftDate(input.releaseDate, -7),
      endDate: shiftDate(input.releaseDate, 92),
      resolution: "daily",
      queryable,
      overview,
    });
    if (history.status !== "available") {
      return { metricKey, status: "unavailable" as const, reason: "metric_unavailable" as const };
    }
    const refs = new Map(history.provenance.references.map(reference => [String(reference["ref"]), reference]));
    const points: CompactHistoryPoint[] = history.points.map(([date, value, provenanceRef]) => ({
      date,
      value,
      provenanceRef,
      acquisitionMode: String(refs.get(provenanceRef)?.["acquisitionMode"] ?? "songstats_historical") as CompactHistoryPoint["acquisitionMode"],
    }));
    return { metricKey, ...releaseImpactFromCompactHistory({ releaseDate: input.releaseDate, metricKey, points }) };
  }));
  return {
    releaseDate: input.releaseDate,
    policy: {
      eligibleMetrics: Object.keys(RELEASE_IMPACT_ELIGIBLE_METRICS),
      excludedBehavior: "current_count",
      maximumAbsolutePercentage: RELEASE_IMPACT_MAX_PERCENTAGE,
      minimumPreReleaseObservations: 5,
      minimumPostWindowObservations: 3,
      maximumGapDays: 2,
    },
    metrics: results,
    availableMetricCount: results.filter(result => result.status === "available").length,
  };
}

export const COMPACT_HISTORY_INDEX_EXPECTATION = Object.freeze({
  index: "songstats_history_observation_provenance_unique",
  keys: ["artist_key", "metric_definition_id", "provider_observation_date", "acquisition_mode"],
  queryPattern: "artist + metric definition + provider observation date range",
});
