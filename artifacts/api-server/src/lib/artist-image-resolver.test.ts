import test from "node:test";
import assert from "node:assert/strict";
import { isArtistImageCandidateUrl, validateArtistImagePayload } from "./artist-image-resolver";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

test("artist image validation accepts a usable PNG and rejects non-images", () => {
  assert.equal(validateArtistImagePayload("image/png", png(600, 600)).status, "valid");
  assert.equal(validateArtistImagePayload("text/html", png(600, 600)).status, "invalid-content-type");
  assert.equal(validateArtistImagePayload("image/png", png(1, 1)).status, "invalid-dimensions");
});

test("artist image URL validation rejects placeholders before fetching", () => {
  assert.equal(isArtistImageCandidateUrl("https://cdn-images.dzcdn.net/images/artist//1000x1000.jpg"), false);
  assert.equal(isArtistImageCandidateUrl("https://cdn-images.dzcdn.net/images/artist/abc/1000x1000.jpg"), true);
});