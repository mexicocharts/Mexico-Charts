import assert from "node:assert/strict";
import test from "node:test";
import { buildSongstatsPublicInsight } from "./songstats-public-service";

function comparisonInsight(points: Array<{ date: string; monthly_listeners_current: number }>) {
  return buildSongstatsPublicInsight({
    historicStats: { stats: [{ source: "spotify", data: { history: points } }] },
    audience: null, audienceDetails: null,
    catalog: { releases: [{ id: "fictional-release", name: "Fictional release", release_date: "2026-05-01", type: "single" }] },
  }, { access: "monitoring" }).latestReleaseImpact!;
}

test("release comparisons expose distant selected dates without rewriting legacy arithmetic", () => {
  const impact = comparisonInsight([
    { date: "2026-04-30", monthly_listeners_current: 100 },
    { date: "2026-07-30", monthly_listeners_current: 200 },
  ]);
  assert.deepEqual([impact.lift7, impact.lift30, impact.lift90], [100, 100, 100]);
  const comparison = impact.comparisons.find(item => item.metric === "spotifyMonthlyListeners" && item.nominalDaysAfterRelease === 7)!;
  assert.equal(comparison.baseline?.date, "2026-04-30");
  assert.equal(comparison.followup?.date, "2026-07-30");
  assert.equal(comparison.followupTargetDate, "2026-05-08");
  assert.equal(comparison.followupOffsetDays, 83);
  assert.equal(comparison.storedDateIntervalDays, 91);
  assert.equal(comparison.providerMeasurementTime, null);
});

test("an exact day-minus-one to day-plus-seven pair spans eight stored calendar days", () => {
  const impact = comparisonInsight([
    { date: "2026-04-30", monthly_listeners_current: 100 },
    { date: "2026-05-08", monthly_listeners_current: 150 },
  ]);
  assert.equal(impact.lift7, 50);
  const comparison = impact.comparisons.find(item => item.metric === "spotifyMonthlyListeners" && item.nominalDaysAfterRelease === 7)!;
  assert.equal(comparison.baselineOffsetDays, 0);
  assert.equal(comparison.followupOffsetDays, 0);
  assert.equal(comparison.storedDateIntervalDays, 8);
  assert.equal(comparison.dateBasis, "normalized_history_date");
});

test("missing endpoints remain null rather than fabricated dates or zero growth", () => {
  const impact = comparisonInsight([{ date: "2026-05-01", monthly_listeners_current: 100 }]);
  const comparison = impact.comparisons.find(item => item.metric === "spotifyMonthlyListeners" && item.nominalDaysAfterRelease === 7)!;
  assert.equal(comparison.baseline, null);
  assert.equal(comparison.followup, null);
  assert.equal(comparison.percentage, null);
  assert.equal(comparison.storedDateIntervalDays, null);
  assert.equal(impact.lift7, null);
});

test("zero baseline has unavailable percentage while equal values do not establish measurement reuse", () => {
  const zero = comparisonInsight([
    { date: "2026-04-30", monthly_listeners_current: 0 },
    { date: "2026-05-08", monthly_listeners_current: 20 },
  ]);
  assert.equal(zero.lift7, null);
  const equal = comparisonInsight([
    { date: "2026-04-30", monthly_listeners_current: 20 },
    { date: "2026-05-08", monthly_listeners_current: 20 },
  ]);
  assert.equal(equal.lift7, 0);
  const comparison = equal.comparisons.find(item => item.metric === "spotifyMonthlyListeners" && item.nominalDaysAfterRelease === 7)!;
  assert.equal(comparison.providerMeasurementTime, null);
});

