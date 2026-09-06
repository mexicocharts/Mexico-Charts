import assert from "node:assert/strict";
import test from "node:test";
process.env["NEON_DATABASE_URL"] ??= "postgresql://local-test.invalid/mexico_charts";
const { groupMonitoringCandidateIdentities, getMonitoringCandidateIdentity, getMonitoringCandidateDirectory,
  MONITORING_CANDIDATE_POPULATION_SQL } = await import("./monitoring-candidate-audit");
const { MONITORING_AUDIT_SOURCE_TABLES } = await import("./monitoring-audit-schema");
const sources = ["mexican_artist_identity_candidates", "artist_social_account_candidates", "youtube_music_artist_candidates"];
const postgresModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];

test("new registry leads preserve every older canonical representative without provider or alias authority", () => {
  const originals = [
    { artist_key: "existingartist", artist_name: null, spotify_id: "0000000000000000000301", source: "songstats_artist_extended_data" },
    { artist_key: "subscriptiononly", artist_name: null, spotify_id: null, source: "monitoring_subscriptions" },
    { artist_key: "accepted lookup", artist_name: "Accepted Name", spotify_id: null, source: "artist_candidates",
      discovery_status: "linked_existing_artist", matched_artist_key: "accepted artist", source_record_id: "fixture-accepted" },
  ];
  const baseline = groupMonitoringCandidateIdentities(originals);
  const leads = sources.flatMap(source => [
    { artist_key: "existing artist", artist_name: "Replacement Name", spotify_id: "0000000000000000000999", source, declared_aliases: ["unrelated target"] },
    { artist_key: "subscription only", artist_name: "Replacement Subscription Name", spotify_id: "0000000000000000000999", source },
    { artist_key: "accepted artist", artist_name: "Replacement Accepted Name", spotify_id: "0000000000000000000999", source },
    { artist_key: "independent key", artist_name: "Accepted Name", spotify_id: "0000000000000000000301", source },
  ]);
  const grouped = groupMonitoringCandidateIdentities([...originals, ...leads]);
  assert.equal(grouped.length, 4);
  for (const prior of baseline) {
    const current = grouped.find(value => value.artistKey === prior.artistKey)!;
    assert.ok(current);
    assert.equal(current.artistName, prior.artistName);
    assert.deepEqual(current.spotifyIds, prior.spotifyIds);
    assert.deepEqual(current.identityAliasEvidence, prior.identityAliasEvidence);
    assert.equal(current.identityConflict, prior.identityConflict);
  }
  const independent = grouped.find(value => value.artistKey === "independent key")!;
  assert.deepEqual(independent.spotifyIds, []);
  assert.deepEqual(independent.declaredAliases, []);
  assert.equal(independent.identityMappingStatus, "unverified");
  assert.ok(grouped.every(value => !value.matchKeys.includes("unrelated target")));
});

