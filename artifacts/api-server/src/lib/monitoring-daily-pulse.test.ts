import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonitoringDailyPulse,
  evaluateMonitoringDailyPulse,
  buildMonitoringNativeSnapshotsSql,
  buildMonitoringPulseEvidenceSql,
  mergeMonitoringPlatformHistory,
  MONITORING_PULSE_COLUMNS,
} from "./monitoring-daily-pulse";

const now = new Date("2026-09-06T12:00:00Z");
const catalog = { newestReleaseDate: null, releases: [] };
test("daily pulse measures real zero changes only for fresh adjacent paired metrics", () => {
  const history = [
    { date: "2026-09-05", spotifyFollowers: 0 },
    { date: "2026-09-06", spotifyFollowers: 0 },
  ];
  const coverage = evaluateMonitoringDailyPulse(history, now);
  assert.equal(coverage.complete, true);
  assert.deepEqual(coverage.pairedMetricKeys, ["spotifyFollowers"]);
  const pulse = buildMonitoringDailyPulse(history, catalog, now);
  assert.equal(pulse.status, "ready");
  assert.equal(pulse.metricsChanged, 0);
  assert.match(pulse.summary, /No se detectaron cambios/);
});

test("absent, unpaired, stale and nonadjacent readings never report measured no-change", () => {
  for (const [history, reason, status] of [
    [[], "no_current_snapshot", "unavailable"],
    [
      [{ date: "2026-09-06", spotifyFollowers: 100 }],
      "no_previous_snapshot",
      "partial",
    ],
    [
      [
        { date: "2026-09-05", spotifyFollowers: 100 },
        { date: "2026-09-06", instagramFollowers: 100 },
      ],
      "no_paired_metrics",
      "partial",
    ],
    [
      [
        { date: "2026-09-05", spotifyFollowers: NaN },
        { date: "2026-09-06", spotifyFollowers: 100 },
      ],
      "no_paired_metrics",
      "partial",
    ],
    [
      [
        { date: "2026-09-05", spotifyFollowers: "" },
        { date: "2026-09-06", spotifyFollowers: 0 },
      ],
      "no_paired_metrics",
      "partial",
    ],
    [
      [
        { date: "2026-09-01", spotifyFollowers: 100 },
        { date: "2026-09-06", spotifyFollowers: 100 },
      ],
      "non_adjacent_snapshots",
      "partial",
    ],
    [
      [
        { date: "2026-01-01", spotifyFollowers: 100 },
        { date: "2026-01-02", spotifyFollowers: 100 },
      ],
      "snapshot_stale",
      "stale",
    ],
  ] as const) {
    const coverage = evaluateMonitoringDailyPulse(history, now);
    assert.equal(coverage.reason, reason);
    const pulse = buildMonitoringDailyPulse([...history], catalog, now);
    assert.equal(pulse.status, status);
    assert.equal(pulse.metricsChanged, null);
    assert.equal(pulse.signals.length, 0);
    assert.doesNotMatch(pulse.headline, /estable|sin cambios/i);
    assert.doesNotMatch(pulse.summary, /No se detectaron cambios/);
  }
});

test("pulse only uses the latest two unique dates, retains negative deltas, and rejects rolled dates", () => {
  const history = [
    { date: "2026-09-04", spotifyFollowers: 100 },
    { date: "2026-09-05", spotifyFollowers: 100 },
    { date: "2026-09-05", spotifyFollowers: 200 },
    { date: "2026-02-31", spotifyFollowers: 1000 },
    { date: "2026-09-06", spotifyFollowers: 0 },
  ];
  const pulse = buildMonitoringDailyPulse(history, catalog, now);
  assert.equal(pulse.status, "ready");
  assert.equal(pulse.previousDate, "2026-09-05");
  assert.equal(pulse.metricsChanged, 1);
  assert.equal(pulse.signals[0]?.delta, -200);
});

