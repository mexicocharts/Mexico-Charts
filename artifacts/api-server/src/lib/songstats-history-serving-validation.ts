import { gzipSync } from "node:zlib";
import { pool, type PoolClient } from "@workspace/db";
import { buildSongstatsPublicInsight } from "./songstats-public-service";
import {
  COMPACT_HISTORY_INDEX_EXPECTATION,
  loadCompactMonitoringHistoryOverview,
  loadCompactMonitoringMetricHistory,
  loadCompactReleaseImpact,
} from "./songstats-history-serving";

type Queryable = Pick<PoolClient, "query">;

const EXPANDED_BASELINES = Object.freeze({
  pesopluma: 104_969_373,
  bandamsdesergiolizarraga: 111_269_142,
  netonvega: 61_855_775,
});

function size(value: unknown) {
  const json = JSON.stringify(value);
  return { jsonBytes: Buffer.byteLength(json), gzipBytes: gzipSync(json).byteLength };
}

async function measured<T>(operation: () => Promise<T>) {
  const started = process.hrtime.bigint();
  const result = await operation();
  return { result, latencyMs: Number(process.hrtime.bigint() - started) / 1_000_000 };
}

export async function buildCompactServingPerformanceReport(input: {
  artistKeys: readonly string[];
  queryable?: Queryable;
}) {
  const queryable = input.queryable ?? pool;
  const memoryBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();
  const artists: Record<string, unknown> = {};
  for (const artistKey of input.artistKeys) {
    const overviewMeasured = await measured(() =>
      loadCompactMonitoringHistoryOverview(artistKey, queryable));
    const overview = overviewMeasured.result;
    const available = overview.metrics.filter(metric => metric.status === "available");
    const primaryMetric = available.find(metric => metric.metricKey === "spotifyFollowers")
      ?? available[0];
    const scenarios: Record<string, unknown> = {};
    if (primaryMetric) {
      for (const range of ["30d", "90d", "1y", "all"] as const) {
        const scenario = await measured(() => loadCompactMonitoringMetricHistory({
          artistKey,
          metricKey: primaryMetric.metricKey,
          range,
          resolution: "auto",
          maximumDisplayPoints: 400,
          queryable,
          overview,
        }));
        scenarios[range] = {
          metricKey: primaryMetric.metricKey,
          latencyMs: scenario.latencyMs,
          ...size(scenario.result),
          exactSourcePoints: scenario.result.status === "available"
            ? scenario.result.resolution.exactSourcePoints : 0,
          returnedDisplayPoints: scenario.result.status === "available"
            ? scenario.result.resolution.returnedDisplayPoints : 0,
          resolution: scenario.result.status === "available"
            ? scenario.result.resolution.method : null,
        };
      }
    }
    const switchingMetrics = available.slice(0, 8);
    const switchStarted = process.hrtime.bigint();
    const switchResults = [];
    for (const metric of switchingMetrics) {
      const response = await loadCompactMonitoringMetricHistory({
        artistKey, metricKey: metric.metricKey, range: "90d", resolution: "auto",
        queryable, overview,
      });
      switchResults.push({ metricKey: metric.metricKey, ...size(response) });
    }
    const releaseRow = await queryable.query<{ catalog: unknown }>(`
      SELECT catalog FROM songstats_artist_extended_data
      WHERE artist_key=$1 ORDER BY updated_at DESC LIMIT 1
    `, [artistKey]);
    const catalog = releaseRow.rows[0]
      ? buildSongstatsPublicInsight({
          historicStats: null,
          audience: null,
          audienceDetails: null,
          catalog: releaseRow.rows[0].catalog,
        }, { access: "monitoring" }).catalog
      : null;
    const releaseImpact = catalog?.newestReleaseDate
      ? await measured(() => loadCompactReleaseImpact({
          artistKey, releaseDate: catalog.newestReleaseDate!, queryable,
        }))
      : null;
    const compactInitialBytes = size(overview);
    const expandedBytes = EXPANDED_BASELINES[artistKey as keyof typeof EXPANDED_BASELINES] ?? null;
    artists[artistKey] = {
      initialOverview: {
        latencyMs: overviewMeasured.latencyMs,
        ...compactInitialBytes,
        metrics: overview.metricCount,
        availableMetrics: overview.availableMetricCount,
        pointsIncluded: 0,
      },
      selectedMetric: primaryMetric?.metricKey ?? null,
      scenarios,
      rapidMetricSwitching: {
        requests: switchResults.length,
        elapsedMs: Number(process.hrtime.bigint() - switchStarted) / 1_000_000,
        responses: switchResults,
      },
      releaseImpact: releaseImpact ? {
        latencyMs: releaseImpact.latencyMs,
        ...size(releaseImpact.result),
        result: releaseImpact.result,
      } : null,
      comparison: {
        expandedBytes,
        compactInitialBytes: compactInitialBytes.jsonBytes,
        reductionFactor: expandedBytes ? expandedBytes / compactInitialBytes.jsonBytes : null,
      },
    };
  }

  const concurrentStarted = process.hrtime.bigint();
  const concurrent = await Promise.all(
    Array.from({ length: 2 }, () => input.artistKeys.map(artistKey =>
      loadCompactMonitoringHistoryOverview(artistKey, queryable))).flat(),
  );
  const concurrentElapsedMs = Number(process.hrtime.bigint() - concurrentStarted) / 1_000_000;

  const representativeArtist = input.artistKeys[0]!;
  const plan = await queryable.query<{ "QUERY PLAN": unknown }>(`
    EXPLAIN (FORMAT JSON)
    SELECT provider_observation_date, value, import_chunk_id
    FROM songstats_historical_observations
    WHERE artist_key=$1
      AND metric_definition_id=(
        SELECT id FROM songstats_history_metric_definitions
        WHERE metric_key='spotifyFollowers' AND ingestion_status='active' LIMIT 1
      )
      AND provider_observation_date BETWEEN DATE '2025-01-01' AND DATE '2026-09-01'
      AND acquisition_mode='songstats_historical'
    ORDER BY provider_observation_date
  `, [representativeArtist]);
  const planJson = plan.rows[0]?.["QUERY PLAN"] ?? null;
  const planText = JSON.stringify(planJson);
  const memoryAfter = process.memoryUsage();
  const cpu = process.cpuUsage(cpuBefore);
  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    songstatsApiCalls: 0,
    databaseWrites: 0,
    artists,
    concurrency: {
      requests: concurrent.length,
      elapsedMs: concurrentElapsedMs,
      combinedJsonBytes: concurrent.reduce((sum, response) => sum + size(response).jsonBytes, 0),
    },
    queryPlan: {
      expectedIndex: COMPACT_HISTORY_INDEX_EXPECTATION,
      expectedIndexUsed: planText.includes(COMPACT_HISTORY_INDEX_EXPECTATION.index),
      plan: planJson,
    },
    process: {
      residentSetDeltaBytes: memoryAfter.rss - memoryBefore.rss,
      heapUsedDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed,
      cpuUserMicroseconds: cpu.user,
      cpuSystemMicroseconds: cpu.system,
    },
    baseline: {
      expandedCombinedBytes: Object.values(EXPANDED_BASELINES).reduce((sum, value) => sum + value, 0),
      expandedAssemblyLatencyMs: 12_460,
    },
  };
}
