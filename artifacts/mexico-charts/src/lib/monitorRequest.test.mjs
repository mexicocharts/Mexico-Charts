import assert from "node:assert/strict";
import test from "node:test";
import { MonitoringDashboardHttpError } from "./monitoringAccess.mjs";
import {
  canDisplayMonitorData,
  monitorRequestState,
  requestMonitorResource,
  shouldRetryMonitorRequest,
  validateMonitorDashboard,
  validateMonitorHistory,
} from "./monitorRequest.mjs";

test("the seven history states follow the real request result", () => {
  const ready = {
    isFetching: false,
    error: null,
    succeeded: true,
    observationCount: 12,
  };
  assert.equal(monitorRequestState({ ...ready, isFetching: true }), "loading");
  assert.equal(monitorRequestState(ready), "loaded");
  assert.equal(monitorRequestState({ ...ready, observationCount: 0 }), "empty");
  assert.equal(
    monitorRequestState({
      ...ready,
      error: new MonitoringDashboardHttpError(403, "Denied"),
    }),
    "authorization_failure",
  );
  assert.equal(
    monitorRequestState({ ...ready, error: new Error("Offline") }),
    "backend_failure",
  );
  assert.equal(
    monitorRequestState({
      ...ready,
      error: new MonitoringDashboardHttpError(504, "Timeout"),
    }),
    "timeout",
  );
  assert.equal(monitorRequestState({ ...ready, partial: true }), "partial");
  assert.equal(
    monitorRequestState({ ...ready, succeeded: false, observationCount: 0 }),
    "backend_failure",
  );
});

test("cached private data cannot outrank sign-out, unresolved identity, or server denial", () => {
  const input = {
    configured: true,
    isLoaded: true,
    isSignedIn: true,
    userId: "founder",
    data: { history: [] },
    error: null,
  };
  assert.equal(canDisplayMonitorData(input), true);
  for (const change of [
    { isSignedIn: false },
    { isLoaded: false },
    { userId: null },
    { configured: false },
    { error: new MonitoringDashboardHttpError(401, "Expired") },
    { error: new MonitoringDashboardHttpError(403, "Denied") },
  ]) {
    assert.equal(canDisplayMonitorData({ ...input, ...change }), false);
  }
});

test("a stalled transport reaches terminal timeout and aborts the actual request", async () => {
  let expire;
  let requestSignal;
  let cleared = false;
  const request = requestMonitorResource({
    getToken: async () => null,
    input: "/history",
    fetchAuthenticated: async (_getToken, _input, options) => {
      requestSignal = options.signal;
      return new Promise(() => {});
    },
    setTimer: (callback) => {
      expire = callback;
      return 1;
    },
    clearTimer: () => {
      cleared = true;
    },
  });
  expire();
  await assert.rejects(request, (error) => error.status === 504);
  assert.equal(requestSignal.aborted, true);
  assert.equal(cleared, true);
});

test("the deadline also bounds a response body that never finishes", async () => {
  let expire;
  const request = requestMonitorResource({
    getToken: async () => null,
    input: "/history",
    fetchAuthenticated: async () => ({
      ok: true,
      json: () => new Promise(() => {}),
    }),
    setTimer: (callback) => {
      expire = callback;
      return 1;
    },
    clearTimer: () => {},
  });
  await Promise.resolve();
  expire();
  await assert.rejects(request, (error) => error.status === 504);
});

test("switching artist or identity cancels the request without converting it to empty history", async () => {
  const controller = new AbortController();
  let requestSignal;
  const request = requestMonitorResource({
    getToken: async () => null,
    input: "/history",
    signal: controller.signal,
    fetchAuthenticated: async (_getToken, _input, options) => {
      requestSignal = options.signal;
      return new Promise(() => {});
    },
  });
  controller.abort();
  await assert.rejects(request, (error) => error.name === "AbortError");
  assert.equal(requestSignal.aborted, true);
});

test("already-cancelled queries do not send an authenticated request", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    requestMonitorResource({
      getToken: async () => null,
      input: "/history",
      signal: controller.signal,
      fetchAuthenticated: async () => {
        calls++;
      },
    }),
    (error) => error.name === "AbortError",
  );
  assert.equal(calls, 0);
});

test("only an explicit successful empty dataset is accepted as no history", async () => {
  const empty = { status: "unavailable", points: [] };
  assert.deepEqual(validateMonitorHistory(empty), empty);
  for (const bad of [
    null,
    {},
    { status: "available" },
    { status: "available", points: [["bad", 123]] },
    { status: "available", points: [["2026-09-01", null]] },
  ]) {
    assert.throws(
      () => validateMonitorHistory(bad),
      (error) => error.status === 502,
    );
  }
  assert.throws(
    () => validateMonitorDashboard({ history: [] }),
    (error) => error.status === 502,
  );
  const result = await requestMonitorResource({
    getToken: async () => null,
    input: "/history",
    fetchAuthenticated: async () => new Response(JSON.stringify(empty)),
    readResponse: async (response) =>
      validateMonitorHistory(await response.json()),
  });
  assert.deepEqual(result, empty);
});

test("HTTP auth, API, and timeout failures retain their status and do not loop", async () => {
  for (const status of [401, 403, 404, 500, 503, 504]) {
    await assert.rejects(
      requestMonitorResource({
        getToken: async () => null,
        input: "/history",
        fetchAuthenticated: async () =>
          new Response(JSON.stringify({ error: "Request failed" }), { status }),
      }),
      (error) =>
        error.status === status && !shouldRetryMonitorRequest(0, error),
    );
  }
  assert.equal(
    shouldRetryMonitorRequest(0, new DOMException("Cancelled", "AbortError")),
    false,
  );
  assert.equal(shouldRetryMonitorRequest(0, new Error("Offline")), true);
  assert.equal(shouldRetryMonitorRequest(1, new Error("Offline")), false);
});

test("history availability and calendar dates must agree with the actual observations", () => {
  const leapDay = { status: "available", points: [["2024-02-29", 0]] };
  assert.deepEqual(validateMonitorHistory(leapDay), leapDay);
  for (const payload of [
    { status: "available", points: [] },
    { status: "unavailable", points: [["2026-09-01", 123]] },
    { status: "available", points: [["2026-02-31", 123]] },
    { status: "available", points: [["2026-02-29", 123]] },
    { status: "available", points: [["2026-04-31", 123]] },
  ]) {
    assert.throws(
      () => validateMonitorHistory(payload),
      (error) => error.status === 502,
    );
  }
});