test("pulse audit merges licensed trends with the same precedence and latest dates as serving", () => {
  const native = [
    { date: "2026-09-03", spotifyMonthlyListeners: 1 },
    { date: "2026-09-04", spotifyFollowers: 10 },
    { date: "2026-09-05", spotifyFollowers: 10 },
  ];
  const unpaired = { instagramFollowers: [{ date: "2026-09-06", value: 20 }] };
  const served = evaluateMonitoringDailyPulse(
    mergeMonitoringPlatformHistory(native, unpaired),
    now,
  );
  const audited = evaluateMonitoringDailyPulse(
    mergeMonitoringPlatformHistory(native.slice(-2), unpaired),
    now,
  );
  assert.deepEqual(audited, served);
  assert.equal(served.reason, "no_paired_metrics");
  const paired = {
    instagramFollowers: [
      { date: "2026-09-05", value: 20 },
      { date: "2026-09-06", value: 20 },
    ],
  };
  const restored = buildMonitoringDailyPulse(
    mergeMonitoringPlatformHistory(native.slice(-2), paired),
    catalog,
    now,
  );
  assert.equal(restored.status, "ready");
  assert.equal(restored.metricsChanged, 0);
  const overwrite = mergeMonitoringPlatformHistory(
    [{ date: "2026-09-06", instagramFollowers: 99 }],
    paired,
  );
  assert.equal(overwrite.at(-1)?.instagramFollowers, 20);
});

const fixtureModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
test(
  "PostgreSQL pulse audit and serving select identical canonical daily rows and measured pairs",
  { skip: !fixtureModule },
  async () => {
    const { PGlite } = await import(fixtureModule!);
    const db = new PGlite();
    try {
      await db.exec(`CREATE TABLE songstats_artist_daily_snapshots (artist_key text, snapshot_date date, fetched_at timestamptz, spotify_popularity numeric,
      ${Object.values(MONITORING_PULSE_COLUMNS)
        .map((column) => `${column} numeric`)
        .join(",")});
      INSERT INTO songstats_artist_daily_snapshots(artist_key,snapshot_date,fetched_at,spotify_followers,instagram_followers) VALUES
      ('canonical','2026-09-04','2026-09-04',20,NULL),
      ('canonical','2026-09-05','2026-09-05',10,NULL),
      ('alias','2026-09-05','2026-09-06',999,100),
      ('canonical','2026-09-05','2026-09-06',0,NULL),
      ('canonical','2026-09-06','2026-09-06',0,NULL),
      ('other','2026-09-06','2026-09-06',999,NULL);`);
      const keys = ["canonical", "alias"];
      const served = (
        await db.query(buildMonitoringNativeSnapshotsSql("$1::text[]"), [keys])
      ).rows;
      const evidence = (
        await db.query(buildMonitoringPulseEvidenceSql("$1::text[]"), [keys])
      ).rows[0].history;
      assert.equal(served.length, 3);
      assert.equal(served[1].artist_key, "canonical");
      assert.equal(served[1].spotify_followers, "0");
      assert.equal(evidence.days, 3);
      assert.equal(evidence.latestSnapshots.length, 2);
      const normalized = served.map((row: any) => ({
        date: row.snapshot_date,
        ...Object.fromEntries(
          Object.entries(MONITORING_PULSE_COLUMNS).map(([key, column]) => [
            key,
            row[column],
          ]),
        ),
      }));
      assert.deepEqual(
        evaluateMonitoringDailyPulse(evidence.latestSnapshots, now)
          .pairedMetricKeys,
        evaluateMonitoringDailyPulse(normalized, now).pairedMetricKeys,
      );
      assert.equal(
        evaluateMonitoringDailyPulse(evidence.latestSnapshots, now).complete,
        true,
      );
      const isolated = (
        await db.query(buildMonitoringNativeSnapshotsSql("$1::text[]"), [
          ["alias"],
        ])
      ).rows;
      assert.equal(isolated.length, 1);
      assert.equal(isolated[0].artist_key, "alias");
    } finally {
      await db.close();
    }
  },
);
