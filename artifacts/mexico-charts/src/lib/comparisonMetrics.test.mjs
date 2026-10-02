import test from "node:test";
import assert from "node:assert/strict";
import { commonSourceReadings, comparisonBars, metricValue, snapshotCompatibility, formatComparisonValue } from "./comparisonMetrics.mjs";

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
