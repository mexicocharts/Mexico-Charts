import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env["NEON_DATABASE_URL"] ??= "postgresql://local-test.invalid/mexico_charts";

const { ACCOUNT_SCHEMA_DDL, runAccountSchemaBootstrap } = await import("./account-schema");

test("account schema initialization runs as a separate bootstrap operation", async () => {
  const statements: string[] = [];
  await runAccountSchemaBootstrap({
    async query(sql) {
      statements.push(sql);
      return { rows: [] };
    },
  });

  assert.equal(statements.length, 1);
  assert.equal(statements[0], ACCOUNT_SCHEMA_DDL);
  assert.match(ACCOUNT_SCHEMA_DDL, /CREATE TABLE IF NOT EXISTS user_accounts/);
  assert.match(ACCOUNT_SCHEMA_DDL, /ALTER TABLE fan_profiles/);
});

test("account HTTP routes contain no request-time schema DDL", async () => {
  const routeSource = await readFile(new URL("../routes/account.ts", import.meta.url), "utf8");
  assert.doesNotMatch(routeSource, /CREATE\s+TABLE|ALTER\s+TABLE/i);
  assert.doesNotMatch(routeSource, /ensureAccountTables/);
});

test("server opens the health-check port before database schema initialization", async () => {
  const startupSource = await readFile(new URL("../index.ts", import.meta.url), "utf8");
  const listenIndex = startupSource.indexOf("app.listen(");
  const scheduleIndex = startupSource.indexOf(".finally(scheduleRuntimeInitialization)", listenIndex);
  const initializeIndex = startupSource.indexOf("await initializeAccountSchema()");
  assert.ok(initializeIndex >= 0);
  assert.ok(listenIndex >= 0);
  assert.ok(scheduleIndex > listenIndex);
  assert.ok(startupSource.indexOf('monitoringReadPool.query("SELECT 1")', listenIndex) < scheduleIndex);
  assert.match(startupSource, /startup_schema_retry_scheduled/);
});

test("account reads fail closed while schema initialization is pending", async () => {
  const routeSource = await readFile(new URL("../routes/account.ts", import.meta.url), "utf8");
  assert.match(routeSource, /if \(!isAccountSchemaReady\(\)\)/);
  assert.match(routeSource, /status\(503\).*Account service is starting/s);
});
