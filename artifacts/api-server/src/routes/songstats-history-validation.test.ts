import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import { createSongstatsHistoryValidationRouter } from "./songstats-history-validation";

const KEY = "k".repeat(64);
const FINGERPRINT = "a".repeat(64);
const CONFIRM = "controlled-three-artist-songstats-history";

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    SONGSTATS_ADMIN_KEY: KEY,
    SONGSTATS_HISTORY_VALIDATION_HTTP_ENABLED: "true",
    SONGSTATS_HISTORY_VALIDATION_EXPECTED_SOURCE_FINGERPRINT: FINGERPRINT,
    ...overrides,
  };
}

async function withServer(
  options: Parameters<typeof createSongstatsHistoryValidationRouter>[0],
  callback: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use("/api", createSongstatsHistoryValidationRouter(options));
  const server: Server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
  }
}

async function invoke(baseUrl: string, body: unknown, key = KEY) {
  return fetch(`${baseUrl}/api/admin/songstats/history-validation`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": key },
    body: JSON.stringify(body),
  });
}

const firstChunk = {
  action: "chunk",
  artist: "peso-pluma",
  year: 2020,
  confirm: CONFIRM,
};

test("disabled, unauthorized, absent, and mismatched fingerprints block all DB/API paths", async () => {
  let stateCalls = 0;
  let runCalls = 0;
  const loadState = async () => { stateCalls += 1; return []; };
  const runBackfill = async () => { runCalls += 1; return {}; };
  for (const options of [
    { env: env({ SONGSTATS_HISTORY_VALIDATION_HTTP_ENABLED: "false" }), actualFingerprint: FINGERPRINT },
    { env: env(), actualFingerprint: FINGERPRINT, wrongKey: true },
    { env: env({ SONGSTATS_HISTORY_VALIDATION_EXPECTED_SOURCE_FINGERPRINT: undefined }), actualFingerprint: FINGERPRINT },
    { env: env({ SONGSTATS_HISTORY_VALIDATION_EXPECTED_SOURCE_FINGERPRINT: "b".repeat(64) }), actualFingerprint: FINGERPRINT },
  ]) {
    await withServer({
      env: options.env,
      actualFingerprint: options.actualFingerprint,
      loadState,
      runBackfill: runBackfill as never,
    }, async baseUrl => {
      const response = await invoke(baseUrl, firstChunk, options.wrongKey ? "wrong" : KEY);
      assert.ok([403, 404, 409].includes(response.status));
    });
  }
  assert.equal(stateCalls, 0);
  assert.equal(runCalls, 0);
});

test("only the exact next approved artist/year can invoke one validation chunk", async () => {
  let received: Record<string, unknown> | null = null;
  await withServer({
    env: env(),
    actualFingerprint: FINGERPRINT,
    loadState: async () => [],
    runBackfill: (async (options: unknown) => {
      received = options as unknown as Record<string, unknown>;
      return { runId: "test", status: "running" };
    }) as never,
  }, async baseUrl => {
    assert.equal((await invoke(baseUrl, { ...firstChunk, year: 2021 })).status, 400);
    assert.equal((await invoke(baseUrl, firstChunk)).status, 200);
  });
  assert.deepEqual(received?.["artistKeys"], ["pesopluma", "bandamsdesergiolizarraga", "netonvega"]);
  assert.deepEqual(received?.["task"], { artistKey: "pesopluma", year: 2020 });
  assert.equal(received?.["maxAttempts"], 3);
  assert.equal(received?.["concurrency"], 1);
  assert.equal(received?.["deferFinalize"], true);
});

test("a failed, running, or foreign-run chunk fails closed without an API call", async () => {
  let runCalls = 0;
  const base = {
    artist_key: "pesopluma",
    window_start_date: "2020-01-01",
    window_end_date: "2020-12-31",
    run_id: "songstats-controlled-three-artist-history-2026-09-01",
    attempt_count: 1,
    error_code: null,
    error_message: null,
  };
  for (const row of [
    { ...base, status: "failed" },
    { ...base, status: "running" },
    { ...base, status: "completed", run_id: "other" },
  ]) {
    await withServer({
      env: env(), actualFingerprint: FINGERPRINT,
      loadState: async () => [row],
      runBackfill: (async () => { runCalls += 1; return {}; }) as never,
    }, async baseUrl => assert.equal((await invoke(baseUrl, firstChunk)).status, 409));
  }
  assert.equal(runCalls, 0);
});

test("report is available only after all 21 approved chunks complete", async () => {
  const artists = ["pesopluma", "bandamsdesergiolizarraga", "netonvega"];
  const rows = artists.flatMap(artist => [2020, 2021, 2022, 2023, 2024, 2025, 2026].map(year => ({
    artist_key: artist,
    window_start_date: `${year}-01-01`,
    window_end_date: year === 2026 ? "2026-09-01" : `${year}-12-31`,
    status: "completed",
    run_id: "songstats-controlled-three-artist-history-2026-09-01",
    attempt_count: 1,
    error_code: null,
    error_message: null,
  })));
  let finalized = 0;
  await withServer({
    env: env(), actualFingerprint: FINGERPRINT,
    loadState: async () => rows,
    finalizeRun: async () => { finalized += 1; return {}; },
    buildReport: (async () => ({ safe: true })) as never,
  }, async baseUrl => {
    const response = await invoke(baseUrl, { action: "report", confirm: CONFIRM });
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as { report: { safe: boolean } }).report.safe, true);
  });
  assert.equal(finalized, 1);
});

test("compact serving report reads completed history without reaching import or Songstats paths", async () => {
  const artists = ["pesopluma", "bandamsdesergiolizarraga", "netonvega"];
  const rows = artists.flatMap(artist => [2020, 2021, 2022, 2023, 2024, 2025, 2026].map(year => ({
    artist_key: artist,
    window_start_date: `${year}-01-01`,
    window_end_date: year === 2026 ? "2026-09-01" : `${year}-12-31`,
    status: "completed",
    run_id: "songstats-controlled-three-artist-history-2026-09-01",
    attempt_count: 1,
    error_code: null,
    error_message: null,
  })));
  let importCalls = 0;
  let reportCalls = 0;
  await withServer({
    env: env(), actualFingerprint: FINGERPRINT,
    loadState: async () => rows,
    runBackfill: (async () => { importCalls += 1; return {}; }) as never,
    buildServingReport: (async (input: { artistKeys: readonly string[] }) => {
      reportCalls += 1;
      assert.deepEqual(input.artistKeys, artists);
      return { readOnly: true, songstatsApiCalls: 0, databaseWrites: 0 } as never;
    }) as never,
  }, async baseUrl => {
    const response = await invoke(baseUrl, {
      action: "compact-serving-report",
      confirm: CONFIRM,
    });
    assert.equal(response.status, 200);
    const payload = await response.json() as { report: { readOnly: boolean } };
    assert.equal(payload.report.readOnly, true);
  });
  assert.equal(reportCalls, 1);
  assert.equal(importCalls, 0);
});
