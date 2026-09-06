import assert from "node:assert/strict";
import test from "node:test";
import { compareCatalogCounts, formatCatalogDaily } from "./monitorCatalog.mjs";

test("catalog counts preserve unknown, zero and signed corrections in sorting and display", () => {
  const rows = [{ id: "unknown", value: null }, { id: "zero", value: 0 }, { id: "positive", value: 239 }, { id: "correction", value: -12 }];
  assert.deepEqual([...rows].sort((a, b) => compareCatalogCounts(a.value, b.value)).map(row => row.id), ["positive", "zero", "correction", "unknown"]);
  assert.deepEqual([...rows].sort((a, b) => compareCatalogCounts(a.value, b.value, "asc")).map(row => row.id), ["correction", "zero", "positive", "unknown"]);
  assert.equal(compareCatalogCounts(null, undefined), 0);
  assert.equal(formatCatalogDaily(null, String), "—");
  assert.equal(formatCatalogDaily(0, String), "+0");
  assert.equal(formatCatalogDaily(-12, String), "-12");
  assert.equal(formatCatalogDaily(239, String), "+239");
});
