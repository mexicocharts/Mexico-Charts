import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
process.env["NEON_DATABASE_URL"] ??= "postgresql://local-test.invalid/mexico_charts";
const { evaluateMonitoringCandidate, groupMonitoringCandidateIdentities, getMonitoringCandidateDirectory, getMonitoringCandidateIdentity, MONITORING_CANDIDATE_EVIDENCE_SQL, MONITORING_CANDIDATE_POPULATION_SQL } = await import("./monitoring-candidate-audit");
const { MONITORING_AUDIT_SOURCE_TABLES, withUnavailableMonitoringSources } = await import("./monitoring-audit-schema");
const { buildMonitoringCompactReadinessSql } = await import("./monitoring-compact-readiness");

function fixture() {
  const artist = groupMonitoringCandidateIdentities([{ artist_key: "example artist", artist_name: "Example Artist", spotify_id: "spotify-1", source: "kworb_coverage" }])[0]!;
  const points = (field: string) => Array.from({ length: 101 }, (_, day) => ({ date: new Date(Date.UTC(2026, 4, 1 + day)).toISOString().slice(0, 10), [field]: 100_000 + 100 * day }));
  const extended = {
    historic_stats: { stats: [{ source: "spotify", data: { history: points("monthly_listeners_current") } }, { source: "youtube", data: { history: points("subscribers_total") } },
      { source: "instagram", data: { history: points("followers_total") } }, { source: "tiktok", data: { history: points("followers_total") } }] },
    audience: { source: "spotify" },
    audience_details: { sources: { spotify: { audience: [{ source: "spotify", data: { monthly_listeners: [{ city_name: "Ciudad de México", country_code: "MX", current_listeners: 100_000 }] } }] } } },
    catalog: { tracks: [{ name: "Track One", artwork_url: "https://example.com/track.jpg" }], albums: [{ name: "Album One", artwork_url: "https://example.com/album.jpg" }] },
  };
  const snapshot = { snapshot_date: "2026-08-10", spotify_monthly_listeners: 200_000, spotify_followers: 300_000, youtube_subscribers: 100_000, youtube_channel_views: 300_000, instagram_followers: 100_000, tiktok_followers: 100_000 };
  const summary = { snapshot_date: "2026-08-10", track_count: 1, album_count: 1, track_daily_streams: 100, track_total_streams: 10_000, album_total_streams: 20_000 };
  const row = {
    artist_key: artist.artistKey, extended: [extended], snapshot, summary, raw_summary: summary,
    legacy: [{ coverage: { spotify_id: "spotify-1" }, extended, snapshot, summary }],
    source_evidence: { artistImage: true, catalog: { tracks: 1, albums: 1, tracksWithArtwork: 1, albumsWithArtwork: 1 },
      liveCatalogInvestigation: { status: "reviewed", source: "kworb_live_complete_catalog", reference: "fixture:reviewed-live-catalog",
        observedAt: "2026-08-10T11:00:00Z", spotifyArtistId: "spotify-1", catalogEvidenceApplied: true, artworkEvidenceApplied: true },
      currentHistory: { days: 20, previousDate: "2026-08-09", lastDate: "2026-08-10" },
      catalogCompleteness: { verified: true, reference: "fixture:full-provider-catalog", expectedTracks: 1, expectedAlbums: 1 },
      spotifyHistory: { days: 20 }, streamHistory: { days: 20 }, youtube: { approvedVideos: 2, observedVideos: 2, videosWithArtwork: 2 },
      youtubeImport: [{ status: "complete", completedAt: "2026-08-10", nextPageTokenPresent: false, expectedVideos: 2 }],
      youtubeObservations: [{ videoId: "one", observedAt: "2026-08-10T11:00:00Z", delta: 0, secondsSincePrevious: 300 }, { videoId: "two", observedAt: "2026-08-10T11:00:00Z", delta: 1, secondsSincePrevious: 300 }],
      youtubeHistory: { days: 20, videos: 2, videosWithHistory: 2 }, comparisonPeers: 1 },
  };
  return { artist, row, now: new Date("2026-08-10T12:00:00Z") };
}

test("population includes source-only and no-Spotify artists while aliases and provider IDs are deterministic", () => {
  const rows = [
    { artist_key: "Banda El Recodo de Cruz Lizárraga", artist_name: "Banda El Recodo", spotify_id: null, source: "official_artists" },
    { artist_key: "bandaelrecodo", artist_name: null, spotify_id: "one", source: "songstats_artist_daily_snapshots" },
    { artist_key: "recodo-provider-key", artist_name: null, spotify_id: "one", source: "songstats_artist_extended_data" },
    { artist_key: "only raw streams", artist_name: null, spotify_id: null, source: "monitoring_stream_daily_snapshots" },
  ];
  const result = groupMonitoringCandidateIdentities(rows);
  assert.equal(result.length, 2);
  assert.equal(result.find(row => row.artistName === "Banda El Recodo")?.sourceKeys.length, 3);
  assert.ok(result.some(row => row.artistKey === "only raw streams"));
});

