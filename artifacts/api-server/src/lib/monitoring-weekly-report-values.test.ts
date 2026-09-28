import test from "node:test";
import assert from "node:assert/strict";
import { exactReportChange, reportChangeColor, reportCatalogDaily, reportYoutubeComparison, reportRecommendations, type WeeklyReportInput } from "./monitoring-weekly-report";

test("exact report appendix retains all measured change digits", () => {
  assert.equal(exactReportChange(-934_947), "-934,947");
  assert.equal(exactReportChange(677_234_567), "+677,234,567");
  assert.equal(exactReportChange(0), "+0");
  assert.equal(exactReportChange(null), "Ventana sin lectura");
});

test("partial daily coverage is not described as absent or a complete aggregate", () => {
  const catalog = { snapshotDate: null, trackCount: 2, albumCount: 0,
    trackDailyStreams: null, albumDailyStreams: null, trackTotalStreams: null, albumTotalStreams: null,
    items: [
      { type: "track" as const, title: "Measured", dailyStreams: 123, totalStreams: 5000 },
      { type: "track" as const, title: "Unmeasured", dailyStreams: null, totalStreams: 4000 },
    ] };
  assert.deepEqual(reportCatalogDaily(catalog, "track"), { value: "Total incompleto", detail: "1 de 2 con lectura diaria" });
  assert.deepEqual(reportCatalogDaily(catalog, "album"), { value: "Sin lectura", detail: "0 de 0 con lectura diaria" });
  assert.deepEqual(reportCatalogDaily({ ...catalog, trackDailyStreams: 123 }, "track"), { value: "123", detail: "2 canciones" });
  assert.equal(catalog.trackDailyStreams, null);
});

test("negative audience growth uses the approved red loss treatment", () => {
  assert.equal(reportChangeColor("-934.9K / 30d"), "#FF5C68");
  assert.equal(reportChangeColor("+483.2K / 30d"), "#39FF14");
  assert.equal(reportChangeColor("188 canciones"), "#39FF14");
});

test("comparison ratios require identical observed windows, never merely a matching snapshot", () => {
  const own = { absolute: 260, baselineDate: "2026-08-29", latestDate: "2026-09-28", baselineValue: 1000, latestValue: 1260, source: "songstats" };
  const input = { history: [], growth: { youtubeChannelViews: { days30: own } }, comparisonArtists: [
    { artistName: "Peer", spotifyMonthlyListeners: null, youtubeGrowth30: { absolute: 100, baselineDate: own.baselineDate, latestDate: own.latestDate } },
    { artistName: "Wrong window", spotifyMonthlyListeners: null, youtubeGrowth30: { absolute: 1000, baselineDate: "2026-08-28", latestDate: own.latestDate } },
  ] };
  assert.equal(reportYoutubeComparison(input).value, "2.6X");
  assert.match(reportYoutubeComparison(input).detail, /vs\. Peer/);
  assert.equal(reportYoutubeComparison({ ...input, comparisonArtists: [input.comparisonArtists[1]!] }).value, "+260");
  assert.equal(reportYoutubeComparison({ ...input, comparisonArtists: [] }).value, "+260");
});

test("recommendations use real input evidence without inventing releases or milestones", () => {
  const input = { history: [{ date: "2026-09-28", spotifyMonthlyListeners: 12345 }], growth: {},
    spotifyCatalog: { items: [{ type: "track", title: "Real track", dailyStreams: 123, totalStreams: 999 }] },
    topMexicoCities: [{ name: "Puebla", currentListeners: 456 }],
  } as WeeklyReportInput;
  const recommendations = reportRecommendations(input);
  assert.equal(recommendations.length, 3);
  assert.match(recommendations[0]!.detail, /Real track: 123 diarios/);
  assert.match(recommendations[1]!.detail, /456 oyentes/);
  assert.match(recommendations[2]!.detail, /12,345 oyentes del 2026-09-28/);
  assert.doesNotMatch(JSON.stringify(recommendations), /BELLAKEO|NUEVA VIDA/);
  assert.deepEqual(reportRecommendations({ ...input, history: [], spotifyCatalog: { ...input.spotifyCatalog, items: [] }, topMexicoCities: [] }), []);
});
