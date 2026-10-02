import test from "node:test";
import assert from "node:assert/strict";
import { commonSourceReadings, comparisonBars, comparisonScore, metricValue, snapshotCompatibility, formatComparisonValue } from "./comparisonMetrics.mjs";

test("battle line fills edge to edge in proportion to both artists, without a minimum fill", () => {
  const largerLeft = comparisonBars(20, 10);
  assert.ok(Math.abs(largerLeft.a - 200 / 3) < 1e-12);
  assert.equal(largerLeft.a + largerLeft.b, 100);
  assert.equal(largerLeft.winner, "a");
  const largerRight = comparisonBars(10, 20);
  assert.ok(Math.abs(largerRight.a - largerLeft.b) < 1e-12);
  assert.equal(largerRight.a + largerRight.b, 100);
  assert.deepEqual(comparisonBars(3, 3), { comparable: true, a: 50, b: 50, winner: null });
  assert.deepEqual(comparisonBars(0, 0), { comparable: true, a: 0, b: 0, winner: null });
  assert.deepEqual(comparisonBars(0, 10), { comparable: true, a: 0, b: 100, winner: "b" });
  assert.deepEqual(comparisonBars(10, 0), { comparable: true, a: 100, b: 0, winner: "a" });
  assert.ok(comparisonBars(1, 1e12).a < 1e-10);
  assert.deepEqual(comparisonBars(Number.MAX_VALUE, Number.MAX_VALUE), { comparable: true, a: 50, b: 50, winner: null });
});

test("unavailable, invalid and incompatible readings cannot imply zero or a winner", () => {
  for (const a of [null, undefined, NaN, Infinity, -1]) {
    assert.deepEqual(comparisonBars(a, 10), { comparable: false, a: null, b: null, winner: null });
  }
  assert.equal(comparisonBars(1, 2, { compatible: false }).comparable, false);
  assert.equal(metricValue(0), 0);
  assert.equal(metricValue(0, { editorial: true }), null);
  assert.equal(formatComparisonValue(0), "0");
  assert.equal(formatComparisonValue(null), "—");
});

test("source and collection-date mismatches suppress direct comparison", () => {
  const saved = { source: "Songstats", date: "2026-09-30" };
  assert.equal(snapshotCompatibility(saved, { ...saved }).compatible, true);
  assert.equal(snapshotCompatibility(saved, { ...saved, date: "2026-09-29" }).compatible, false);
  assert.equal(snapshotCompatibility(saved, { ...saved, date: null }).compatible, false);
  assert.equal(snapshotCompatibility(saved, { ...saved, source: "Editorial" }).compatible, false);
  assert.match(snapshotCompatibility(saved, saved).note, /cada métrica no informada/);
  assert.match(snapshotCompatibility({ source: "Editorial", date: null }, { source: "Editorial", date: null }).note, /no verificada/);
});

test("mixed sources use a complete common dataset without hiding missing values or saved-date mismatches", () => {
  const saved = { value: 12, source: "Songstats", date: "2026-09-30" };
  const editorialA = { value: 10, source: "Editorial", date: null };
  const editorialB = { value: 20, source: "Editorial", date: null };
  assert.deepEqual(commonSourceReadings(saved, editorialB, editorialA, editorialB),
    { a: editorialA, b: editorialB, usedFallback: true });
  assert.equal(commonSourceReadings(saved, editorialB, { ...editorialA, value: null }, editorialB).usedFallback, false);
  assert.equal(commonSourceReadings({ ...saved, value: null }, editorialB, editorialA, editorialB).usedFallback, false);
  const differentDate = { ...saved, value: 20, date: "2026-09-29" };
  assert.deepEqual(commonSourceReadings(saved, differentDate, editorialA, editorialB),
    { a: saved, b: differentDate, usedFallback: false });
  const zero = { ...saved, value: 0 };
  assert.equal(commonSourceReadings(zero, saved, editorialA, editorialB).a.value, 0);
  assert.equal(commonSourceReadings(zero, editorialB, editorialA, editorialB).a.value, 0);
});

const scoreMetric = (a, b, compatible = true) => ({ a: { value: a }, b: { value: b }, compatible });

test("total score gives one point per winning metric, excluding ties and unavailable comparisons", () => {
  const score = comparisonScore([
    scoreMetric(20, 10), scoreMetric(4, 12), scoreMetric(3, 2),
    scoreMetric(7, 7), scoreMetric(null, 9), scoreMetric(90, 2, false),
  ]);
  assert.deepEqual(score, { a: 2, b: 1, ties: 1, unavailable: 2, compared: 4, total: 6, winner: "a" });
  const swapped = comparisonScore([
    scoreMetric(10, 20), scoreMetric(12, 4), scoreMetric(2, 3),
    scoreMetric(7, 7), scoreMetric(9, null), scoreMetric(2, 90, false),
  ]);
  assert.equal(swapped.a, score.b);
  assert.equal(swapped.b, score.a);
  assert.equal(swapped.winner, "b");
});

test("score uses exact values, preserves zero, and reports an overall tie without a winner", () => {
  assert.deepEqual(comparisonScore([scoreMetric(1000001, 1000000), scoreMetric(0, 1), scoreMetric(0, 0)]),
    { a: 1, b: 1, ties: 1, unavailable: 0, compared: 3, total: 3, winner: null });
  assert.deepEqual(comparisonScore([scoreMetric(null, null), scoreMetric(Infinity, 2)]),
    { a: 0, b: 0, ties: 0, unavailable: 2, compared: 0, total: 2, winner: null });
  assert.deepEqual(comparisonScore([]),
    { a: 0, b: 0, ties: 0, unavailable: 0, compared: 0, total: 0, winner: null });
});
