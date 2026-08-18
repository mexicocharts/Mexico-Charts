import assert from "node:assert/strict";
import test from "node:test";
import {
  matchedMexicanArtists,
  normalizeChartArtistCredit,
  normalizeChartArtistName,
} from "./mexican-chart-credit-matching";

test("matches accents and official connector variants", () => {
  const verified = new Set([
    normalizeChartArtistName("Julión Álvarez y Su Norteño Banda"),
    normalizeChartArtistCredit("Julión Álvarez y Su Norteño Banda"),
    normalizeChartArtistCredit("La Arrolladora Banda El Limón"),
  ]);
  assert.deepEqual(matchedMexicanArtists("Julion Alvarez & Su Norteño Banda", verified), ["Julion Alvarez & Su Norteño Banda"]);
  assert.deepEqual(matchedMexicanArtists("La Arrolladora Banda El Limón de René Camacho", verified), ["La Arrolladora Banda El Limón de René Camacho"]);
});

test("includes a verified Mexican collaborator without promoting the other credit", () => {
  const verified = new Set([normalizeChartArtistName("Peso Pluma")]);
  assert.deepEqual(matchedMexicanArtists("Non-Mexican Artist feat. Peso Pluma", verified), ["Peso Pluma"]);
});

test("does not guess an unverified artist from a Mexican chart appearance", () => {
  assert.deepEqual(matchedMexicanArtists("Unknown Artist", new Set()), []);
});
