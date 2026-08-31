import assert from "node:assert/strict";
import test from "node:test";
import { WEEKLY_EDITIONS, weeklyEdition, weeklyEditionNeighbors } from "../data/weekly-editions.mjs";

test("weekly archive contains only unique, verified ISO editions", () => {
  const dates = WEEKLY_EDITIONS.map((edition) => edition.date);
  assert.equal(new Set(dates).size, dates.length);
  assert.deepEqual(dates, [...dates].sort().reverse());
  for (const edition of WEEKLY_EDITIONS) {
    assert.match(edition.date, /^20\d{2}-\d{2}-\d{2}$/);
    assert.match(edition.updatedAt, /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
    assert.ok(Date.parse(edition.updatedAt) >= Date.parse(`${edition.date}T00:00:00Z`));
    assert.equal(weeklyEdition(edition.date), edition);
  }
});

test("weekly archive neighbors follow the real archive order", () => {
  assert.deepEqual(weeklyEditionNeighbors("2026-08-20"), {
    newer: WEEKLY_EDITIONS[0],
    older: WEEKLY_EDITIONS[2],
  });
  assert.deepEqual(weeklyEditionNeighbors("1999-01-01"), { newer: null, older: null });
});
