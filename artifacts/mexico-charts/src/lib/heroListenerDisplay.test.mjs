import test from "node:test";
import assert from "node:assert/strict";
import { listenerSnapshot } from "./listenerSnapshot.mjs";
import { heroListenerDisplay } from "./heroListenerDisplay.mjs";

test("saved zero wins over positive metadata and retains its own provenance", () => {
  const selected = listenerSnapshot({ spotifyListeners: 123 }, { snapshot: { spotifyMonthlyListeners: 0, snapshotDate: "2026-09-30" } });
  const original = { ...selected };
  assert.deepEqual(heroListenerDisplay(selected), { state: "available", compact: "0", source: "saved", snapshotDate: "2026-09-30" });
  assert.deepEqual(selected, original);
});

test("legacy normalized zero makes no observed-zero claim", () => {
  const selected = listenerSnapshot({ spotifyListeners: 0 }, { snapshot: { spotifyMonthlyListeners: null, snapshotDate: "2026-09-30" } });
  assert.deepEqual(heroListenerDisplay(selected), { state: "unconfirmed", compact: null, source: "editorial", snapshotDate: null });
  assert.equal(selected.value, 0);
});

test("missing selection has no illustrative fallback or attributed source", () => {
  assert.deepEqual(heroListenerDisplay(listenerSnapshot(null, null)), { state: "missing", compact: null, source: null, snapshotDate: null });
});

test("positive saved snapshot preserves existing compact formatting", () => {
  assert.deepEqual(heroListenerDisplay(listenerSnapshot({ spotifyListeners: 47400000 }, { snapshot: { spotifyMonthlyListeners: 43979322, snapshotDate: "2026-09-30" } })), { state: "available", compact: "44.0M", source: "saved", snapshotDate: "2026-09-30" });
});

test("positive editorial fallback never borrows another source's date", () => {
  assert.deepEqual(heroListenerDisplay(listenerSnapshot({ spotifyListeners: 123 }, { snapshot: { spotifyMonthlyListeners: null, snapshotDate: "2026-09-30" } })), { state: "available", compact: "123", source: "editorial", snapshotDate: null });
});

test("saved zero without a valid calendar date stays available without invented time", () => {
  for (const date of [null, undefined, "", "not-a-date", "2026-02-30", "2026-09-30T00:00:00Z"]) {
    assert.deepEqual(heroListenerDisplay(listenerSnapshot(null, { snapshot: { spotifyMonthlyListeners: 0, snapshotDate: date } })), { state: "available", compact: "0", source: "saved", snapshotDate: null });
  }
});

test("invalid selected values are not clamped or replaced by another source", () => {
  for (const value of [-7, NaN, Infinity, "123", {}]) {
    const selected = { value, source: "Songstats", date: "2026-09-30", compact: "unused" };
    assert.deepEqual(heroListenerDisplay(selected), { state: "invalid", compact: null, source: "saved", snapshotDate: "2026-09-30" });
    assert.equal(selected.value, value);
  }
  const selected = listenerSnapshot({ spotifyListeners: -7 }, null);
  assert.equal(heroListenerDisplay(selected).state, "invalid");
  assert.equal(selected.value, -7);
});
