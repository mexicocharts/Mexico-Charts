import assert from "node:assert/strict";
import test from "node:test";
import { filterFounderRoster, verifiedFounderRosterIds, FOUNDER_ROSTER_SQL, FOUNDER_ROSTER_MONTH, FOUNDER_ROSTER_SCOPE } from "./monitoring-founder-roster";
import { groupMonitoringCandidateIdentities } from "./monitoring-candidate-policy";

test("fixed membership uses September evidence, fails closed on missing, changed or duplicate IDs", () => {
  assert.equal(FOUNDER_ROSTER_MONTH, "2026-09");
  assert.match(FOUNDER_ROSTER_SQL, /billing_month = \$1/);
  assert.doesNotMatch(FOUNDER_ROSTER_SQL, /current_date|now\(|LIMIT|INSERT|UPDATE|DELETE/i);
  assert.throws(() => verifiedFounderRosterIds([]), /unavailable or changed/);
  assert.throws(() => verifiedFounderRosterIds(Array.from({ length: 529 }, () => ({ spotify_id: "12GqGscKJx3aE4t07u7eVZ" }))), /unavailable or changed/);
  assert.equal(FOUNDER_ROSTER_SCOPE.includedSpotifyIds, 528);
  assert.equal(FOUNDER_ROSTER_SCOPE.membershipGrantsEligibility, false);
});

test("roster filters by exact provider identity, preserving aliases and excluding discoveries/Bad Bunny", () => {
  const peso = "12GqGscKJx3aE4t07u7eVZ", luis = "2nszmSgqreHSdJA3zWPyrW";
  const rows = [
    ["peso pluma", "Peso Pluma", peso], ["pesopluma", "Peso Pluma", peso],
    ["luismiguel", "Luis Miguel", luis], ["discovery", "Discovery", "0000000000000000000000"],
    ["badbunny", "Bad Bunny", "4q3ewBCX7sLwd24euuV69X"],
    ["unmapped", "Unmapped", null],
  ].map(([artist_key, artist_name, spotify_id]) => ({ artist_key: artist_key!, artist_name, spotify_id, source: "songstats_artists" }));
  const population = groupMonitoringCandidateIdentities(rows);
  const selected = filterFounderRoster(population, new Set([peso, luis]));
  assert.equal(selected.length, 2);
  assert.equal(selected.find(row => row.spotifyIds.includes(peso))!.sourceKeys.length, 2);
  assert.deepEqual(selected, population.filter(row => row.spotifyIds.some(id => id === peso || id === luis)));
  assert.throws(() => filterFounderRoster(population, new Set([peso, "missing"])), /mapping incomplete/);
  assert.throws(() => filterFounderRoster(population, new Set(["4q3ewBCX7sLwd24euuV69X"])), /mapping incomplete/);
});

test("two distinct stored Spotify identities are retained pending provider-mapping review", () => {
  const ids = ["2Lxa3SFNEW0alfRvtdXOul", "6cnl6Jz97730GUS8zEAK77"];
  const groups = groupMonitoringCandidateIdentities(ids.map((spotify_id, i) => ({
    artist_key: `separate-key-${i}`, artist_name: "Los Plebes del Rancho de Ariel Camacho", spotify_id, source: "songstats_artists",
  })));
  assert.equal(filterFounderRoster(groups, new Set(ids)).length, 2);
  assert.equal(FOUNDER_ROSTER_SCOPE.identityReviewPending, true);
});
