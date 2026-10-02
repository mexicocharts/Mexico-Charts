import assert from "node:assert/strict";
import test from "node:test";
import { releaseComparisonText } from "./releaseComparisonText.mjs";

test("a nominal plus-seven target displays the actual eight-day stored interval", () => {
  const text = releaseComparisonText({ metric: "spotifyMonthlyListeners", baseline: { date: "2026-04-30" }, followup: { date: "2026-05-08" }, storedDateIntervalDays: 8, baselineOffsetDays: 0, followupOffsetDays: 0 });
  assert.match(text, /ventana móvil/);
  assert.match(text, /2026-04-30 → 2026-05-08/);
  assert.match(text, /fechas guardadas: 8 días/);
});

test("distant points and missing fields do not become precise or zero-length measurements", () => {
  const text = releaseComparisonText({ metric: "instagramFollowers", baseline: { date: "2026-04-30" }, followup: { date: "2026-07-30" }, storedDateIntervalDays: 91, baselineOffsetDays: 0, followupOffsetDays: 83 });
  assert.match(text, /91 días/);
  assert.match(text, /seguimiento \+83 días/);
  const missing = releaseComparisonText({ metric: "instagramFollowers", baseline: null, followup: null, storedDateIntervalDays: null, baselineOffsetDays: null, followupOffsetDays: null });
  assert.match(missing, /base no disponible → seguimiento no disponible/);
  assert.match(missing, /fechas guardadas: no disponible/);
  assert.doesNotMatch(missing, /0 días/);
});
