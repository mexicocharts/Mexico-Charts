import assert from "node:assert/strict";
import test from "node:test";

import { YoutubeLiveCoverageCache } from "./youtube-live-coverage-cache";

test("reuses an exact coverage result only within its TTL", async () => {
  let now = 1_000;
  let loads = 0;
  const cache = new YoutubeLiveCoverageCache<number>(30_000, () => now);
  const loader = async () => ++loads;

  assert.deepEqual(await cache.getOrLoad("latest", loader), { value: 1, source: "miss" });
  now += 29_999;
  assert.deepEqual(await cache.getOrLoad("latest", loader), { value: 1, source: "hit" });
  now += 1;
  assert.deepEqual(await cache.getOrLoad("latest", loader), { value: 2, source: "miss" });
});

test("coalesces concurrent coverage reads without cross-mode reuse", async () => {
  let release!: (value: number) => void;
  let loads = 0;
  const cache = new YoutubeLiveCoverageCache<number>(30_000);
  const loader = () => {
    loads += 1;
    return new Promise<number>(resolve => { release = resolve; });
  };

  const first = cache.getOrLoad("latest", loader);
  const second = cache.getOrLoad("latest", loader);
  const legacy = cache.getOrLoad("legacy", async () => 9);
  release(7);

  assert.deepEqual(await first, { value: 7, source: "miss" });
  assert.deepEqual(await second, { value: 7, source: "coalesced" });
  assert.deepEqual(await legacy, { value: 9, source: "miss" });
  assert.equal(loads, 1);
});

test("a failed loader is never cached as stale success", async () => {
  let loads = 0;
  const cache = new YoutubeLiveCoverageCache<number>(30_000);

  await assert.rejects(
    cache.getOrLoad("latest", async () => {
      loads += 1;
      throw new Error("database unavailable");
    }),
    /database unavailable/,
  );

  assert.deepEqual(
    await cache.getOrLoad("latest", async () => ++loads),
    { value: 2, source: "miss" },
  );
});
