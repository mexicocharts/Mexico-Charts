import assert from "node:assert/strict";
import test from "node:test";
import {
  youtubeShadowArtistIdentityKey,
  youtubeShadowCanonicalChannelId,
  youtubeShadowCanUseVerifiedChannelFallback,
  youtubeShadowDiscoveryFailure,
  youtubeShadowDiscoveryRetryDelayMs,
  youtubeShadowPilotIsReady,
} from "./youtube-shadow-bootstrap-policy";
import {
  youtubeChannelUploadImportProgress,
  youtubeBatchStatsItems,
  youtubeEasternMidnightAnchor,
} from "./youtube-intraday-shadow-scheduler";

test("maps batch stats without erasing catalog metadata", () => {
  assert.deepEqual(youtubeBatchStatsItems([{
    id: "video-1",
    snippet: { publishTime: "2026-08-30T12:00:00Z" },
    statistics: { viewCount: "123", likeCount: "9", commentCount: "2" },
    contentDetails: { duration: "PT3M12S" },
  }]), [{
    videoId: "video-1",
    channelId: null,
    title: "",
    thumbnailUrl: null,
    publishedAt: new Date("2026-08-30T12:00:00Z"),
    duration: "PT3M12S",
    viewCount: 123,
    likeCount: 9,
    commentCount: 2,
  }]);
});

test("keeps a channel import open while YouTube has another uploads page", () => {
  assert.deepEqual(youtubeChannelUploadImportProgress({
    videosImported: 50,
    pageVideoCount: 50,
    nextPageToken: "NEXT_PAGE",
    expectedTotalVideos: 289,
  }), {
    status: "retryable",
    nextPageToken: "NEXT_PAGE",
    videosImported: 100,
    expectedTotalVideos: 289,
    complete: false,
  });
});

test("marks a channel complete only after the uploads playlist has no next page", () => {
  assert.deepEqual(youtubeChannelUploadImportProgress({
    videosImported: 250,
    pageVideoCount: 39,
    nextPageToken: null,
    expectedTotalVideos: 289,
  }), {
    status: "complete",
    nextPageToken: null,
    videosImported: 289,
    expectedTotalVideos: 289,
    complete: true,
  });
});

test("refreshes a completed channel from its newest page without recrawling its archive", () => {
  assert.deepEqual(youtubeChannelUploadImportProgress({
    videosImported: 289,
    pageVideoCount: 50,
    nextPageToken: "OLDER_UPLOADS",
    expectedTotalVideos: 291,
    refreshingCompleteChannel: true,
  }), {
    status: "complete",
    nextPageToken: null,
    videosImported: 291,
    expectedTotalVideos: 291,
    complete: true,
  });
});

test("identifies the first thirty minutes of the Eastern reporting day", () => {
  assert.deepEqual(youtubeEasternMidnightAnchor(new Date("2026-08-21T04:07:00Z")), {
    dateKey: "2026-08-21",
    shouldAnchor: true,
  });
  assert.deepEqual(youtubeEasternMidnightAnchor(new Date("2026-08-21T04:15:00Z")), {
    dateKey: "2026-08-21",
    shouldAnchor: true,
  });
  assert.deepEqual(youtubeEasternMidnightAnchor(new Date("2026-08-21T04:30:00Z")), {
    dateKey: "2026-08-21",
    shouldAnchor: false,
  });
});

test("uses Eastern daylight and standard time for midnight anchors", () => {
  assert.equal(youtubeEasternMidnightAnchor(new Date("2026-08-21T04:02:00Z")).shouldAnchor, true);
  assert.equal(youtubeEasternMidnightAnchor(new Date("2026-12-21T05:02:00Z")).shouldAnchor, true);
});