test("accepted entity aliases connect short names to existing histories without fuzzy prefix joins", () => {
  const rows = [
    { artist_key: "banda ms", artist_name: "Banda MS", spotify_id: null, source: "official_artists" },
    { artist_key: "bandamsdesergiolizarraga", artist_name: null, spotify_id: "fixture-ms-provider", source: "songstats_history_provider_identities" },
    { artist_key: "banda ms", artist_name: "Banda MS de Sergio Lizárraga", spotify_id: null, source: "musicbrainz_artists",
      declared_aliases: ["Banda MS", "MS accepted alias only"], mbid: "fixture-ms-mbid", verified: "manual_review_accepted" },
    { artist_key: "banda m", artist_name: "Banda M", spotify_id: null, source: "official_artists" },
    { artist_key: "unreviewed group", artist_name: null, spotify_id: null, source: "musicbrainz_artist_candidates",
      declared_aliases: ["Banda MS"], mbid: "unreviewed-mbid", verified: "needs_review" },
  ];
  const groups = groupMonitoringCandidateIdentities(rows);
  assert.equal(groups.length, 3);
  const ms = groups.find(row => row.artistKey === "banda ms")!;
  assert.deepEqual(ms.sourceKeys, ["banda ms", "bandamsdesergiolizarraga"]);
  assert.ok(ms.declaredAliases.includes("MS accepted alias only"));
  assert.ok(!ms.sourceKeys.includes("MS accepted alias only"));
  assert.equal(ms.identityMappingStatus, "provider_id");
  assert.equal(ms.identityAliasEvidence[0]?.mbid, "fixture-ms-mbid");
  assert.equal(groups.find(row => row.artistKey === "banda m")?.identityMappingStatus, "unverified");
  const conflict = groupMonitoringCandidateIdentities([...rows, {
    artist_key: "different accepted entity", artist_name: "Different Entity", spotify_id: null, source: "musicbrainz_artists",
    declared_aliases: ["Banda MS"], mbid: "different-mbid", verified: "auto",
  }]).find(row => row.artistKey === "banda ms")!;
  assert.equal(conflict.identityConflict, true);
  assert.equal(conflict.identityMappingStatus, "conflict");
});

test("distinct non-Latin and mixed-script aliases never merge through stripped characters", () => {
  const rows = [
    { artist_key: "artist alpha", artist_name: "Artist Alpha", spotify_id: null, source: "musicbrainz_artists",
      mbid: "alpha-mbid", verified: "auto", declared_aliases: ["阿尔法", "X東京"] },
    { artist_key: "artist beta", artist_name: "Artist Beta", spotify_id: null, source: "musicbrainz_artists",
      mbid: "beta-mbid", verified: "auto", declared_aliases: ["ベータ", "X大阪"] },
    { artist_key: "阿尔法", artist_name: null, spotify_id: null, source: "monitoring_stream_items" },
    { artist_key: "x", artist_name: "X", spotify_id: null, source: "official_artists" },
    { artist_key: "unrelated", artist_name: null, spotify_id: null, source: "musicbrainz_artists",
      mbid: "unrelated-mbid", verified: "auto", declared_aliases: ["???"] },
  ];
  const groups = groupMonitoringCandidateIdentities(rows);
  assert.equal(groups.length, 4);
  assert.ok(groups.every(group => !group.identityConflict));
  assert.deepEqual(groups.find(group => group.artistKey === "artist alpha")?.sourceKeys, ["artist alpha", "阿尔法"]);
  assert.deepEqual(groups.find(group => group.artistKey === "artist beta")?.sourceKeys, ["artist beta"]);
  assert.deepEqual(groups.find(group => group.artistKey === "x")?.sourceKeys, ["x"]);
  assert.ok(groups.every(group => !group.matchKeys.includes("")));
});

