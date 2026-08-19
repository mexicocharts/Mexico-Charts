import assert from "node:assert/strict";
import test from "node:test";
import { getYoutubeShadowManualReview, youtubeShadowManualReviews } from "./youtube-shadow-manual-review";

test("keeps the completed audit exhaustive and duplicate-free", () => {
  assert.equal(youtubeShadowManualReviews.length, 32);
  assert.equal(new Set(youtubeShadowManualReviews.map(row => `${row.artistKey}:${row.videoId}`)).size, 32);
  assert.equal(youtubeShadowManualReviews.filter(row => row.status === "review").length, 11);
  assert.equal(youtubeShadowManualReviews.filter(row => row.status === "rejected").length, 21);
});

test("recovers explicit artist recordings without auto-verifying them", () => {
  assert.deepEqual(getYoutubeShadowManualReview("peso-pluma", "BQEGrJD-GnU"), {
    artistKey: "peso-pluma",
    videoId: "BQEGrJD-GnU",
    status: "review",
    confidence: 85,
    reason: "official_label_metadata_credits_artist",
    reviewedAt: "2026-08-19",
    evidenceSource: "manual_youtube_metadata_review",
  });
});

test("keeps confirmed non-recordings rejected", () => {
  assert.equal(getYoutubeShadowManualReview("luis-miguel", "s-QMm3B6S8E")?.status, "rejected");
  assert.equal(getYoutubeShadowManualReview("luis-miguel", "s-QMm3B6S8E")?.reason, "impersonation_cover_not_artist_recording");
});
