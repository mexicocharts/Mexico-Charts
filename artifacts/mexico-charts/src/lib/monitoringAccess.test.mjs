import assert from "node:assert/strict";
import test from "node:test";
import {
  MonitoringDashboardHttpError,
  internalMonitoringEntryPath,
  monitoringDashboardViewState,
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

test("transient dashboard failures retain one retry", () => {
  const error = new MonitoringDashboardHttpError(503, "Unavailable");
  assert.equal(shouldRetryMonitoringDashboard(0, error), true);
  assert.equal(shouldRetryMonitoringDashboard(1, error), false);
});
