import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalogArtworkKeys, loadCatalogArtworkBatch, cachedCatalogArtwork } from "./monitoring-catalog-artwork";

test("artwork accepts only bounded resource IDs, never URLs or arbitrary hosts", () => {
  assert.deepEqual(parseCatalogArtworkKeys(`track:${"a".repeat(22)}`), [`track:${"a".repeat(22)}`]);
  for (const raw of ["", "https://localhost", "artist:" + "a".repeat(22), Array.from({length:13}, (_, i) => `track:${String(i).padStart(22, "0")}`).join(",")]) assert.equal(parseCatalogArtworkKeys(raw), null);
});

test("all catalog positions can load with max four upstream reads; cache/coalescing prevents repeat work", async () => {
  let calls = 0, active = 0, peak = 0;
  const items = Array.from({length:12}, (_, i) => ({type:"track" as const, key: String(i + 400).padStart(22, "0")}));
  const fetcher = (async () => {
    calls++; active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return Response.json({ thumbnail_url: "https://i.scdn.co/image/real-provider-image" });
  }) as typeof fetch;
  const [a,b] = await Promise.all([loadCatalogArtworkBatch(items, fetcher), loadCatalogArtworkBatch(items, fetcher)]);
  assert.deepEqual(a,b); assert.equal(calls, 12); assert.equal(peak,4);
  assert.equal(a.filter(item => item.status === "loaded").length,12);
  await loadCatalogArtworkBatch(items, fetcher); assert.equal(calls,12);
  assert.ok(cachedCatalogArtwork(items[0]!));
});

test("failed/provider-invalid images stay pending rather than fabricated or permanently cached", async () => {
  const items = [{ type:"album" as const, key:"z".repeat(22) }];
  for (const response of [Response.json({}, {status:403}), Response.json({thumbnail_url:"https://localhost/private"})]) {
    const result = await loadCatalogArtworkBatch(items, (async () => response) as typeof fetch);
    assert.equal(result[0]?.status,"pending"); assert.equal(result[0]?.artworkUrl,null);
  }
});
