import test from "node:test";
import assert from "node:assert/strict";
import { monitorVideoDelta, completeMonitorVideoDelta } from "./monitorVideoDelta.mjs";
test("missing deltas and elapsed intervals remain unknown", () => {
  for (const [delta, seconds] of [[null, 86400], [undefined, 10], [0, null], [2, 0], [2, -1], [NaN, 3], ["", 10]]) {
    assert.equal(monitorVideoDelta(delta, seconds), null);
  }
});
test("genuine zero and negative corrections remain measured values", () => {
  assert.equal(monitorVideoDelta(0, 86400), 0);
  assert.equal(monitorVideoDelta(-45, 86400), -45);
  assert.equal(monitorVideoDelta("45208", "86400"), 45208);
});
test("aggregate never silently substitutes missing changes with zero", () => {
  assert.equal(completeMonitorVideoDelta([10, null]), null);
  assert.equal(completeMonitorVideoDelta([]), null);
  assert.equal(completeMonitorVideoDelta([10, -2, 0]), 8);
  assert.equal(completeMonitorVideoDelta([0, 0]), 0);
});
