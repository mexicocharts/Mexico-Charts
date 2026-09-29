import test from "node:test";
import assert from "node:assert/strict";
import { withDirectoryDiagnostics } from "./monitoring-directory-diagnostics";
import { identityProbeEnabled, prepareIdentityProbe, summarizeIdentityPlan } from "./monitoring-private-identity-probe";

test("private probe is disabled even with old preview opt-in and keeps SQL unchanged", async () => {
  const oldPreview = process.env.MONITOR_PRO_READONLY_PREVIEW;
  const oldKeys = process.env.MONITOR_PRO_IDENTITY_DIAGNOSTIC_KEYS;
  try {
    process.env.MONITOR_PRO_IDENTITY_DIAGNOSTIC_KEYS = "fixture-secret,control,third,fourth";
    delete process.env.MONITOR_PRO_READONLY_PREVIEW;
    const records: any[] = []; const calls: any[] = [];
    const values = [["fixture-secret", "sensitive-alias"]]; const sql = "SELECT sensitive_column FROM safe_relation WHERE key=ANY($1)";
    const client = { query: async (q: any) => { calls.push(q); return typeof q === "string"
      ? { rows:[{pid:42,statement_timeout:"10s",read_only:"on"}] }
      : { rows:[{"QUERY PLAN":[{Plan:{"Node Type":"Index Scan","Relation Name":"safe_relation","Index Cond":"sensitive-alias","Plan Rows":2}}]}] }; } };
    await withDirectoryDiagnostics(r => records.push(r), async () => {
      assert.equal(await prepareIdentityProbe(client,"identity_initial",sql,values),sql);
      assert.equal(calls.length,0);
      process.env.MONITOR_PRO_READONLY_PREVIEW = "true";
      assert.equal(identityProbeEnabled("page_evidence",values),false);
      assert.equal(identityProbeEnabled("identity_initial",[["fourth"]]),false);
      const tagged = await prepareIdentityProbe(client,"identity_initial",sql,values);
      assert.equal(tagged,sql);
      await prepareIdentityProbe(client,"identity_initial",sql,values);
      assert.equal(calls.length,0,"no metadata or EXPLAIN queries");
    });
    assert.doesNotMatch(JSON.stringify(records),/fixture-secret|sensitive-alias|sensitive_column|Index Cond/);
    assert.equal(records.some(r=>r.phase==="bound_query"),false);
    assert.equal(identityProbeEnabled("identity_initial",values),false,"no request context");
    assert.doesNotMatch(JSON.stringify(summarizeIdentityPlan({Plan:{"Node Type":"Seq Scan",Filter:"private"}})),/private/);
  } finally {
    if(oldPreview===undefined) delete process.env.MONITOR_PRO_READONLY_PREVIEW; else process.env.MONITOR_PRO_READONLY_PREVIEW=oldPreview;
    if(oldKeys===undefined) delete process.env.MONITOR_PRO_IDENTITY_DIAGNOSTIC_KEYS; else process.env.MONITOR_PRO_IDENTITY_DIAGNOSTIC_KEYS=oldKeys;
  }
});
