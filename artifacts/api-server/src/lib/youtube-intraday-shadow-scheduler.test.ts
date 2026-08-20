import assert from "node:assert/strict";
import test from "node:test";
import {
  youtubeShadowArtistIdentityKey,
  youtubeShadowCanUseVerifiedChannelFallback,
  youtubeShadowDiscoveryFailure,
  youtubeShadowPilotIsReady,
} from "./youtube-shadow-bootstrap-policy";

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
  }), "No eligible review candidates were discovered.");
});

test("accepts a discovery only when at least one eligible candidate exists", () => {
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
