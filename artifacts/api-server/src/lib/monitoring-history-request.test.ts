import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { createMonitoringHistoryHandler, isMonitoringHistoryTimeout } from "./monitoring-history-request";
import { authorizeMonitoringArtist } from "./monitoring-authorization";
import { monitoringIdentityKeyCandidates } from "./monitoring-candidate-policy";

test("database and between-query budget exhaustion classify as timeout without hiding other failures", () => {
  const exhausted = new Error("Monitoring history read budget exhausted");
  exhausted.name = "MonitoringHistoryBudgetError";
  for (const error of [exhausted, Object.assign(new Error("cancelled"), { code: "57014" }), new Error("Monitoring history deadline exceeded")]) {
    assert.equal(isMonitoringHistoryTimeout(error), true);
  }
  assert.equal(isMonitoringHistoryTimeout(new Error("relation does not exist")), false);
  assert.equal(isMonitoringHistoryTimeout(new Error("invalid history payload")), false);
});

async function request(viewer: string | null, options: { paid?: boolean; missing?: boolean; failure?: boolean; conflict?: boolean } = {}) {
  let reads = 0;
  let subscriptions = 0;
  let status = 200;
  let body: any;
  const headers: Record<string,string> = {};
  const res = {
    setHeader(key: string, value: string) { headers[key] = value; },
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  const handler = createMonitoringHistoryHandler({
    userId: () => viewer ?? "",
    aliases: value => [value],
    authorize: (userId, requestedArtistKey) => authorizeMonitoringArtist({
      userId, requestedArtistKey, internalUserIds: "founder",
      findActiveSubscription: async () => {
        subscriptions++;
        return options.paid ? { artist_key: "canonical", artist_name: "Artist", status: "active", created_at: null } : null;
      },
      findExistingArtist: async key => {
        if (options.paid) assert.equal(key, "canonical", "resolve the paid grant rather than the requested alias");
        return options.missing ? null : { artist_key: "canonical", artist_name: "Artist", status: "internal", created_at: null,
          match_keys: ["approved-provider-source", "requested-alias"], identity_conflict: options.conflict };
      },
    }),
    read: async input => {
      reads++;
      assert.equal(input.artistKey, "canonical");
      if (options.conflict) assert.deepEqual(input.artistKeys, ["canonical"]);
      else {
        assert.ok(input.artistKeys.includes("requested-alias"));
        assert.ok(input.artistKeys.includes("approved-provider-source"));
      }
      if (options.failure) throw new Error("statement timeout");
      return { status: "unavailable", points: [], reason: "no_observations_in_range" };
    },
    failure: () => ({ status: 504, code: "monitoring_timeout" }),
  });
  await handler({ params: { artistKey: "requested-alias", metricKey: "spotifyFollowers" }, query: {} } as unknown as Request, res, () => {});
  return { reads, subscriptions, status, body, headers };
}

test("founder history directly authorizes an incomplete artist without subscription or dashboard reads", async () => {
  const result = await request("founder");
  assert.equal(result.status, 200);
  assert.equal(result.subscriptions, 0);
  assert.equal(result.reads, 1);
  assert.equal(result.body.reason, "no_observations_in_range");
  assert.equal(result.headers["Cache-Control"], "private, no-store");
});

test("ordinary artist subscription can read history", async () => {
  const result = await request("customer", { paid: true });
  assert.equal(result.status, 200);
  assert.equal(result.reads, 1);
});

test("paid history preserves exact source isolation when the approved mapping conflicts", async () => {
  const result = await request("customer", { paid: true, conflict: true });
  assert.equal(result.status, 200);
  assert.equal(result.reads, 1);
});

test("ordinary unauthorized and signed-out viewers never query history", async () => {
  for (const viewer of ["customer", null]) {
    const result = await request(viewer);
    assert.equal(result.status, 403);
    assert.equal(result.reads, 0);
  }
});

test("founder unknown identity returns 404 rather than false missing history", async () => {
  const result = await request("founder", { missing: true });
  assert.equal(result.status, 404);
  assert.equal(result.reads, 0);
});

test("backend timeout is a terminal coded failure and never empty successful history", async () => {
  const result = await request("founder", { failure: true });
  assert.equal(result.status, 504);
  assert.equal(result.body.code, "monitoring_timeout");
  assert.equal(result.body.points, undefined);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

const allowedAccess = {
  allowed: true, source: "internal" as const, outcome: "allowed" as const, publicReadinessEvaluated: false as const,
  grant: { artist_key: "canonical", artist_name: "Artist", match_keys: ["verified-source-key"], status: "internal", created_at: null },
};

function handlerHarness(overrides: Partial<Parameters<typeof createMonitoringHistoryHandler>[0]> = {}) {
  let status = 200;
  let reads = 0;
  const bodies: unknown[] = [];
  const diagnostics: Record<string, unknown>[] = [];
  const headers: Record<string, string> = {};
  const res = {
    locals: {},
    setHeader(key: string, value: string) { headers[key] = value; },
    status(value: number) { status = value; return this; },
    json(body: unknown) { bodies.push(body); return this; },
  } as unknown as Response;
  const req = {
    headers: {}, originalUrl: "/api/monitoring/history/canonical/spotifyFollowers",
    params: { artistKey: "canonical", metricKey: "spotifyFollowers" }, query: {},
    log: { info() {}, warn() {} },
  } as unknown as Request;
  const handler = createMonitoringHistoryHandler({
    userId: () => "founder", authorize: async () => allowedAccess,
    aliases: value => [value],
    read: async () => { reads += 1; return { status: "available", points: [["2026-09-01", 100]] }; },
    failure: error => ({ status: error instanceof Error && /deadline|timeout/i.test(error.message) ? 504 : 500, code: "safe_failure" }),
    diagnostic: event => { diagnostics.push(event); },
    ...overrides,
  });
  return { req, res, handler, bodies, diagnostics, headers, status: () => status, reads: () => reads };
}

async function flushMicrotasks() {
  for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
}

test("paid history keeps exact mixed-script aliases without adding an unrelated ASCII artist", async () => {
  for (const artist of ["X東京", "阿尔法", "ベータ"]) {
    let requestedKeys: string[] | undefined;
    const harness = handlerHarness({
      userId: () => "paid-customer",
      aliases: monitoringIdentityKeyCandidates,
      authorize: (userId, requestedArtistKey) => authorizeMonitoringArtist({
        userId, requestedArtistKey, internalUserIds: "fixture-founder",
        findActiveSubscription: async () => ({ artist_key: artist, artist_name: artist, status: "active", created_at: null }),
        findExistingArtist: async () => null,
      }),
      read: async input => {
        assert.equal(input.artistKey, artist);
        requestedKeys = input.artistKeys;
        return { status: "unavailable", points: [] };
      },
    });
    harness.req.params.artistKey = artist;
    await harness.handler(harness.req, harness.res, () => {});
    assert.equal(harness.status(), 200);
    assert.deepEqual(requestedKeys, [...new Set([artist, ...monitoringIdentityKeyCandidates(artist)])]);
    assert.ok(!requestedKeys?.includes("x"));
    assert.ok(!requestedKeys?.includes(""));
  }
});

test("authorization is inside the request deadline and a late grant never starts history", async context => {
  context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100_000 });
  const authorization = deferred<typeof allowedAccess>();
  const harness = handlerHarness({ authorize: () => authorization.promise });
  const pending = harness.handler(harness.req, harness.res, () => {});
  context.mock.timers.tick(11_999);
  await flushMicrotasks();
  assert.equal(harness.bodies.length, 0);
  context.mock.timers.tick(1);
  await pending;
  assert.equal(harness.status(), 504);
  assert.equal(harness.bodies.length, 1);
  authorization.resolve(allowedAccess);
  await flushMicrotasks();
  assert.equal(harness.reads(), 0);
  assert.equal(harness.bodies.length, 1);
  assert.equal(harness.diagnostics.length, 1);
  assert.equal(harness.headers["Cache-Control"], "private, no-store");
});

test("backend receives only the remaining deadline and a late result cannot send a second response", async context => {
  context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 200_000 });
  const authorization = deferred<typeof allowedAccess>();
  const backend = deferred<unknown>();
  let input: Parameters<Parameters<typeof createMonitoringHistoryHandler>[0]["read"]>[0] | undefined;
  const harness = handlerHarness({
    authorize: () => authorization.promise,
    read: value => { input = value; return backend.promise; },
  });
  const pending = harness.handler(harness.req, harness.res, () => {});
  context.mock.timers.tick(8_000);
  authorization.resolve(allowedAccess);
  await flushMicrotasks();
  assert.equal(input?.deadlineAt, 212_000);
  assert.ok(input?.artistKeys.includes("verified-source-key"));
  context.mock.timers.tick(4_000);
  await pending;
  assert.equal(harness.status(), 504);
  assert.equal(harness.bodies.length, 1);
  backend.resolve({ privateProviderPayload: "late-result" });
  await flushMicrotasks();
  assert.equal(harness.bodies.length, 1);
  assert.equal(harness.diagnostics.length, 1);
  assert.ok(!JSON.stringify(harness.bodies).includes("late-result"));
});

