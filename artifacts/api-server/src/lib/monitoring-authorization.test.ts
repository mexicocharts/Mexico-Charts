import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES } from "./artist-pro-entitlement";
import { authorizeMonitoringArtist, monitoringAuthorizedSourceKeys, type MonitoringArtistGrant } from "./monitoring-authorization";
import { monitoringArtistAliasesMatch } from "./songstats-artist-key";
import { monitoringIdentityKeyCandidates } from "./monitoring-candidate-policy";

const luisMiguel: MonitoringArtistGrant = {
  artist_key: "luismiguel",
  artist_name: "Luis Miguel",
  status: "internal",
  created_at: null,
};

const noSubscription = async () => null;
const existingLuisMiguel = async (requestedArtistKey: string) =>
  monitoringArtistAliasesMatch("luismiguel", requestedArtistKey) ? luisMiguel : null;

test("source scope preserves verified aliases without trusting the grant display name", () => {
  const grant = { ...luisMiguel, artist_name: "Unrelated Artist", match_keys: ["luis miguel", "accepted-stage-name"] };
  assert.deepEqual(monitoringAuthorizedSourceKeys(grant, monitoringIdentityKeyCandidates),
    ["luismiguel", "luis miguel", "accepted-stage-name", "acceptedstagename"]);
  assert.equal(grant.artist_name, "Unrelated Artist", "display and billing identity stay intact");
  assert.deepEqual(monitoringAuthorizedSourceKeys({ ...grant, match_keys: undefined }, monitoringIdentityKeyCandidates), ["luismiguel"]);
});

test("conflicts preserve the exact granted key and never normalize aliases or names", () => {
  const grant = { ...luisMiguel, artist_key: "Luis Miguel", identity_conflict: true, match_keys: ["unrelated artist"] };
  assert.deepEqual(monitoringAuthorizedSourceKeys(grant, () => { throw new Error("Conflict must not expand"); }), ["Luis Miguel"]);
  assert.deepEqual(monitoringAuthorizedSourceKeys({ ...grant, artist_key: "X東京", identity_conflict: false, match_keys: [] }, monitoringIdentityKeyCandidates), ["X東京", "x東京"]);
});

