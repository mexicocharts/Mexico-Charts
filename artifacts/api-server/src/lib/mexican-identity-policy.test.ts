import assert from "node:assert/strict";
import test from "node:test";
import { decideMexicanIdentity, normalizeArtistIdentity } from "./mexican-identity-policy";

test("normalizes accents and punctuation without guessing aliases", () => {
  assert.equal(normalizeArtistIdentity("Julión Álvarez"), "julionalvarez");
  assert.notEqual(normalizeArtistIdentity("Grupo Firme"), normalizeArtistIdentity("Firme"));
});

test("auto-verifies an exact existing registry identity", () => {
  assert.equal(decideMexicanIdentity([{
    source: "existing_verified_registry", url: "registry://mexico-charts", supportsMexico: true,
    exactName: true, detail: "exact normalized name",
  }]).status, "verified");
});

test("requires two independent sources for a newly discovered identity", () => {
  const musicbrainz = { source: "musicbrainz" as const, url: "https://musicbrainz.org/artist/a", supportsMexico: true, exactName: true, detail: "country MX" };
  assert.equal(decideMexicanIdentity([musicbrainz]).status, "review");
  assert.equal(decideMexicanIdentity([musicbrainz, {
    source: "wikidata", url: "https://www.wikidata.org/wiki/Q1", supportsMexico: true,
    exactName: true, sameIdentityConfirmed: true, detail: "country of citizenship Mexico; linked by MusicBrainz",
  }]).status, "verified");
});

test("never verifies fuzzy or unsupported matches", () => {
  assert.equal(decideMexicanIdentity([{
    source: "wikidata", url: "https://www.wikidata.org/wiki/Q2", supportsMexico: true,
    exactName: false, detail: "fuzzy search result",
  }]).status, "review");
});

test("does not auto-verify an unlinked same-name Wikidata result", () => {
  assert.equal(decideMexicanIdentity([
    { source: "musicbrainz", url: "https://musicbrainz.org/artist/a", supportsMexico: true, exactName: true, detail: "country MX" },
    { source: "wikidata", url: "https://www.wikidata.org/wiki/Q3", supportsMexico: true, exactName: true, sameIdentityConfirmed: false, detail: "same label only" },
  ]).status, "review");
});