test("accepted discovery relationships connect stored sources while pending proposals remain separate", () => {
  const sources = [
    { artist_key: "banda ms", artist_name: "Banda MS", spotify_id: null, source: "official_artists" },
    { artist_key: "bandamsdesergiolizarraga", artist_name: null, spotify_id: "ms-provider", source: "songstats_history_provider_identities" },
    { artist_key: "bandamsdiscovered", artist_name: "Banda MS", spotify_id: null, source: "artist_candidates", source_record_id: "100",
      discovery_status: "linked_existing_artist", matched_artist_key: "banda ms de sergio lizarraga" },
    { artist_key: "unrelated pending", artist_name: "Unrelated Pending", spotify_id: "ms-provider", source: "artist_candidates", source_record_id: "101",
      discovery_status: "pending", matched_artist_key: "banda ms de sergio lizarraga" },
    { artist_key: "unrelated spotify proposal", artist_name: "Other", spotify_id: "ms-provider", source: "spotify_artist_candidates", discovery_status: "review" },
  ];
  const groups = groupMonitoringCandidateIdentities(sources);
  assert.equal(groups.length, 3);
  const ms = groups.find(group => group.artistKey === "banda ms")!;
  assert.deepEqual(ms.sourceKeys, ["banda ms", "bandamsdesergiolizarraga"]);
  assert.ok(ms.declaredAliases.includes("bandamsdiscovered"));
  assert.equal(ms.identityAliasEvidence.find(row => row.source === "artist_candidates")?.candidateId, "100");
  assert.equal(ms.candidateRecords[0]?.status, "linked_existing_artist");
  assert.equal(ms.identityConflict, false);
  const pending = groups.find(group => group.artistKey === "unrelated pending")!;
  assert.deepEqual(pending.sourceKeys, [], "discovery names are not claimed as stored serving artist keys");
  assert.deepEqual(pending.spotifyIds, []);
  assert.ok(!pending.matchKeys.includes("banda ms de sergio lizarraga"));
  assert.equal(pending.identityMappingStatus, "unverified");
  const conflict = groupMonitoringCandidateIdentities([...sources, { artist_key: "contradictory discovery", artist_name: "Banda MS", spotify_id: null,
    source: "artist_candidates", discovery_status: "approved", matched_artist_key: "different target" }]).find(group => group.artistKey === "banda ms")!;
  assert.equal(conflict.identityConflict, true);
});

test("unmatched source keys cannot be classified as absent artist data", () => {
  const { row, now } = fixture();
  const artist = groupMonitoringCandidateIdentities([{ artist_key: "unmatched short name", artist_name: null, spotify_id: null, source: "official_artists" }])[0]!;
  const result = evaluateMonitoringCandidate(artist, { ...row, snapshot: null, extended: null, summary: null, raw_summary: null, source_evidence: {} }, now);
  assert.equal(result.classification, null);
  assert.equal(result.auditStatus, "incomplete");
  assert.ok(result.findings.some(finding => finding.code === "identity_source_mapping_unverified"));
});

test("A requires the complete approved surfaces in addition to legacy readiness", () => {
  const { artist, row, now } = fixture();
  const complete = evaluateMonitoringCandidate(artist, row, now);
  assert.equal(complete.legacyPublicEligible, true);
  assert.equal(complete.classification, "A");
  row.source_evidence.catalog.albumsWithArtwork = 0;
  const incomplete = evaluateMonitoringCandidate(artist, row, now);
  assert.equal(incomplete.legacyPublicEligible, true);
  assert.equal(incomplete.publicEligible, false);
  assert.equal(incomplete.classification, "C");
  assert.ok(incomplete.findings.some(finding => finding.code === "missing_album_artwork"));
});

test("stored catalog and artwork gaps stay unknown until the integrated live fallback is investigated", () => {
  const { artist, row, now } = fixture();
  const emptySummary = { ...row.summary, track_count: 0, album_count: 0, track_daily_streams: 0, track_total_streams: 0, album_total_streams: 0 };
  const storedGap = { ...row, summary: emptySummary, raw_summary: emptySummary, legacy: [{ ...row.legacy[0]!, summary: emptySummary }],
    source_evidence: { ...row.source_evidence, liveCatalogInvestigation: null,
      catalog: { tracks: 0, albums: 0, tracksWithArtwork: 0, albumsWithArtwork: 0 } } };
  const result = evaluateMonitoringCandidate(artist, storedGap, now);
  assert.equal(result.classification, null);
  assert.equal(result.auditStatus, "incomplete");
  assert.ok(result.findings.some(finding => finding.code === "live_catalog_fallback_uninvestigated"));
  assert.ok(result.findings.every(finding => finding.status !== "blocked"));
  const independentHistoryGap = evaluateMonitoringCandidate(artist, { ...storedGap,
    source_evidence: { ...storedGap.source_evidence, spotifyHistory: { days: 0 } } }, now);
  assert.equal(independentHistoryGap.classification, "C");
  assert.equal(independentHistoryGap.auditStatus, "incomplete");
  assert.ok(independentHistoryGap.findings.some(finding => finding.code === "missing_spotify_daily_history" && finding.status === "blocked"));
  for (const investigation of [null, { ...row.source_evidence.liveCatalogInvestigation, catalogEvidenceApplied: false },
    { ...row.source_evidence.liveCatalogInvestigation, spotifyArtistId: "different-artist" }]) {
    const missingArtwork = evaluateMonitoringCandidate(artist, { ...row, source_evidence: { ...row.source_evidence,
      liveCatalogInvestigation: investigation, catalog: { ...row.source_evidence.catalog, albumsWithArtwork: 0 } } }, now);
    assert.equal(missingArtwork.classification, null);
    assert.ok(missingArtwork.findings.some(finding => finding.code === "missing_album_artwork" && finding.status === "investigation_required"));
  }
});

