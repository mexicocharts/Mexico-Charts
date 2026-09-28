import test from "node:test";
import assert from "node:assert/strict";
import { readSongstatsInsertWal, readSongstatsUpdateWal, historyWalAmplification } from "./songstats-history-insert-wal";

test("completion UPDATE diagnostic is separate and fails closed on missing counters", () => {
  assert.deepEqual(readSongstatsUpdateWal([{ Plan: { Operation: "Update",
    "WAL Bytes": 123, "WAL Records": 2, "WAL FPI": 0 } }]),
  { scope: "chunk_completion_update", bytes: 123, records: 2, fullPageImages: 0 });
  assert.throws(() => readSongstatsUpdateWal([{ Plan: { Operation: "Insert" } }]));
  assert.throws(() => readSongstatsUpdateWal([{ Plan: { Operation: "Update" } }]));
});

test("empty windows do not invent a one-byte observation denominator", () => {
  assert.equal(historyWalAmplification(20344, 0), null);
  assert.equal(historyWalAmplification(19524104, 3732220.8), 19524104 / 3732220.8);
  assert.equal(historyWalAmplification(400, 100), 4);
  assert.throws(() => historyWalAmplification(NaN, 100));
  assert.throws(() => historyWalAmplification(100, -1));
});

test("measured inserts use actual inserted tuple count and top-level WAL only", () => {
  assert.deepEqual(readSongstatsInsertWal([{ Plan: {
    Operation: "Insert", "Tuples Inserted": 247, "Conflicting Tuples": 3,
    "WAL Bytes": 45000, "WAL Records": 750, "WAL FPI": 4,
    Plans: [{ "WAL Bytes": 100 }],
  } }]), { scope: "observation_insert_statements", inserted: 247, bytes: 45000, records: 750, fullPageImages: 4 });
});
test("missing WAL evidence fails closed, never becomes zero", () => {
  assert.throws(() => readSongstatsInsertWal([{ Plan: { Operation: "Insert", "Tuples Inserted": 1 } }]));
  assert.throws(() => readSongstatsInsertWal([]));
});
test("zero-row duplicate-only insert is represented truthfully", () => {
  assert.equal(readSongstatsInsertWal([{ Plan: { Operation: "Insert", "Tuples Inserted": 0,
    "WAL Bytes": 0, "WAL Records": 0, "WAL FPI": 0 } }]).inserted, 0);
});
