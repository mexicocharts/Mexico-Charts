import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("WAL interval endpoints both measure insertion, never buffered-write progress", async () => {
  const source = await readFile(new URL("./songstats-history-store.ts", import.meta.url), "utf8");
  const endpoints = source.slice(source.indexOf("export async function songstatsHistoryCapacitySnapshot()"), source.indexOf("export interface StoredHistoricalObservationRow"));
  assert.equal(endpoints.match(/pg_current_wal_insert_lsn\(\)/g)?.length, 2);
  assert.doesNotMatch(endpoints, /pg_current_wal_lsn\(\)/);
});

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

test("persistence WAL excludes provider wait but retains full-interval diagnostics", async () => {
  const source = await readFile(new URL("./songstats-history-backfill.ts", import.meta.url), "utf8");
  assert.ok(source.indexOf("const persistenceBefore =") > source.indexOf("const payload = await fetchWithRetry"));
  assert.ok(source.indexOf("const persistenceBefore =") < source.indexOf("const saved = await completeSongstatsHistoryChunk"));
  assert.match(source, /const walBytes = await songstatsHistoryWalBytesSince\(persistenceBefore.walLsn\)/);
  assert.match(source, /const acquisitionIntervalWalBytes = await songstatsHistoryWalBytesSince\(capacityBefore.walLsn\)/);
  assert.match(source, /walScope: "database_global_during_persistence"/);
  assert.match(source, /songstatsHistoryCapacityPauseReason\(projection, capacityPolicy\)/);
  assert.match(source, /walAmplificationRatio > approvedRatio \* 2/);
});
