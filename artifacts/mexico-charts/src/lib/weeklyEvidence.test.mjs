import test from "node:test";
import assert from "node:assert/strict";
import { potentialCrossChartGains, savedComparisonCopy, savedComparisonAvailable } from "./weeklyEvidence.mjs";
const entry = (title, artist, platform = "spotify", extra = {}) => ({ rank: 4, previousRank: 9, movement: 5, debut: false,
  row: { [platform === "spotify" ? "Track Name" : "Song Name"]: title, [platform === "spotify" ? "Artist" : "Artist Name"]: artist,
    "Contains Mexican Artist": "true", ...extra } });
const chart = (climbers = [], date = "2026-01-22", previous = "2026-01-01") => ({ comparisonReady: true, chartDate: date, previousChartDate: previous, climbers, mexicanEntries: climbers, debuts: [] });
test("same title with different artists or explicit versions abstains", () => {
  for (const [title, credit] of [["Canción", "Otro artista"], ["Canción (Live)", "Artista"]]) {
    assert.equal(potentialCrossChartGains(chart([entry("Canción", "Artista")]), chart([entry(title, credit, "youtube")])).length, 0);
  }
});
test("blank title and missing or unusable credit never form a match", () => {
  for (const [title, credit] of [["", "Artista"], ["   ", "Artista"], ["Canción", ""], ["Canción", "—"], ["Canción", "Unknown"]]) {
    assert.equal(potentialCrossChartGains(chart([entry(title, credit)]), chart([entry(title, credit, "youtube")])).length, 0);
  }
});
test("ambiguous partners on either side abstain regardless of array order", () => {
  const left = entry("Canción", "Artista"); const right = entry("Canción", "Artista", "youtube");
  for (const rows of [[right, { ...right, rank: 8 }], [{ ...right, rank: 8 }, right]])
    assert.deepEqual(potentialCrossChartGains(chart([left]), chart(rows)), []);
  assert.deepEqual(potentialCrossChartGains(chart([left, left]), chart([right])), []);
});
test("unique potential match preserves native credit/title, identity rows and each compared period", () => {
  const left = entry("Canción", "Artista", "spotify", { "Track ID": "sp123" });
  const right = entry("Cancion", "Artista", "youtube", { "Video ID": "yt456" });
  const [match] = potentialCrossChartGains(chart([left]), chart([right], "2026-01-20", "2026-01-13"));
  assert.equal(match.spotify, left); assert.equal(match.youtube, right);
  assert.equal(match.spotifyTitle, "Canción"); assert.equal(match.youtubeTitle, "Cancion");
  assert.equal(match.spotifyPreviousDate, "2026-01-01"); assert.equal(match.youtubePreviousDate, "2026-01-13");
});
test("existing Mexican inclusion and eligible order/three-card cap are preserved", () => {
  const left = Array.from({ length: 5 }, (_, i) => entry(`Tema${i}`, "Artista"));
  const right = left.map((_, i) => entry(`Tema${i}`, "Artista", "youtube"));
  right[0].row["Contains Mexican Artist"] = "false";
  assert.deepEqual(potentialCrossChartGains(chart(left), chart(right)).map(x => x.spotifyTitle), ["Tema1", "Tema2", "Tema3"]);
});
test("absent/invalid comparison suppresses unmatched claims while a valid empty saved edition is allowed", () => {
  for (const value of [undefined, { ...chart(), comparisonReady: false }, { ...chart(), previousChartDate: null }, { ...chart(), debuts: null }]) {
    assert.equal(savedComparisonAvailable(value), false);
    assert.equal(savedComparisonCopy("en", value, 3, 0).explanation, null);
  }
  assert.equal(savedComparisonAvailable(chart()), true);
});
test("nonadjacent predecessor wording limits unmatched status and preserves the actual date", () => {
  for (const lang of ["es", "en"]) {
    const copy = savedComparisonCopy(lang, chart(), 2, 1);
    assert.ok(copy.explanation.includes("2026-01-01"));
    assert.ok(!copy.summary.toLowerCase().includes("debut"));
    assert.ok(copy.summary.includes(lang === "en" ? "available sample" : "muestra disponible"));
    assert.ok(!copy.row.toLowerCase().includes("debut"));
  }
});
