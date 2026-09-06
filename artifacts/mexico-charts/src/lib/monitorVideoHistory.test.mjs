import test from "node:test";
import assert from "node:assert/strict";
import {
  monitorVideoHistoryRequest,
  validateMonitorVideoHistory,
} from "./monitorVideoHistory.mjs";
import {
  monitorRequestState,
  requestMonitorResource,
} from "./monitorRequest.mjs";

const expected = {
  artistKey: "synthetic artist",
  videoId: "synthetic01",
  range: "7d",
  accessSource: "internal",
};
function fixture({ missing = [], zero = false } = {}) {
  const dates = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 7, 31 + i)).toISOString().slice(0, 10),
  );
  const points = dates
    .filter((date) => !missing.includes(date))
    .map((date, i) => ({
      date,
      observedAt: date + "T20:00:00.000Z",
      observationId: `source-${i}`,
      viewCount: zero ? 0 : 1000 - i,
    }));
  return {
    kind: "native_intraday_cumulative",
    ...expected,
    timeZone: "America/New_York",
    startDate: dates[0],
    endDate: dates.at(-1),
    asOf: "2026-09-06T21:00:00.000Z",
    selection: "last_observation_per_et_date",
    sourceTable: "youtube_video_intraday_shadow_snapshots",
    sourceType: "youtube_api_shadow",
    status:
      points.length === 7 ? "complete" : points.length ? "partial" : "empty",
    points,
    coverage: {
      requestedDays: 7,
      observedDays: points.length,
      missingDates: dates.filter(
        (date) => !points.some((point) => point.date === date),
      ),
      rawObservationCount: points.length * 2,
      firstObservedAt: points[0] ? points[0].date + "T10:00:00.000Z" : null,
      lastObservedAt: points.at(-1)?.observedAt ?? null,
      meaning: "observed_dates_only",
    },
    relationship: {
      hasApprovedLink: true,
      visibilityScope: "approved_artist_link",
      relationSource: "youtube_artist_video_links",
      relationStatus: "review",
      samplingStatus: "shadow",
      relationshipSources: [
        {
          source_table: "youtube_artist_video_links",
          source_id: "fixture",
          artist_key: expected.artistKey,
          status: "active",
          sampling_status: null,
          confidence_score: null,
          evidence_source: null,
        },
      ],
    },
  };
}

test("video history cache and URL scope every request by viewer, artist, video, range and access source", () => {
  const input = { ...expected, userId: "viewer-one" };
  const base = monitorVideoHistoryRequest(input);
  assert.equal(
    base.input,
    "/api/monitoring/videos/synthetic%20artist/synthetic01/history?range=7d",
  );
  for (const change of [
    { userId: "viewer-two" },
    { artistKey: "other / artist" },
    { videoId: "synthetic02" },
    { range: "30d" },
    { accessSource: "subscription" },
  ]) {
    assert.notDeepEqual(
      monitorVideoHistoryRequest({ ...input, ...change }).queryKey,
      base.queryKey,
    );
  }
  assert.throws(
    () => monitorVideoHistoryRequest({ ...input, range: "all" }),
    RangeError,
  );
});

test("native cumulative samples preserve real zeros, decreases and raw first timestamps preceding the selected sample", () => {
  for (const payload of [fixture(), fixture({ zero: true })]) {
    assert.equal(validateMonitorVideoHistory(payload, expected), payload);
    assert.equal(payload.points.length, 7);
  }
});

test("video history requires exact identity and native provenance, without promoting candidate relationships for subscribers", () => {
  for (const change of [
    { artistKey: "other" },
    { videoId: "synthetic02" },
    { range: "90d" },
    { sourceType: "protected_comparator" },
    { kind: "daily_views" },
    { selection: "interpolated" },
  ]) {
    assert.throws(
      () => validateMonitorVideoHistory({ ...fixture(), ...change }, expected),
      { status: 502 },
    );
  }
  const candidate = fixture();
  candidate.relationship = {
    ...candidate.relationship,
    hasApprovedLink: false,
    visibilityScope: "founder_candidate_diagnostic",
  };
  assert.equal(validateMonitorVideoHistory(candidate, expected), candidate);
  assert.throws(
    () =>
      validateMonitorVideoHistory(candidate, {
        ...expected,
        accessSource: "subscription",
      }),
    { status: 403 },
  );
});

