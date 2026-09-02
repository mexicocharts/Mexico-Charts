import assert from "node:assert/strict";
import test from "node:test";
import { createAuthenticatedFetch } from "./authenticatedFetch.mjs";

const PAGE_URL = "https://mexicochart.com/monitoreo/luis-miguel";

function testHelper(fetchImpl, options = {}) {
  const events = [];
  return {
    events,
    fetch: createAuthenticatedFetch({
      fetchImpl,
      locationHref: () => PAGE_URL,
      logger: (event) => events.push(event),
      tokenTimeoutMs: 10,
      ...options,
    }),
  };
}

test("available bearer token authenticates the request", async () => {
  const calls = [];
  const helper = testHelper(async (_input, init) => {
    calls.push(init);
    return new Response("ok", { status: 200 });
  });

  const response = await helper.fetch(
    async () => "valid-token",
    "/api/account/me",
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(
    new Headers(calls[0].headers).get("authorization"),
    "Bearer valid-token",
  );
  assert.equal(calls[0].credentials, "include");
  assert.deepEqual(helper.events[0], {
    event: "clerk_auth_transport",
    tokenAcquisitionOutcome: "success",
    authTransport: "bearer",
    sameOrigin: true,
    requestPath: "/api/account/me",
  });
});

test("Safari-style getToken timeout uses one same-origin cookie request", async () => {
  const calls = [];
  const helper = testHelper(async (_input, init) => {
    calls.push(init);
    return new Response("denied", { status: 401 });
  });

  const response = await helper.fetch(
    async () => new Promise(() => undefined),
    "/api/monitoring/dashboard/luis-miguel",
  );

  assert.equal(response.status, 401);
  assert.equal(
    calls.length,
    1,
    "timeout fallback must not create a retry loop",
  );
  assert.equal(calls[0].credentials, "include");
  assert.equal(new Headers(calls[0].headers).has("authorization"), false);
  assert.equal(helper.events[0].tokenAcquisitionOutcome, "timeout");
  assert.equal(helper.events[0].authTransport, "cookie_fallback");
});

test("unavailable token uses the valid same-origin cookie session", async () => {
  const calls = [];
  const helper = testHelper(async (_input, init) => {
    calls.push(init);
    const cookieWasIncluded = init.credentials === "include";
    const bearerWasOmitted = !new Headers(init.headers).has("authorization");
    return new Response("ok", {
      status: cookieWasIncluded && bearerWasOmitted ? 200 : 401,
    });
  });

  const response = await helper.fetch(async () => null, "/api/account/me");

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(helper.events[0].tokenAcquisitionOutcome, "unavailable");
  assert.equal(helper.events[0].authTransport, "cookie_fallback");
});

test("stale bearer 401 is retried once without Authorization and with cookies", async () => {
  const calls = [];
  const helper = testHelper(async (_input, init) => {
    calls.push(init);
    return new Response(calls.length === 1 ? "stale" : "ok", {
      status: calls.length === 1 ? 401 : 200,
    });
  });

  const response = await helper.fetch(
    async () => "stale-token",
    "/api/account/me",
    {
      headers: { Authorization: "Bearer caller-stale-token" },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(
    new Headers(calls[0].headers).get("authorization"),
    "Bearer stale-token",
  );
  assert.equal(new Headers(calls[1].headers).has("authorization"), false);
  assert.equal(calls[1].credentials, "include");
  assert.equal(helper.events[1].authTransport, "cookie_fallback");
  assert.equal(helper.events[1].fallbackReason, "bearer_rejected");
});

test("unauthenticated cookie fallback preserves the terminal 401", async () => {
  let calls = 0;
  const helper = testHelper(async () => {
    calls += 1;
    return new Response("denied", { status: 401 });
  });

  const response = await helper.fetch(async () => null, "/api/account/me");

  assert.equal(response.status, 401);
  assert.equal(calls, 1);
});

test("diagnostics never contain raw bearer values", async () => {
  const helper = testHelper(async () => new Response("ok", { status: 200 }));
  await helper.fetch(
    async () => "super-secret-token",
    "/api/account/me?private=value",
  );

  const serialized = JSON.stringify(helper.events);
  assert.equal(serialized.includes("super-secret-token"), false);
  assert.equal(serialized.includes("private=value"), false);
});
