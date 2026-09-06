import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLatestMonitoringStreamSummarySql,
  loadLatestMonitoringStreamSummary,
  loadMonitoringSpotifyHistory,
} from "./monitoring-stream-serving";

const fixtureModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
const schema = `
  CREATE TABLE monitoring_stream_daily_snapshots (
    artist_key text NOT NULL, item_type text NOT NULL, item_key text NOT NULL,
    snapshot_date date NOT NULL, total_streams bigint NOT NULL, daily_streams bigint NOT NULL,
    fetched_at timestamptz NOT NULL, PRIMARY KEY(artist_key,item_type,item_key,snapshot_date)
  );
  CREATE INDEX stream_fixture_artist_date_idx ON monitoring_stream_daily_snapshots(artist_key,snapshot_date DESC,item_type);
  CREATE TABLE monitoring_stream_daily_artist_summaries (
    artist_key text NOT NULL, snapshot_date date NOT NULL, track_count integer NOT NULL,
    album_count integer NOT NULL, track_daily_streams bigint NOT NULL, album_daily_streams bigint NOT NULL,
    track_total_streams bigint NOT NULL, album_total_streams bigint NOT NULL, fetched_at timestamptz NOT NULL,
    PRIMARY KEY(artist_key,snapshot_date)
  );
  CREATE TABLE spotify_kworb_daily_snapshots (
    id serial PRIMARY KEY, artist_key text NOT NULL, snapshot_date text NOT NULL,
    total_streams bigint, daily_streams bigint, track_count integer,
    source_type text NOT NULL, fetched_at timestamptz NOT NULL
  );
`;

async function fixture(run: (database: any) => Promise<void>) {
  const { PGlite } = await import(fixtureModule!);
  const database = new PGlite();
  try { await database.exec(schema); await run(database); }
  finally { await database.close(); }
}

const sampleRaw = `
  INSERT INTO monitoring_stream_daily_snapshots VALUES
    ('canonical','track','one','2026-09-02',100,10,'2026-09-02T12:00:00Z'),
    ('known-alias','track','one','2026-09-02',999999,999,'2026-09-02T13:00:00Z'),
    ('known-alias','track','zero','2026-09-02',0,0,'2026-09-02T12:00:00Z'),
    ('canonical','album','album-one','2026-09-02',50,5,'2026-09-02T12:00:00Z'),
    ('canonical','track','old-date-only','2026-09-01',999999,999,'2026-09-01T12:00:00Z'),
    ('other-artist','track','unrelated','2026-09-03',999999,999,'2026-09-03T12:00:00Z');
`;

test("PostgreSQL stream summary recovers the latest raw catalog without alias duplication or old-date filling", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(sampleRaw);
  const [summary] = await loadLatestMonitoringStreamSummary(database, ["canonical", "known-alias", "canonical"]);
  assert.equal(summary?.snapshot_date, "2026-09-02");
  assert.equal(summary?.track_count, 2);
  assert.equal(summary?.album_count, 1);
  assert.equal(Number(summary?.track_total_streams), 100);
  assert.equal(Number(summary?.track_daily_streams), 10);
  assert.equal(Number(summary?.album_total_streams), 50);
  assert.equal(Number(summary?.album_daily_streams), 5);
  assert.equal(summary?.source_table, "monitoring_stream_daily_snapshots");
  assert.equal(summary?.derivation, "sum_deduplicated_items");
  assert.equal(summary?.recovery_reason, "missing_materialized_summary");
  assert.deepEqual(summary?.source_artist_keys, ["canonical", "known-alias"]);
  assert.equal(new Date(summary!.fetched_at).toISOString(), "2026-09-02T12:00:00.000Z");

  const embedded = await database.query(`SELECT to_jsonb(summary) summary FROM
    (SELECT 'canonical'::text artist_key, ARRAY['known-alias']::text[] source_keys) c
    CROSS JOIN LATERAL (${buildLatestMonitoringStreamSummarySql("(ARRAY[c.artist_key] || c.source_keys)")}) summary`);
  assert.equal(embedded.rows[0]?.summary.track_count, 2);
}));

test("PostgreSQL stream summary respects snapshot date and observation freshness before source preference", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(sampleRaw);
  await database.exec(`INSERT INTO monitoring_stream_daily_artist_summaries VALUES
    ('canonical','2026-09-01',3,1,300,30,3000,300,'2026-09-05T00:00:00Z')`);
  let [summary] = await loadLatestMonitoringStreamSummary(database, ["canonical", "known-alias"]);
  assert.equal(summary?.source_table, "monitoring_stream_daily_snapshots", "a late fetch timestamp cannot make yesterday current");
  assert.equal(summary?.recovery_reason, "newer_raw_observations");
  await database.exec(`INSERT INTO monitoring_stream_daily_artist_summaries VALUES
    ('canonical','2026-09-02',2,1,9,4,90,40,'2026-09-02T11:00:00Z')`);
  [summary] = await loadLatestMonitoringStreamSummary(database, ["canonical", "known-alias"]);
  assert.equal(summary?.source_table, "monitoring_stream_daily_snapshots", "same-day stale summary must not hide updated raw observations");
  await database.exec(`UPDATE monitoring_stream_daily_artist_summaries SET fetched_at='2026-09-02T12:00:00Z'
    WHERE snapshot_date='2026-09-02'`);
  [summary] = await loadLatestMonitoringStreamSummary(database, ["canonical", "known-alias"]);
  assert.equal(summary?.source_table, "monitoring_stream_daily_artist_summaries", "materialized source wins an exact timestamp tie");
  assert.equal(summary?.recovery_reason, null);
  await database.exec(`INSERT INTO monitoring_stream_daily_artist_summaries VALUES
    ('canonical','2026-09-03',1,1,0,0,0,0,'2026-09-03T11:00:00Z'),
    ('known-alias','2026-09-03',10,10,999,999,9999,9999,'2026-09-03T12:00:00Z')`);
  [summary] = await loadLatestMonitoringStreamSummary(database, ["canonical", "known-alias"]);
  assert.equal(summary?.snapshot_date, "2026-09-03");
  assert.equal(Number(summary?.track_total_streams), 0);
  assert.equal(summary?.track_count, 1);
  assert.deepEqual(summary?.source_artist_keys, ["canonical"], "canonical identity determines same-day summary alias precedence");
}));

