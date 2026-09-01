import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES } from "./artist-pro-entitlement";
import { authorizeMonitoringArtist, type MonitoringArtistGrant } from "./monitoring-authorization";
import { monitoringArtistAliasesMatch } from "./songstats-artist-key";

const luisMiguel: MonitoringArtistGrant = {
  artist_key: "luismiguel",
  artist_name: "Luis Miguel",
  status: "internal",
  created_at: null,
};

const noSubscription = async () => null;
const existingLuisMiguel = async (requestedArtistKey: string) =>
  monitoringArtistAliasesMatch("luismiguel", requestedArtistKey) ? luisMiguel : null;

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
    let existingLookupCalled = false;
    const result = await authorizeMonitoringArtist({
      userId: `user_${status}`,
      requestedArtistKey: "luis-miguel",
      internalUserIds: "user_founder",
      findActiveSubscription: async () => subscription,
      findExistingArtist: async () => {
        existingLookupCalled = true;
        return luisMiguel;
      },
    });
    assert.equal(result.allowed, true);
    assert.equal(result.source, "subscription");
    assert.equal(result.grant?.status, status);
    assert.equal(existingLookupCalled, false);
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
