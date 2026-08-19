import assert from "node:assert/strict";
import test from "node:test";
import { exportSafeImageUrl, waitForExportImages, weeklyCardRenderOptions } from "./weeklyCardExport.mjs";

test("routes remote artwork through the same-origin image proxy", () => {
  assert.equal(
    exportSafeImageUrl("https://i.scdn.co/image/a b"),
    "/api/image-proxy?url=https%3A%2F%2Fi.scdn.co%2Fimage%2Fa%20b",
  );
  assert.equal(exportSafeImageUrl("/images/fallback.png"), "/images/fallback.png");
  assert.equal(exportSafeImageUrl(null), null);
});

test("accepts images that are already decoded", async () => {
  const node = { querySelectorAll: () => [{ complete: true, naturalWidth: 640, src: "/ready.png" }] };
  await waitForExportImages(node);
});

test("rejects an already-failed image instead of exporting an empty frame", async () => {
  const node = { querySelectorAll: () => [{ complete: true, naturalWidth: 0, src: "/broken.png" }] };
  await assert.rejects(() => waitForExportImages(node), /No se pudo cargar/);
});

test("skips cross-origin webfont parsing during card export", () => {
  assert.equal(weeklyCardRenderOptions().fontEmbedCSS, "");
});
