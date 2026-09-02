import assert from "node:assert/strict";
import test from "node:test";

process.env["NEON_DATABASE_URL"] ??= "postgresql://local-test.invalid/mexico_charts";

const { executeMonitoringReadinessQuery } = await import("./monitoring-readiness-service");
const { requestDatabaseHttpStatus } = await import("./request-database");

test("monitoring readiness acquisition timeout fails promptly and maps to 503", async () => {
  const timeout = Object.assign(new Error("timeout exceeded when trying to connect"), {
    code: "ETIMEDOUT",
  });
  const diagnostics: Array<{ stage: string; outcome: string; durationMs: number }> = [];
  const startedAt = performance.now();

  await assert.rejects(
    executeMonitoringReadinessQuery(
      { connect: async () => { throw timeout; } } as never,
      "SELECT 1",
      [],
      diagnostic => diagnostics.push(diagnostic),
    ),
    timeout,
  );

  assert.equal(requestDatabaseHttpStatus(timeout), 503);
  assert.ok(performance.now() - startedAt < 250);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.stage, "db_acquisition");
  assert.equal(diagnostics[0]?.outcome, "timeout_or_unavailable");
  assert.ok((diagnostics[0]?.durationMs ?? -1) >= 0);
});

test("monitoring readiness statement timeout releases the read client", async () => {
  const timeout = Object.assign(new Error("canceling statement due to statement timeout"), {
    code: "57014",
  });
  let released = false;
  const diagnostics: Array<{ stage: string; outcome: string; durationMs: number }> = [];
  const client = {
    async query() {
      throw timeout;
    },
    release() {
      released = true;
    },
  };

  await assert.rejects(
    executeMonitoringReadinessQuery(
      { connect: async () => client } as never,
      "SELECT 1",
      [],
      diagnostic => diagnostics.push(diagnostic),
    ),
    timeout,
  );

  assert.equal(requestDatabaseHttpStatus(timeout), 503);
  assert.equal(released, true);
  assert.equal(diagnostics.at(-1)?.stage, "readiness_query");
  assert.equal(diagnostics.at(-1)?.outcome, "timeout_or_unavailable");
});
