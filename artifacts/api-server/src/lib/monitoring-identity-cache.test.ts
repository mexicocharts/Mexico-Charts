import assert from "node:assert/strict";
import test from "node:test";
import { createMonitoringIdentityCache } from "./monitoring-identity-cache";
import { authorizeMonitoringArtist } from "./monitoring-authorization";

test("exact artist keys reuse successful source identities for only 60 seconds", async () => {
  let clock = 0, reads = 0;
  const cache = createMonitoringIdentityCache<{ keys: string[] }>(() => clock);
  const load = async () => { reads++; return { keys: ["canonical"] }; };
  const first = await cache("alias", load);
  first!.keys.push("must-not-poison-cache");
  clock = 59_999;
  assert.deepEqual(await cache("alias", load), { keys: ["canonical"] });
  assert.equal(reads, 1);
  await cache("Alias", load);
  assert.equal(reads, 2, "exact keys cannot leak conflict/alias resolution");
  clock = 60_000;
  await cache("alias", load);
  assert.equal(reads, 3);
});

test("overlapping reads coalesce; failed and missing identities do not persist", async () => {
  const cache = createMonitoringIdentityCache<{ key: string }>();
  let reads = 0, finish!: (value: { key: string }) => void;
  const outcomes: string[] = [];
  const load = () => { reads++; return new Promise<{ key: string }>(resolve => { finish = resolve; }); };
  const first = cache("artist", load, value => outcomes.push(value));
  const second = cache("artist", load, value => outcomes.push(value));
  await Promise.resolve();
  finish({ key: "artist" });
  assert.deepEqual(await first, await second);
  assert.equal(reads, 1);
  assert.deepEqual(outcomes, ["miss", "coalesced"]);
  const failure = new Error("Query read timeout");
  await assert.rejects(cache("failed", async () => { throw failure; }), error => error === failure);
  assert.deepEqual(await cache("failed", async () => ({ key: "recovered" })), { key: "recovered" });
  assert.equal(await cache("absent", async () => null), null);
  assert.deepEqual(await cache("absent", async () => ({ key: "newly-available" })), { key: "newly-available" });
});

test("expired entries are never served on error and storage is bounded", async () => {
  let clock = 0;
  const cache = createMonitoringIdentityCache<number>(() => clock);
  await cache("old", async () => 1);
  clock = 60_000;
  await assert.rejects(cache("old", async () => { throw new Error("offline"); }), /offline/);
  for (let index = 0; index < 513; index++) await cache(String(index), async () => index);
  assert.equal(await cache("0", async () => -1), -1, "oldest retained identity is evicted");
});

test("cached source identity never retains a revoked subscription or founder entitlement", async () => {
  const cache = createMonitoringIdentityCache<{ artist_key: string; artist_name: string; status: string; created_at: null }>();
  const identity = { artist_key: "artist", artist_name: "Artist", status: "internal", created_at: null };
  let reads = 0;
  const findExistingArtist = (key: string) => cache(key, async () => { reads++; return identity; });
  const base = { userId: "viewer", requestedArtistKey: "artist", findExistingArtist };
  assert.equal((await authorizeMonitoringArtist({ ...base, internalUserIds: "viewer", findActiveSubscription: async () => null })).allowed, true);
  assert.equal((await authorizeMonitoringArtist({ ...base, internalUserIds: "", findActiveSubscription: async () => null })).allowed, false);
  assert.equal((await authorizeMonitoringArtist({ ...base, internalUserIds: "", findActiveSubscription: async () => identity })).allowed, true);
  assert.equal((await authorizeMonitoringArtist({ ...base, internalUserIds: "", findActiveSubscription: async () => null })).allowed, false);
  assert.equal(reads, 1);
});
