import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseUrl, resolveDatabaseUrl } from "./database-url.mjs";

test("NEON_DATABASE_URL takes precedence over DATABASE_URL", () => {
  const env = {
    NEON_DATABASE_URL: "postgresql://neon-secret.example/db",
    DATABASE_URL: "postgresql://legacy-secret.example/db",
  };

  assert.equal(resolveDatabaseUrl(env), env.NEON_DATABASE_URL);
});

test("DATABASE_URL remains a supported fallback", () => {
  const env = { DATABASE_URL: "postgresql://legacy-secret.example/db" };

  assert.equal(resolveDatabaseUrl(env), env.DATABASE_URL);
});

test("optional lookup returns undefined when neither variable exists", () => {
  assert.equal(getDatabaseUrl({}), undefined);
});

test("configured URL values are returned without being logged", () => {
  const secretUrl = "postgresql://user:private-password@neon.example/db";
  const emitted = [];
  const originals = {
    error: console.error,
    log: console.log,
    warn: console.warn,
  };
  console.error = (...args) => emitted.push(args);
  console.log = (...args) => emitted.push(args);
  console.warn = (...args) => emitted.push(args);

  try {
    assert.equal(resolveDatabaseUrl({ NEON_DATABASE_URL: secretUrl }), secretUrl);
    assert.deepEqual(emitted, []);
    assert.doesNotMatch(JSON.stringify(emitted), /private-password/);
  } finally {
    console.error = originals.error;
    console.log = originals.log;
    console.warn = originals.warn;
  }
});

test("missing configuration fails without logging or exposing URL values", () => {
  const emitted = [];
  const originals = {
    error: console.error,
    log: console.log,
    warn: console.warn,
  };
  console.error = (...args) => emitted.push(args);
  console.log = (...args) => emitted.push(args);
  console.warn = (...args) => emitted.push(args);

  try {
    assert.throws(
      () => resolveDatabaseUrl({}),
      error => {
        assert.match(error.message, /NEON_DATABASE_URL or DATABASE_URL/);
        assert.doesNotMatch(error.message, /postgres(?:ql)?:\/\//);
        return true;
      },
    );
    assert.deepEqual(emitted, []);
  } finally {
    console.error = originals.error;
    console.log = originals.log;
    console.warn = originals.warn;
  }
});
