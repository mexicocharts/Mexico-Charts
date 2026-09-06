import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { MonitoringDashboardHttpError } from "./monitoringAccess.mjs";
import {
  canDisplayMonitorData,
  monitorHistoryRequest,
  monitorHistoryWindowData,
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

const dailyWindow = (points, overrides = {}) => ({
  status: points.length ? "available" : "unavailable",
  points,
  requestedRange: {
    preset: "7d",
    startDate: "2026-08-30",
    endDate: "2026-09-06",
  },
  resolution: {
    returned: "daily",
    exactSourcePoints: points.length,
    returnedDisplayPoints: points.length,
  },
  rangeCoverage: {
    observationCount: points.length,
    missingDateCount: 8 - points.length,
  },
  ...overrides,
});

test("bounded history requests use exact daily data and scope caches to window and identity", () => {
  const input = {
    userId: "founder",
    artistKey: "artist / one",
    metricKey: "spotifyMonthlyListeners",
  };
  const all = monitorHistoryRequest(input);
  assert.match(
    all.input,
    /artist%20%2F%20one\/spotifyMonthlyListeners\?range=all&resolution=auto$/,
  );
  for (const range of ["7d", "30d", "90d", "6m", "1y"]) {
    const selected = monitorHistoryRequest({ ...input, range });
    assert.ok(selected.input.endsWith(`range=${range}&resolution=daily`));
    assert.notDeepEqual(selected.queryKey, all.queryKey);
    for (const change of [
      { userId: "subscriber" },
      { artistKey: "other" },
      { metricKey: "tiktokFollowers" },
    ]) {
      assert.notDeepEqual(
        selected.queryKey,
        monitorHistoryRequest({ ...input, range, ...change }).queryKey,
      );
    }
  }
});

test("old all-history gaps cannot label a complete recent exact window partial", () => {
  const points = Array.from({ length: 8 }, (_, index) => {
    const date = new Date("2026-08-30T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + index);
    return [date.toISOString().slice(0, 10), index];
  });
  const allResponse = {
    status: "available",
    points: [
      ["2016-01-01", 1],
      ["2026-09-06", 7],
    ],
    resolution: { returned: "minmax" },
    rangeCoverage: { observationCount: 5000, missingDateCount: 300 },
  };
  const selectedResponse = validateMonitorHistory(dailyWindow(points), "7d");
  const result = monitorHistoryWindowData({
    range: "7d",
    allResponse,
    selectedResponse,
  });
  assert.equal(result.missingDateCount, 0);
  assert.equal(result.partial, false);
  assert.deepEqual(
    result.points.map((point) => point.date),
    points.map((point) => point[0]),
  );
  assert.equal(
    monitorHistoryWindowData({ range: "all", allResponse }).missingDateCount,
    300,
  );
});

test("a narrow one-point window is partial and an empty exact window cannot inherit old samples", () => {
  const allResponse = {
    status: "available",
    points: [
      ["2016-01-01", 10],
      ["2026-09-06", 20],
    ],
  };
  const input = {
    range: "7d",
    allResponse,
    allPoints: [{ date: "2026-09-05", value: 15 }],
  };
  const single = monitorHistoryWindowData({
    ...input,
    selectedResponse: dailyWindow([["2026-09-06", 20]]),
  });
  assert.equal(single.points.length, 1);
  assert.equal(
    monitorRequestState({
      isFetching: false,
      succeeded: true,
      observationCount: single.points.length,
      partial: single.partial,
    }),
    "partial",
  );
  const empty = monitorHistoryWindowData({
    ...input,
    selectedResponse: validateMonitorHistory(dailyWindow([]), "7d"),
  });
  assert.deepEqual(empty.points, []);
  assert.equal(
    monitorRequestState({
      isFetching: false,
      succeeded: true,
      observationCount: empty.points.length,
      partial: empty.partial,
    }),
    "empty",
  );
  assert.deepEqual(
    monitorHistoryWindowData(input).points,
    [],
    "pending selected requests do not reuse lossy samples",
  );
});

test("selected responses must match the requested range, exact dates, and coverage", () => {
  const valid = dailyWindow([["2026-09-06", 20]]);
  assert.deepEqual(validateMonitorHistory(valid, "7d"), valid);
  for (const wrong of [
    { requestedRange: { ...valid.requestedRange, preset: "all" } },
    {
      requestedRange: { ...valid.requestedRange, startDate: "2026-08-29" },
      rangeCoverage: { observationCount: 1, missingDateCount: 8 },
    },
    { requestedRange: { ...valid.requestedRange, startDate: "2026-02-31" } },
    { resolution: { ...valid.resolution, returned: "minmax" } },
    { points: [["2026-09-07", 20]] },
    { rangeCoverage: { observationCount: 1, missingDateCount: 300 } },
    {
      points: [
        ["2026-09-06", 20],
        ["2026-09-06", 21],
      ],
      rangeCoverage: { observationCount: 2, missingDateCount: 6 },
    },
  ])
    assert.throws(
      () => validateMonitorHistory({ ...valid, ...wrong }, "7d"),
      (error) => error.status === 502,
    );
});

test("React Query window and identity switches cancel old requests and exclude their late data", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const pending = [];
  const options = (userId, range) => {
    const request = monitorHistoryRequest({
      userId,
      artistKey: "artist",
      metricKey: "spotifyMonthlyListeners",
      range,
    });
    return {
      queryKey: request.queryKey,
      queryFn: ({ signal }) =>
        requestMonitorResource({
          getToken: async () => userId,
          input: request.input,
          signal,
          fetchAuthenticated: async (_getToken, input, init) =>
            new Promise((resolve) =>
              pending.push({ input, signal: init.signal, resolve }),
            ),
        }),
    };
  };
  const observer = new QueryObserver(client, options("founder", "7d"));
  const unsubscribe = observer.subscribe(() => {});
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  try {
    await flush();
    observer.setOptions(options("founder", "30d"));
    await flush();
    assert.equal(pending[0].signal.aborted, true);
    assert.equal(observer.getCurrentResult().data, undefined);
    pending[0].resolve(
      new Response(JSON.stringify({ privateValue: "old-window" })),
    );
    pending[1].resolve(
      new Response(JSON.stringify({ privateValue: "current-window" })),
    );
    await flush();
    assert.deepEqual(observer.getCurrentResult().data, {
      privateValue: "current-window",
    });
    observer.setOptions(options("different-user", "30d"));
    await flush();
    assert.equal(observer.getCurrentResult().data, undefined);
    pending[2].resolve(
      new Response(JSON.stringify({ privateValue: "other-user" })),
    );
    await flush();
    assert.deepEqual(observer.getCurrentResult().data, {
      privateValue: "other-user",
    });
  } finally {
    unsubscribe();
    client.clear();
  }
});