function history(field: string, start: number, dailyGain: number) {
  return Array.from({ length: 121 }, (_, index) => {
    const date = new Date("2026-04-01T12:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), [field]: start + dailyGain * index };
  });
}

test("normalizes saved Songstats catalog releases without exposing raw payloads", () => {
  const result = buildSongstatsPublicInsight({
    historicStats: { stats: [] },
    audience: null,
    audienceDetails: null,
    catalog: {
      data: {
        tracks: [
          { id: "track-1", name: "Nueva canción", release_date: "2026-07-20", links: [{ source: "spotify" }] },
          { id: "track-2", title: "Tema anterior", album: { release_date: "2026-05-01" } },
        ],
        albums: [
          { id: "album-1", name: "Nuevo álbum", album_type: "album", release_date: "2026-07-01" },
        ],
      },
    },
  }, { access: "monitoring" });

  assert.equal(result.catalog.trackCount, 2);
  assert.equal(result.catalog.albumCount, 1);
  assert.equal(result.catalog.releaseCount, 3);
  assert.equal(result.catalog.newestReleaseDate, "2026-07-20");
  assert.equal(result.catalog.releases[0]?.title, "Nueva canción");
  assert.equal(result.catalog.releases[0]?.platformCount, 1);
});

test("normalizes the stored Songstats production catalog shape", () => {
  const result = buildSongstatsPublicInsight({
    historicStats: { stats: [] },
    audience: null,
    audienceDetails: null,
    catalog: {
      result: "success",
      tracks_total: 100,
      catalog: [
        {
          songstats_track_id: "track-production-1",
          title: "Lanzamiento real",
          release_date: "2026-08-20",
          avatar: "https://example.com/artwork.jpg",
          isrcs: ["MXAAA2600001"],
          artists: [{ name: "Artista", songstats_artist_id: "artist-1" }],
        },
      ],
    },
  });

  assert.equal(result.catalog.trackCount, 1);
  assert.equal(result.catalog.releaseCount, 1);
  assert.equal(result.catalog.newestReleaseDate, "2026-08-20");
  assert.equal(result.catalog.releases[0]?.id, "track-production-1");
  assert.equal(result.catalog.releases[0]?.artworkUrl, "https://example.com/artwork.jpg");
});

test("derives release impact only from dated releases and available histories", () => {
  const result = buildSongstatsPublicInsight({
    historicStats: {
      stats: [
        { source: "spotify", data: { history: history("monthly_listeners_current", 1_000_000, 4_000) } },
        { source: "instagram", data: { history: history("followers_total", 500_000, 2_000) } },
        { source: "tiktok", data: { history: history("followers_total", 750_000, 3_000) } },
      ],
    },
    audience: null,
    audienceDetails: null,
    catalog: { releases: [{ id: "release-1", title: "Lanzamiento", release_date: "2026-05-01", type: "single" }] },
  }, { access: "monitoring" });

  assert.equal(result.latestReleaseImpact?.release.title, "Lanzamiento");
  assert.equal(result.latestReleaseImpact?.platformsMeasured, 3);
  assert.equal(result.latestReleaseImpact?.confidence, "high");
  assert.ok((result.latestReleaseImpact?.lift30 ?? 0) > 0);
  assert.ok((result.latestReleaseImpact?.score ?? 0) > 0);
});

test("limits public artist history to 15 days and reserves long windows for monitoring", () => {
  const payload = {
    historicStats: {
      stats: [
        { source: "spotify", data: { history: history("monthly_listeners_current", 1_000_000, 4_000) } },
        { source: "instagram", data: { history: history("followers_total", 500_000, 2_000) } },
      ],
    },
    audience: null,
    audienceDetails: null,
    catalog: { releases: [{ id: "release-1", title: "Lanzamiento", release_date: "2026-05-01", type: "single" }] },
  };
  const publicInsight = buildSongstatsPublicInsight(payload);
  const paidInsight = buildSongstatsPublicInsight(payload, { access: "monitoring" });

  assert.ok((publicInsight.trends.spotifyMonthlyListeners?.length ?? 0) <= 15);
  assert.equal(publicInsight.growth.spotifyMonthlyListeners?.days30, null);
  assert.equal(publicInsight.growth.spotifyMonthlyListeners?.days90, null);
  assert.equal(publicInsight.latestReleaseImpact, null);
  assert.ok((paidInsight.trends.spotifyMonthlyListeners?.length ?? 0) > 15);
  assert.ok(paidInsight.growth.spotifyMonthlyListeners?.days30);
  assert.ok(paidInsight.growth.spotifyMonthlyListeners?.days90);
  assert.ok(paidInsight.latestReleaseImpact);
});

test("distinguishes unavailable albums from an explicit empty saved collection; same-day median remains zero", () => {
  const input={historicStats:null,audience:null,audienceDetails:null};
  const tracks=[{id:'a',name:'A',release_date:'2026-08-07'},{id:'b',name:'B',release_date:'2026-08-07'}];
  const absent=buildSongstatsPublicInsight({...input,catalog:{catalog:tracks}});
  const empty=buildSongstatsPublicInsight({...input,catalog:{data:{tracks,albums:[]}}});
  assert.equal(absent.catalog.albumCount,null);assert.equal(empty.catalog.albumCount,0);
  assert.equal(absent.catalog.medianReleaseGapDays,0);assert.equal(absent.catalog.releaseCount,2);
});

function growthInsight(points: Array<{ date: string; monthly_listeners_current: number }>, access: "public" | "monitoring" = "public") {
  return buildSongstatsPublicInsight({ historicStats: { stats: [{ source: "spotify", data: { history: points } }] }, audience: null, audienceDetails: null }, { access });
}

test("active growth evidence preserves exact, irregular and distant baseline selection", () => {
  for (const [date, expectedOffset, expectedInterval] of [
    ["2026-08-16", 0, 15], ["2026-08-14", -2, 17], ["2026-05-01", -107, 122],
  ] as const) {
    const result = growthInsight([
      { date, monthly_listeners_current: 100 },
      ...(date === "2026-08-14" ? [{ date: "2026-08-18", monthly_listeners_current: 115 }] : []),
      { date: "2026-08-31", monthly_listeners_current: 120 },
    ]);
    const growth = result.growth.spotifyMonthlyListeners!;
    assert.deepEqual(growth.days15, { absolute: 20, percentage: 20 });
    assert.equal(growth.evidence?.days15?.baseline?.date, date);
    assert.equal(growth.evidence?.days15?.baselineTargetDate, "2026-08-16");
    assert.equal(growth.evidence?.days15?.baselineOffsetDays, expectedOffset);
    assert.equal(growth.evidence?.days15?.storedDateIntervalDays, expectedInterval);
    assert.equal(growth.evidence?.days15?.collectionTime, null);
    assert.equal(growth.evidence?.days15?.providerMeasurementIntervalDays, null);
  }
});

test("missing baseline stays legacy null with separate reason; single-point parent stays absent", () => {
  const result = growthInsight([{ date: "2026-08-20", monthly_listeners_current: 100 }, { date: "2026-08-31", monthly_listeners_current: 120 }]);
  assert.equal(result.growth.spotifyMonthlyListeners?.days15, null);
  assert.equal(result.growth.spotifyMonthlyListeners?.evidence?.days15?.baseline, null);
  assert.equal(result.growth.spotifyMonthlyListeners?.evidence?.days15?.percentageAvailability, "missing_baseline");
  assert.equal(growthInsight([{ date: "2026-08-31", monthly_listeners_current: 120 }]).growth.spotifyMonthlyListeners, undefined);
  assert.equal(growthInsight([]).growth.spotifyMonthlyListeners, undefined);
});

test("zero baseline and genuine zero/negative change retain original numeric/null outputs", () => {
  for (const [before, after, expected] of [[0,120,null],[0,0,null],[100,100,0],[100,98,-2]] as const) {
    const growth = growthInsight([{ date: "2026-08-16", monthly_listeners_current: before }, { date: "2026-08-31", monthly_listeners_current: after }]).growth.spotifyMonthlyListeners!;
    assert.deepEqual(growth.days15, { absolute: after - before, percentage: expected });
    assert.equal(growth.evidence?.days15?.percentageAvailability, before === 0 ? "zero_baseline" : "available");
  }
});

test("growth metadata respects existing public/monitoring horizon gates", () => {
  const points = [{ date: "2026-05-01", monthly_listeners_current: 100 }, { date: "2026-08-31", monthly_listeners_current: 120 }];
  const publicGrowth = growthInsight(points).growth.spotifyMonthlyListeners!;
  assert.equal(publicGrowth.days30, null); assert.equal(publicGrowth.evidence?.days30, null);
  assert.equal(publicGrowth.days90, null); assert.equal(publicGrowth.evidence?.days90, null);
  const monitoringGrowth = growthInsight(points, "monitoring").growth.spotifyMonthlyListeners!;
  assert.ok(monitoringGrowth.days30); assert.ok(monitoringGrowth.evidence?.days30);
  assert.ok(monitoringGrowth.days90); assert.ok(monitoringGrowth.evidence?.days90);
});
