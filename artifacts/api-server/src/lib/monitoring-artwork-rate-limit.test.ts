import test from "node:test";
import assert from "node:assert/strict";
import { createArtworkRateLimit } from "./monitoring-artwork-rate-limit";

test("429 cooldown suppresses subsequent provider calls and expires without jobs", async () => {
  let now = 0, calls = 0;
  const limiter = createArtworkRateLimit(() => now);
  const fetcher = (async () => { calls++; return new Response(null, { status: 429, headers: { "retry-after": "0" } }); }) as typeof fetch;
  await limiter.fetch("https://open.spotify.com/oembed", {}, fetcher);
  assert.equal(limiter.remaining(), 60_000);
  await assert.rejects(limiter.fetch("https://open.spotify.com/oembed", {}, fetcher));
  assert.equal(calls, 1);
  now = 60_001;
  await limiter.fetch("https://open.spotify.com/oembed", {}, (async () => { calls++; return new Response(null); }) as typeof fetch);
  assert.equal(calls, 2);
});

test("longer Retry-After is respected; ordinary failures do not invent throttling", async () => {
  const limiter = createArtworkRateLimit(() => 0);
  await limiter.fetch("https://open.spotify.com/oembed", {}, (async () => new Response(null, { status: 403 })) as typeof fetch);
  assert.equal(limiter.remaining(), 0);
  await limiter.fetch("https://open.spotify.com/oembed", {}, (async () => new Response(null, { status: 429, headers: { "retry-after": "120" } })) as typeof fetch);
  assert.equal(limiter.remaining(), 120_000);
});

test("both artwork callers share four slots and queued requests observe a new 429", async () => {
  const limiter = createArtworkRateLimit(() => 0);
  let calls = 0, active = 0, peak = 0;
  const finish: Array<() => void> = [];
  const fetcher = (async () => {
    calls++; active++; peak = Math.max(peak, active);
    await new Promise<void>(resolve => finish.push(resolve));
    active--;
    return new Response(null, { status: 429 });
  }) as typeof fetch;
  const requests = Array.from({ length: 24 }, () => limiter.fetch("https://open.spotify.com/oembed", {}, fetcher));
  const results = Promise.allSettled(requests);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 4);
  finish.forEach(resolve => resolve());
  const settled = await results;
  assert.equal(peak, 4);
  assert.equal(calls, 4, "the other twenty must not reach the provider after 429");
  assert.equal(settled.filter(result => result.status === "rejected").length, 20);
});

test("cancelled queued requests do not leak slots or prevent later artwork reads", async () => {
  const limiter = createArtworkRateLimit();
  const finish: Array<() => void> = [];
  const fetcher = (async () => { await new Promise<void>(resolve => finish.push(resolve)); return new Response(null); }) as typeof fetch;
  const occupying = Array.from({ length: 4 }, () => limiter.fetch("https://open.spotify.com/oembed", {}, fetcher));
  const controller = new AbortController();
  const queued = limiter.fetch("https://open.spotify.com/oembed", { signal: controller.signal }, fetcher);
  const rejected = assert.rejects(queued);
  controller.abort();
  await rejected;
  finish.forEach(resolve => resolve());
  await Promise.all(occupying);
  let calls = 0;
  await Promise.all(Array.from({ length: 4 }, () => limiter.fetch("https://open.spotify.com/oembed", {}, (async () => { calls++; return new Response(null); }) as typeof fetch)));
  assert.equal(calls, 4);
});
