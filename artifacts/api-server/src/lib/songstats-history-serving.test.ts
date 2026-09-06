import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPACT_HISTORY_INDEX_EXPECTATION,
  loadCompactMonitoringMetricHistory,
} from "./songstats-history-serving";

test("compact metric history excludes quarantined definitions and returns bounded reference tuples", async () => {
  const rows = Array.from({ length: 1_000 }, (_, index) => {
    const date = new Date("2023-01-01T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      value: String(1_000 + index),
      import_chunk_id: 10 + Math.floor(index / 365),
      provider_identity_id: 3,
      songstats_artist_id: "provider-id",
      validation_status: "verified" as const,
      metric_definition_id: 4,
      source: "spotify",
      provider_field: "streams_total",
      metric_key: "spotifyStreams",
      label: "Spotify aggregate streams",
      unit: "count",
      behavior: "cumulative",
      definition_version: 1,
      response_hash: "a".repeat(64),
      window_start_date: date.toISOString().slice(0, 4) + "-01-01",
      window_end_date: date.toISOString().slice(0, 4) + "-12-31",
      parser_version: 1,
      schema_version: 2,
      fetched_at: "2026-09-01T00:00:00Z",
    };
  });
  const queries: string[] = [];
  const queryable = {
    async query<T>(sql: string) {
      queries.push(sql);
      if (sql.includes("WITH active_definitions")) {
        return { rows: [{
          metric_definition_id: 4,
          source: "spotify", provider_field: "streams_total", metric_key: "spotifyStreams",
          label: "Spotify aggregate streams", unit: "count", behavior: "cumulative",
          definition_version: 1, earliest_date: "2023-01-01", latest_date: "2025-09-26",
          observation_count: "1000", missing_date_count: "0", gap_count: "0",
          latest_value: "1999", peak_value: "1999", peak_date: "2025-09-26",
          baseline_7_date: "2025-09-19", baseline_7_value: "1992",
          baseline_30_date: "2025-08-27", baseline_30_value: "1969",
          baseline_90_date: "2025-06-28", baseline_90_value: "1909",
          baseline_182_date: "2025-03-28", baseline_182_value: "1817",
          baseline_365_date: "2024-09-26", baseline_365_value: "1634",
        }] as T[] };
      }
      assert.match(sql, /definition\.ingestion_status='active'/);
      return { rows: rows as T[] };
    },
  };
  const response = await loadCompactMonitoringMetricHistory({
    artistKey: "artist", metricKey: "spotifyStreams", range: "all",
    resolution: "auto", maximumDisplayPoints: 400, queryable: queryable as never,
  });
  assert.equal(response.status, "available");
  assert.equal(response.resolution.exactSourcePoints, 1_000);
  assert.ok(response.points.length <= 400);
  assert.equal(response.pointTuple[2], "provenanceRef");
  assert.ok(response.provenance.references.length <= 3);
  assert.ok(queries.every(sql => !sql.includes("streams_current")));
});

test("the existing compact uniqueness index matches the serving range query", () => {
  assert.equal(COMPACT_HISTORY_INDEX_EXPECTATION.index, "songstats_history_observation_provenance_unique");
  assert.deepEqual(COMPACT_HISTORY_INDEX_EXPECTATION.keys.slice(0, 3), [
    "artist_key", "metric_definition_id", "provider_observation_date",
  ]);
});


function scheduledOverview() {
  return {
    artistKey: "luismiguel",
    metrics: [{
      metricDefinitionRef: "metric:1", metricKey: "spotifyFollowers", source: "spotify",
      providerField: "followers_total", label: "Spotify followers", unit: "count", behavior: "cumulative",
      definitionVersion: 1, status: "unavailable", earliestAvailableDate: null, latestAvailableDate: null,
    }],
  } as unknown as Awaited<ReturnType<typeof import("./songstats-history-serving").loadCompactMonitoringHistoryOverview>>;
}

test("history preserves vetted aliases and scheduled provenance without inventing absent range data", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const queryable = {
    async query(sql: string, values: unknown[]) {
      queries.push({ sql, values });
      assert.deepEqual(values[0], ["luismiguel", "luis-miguel"]);
      assert.match(sql, /artist_key=ANY\(\$1::text\[\]\)/);
      if (sql.includes("min(snapshot_date)")) {
        return { rows: [{ earliest_date: "2026-06-01", latest_date: "2026-09-01", observations: "2" }] };
      }
      if (sql.includes("songstats_historical_observations")) return { rows: [] };
      return { rows: values[1] === "2025-01-01" ? [] : [{
        artist_key: "luis-miguel", date: "2026-09-01", value: "150", fetched_at: "2026-09-01T23:00:00Z",
      }] };
    },
  };
  const input = {
    artistKey: "luismiguel", artistKeys: ["luis-miguel", "luismiguel"], metricKey: "spotifyFollowers",
    queryable: queryable as never, overview: scheduledOverview(),
  };
  const result = await loadCompactMonitoringMetricHistory(input);
  assert.equal(result.status, "available");
  assert.deepEqual(result.points[0]?.slice(0, 2), ["2026-09-01", 150]);
  assert.ok(result.points[0]?.[2].includes("luis-miguel"));
  assert.equal(result.availabilityBySource.songstatsHistorical, "unavailable");
  assert.equal(result.availabilityBySource.mexicoChartsScheduled, "available");
  const empty = await loadCompactMonitoringMetricHistory({
    ...input, range: "custom", startDate: "2025-01-01", endDate: "2025-01-10",
  });
  assert.equal(empty.status, "unavailable");
  assert.deepEqual(empty.points, []);
  assert.equal(queries.length, 6);
});

