import assert from "node:assert/strict";
import test from "node:test";
import { responsiveImageSource } from "./imageDelivery.ts";

test("keeps unknown image providers unchanged for existing fallback behavior", () => {
  const source = "https://images.example.test/artist/original.jpg";
  assert.deepEqual(responsiveImageSource(source, 48), { src: source });
});

test("uses provider-native YouTube thumbnail variants", () => {
  const result = responsiveImageSource("https://i.ytimg.com/vi/abc123/hqdefault.jpg", 48);
  assert.equal(result.src, "https://i.ytimg.com/vi/abc123/default.jpg");
  assert.match(result.srcSet ?? "", /default\.jpg 120w, .*mqdefault\.jpg 320w/);
  assert.equal(result.sizes, "48px");
});

test("uses DPR-sized Deezer and Apple artwork variants", () => {
  const deezer = responsiveImageSource("https://e-cdns-images.dzcdn.net/images/cover/id/1000x1000-000000-80-0-0.jpg", 48);
  assert.match(deezer.srcSet ?? "", /96x96-.* 96w, .*192x192-.* 192w/);

  const apple = responsiveImageSource("https://is1-ssl.mzstatic.com/image/thumb/id/600x600bb.jpg", 48);
  assert.match(apple.srcSet ?? "", /96x96bb\.jpg 96w, .*192x192bb\.jpg 192w/);
});
