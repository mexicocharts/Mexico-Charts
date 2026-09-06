import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildMonitoringBundledRosterRows, getMonitoringBundledRosterRows,
  MONITORING_BUNDLED_ROSTER_SOURCE_INVENTORY, MONITORING_BUNDLED_ROSTER_SOURCE_PATHS } from "./monitoring-bundled-roster";
import { groupMonitoringCandidateIdentities } from "./monitoring-candidate-policy";

test("bundled inventory uses actual routable source identities and explicit supplemental keys without provider data", async () => {
  const { canonicalArtistCatalog, resolveCanonicalArtist } = await import("../../../mexico-charts/src/lib/artistRoutes.mjs");
  const rows = getMonitoringBundledRosterRows();
  assert.equal(rows.length, 602);
  assert.equal(rows.filter(row => row.source === "artist_profile_routes").length, canonicalArtistCatalog.length);
  assert.deepEqual(MONITORING_BUNDLED_ROSTER_SOURCE_INVENTORY.map(source => source.rowCount), [563, 39]);
  for (const path of MONITORING_BUNDLED_ROSTER_SOURCE_PATHS) assert.ok(readFileSync(resolve(path)).length > 0);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ["artist_key", "artist_name", "source", "spotify_id"]);
    assert.equal(row.spotify_id, null);
    if (row.source === "artist_profile_routes") assert.equal(resolveCanonicalArtist(`/artist/${row.artist_key}`)?.path, `/artist/${row.artist_key}`);
  }
  assert.ok(rows.some(row => row.artist_key === "jesse--joy"), "preserve the actual route slug, including its existing double hyphen");
  assert.ok(rows.some(row => row.source === "supplemental_artist_data" && row.artist_key === "gaelvalenzuela"));
  const identities = groupMonitoringCandidateIdentities(rows);
  assert.equal(identities.length, 563, "every distinct public route remains a separate candidate");
  assert.ok(identities.every(identity => identity.spotifyIds.length === 0 && identity.identityMappingStatus === "unverified"));
  rows[0]!.artist_key = "mutated";
  assert.notEqual(getMonitoringBundledRosterRows()[0]!.artist_key, "mutated");
  assert.throws(() => buildMonitoringBundledRosterRows([{ path: "/artist/../escape", name: "Invalid" }], []));
});

test("roster inspection leads preserve prior representatives and cannot forge provider, name or Unicode alias edges", () => {
  const originals = [
    { artist_key: "a b", artist_name: null, spotify_id: "0000000000000000000901", source: "spotify_artists" },
    { artist_key: "x", artist_name: "Existing X", spotify_id: null, source: "official_artists" },
    { artist_key: "catalog only", artist_name: null, spotify_id: null, source: "youtube_music_artist_candidates" },
  ];
  const roster = buildMonitoringBundledRosterRows([
    { path: "/artist/a-b", name: "Replacement Name" },
    { path: "/artist/independent", name: "Existing X" },
    { path: "/artist/catalog-only", name: "Replacement Catalog" },
  ], [{ artistKey: "X東京", artistName: "Existing X" }, { artistKey: "東京", artistName: "Tokyo" }, { artistKey: "北京", artistName: "Beijing" }]);
  const prior = groupMonitoringCandidateIdentities(originals);
  for (const input of [[...originals, ...roster], [...roster, ...originals]]) {
    const result = groupMonitoringCandidateIdentities(input.map(row => row.source === "supplemental_artist_data" || row.source === "artist_profile_routes"
      ? { ...row, spotify_id: "0000000000000000000901", declared_aliases: ["x"] } : row));
    assert.equal(result.length, 7);
    for (const before of prior) {
      const after = result.find(artist => artist.artistKey === before.artistKey)!;
      assert.ok(after);
      assert.equal(after.artistName, before.artistName);
      assert.deepEqual(after.spotifyIds, before.spotifyIds);
    }
    for (const key of ["independent", "X東京", "東京", "北京"]) {
      const candidate = result.find(artist => artist.sourceKeys.includes(key))!;
      assert.equal(candidate.identityMappingStatus, "unverified");
      assert.deepEqual(candidate.declaredAliases, []);
      assert.ok(!candidate.matchKeys.includes("x"));
    }
  }
});

const postgresModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
test("real PostgreSQL empty sources still resolve exact bundled profiles for founders with strict scoped auth and honest population coverage", { skip: !postgresModule }, async () => {
  process.env["NEON_DATABASE_URL"] ??= "postgresql://local-test.invalid/mexico_charts";
  const { PGlite } = await import(postgresModule!);
  const db = new PGlite();
  const previousFetch = globalThis.fetch;
  let networkAttempts = 0;
  globalThis.fetch = (() => { networkAttempts++; throw new Error("No network is allowed for bundled identity resolution"); }) as typeof fetch;
  try {
    const { loadMonitoringCandidatePopulation, getMonitoringCandidateIdentity, getMonitoringCandidateDirectory } = await import("./monitoring-candidate-audit");
    const { authorizeMonitoringArtist } = await import("./monitoring-authorization");
    const calls: string[] = [];
    const readPool = { connect: async () => ({ query: async (input: { text: string; values: unknown[] }) => {
      calls.push(input.text);
      assert.match(input.text, /^\s*(SELECT|WITH)\b/i);
      return db.query(input.text, input.values);
    }, release() {} }) };
    const population = await loadMonitoringCandidatePopulation(readPool as never);
    assert.equal(population.length, 563);
    for (const requested of ["gera-mx", "geramx", "gera mx"]) {
      const artist = await getMonitoringCandidateIdentity(requested, readPool as never);
      assert.equal(artist?.artistKey, "gera-mx");
      assert.deepEqual(artist?.candidateSources, ["artist_profile_routes", "supplemental_artist_data"]);
      assert.deepEqual(artist?.spotifyIds, []);
    }
    for (const key of ["unknown-local-roster-person", "Gera MX 東京", "東京"]) assert.equal(await getMonitoringCandidateIdentity(key, readPool as never), null);
    const findExistingArtist = async (key: string) => {
      const identity = await getMonitoringCandidateIdentity(key, readPool as never);
      return identity ? { artist_key: identity.artistKey, artist_name: identity.artistName, status: "internal", created_at: null,
        match_keys: identity.matchKeys, identity_conflict: identity.identityConflict } : null;
    };
    const founder = await authorizeMonitoringArtist({ userId: "founder", internalUserIds: "founder", requestedArtistKey: "gera-mx",
      findActiveSubscription: async () => { throw new Error("Founder does not need a paid grant"); }, findExistingArtist });
    assert.equal(founder.allowed, true);
    assert.equal(founder.source, "internal");
    for (const userId of [null, "free-user", "unsubscribed-viewer"]) {
      const before = calls.length;
      const decision = await authorizeMonitoringArtist({ userId, internalUserIds: "founder", requestedArtistKey: "gera-mx",
        findActiveSubscription: async () => null, findExistingArtist });
      assert.equal(decision.allowed, false);
      assert.equal(calls.length, before, "denied viewers never inspect roster or source rows");
    }
    const paid = await authorizeMonitoringArtist({ userId: "subscriber", internalUserIds: "founder", requestedArtistKey: "gera-mx",
      findActiveSubscription: async () => ({ artist_key: "gera mx", artist_name: "Stored Grant Name", status: "active", created_at: null }), findExistingArtist });
    assert.equal(paid.allowed, true);
    assert.equal(paid.grant?.artist_name, "Stored Grant Name");
    assert.ok(!paid.grant?.match_keys?.includes("caifanes"));
    const directory = await getMonitoringCandidateDirectory({ artistKeys: ["gera-mx"] }, { readPool: readPool as never, now: new Date("2026-09-06T12:00:00Z") });
    assert.equal(directory.total, 1);
    assert.equal(directory.populationComplete, false);
    assert.equal(directory.databasePopulationComplete, false);
    assert.equal(directory.populationScope, "database_and_bundled_rosters");
    assert.deepEqual(directory.populationLimitations, ["external_artist_metadata_active_uninspected", "external_mexican_artist_master_uninspected"]);
    assert.equal(directory.artists[0]?.publicEligible, false);
    assert.equal(directory.artists[0]?.classification, null);
    assert.equal(networkAttempts, 0);
    // The same known source key wins as soon as it exists in an older registry.
    await db.exec("CREATE TABLE official_artists (artist_key text,artist_name text); INSERT INTO official_artists VALUES ('gera mx','Established Source Name')");
    const existing = await getMonitoringCandidateIdentity("gera-mx", readPool as never);
    assert.equal(existing?.artistKey, "gera mx");
    assert.equal(existing?.artistName, "Established Source Name");
    assert.deepEqual(existing?.spotifyIds, []);
  } finally { globalThis.fetch = previousFetch; await db.close(); }
});