test("empty, one-point partial and complete video responses must agree with exact selected-window coverage", () => {
  const allDates = fixture().points.map((point) => point.date);
  for (const missing of [[], allDates.slice(1), allDates]) {
    const payload = validateMonitorVideoHistory(fixture({ missing }), expected);
    assert.equal(
      monitorRequestState({
        isFetching: false,
        succeeded: true,
        observationCount: payload.points.length,
        partial: payload.status === "partial",
      }),
      missing.length === 0
        ? "loaded"
        : missing.length === 7
          ? "empty"
          : "partial",
    );
  }
  for (const mutate of [
    (p) => {
      p.status = "empty";
    },
    (p) => {
      p.coverage.missingDates = [p.startDate];
    },
    (p) => {
      p.coverage.observedDays = 6;
    },
    (p) => {
      p.coverage.rawObservationCount = 6;
    },
    (p) => {
      p.startDate = "2020-01-01";
    },
  ]) {
    const payload = fixture();
    mutate(payload);
    assert.throws(() => validateMonitorVideoHistory(payload, expected), {
      status: 502,
    });
  }
});

test("video observations must have unique chronological ET dates, real calendar timestamps and finite counts", () => {
  for (const mutate of [
    (p) => {
      p.points[0].date = "2026-02-31";
    },
    (p) => {
      p.points[0].observedAt = "2026-02-31T20:00:00.000Z";
    },
    (p) => {
      p.points[0].observedAt = p.points[0].date + "T24:00:00.000Z";
    },
    (p) => {
      p.points[0].observedAt = p.points[0].date + "T02:00:00.000Z";
    },
    (p) => {
      p.points[1].observationId = p.points[0].observationId;
    },
    (p) => {
      p.points[1].date = p.points[0].date;
    },
    (p) => {
      p.points[0].viewCount = NaN;
    },
    (p) => {
      p.points[0].viewCount = -1;
    },
    (p) => {
      p.asOf = "2026-09-06T19:00:00.000Z";
    },
    (p) => {
      p.coverage.lastObservedAt = "2026-09-06T19:00:00.000Z";
    },
    (p) => {
      p.relationship.relationshipSources[0].status = {
        invalid: "not renderable text",
      };
    },
  ]) {
    const payload = fixture();
    mutate(payload);
    assert.throws(() => validateMonitorVideoHistory(payload, expected), {
      status: 502,
    });
  }
});

test("UTC observations after midnight retain their previous Eastern date", () => {
  const payload = fixture();
  payload.asOf = "2026-09-07T03:00:00.000Z";
  payload.points.at(-1).observedAt = "2026-09-07T02:00:00.000Z";
  payload.coverage.lastObservedAt = payload.points.at(-1).observedAt;
  assert.equal(
    validateMonitorVideoHistory(payload, expected).endDate,
    "2026-09-06",
  );
});

test("the bounded resource lifecycle treats malformed native history as failure and aborts held video reads", async () => {
  const request = monitorVideoHistoryRequest({ ...expected, userId: "viewer" });
  await assert.rejects(
    requestMonitorResource({
      getToken: async () => "fixture",
      input: request.input,
      fetchAuthenticated: async () =>
        new Response(JSON.stringify({ ...fixture(), points: [] }), {
          status: 200,
        }),
      readResponse: async (response) =>
        validateMonitorVideoHistory(await response.json(), expected),
    }),
    { status: 502 },
  );
  const controller = new AbortController();
  let fetchSignal;
  const pending = requestMonitorResource({
    getToken: async () => "fixture",
    input: request.input,
    signal: controller.signal,
    fetchAuthenticated: async (_token, _url, options) => {
      fetchSignal = options.signal;
      return new Promise(() => {});
    },
  });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(fetchSignal.aborted, true);
});
