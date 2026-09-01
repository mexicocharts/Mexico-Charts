import assert from "node:assert/strict";
import test from "node:test";
import {
  latestYoutubeObservationsFromHistory,
  mergeYoutubeLatestObservations,
  YOUTUBE_LATEST_OBSERVATION_UPSERT_SQL,
  youtubeCoverageFromLatestObservations,
} from "./youtube-latest-observation";
import {
  YOUTUBE_LIVE_COVERAGE_LATEST_CANDIDATE_SQL,
  YOUTUBE_LIVE_COVERAGE_LATEST_ARTIST_SQL,
  YOUTUBE_LIVE_COVERAGE_LATEST_SQL,
  YOUTUBE_LIVE_COVERAGE_LATEST_VIDEO_SQL,
  YOUTUBE_LIVE_COVERAGE_LEGACY_ARTIST_SQL,
  YOUTUBE_LIVE_COVERAGE_LEGACY_SQL,
  YOUTUBE_LIVE_COVERAGE_LEGACY_VIDEO_SQL,
  YOUTUBE_LIVE_COVERAGE_MAPPING_SQL,
  youtubeLiveCoverageArtistSql,
  youtubeLiveCoverageReadMode,
  youtubeLiveCoverageRowsEqual,
  youtubeLiveCoverageVideoSql,
} from "@workspace/db/youtube-live-coverage-query";

const at = (value: string) => new Date(value);

test("inserts the first genuine latest observation", () => {
  const latest = mergeYoutubeLatestObservations(new Map(), [{
    videoId: "video-a",
    observedAt: at("2026-08-31T01:00:00Z"),
  }]);
  assert.equal(latest.get("video-a")?.toISOString(), "2026-08-31T01:00:00.000Z");
});

test("advances a latest observation when a newer genuine sample arrives", () => {
  const latest = mergeYoutubeLatestObservations(
    new Map([["video-a", at("2026-08-31T01:00:00Z")]]),
    [{ videoId: "video-a", observedAt: at("2026-08-31T01:05:00Z") }],
  );
  assert.equal(latest.get("video-a")?.toISOString(), "2026-08-31T01:05:00.000Z");
});

