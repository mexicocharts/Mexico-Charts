import assert from "node:assert/strict";
import test from "node:test";

import {
  buildYoutubeCoverageEligiblePairs,
  calculateYoutubeCoverageCounts,
  normalizeYoutubeCoverageArtistKey,
  shouldRefreshYoutubeCoverageSummary,
  youtubeCoverageSummaryState,
} from "./youtube-live-coverage-summary-policy";

test("normalizes aliases exactly and collapses duplicate logical artist/video pairs", () => {
  assert.equal(normalizeYoutubeCoverageArtistKey("  Banda MS—Oficial  "), "bandamsoficial");
  assert.equal(normalizeYoutubeCoverageArtistKey("Pepe-Aguilár"), "pepeaguilar");
  const pairs = buildYoutubeCoverageEligiblePairs([
    { artistKey: "Pepe Aguilar", videoId: "same", status: "review", samplingStatus: "shadow" },
    { artistKey: "pepe-aguilar", videoId: "same", status: "verified", samplingStatus: "shadow" },
  ], ["pepe_aguilar"]);
  assert.deepEqual(pairs, [{ normalizedArtistKey: "pepeaguilar", videoId: "same" }]);
});

test("preserves one shared video for each genuinely distinct roster artist", () => {
  const pairs = buildYoutubeCoverageEligiblePairs([
    { artistKey: "artist-a", videoId: "collab", status: "review", samplingStatus: "shadow" },
    { artistKey: "artist-b", videoId: "collab", status: "review", samplingStatus: "shadow" },
    { artistKey: "artist-a", videoId: "ignored", status: "rejected", samplingStatus: "shadow" },
    { artistKey: "artist-b", videoId: "ignored-2", status: "review", samplingStatus: "off" },
  ], ["artist-a", "artist-b"]);
  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs.map(pair => pair.normalizedArtistKey), ["artista", "artistb"]);
});

test("eligible-pair reconstruction handles insert, update, removal, and idempotent replay", () => {
  const candidate = { artistKey: "Artist A", videoId: "video-1", status: "review", samplingStatus: "shadow" };
  const admitted = buildYoutubeCoverageEligiblePairs([candidate], ["artist-a"]);
  assert.deepEqual(buildYoutubeCoverageEligiblePairs([candidate, candidate], ["artist-a"]), admitted);
  assert.equal(admitted.length, 1);
  assert.equal(buildYoutubeCoverageEligiblePairs([{ ...candidate, status: "rejected" }], ["artist-a"]).length, 0);
  assert.equal(buildYoutubeCoverageEligiblePairs([{ ...candidate, samplingStatus: "paused" }], ["artist-a"]).length, 0);
  assert.equal(buildYoutubeCoverageEligiblePairs([candidate], []).length, 0);
  assert.deepEqual(
    buildYoutubeCoverageEligiblePairs([{ ...candidate, artistKey: "Artist B" }], ["artist-b"]),
    [{ normalizedArtistKey: "artistb", videoId: "video-1" }],
  );
});

test("summary uses exact six-hour boundary and distinct artist/video semantics", () => {
  const now = new Date("2026-08-31T18:00:00.000Z");
  const pairs = [
    { normalizedArtistKey: "a", videoId: "shared" },
    { normalizedArtistKey: "b", videoId: "shared" },
    { normalizedArtistKey: "b", videoId: "stale" },
    { normalizedArtistKey: "c", videoId: "never" },
  ];
  const result = calculateYoutubeCoverageCounts(pairs, new Map([
    ["shared", "2026-08-31T12:00:00.000Z"],
    ["stale", "2026-08-31T11:59:59.999Z"],
  ]), now);
  assert.deepEqual(result, {
    catalogArtists: 3,
    observedArtists: 2,
    freshArtists: 2,
    catalogVideos: 3,
    observedVideos: 2,
    freshVideos: 1,
    latestObservedAt: "2026-08-31T12:00:00.000Z",
  });
});

test("missing, stale, and failed summary states remain explicit", () => {
  const now = new Date("2026-08-31T18:00:00.000Z");
  assert.equal(youtubeCoverageSummaryState(null, now), "missing");
  assert.equal(youtubeCoverageSummaryState({ calculatedAt: "2026-08-31T17:50:00.000Z" }, now), "current");
  assert.equal(youtubeCoverageSummaryState({ calculatedAt: "2026-08-31T17:40:00.000Z" }, now), "stale");
  assert.equal(youtubeCoverageSummaryState({
    calculatedAt: "2026-08-31T17:50:00.000Z",
    lastRefreshError: "database unavailable",
  }, now), "refresh_failed");
});

test("summary work dispatches only after a completed collector run", () => {
  assert.equal(shouldRefreshYoutubeCoverageSummary("complete"), true);
  for (const status of ["failed", "locked", "disabled", "quota_exhausted"]) {
    assert.equal(shouldRefreshYoutubeCoverageSummary(status), false);
  }
});
