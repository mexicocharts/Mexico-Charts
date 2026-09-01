import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("backfill persists per-chunk WAL and execution telemetry before anomaly enforcement", async () => {
  const [backfill, store] = await Promise.all([
    readFile(new URL("./songstats-history-backfill.ts", import.meta.url), "utf8"),
    readFile(new URL("./songstats-history-store.ts", import.meta.url), "utf8"),
  ]);
  assert.match(backfill, /recordSongstatsHistoryChunkTelemetry\(\{/);
  assert.match(backfill, /walAmplificationRatio > approvedRatio \* 2/);
  for (const field of [
    "walBytes", "estimatedLogicalBytes", "walAmplificationRatio", "rowsInserted",
    "elapsedMs", "retryCount", "failureCount",
  ]) assert.match(store, new RegExp(field));
  assert.match(store, /'telemetry', jsonb_build_object/);
});