test("legacy exact-source references preserve the previous duplicated-payload result", () => {
  const { artist, row, now } = fixture();
  const extended = { ...row.extended[0]!, artist_key: artist.artistKey };
  const oldEvidence = { ...row, extended: [extended], legacy: [{ ...row.legacy[0]!, extended }] };
  const compactEvidence = { ...oldEvidence, legacy: oldEvidence.legacy.map(({ extended, ...value }) => ({
    ...value, extended_artist_key: extended.artist_key,
  })) };
  assert.deepEqual(evaluateMonitoringCandidate(artist, compactEvidence, now), evaluateMonitoringCandidate(artist, oldEvidence, now));
  assert.ok(JSON.stringify(compactEvidence).length < JSON.stringify(oldEvidence).length * 0.75);
  const unresolved = evaluateMonitoringCandidate(artist, { ...compactEvidence,
    legacy: [{ ...compactEvidence.legacy[0]!, extended_artist_key: "different exact source" }] }, now);
  assert.equal(unresolved.legacyPublicEligible, false);
  assert.ok(unresolved.findings.some(finding => finding.code === "legacy_source_join_mismatch"));
});

test("candidate policy evaluates saved SQL evidence without database configuration or initialization", () => {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/DATABASE|NEON|^PG/.test(key)));
  const result = spawnSync(process.execPath, ["--import", "./scripts/node_modules/tsx/dist/loader.mjs", "--input-type=module", "--eval", `
    import { evaluateMonitoringCandidate, groupMonitoringCandidateIdentities } from ${JSON.stringify(new URL("./monitoring-candidate-policy.ts", import.meta.url).href)};
    const artist = groupMonitoringCandidateIdentities([{artist_key:"source only",artist_name:null,spotify_id:null,source:"official_artists"}])[0];
    const result = evaluateMonitoringCandidate(artist,{artist_key:artist.artistKey,extended:null,snapshot:null,summary:null,raw_summary:null,legacy:null,source_evidence:{}},new Date("2026-08-10"));
    if (result.classification !== null || result.auditStatus !== "incomplete") throw new Error("Unexpected pure policy result");
    console.log("pure-candidate-policy-ok");
  `], { cwd: fileURLToPath(new URL("../../../../", import.meta.url)), env: environment, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "pure-candidate-policy-ok");
});

test("B requires positive raw-source proof of every failing check", () => {
  const { artist, row, now } = fixture();
  row.summary = { ...row.summary, track_count: 0, album_count: 0, track_daily_streams: 0, track_total_streams: 0, album_total_streams: 0 };
  row.legacy[0]!.summary = row.summary;
  const result = evaluateMonitoringCandidate(artist, row, now);
  assert.equal(result.classification, "B");
  assert.ok(result.findings.every(finding => finding.status === "repairable"));
  row.raw_summary = row.summary;
  assert.equal(evaluateMonitoringCandidate(artist, row, now).classification, "C");
});

test("provider conflicts and unavailable source schemas remain unclassified, never false C", () => {
  const { artist, row, now } = fixture();
  const conflict = evaluateMonitoringCandidate({ ...artist, identityConflict: true, spotifyIds: ["one", "two"] }, row, now);
  assert.equal(conflict.classification, null);
  const missing = evaluateMonitoringCandidate(artist, { ...row, missing_schema_tables: ["songstats_historical_observations"] }, now);
  assert.equal(missing.auditStatus, "incomplete");
  assert.equal(missing.publicEligible, false);
});

test("separate one-day video observations do not masquerade as each video's daily history", () => {
  const { artist, row, now } = fixture();
  row.source_evidence.youtubeHistory = { days: 2, videos: 2, videosWithHistory: 0 };
  assert.ok(evaluateMonitoringCandidate(artist, row, now).findings.some(finding => finding.code === "missing_youtube_daily_history"));
});