test("late backend rejection remains observed after the single timeout response", async context => {
  context.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 300_000 });
  const backend = deferred<unknown>();
  const harness = handlerHarness({ read: () => backend.promise });
  const pending = harness.handler(harness.req, harness.res, () => {});
  await flushMicrotasks();
  context.mock.timers.tick(12_000);
  await pending;
  backend.reject(new Error("late provider failure"));
  await flushMicrotasks();
  assert.equal(harness.status(), 504);
  assert.equal(harness.bodies.length, 1);
  assert.equal(harness.diagnostics.length, 1);
});

test("unexpected Unknown errors never expose provider details or become invalid-request responses", async () => {
  const harness = handlerHarness({ read: async () => { throw new Error("Unknown database host private.example with credential=fake-sensitive-value"); } });
  await harness.handler(harness.req, harness.res, () => {});
  assert.equal(harness.status(), 500);
  assert.deepEqual(harness.bodies, [{ error: "History is temporarily unavailable", code: "safe_failure" }]);
  assert.doesNotMatch(JSON.stringify([...harness.bodies, ...harness.diagnostics]), /private\.example|fake-sensitive-value/);
});

test("known validation errors use fixed safe wording", async () => {
  for (const message of ["Unknown or quarantined historical metric", "Custom history range requires valid startDate and endDate"]) {
    const harness = handlerHarness({ read: async () => { throw new Error(message); } });
    await harness.handler(harness.req, harness.res, () => {});
    assert.equal(harness.status(), 400);
    assert.deepEqual(harness.bodies, [{ error: "Unsupported metric or history range", code: "invalid_history_request" }]);
  }
});

