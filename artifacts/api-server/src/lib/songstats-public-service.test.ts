import assert from "node:assert/strict";
import test from "node:test";
import { buildSongstatsPublicInsight } from "./songstats-public-service";
import { evaluateMonitoringDailyPulse, mergeMonitoringPlatformHistory } from "./monitoring-daily-pulse";

function history(field: string, start: number, dailyGain: number) {
  return Array.from({ length: 121 }, (_, index) => {
    const date = new Date("2026-04-01T12:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), [field]: start + dailyGain * index };
  });
}

test("Monitor long-history sampling preserves the actual latest daily pair", () => {
  const points = Array.from({ length: 1885 }, (_, index) => {
    const date = new Date("2021-08-01T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), monthly_listeners_current: 1000 + index };
  });
  const input = { historicStats: { stats: [{ source: "spotify", data: { history: points } }] }, audience: null, audienceDetails: null };
  const insight = buildSongstatsPublicInsight(input, { access: "monitoring" });
  const sampled = insight.trends.spotifyMonthlyListeners!;
  assert.equal(sampled.length, 500);
  assert.equal(sampled[0]?.date, points[0]?.date);
  assert.deepEqual(sampled.slice(-2).map(p => p.date), ["2026-09-27", "2026-09-28"]);
  assert.ok(sampled.every(p => points.some(original => original.date === p.date && original.monthly_listeners_current === p.value)));
  const pulse = evaluateMonitoringDailyPulse(mergeMonitoringPlatformHistory([], insight.trends), new Date("2026-09-28T20:00:00Z"));
  assert.equal(pulse.complete, true);
  assert.equal(pulse.gapDays, 1);
  assert.ok((buildSongstatsPublicInsight(input).trends.spotifyMonthlyListeners?.length ?? 0) <= 15);

  points.splice(-2, 1);
  const withRealGap = buildSongstatsPublicInsight(input, { access: "monitoring" });
  const gapPulse = evaluateMonitoringDailyPulse(mergeMonitoringPlatformHistory([], withRealGap.trends), new Date("2026-09-28T20:00:00Z"));
  assert.equal(gapPulse.complete, false);
  assert.equal(gapPulse.gapDays, 2);
});

test("Monitor current rows retain dated followers and views instead of just public chart metrics", () => {
  const input = {
    historicStats: { stats: [
      { source: "spotify", data: { history: [
        { date: "2026-09-27", followers_total: 100, monthly_listeners_current: 1000 },
        { date: "2026-09-28", followers_total: 110, monthly_listeners_current: 1050 },
      ] } },
      { source: "youtube", data: { history: [
        { date: "2026-09-27", video_views_total: 2000 },
        { date: "2026-09-28", video_views_total: 2050 },
      ] } },
    ] }, audience: null, audienceDetails: null,
  };
  const paid = buildSongstatsPublicInsight(input, { access: "monitoring" });
  const rows = mergeMonitoringPlatformHistory([], paid.trends);
  assert.equal(rows.at(-1)?.spotifyFollowers, 110);
  assert.equal(rows.at(-1)?.youtubeChannelViews, 2050);
  const free = buildSongstatsPublicInsight(input);
  assert.equal(free.trends.spotifyFollowers, undefined);
  assert.equal(free.trends.youtubeChannelViews, undefined);

  const dated = mergeMonitoringPlatformHistory([], {
    spotifyMonthlyListeners: [{ date: "2026-09-28", value: 1050 }],
    spotifyFollowers: [{ date: "2026-09-27", value: 100 }],
  });
  assert.equal(dated.at(-1)?.spotifyFollowers, null, "never copy an older value onto a newer date");
  input.historicStats.stats[0]!.data.history.splice(0, 1);
  const single = buildSongstatsPublicInsight(input, { access: "monitoring" });
  assert.equal(mergeMonitoringPlatformHistory([], single.trends).at(-1)?.spotifyFollowers, 110);
  assert.equal(single.growth.spotifyFollowers, undefined, "one real reading is not growth evidence");
});

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
