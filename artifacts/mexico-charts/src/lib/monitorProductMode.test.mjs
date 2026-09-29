import assert from "node:assert/strict";
import test from "node:test";
import { MONITOR_PRIVATE_DIAGNOSTICS_ENABLED } from "./monitorProductMode.mjs";
import { beginMonitorClientTrace, markMonitorPanelCommit } from "./monitorClientTrace.mjs";
test("release client creates no trace, overlay, body proxy or timing callback", () => {
  assert.equal(MONITOR_PRIVATE_DIAGNOSTICS_ENABLED, false);
  assert.equal(beginMonitorClientTrace("/api/monitoring/dashboard/fixture"), undefined);
  assert.doesNotThrow(() => markMonitorPanelCommit("fixture"));
});
