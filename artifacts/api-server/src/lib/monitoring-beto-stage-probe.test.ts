import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createBetoStageProbe, probeExtendedQuery } from "./monitoring-beto-stage-probe";

test("unselected requests retain the original pool-query path", async () => {
  let calls = 0;
  const rows = [{ artist_key: "example" }];
  const pool = { query: async () => { calls++; return { rows }; } };
  assert.equal(await probeExtendedQuery(pool as never, "SELECT $1", [1], undefined), rows);
  assert.equal(calls, 1);
});
test("selected timing preserves one acquisition/query/release and exposes only safe counts", async () => {
  const phases: string[] = [];
  let releaseCount = 0;
  const client = Object.assign(new EventEmitter(), {
    processID: 17,
    release: () => { releaseCount++; },
    query: (sql: string, values: unknown[], cb: Function) => {
      assert.equal(sql, "SELECT $1"); assert.deepEqual(values, [42]);
      queueMicrotask(() => cb(null, { rows: [{ privateValue: "not logged" }] }));
    },
  });
  const rows = await probeExtendedQuery({ connect: async () => client } as never, "SELECT $1", [42],
    (phase, details) => { phases.push(phase); assert.ok(!JSON.stringify(details ?? {}).includes("not logged")); });
  assert.equal(rows.length, 1); assert.equal(releaseCount, 1);
  assert.deepEqual(phases, ["acquisition_start", "acquisition_end", "query_dispatch", "query_callback",
    "row_transfer_and_driver_decoding_complete", "rows_projection_start", "rows_projection_end"]);
  assert.equal(client.listenerCount("error"), 0);
});
test("query errors reject unchanged and retire the errored client", async () => {
  const failure = new Error("fixture"); let released: Error | undefined;
  const client = Object.assign(new EventEmitter(), {
    release: (error: Error) => { released = error; },
    query: (_s: unknown, _v: unknown, cb: Function) => cb(failure),
  });
  await assert.rejects(probeExtendedQuery({ connect: async () => client } as never, "SELECT 1", [], () => {}), error => error === failure);
  assert.equal(released, failure); assert.equal(client.listenerCount("error"), 0);
});
test("probe requires the private opt-in, exact artist, and claims only one request", () => {
  const oldPrivate = process.env.MONITOR_PRO_READONLY_PREVIEW;
  const oldProbe = process.env.MONITOR_PRO_BETO_STAGE_PROBE;
  try {
    delete process.env.MONITOR_PRO_BETO_STAGE_PROBE;
    assert.equal(createBetoStageProbe("betoquintanilla", () => {}), undefined);
    process.env.MONITOR_PRO_BETO_STAGE_PROBE = "true";
    process.env.MONITOR_PRO_READONLY_PREVIEW = "true";
    assert.equal(createBetoStageProbe("someone_else", () => {}), undefined);
    assert.equal(typeof createBetoStageProbe("betoquintanilla", () => {}), "function");
    assert.equal(createBetoStageProbe("betoquintanilla", () => {}), undefined);
  } finally {
    if (oldPrivate === undefined) delete process.env.MONITOR_PRO_READONLY_PREVIEW; else process.env.MONITOR_PRO_READONLY_PREVIEW = oldPrivate;
    if (oldProbe === undefined) delete process.env.MONITOR_PRO_BETO_STAGE_PROBE; else process.env.MONITOR_PRO_BETO_STAGE_PROBE = oldProbe;
  }
});
