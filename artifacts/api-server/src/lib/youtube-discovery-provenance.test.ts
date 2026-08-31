import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTHORIZED_YOUTUBE_EVIDENCE_MARKERS,
  classifyYoutubeDiscoveryProvenance,
  INNERTUBE_YOUTUBE_EVIDENCE_MARKERS,
} from "./youtube-discovery-provenance";

test("enumerates the stable authorized and Innertube evidence markers", () => {
  assert.ok(AUTHORIZED_YOUTUBE_EVIDENCE_MARKERS.includes("verified_profile_channel"));
  assert.ok(INNERTUBE_YOUTUBE_EVIDENCE_MARKERS.includes("release_track"));
});

test("does not infer Innertube from absence of one authorized marker", () => {
  assert.equal(classifyYoutubeDiscoveryProvenance({
    primarySource: "verified_profile_channel",
    evidenceSources: ["approved_artist_video_link", "verified_profile_channel"],
  }), "authorized");
  assert.equal(classifyYoutubeDiscoveryProvenance({
    primarySource: "something_unrecognized",
    evidenceSources: [],
  }), "unknown");
});

test("classifies explicit Innertube evidence and preserves mixed provenance", () => {
  assert.equal(classifyYoutubeDiscoveryProvenance({
    primarySource: "youtube_music_innertube",
    evidenceSources: ["all_songs", "release_track"],
  }), "innertube");
  assert.equal(classifyYoutubeDiscoveryProvenance({
    primarySource: "youtube_music_innertube",
    evidenceSources: ["release_track", "verified_official_channel_upload"],
  }), "mixed");
});
