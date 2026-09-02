import assert from "node:assert/strict";
import test from "node:test";
import {
  MonitoringDashboardHttpError,
  internalMonitoringEntryPath,
  monitoringDashboardViewState,
  shouldLoadPublicMonitoringCatalog,
  shouldRetryMonitoringDashboard,
} from "./monitoringAccess.mjs";

test("founder monitoring entry does not depend on the public ready-only catalog", () => {
  assert.equal(internalMonitoringEntryPath({ internalArtistProAccess: true }), "/monitoreo/luismiguel");
  assert.equal(
    internalMonitoringEntryPath({ internalArtistProAccess: true, requestedArtistKey: "luis-miguel" }),
    "/monitoreo/luis-miguel",
  );
  assert.equal(internalMonitoringEntryPath({ internalArtistProAccess: false }), null);
});

test("signed-in founder never starts the public ready-only catalog audit", () => {
  assert.equal(shouldLoadPublicMonitoringCatalog({ isSignedIn: true }), false);
  assert.equal(shouldLoadPublicMonitoringCatalog({
    isSignedIn: true,
    accountAccess: { internalArtistProAccess: true },
  }), false);
  assert.equal(shouldLoadPublicMonitoringCatalog({
    isSignedIn: true,
    accountAccess: { internalArtistProAccess: false },
  }), true);
  assert.equal(shouldLoadPublicMonitoringCatalog({ isSignedIn: false }), true);
});

for (const status of [401, 403]) {
  test(`dashboard HTTP ${status} is not retried`, () => {
    const error = new MonitoringDashboardHttpError(status, "Denied");
    assert.equal(shouldRetryMonitoringDashboard(0, error), false);
    assert.equal(shouldRetryMonitoringDashboard(1, error), false);
  });

  test(`dashboard HTTP ${status} stays in terminal error instead of loading`, () => {
    const error = new MonitoringDashboardHttpError(status, "Denied");
    assert.equal(monitoringDashboardViewState({ isLoading: true, error, hasData: false }), "error");
  });
}

test("dashboard HTTP 503 is terminal and cannot return to loading", () => {
  const error = new MonitoringDashboardHttpError(503, "Unavailable");
  assert.equal(shouldRetryMonitoringDashboard(0, error), false);
  assert.equal(shouldRetryMonitoringDashboard(1, error), false);
  assert.equal(monitoringDashboardViewState({ isLoading: true, error, hasData: false }), "error");
});

test("a transport failure retains one retry", () => {
  const error = new Error("Network unavailable");
  assert.equal(shouldRetryMonitoringDashboard(0, error), true);
  assert.equal(shouldRetryMonitoringDashboard(1, error), false);
});
