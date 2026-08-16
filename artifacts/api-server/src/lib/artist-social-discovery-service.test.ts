import assert from "node:assert/strict";
import test from "node:test";
import { evidenceForArtist } from "./artist-social-discovery-service";

test("uses stored evidence only and never derives a guessed handle", () => {
  const evidence = evidenceForArtist({
    artist_key: "artist", spotify_artist_id: "abc123", spotify_url: null,
    youtube_channel_id: "UC123456789", youtube_custom_url: null,
    artist_info: { links: [{ url: "https://instagram.com/real.artist" }, { url: "https://bad.example/artist" }] },
    relations: [{ type: "social network", url: "https://instagram.com/real.artist/" }],
  });
  assert.deepEqual(evidence.map(item => item.source), [
    "spotify_verified_mapping", "youtube_verified_channel", "songstats_artist_info", "musicbrainz_url_relation",
  ]);
  assert.equal(evidence.some(item => item.canonicalUrl.includes("artist_key")), false);
});
