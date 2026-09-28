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