test("structural presence never proves full catalog or fresh observed YouTube data", () => {
  const { artist, row, now } = fixture();
  const unknownCatalog = evaluateMonitoringCandidate(artist, { ...row, source_evidence: { ...row.source_evidence, catalogCompleteness: null } }, now);
  assert.equal(unknownCatalog.classification, null);
  assert.equal(unknownCatalog.contractValidation, "incomplete");
  row.source_evidence.youtubeObservations[0]!.observedAt = "2026-08-01T11:00:00Z";
  assert.equal(evaluateMonitoringCandidate(artist, row, now).publicEligible, false);
  const oversizedImport = evaluateMonitoringCandidate(artist, { ...row, source_evidence: { ...row.source_evidence,
    youtubeImport: [{ status: "complete", completedAt: "2026-08-10", nextPageTokenPresent: false, expectedVideos: 100 }] } }, now);
  assert.ok(oversizedImport.findings.some(finding => finding.code === "incomplete_youtube_catalog"));
});

test("a fresh snapshot cannot lend its date to stale historical metric fallback", () => {
  const { artist, row, now } = fixture();
  row.snapshot.instagram_followers = 0;
  row.extended[0]!.historic_stats.stats.find(value => value.source === "instagram")!.data.history = [
    { date: "2021-01-01", followers_total: 100 }, { date: "2021-04-01", followers_total: 200 },
  ];
  assert.ok(evaluateMonitoringCandidate(artist, row, now).findings.some(finding => finding.code === "stale_required_instagramFollowers"));
});

test("a served raw summary repairs the old materialization gate without changing its thresholds", () => {
  const { artist, row, now } = fixture();
  const result = evaluateMonitoringCandidate(artist, { ...row, summary: null,
    legacy: [{ ...row.legacy[0]!, summary: null }],
    served_summary: { ...row.raw_summary, source_table: "monitoring_stream_daily_snapshots", recovery_reason: "missing_materialized_summary" } }, now);
  assert.equal(result.legacyPublicEligible, false);
  assert.equal(result.classification, "A");
  assert.equal(result.repairsPerformed[0]?.code, "stream_summary_from_existing_raw");
});

test("artwork coverage recovers full Songstats catalog, Kworb payload, stored covers and item metadata", () => {
  const { artist, row, now } = fixture();
  const result = evaluateMonitoringCandidate(artist, {
    ...row,
    source_evidence: { ...row.source_evidence, catalogCompleteness: { ...row.source_evidence.catalogCompleteness, expectedTracks: 3 } },
    stream_items: [
      { item_type: "track", item_key: "1", title: "Track One (Remastered)", artwork_url: null },
      { item_type: "album", item_key: "2", title: "Album One - EP", artwork_url: null },
      { item_type: "track", item_key: "3", title: "Kworb Track", artwork_url: null },
      { item_type: "track", item_key: "4", title: "Café", artwork_url: null },
    ],
    kworb_payload: { topTracks: [{ title: "Kworb Track", coverUrl: "https://example.com/kworb.jpg" }] },
    stored_artwork: [{ song_title: "Cafe", cover_url: "https://example.com/deezer.jpg" }],
  }, now);
  assert.equal(result.classification, "A");
  assert.equal((result.sourceEvidence.catalog as { tracksWithArtwork: number }).tracksWithArtwork, 3);
});

const postgresModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
test("read-only source audit SQL executes on PostgreSQL and keeps artists omitted by old joins", { skip: !postgresModule }, async () => {
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
    await db.exec("CREATE TABLE youtube_channel_upload_import_state (artist_key text, status text, completed_at timestamptz, next_page_token text, videos_imported integer, expected_total_videos integer)");
    await db.exec("INSERT INTO kworb_coverage(artist_key,artist_name) VALUES ('no spotify','No Spotify'); INSERT INTO official_artists(artist_key,artist_name) VALUES ('no snapshots','No Snapshots'); INSERT INTO monitoring_stream_items(artist_key,item_type,item_key,title) VALUES ('raw only','track','one','One')");
    const population = await db.query(MONITORING_CANDIDATE_POPULATION_SQL);
    assert.equal(groupMonitoringCandidateIdentities(population.rows).length, 3);
    const result = await db.query(MONITORING_CANDIDATE_EVIDENCE_SQL, [JSON.stringify([{ artist_key: "no spotify", source_keys: ["no spotify"] }])]);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].snapshot, null);
    await db.query("INSERT INTO songstats_artist_extended_data(artist_key,historic_stats) VALUES ($1,$2::jsonb)", ["no spotify", JSON.stringify({ fixture: "stored-once".repeat(2000) })]);
    const referenceResult = await db.query(MONITORING_CANDIDATE_EVIDENCE_SQL, [JSON.stringify([{ artist_key: "no spotify", source_keys: ["no spotify"] }])]);
    assert.equal(referenceResult.rows[0].legacy[0].extended_artist_key, "no spotify");
    assert.equal(Object.hasOwn(referenceResult.rows[0].legacy[0], "extended"), false);
    assert.equal(referenceResult.rows[0].extended[0].historic_stats.fixture.length, 22000);
    await db.exec(`INSERT INTO songstats_history_provider_identities(id,artist_key,validation_status) VALUES(1,'compact artist','verified');
      INSERT INTO songstats_history_metric_definitions(id,metric_key,ingestion_status,commercial_endpoint) VALUES
        (1,'spotifyMonthlyListeners','active','artist_historical_stats'),(2,'tiktokFollowers','quarantined','artist_historical_stats');
      INSERT INTO songstats_history_import_chunks(id) VALUES(1);
      INSERT INTO songstats_historical_observations(artist_key,provider_identity_id,metric_definition_id,provider_observation_date,value,import_chunk_id,acquisition_mode) VALUES
        ('compact artist',1,1,'2026-05-01',100,1,'songstats_historical'),('compact artist',1,1,'2026-08-10',200,1,'songstats_historical'),
        ('compact artist',1,1,'2026-05-12',110,1,'songstats_historical'),('compact artist',1,1,'2026-07-11',150,1,'songstats_historical'),('compact artist',1,1,'2026-08-03',190,1,'songstats_historical'),
        ('compact artist',1,2,'2026-05-01',100,1,'songstats_historical'),('compact artist',1,2,'2026-08-10',200,1,'songstats_historical');
      INSERT INTO songstats_artist_daily_snapshots(artist_key,snapshot_date,instagram_followers) VALUES('compact artist','2026-05-01',100),('compact artist','2026-05-12',110),('compact artist','2026-07-11',150),('compact artist','2026-08-03',190),('compact artist','2026-08-10',200)`);
    const compact = await db.query(buildMonitoringCompactReadinessSql("$1::text[]"), [["compact artist"]]);
    assert.equal(compact.rows[0].licensed_endpoint, true);
    assert.deepEqual(compact.rows[0].growth_metric_keys, ["instagramFollowers", "spotifyMonthlyListeners"]);
    assert.deepEqual(compact.rows[0].trend_metric_keys, ["instagramFollowers", "spotifyMonthlyListeners"]);
    await db.exec("DROP TABLE songstats_historical_observations");
    const partial = await db.query(withUnavailableMonitoringSources(MONITORING_CANDIDATE_EVIDENCE_SQL, ["songstats_historical_observations"]), [JSON.stringify([{ artist_key: "no spotify", source_keys: ["no spotify"] }])]);
    assert.equal(partial.rows.length, 1);
    const readPool = { connect: async () => ({ query: async (input: { text: string; values: unknown[] }) => db.query(input.text, input.values), release() {} }) };
    const targeted = await getMonitoringCandidateIdentity("no spotify", readPool as never);
    assert.equal(targeted?.artistKey, "no spotify");
    assert.equal(targeted?.spotifyIds.length, 0);
    await db.exec("INSERT INTO kworb_coverage(artist_key,artist_name,spotify_id) VALUES ('luis miguel','Luis Miguel','luis-id')");
    assert.equal((await getMonitoringCandidateIdentity("luis-miguel", readPool as never))?.artistKey, "luis miguel");
    assert.equal((await getMonitoringCandidateIdentity("luismiguel", readPool as never))?.artistKey, "luis miguel");
    await db.exec("INSERT INTO spotify_artists(artist_key,spotify_artist_id,verified) VALUES ('Luis Miguel','conflicting-id',true)");
    const conflicted = await getMonitoringCandidateIdentity("luis miguel", readPool as never);
    assert.equal(conflicted?.identityConflict, true);
    assert.deepEqual(conflicted?.matchKeys, ["luis miguel"]);
    const page = await getMonitoringCandidateDirectory({ limit: 2 }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(page.total, 5);
    assert.equal(page.artists.length, 2);
    assert.equal(page.hasMore, true);
    assert.equal(page.populationComplete, false);
    assert.equal(page.counts.incomplete, 2);
    await db.exec(`INSERT INTO official_artists(artist_key,artist_name) VALUES ('banda ms','Banda MS'),('banda m','Banda M');
      INSERT INTO songstats_history_provider_identities(id,artist_key,spotify_artist_id,validation_status) VALUES (2,'bandamsdesergiolizarraga','fixture-ms-provider','verified');
      INSERT INTO musicbrainz_artists(artist_key,mbid,name,aliases,verified) VALUES
        ('banda ms','fixture-ms-mbid','Banda MS de Sergio Lizárraga','["Banda MS", "MS accepted alias only"]','manual_review_accepted'),
        ('unreviewed group','fixture-unreviewed-mbid','Unreviewed Group','["Banda MS"]','needs_review')`);
    for (const key of ["banda-ms", "bandams", "bandamsdesergiolizarraga", "MS accepted alias only"]) {
      const ms = await getMonitoringCandidateIdentity(key, readPool as never);
      assert.equal(ms?.artistKey, "banda ms");
      assert.deepEqual(ms?.sourceKeys, ["banda ms", "bandamsdesergiolizarraga"]);
      assert.equal(ms?.identityConflict, false);
    }
    assert.equal((await getMonitoringCandidateIdentity("banda-m", readPool as never))?.identityMappingStatus, "unverified");
    assert.equal(await getMonitoringCandidateIdentity("unreviewed group", readPool as never), null);
    const msPage = await getMonitoringCandidateDirectory({ artistKeys: ["bandams"] }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(msPage.total, 1);
    assert.deepEqual(msPage.artists[0]?.sourceKeys, ["banda ms", "bandamsdesergiolizarraga"]);
    assert.ok(msPage.artists[0]?.declaredAliases.includes("MS accepted alias only"));
    // Production evidence: this accepted long-name record has no short alias.
    // It identifies the long-name sources, but cannot safely repair Banda MS.
    await db.exec(`DELETE FROM musicbrainz_artists WHERE artist_key='banda ms';
      INSERT INTO musicbrainz_artists(artist_key,mbid,name,aliases,verified) VALUES
        ('banda ms de sergio lizarraga','04bb4a12-08a3-463b-a0df-63c1fb658497','Banda MS de Sergio Lizárraga','[]','auto_review_accepted')`);
    const shortMs = await getMonitoringCandidateIdentity("banda-ms", readPool as never);
    assert.deepEqual(shortMs?.sourceKeys, ["banda ms"]);
    assert.equal(shortMs?.identityMappingStatus, "unverified");
    const longMs = await getMonitoringCandidateIdentity("bandamsdesergiolizarraga", readPool as never);
    assert.deepEqual(longMs?.sourceKeys, ["banda ms de sergio lizarraga", "bandamsdesergiolizarraga"]);
    assert.equal(longMs?.identityAliasEvidence[0]?.verification, "auto_review_accepted");
    const unresolvedMs = await getMonitoringCandidateDirectory({ artistKeys: ["bandams"] }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(unresolvedMs.artists[0]?.classification, null);
    assert.ok(unresolvedMs.artists[0]?.findings.some(finding => finding.code === "identity_source_mapping_unverified"));
    await db.exec(`INSERT INTO official_artists(artist_key,artist_name) VALUES ('artist alpha','Artist Alpha'),('artist beta','Artist Beta');
      INSERT INTO musicbrainz_artists(artist_key,mbid,name,aliases,verified) VALUES
        ('artist alpha','alpha-mbid','Artist Alpha','["阿尔法", "X東京"]','auto'),
        ('artist beta','beta-mbid','Artist Beta','["ベータ", "X大阪"]','auto');
      INSERT INTO spotify_artists(artist_key,spotify_artist_id,verified) VALUES ('x','x-provider',true),('x東京','tokyo-provider',true);
      INSERT INTO monitoring_stream_items(artist_key,item_type,item_key,title) VALUES ('阿尔法','track','alpha-track','Alpha Track')`);
    for (const [alias, expected] of [["阿尔法", "artist alpha"], ["X東京", "artist alpha"], ["ベータ", "artist beta"], ["X大阪", "artist beta"]]) {
      const identity = await getMonitoringCandidateIdentity(alias!, readPool as never);
      assert.equal(identity?.artistKey, expected);
      assert.equal(identity?.identityConflict, false);
    }
    assert.equal(await getMonitoringCandidateIdentity("未知", readPool as never), null);
    assert.equal(await getMonitoringCandidateIdentity("!!!", readPool as never), null);
    const asciiIdentity = await getMonitoringCandidateIdentity("x", readPool as never);
    assert.deepEqual(asciiIdentity?.sourceKeys, ["x"]);
    assert.deepEqual(asciiIdentity?.spotifyIds, ["x-provider"]);
    const unicodePage = await getMonitoringCandidateDirectory({ artistKeys: ["阿尔法"] }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(unicodePage.total, 1);
    assert.deepEqual(unicodePage.artists[0]?.sourceKeys, ["artist alpha", "x東京", "阿尔法"]);
    const unrelatedPage = await getMonitoringCandidateDirectory({ artistKeys: ["未知"] }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(unrelatedPage.total, 0);
    const unicodeSearch = await getMonitoringCandidateDirectory({ search: "ベータ" }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(unicodeSearch.total, 1);
    assert.equal(unicodeSearch.artists[0]?.artistKey, "artist beta");
    await db.exec(`INSERT INTO kworb_coverage(artist_key,artist_name,spotify_id) VALUES ('paid artist','Paid Artist','paid-provider');
      INSERT INTO songstats_history_provider_identities(id,artist_key,spotify_artist_id,validation_status) VALUES
        (10,'verified paid source','paid-provider','verified'),
        (11,'review other artist','paid-provider','review'),
        (12,'rejected other artist','paid-provider','rejected');
      INSERT INTO spotify_artists(artist_key,spotify_artist_id,verified) VALUES ('unverified spotify artist','paid-provider',false);
      INSERT INTO monitoring_stream_items(artist_key,item_type,item_key,title) VALUES
        ('review other artist','track','review-track','Review Track'),
        ('rejected other artist','track','rejected-track','Rejected Track')`);
    const trusted = await getMonitoringCandidateIdentity("paid artist", readPool as never);
    assert.deepEqual(trusted?.sourceKeys, ["paid artist", "verified paid source"]);
    assert.equal(trusted?.identityConflict, false);
    const retained = groupMonitoringCandidateIdentities((await db.query(withUnavailableMonitoringSources(
      MONITORING_CANDIDATE_POPULATION_SQL, ["songstats_historical_observations"],
    ))).rows);
    for (const key of ["review other artist", "rejected other artist", "unverified spotify artist"]) {
      const identity = retained.find(group => group.sourceKeys.includes(key));
      assert.deepEqual(identity?.sourceKeys, [key], "unaccepted mappings remain separately inspectable");
      assert.deepEqual(identity?.spotifyIds, [], "unaccepted provider IDs are not identity evidence");
      assert.equal(identity?.identityMappingStatus, "unverified");
      assert.deepEqual((await getMonitoringCandidateIdentity(key, readPool as never))?.sourceKeys, [key]);
    }
    const { authorizeMonitoringArtist } = await import("./monitoring-authorization");
    const paid = await authorizeMonitoringArtist({
      userId: "paid-user", requestedArtistKey: "paid artist", internalUserIds: "founder",
      findActiveSubscription: async () => ({ artist_key: "paid artist", artist_name: "Paid Artist", status: "active", created_at: null }),
      findExistingArtist: async key => {
        const identity = await getMonitoringCandidateIdentity(key, readPool as never);
        return identity ? { artist_key: identity.artistKey, artist_name: identity.artistName, status: "internal", created_at: null,
          match_keys: identity.matchKeys, identity_conflict: identity.identityConflict } : null;
      },
    });
    assert.equal(paid.allowed, true);
    assert.equal(paid.grant?.artist_key, "paid artist");
    assert.ok(paid.grant?.match_keys?.includes("verified paid source"));
    for (const key of ["review other artist", "rejected other artist", "unverified spotify artist"]) {
      assert.ok(!paid.grant?.match_keys?.includes(key), "paid access never inherits unaccepted provider mappings");
    }
    await db.exec(`INSERT INTO artist_candidates(id,artist_name,normalized_name,status,matched_artist_id) VALUES
      (100,'Banda MS','bandams','linked_existing_artist','banda ms de sergio lizarraga'),
      (101,'Pending Discovery','pendingdiscovery','pending','paid artist'),
      (102,'Rejected Discovery','rejecteddiscovery','rejected','paid artist');
      INSERT INTO spotify_artist_candidates(artist_key,artist_name,status,candidates) VALUES
      ('only spotify proposal','Only Spotify Proposal','review','[{"spotifyArtistId":"paid-provider"}]')`);
    const linkedMs = await getMonitoringCandidateIdentity("banda-ms", readPool as never);
    assert.deepEqual(linkedMs?.sourceKeys, ["banda ms", "banda ms de sergio lizarraga", "bandamsdesergiolizarraga"]);
    assert.equal(linkedMs?.identityConflict, false);
    assert.equal(linkedMs?.identityAliasEvidence.find(row => row.source === "artist_candidates")?.candidateId, "100");
    for (const key of ["pendingdiscovery", "rejecteddiscovery", "only spotify proposal"]) {
      const candidate = await getMonitoringCandidateIdentity(key, readPool as never);
      assert.equal(candidate?.artistKey, key);
      assert.equal(candidate?.identityMappingStatus, "unverified");
      assert.deepEqual(candidate?.spotifyIds, []);
      assert.ok(!candidate?.matchKeys.includes("paid artist"));
    }
    const discoveryPage = await getMonitoringCandidateDirectory({ artistKeys: ["pendingdiscovery", "rejecteddiscovery", "only spotify proposal"] },
      { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(discoveryPage.total, 3);
    assert.ok(discoveryPage.artists.every(row => row.classification === null && row.candidateRecords.length === 1));
    const paidAfterDiscovery = await getMonitoringCandidateIdentity("paid artist", readPool as never);
    for (const key of ["pendingdiscovery", "rejecteddiscovery", "only spotify proposal"]) assert.ok(!paidAfterDiscovery?.matchKeys.includes(key));
  } finally { await db.close(); }
});
