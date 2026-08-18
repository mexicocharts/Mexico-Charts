import test from "node:test";
import assert from "node:assert/strict";
import { compareChartEditions } from "./official-chart-comparison";

test("compares exact ranks and identifies debuts without estimates", () => {
  const previous: Array<Record<string, string>> = [
    { Rank: "1", Title: "Uno", Artist: "A" },
    { Rank: "2", Title: "Dos", Artist: "B" },
    { Rank: "3", Title: "Tres", Artist: "C" },
  ];
  const current: Array<Record<string, string>> = [
    { Rank: "1", Title: "Dos", Artist: "B", "Contains Mexican Artist": "TRUE" },
    { Rank: "2", Title: "Nuevo", Artist: "D", "Contains Mexican Artist": "TRUE" },
    { Rank: "3", Title: "Uno", Artist: "A" },
  ];
  const result = compareChartEditions(current, previous);
  assert.equal(result.climbers[0]?.movement, 1);
  assert.equal(result.debuts[0]?.row["Title"], "Nuevo");
  assert.equal(result.fallers[0]?.movement, -2);
  assert.equal(result.mexicanEntries.length, 2);
});
