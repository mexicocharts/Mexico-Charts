import assert from "node:assert/strict";
import test from "node:test";
import { founderRosterCatalogInspection, loadMonitoringPriorityArtistIdentity, type MonitoringPriorityIdentity } from "./monitoring-priority-identity";

const rosterId = "0000000000000000000001";
const alternateId = "0000000000000000000002";
const allowed = new Set([rosterId]);
function fixture(): MonitoringPriorityIdentity {
  return { avatar_url: null, avatar_source: null, avatar_source_artist_key: null,
    spotify_artist_id: null, identity_conflict: true, malformed_provider_ids: [],
    provider_sources: ["kworb_coverage", "songstats_artists", "songstats_artist_extended_data", "spotify_artists"].map(source => ({
      source, artist_key: "artist", spotify_artist_id: source === "spotify_artists" ? alternateId : rosterId, fetched_at: null,
    })) };
}
test("founder inspection preserves conflict and all original source assertions", () => {
  const identity = fixture(); const before = structuredClone(identity);
  assert.equal(founderRosterCatalogInspection(identity, "artist", allowed)?.spotifyArtistId, rosterId);
  assert.deepEqual(identity, before);
  assert.equal(identity.spotify_artist_id, null);
  assert.equal(identity.identity_conflict, true);
});
test("two roster IDs are never resolved by inspection", () => {
  assert.equal(founderRosterCatalogInspection(fixture(), "artist", new Set([rosterId, alternateId])), undefined);
  assert.equal(founderRosterCatalogInspection(fixture(), "artist", new Set()), undefined);
});
test("source disagreement, mixed keys, malformed IDs and missing corroboration fail closed", () => {
  for (const mutate of [
    (x: MonitoringPriorityIdentity) => { x.provider_sources[2]!.spotify_artist_id = alternateId; },
    (x: MonitoringPriorityIdentity) => { x.provider_sources[0]!.artist_key = "other"; },
    (x: MonitoringPriorityIdentity) => { x.malformed_provider_ids = ["bad"]; },
    (x: MonitoringPriorityIdentity) => { x.provider_sources[3]!.spotify_artist_id = "bad"; },
    (x: MonitoringPriorityIdentity) => { x.provider_sources = x.provider_sources.filter(s => s.source !== "kworb_coverage"); },
    (x: MonitoringPriorityIdentity) => { x.provider_sources = x.provider_sources.filter(s => s.source !== "songstats_artists"); },
  ]) { const identity = fixture(); mutate(identity); assert.equal(founderRosterCatalogInspection(identity, "artist", allowed), undefined); }
});
test("ordinary identity loading never opts into founder inspection", async () => {
  let queries = 0;
  const pool = { query: async () => { queries++; return { rows: [fixture()] }; } };
  const [identity] = await loadMonitoringPriorityArtistIdentity(pool as never, ["artist"]);
  assert.equal(queries, 1); assert.equal(identity?.roster_catalog_inspection, undefined);
  assert.equal(identity?.spotify_artist_id, null);
});
test("explicit inspection refuses an unverifiable reference roster", async () => {
  let queries = 0;
  const pool = { query: async () => ({ rows: ++queries === 1 ? [fixture()] : [{ spotify_id: rosterId }] }) };
  await assert.rejects(loadMonitoringPriorityArtistIdentity(pool as never, ["artist"], { allowRosterScopedCatalogInspection: true }), /reference roster unavailable or changed/);
});
