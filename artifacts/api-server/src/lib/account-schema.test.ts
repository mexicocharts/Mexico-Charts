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

test("server startup initializes account schema before listening", async () => {
  const startupSource = await readFile(new URL("../index.ts", import.meta.url), "utf8");
  const initializeIndex = startupSource.indexOf("await initializeAccountSchema()");
  const listenIndex = startupSource.indexOf("app.listen(");
  assert.ok(initializeIndex >= 0);
  assert.ok(listenIndex > initializeIndex);
});
