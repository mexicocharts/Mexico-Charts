import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeSocialUrl, mergeSocialEvidence } from "./artist-social-discovery-policy";

test("canonicalizes account URLs and rejects non-account or unknown links", () => {
  assert.deepEqual(canonicalizeSocialUrl("https://www.instagram.com/Artist/?utm_source=x"), {
    platform: "instagram", canonicalUrl: "https://instagram.com/Artist",
  });
  assert.equal(canonicalizeSocialUrl("https://youtu.be/video"), null);
  assert.equal(canonicalizeSocialUrl("https://open.spotify.com/track/123"), null);
  assert.equal(canonicalizeSocialUrl("https://example.com/@artist"), null);
});

test("only exact mappings or independent corroboration auto-verify", () => {
  const candidates = mergeSocialEvidence([
    { platform: "spotify", canonicalUrl: "https://open.spotify.com/artist/abc", source: "spotify_verified_mapping", exactProviderMapping: true },
    { platform: "instagram", canonicalUrl: "https://instagram.com/a", source: "songstats_artist_info" },
    { platform: "tiktok", canonicalUrl: "https://tiktok.com/@a", source: "songstats_artist_info" },
    { platform: "tiktok", canonicalUrl: "https://tiktok.com/@a", source: "musicbrainz_url_relation" },
  ]);
  assert.equal(candidates.find(row => row.platform === "spotify")?.status, "verified");
  assert.equal(candidates.find(row => row.platform === "instagram")?.status, "review");
  assert.equal(candidates.find(row => row.platform === "tiktok")?.status, "verified");
});