test("matches verified YouTube mappings across stored artist-key formats", () => {
  const canonical = youtubeShadowArtistIdentityKey("luis-miguel");
  assert.equal(canonical, "luismiguel");
  assert.equal(youtubeShadowArtistIdentityKey("Luis Miguel"), canonical);
  assert.equal(youtubeShadowArtistIdentityKey("LUIS_MIGUEL"), canonical);
});

test("only falls back to uploads for a trusted canonical YouTube channel", () => {
  assert.equal(youtubeShadowCanUseVerifiedChannelFallback({
    browseId: "UCQHnOnsryRQmmr6pU3lAupg",
    trustedBrowseId: true,
  }), true);
  assert.equal(youtubeShadowCanUseVerifiedChannelFallback({
    browseId: "UCQHnOnsryRQmmr6pU3lAupg",
    trustedBrowseId: false,
  }), false);
  assert.equal(youtubeShadowCanUseVerifiedChannelFallback({
    browseId: "MPREb_not_a_channel",
    trustedBrowseId: true,
  }), false);
});

test("normalizes verified YouTube channel IDs without accepting handles or music browse IDs", () => {
  assert.equal(youtubeShadowCanonicalChannelId(" UCQHnOnsryRQmmr6pU3lAupg "), "UCQHnOnsryRQmmr6pU3lAupg");
  assert.equal(
    youtubeShadowCanonicalChannelId("https://www.youtube.com/channel/UCQHnOnsryRQmmr6pU3lAupg?feature=shared"),
    "UCQHnOnsryRQmmr6pU3lAupg",
  );
  assert.equal(youtubeShadowCanonicalChannelId("https://www.youtube.com/@OficialLuisMiguel"), null);
  assert.equal(youtubeShadowCanonicalChannelId("MPREb_not_a_channel"), null);
});

test("retries pilots that only have rejected or disabled candidates", () => {
  assert.equal(youtubeShadowPilotIsReady(0), false);
  assert.equal(youtubeShadowPilotIsReady(null), false);
  assert.equal(youtubeShadowPilotIsReady(1), true);
});

test("surfaces non-error discovery misses instead of silently dropping an artist", () => {
  assert.equal(youtubeShadowDiscoveryFailure({
    mappingStatus: "not_found",
    reviewCandidates: 0,
  }), "Mapping status: not_found.");
  assert.equal(youtubeShadowDiscoveryFailure({
    mappingStatus: "ambiguous",
    reviewCandidates: 0,
  }), "Mapping status: ambiguous.");
  assert.equal(youtubeShadowDiscoveryFailure({
    mappingStatus: "review",
    reviewCandidates: 0,
  }), "No eligible shadow candidates were discovered.");
});

test("accepts a discovery only when at least one eligible candidate exists", () => {
  assert.equal(youtubeShadowDiscoveryFailure({
    mappingStatus: "review",
    verifiedCandidates: 1,
    reviewCandidates: 0,
  }), null);
  assert.equal(youtubeShadowDiscoveryFailure({
    mappingStatus: "review",
    reviewCandidates: 12,
  }), null);
  assert.equal(youtubeShadowDiscoveryFailure({
    mappingStatus: "review",
    reviewCandidates: 12,
    error: "upstream failed",
  }), "upstream failed");
});

test("retries failed, retryable, and ambiguous discovery runs promptly but bounds ordinary rechecks", () => {
  const now = Date.parse("2026-08-24T18:00:00Z");
  const attempted = new Date(now - 10 * 60 * 1000);
  assert.equal(youtubeShadowDiscoveryRetryDelayMs("failed", attempted, now), 5 * 60 * 1000);
  assert.equal(youtubeShadowDiscoveryRetryDelayMs("retryable", attempted, now), 5 * 60 * 1000);
  assert.equal(youtubeShadowDiscoveryRetryDelayMs("ambiguous", attempted, now), 5 * 60 * 1000);
  assert.equal(youtubeShadowDiscoveryRetryDelayMs("not_found", attempted, now), 23 * 60 * 60 * 1000 + 50 * 60 * 1000);
});
