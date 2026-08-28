import assert from "node:assert/strict";
import test from "node:test";
import { buildSongstatsPublicInsight } from "./songstats-public-service";

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
  });

  assert.equal(result.catalog.trackCount, 2);
  assert.equal(result.catalog.albumCount, 1);
  assert.equal(result.catalog.releaseCount, 3);
  assert.equal(result.catalog.newestReleaseDate, "2026-07-20");
  assert.equal(result.catalog.releases[0]?.title, "Nueva canción");
  assert.equal(result.catalog.releases[0]?.platformCount, 1);
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
  });

  assert.equal(result.latestReleaseImpact?.release.title, "Lanzamiento");
  assert.equal(result.latestReleaseImpact?.platformsMeasured, 3);
  assert.equal(result.latestReleaseImpact?.confidence, "high");
  assert.ok((result.latestReleaseImpact?.lift30 ?? 0) > 0);
  assert.ok((result.latestReleaseImpact?.score ?? 0) > 0);
});
