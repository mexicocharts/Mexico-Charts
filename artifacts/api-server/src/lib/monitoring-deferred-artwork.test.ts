import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadCompleteMonitoringKworbCatalog, summarizeMonitoringKworbCatalog } from "./monitoring-kworb-catalog";
import { loadCatalogArtworkBatch } from "./monitoring-catalog-artwork";

test("base resolves while independent artwork is slow, then decoration leaves catalog truth unchanged", async () => {
  const original = globalThis.fetch;
  let release!: () => void;
  let started!: () => void;
  const begun = new Promise<void>(resolve => { started = resolve; });
  const hold = new Promise<void>(resolve => { release = resolve; });
  let externalCalls = 0;
  globalThis.fetch = (async input => {
    const url = String(input);
    assert.ok(url.startsWith("https://kworb.net/"), "initial loader may only acquire catalog pages");
    const type = url.endsWith("_songs.html") ? "track" : "album";
    return new Response(`<tr><td class="text"><a href="https://open.spotify.com/${type}/${"d".repeat(22)}">Fixture</a></td><td>1234</td><td>7</td></tr>`);
  }) as typeof fetch;
  try {
    const slow = (async () => {
      externalCalls++; started(); await hold;
      return Response.json({ thumbnail_url: "https://i.scdn.co/image/deferred-fixture" });
    }) as typeof fetch;
    const resource = { type: "track" as const, key: "d".repeat(22) };
    const first = loadCatalogArtworkBatch([resource], slow);
    await begun;
    const second = loadCatalogArtworkBatch([resource], slow);
    const base = await loadCompleteMonitoringKworbCatalog("deferred-test-base");
    assert.equal(base.items.length, 2);
    assert.ok(base.items.every(item => item.artworkUrl === null));
    const before = structuredClone(base);
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.deepEqual(a, b);
    assert.equal(externalCalls, 1, "equivalent concurrent secondary requests are coalesced");
    assert.equal(a[0]!.status, "loaded");
    const decorated = base.items.map(item => ({ ...item,
      artworkUrl: item.artworkUrl ?? a.find(image => image.resource === `${item.type}:${item.key}`)?.artworkUrl ?? null }));
    assert.equal(decorated[0]!.artworkUrl, "https://i.scdn.co/image/deferred-fixture");
    assert.deepEqual(summarizeMonitoringKworbCatalog(decorated), summarizeMonitoringKworbCatalog(base.items));
    assert.deepEqual(base, before, "decoration never mutates cached catalog truth");
  } finally { release?.(); globalThis.fetch = original; }
});

test("stored images resolve immediately; failed optional images remain pending without dropping metrics", async () => {
  const stored = { type: "album" as const, key: "s".repeat(22), artworkUrl: "https://i.scdn.co/image/stored-fixture" };
  const fail = (async () => { throw new Error("fixture artwork outage"); }) as typeof fetch;
  const result = await loadCatalogArtworkBatch([stored], fail);
  assert.equal(result[0]!.artworkUrl, stored.artworkUrl);
  assert.equal(result[0]!.status, "loaded");
  const pending = await loadCatalogArtworkBatch([{ type: "album", key: "f".repeat(22) }], fail);
  assert.equal(pending[0]!.status, "pending");
  assert.equal(pending[0]!.artworkUrl, null);
  const original = globalThis.fetch;
  globalThis.fetch = (async input => {
    if (!String(input).startsWith("https://kworb.net/")) return fail(input);
    return new Response('<tr><td class="text">Existing row</td><td>99</td><td>0</td></tr>');
  }) as typeof fetch;
  try {
    const base = await loadCompleteMonitoringKworbCatalog("failed-artwork-base");
    assert.deepEqual(base.items.map(x => [x.totalStreams, x.dailyStreams]), [[99, 0], [99, 0]]);
  } finally { globalThis.fetch = original; }
});

test("dashboard keeps its immediate stored/cache merge and secondary request stays authenticated and catalog-scoped", () => {
  const route = readFileSync(new URL("../routes/monitoring.ts", import.meta.url), "utf8");
  assert.match(route, /item\.artwork_url\s*\?\?\s*releaseArtwork\.get\(normalizedMonitoringReleaseTitle\(item\.title\)\)\s*\?\?\s*cachedCatalogArtwork/);
  assert.match(route, /router\.get\("\/monitoring\/artwork\/:artistKey", requireMonitoringClerkUser/);
  assert.match(route, /Artwork must belong to this artist's catalog/);
});
