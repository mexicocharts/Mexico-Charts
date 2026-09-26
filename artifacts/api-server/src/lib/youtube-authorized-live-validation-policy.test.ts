import assert from "node:assert/strict";
import test from "node:test";
import {
  isYoutubeComparatorWindowCandidate,
  normalizeYoutubeValidationArtistKey,
  YOUTUBE_VALIDATION_AUTO_START,
} from "./youtube-authorized-live-validation-policy";

test("protected validation never auto-creates a replacement session", () => {
  assert.equal(YOUTUBE_VALIDATION_AUTO_START, false);
});

test("logical artist aliases normalize to the same comparator identity", () => {
  assert.equal(normalizeYoutubeValidationArtistKey("Luis Miguel"), "luismiguel");
  assert.equal(normalizeYoutubeValidationArtistKey("luis-miguel"), "luismiguel");
  assert.equal(normalizeYoutubeValidationArtistKey("Alejandra Guzmán"), "alejandraguzman");
});

test("comparator evidence must be newly discovered and recently published", () => {
  const sessionStartedAt = "2026-09-26T12:00:00.000Z";
  assert.equal(isYoutubeComparatorWindowCandidate({
    sessionStartedAt,
    catalogDiscoveredAt: "2026-09-26T12:05:00.000Z",
    publishedAt: "2026-09-26T11:00:00.000Z",
  }), true);
  assert.equal(isYoutubeComparatorWindowCandidate({
    sessionStartedAt,
    catalogDiscoveredAt: "2026-09-26T11:59:59.000Z",
    publishedAt: "2026-09-26T12:10:00.000Z",
  }), false);
  assert.equal(isYoutubeComparatorWindowCandidate({
    sessionStartedAt,
    catalogDiscoveredAt: "2026-09-26T12:05:00.000Z",
    publishedAt: null,
  }), false);
});
