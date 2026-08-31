import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSongstatsHistoricStats,
  planSongstatsHistoryBackfill,
  SONGSTATS_HISTORY_ACTIVE_METRICS,
  SONGSTATS_HISTORY_QUARANTINED_METRICS,
  yearlySongstatsHistoryWindows,
} from "./songstats-history-model";

const payload = {
  result: "success",
  artist_info: {
    songstats_artist_id: "songstats-test-1",
    name: "Test Artist",
  },
  stats: [
    {
      source: "spotify",
      data: {
        history: [
          {
            date: "2020-01-01",
            followers_total: 100,
            monthly_listeners_current: 1_000,
            playlists_current: 20,
          },
          {
            date: "2020-12-31",
            followers_total: 200,
            monthly_listeners_current: 2_000,
            playlists_current: 30,
          },
        ],
      },
    },
    {
      source: "youtube",
      data: {
        history: [
          { date: "2020-01-01", subscribers_total: 50, video_views_total: 10_000 },
        ],
      },
    },
  ],
};

test("plans inclusive calendar-year chunks from 2020 without imposing a 90-day cap", () => {
  assert.deepEqual(yearlySongstatsHistoryWindows("2020-06-10", "2022-02-03"), [
    { year: 2020, startDate: "2020-06-10", endDate: "2020-12-31" },
    { year: 2021, startDate: "2021-01-01", endDate: "2021-12-31" },
    { year: 2022, startDate: "2022-01-01", endDate: "2022-02-03" },
  ]);
  const plan = planSongstatsHistoryBackfill({
    artistCount: 529,
    startDate: "2020-01-01",
    endDate: "2026-08-31",
    metricCount: 10,
  });
  assert.equal(plan.requestsPerArtist, 7);
  assert.equal(plan.plannedRequestCount, 3_703);
  assert.equal(plan.storageUpperBound.observationCount, 12_881_150);
  assert.deepEqual(plan.endpoint, "/artists/historic_stats");
  assert.ok(plan.excludedEndpoints.includes("/tracks/historic_stats"));
});

test("normalizes only allow-listed Artist Historical Stats fields with exact provenance", () => {
  const fetchedAt = new Date("2026-08-31T12:00:00Z");
  const result = normalizeSongstatsHistoricStats({
    artistKey: "test-artist",
    spotifyArtistId: "spotify-test-1",
    expectedSongstatsArtistId: "songstats-test-1",
    requestIdentityType: "songstats_artist_id",
    requestIdentityValue: "songstats-test-1",
    windowStartDate: "2020-01-01",
    windowEndDate: "2020-12-31",
    fetchedAt,
    importRunId: "run-test",
    payload,
  });

  assert.equal(result.identityValidationStatus, "verified");
  assert.equal(result.observations.length, 8);
  const listeners = result.observations.find(observation =>
    observation.metricDefinition.metricKey === "spotifyMonthlyListeners"
    && observation.providerObservationDate === "2020-01-01"
  );
  assert.equal(listeners?.granularity, "daily");
  assert.equal(listeners?.acquisitionMode, "songstats_historical");
  assert.equal(listeners?.metricDefinition.providerField, "monthly_listeners_current");
});

test("activates all 48 useful definitions and quarantines only streams_current", () => {
  assert.equal(SONGSTATS_HISTORY_ACTIVE_METRICS.length, 48);
  assert.deepEqual(
    SONGSTATS_HISTORY_QUARANTINED_METRICS.map(metric => metric.metricKey),
    ["spotifyStreamsCurrent"],
  );
});

test("does not ingest streams_current outside controlled representative test mode", () => {
  const streamPayload = {
    ...payload,
    stats: [{
      source: "spotify",
      data: { history: [{ date: "2020-01-01", streams_total: 1000, streams_current: 1000 }] },
    }],
  };
  const base = {
    artistKey: "test-artist",
    spotifyArtistId: "spotify-test-1",
    expectedSongstatsArtistId: "songstats-test-1",
    requestIdentityType: "songstats_artist_id" as const,
    requestIdentityValue: "songstats-test-1",
    windowStartDate: "2020-01-01",
    windowEndDate: "2020-12-31",
    fetchedAt: new Date("2026-08-31T12:00:00Z"),
    importRunId: "run-test",
    payload: streamPayload,
  };
  const normal = normalizeSongstatsHistoricStats(base);
  assert.deepEqual(normal.observations.map(point => point.metricDefinition.metricKey), ["spotifyStreams"]);
  const representativeTest = normalizeSongstatsHistoricStats({ ...base, includeQuarantined: true });
  assert.deepEqual(
    representativeTest.observations.map(point => point.metricDefinition.metricKey).sort(),
    ["spotifyStreams", "spotifyStreamsCurrent"],
  );
});

test("blocks import when returned Songstats identity differs from saved identity", () => {
  const result = normalizeSongstatsHistoricStats({
    artistKey: "test-artist",
    spotifyArtistId: "spotify-test-1",
    expectedSongstatsArtistId: "different-songstats-id",
    requestIdentityType: "spotify_artist_id",
    requestIdentityValue: "spotify-test-1",
    windowStartDate: "2020-01-01",
    windowEndDate: "2020-12-31",
    fetchedAt: new Date(),
    importRunId: "run-test",
    payload,
  });
  assert.equal(result.identityValidationStatus, "rejected");
  assert.deepEqual(result.observations, []);
});
