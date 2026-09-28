import test from "node:test";
import assert from "node:assert/strict";
import { historyInsertBatchSize } from "./songstats-history-insert-batch";

test("only an explicit bounded batch override changes the normal default", () => {
  for (const value of [undefined, "", "250", "0", "-1", "Infinity", "1000000", "1001"]) {
    assert.equal(historyInsertBatchSize(value), 250);
  }
  assert.equal(historyInsertBatchSize("1000"), 1000);
  assert.ok(historyInsertBatchSize("1000") * 9 < 65535);
});

test("both batch sizes retain every row once, including the partial final batch", () => {
  for (const size of [historyInsertBatchSize(), historyInsertBatchSize("1000")]) {
    for (const count of [0, 1, 249, 250, 999, 1000, 1001, 11602]) {
      const rows = Array.from({ length: count }, (_, i) => i);
      const batches: number[][] = [];
      for (let i = 0; i < rows.length; i += size) batches.push(rows.slice(i, i + size));
      assert.deepEqual(batches.flat(), rows);
      assert.ok(batches.every(batch => batch.length <= size));
    }
  }
});
