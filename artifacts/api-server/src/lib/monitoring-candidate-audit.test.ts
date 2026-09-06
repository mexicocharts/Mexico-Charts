import assert from "node:assert/strict";
import test from "node:test";
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
    await db.exec("INSERT INTO spotify_artists(artist_key,spotify_artist_id) VALUES ('Luis Miguel','conflicting-id')");
    const conflicted = await getMonitoringCandidateIdentity("luis miguel", readPool as never);
    assert.equal(conflicted?.identityConflict, true);
    assert.deepEqual(conflicted?.matchKeys, ["luis miguel"]);
    const page = await getMonitoringCandidateDirectory({ limit: 2 }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(page.total, 5);
    assert.equal(page.artists.length, 2);
    assert.equal(page.hasMore, true);
    assert.equal(page.populationComplete, false);
    assert.equal(page.counts.incomplete, 2);
  } finally { await db.close(); }
});
