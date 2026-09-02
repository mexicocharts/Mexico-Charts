import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountMeResponse } from "./account-response";

test("account response preserves founder entitlement without a paid plan", () => {
  const response = buildAccountMeResponse({
    userId: "user_founder",
    account: { plan: "free", subscriptionStatus: null },
    savedArtists: [],
    monitoringSubscriptions: [],
    profile: null,
    connections: [],
    connectionAvailability: { spotify: false, lastfm: false },
    internalUserIds: "user_founder",
  });

  assert.equal(response.plan, "free");
  assert.equal(response.subscriptionStatus, null);
  assert.equal(response.internalArtistProAccess, true);
});

test("account response does not grant internal access to a regular free user", () => {
  const response = buildAccountMeResponse({
    userId: "user_free",
    account: { plan: "free", subscriptionStatus: null },
    savedArtists: [],
    monitoringSubscriptions: [],
    profile: null,
    connections: [],
    connectionAvailability: {},
    internalUserIds: "user_founder",
  });

  assert.equal(response.internalArtistProAccess, false);
});
