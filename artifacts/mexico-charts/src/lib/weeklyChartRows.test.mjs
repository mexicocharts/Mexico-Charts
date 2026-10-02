import assert from "node:assert/strict";
import test from "node:test";
import { selectWeeklyChartRows } from "./weeklyChartRows.mjs";

const live = [{ Artist: "Current artist", "Contains Mexican Artist": "TRUE" }];
const historical = [{ Artist: "Archived artist", Rank: "7" }];
const isMexican = row => row["Contains Mexican Artist"] === "TRUE";

test("a loading, failed or missing archive never shows current rows", () => {
  for (const archive of [undefined, []]) {
    assert.deepEqual(selectWeeklyChartRows("2026-08-27", archive, live, isMexican), []);
  }
});

test("historical rows keep their stored identity, order and ranks", () => {
  const rows = [...historical, { Artist: "Second archived artist", Rank: "7" }];
  assert.deepEqual(selectWeeklyChartRows("2026-08-27", rows, live, isMexican), rows);
});

test("current routes retain Mexican filtering and the existing ten-row limit", () => {
  const rows = [
    { Artist: "Other", "Contains Mexican Artist": "FALSE" },
    ...Array.from({ length: 12 }, (_, i) => ({ Artist: String(i), "Contains Mexican Artist": "TRUE" })),
  ];
  assert.deepEqual(selectWeeklyChartRows(null, historical, rows, isMexican), rows.slice(1, 11));
});

test("an unknown historical date cannot select cached live rows", () => {
  assert.deepEqual(selectWeeklyChartRows("2099-01-01", undefined, live, isMexican), []);
});
