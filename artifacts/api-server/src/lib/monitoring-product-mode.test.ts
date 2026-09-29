import assert from "node:assert/strict";
import test from "node:test";
import { installPrivatePoolTrace, runPrivateLoaderTrace, privateLoaderPhase } from "./monitoring-private-loader-trace";
import { prepareIdentityProbe, identityProbeEnabled } from "./monitoring-private-identity-probe";
import { withDirectoryDiagnostics } from "./monitoring-directory-diagnostics";
import { MONITOR_PRIVATE_DIAGNOSTICS_ENABLED } from "./monitoring-product-mode";

test("product mode cannot reactivate query tags, plans, socket probes or tracing through stale preview env", async () => {
  const names = ["MONITOR_PRO_READONLY_PREVIEW", "MONITOR_PRO_LOADER_TRACE_KEY", "MONITOR_PRO_IDENTITY_DIAGNOSTIC_KEYS"];
  const previous = names.map(name => process.env[name]);
  try {
    process.env.MONITOR_PRO_READONLY_PREVIEW = "true";
    process.env.MONITOR_PRO_LOADER_TRACE_KEY = "fixture";
    process.env.MONITOR_PRO_IDENTITY_DIAGNOSTIC_KEYS = "fixture";
    assert.equal(MONITOR_PRIVATE_DIAGNOSTICS_ENABLED, false);
    const connect = () => { throw new Error("must not connect"); };
    const pool = { connect, on: () => { throw new Error("must not install socket hooks"); } };
    installPrivatePoolTrace(pool, "fixture");
    assert.equal(pool.connect, connect);
    const emitted: unknown[] = [];
    const value = await runPrivateLoaderTrace("fixture", row => emitted.push(row), () => privateLoaderPhase("fixture", async () => 42));
    assert.equal(value, 42);
    assert.deepEqual(emitted, []);
    await withDirectoryDiagnostics(() => {}, async () => {
      assert.equal(identityProbeEnabled("identity_initial", [["fixture"]]), false);
      const sql = "SELECT $1::text";
      assert.equal(await prepareIdentityProbe({ query: async () => { throw new Error("must not query"); } }, "identity_initial", sql, [["fixture"]]), sql);
    });
  } finally { names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});
