import assert from "node:assert/strict";
import test from "node:test";
import { mergeSupplementalMetadata, SUPPLEMENTAL_ARTISTS } from "./supplemental-artist-data";

test("supplemental provider catalog contains the 30 approved artists", () => {
  assert.equal(SUPPLEMENTAL_ARTISTS.length, 30);
  assert.equal(new Set(SUPPLEMENTAL_ARTISTS.map(row => row.artistKey)).size, 30);
  assert.ok(SUPPLEMENTAL_ARTISTS.every(row => /^[A-Za-z0-9]{22}$/.test(row.spotifyArtistId)));
});

test("metadata merge is idempotent and preserves the legacy sheet row", () => {
  const legacy = [{ artist_key: "gera mx", artist_name: "Legacy Gera", source_country: "Mexico" }];
  const once = mergeSupplementalMetadata(legacy);
  const twice = mergeSupplementalMetadata(once);
  assert.equal(once.length, 30);
  assert.equal(twice.length, 30);
  assert.equal(once.find(row => row.artist_key === "gera mx")?.artist_name, "Legacy Gera");
  assert.ok(once.every(row => row.source_country === "Mexico"));
});
