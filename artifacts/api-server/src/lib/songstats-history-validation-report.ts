import { pool } from "@workspace/db";
import {
  assembleMonitoringHistory,
  releaseImpactFromAvailableHistory,
  type MonitoringHistoricalObservation,
} from "./monitoring-history";
import { buildSongstatsPublicInsight } from "./songstats-public-service";
import {
  loadSongstatsHistoricalObservations,
  songstatsHistoryStorageImpact,
} from "./songstats-history-store";

const SNAPSHOT_COLUMNS = {
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
} as const;

function elapsedMs(started: bigint): number {
  return Number(process.hrtime.bigint() - started) / 1_000_000;
}

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
}

function missingIntervals(dates: string[]) {
  const ordered = [...new Set(dates)].sort();
  return ordered.slice(1).flatMap((date, index) => {
    const previous = ordered[index]!;
    const missing = dayNumber(date) - dayNumber(previous) - 1;
    if (missing <= 0) return [];
    const start = new Date(`${previous}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(`${date}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    return [{
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      days: missing,
    }];
  });
}

export async function songstatsHistoryValidationState(input: {
  runId: string;
  artistKeys: readonly string[];
}) {
  const result = await pool.query<{
    artist_key: string;
    window_start_date: string;
    window_end_date: string;
    status: string;
    run_id: string;
    attempt_count: number;
    error_code: string | null;
    error_message: string | null;
    updated_at?: string;
  }>(`
    SELECT artist_key, window_start_date::text, window_end_date::text,
           status, run_id, attempt_count, error_code, error_message, updated_at::text
    FROM songstats_history_import_chunks
    WHERE artist_key = ANY($1::text[])
    ORDER BY artist_key, window_start_date
  `, [[...input.artistKeys]]);
  return result.rows;
}

export async function buildSongstatsHistoryValidationReport(input: {
  runId: string;
  artistKeys: readonly string[];
}) {
  const queryStarted = process.hrtime.bigint();
  const [stored, storageAfter, database, relations, chunks, identities, snapshots, catalogRows, run] =
    await Promise.all([
      loadSongstatsHistoricalObservations([...input.artistKeys], { includeQuarantined: true }),
      songstatsHistoryStorageImpact(),
      pool.query<{ database_bytes: string }>(
        `SELECT pg_database_size(current_database())::text database_bytes`,
      ),
      pool.query<{ table_name: string; heap_bytes: string; index_bytes: string; total_bytes: string }>(`
        SELECT relation::text table_name,
               pg_relation_size(relation)::text heap_bytes,
               pg_indexes_size(relation)::text index_bytes,
               pg_total_relation_size(relation)::text total_bytes
        FROM unnest(ARRAY[
          'songstats_history_provider_identities'::regclass,
          'songstats_history_import_runs'::regclass,
          'songstats_history_import_chunks'::regclass,
          'songstats_historical_observations'::regclass
        ]) relation
      `),
      pool.query<{
        artist_key: string;
        window_start_date: string;
        window_end_date: string;
        status: string;
        attempt_count: number;
        observation_count: number;
        duplicate_count: number;
        response_hash: string | null;
        fetched_at: string | null;
        started_at: string | null;
        completed_at: string | null;
        error_code: string | null;
        error_message: string | null;
        acquisition_metadata: Record<string, unknown>;
      }>(`
        SELECT artist_key, window_start_date::text, window_end_date::text,
               status, attempt_count, observation_count, duplicate_count,
               response_hash, fetched_at::text, started_at::text,
               completed_at::text, error_code, error_message, acquisition_metadata
        FROM songstats_history_import_chunks
        WHERE run_id=$1 ORDER BY artist_key, window_start_date
      `, [input.runId]),
      pool.query<{
        artist_key: string;
        spotify_artist_id: string;
        songstats_artist_id: string;
        validation_status: string;
        identity_evidence: Record<string, unknown>;
      }>(`
        SELECT artist_key, spotify_artist_id, songstats_artist_id,
               validation_status, identity_evidence
        FROM songstats_history_provider_identities
        WHERE artist_key=ANY($1::text[]) ORDER BY artist_key
      `, [[...input.artistKeys]]),
      pool.query<Record<string, string | number | null>>(`
        SELECT artist_key, snapshot_date, fetched_at::text,
               spotify_followers, spotify_monthly_listeners, spotify_popularity,
               youtube_subscribers, youtube_channel_views, instagram_followers,
               tiktok_followers, facebook_followers, twitter_followers,
               soundcloud_followers, deezer_followers
        FROM songstats_artist_daily_snapshots
        WHERE artist_key=ANY($1::text[]) ORDER BY artist_key, snapshot_date
      `, [[...input.artistKeys]]),
      pool.query<{ artist_key: string; historic_stats: unknown; audience: unknown; audience_details: unknown; catalog: unknown }>(`
        SELECT artist_key, historic_stats, audience, audience_details, catalog
        FROM songstats_artist_extended_data WHERE artist_key=ANY($1::text[])
      `, [[...input.artistKeys]]),
      pool.query<{ options: Record<string, unknown>; started_at: string }>(`
        SELECT options, started_at::text FROM songstats_history_import_runs WHERE run_id=$1
      `, [input.runId]),
    ]);
  const runRow = run.rows[0];
  if (!runRow) throw new Error("Approved Songstats validation import run was not found");
  const baseline = runRow.options["baselineStorage"] as Record<string, unknown> | undefined;
  if (!baseline) throw new Error("Songstats validation run is missing its storage baseline");
  const databaseBytesBefore = Number(baseline["databaseBytes"] ?? 0);
  const storageBefore = {
    observations: Number(baseline["observations"] ?? 0),
    tableBytes: Number(baseline["tableBytes"] ?? 0),
    indexBytes: Number(baseline["indexBytes"] ?? 0),
    totalBytes: Number(baseline["totalBytes"] ?? 0),
  };
  const databaseBytesAfter = Number(database.rows[0]?.database_bytes ?? 0);
  const historicalObservation = (row: (typeof stored)[number]): MonitoringHistoricalObservation => ({
    metricKey: row.metric_key,
    date: row.provider_observation_date,
    value: Number(row.value),
    provenance: {
      provider: "songstats",
      source: row.source,
      granularity: "daily",
      acquisitionMode: "songstats_historical",
      providerObservationDate: row.provider_observation_date,
      providerObservationAt: null,
      fetchedAt: row.fetched_at,
      identityValidationStatus: row.identity_validation_status,
      requestWindowStartDate: row.request_window_start_date,
      requestWindowEndDate: row.request_window_end_date,
      importRunId: String(row.provenance["importRunId"] ?? ""),
      responseHash: String(row.provenance["responseHash"] ?? ""),
      details: row.provenance,
    },
  });
  const scheduled: MonitoringHistoricalObservation[] = snapshots.rows.flatMap(row =>
    Object.entries(SNAPSHOT_COLUMNS).flatMap(([metricKey, column]) => {
      const value = Number(row[column]);
      if (!Number.isFinite(value) || row[column] == null) return [];
      const date = String(row["snapshot_date"]);
      return [{
        metricKey,
        date,
        value,
        provenance: {
          provider: "mexico_charts",
          source: "songstats_current_snapshot",
          granularity: "daily" as const,
          acquisitionMode: "scheduled_current_snapshot" as const,
          providerObservationDate: date,
          providerObservationAt: null,
          fetchedAt: String(row["fetched_at"]),
          identityValidationStatus: "verified" as const,
        },
      }];
    }),
  );

  const byArtist = Object.fromEntries(input.artistKeys.map(artistKey => {
    const artistObservations = stored
      .filter(row => row.artist_key === artistKey && row.provenance["ingestionStatus"] === "active")
      .map(historicalObservation);
    const native = scheduled.filter(point => snapshots.rows.some(row =>
      row["artist_key"] === artistKey && row["snapshot_date"] === point.date,
    ));
    const fullAssembly = assembleMonitoringHistory([...artistObservations, ...native]);
    const catalogRow = catalogRows.rows.find(row => row.artist_key === artistKey);
    const catalog = catalogRow ? buildSongstatsPublicInsight({
      historicStats: catalogRow.historic_stats,
      audience: catalogRow.audience,
      audienceDetails: catalogRow.audience_details,
      catalog: catalogRow.catalog,
    }, { access: "monitoring" }).catalog : null;
    const releaseDate = catalog?.newestReleaseDate ?? null;
    const releaseImpact = releaseDate ? releaseImpactFromAvailableHistory({
      releaseDate,
      series: fullAssembly,
      metricKeys: Object.keys(fullAssembly),
    }) : null;
    const summarized = Object.fromEntries(Object.entries(fullAssembly).map(([metricKey, series]) => [
      metricKey,
      {
        earliestAvailableDate: series.earliestAvailableDate,
        latestAvailableDate: series.latestAvailableDate,
        points: series.points.length,
        missingDateCount: series.missingDateCount,
        missingIntervals: series.missingIntervals,
        growth: series.growth,
        historicalPeak: series.historicalPeak,
        multiYear: series.multiYear,
        selectedAcquisitionModes: [...new Set(series.points.map(point => point.provenance.acquisitionMode))],
        selectedGranularities: [...new Set(series.points.map(point => point.provenance.granularity))],
        retainedAlternatives: series.points.reduce((sum, point) => sum + point.alternatives.length, 0),
      },
    ]));
    return [artistKey, {
      metrics: summarized,
      fullAvailablePointCount: Object.values(fullAssembly).reduce((sum, series) => sum + series.points.length, 0),
      assembledPayloadBytes: Buffer.byteLength(JSON.stringify(fullAssembly)),
      latestReleaseDate: releaseDate,
      releaseImpact,
      provenanceModesPresent: [...new Set([...artistObservations, ...native].map(point => point.provenance.acquisitionMode))],
      songstatsGranularities: [...new Set(artistObservations.map(point => point.provenance.granularity))],
    }];
  }));

  const coverageGroups = new Map<string, { artistKey: string; source: string; metricKey: string; status: string; dates: string[] }>();
  for (const row of stored) {
    const status = String(row.provenance["ingestionStatus"] ?? "active");
    const key = `${row.artist_key}\u0000${row.source}\u0000${row.metric_key}`;
    const existing = coverageGroups.get(key) ?? {
      artistKey: row.artist_key, source: row.source, metricKey: row.metric_key,
      status, dates: [],
    };
    existing.dates.push(row.provider_observation_date);
    coverageGroups.set(key, existing);
  }
  const coverage = [...coverageGroups.values()].map(group => {
    const dates = [...new Set(group.dates)].sort();
    const earliest = dates[0] ?? null;
    const latest = dates.at(-1) ?? null;
    const years = new Set(dates.map(date => Number(date.slice(0, 4))));
    return {
      artistKey: group.artistKey,
      source: group.source,
      metricKey: group.metricKey,
      ingestionStatus: group.status,
      earliestDate: earliest,
      latestDate: latest,
      observations: dates.length,
      historicalDepthDays: earliest && latest ? dayNumber(latest) - dayNumber(earliest) + 1 : 0,
      missingIntervals: missingIntervals(dates),
      reaches: Object.fromEntries([2020, 2021, 2022, 2023, 2024, 2025, 2026]
        .map(year => [year, years.has(year)])),
    };
  });

  const streams = stored.filter(row =>
    row.metric_key === "spotifyStreams" || row.metric_key === "spotifyStreamsCurrent",
  );
  const streamPairs = new Map<string, { total?: string; current?: string }>();
  for (const row of streams) {
    const key = `${row.artist_key}:${row.provider_observation_date}`;
    const pair = streamPairs.get(key) ?? {};
    if (row.metric_key === "spotifyStreams") pair.total = row.value;
    else pair.current = row.value;
    streamPairs.set(key, pair);
  }
  const comparable = [...streamPairs.values()].filter(pair => pair.total != null && pair.current != null);
  const identical = comparable.filter(pair => Number(pair.total) === Number(pair.current)).length;

  const requestEvents = chunks.rows.flatMap(chunk => {
    const raw = chunk.acquisition_metadata?.["requestAttempts"];
    return Array.isArray(raw) ? raw : [];
  });
  const relationTotals = relations.rows.map(row => ({
    table: row.table_name,
    heapBytes: Number(row.heap_bytes),
    indexBytes: Number(row.index_bytes),
    totalBytes: Number(row.total_bytes),
  }));
  const startedAtMs = Date.parse(runRow.started_at);
  const elapsedSeconds = Math.max(0.001, (Date.now() - startedAtMs) / 1_000);
  const inserted = storageAfter.observations - storageBefore.observations;
  return {
    runId: input.runId,
    identities: identities.rows,
    chunks: chunks.rows,
    coverage,
    streamsCurrentComparison: {
      comparablePoints: comparable.length,
      identicalPoints: identical,
      differentPoints: comparable.length - identical,
      classification: comparable.length === 0 ? "insufficient_data"
        : identical === comparable.length ? "identical_redundant"
          : "distinct_or_ambiguous_requires_review",
      subscriberServing: false,
    },
    storage: {
      databaseBytesBefore,
      databaseBytesAfter,
      databaseGrowthBytes: databaseBytesAfter - databaseBytesBefore,
      observationsBefore: storageBefore.observations,
      observationsAfter: storageAfter.observations,
      insertedObservations: inserted,
      observationHeapGrowthBytes: storageAfter.tableBytes - storageBefore.tableBytes,
      observationIndexGrowthBytes: storageAfter.indexBytes - storageBefore.indexBytes,
      observationRelationGrowthBytes: storageAfter.totalBytes - storageBefore.totalBytes,
      bytesPerObservation: inserted > 0
        ? (storageAfter.totalBytes - storageBefore.totalBytes) / inserted
        : null,
      compactRelations: relationTotals,
    },
    execution: {
      baseRequests: chunks.rows.filter(chunk => chunk.attempt_count > 0).length,
      totalHttpAttempts: requestEvents.filter(event =>
        event != null && typeof event === "object" &&
        (event as Record<string, unknown>)["outcome"] === "started",
      ).length,
      retries: requestEvents.filter(event =>
        event != null && typeof event === "object" &&
        (event as Record<string, unknown>)["outcome"] === "started" &&
        Number((event as Record<string, unknown>)["attempt"]) > 1,
      ).length,
      failedChunks: chunks.rows.filter(chunk => chunk.status === "failed"),
      elapsedSeconds,
      insertThroughputRowsPerSecond: inserted / elapsedSeconds,
      reportingQueryLatencyMs: elapsedMs(queryStarted),
    },
    monitorAssembly: byArtist,
    safety: {
      endpoint: "/artists/historic_stats",
      outsideScopeEndpoints: [],
      acquisitionMode: "songstats_historical",
      providerGranularity: "daily",
      quarantinedMetricServed: false,
      nativeTablesWritten: false,
    },
  };
}
