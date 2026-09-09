import assert from "node:assert/strict";
import test from "node:test";
import { directoryDiagnostic, directoryRequestId, withDirectoryDiagnostics, type DirectoryStage } from "./monitoring-directory-diagnostics";
process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
const { executeMonitoringReadinessQuery } = await import("./monitoring-readiness-service");
const stages: DirectoryStage[] = ["schema_inventory", "candidate_population", "accepted_aliases", "discovery_candidates", "page_evidence"];
for (const stage of stages) {
  for (const phase of ["db_acquisition", "query"] as const) {
    test(`${stage}: exposes ${phase} failure without changing error or leaking payload`, async () => {
      const records: any[] = []; let released = 0;
      const original = new Error("Query read timeout SQL secret@example.org token=private");
      const pool = { connect: async () => { if (phase === "db_acquisition") throw original; return { query: async () => { throw original; }, release: () => { released++; } }; } };
      await assert.rejects(withDirectoryDiagnostics(r => records.push(r), () => executeMonitoringReadinessQuery(pool as never, "sensitive SQL", ["private payload"], undefined, stage)), e => e === original);
      const failure = records.find(r => r.stage === stage && r.outcome === "error");
      assert.equal(failure.phase, phase);
      assert.equal(failure.errorMessage, "query_read_timeout");
      assert.ok(failure.elapsedMs >= 0);
      assert.match(failure.requestId, /^[a-f0-9-]{36}$/);
      assert.equal(records.at(-1).stage, "directory");
      assert.equal(released, phase === "query" ? 1 : 0);
      assert.doesNotMatch(JSON.stringify(records), /secret|private|sensitive|example/);
    });
  }
}
test("success preserves returned rows and emits nothing outside directory scope", async () => {
  let released = 0; const rows = [{ safe: 1 }];
  const pool = { connect: async () => ({ query: async () => ({ rows }), release: () => { released++; } }) };
  const records: any[] = [];
  assert.equal(await withDirectoryDiagnostics(r => records.push(r), () => executeMonitoringReadinessQuery(pool as never, "SELECT", [], undefined, "page_evidence")), rows);
  assert.deepEqual(records.map(r => r.phase), ["db_acquisition", "query", "total"]);
  assert.equal(directoryRequestId(), null);
  directoryDiagnostic("directory", "total", performance.now(), "ok");
  assert.equal(records.length, 3); assert.equal(released, 1);
});
test("shared pending work keeps its owner correlation; waiting request has its own id", async () => {
  const records: any[] = []; let finish!: () => void; let pending!: Promise<void>; let owner!: string;
  const first = withDirectoryDiagnostics(r => records.push(r), async id => { owner = id; pending = new Promise<void>(r => { finish = r; }); await pending; directoryDiagnostic("candidate_population", "query", performance.now(), "ok"); });
  const second = withDirectoryDiagnostics(r => records.push(r), async id => { assert.notEqual(id, owner); directoryDiagnostic("candidate_population", "shared_pending", performance.now(), "wait", undefined, owner); await pending; });
  finish(); await Promise.all([first, second]);
  assert.equal(records.find(r => r.phase === "query").requestId, owner);
  const wait = records.find(r => r.phase === "shared_pending"); assert.equal(wait.ownerRequestId, owner); assert.notEqual(wait.requestId, owner);
});
test("unknown error messages and custom classes are not logged; broken sink cannot affect serving", async () => {
  const records: any[] = []; const error = new Error("credential postgres://private/password"); error.name = "private name";
  await assert.rejects(withDirectoryDiagnostics(r => records.push(r), async () => { throw error; }), e => e === error);
  assert.equal(records[0].errorMessage, "unclassified_error"); assert.equal(records[0].errorClass, "Error");
  assert.doesNotMatch(JSON.stringify(records), /password|postgres|credential|private/);
  assert.equal(await withDirectoryDiagnostics(() => { throw Error("sink"); }, async () => 42), 42);
});
const { getMonitoringCandidateDirectory, MONITORING_ACCEPTED_ALIAS_SQL, MONITORING_DISCOVERY_CANDIDATES_SQL, MONITORING_CANDIDATE_POPULATION_SQL } = await import("./monitoring-candidate-audit");
const { MONITORING_AUDIT_SOURCE_TABLES } = await import("./monitoring-audit-schema");
for (const failingStage of stages) {
  test(`real directory loader wires ${failingStage} and preserves failure`, async () => {
    const records: any[] = []; const failure = new Error("Query read timeout"); let acquired = 0; let released = 0;
    const pool = { connect: async () => { acquired++; return { release: () => { released++; }, query: async ({ text }: { text: string }) => {
      const stage = text.includes("to_regclass") ? "schema_inventory" : text === MONITORING_CANDIDATE_POPULATION_SQL ? "candidate_population" : text === MONITORING_ACCEPTED_ALIAS_SQL ? "accepted_aliases" : text === MONITORING_DISCOVERY_CANDIDATES_SQL ? "discovery_candidates" : "page_evidence";
      if (stage === failingStage) throw failure;
      return { rows: stage === "schema_inventory" ? MONITORING_AUDIT_SOURCE_TABLES.map(table_name => ({ table_name, present: true })) : [] };
    } }; } };
    await assert.rejects(withDirectoryDiagnostics(r => records.push(r), () => getMonitoringCandidateDirectory({ limit: 1 }, { readPool: pool as never, now: new Date("2026-09-09") })), e => e === failure);
    assert.ok(records.some(r => r.stage === failingStage && r.phase === "query" && r.outcome === "error"));
    assert.equal(acquired, released);
  });
}
