import assert from "node:assert/strict";
import test from "node:test";
import { resolveArtistProEntitlement } from "./artist-pro-entitlement";

test("regular free user is denied Artist Pro access", async () => {
  const entitlement = await resolveArtistProEntitlement({
    userId: "user_free",
    internalUserIds: "user_founder",
    hasActiveSubscription: async () => false,
  });
  assert.equal(entitlement, null);
});

test("active Artist Pro subscriber is allowed", async () => {
  const entitlement = await resolveArtistProEntitlement({
    userId: "user_subscriber",
    internalUserIds: "user_founder",
    hasActiveSubscription: async () => true,
  });
  assert.deepEqual(entitlement, { source: "subscription" });
});

test("authorized founder or admin is allowed without a subscription", async () => {
  let subscriptionLookupCalled = false;
  const entitlement = await resolveArtistProEntitlement({
    userId: "user_founder",
    internalUserIds: " user_founder, user_admin ",
    hasActiveSubscription: async () => {
      subscriptionLookupCalled = true;
      return false;
    },
  });
  assert.deepEqual(entitlement, { source: "internal" });
  assert.equal(subscriptionLookupCalled, false);
});

test("unauthenticated user is denied before any entitlement lookup", async () => {
  let subscriptionLookupCalled = false;
  const entitlement = await resolveArtistProEntitlement({
    userId: null,
    internalUserIds: "user_founder",
    hasActiveSubscription: async () => {
      subscriptionLookupCalled = true;
      return true;
    },
  });
  assert.equal(entitlement, null);
  assert.equal(subscriptionLookupCalled, false);
});
