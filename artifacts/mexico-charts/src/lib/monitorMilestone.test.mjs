import test from "node:test";
import assert from "node:assert/strict";
import { monitorMilestoneProgress } from "./monitorMilestone.mjs";

test("actual AMG reading does not announce 400M reached", () => {
  const result = monitorMilestoneProgress(399_937_674, 400_000_000);
  assert.equal(result.label, "<100");
  assert.ok(result.percent < 100);
  assert.equal(400_000_000 - 399_937_674, 62_326);
});
test("ordinary rounding and reached milestones remain truthful", () => {
  assert.equal(monitorMilestoneProgress(364_577_060, 400_000_000).label, "91.1");
  assert.deepEqual(monitorMilestoneProgress(400_000_000, 400_000_000), { percent: 100, label: "100" });
  assert.equal(monitorMilestoneProgress(400_000_001, 400_000_000).percent, 100);
  assert.equal(monitorMilestoneProgress(0, 400_000_000).label, "0");
});
test("invalid data is not displayed as measured progress", () => {
  for (const [views, target] of [[NaN, 100], [1, 0], [-1, 100], [1, Infinity]]) {
    assert.deepEqual(monitorMilestoneProgress(views, target), { percent: 0, label: "—" });
  }
});
