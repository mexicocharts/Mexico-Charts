import assert from "node:assert/strict";
import { test } from "node:test";
import { chartEditionDate, mexicoChartArchiveDate, parseProprietaryChartCsv } from "./chart-archive-policy";

test("parses quoted chart rows without losing commas", () => {
  assert.deepEqual(parseProprietaryChartCsv('rank,artist,title\n1,"Luis Miguel","Hasta Que Me Olvides, En Vivo"\n'), {
    headers: ["rank", "artist", "title"],
    rows: [{ rank: "1", artist: "Luis Miguel", title: "Hasta Que Me Olvides, En Vivo" }],
  });
});

test("uses Mexico City calendar dates for archive partitions", () => {
  assert.equal(mexicoChartArchiveDate(new Date("2026-08-19T04:30:00.000Z")), "2026-08-18");
});

test("preserves a chart's own edition date instead of relabeling it with fetch time", () => {
  assert.equal(chartEditionDate([{ "Week Ending": "2026-08-13" }], "2026-08-19"), "2026-08-13");
});
