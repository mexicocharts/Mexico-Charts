import test from "node:test";
import assert from "node:assert/strict";
import { readSongstatsInsertWal } from "./songstats-history-insert-wal";

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
