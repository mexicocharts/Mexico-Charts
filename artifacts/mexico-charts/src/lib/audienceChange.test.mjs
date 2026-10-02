import test from "node:test";
import assert from "node:assert/strict";
import { highestAvailableChange, audienceChangeCopy } from "./audienceChange.mjs";
const metric = (percentage, absolute = 1) => ({ days15: { percentage, absolute } });
test("negative, zero and null percentage ranking preserves original signed eligibility and stable ties", () => {
  assert.equal(highestAvailableChange({ spotifyMonthlyListeners: metric(-8), instagramFollowers: metric(-2), tiktokFollowers: metric(-11) }).label, "Instagram");
  assert.equal(highestAvailableChange({ spotifyMonthlyListeners: metric(null, 50), instagramFollowers: metric(4), tiktokFollowers: metric(-1) }).label, "Instagram");
  assert.equal(highestAvailableChange({ spotifyMonthlyListeners: metric(-2), instagramFollowers: metric(0) }).label, "Instagram");
  assert.equal(highestAvailableChange({ spotifyMonthlyListeners: metric(4), instagramFollowers: metric(4) }).label, "Spotify");
  assert.equal(highestAvailableChange({ spotifyMonthlyListeners: metric(null, 0) }), null);
});
test("actual distant endpoints and metadata absence have truthful bilingual presentation", () => {
  const evidence = { baseline: { date: "2026-05-01", value: 100 }, latest: { date: "2026-08-31", value: 120 }, storedDateIntervalDays: 122 };
  for (const lang of ["es", "en"]) {
    const copy = audienceChangeCopy(lang, evidence);
    assert.ok(copy.endpoints.includes("122")); assert.ok(copy.endpoints.includes("2026-05-01"));
    assert.ok(!copy.heading.includes("15"));
    assert.equal(audienceChangeCopy(lang).endpoints, null);
    assert.ok(!copy.unavailable.includes("Recopilando"));
  }
});
