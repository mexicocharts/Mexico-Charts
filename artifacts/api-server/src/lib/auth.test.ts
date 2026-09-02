import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { createRequireClerkUser, safeClerkIdentityHash } from "./auth";

function invokeRequireClerkUser({
  authorization,
  cookie,
  authenticated,
}: {
  authorization?: string;
  cookie?: string;
  authenticated: boolean;
}) {
  const logs: Array<Record<string, unknown>> = [];
  let statusCode = 200;
  let payload: unknown;
  let nextCalls = 0;
  const request = {
    headers: { authorization, cookie },
    originalUrl: "/api/account/me?private=value",
    url: "/account/me?private=value",
    log: {
      info(fields: Record<string, unknown>) {
        logs.push(fields);
      },
      warn(fields: Record<string, unknown>) {
        logs.push(fields);
      },
    },
  } as unknown as Request;
  const response = {
    locals: {
      clerkAuthMiddlewareReached: true,
      clerkAuthMiddlewareStartedAt: 10,
    },
    status(value: number) {
      statusCode = value;
      return this;
    },
    json(value: unknown) {
      payload = value;
      return this;
    },
  } as unknown as Response;
  const handler = createRequireClerkUser({
    configured: () => true,
    now: () => 12.5,
    resolveAuth: () =>
      ({
        isAuthenticated: authenticated,
        userId: authenticated ? "user_founder_secret_id" : null,
      }) as never,
  });
  handler(request, response, () => {
    nextCalls += 1;
  });
  return { logs, nextCalls, payload, response, statusCode };
}

test("authenticated Clerk identity remains server-authoritative", () => {
  const result = invokeRequireClerkUser({
    authenticated: true,
    authorization: "Bearer raw-secret-token",
    cookie: "__session=raw-secret-cookie",
  });

  assert.equal(result.nextCalls, 1);
  assert.equal(result.response.locals["clerkUserId"], "user_founder_secret_id");
  assert.equal(result.logs[0]?.["clerkIdentityResolved"], true);
  assert.equal(result.logs[0]?.["authSource"], "bearer");
  assert.equal(
    result.logs[0]?.["identityHash"],
    safeClerkIdentityHash("user_founder_secret_id"),
  );
  assert.equal(result.logs[0]?.["requestPath"], "/api/account/me");
});

test("unauthenticated Clerk request remains denied with 401", () => {
  const result = invokeRequireClerkUser({
    authenticated: false,
    cookie: "__session=invalid",
  });

  assert.equal(result.nextCalls, 0);
  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.payload, {
    error: "Sign in required",
    code: "sign_in_required",
  });
  assert.equal(result.logs[0]?.["clerkIdentityResolved"], false);
  assert.equal(result.logs[0]?.["authSource"], "cookie");
});

test("server auth diagnostics contain no raw credentials or Clerk IDs", () => {
  const result = invokeRequireClerkUser({
    authenticated: true,
    authorization: "Bearer raw-secret-token",
    cookie: "__session=raw-secret-cookie",
  });
  const serialized = JSON.stringify(result.logs);

  assert.equal(serialized.includes("raw-secret-token"), false);
  assert.equal(serialized.includes("raw-secret-cookie"), false);
  assert.equal(serialized.includes("user_founder_secret_id"), false);
  assert.equal(serialized.includes("private=value"), false);
});
