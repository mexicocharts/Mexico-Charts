import assert from "node:assert/strict";
import test from "node:test";

process.env["NEON_DATABASE_URL"] ??= "postgresql://local-test.invalid/mexico_charts";

const {
  ACCOUNT_WRITE_STATEMENT_TIMEOUT_MS,
  requestDatabaseHttpStatus,
  runBoundedAccountUpsert,
  safeDatabaseDiagnostic,
} = await import("./request-database");

test("account upsert remains write-capable and uses a transaction-local statement timeout", async () => {
  const statements: string[] = [];
  let released = false;
  const client = {
    async query(query: string | { text: string }) {
      statements.push(typeof query === "string" ? query : query.text);
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };

  await runBoundedAccountUpsert("user_founder", async () => client as never);

  assert.deepEqual(statements.map(statement => statement.trim().split(/\s+/)[0]), [
    "BEGIN",
    "SET",
    "INSERT",
    "COMMIT",
  ]);
  assert.match(statements[1] ?? "", new RegExp(String(ACCOUNT_WRITE_STATEMENT_TIMEOUT_MS)));
  assert.match(statements[2] ?? "", /INSERT INTO user_accounts/);
  assert.equal(released, true);
});

test("a saturated or unavailable pool maps to a bounded 503", async () => {
  const timeout = Object.assign(new Error("timeout exceeded when trying to connect"), {
    code: "ETIMEDOUT",
  });
  const startedAt = performance.now();

  await assert.rejects(
    runBoundedAccountUpsert("user_founder", async () => { throw timeout; }),
    timeout,
  );

  assert.equal(requestDatabaseHttpStatus(timeout), 503);
  assert.ok(performance.now() - startedAt < 250);
});

test("database diagnostics never include connection values or raw messages", () => {
  const error = Object.assign(
    new Error("timeout for postgresql://user:password@private.example/db"),
    { code: "57014" },
  );
  const diagnostic = safeDatabaseDiagnostic(error);
  const serialized = JSON.stringify(diagnostic);

  assert.equal(diagnostic.unavailable, true);
  assert.equal(diagnostic.errorCode, "57014");
  assert.doesNotMatch(serialized, /password|private\.example|postgresql:\/\//);
});
