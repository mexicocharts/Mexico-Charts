import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POOL_CONNECTION_TIMEOUT_MS,
  PUBLIC_READ_CONNECTION_TIMEOUT_MS,
  PUBLIC_READ_QUERY_TIMEOUT_MS,
  PUBLIC_READ_STATEMENT_TIMEOUT_MS,
  SCHEMA_BOOTSTRAP_CONNECTION_TIMEOUT_MS,
  SCHEMA_BOOTSTRAP_QUERY_TIMEOUT_MS,
  SCHEMA_BOOTSTRAP_STATEMENT_TIMEOUT_MS,
  defaultPoolOptions,
  publicReadPoolOptions,
  schemaBootstrapPoolOptions,
} from "./pool-config";

test("application and request-facing pools have finite acquisition deadlines", () => {
  assert.equal(defaultPoolOptions.connectionTimeoutMillis, DEFAULT_POOL_CONNECTION_TIMEOUT_MS);
  assert.equal(publicReadPoolOptions.connectionTimeoutMillis, PUBLIC_READ_CONNECTION_TIMEOUT_MS);
  assert.equal(schemaBootstrapPoolOptions.connectionTimeoutMillis, SCHEMA_BOOTSTRAP_CONNECTION_TIMEOUT_MS);
  assert.ok(DEFAULT_POOL_CONNECTION_TIMEOUT_MS > 0);
  assert.ok(PUBLIC_READ_CONNECTION_TIMEOUT_MS > 0);
});

test("public reads and schema bootstrap have bounded statement and query execution", () => {
  assert.equal(publicReadPoolOptions.statement_timeout, PUBLIC_READ_STATEMENT_TIMEOUT_MS);
  assert.equal(publicReadPoolOptions.query_timeout, PUBLIC_READ_QUERY_TIMEOUT_MS);
  assert.equal(schemaBootstrapPoolOptions.statement_timeout, SCHEMA_BOOTSTRAP_STATEMENT_TIMEOUT_MS);
  assert.equal(schemaBootstrapPoolOptions.query_timeout, SCHEMA_BOOTSTRAP_QUERY_TIMEOUT_MS);
  assert.ok(PUBLIC_READ_QUERY_TIMEOUT_MS >= PUBLIC_READ_STATEMENT_TIMEOUT_MS);
  assert.ok(SCHEMA_BOOTSTRAP_QUERY_TIMEOUT_MS >= SCHEMA_BOOTSTRAP_STATEMENT_TIMEOUT_MS);
});
