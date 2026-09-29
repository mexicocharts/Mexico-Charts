import test from "node:test";
import { reportVideoThumbnail, reportIdentityNotice, reportChartChange } from "./monitoring-weekly-report";
import { monitorVideoThumbnail } from "../../../mexico-charts/src/lib/monitorVideoThumbnail.mjs";
import assert from "node:assert/strict";

test("approved chart percentage uses measured endpoints and preserves unavailable baselines", () => {
  assert.equal(reportChartChange([100, 80, 90]), "-10.00%");
  assert.equal(reportChartChange([100, 120]), "+20.00%");
  assert.equal(reportChartChange([100, 100]), "+0.00%");
  for (const values of [[], [100], [0, 100], [-1, 100], [100, NaN], [Infinity, 100]])
    assert.equal(reportChartChange(values), null);
});

test("an unresolved founder identity warning survives report export", () => {
  assert.match(reportIdentityNotice(true)!, /conflicto de identidad sin resolver/);
  assert.equal(reportIdentityNotice(false), null);
  assert.equal(reportIdentityNotice(), null);
});

test("report and dashboard use real video CDN fallback without changing source records", () => {
  for (const resolve of [reportVideoThumbnail, monitorVideoThumbnail]) {
    const video = Object.freeze({ video_id: "8WrgA6mUiIY", thumbnail_url: null });
    assert.equal(resolve(video), "https://i.ytimg.com/vi/8WrgA6mUiIY/hqdefault.jpg");
    assert.equal(resolve({ ...video, thumbnail_url: "https://i.ytimg.com/stored.jpg" }), "https://i.ytimg.com/stored.jpg");
    assert.equal(resolve({ video_id: "../invalid" }), null);
    assert.equal(video.thumbnail_url, null);
  }
});
import { exactReportChange, reportChangeColor, reportCatalogDaily, reportYoutubeComparison, reportRecommendations, reportSpotifyArtworkIndex, type WeeklyReportInput } from "./monitoring-weekly-report";

test("album artwork follows the actual featured track count, including sparse catalogs", () => {
  for (const videos of [0, 1, 3]) {
    for (const tracks of [0, 1, 2, 5]) {
      const packed = ["cover", ...Array.from({ length: videos }, (_, i) => `video${i}`),
        ...Array.from({ length: tracks }, (_, i) => `track${i}`), "album0", "album1"];
      for (let i = 0; i < tracks; i++) assert.equal(packed[reportSpotifyArtworkIndex(videos, tracks, "track", i)], `track${i}`);
      for (let i = 0; i < 2; i++) assert.equal(packed[reportSpotifyArtworkIndex(videos, tracks, "album", i)], `album${i}`);
    }
  }
});

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