test("verified standalone registries enter private full and targeted SQL without exposing source details or granting access", { skip: !postgresModule }, async () => {
  const { PGlite } = await import(postgresModule!);
  const db = new PGlite();
  try {
    const database = await import("@workspace/db");
    const { is } = await import("drizzle-orm");
    const { getTableConfig, PgTable } = await import("drizzle-orm/pg-core");
    for (const value of Object.values(database)) {
      if (!is(value, PgTable)) continue;
      const config = getTableConfig(value as InstanceType<typeof PgTable>);
      if (!(MONITORING_AUDIT_SOURCE_TABLES as readonly string[]).includes(config.name)) continue;
      const columns = config.columns.map(column => `"${column.name}" ${column.getSQLType().replace(/^serial$/, "integer").replace(/^bigserial$/, "bigint")}`);
      await db.exec(`CREATE TABLE "${config.name}" (${columns.join(", ")})`);
    }
    await db.exec("CREATE TABLE youtube_channel_upload_import_state (artist_key text, channel_id text, status text, completed_at timestamptz, next_page_token text, videos_imported integer, expected_total_videos integer)");
    await db.exec(`INSERT INTO spotify_artists(artist_key,spotify_name,spotify_artist_id,verified) VALUES
      ('existing artist','Existing Name','0000000000000000000301',true);
      INSERT INTO mexican_artist_identity_candidates(normalized_name,artist_name,status,aliases,evidence) VALUES
      ('mexicanonly','Independent Mexican','verified','["Existing Name"]','{"private_note":"not_population_data"}'),
      ('existingartist','Replacement Name','verified','[]','{}'),
      ('reviewonly','Review Only','review','[]','{}'),('rejectedonly','Rejected Only','rejected','[]','{}'),
      ('x東京','Exact Unicode','verified','[]','{}');
      INSERT INTO artist_social_account_candidates(artist_key,platform,canonical_url,status,confidence,verified_at,evidence_sources) VALUES
      ('social only','instagram','https://example.invalid/private-instagram','verified',95,now(),'["private-evidence"]'),
      ('social only','tiktok','https://example.invalid/private-tiktok','verified',95,now(),'["private-evidence"]'),
      ('existing artist','instagram','https://example.invalid/approved-existing','verified',95,now(),'[]'),
      ('review only','instagram','https://example.invalid/review','review',95,now(),'[]'),
      ('rejected only','instagram','https://example.invalid/rejected','rejected',95,now(),'[]');
      INSERT INTO youtube_music_artist_candidates(artist_key,artist_name,browse_id,status,evidence) VALUES
      ('youtube only','Independent YouTube','private-browse-one','verified','{"private_note":"not_population_data"}'),
      ('youtube only','Independent YouTube','private-browse-two','verified','{}'),
      ('existing artist','Replacement YouTube Name','private-browse-three','verified','{}'),
      ('review-only','Review Only','private-browse-review','review','{}'),
      ('rejected-only','Rejected Only','private-browse-rejected','rejected','{}')`);
    const raw = (await db.query(MONITORING_CANDIDATE_POPULATION_SQL)).rows;
    const registryRows = raw.filter((row: { source: string }) => sources.includes(row.source));
    assert.equal(registryRows.length, 7, "repeated social accounts and YouTube browse mappings collapse at artist projection");
    for (const row of registryRows) {
      assert.deepEqual(Object.keys(row).sort(), ["artist_key", "artist_name", "source", "spotify_id"]);
      assert.equal(row.spotify_id, null);
    }
    assert.ok(!JSON.stringify(raw).includes("private-"));
    assert.ok(!JSON.stringify(raw).includes("not_population_data"));
    assert.ok(!raw.some((row: { artist_key: string }) => /review|rejected/.test(row.artist_key)));
    const population = groupMonitoringCandidateIdentities(raw);
    assert.equal(population.length, 5);
    assert.equal(population.find(value => value.artistKey === "existing artist")?.artistName, "Existing Name");
    const readPool = { connect: async () => ({ query: async (input: { text: string; values: unknown[] }) => db.query(input.text, input.values), release() {} }) };
    for (const [requested, expected] of [
      ["mexican only", "mexicanonly"], ["mexican-only", "mexicanonly"], ["mexicanonly", "mexicanonly"],
      ["socialonly", "social only"], ["social-only", "social only"], ["social only", "social only"],
      ["youtubeonly", "youtube only"], ["youtube-only", "youtube only"], ["youtube only", "youtube only"],
      ["X東京", "x東京"],
    ]) assert.equal((await getMonitoringCandidateIdentity(requested!, readPool as never))?.artistKey, expected);
    for (const key of ["reviewonly", "review only", "review-only", "rejectedonly", "rejected only", "rejected-only", "x", "Existing Name"]) {
      assert.equal(await getMonitoringCandidateIdentity(key, readPool as never), null, key);
    }
    const registryKeys = population.map(artist => artist.artistKey);
    const page = await getMonitoringCandidateDirectory({ artistKeys: registryKeys }, { readPool: readPool as never, now: new Date("2026-08-10T12:00:00Z") });
    assert.equal(page.databasePopulationComplete, true);
    assert.equal(page.populationComplete, false, "live external rosters remain a separate uninspected scope");
    assert.equal(page.total, 5);
    for (const key of ["mexicanonly", "social only", "youtube only", "x東京"]) {
      const candidate = page.artists.find(value => value.artistKey === key)!;
      assert.ok(candidate);
      assert.equal(candidate.publicEligible, false);
      assert.equal(candidate.auditStatus, "incomplete");
      assert.ok(candidate.readinessReasons.includes("identity_source_mapping_unverified"));
    }
    const { authorizeMonitoringArtist } = await import("./monitoring-authorization");
    for (const requestedArtistKey of ["mexican-only", "social-only", "youtube-only"]) {
      const findExistingArtist = async (key: string) => {
        const identity = await getMonitoringCandidateIdentity(key, readPool as never);
        return identity ? { artist_key: identity.artistKey, artist_name: identity.artistName, status: "internal", created_at: null,
          match_keys: identity.matchKeys, identity_conflict: identity.identityConflict } : null;
      };
      const founder = await authorizeMonitoringArtist({ userId: "founder", requestedArtistKey, internalUserIds: "founder",
        findActiveSubscription: async () => null, findExistingArtist });
      assert.equal(founder.allowed, true);
      assert.equal(founder.source, "internal");
      for (const userId of [null, "free-user"]) {
        let lookedUp = false;
        const denied = await authorizeMonitoringArtist({ userId, requestedArtistKey, internalUserIds: "founder",
          findActiveSubscription: async () => null, findExistingArtist: async () => { lookedUp = true; return null; } });
        assert.equal(denied.allowed, false);
        assert.equal(lookedUp, false);
      }
    }
    for (const source of sources) await db.exec(`DROP TABLE ${source}`);
    assert.equal(await getMonitoringCandidateIdentity("mexican-only", readPool as never), null);
    assert.equal(await getMonitoringCandidateIdentity("social-only", readPool as never), null);
    assert.equal(await getMonitoringCandidateIdentity("youtube-only", readPool as never), null);
    const partial = await getMonitoringCandidateDirectory({ artistKeys: registryKeys }, { readPool: readPool as never, now: new Date("2026-08-10T12:00:00Z") });
    assert.equal(partial.populationComplete, false);
    assert.deepEqual(partial.missingSchemaTables, [...sources].sort());
    assert.equal(partial.total, 1);
    assert.equal(partial.artists[0]?.artistKey, "existing artist");
  } finally { await db.close(); }
});