test("cannot move a latest observation backward", () => {
  const latest = mergeYoutubeLatestObservations(
    new Map([["video-a", at("2026-08-31T01:05:00Z")]]),
    [{ videoId: "video-a", observedAt: at("2026-08-31T01:00:00Z") }],
  );
  assert.equal(latest.get("video-a")?.toISOString(), "2026-08-31T01:05:00.000Z");
  assert.match(YOUTUBE_LATEST_OBSERVATION_UPSERT_SQL, /GREATEST\s*\(/i);
});

test("a duplicate collector retry is idempotent", () => {
  const initial = new Map([["video-a", at("2026-08-31T01:05:00Z")]]);
  const latest = mergeYoutubeLatestObservations(initial, [
    { videoId: "video-a", observedAt: at("2026-08-31T01:05:00Z") },
    { videoId: "video-a", observedAt: at("2026-08-31T01:05:00Z") },
  ]);
  assert.equal(latest.size, 1);
  assert.equal(latest.get("video-a")?.toISOString(), "2026-08-31T01:05:00.000Z");
});

test("historical backfill is idempotent and retains only the maximum timestamp", () => {
  const history = [
    { videoId: "video-a", observedAt: at("2026-08-30T21:00:00Z") },
    { videoId: "video-b", observedAt: at("2026-08-30T22:00:00Z") },
    { videoId: "video-a", observedAt: at("2026-08-31T01:05:00Z") },
  ];
  const once = latestYoutubeObservationsFromHistory(history);
  const twice = mergeYoutubeLatestObservations(once, history);
  assert.deepEqual([...twice.entries()], [...once.entries()]);
});

test("compact latest rows reproduce historical coverage exactly", () => {
  const now = at("2026-08-31T03:00:00Z");
  const candidates = [
    { artistKey: "artist-a", videoId: "video-a" },
    { artistKey: "artist-a", videoId: "video-b" },
    { artistKey: "artist-b", videoId: "video-b" },
    { artistKey: "artist-c", videoId: "video-c" },
  ];
  const history = [
    { videoId: "video-a", observedAt: at("2026-08-30T12:00:00Z") },
    { videoId: "video-a", observedAt: at("2026-08-31T02:55:00Z") },
    { videoId: "video-b", observedAt: at("2026-08-30T14:00:00Z") },
  ];
  const historicalState = youtubeCoverageFromLatestObservations(
    candidates,
    latestYoutubeObservationsFromHistory(history),
    now,
  );
  const compactState = youtubeCoverageFromLatestObservations(
    candidates,
    new Map([
      ["video-a", at("2026-08-31T02:55:00Z")],
      ["video-b", at("2026-08-30T14:00:00Z")],
    ]),
    now,
  );
  assert.deepEqual(compactState, historicalState);
  assert.deepEqual(compactState, {
    catalogArtists: 3,
    observedArtists: 2,
    freshArtists: 1,
    catalogVideos: 3,
    observedVideos: 2,
    freshVideos: 1,
    latestObservedAt: "2026-08-31T02:55:00.000Z",
  });
});

test("a missing latest row during migration blocks equivalence", () => {
  const legacy = {
    roster_artists: 3,
    catalog_videos: 2,
    observed_videos: 2,
    latest_observed_at: "2026-08-31 02:55:00+00",
  };
  const incomplete = { ...legacy, observed_videos: 1 };
  assert.equal(youtubeLiveCoverageRowsEqual(legacy, incomplete), false);
});

test("latest read avoids historical aggregation while preserving legacy rollback SQL", () => {
  assert.match(YOUTUBE_LIVE_COVERAGE_LATEST_SQL, /youtube_video_intraday_latest_observations/);
  assert.doesNotMatch(YOUTUBE_LIVE_COVERAGE_LATEST_SQL, /youtube_video_intraday_shadow_snapshots/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LEGACY_SQL, /youtube_video_intraday_shadow_snapshots/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LATEST_SQL, /candidate_artist_state AS MATERIALIZED/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LATEST_SQL, /candidate_video_state AS MATERIALIZED/);
  assert.doesNotMatch(YOUTUBE_LIVE_COVERAGE_LATEST_SQL, /count\(DISTINCT candidate\./);
  assert.match(YOUTUBE_LIVE_COVERAGE_MAPPING_SQL, /FROM mapping_totals mapping/);
  assert.doesNotMatch(YOUTUBE_LIVE_COVERAGE_MAPPING_SQL, /eligible_candidates/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LATEST_CANDIDATE_SQL, /SELECT candidate\.\* FROM candidate_totals candidate/);
  assert.doesNotMatch(YOUTUBE_LIVE_COVERAGE_LATEST_CANDIDATE_SQL, /FROM mapping_totals mapping/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LATEST_ARTIST_SQL, /candidate_artist_state AS MATERIALIZED/);
  assert.doesNotMatch(YOUTUBE_LIVE_COVERAGE_LATEST_ARTIST_SQL, /candidate_video_state/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LATEST_ARTIST_SQL, /CROSS JOIN LATERAL/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LATEST_ARTIST_SQL, /state\.candidate_count > 0 catalog/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LATEST_VIDEO_SQL, /eligible_video_ids AS MATERIALIZED/);
  assert.doesNotMatch(YOUTUBE_LIVE_COVERAGE_LATEST_VIDEO_SQL, /candidate_artist_state/);
  assert.doesNotMatch(YOUTUBE_LIVE_COVERAGE_LATEST_VIDEO_SQL, /candidate_video_state/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LATEST_VIDEO_SQL, /count\(latest\.video_id\)::int observed_videos/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LEGACY_ARTIST_SQL, /youtube_video_intraday_shadow_snapshots/);
  assert.match(YOUTUBE_LIVE_COVERAGE_LEGACY_VIDEO_SQL, /youtube_video_intraday_shadow_snapshots/);
  assert.doesNotMatch(YOUTUBE_LIVE_COVERAGE_LATEST_ARTIST_SQL, /youtube_video_intraday_shadow_snapshots/);
  assert.doesNotMatch(YOUTUBE_LIVE_COVERAGE_LATEST_VIDEO_SQL, /youtube_video_intraday_shadow_snapshots/);
  assert.equal(youtubeLiveCoverageArtistSql("latest"), YOUTUBE_LIVE_COVERAGE_LATEST_ARTIST_SQL);
  assert.equal(youtubeLiveCoverageArtistSql("legacy"), YOUTUBE_LIVE_COVERAGE_LEGACY_ARTIST_SQL);
  assert.equal(youtubeLiveCoverageVideoSql("latest"), YOUTUBE_LIVE_COVERAGE_LATEST_VIDEO_SQL);
  assert.equal(youtubeLiveCoverageVideoSql("legacy"), YOUTUBE_LIVE_COVERAGE_LEGACY_VIDEO_SQL);
  assert.equal(youtubeLiveCoverageReadMode({}), "latest");
  assert.equal(youtubeLiveCoverageReadMode({ YOUTUBE_LIVE_COVERAGE_READ_MODE: "latest" }), "latest");
  assert.equal(youtubeLiveCoverageReadMode({ YOUTUBE_LIVE_COVERAGE_READ_MODE: "legacy" }), "legacy");
});
