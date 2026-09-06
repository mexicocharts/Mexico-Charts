import assert from "node:assert/strict";
import test from "node:test";
import { loadCompactMonitoringHistoryOverview, loadCompactMonitoringMetricHistory } from "./songstats-history-serving";

// Optional real-PostgreSQL fixture: point this at a locally installed PGlite
// module. It never connects to an application database or uses provider data.
const fixtureModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];

test("PostgreSQL overview and series agree on verified aliases, daily coverage, and growth", {
  skip: !fixtureModule,
}, async () => {
  const { PGlite } = await import(fixtureModule!);
  const database = new PGlite();
  try {
    await database.exec(`
      CREATE TABLE songstats_history_metric_definitions (
        id int PRIMARY KEY, source text, provider_field text, metric_key text,
        label text, unit text, behavior text, definition_version int, ingestion_status text
      );
      CREATE TABLE songstats_history_provider_identities (
        id int PRIMARY KEY, songstats_artist_id text, validation_status text
      );
      CREATE TABLE songstats_history_import_chunks (
        id int PRIMARY KEY, response_hash text, window_start_date date, window_end_date date,
        parser_version int, schema_version int
      );
      CREATE TABLE songstats_historical_observations (
        artist_key text, metric_definition_id int, provider_identity_id int,
        provider_observation_date date, value numeric, acquisition_mode text,
        import_chunk_id int, fetched_at timestamptz
      );
      CREATE INDEX history_fixture_range_idx ON songstats_historical_observations
        (artist_key, metric_definition_id, provider_observation_date, acquisition_mode);
      CREATE TABLE songstats_artist_daily_snapshots (
        artist_key text, snapshot_date date, spotify_followers numeric, fetched_at timestamptz
      );
      INSERT INTO songstats_history_metric_definitions VALUES
        (1, 'spotify', 'followers_total', 'spotifyFollowers', 'Followers', 'count', 'cumulative', 1, 'active'),
        (2, 'tiktok', 'followers_total', 'tiktokFollowers', 'Followers', 'count', 'cumulative', 1, 'quarantined');
      INSERT INTO songstats_history_provider_identities VALUES
        (1, 'verified-artist', 'verified'), (2, 'unverified-artist', 'unverified');
      INSERT INTO songstats_history_import_chunks VALUES
        (1, 'synthetic-fixture', '2026-09-01', '2026-09-30', 1, 1);
      INSERT INTO songstats_historical_observations VALUES
        ('canonical', 1, 1, '2026-09-01', 100, 'songstats_historical', 1, '2026-09-01T23:00:00Z'),
        ('known-alias', 1, 1, '2026-09-01', 9000000, 'songstats_historical', 1, '2026-09-02T23:00:00Z'),
        ('known-alias', 1, 1, '2026-09-04', 150, 'songstats_historical', 1, '2026-09-04T23:00:00Z'),
        ('canonical', 1, 1, '2026-09-08', 200, 'songstats_historical', 1, '2026-09-08T23:00:00Z'),
        ('canonical', 1, 2, '2026-09-09', 99999999, 'songstats_historical', 1, '2026-09-09T23:00:00Z'),
        ('canonical', 2, 1, '2026-09-10', 99999999, 'songstats_historical', 1, '2026-09-10T23:00:00Z'),
        ('other-artist', 1, 1, '2026-09-10', 99999999, 'songstats_historical', 1, '2026-09-10T23:00:00Z');
    `);
    const overview = await loadCompactMonitoringHistoryOverview("canonical", database, undefined, ["known-alias"]);
    assert.equal(overview.metricCount, 1);
    const metric = overview.metrics[0]!;
    assert.equal(metric.observationCount, 3);
    assert.equal(metric.earliestAvailableDate, "2026-09-01");
    assert.equal(metric.latestAvailableDate, "2026-09-08");
    assert.equal(metric.coverage.missingDateCount, 5);
    assert.equal(metric.coverage.gapCount, 2);
    assert.equal(metric.historicalPeak?.value, 200);
    assert.equal(metric.historicalPeak?.date, "2026-09-08");
    assert.equal(metric.growth.days7?.absolute, 100);
    const series = await loadCompactMonitoringMetricHistory({
      artistKey: "canonical", artistKeys: ["known-alias"], metricKey: "spotifyFollowers",
      overview, queryable: database,
    });
    assert.deepEqual(series.points.map(point => point.slice(0, 2)), [
      ["2026-09-01", 100], ["2026-09-04", 150], ["2026-09-08", 200],
    ]);
    assert.equal(series.rangeCoverage?.observationCount, metric.observationCount);
    assert.equal(series.derived?.days7?.absolute, metric.growth.days7?.absolute);
    assert.equal(series.derived?.historicalPeak?.value, metric.historicalPeak?.value);
    assert.equal(series.points[0]?.[3]?.[0]?.value, 9000000, "keep alias alternatives explicit");

    // Exercise the same single-artist plan over twenty metrics / ten years.
    await database.exec(`
      INSERT INTO songstats_history_metric_definitions
        SELECT id, 'spotify', 'fixture_field_' || id, 'fixtureMetric' || id,
               'Fixture metric', 'count', 'cumulative', 1, 'active'
        FROM generate_series(3, 22) id;
      INSERT INTO songstats_historical_observations
        SELECT 'large-fixture', metric, 1, day::date,
               (day::date - '2016-01-01'::date) + metric, 'songstats_historical', 1, now()
        FROM generate_series(3, 22) metric
        CROSS JOIN generate_series('2016-01-01'::date, '2025-12-31'::date, '1 day') day;
      ANALYZE songstats_historical_observations;
    `);
    const started = performance.now();
    const large = await loadCompactMonitoringHistoryOverview("large-fixture", database);
    const elapsed = performance.now() - started;
    assert.equal(large.availableMetricCount, 20);
    assert.equal(large.metrics.find(candidate => candidate.metricKey === "fixtureMetric3")?.observationCount, 3653);
    console.log(`Synthetic PostgreSQL fixture: 73,060 rows / 20 metrics / ten years; overview ${Math.round(elapsed)}ms`);
  } finally {
    await database.close();
  }
});
