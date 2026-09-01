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