test("unauthenticated user is denied", async () => {
  const result = await authorizeMonitoringArtist({
    userId: null,
    requestedArtistKey: "luis-miguel",
    internalUserIds: "user_founder",
    findActiveSubscription: async () => luisMiguel,
    findExistingArtist: existingLuisMiguel,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.outcome, "entitlement_denied");
});

test("regular free user is denied", async () => {
  const result = await authorizeMonitoringArtist({
    userId: "user_free",
    requestedArtistKey: "luis-miguel",
    internalUserIds: "user_founder",
    findActiveSubscription: noSubscription,
    findExistingArtist: existingLuisMiguel,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.source, null);
});

test("active or trialing subscriber keeps the existing artist-specific grant", async () => {
  assert.deepEqual([...ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES], ["active", "trialing"]);
  for (const status of ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES) {
    const subscription = { ...luisMiguel, status };
    const existingLookups: string[] = [];
    const result = await authorizeMonitoringArtist({
      userId: `user_${status}`,
      requestedArtistKey: "luis-miguel",
      internalUserIds: "user_founder",
      findActiveSubscription: async () => subscription,
      findExistingArtist: async artistKey => {
        existingLookups.push(artistKey);
        return luisMiguel;
      },
    });
    assert.equal(result.allowed, true);
    assert.equal(result.source, "subscription");
    assert.equal(result.grant?.status, status);
    assert.deepEqual(existingLookups, [subscription.artist_key]);
    assert.equal(result.grant?.artist_key, subscription.artist_key);
    assert.equal(result.grant?.artist_name, subscription.artist_name);
    assert.equal(result.publicReadinessEvaluated, false);
  }
});

test("paid source aliases resolve from the authorized grant without replacing its billing identity", async () => {
  const subscription = { ...luisMiguel, status: "active", created_at: new Date("2026-08-01T00:00:00Z") };
  const calls: string[] = [];
  const result = await authorizeMonitoringArtist({
    userId: "paid-user", requestedArtistKey: "untrusted-requested-artist", internalUserIds: "founder",
    findActiveSubscription: async () => subscription,
    findExistingArtist: async key => {
      calls.push(key);
      return { ...luisMiguel, artist_key: "luis-miguel-approved", artist_name: "Registry display name",
        match_keys: ["luismiguel", "luis-miguel-approved", "luis miguel"] };
    },
  });
  assert.deepEqual(calls, [subscription.artist_key]);
  assert.equal(result.allowed, true);
  assert.equal(result.source, "subscription");
  assert.deepEqual(result.grant, { ...subscription,
    match_keys: ["luismiguel", "luis-miguel-approved", "luis miguel"], identity_conflict: false });
  assert.equal(result.publicReadinessEvaluated, false);
});

test("conflicting identity aliases remain isolated to the paid artist key", async () => {
  const subscription = { ...luisMiguel, status: "trialing" };
  const result = await authorizeMonitoringArtist({
    userId: "paid-user", requestedArtistKey: "luis-miguel", internalUserIds: "founder",
    findActiveSubscription: async () => subscription,
    findExistingArtist: async () => ({ ...luisMiguel, artist_key: "conflicting-canonical",
      match_keys: ["conflicting-canonical", "unrelated-artist"], identity_conflict: true }),
  });
  assert.deepEqual(result.grant, { ...subscription, match_keys: [subscription.artist_key], identity_conflict: true });
  assert.equal(result.source, "subscription");
});

test("missing source identity retains the paid grant, while a failed lookup remains a failure", async () => {
  const subscription = { ...luisMiguel, status: "active" };
  const input = {
    userId: "paid-user", requestedArtistKey: "luis-miguel", internalUserIds: "founder",
    findActiveSubscription: async () => subscription,
  };
  const result = await authorizeMonitoringArtist({ ...input, findExistingArtist: async () => null });
  assert.equal(result.allowed, true);
  assert.equal(result.grant, subscription);
  assert.equal(result.source, "subscription");
  const failure = new Error("Source identity read failed");
  await assert.rejects(authorizeMonitoringArtist({ ...input, findExistingArtist: async () => { throw failure; } }),
    error => error === failure);
});

test("denied users never trigger source identity lookups", async () => {
  for (const userId of [null, "free-user"]) {
    let lookups = 0;
    const result = await authorizeMonitoringArtist({
      userId, requestedArtistKey: "private-artist", internalUserIds: "founder",
      findActiveSubscription: async () => null,
      findExistingArtist: async () => { lookups++; return luisMiguel; },
    });
    assert.equal(result.allowed, false);
    assert.equal(lookups, 0);
  }
});

test("internal founder can inspect Luis Miguel when public readiness is missing_licensed_endpoint", async () => {
  const publicReadiness = {
    ready: false,
    reasons: ["missing_licensed_endpoint"],
  } as const;
  let subscriptionLookupCalled = false;
  const result = await authorizeMonitoringArtist({
    userId: "user_founder",
    requestedArtistKey: "luis-miguel",
    internalUserIds: "user_founder",
    findActiveSubscription: async () => {
      subscriptionLookupCalled = true;
      return null;
    },
    findExistingArtist: async requestedArtistKey => {
      assert.equal(publicReadiness.ready, false);
      assert.deepEqual(publicReadiness.reasons, ["missing_licensed_endpoint"]);
      return existingLuisMiguel(requestedArtistKey);
    },
  });
  assert.equal(result.allowed, true);
  assert.equal(result.source, "internal");
  assert.equal(result.grant?.artist_key, "luismiguel");
  assert.equal(result.publicReadinessEvaluated, false);
  assert.equal(subscriptionLookupCalled, false);
});

test("internal founder is denied for a nonexistent artist", async () => {
  const result = await authorizeMonitoringArtist({
    userId: "user_founder",
    requestedArtistKey: "not-a-real-artist",
    internalUserIds: "user_founder",
    findActiveSubscription: noSubscription,
    findExistingArtist: existingLuisMiguel,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.source, "internal");
  assert.equal(result.outcome, "artist_not_found");
});

test("Luis Miguel aliases resolve consistently", () => {
  for (const alias of ["luis-miguel", "luis miguel", "luismiguel"]) {
    assert.equal(monitoringArtistAliasesMatch("luismiguel", alias), true, alias);
  }
});