test("PostgreSQL stream summary distinguishes absent rows, real zeros, and missing schema", { skip: !fixtureModule }, async () => fixture(async database => {
  assert.deepEqual(await loadLatestMonitoringStreamSummary(database, ["canonical"]), []);
  await database.exec(`INSERT INTO monitoring_stream_daily_snapshots VALUES
    ('canonical','track','real-zero','2026-09-01',0,0,'2026-09-01T12:00:00Z')`);
  let [summary] = await loadLatestMonitoringStreamSummary(database, ["canonical"]);
  assert.equal(summary?.track_count, 1);
  assert.equal(Number(summary?.track_total_streams), 0);
  await database.exec("DROP TABLE monitoring_stream_daily_artist_summaries");
  [summary] = await loadLatestMonitoringStreamSummary(database, ["canonical"]);
  assert.equal(summary?.source_table, "monitoring_stream_daily_snapshots");
  await database.exec("DROP TABLE monitoring_stream_daily_snapshots");
  await assert.rejects(loadLatestMonitoringStreamSummary(database, ["canonical"]), (error: any) => error.code === "42P01");
}));

test("PostgreSQL Spotify history retains original source rows and real zeros without replacing absent history with raw sums", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(sampleRaw);
  assert.deepEqual(await loadMonitoringSpotifyHistory(database, ["canonical", "known-alias"]), []);
  await database.exec(`INSERT INTO spotify_kworb_daily_snapshots
    (artist_key,snapshot_date,total_streams,daily_streams,track_count,source_type,fetched_at) VALUES
    ('canonical','2026-09-01',0,0,2,'kworb_spotify_artist','2026-09-01T12:00:00Z'),
    ('known-alias','2026-09-01',999999,999,20,'kworb_spotify_artist','2026-09-01T13:00:00Z'),
    ('canonical','2026-09-02',NULL,NULL,NULL,'kworb_spotify_artist','2026-09-02T12:00:00Z'),
    ('known-alias','2026-09-02',12345,123,2,'kworb_spotify_artist','2026-09-02T12:00:00Z'),
    ('other-artist','2026-09-03',999999,999,20,'kworb_spotify_artist','2026-09-03T12:00:00Z')`);
  const history = await loadMonitoringSpotifyHistory(database, ["canonical", "known-alias"]);
  assert.equal(history.length, 2);
  assert.equal(Number(history[0]?.total_streams), 0);
  assert.equal(history[0]?.source_artist_key, "canonical");
  assert.equal(Number(history[1]?.total_streams), 12345);
  assert.equal(history[1]?.source_artist_key, "known-alias");
  assert.ok(history.every(row => row.source_type === "kworb_spotify_artist"));
  await database.exec("DROP TABLE spotify_kworb_daily_snapshots");
  await assert.rejects(loadMonitoringSpotifyHistory(database, ["canonical"]), (error: any) => error.code === "42P01");
}));

test("PostgreSQL stream summary can serve materialized archive data when the optional raw table is absent", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(`DROP TABLE monitoring_stream_daily_snapshots;
    INSERT INTO monitoring_stream_daily_artist_summaries VALUES
    ('canonical','2026-09-03',1,1,0,0,0,0,'2026-09-03T11:00:00Z')`);
  const [summary] = await loadLatestMonitoringStreamSummary(database, ["canonical"]);
  assert.equal(summary?.source_table, "monitoring_stream_daily_artist_summaries");
  assert.equal(summary?.snapshot_date, "2026-09-03");
  assert.equal(summary?.recovery_reason, null);
}));

test("stream helpers reject empty authorization keys before issuing reads", async () => {
  const queryable = { async query() { throw new Error("Unexpected database read"); } } as never;
  await assert.rejects(loadLatestMonitoringStreamSummary(queryable, ["", " "]), /authorized artist identity/);
  await assert.rejects(loadMonitoringSpotifyHistory(queryable, []), /authorized artist identity/);
});

test("a schema read that completes after the caller deadline never schedules summary SQL", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 100_000 });
  let calls = 0;
  const queryable = {
    async query(sql: string) {
      calls += 1;
      assert.match(sql, /to_regclass/);
      context.mock.timers.tick(12_000);
      return { rows: [{ materialized: true, raw: true }] };
    },
  } as never;
  await assert.rejects(loadLatestMonitoringStreamSummary(queryable, ["canonical"], { deadlineAt: 112_000 }), /deadline exceeded/);
  assert.equal(calls, 1);
});

test("an already expired stream read budget issues no schema query", async context => {
  context.mock.timers.enable({ apis: ["Date"], now: 200_000 });
  const queryable = { async query() { throw new Error("Unexpected database read"); } } as never;
  await assert.rejects(loadLatestMonitoringStreamSummary(queryable, ["canonical"], { deadlineAt: 200_000 }), /deadline exceeded/);
});