test("Clerk middleware returns 401 before history authorization while an authenticated non-entitled user receives 403", async () => {
  const { createRequireClerkUser, clerkUserId } = await import("./auth");
  for (const authenticated of [false, true]) {
    let authorizations = 0;
    const harness = handlerHarness({
      userId: clerkUserId,
      authorize: async () => {
        authorizations += 1;
        return { allowed: false, source: null, grant: null, outcome: "entitlement_denied", publicReadinessEvaluated: false };
      },
    });
    const middleware = createRequireClerkUser({
      configured: () => true,
      resolveAuth: () => ({ isAuthenticated: authenticated, userId: authenticated ? "ordinary-customer" : null }) as never,
    });
    let continuation: ReturnType<typeof harness.handler> | undefined;
    middleware(harness.req, harness.res, error => {
      assert.equal(error, undefined);
      continuation = harness.handler(harness.req, harness.res, () => {});
    });
    await continuation;
    assert.equal(harness.status(), authenticated ? 403 : 401);
    assert.equal(authorizations, authenticated ? 1 : 0);
    assert.equal(harness.reads(), 0);
    assert.equal(harness.bodies.length, 1);
    assert.equal((harness.bodies[0] as { code: string }).code, authenticated ? "monitoring_access_denied" : "sign_in_required");
  }
});
