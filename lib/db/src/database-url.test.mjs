import assert from "node:assert/strict";
import test from "node:test";
import { databaseUrlConfiguration, getDatabaseUrl, resolveDatabaseUrl } from "./database-url.mjs";

test("reports conflicting configured targets without returning either URL", () => {
  const env = {
    NEON_DATABASE_URL: "postgresql://neon-secret.example/db",
    DATABASE_URL: "postgresql://legacy-secret.example/db",
  };

  const configuration = databaseUrlConfiguration(env);
  assert.deepEqual(configuration, {
    selectedName: "NEON_DATABASE_URL",
    neonConfigured: true,
    databaseConfigured: true,
    configuredValuesMatch: false,
    conflictingTargets: true,
  });
  assert.doesNotMatch(JSON.stringify(configuration), /postgresql|secret\.example/);
});

test("reports aligned and fallback-only database configuration", () => {
  const shared = "postgresql://same.example/db";
  assert.deepEqual(databaseUrlConfiguration({ NEON_DATABASE_URL: shared, DATABASE_URL: shared }), {
    selectedName: "NEON_DATABASE_URL",
    neonConfigured: true,
    databaseConfigured: true,
    configuredValuesMatch: true,
    conflictingTargets: false,
  });
  assert.deepEqual(databaseUrlConfiguration({ DATABASE_URL: shared }), {
    selectedName: "DATABASE_URL",
    neonConfigured: false,
    databaseConfigured: true,
    configuredValuesMatch: null,
    conflictingTargets: false,
  });
});

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
