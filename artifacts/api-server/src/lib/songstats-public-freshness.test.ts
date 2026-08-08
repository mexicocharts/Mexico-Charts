import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseFreshSongstatsMetric,
  newestSongstatsDate,
} from "./songstats-public-freshness";

test("prefers a newer current snapshot over stale historic data", () => {
  assert.equal(chooseFreshSongstatsMetric(
    { value: 7_000_000, date: "2026-08-08" },
    { value: 6_990_000, date: "2026-08-07" },
  ), 7_000_000);
});

test("uses historic data when it is genuinely newer", () => {
  assert.equal(chooseFreshSongstatsMetric(
    { value: 100, date: "2026-08-07" },
    { value: 110, date: "2026-08-08" },
  ), 110);
});

test("falls back to the only available value and keeps zero as data", () => {
  assert.equal(chooseFreshSongstatsMetric(
    { value: null, date: "2026-08-08" },
    { value: 0, date: "2026-08-07" },
  ), 0);
});

test("uses the current snapshot on equal or unknown dates", () => {
  assert.equal(chooseFreshSongstatsMetric(
    { value: 200, date: "2026-08-08" },
    { value: 190, date: "2026-08-08" },
  ), 200);
  assert.equal(chooseFreshSongstatsMetric(
    { value: 200, date: null },
    { value: 190, date: "not-a-date" },
  ), 200);
});

test("reports the newest valid snapshot date", () => {
  assert.equal(newestSongstatsDate("2026-08-07", null, "2026-08-08"), "2026-08-08");
  assert.equal(newestSongstatsDate("invalid", undefined), null);
});