test("invalid calendar ranges and expired budgets issue no database reads", async () => {
  const { MonitoringHistoryBudgetError } = await import("./songstats-history-serving");
  const queryable = { async query() { throw new Error("Unexpected read"); } };
  await assert.rejects(loadCompactMonitoringMetricHistory({
    artistKey: "artist", metricKey: "spotifyFollowers", range: "custom",
    startDate: "2026-02-30", endDate: "2026-03-10", queryable: queryable as never,
  }), /Custom history range/);
  await assert.rejects(loadCompactMonitoringMetricHistory({
    artistKey: "artist", metricKey: "spotifyFollowers", deadlineAt: Date.now() - 1,
    queryable: queryable as never,
  }), MonitoringHistoryBudgetError);
});

test("a read failure remains a failure rather than a successful empty history", async () => {
  const error = Object.assign(new Error("relation missing"), { code: "42P01" });
  await assert.rejects(loadCompactMonitoringMetricHistory({
    artistKey: "artist", metricKey: "spotifyFollowers", overview: scheduledOverview(),
    queryable: { async query() { throw error; } } as never,
  }), candidate => candidate === error);
});

test("release impact reuses its overview, bounds simultaneous reads, and isolates failures", async () => {
  const { loadCompactReleaseImpact } = await import("./songstats-history-serving");
  const { RELEASE_IMPACT_ELIGIBLE_METRICS } = await import("./monitoring-history-compact");
  const overview = scheduledOverview();
  overview.metrics = Object.keys(RELEASE_IMPACT_ELIGIBLE_METRICS).map(metricKey => ({
    ...overview.metrics[0]!, metricKey, status: "available" as const,
    earliestAvailableDate: "2026-01-01", latestAvailableDate: "2026-09-01",
  }));
  let active = 0;
  let maximumActive = 0;
  let reads = 0;
  const queryable = {
    async query(sql: string, values: unknown[]) {
      assert.ok(!sql.includes("WITH active_definitions"), "provided overview must be reused");
      active += 1;
      reads += 1;
      maximumActive = Math.max(maximumActive, active);
      try {
        await new Promise(resolve => setImmediate(resolve));
        if (values[1] === "spotifyStreams") throw new Error("safe simulated read failure");
        return { rows: [] };
      } finally { active -= 1; }
    },
  };
  const result = await loadCompactReleaseImpact({
    artistKey: "artist", releaseDate: "2026-05-01", overview, queryable: queryable as never,
  });
  assert.ok(reads > 7);
  assert.ok(maximumActive <= 2);
  assert.equal(result.metrics.length, 7);
  assert.equal(result.metrics.find(metric => metric.metricKey === "spotifyStreams")?.status, "failed");
  assert.equal(result.availableMetricCount, 0);
});

test("release impact stops scheduling reads when its caller's budget is exhausted", async () => {
  const { loadCompactReleaseImpact } = await import("./songstats-history-serving");
  const overview = scheduledOverview();
  overview.metrics.push({ ...overview.metrics[0]!, metricKey: "spotifyMonthlyListeners" });
  let clock = 100;
  let reads = 0;
  const originalNow = Date.now;
  Date.now = () => clock;
  try {
    const result = await loadCompactReleaseImpact({
      artistKey: "artist", releaseDate: "2026-05-01", overview, deadlineAt: 200,
      queryable: { async query() { reads += 1; clock = 250; return { rows: [] }; } } as never,
    });
    assert.ok(reads <= 2);
    assert.ok(result.metrics.some(metric => metric.status === "budget_exhausted"));
  } finally { Date.now = originalNow; }
});

test("scheduled multi-year display returns provenance only for transported points", async () => {
  const snapshots = Array.from({ length: 1_000 }, (_, index) => {
    const date = new Date("2023-01-01T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + index);
    return {
      artist_key: "luismiguel", date: date.toISOString().slice(0, 10), value: String(1_000 + index),
      fetched_at: "2026-09-01T23:00:00Z",
    };
  });
  const result = await loadCompactMonitoringMetricHistory({
    artistKey: "luismiguel", metricKey: "spotifyFollowers", overview: scheduledOverview(),
    queryable: {
      async query(sql: string) {
        if (sql.includes("min(snapshot_date)")) return { rows: [{
          earliest_date: snapshots[0]!.date, latest_date: snapshots.at(-1)!.date, observations: "1000",
        }] };
        if (sql.includes("songstats_historical_observations")) return { rows: [] };
        return { rows: snapshots };
      },
    } as never,
  });
  assert.equal(result.resolution?.exactSourcePoints, 1_000);
  assert.ok(result.points.length <= 400);
  assert.equal(result.provenance?.references.length, result.points.length);
  const references = new Set(result.provenance?.references.map(reference => reference.ref));
  assert.ok(result.points.every(point => references.has(point[2])));
});
