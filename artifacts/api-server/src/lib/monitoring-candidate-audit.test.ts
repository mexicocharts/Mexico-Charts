import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
process.env["NEON_DATABASE_URL"] ??= "postgresql://local-test.invalid/mexico_charts";
const { evaluateMonitoringCandidate, groupMonitoringCandidateIdentities, getMonitoringCandidateDirectory, getMonitoringCandidateIdentity, MONITORING_CANDIDATE_EVIDENCE_SQL, MONITORING_CANDIDATE_POPULATION_SQL } = await import("./monitoring-candidate-audit");
const { MONITORING_AUDIT_SOURCE_TABLES, withUnavailableMonitoringSources } = await import("./monitoring-audit-schema");
const { buildMonitoringCompactReadinessSql } = await import("./monitoring-compact-readiness");

function fixture() {
  const artist = groupMonitoringCandidateIdentities([{ artist_key: "example artist", artist_name: "Example Artist", spotify_id: "0000000000000000000101", source: "kworb_coverage" }])[0]!;
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
    legacy: [{ coverage: { spotify_id: "0000000000000000000101" }, extended, snapshot, summary }],
    source_evidence: { artistImage: true, catalog: { tracks: 1, albums: 1, tracksWithArtwork: 1, albumsWithArtwork: 1 },
      liveCatalogInvestigation: { status: "reviewed", source: "kworb_live_complete_catalog", reference: "fixture:reviewed-live-catalog",
        observedAt: "2026-08-10T11:00:00Z", spotifyArtistId: "0000000000000000000101", catalogEvidenceApplied: true, artworkEvidenceApplied: true },
      currentHistory: { days: 20, previousDate: "2026-08-09", lastDate: "2026-08-10", latestSnapshots: [
        { date: "2026-08-09", spotifyMonthlyListeners: 199_000 },
        { date: "2026-08-10", spotifyMonthlyListeners: 200_000 },
      ] },
      catalogCompleteness: { verified: true, reference: "fixture:full-provider-catalog", expectedTracks: 1, expectedAlbums: 1 },
      spotifyHistory: { days: 20 }, streamHistory: { days: 20 }, youtube: { approvedVideos: 2, observedVideos: 2, videosWithArtwork: 2 },
      providerIdentities: { youtubeChannelIds: ["fixture-channel"] },
      youtubeImport: [{ channelId: "fixture-channel", currentChannelMatched: true, observedApprovedVideos: 2,
        status: "complete", completedAt: "2026-08-10", nextPageTokenPresent: false, expectedVideos: 2 }],
      youtubeObservations: [{ videoId: "one", observedAt: "2026-08-10T11:00:00Z", delta: 0, secondsSincePrevious: 300 }, { videoId: "two", observedAt: "2026-08-10T11:00:00Z", delta: 1, secondsSincePrevious: 300 }],
      youtubeHistory: { days: 20, videos: 2, videosWithHistory: 2 }, comparisonPeers: 1,
      comparisonPeerDates: [{ date: "2026-08-10", peers: 1 }] },
  };
  return { artist, row, now: new Date("2026-08-10T12:00:00Z") };
}

test("population includes source-only and no-Spotify artists while aliases and provider IDs are deterministic", () => {
  const rows = [
    { artist_key: "Banda El Recodo de Cruz Lizárraga", artist_name: "Banda El Recodo", spotify_id: null, source: "official_artists" },
    { artist_key: "bandaelrecodo", artist_name: null, spotify_id: "0000000000000000000109", source: "songstats_artist_daily_snapshots" },
    { artist_key: "recodo-provider-key", artist_name: null, spotify_id: "0000000000000000000109", source: "songstats_artist_extended_data" },
    { artist_key: "only raw streams", artist_name: null, spotify_id: null, source: "monitoring_stream_daily_snapshots" },
  ];
  const result = groupMonitoringCandidateIdentities(rows);
  assert.equal(result.length, 2);
  assert.equal(result.find(row => row.artistName === "Banda El Recodo")?.sourceKeys.length, 3);
  assert.ok(result.some(row => row.artistKey === "only raw streams"));
});

test("subscription leads preserve existing canonical identities and labels in either input order", () => {
  const scenarios = [
    { existing: [{ artist_key: "zz accepted registry", artist_name: "Accepted Registry Name", spotify_id: null, source: "musicbrainz_artists",
      mbid: "accepted-fixture", verified: "auto", declared_aliases: ["aa subscription alias"] }], key: "aa subscription alias" },
    { existing: [{ artist_key: "history source", artist_name: "Stored History Name", spotify_id: null, source: "monitoring_stream_items" }], key: "history source" },
    { existing: [{ artist_key: "unnamed history", artist_name: null, spotify_id: null, source: "monitoring_stream_daily_snapshots" }], key: "unnamed history" },
    { existing: [{ artist_key: "discovery alias", artist_name: "Accepted Discovery Name", spotify_id: null, source: "artist_candidates",
      discovery_status: "linked_existing_artist", matched_artist_key: "accepted target" }], key: "discovery alias" },
  ];
  for (const scenario of scenarios) {
    const original = groupMonitoringCandidateIdentities(scenario.existing)[0]!;
    const subscription = { artist_key: scenario.key, artist_name: "Untrusted Customer Label", spotify_id: null, source: "monitoring_subscriptions" };
    for (const rows of [[...scenario.existing, subscription], [subscription, ...scenario.existing]]) {
      const groups = groupMonitoringCandidateIdentities(rows);
      assert.equal(groups.length, 1);
      assert.equal(groups[0]?.artistKey, original.artistKey);
      assert.equal(groups[0]?.artistName, original.artistName);
      assert.equal(groups[0]?.identityMappingStatus, original.identityMappingStatus);
      assert.ok(!groups[0]?.matchKeys.includes("Untrusted Customer Label"));
      assert.ok(groups[0]?.sourceKeys.includes(scenario.key), "the distinct stored lead remains source evidence");
    }
  }
});

test("complete readiness requires a dated fresh peer and adjacent daily pulse observations", () => {
  const { artist, row, now } = fixture();
  for (const currentHistory of [
    { days: 20, previousDate: "2026-01-01", lastDate: "2026-08-10" },
    { days: 20, previousDate: "2026-01-01", lastDate: "2026-01-02" },
  ]) {
    const result = evaluateMonitoringCandidate(artist, { ...row, source_evidence: { ...row.source_evidence, currentHistory } }, now);
    assert.equal(result.publicEligible, false);
    assert.ok(result.readinessReasons.includes("missing_daily_pulse_history"));
    assert.equal((result.sourceEvidence["dailyPulse"] as { complete: boolean }).complete, false);
  }
  const stalePeer = evaluateMonitoringCandidate(artist, { ...row, source_evidence: { ...row.source_evidence,
    comparisonPeerDates: [{ date: "2026-01-01", peers: 100 }] } }, now);
  assert.equal(stalePeer.publicEligible, false);
  assert.ok(stalePeer.readinessReasons.includes("missing_comparison_peer"));
  const { comparisonPeerDates: _omitted, ...undatedEvidence } = row.source_evidence;
  const undated = evaluateMonitoringCandidate(artist, { ...row, source_evidence: undatedEvidence }, now);
  assert.equal(undated.classification, null);
  assert.ok(undated.findings.some(finding => finding.code === "missing_comparison_peer" && finding.status === "investigation_required"));
});

test("accepted entity aliases connect short names to existing histories without fuzzy prefix joins", () => {
  const rows = [
    { artist_key: "banda ms", artist_name: "Banda MS", spotify_id: null, source: "official_artists" },
    { artist_key: "bandamsdesergiolizarraga", artist_name: null, spotify_id: "0000000000000000000102", source: "songstats_history_provider_identities" },
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
    { artist_key: "bandamsdesergiolizarraga", artist_name: null, spotify_id: "0000000000000000000103", source: "songstats_history_provider_identities" },
    { artist_key: "bandamsdiscovered", artist_name: "Banda MS", spotify_id: null, source: "artist_candidates", source_record_id: "100",
      discovery_status: "linked_existing_artist", matched_artist_key: "banda ms de sergio lizarraga" },
    { artist_key: "unrelated pending", artist_name: "Unrelated Pending", spotify_id: "0000000000000000000103", source: "artist_candidates", source_record_id: "101",
      discovery_status: "pending", matched_artist_key: "banda ms de sergio lizarraga" },
    { artist_key: "unrelated spotify proposal", artist_name: "Other", spotify_id: "0000000000000000000103", source: "spotify_artist_candidates", discovery_status: "review" },
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

test("malformed provider assertions stay diagnostic without joining unrelated source keys", () => {
  const invalidId = "not-a-provider-id";
  const sources = [
    { artist_key: "unrelated alpha", artist_name: "Alpha", spotify_id: invalidId, source: "kworb_coverage" },
    { artist_key: "unrelated beta", artist_name: "Beta", spotify_id: invalidId, source: "songstats_artists" },
  ];
  const groups = groupMonitoringCandidateIdentities(sources);
  assert.equal(groups.length, 2);
  for (const group of groups) {
    assert.equal(group.sourceKeys.length, 1);
    assert.deepEqual(group.spotifyIds, [invalidId]);
    assert.deepEqual(group.invalidSpotifyIds, [invalidId]);
    assert.equal(group.identityMappingStatus, "unverified");
  }
  const { artist, row, now } = fixture();
  const invalid = evaluateMonitoringCandidate({ ...artist, spotifyIds: [invalidId] }, row, now);
  assert.equal(invalid.classification, null);
  assert.equal(invalid.publicEligible, false);
  assert.deepEqual(invalid.invalidSpotifyIds, [invalidId]);
  assert.ok(invalid.findings.some(value => value.code === "invalid_artist_mapping" && value.status === "investigation_required"));
  const [sameKey] = groupMonitoringCandidateIdentities([...sources.slice(0, 1),
    { ...sources[0]!, spotify_id: artist.spotifyIds[0]!, source: "spotify_artists" }]);
  assert.equal(sameKey?.identityConflict, true, "a valid assertion cannot erase a contradictory invalid assertion on the same exact key");
  assert.deepEqual(sameKey?.spotifyIds, [artist.spotifyIds[0], invalidId]);
});

test("provider conflicts and unavailable source schemas remain unclassified, never false C", () => {
  const { artist, row, now } = fixture();
  const conflict = evaluateMonitoringCandidate({ ...artist, identityConflict: true, spotifyIds: ["0000000000000000000109", "0000000000000000000110"] }, row, now);
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

function endpointFixture(missing: Array<"audience" | "catalog">) {
  const { artist, row, now } = fixture();
  const extended: Record<string, unknown> = { ...row.extended[0], artist_key: artist.artistKey,
    audience_details_fetched_at: "2026-08-08T10:00:00Z" };
  for (const endpoint of missing) extended[endpoint] = null;
  return { artist, now, row: { ...row, extended: [extended], legacy: [{ ...row.legacy[0]!, extended }] } };
}

test("real scoped licensed Mexico details make the redundant audience endpoint a contract repair, preserving legacy failure", () => {
  const { artist, row, now } = endpointFixture(["audience"]);
  const result = evaluateMonitoringCandidate(artist, row, now);
  assert.equal(result.legacyPublicEligible, false);
  assert.equal(result.readiness.ready, false);
  assert.deepEqual(result.readiness.reasons, ["missing_licensed_endpoint"]);
  assert.equal(result.classification, "B");
  assert.equal(result.publicEligible, false);
  assert.ok(result.findings.some(finding => finding.code === "endpoint_presence_contract_mismatch" && finding.status === "repairable"));
  assert.ok(result.findings.some(finding => finding.code === "missing_licensed_endpoint" && finding.status === "repairable"));
  assert.equal((result.sourceEvidence["licensedEndpoints"] as { audience: boolean }).audience, false);
  const proof = result.sourceEvidence["endpointPresenceContractMismatch"] as { endpoints: Array<Record<string, unknown>> };
  assert.equal(proof.endpoints[0]?.fetchedAt, "2026-08-08T10:00:00Z");
  assert.equal(proof.endpoints[0]?.parsedMexicoCities, 1);
  for (const source of [{ ...row.extended[0], artist_key: "unrelated" }, { ...row.extended[0], audience_details_fetched_at: null }]) {
    const unproven = evaluateMonitoringCandidate(artist, { ...row, extended: [source] }, now);
    assert.equal(unproven.classification, null);
    assert.ok(unproven.findings.some(finding => finding.code === "endpoint_presence_contract_mismatch" && finding.status === "investigation_required"));
  }
});

test("an audience payload without actual Mexico detail still fails the market requirement", () => {
  const { artist, row, now } = endpointFixture(["audience"]);
  const result = evaluateMonitoringCandidate(artist, { ...row, extended: [{ ...row.extended[0],
    audience_details: { sources: { spotify: { audience: [{ source: "spotify", data: { monthly_listeners: [] } }] } } },
  }] }, now);
  assert.equal(result.classification, "C");
  assert.ok(result.findings.some(finding => finding.code === "missing_mexico_audience" && finding.status === "blocked"));
  assert.ok(!result.findings.some(finding => finding.code === "endpoint_presence_contract_mismatch"));
});

test("missing Songstats catalog alone does not establish absence of the canonical catalog fallback", () => {
  const { artist, row, now } = endpointFixture(["catalog"]);
  const result = evaluateMonitoringCandidate(artist, { ...row,
    source_evidence: { ...row.source_evidence, liveCatalogInvestigation: null },
  }, now);
  assert.equal(result.legacyPublicEligible, false);
  assert.equal(result.readiness.ready, false);
  assert.deepEqual(result.readiness.reasons, ["missing_licensed_endpoint"]);
  assert.equal(result.classification, null);
  assert.equal(result.publicEligible, false);
  assert.ok(result.findings.some(finding => finding.code === "endpoint_presence_contract_mismatch" && finding.status === "investigation_required"));
  assert.ok(result.findings.every(finding => finding.status !== "blocked"));
});

test("catalog endpoint repair requires applied complete item and artwork proof bound to the reviewed artist capture", () => {
  const { artist, row, now } = endpointFixture(["audience", "catalog"]);
  const capture = row.source_evidence.liveCatalogInvestigation;
  const catalogCompleteness = { ...row.source_evidence.catalogCompleteness, source: capture.source,
    reference: capture.reference, spotifyArtistId: capture.spotifyArtistId };
  const inspected = { ...row, stream_items: [
    { item_type: "track", item_key: "track-one", title: "Track One", artwork_url: "https://example.com/track.jpg" },
    { item_type: "album", item_key: "album-one", title: "Album One", artwork_url: "https://example.com/album.jpg" },
  ], source_evidence: { ...row.source_evidence, catalogCompleteness } };
  const complete = evaluateMonitoringCandidate(artist, inspected, now);
  assert.equal(complete.classification, "B");
  assert.equal(complete.legacyPublicEligible, false);
  assert.equal(complete.publicEligible, false);
  assert.ok(complete.readiness.reasons.includes("missing_licensed_endpoint"));
  assert.ok(complete.findings.some(finding => finding.code === "endpoint_presence_contract_mismatch" && finding.status === "repairable"));
  const incompleteCases = [
    { ...inspected, stream_items: undefined },
    { ...inspected, stream_items: inspected.stream_items.map(item => ({ ...item, artwork_url: null })) },
    { ...inspected, source_evidence: { ...inspected.source_evidence, catalogCompleteness: { ...catalogCompleteness, expectedTracks: 100 } } },
    { ...inspected, source_evidence: { ...inspected.source_evidence, catalogCompleteness: { ...catalogCompleteness, reference: "unrelated-capture" } } },
    { ...inspected, source_evidence: { ...inspected.source_evidence, catalogCompleteness: { ...catalogCompleteness, spotifyArtistId: "0000000000000000000999" } } },
    { ...inspected, source_evidence: { ...inspected.source_evidence, liveCatalogInvestigation: { ...capture, artworkEvidenceApplied: false } } },
    { ...inspected, source_evidence: { ...inspected.source_evidence, liveCatalogInvestigation: { ...capture, observedAt: "2020-01-01T00:00:00Z" } } },
    { ...inspected, source_evidence: { ...inspected.source_evidence, liveCatalogInvestigation: { ...capture, observedAt: "2026-08-09T00:00:00Z" } } },
  ];
  for (const incomplete of incompleteCases) {
    const result = evaluateMonitoringCandidate(artist, incomplete, now);
    assert.equal(result.publicEligible, false);
    assert.ok(result.findings.some(finding => finding.code === "endpoint_presence_contract_mismatch" && finding.status === "investigation_required"));
  }
  const archiveProof = { ...catalogCompleteness, source: "monitoring_stream_daily_snapshots", artistKey: artist.artistKey,
    sourceKeys: [artist.artistKey], evidenceApplied: true };
  const archive = { ...inspected, served_summary: { ...row.summary, source_table: "monitoring_stream_daily_snapshots" },
    source_evidence: { ...inspected.source_evidence, liveCatalogInvestigation: null, catalogCompleteness: archiveProof } };
  assert.equal(evaluateMonitoringCandidate(artist, archive, now).classification, "B");
  for (const proof of [{ ...archiveProof, sourceKeys: ["unrelated artist"] }, { ...archiveProof, evidenceApplied: false }]) {
    const result = evaluateMonitoringCandidate(artist, { ...archive, source_evidence: { ...archive.source_evidence, catalogCompleteness: proof } }, now);
    assert.ok(result.findings.some(finding => finding.code === "endpoint_presence_contract_mismatch" && finding.status === "investigation_required"));
  }
});

test("candidate, native and legacy YouTube diagnostics keep absent approved coverage under investigation", () => {
  const { artist, row, now } = fixture();
  const noApprovedSources = { ...row.source_evidence,
    youtube: { approvedVideos: 0, observedVideos: 0, videosWithArtwork: 0 },
    youtubeObservations: [], youtubeHistory: { days: 0, videos: 0, videosWithHistory: 0 }, youtubeImport: [],
  };
  for (const youtubeServing of [
    undefined,
    { inspected: true, catalog: { videos: 2, candidateOnlyVideos: 2 }, relationships: [{ status: "review", sampling_status: "shadow" }] },
    { inspected: true, nativeDailyHistory: { points: 20, candidateOnlyVideosWithHistory: 2 } },
    { inspected: true, legacyVideos: { videos: 2 } },
    { inspected: true, channelDailyHistory: { points: 20 } },
  ]) {
    const result = evaluateMonitoringCandidate(artist, { ...row, source_evidence: { ...noApprovedSources, youtubeServing } }, now);
    assert.equal(result.classification, null);
    assert.equal(result.auditStatus, "incomplete");
    assert.equal(result.publicEligible, false);
    assert.ok(result.findings.some(finding => finding.code === "youtube_serving_source_requires_investigation"));
    assert.ok(result.findings.filter(finding => finding.section === "youtube").every(finding => finding.status === "investigation_required"));
    assert.equal((result.sourceEvidence["youtube"] as { approvedVideos: number }).approvedVideos, 0);
  }
  const knownAbsent = evaluateMonitoringCandidate(artist, { ...row, source_evidence: { ...noApprovedSources,
    youtubeServing: { inspected: true, catalog: { videos: 0 }, legacyVideos: { videos: 0 }, channelDailyHistory: { points: 0 }, nativeDailyHistory: { points: 0 } },
  } }, now);
  assert.equal(knownAbsent.classification, "C", "an inspected absence remains a known approved-source gap");
  assert.ok(knownAbsent.findings.some(finding => finding.code === "missing_approved_youtube_catalog" && finding.status === "blocked"));
});

const postgresModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
test("native daily gaps remain under investigation without promoting unreviewed intraday or unrelated history", () => {
  const { artist, row, now } = fixture();
  for (const youtubeHistory of [
    { days: 0, videos: 0, videosWithHistory: 0 },
    { days: 20, videos: 2, videosWithHistory: 1 },
  ]) {
    const input = { ...row, source_evidence: { ...row.source_evidence, youtubeHistory } };
    const result = evaluateMonitoringCandidate(artist, input, now);
    assert.equal(result.legacyPublicEligible, true, "the exact legacy contract is unchanged");
    assert.equal(result.publicEligible, false, "the full daily coverage gate still fails");
    assert.equal(result.classification, null);
    assert.equal(result.auditStatus, "incomplete");
    assert.ok(result.findings.some(finding => finding.code === "missing_youtube_daily_history" && finding.status === "investigation_required"));
    assert.ok(result.findings.some(finding => finding.code === "youtube_native_intraday_fallback_uninvestigated" && finding.status === "investigation_required"));
    assert.ok(result.findings.every(finding => finding.status !== "repairable" && finding.status !== "blocked"));
    assert.deepEqual(result.sourceEvidence["youtubeHistory"], youtubeHistory, "no alternate counts are substituted");

    const independentBlocker = evaluateMonitoringCandidate(artist, { ...input,
      source_evidence: { ...input.source_evidence, spotifyHistory: { days: 0 } } }, now);
    assert.equal(independentBlocker.classification, "C");
    assert.equal(independentBlocker.auditStatus, "incomplete");
    assert.ok(independentBlocker.findings.some(finding => finding.code === "missing_spotify_daily_history" && finding.status === "blocked"));

    for (const unrelated of [
      { inspected: true, nativeDailyHistory: { points: 200, candidateOnlyVideosWithHistory: 2 } },
      { inspected: true, channelDailyHistory: { points: 200, days: 90 } },
      { inspected: true, nativeIntradayHistory: { inspected: true, sourceType: "youtube_api_shadow", points: 200, videosWithHistory: 2 } },
      { inspected: true, protectedComparatorHistory: { points: 200, days: 90 } },
    ]) {
      const unreviewed = evaluateMonitoringCandidate(artist, { ...input,
        source_evidence: { ...input.source_evidence, youtubeServing: unrelated } }, now);
      assert.equal(unreviewed.classification, null, "counts alone cannot establish an approved daily projection");
      assert.equal(unreviewed.publicEligible, false);
      assert.ok(unreviewed.findings.some(finding => finding.code === "youtube_native_intraday_fallback_uninvestigated"));
      assert.deepEqual(unreviewed.sourceEvidence["youtubeHistory"], youtubeHistory);
    }
  }
  const complete = evaluateMonitoringCandidate(artist, row, now);
  assert.equal(complete.classification, "A");
  assert.equal(complete.auditStatus, "complete");
  assert.ok(!complete.findings.some(finding => /youtube.*history|youtube_native_intraday/.test(finding.code)));
});

test("subscription-only candidates are privately inspectable without billing data or new access grants", { skip: !postgresModule }, async () => {
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
      ('real source','Real Source','0000000000000000000301',true);
      INSERT INTO monitoring_subscriptions(stripe_subscription_id,clerk_user_id,artist_key,artist_name,status) VALUES
      ('private-billing-one','owner-one','subscription only','Real Source','active'),
      ('private-billing-two','owner-two','subscription only','Real Source','trialing'),
      ('private-billing-three','former-owner','cancelled only','Cancelled Only','canceled'),
      ('private-billing-four','owner-one','real source','Untrusted Display Name','active'),
      ('private-billing-empty','owner-one','   ','Blank Key','active')`);
    const raw = (await db.query(MONITORING_CANDIDATE_POPULATION_SQL)).rows;
    const subscriptionRows = raw.filter((row: { source: string }) => row.source === "monitoring_subscriptions");
    assert.equal(subscriptionRows.length, 4, "customers and statuses cannot duplicate the artist projection");
    for (const row of subscriptionRows) {
      assert.deepEqual(Object.keys(row).sort(), ["artist_key", "artist_name", "source", "spotify_id"]);
      assert.equal(row.spotify_id, null);
    }
    assert.ok(!JSON.stringify(raw).includes("private-billing"));
    assert.ok(!JSON.stringify(raw).includes("owner-one"));
    const population = groupMonitoringCandidateIdentities(raw);
    assert.equal(population.length, 3, "blank keys are ignored and repeated stored keys collapse");
    const only = population.find(artist => artist.artistKey === "subscription only")!;
    assert.deepEqual(only.sourceKeys, ["subscription only"]);
    assert.deepEqual(only.spotifyIds, []);
    assert.deepEqual(only.declaredAliases, []);
    assert.equal(only.identityMappingStatus, "unverified");
    assert.ok(!only.matchKeys.includes("real source"), "a customer-supplied name cannot bridge to a provider artist");
    assert.deepEqual(population.find(artist => artist.artistKey === "real source")?.sourceKeys, ["real source"]);
    assert.deepEqual(population.find(artist => artist.artistKey === "real source")?.candidateSources, ["monitoring_subscriptions", "spotify_artists"]);
    const readPool = { connect: async () => ({ query: async (input: { text: string; values: unknown[] }) => db.query(input.text, input.values), release() {} }) };
    for (const key of ["subscription only", "subscription-only", "subscriptiononly"]) {
      assert.equal((await getMonitoringCandidateIdentity(key, readPool as never))?.artistKey, "subscription only");
    }
    assert.equal(await getMonitoringCandidateIdentity("Untrusted Display Name", readPool as never), null);
    const directory = await getMonitoringCandidateDirectory({}, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(directory.populationComplete, true);
    assert.equal(directory.total, 3);
    const audit = directory.artists.find(artist => artist.artistKey === "subscription only")!;
    assert.equal(audit.classification, null);
    assert.equal(audit.auditStatus, "incomplete");
    assert.equal(audit.publicEligible, false);
    assert.ok(audit.readinessReasons.includes("identity_source_mapping_unverified"));
    assert.ok(directory.artists.some(artist => artist.artistKey === "cancelled only"), "stored status never gates private candidate coverage");

    const { authorizeMonitoringArtist } = await import("./monitoring-authorization");
    const findExistingArtist = async (key: string) => {
      const identity = await getMonitoringCandidateIdentity(key, readPool as never);
      return identity ? { artist_key: identity.artistKey, artist_name: identity.artistName, status: "internal", created_at: null,
        match_keys: identity.matchKeys, identity_conflict: identity.identityConflict } : null;
    };
    const founder = await authorizeMonitoringArtist({ userId: "founder", requestedArtistKey: "subscription-only", internalUserIds: "founder",
      findActiveSubscription: async () => { throw new Error("Founder inspection must not require a paid subscription"); }, findExistingArtist });
    assert.equal(founder.allowed, true);
    assert.equal(founder.source, "internal");
    assert.equal(founder.grant?.artist_key, "subscription only");
    assert.equal(founder.publicReadinessEvaluated, false);
    for (const userId of [null, "free-user", "former-owner"]) {
      let identityLookups = 0;
      const denied = await authorizeMonitoringArtist({ userId, requestedArtistKey: "subscription only", internalUserIds: "founder",
        findActiveSubscription: async () => null,
        findExistingArtist: async key => { identityLookups++; return findExistingArtist(key); } });
      assert.equal(denied.allowed, false);
      assert.equal(identityLookups, 0, "candidate presence does not authorize source inspection for a viewer without a grant");
    }
    const grant = { artist_key: "subscription only", artist_name: "Paid Name", status: "active", created_at: null };
    const paid = await authorizeMonitoringArtist({ userId: "owner-one", requestedArtistKey: "subscription only", internalUserIds: "founder",
      findActiveSubscription: async () => grant, findExistingArtist });
    assert.equal(paid.allowed, true);
    assert.equal(paid.source, "subscription");
    assert.equal(paid.grant?.artist_name, grant.artist_name);
    assert.ok(!paid.grant?.match_keys?.includes("real source"));
    const deniedOtherArtist = await authorizeMonitoringArtist({ userId: "owner-one", requestedArtistKey: "cancelled only", internalUserIds: "founder",
      findActiveSubscription: async () => null, findExistingArtist });
    assert.equal(deniedOtherArtist.allowed, false);

    await db.exec("DROP TABLE monitoring_subscriptions");
    const missing = await getMonitoringCandidateDirectory({}, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(missing.populationComplete, false);
    assert.deepEqual(missing.missingSchemaTables, ["monitoring_subscriptions"]);
    assert.equal(missing.total, 1);
    assert.equal(missing.artists[0]?.classification, null, "a missing source relation is unknown coverage, not a zero count");
    assert.equal(await getMonitoringCandidateIdentity("subscription only", readPool as never), null);
  } finally { await db.close(); }
});

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
    await db.exec("CREATE TABLE youtube_channel_upload_import_state (artist_key text, channel_id text, status text, completed_at timestamptz, next_page_token text, videos_imported integer, expected_total_videos integer)");
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
    await db.exec(`INSERT INTO kworb_coverage(artist_key,status) VALUES ('stale peer','active'),('fresh peer','active'),('zero latest peer','active');
      INSERT INTO songstats_artist_extended_data(artist_key) VALUES ('stale peer'),('fresh peer'),('zero latest peer');
      INSERT INTO songstats_artist_daily_snapshots(artist_key,snapshot_date,spotify_monthly_listeners) VALUES
        ('stale peer','2026-01-01',100),('fresh peer','2026-08-10',200),
        ('zero latest peer','2026-08-09',300),('zero latest peer','2026-08-10',0)`);
    const peers = await db.query(MONITORING_CANDIDATE_EVIDENCE_SQL, [JSON.stringify([{ artist_key: "fresh peer", source_keys: ["fresh peer"] }])]);
    assert.equal(peers.rows[0].source_evidence.comparisonPeers, 1);
    assert.deepEqual(peers.rows[0].source_evidence.comparisonPeerDates, [{ date: "2026-01-01", peers: 1 }]);
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
    await db.exec("INSERT INTO kworb_coverage(artist_key,artist_name,spotify_id) VALUES ('luis miguel','Luis Miguel','0000000000000000000104')");
    assert.equal((await getMonitoringCandidateIdentity("luis-miguel", readPool as never))?.artistKey, "luis miguel");
    assert.equal((await getMonitoringCandidateIdentity("luismiguel", readPool as never))?.artistKey, "luis miguel");
    await db.exec("INSERT INTO spotify_artists(artist_key,spotify_artist_id,verified) VALUES ('Luis Miguel','0000000000000000000105',true)");
    const conflicted = await getMonitoringCandidateIdentity("luis miguel", readPool as never);
    assert.equal(conflicted?.identityConflict, true);
    assert.deepEqual(conflicted?.matchKeys, ["luis miguel"]);
    const page = await getMonitoringCandidateDirectory({ limit: 2 }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(page.total, 8);
    assert.equal(page.artists.length, 2);
    assert.equal(page.hasMore, true);
    assert.equal(page.populationComplete, false);
    assert.equal(page.counts.incomplete, 2);
    await db.exec(`INSERT INTO official_artists(artist_key,artist_name) VALUES ('banda ms','Banda MS'),('banda m','Banda M');
      INSERT INTO songstats_history_provider_identities(id,artist_key,spotify_artist_id,validation_status) VALUES (2,'bandamsdesergiolizarraga','0000000000000000000102','verified');
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
      INSERT INTO spotify_artists(artist_key,spotify_artist_id,verified) VALUES ('x','0000000000000000000106',true),('x東京','0000000000000000000107',true);
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
    assert.deepEqual(asciiIdentity?.spotifyIds, ["0000000000000000000106"]);
    const unicodePage = await getMonitoringCandidateDirectory({ artistKeys: ["阿尔法"] }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(unicodePage.total, 1);
    assert.deepEqual(unicodePage.artists[0]?.sourceKeys, ["artist alpha", "x東京", "阿尔法"]);
    const unrelatedPage = await getMonitoringCandidateDirectory({ artistKeys: ["未知"] }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(unrelatedPage.total, 0);
    const unicodeSearch = await getMonitoringCandidateDirectory({ search: "ベータ" }, { readPool: readPool as never, now: new Date("2026-08-10") });
    assert.equal(unicodeSearch.total, 1);
    assert.equal(unicodeSearch.artists[0]?.artistKey, "artist beta");
    await db.exec(`INSERT INTO kworb_coverage(artist_key,artist_name,spotify_id) VALUES ('paid artist','Paid Artist','0000000000000000000108');
      INSERT INTO songstats_history_provider_identities(id,artist_key,spotify_artist_id,validation_status) VALUES
        (10,'verified paid source','0000000000000000000108','verified'),
        (11,'review other artist','0000000000000000000108','review'),
        (12,'rejected other artist','0000000000000000000108','rejected');
      INSERT INTO spotify_artists(artist_key,spotify_artist_id,verified) VALUES ('unverified spotify artist','0000000000000000000108',false);
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
      ('only spotify proposal','Only Spotify Proposal','review','[{"spotifyArtistId":"0000000000000000000108"}]')`);
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
    await db.exec(`INSERT INTO kworb_coverage(artist_key,artist_name,spotify_id) VALUES
      ('malformed alpha','Malformed Alpha','invalid-shared-provider'),
      ('malformed beta','Malformed Beta','invalid-shared-provider'),
      ('malformed conflict','Malformed Conflict','invalid-shared-provider');
      INSERT INTO spotify_artists(artist_key,spotify_artist_id,verified) VALUES
      ('malformed conflict','0000000000000000000200',true)`);
    const providerLookups: unknown[][] = [];
    const capturedPool = { connect: async () => ({
      query: async (input: { text: string; values: unknown[] }) => {
        if (Array.isArray(input.values?.[1])) providerLookups.push(input.values[1]);
        return db.query(input.text, input.values);
      }, release() {},
    }) };
    for (const key of ["malformed alpha", "malformed beta"]) {
      const identity = await getMonitoringCandidateIdentity(key, capturedPool as never);
      assert.deepEqual(identity?.sourceKeys, [key], "a shared malformed ID cannot expand a targeted lookup");
      assert.deepEqual(identity?.spotifyIds, ["invalid-shared-provider"]);
      assert.deepEqual(identity?.invalidSpotifyIds, ["invalid-shared-provider"]);
    }
    const invalidConflict = await getMonitoringCandidateIdentity("malformed conflict", capturedPool as never);
    assert.equal(invalidConflict?.identityConflict, true);
    assert.deepEqual(invalidConflict?.spotifyIds, ["0000000000000000000200", "invalid-shared-provider"]);
    assert.deepEqual(invalidConflict?.matchKeys, ["malformed conflict"]);
    assert.ok(providerLookups.length >= 6);
    assert.ok(providerLookups.flat().every(value => typeof value === "string" && /^[A-Za-z0-9]{22}$/.test(value)),
      "only valid provider IDs may appear in the second targeted provider query");
    const finalPopulation = groupMonitoringCandidateIdentities((await db.query(withUnavailableMonitoringSources(
      MONITORING_CANDIDATE_POPULATION_SQL, ["songstats_historical_observations"],
    ))).rows);
    assert.equal(finalPopulation.filter(group => group.sourceKeys.some(key => key.startsWith("malformed "))).length, 3,
      "the directory preserves every unrelated malformed source candidate");
    await db.exec(`INSERT INTO spotify_artists(artist_key,spotify_artist_id,verified,spotify_image_url)
      VALUES ('unverified image','0000000000000000000201',false,'https://example.com/unverified.jpg')`);
    const imageQuery = withUnavailableMonitoringSources(MONITORING_CANDIDATE_EVIDENCE_SQL, ["songstats_historical_observations"]);
    const imageKeys = JSON.stringify([{ artist_key: "unverified image", source_keys: ["unverified image"] }]);
    assert.equal((await db.query(imageQuery, [imageKeys])).rows[0].source_evidence.artistImage, false);
    await db.exec("UPDATE spotify_artists SET verified=true WHERE artist_key='unverified image'");
    assert.equal((await db.query(imageQuery, [imageKeys])).rows[0].source_evidence.artistImage, true);
    await db.exec(`INSERT INTO youtube_channels(artist_key,channel_id) VALUES ('youtube fixture','channel-one'),('youtube fixture alias','channel-two'),('youtube unrelated','channel-other');
      INSERT INTO youtube_channel_upload_import_state(artist_key,channel_id,status,completed_at,next_page_token,videos_imported,expected_total_videos) VALUES
        ('youtube fixture','channel-one','complete','2026-08-10',null,2,2),
        ('youtube fixture alias','channel-two','complete','2026-08-10',null,2,2);
      INSERT INTO youtube_artist_video_links(id,artist_key,video_id,active,confidence_score) VALUES
        (201,'youtube fixture','one-a',true,90),(202,'youtube fixture','one-b',true,90),
        (203,'youtube fixture alias','one-a',true,90),(204,'youtube fixture','two-missing',true,90),
        (205,'youtube unrelated','other-video',true,90);
      INSERT INTO youtube_tracked_videos(video_id,channel_id,view_count) VALUES
        ('one-a','channel-one',0),('one-b','channel-one',100),('two-missing','channel-two',null),('other-video','channel-other',999);
      INSERT INTO youtube_music_catalog_candidates(id,artist_key,artist_name,video_id,confidence_score,status,sampling_status,evidence_source) VALUES
        (206,'youtube fixture','YouTube Fixture','candidate-only',95,'verified','shadow','youtube_music_innertube');
      INSERT INTO youtube_tracked_videos(video_id,channel_id,view_count) VALUES ('candidate-only','channel-two',100);
      INSERT INTO youtube_video_daily_snapshots(video_id,snapshot_date,view_count,fetched_at) VALUES
        ('one-a','2020-01-01',1,'2020-01-01'),('one-a','2020-01-02',2,'2020-01-02'),
        ('candidate-only',to_char(current_date - 1,'YYYY-MM-DD'),0,now()-interval '1 day'),
        ('candidate-only',to_char(current_date,'YYYY-MM-DD'),100,now())`);
    const youtubeKeys = JSON.stringify([{ artist_key: "youtube fixture", source_keys: ["youtube fixture", "youtube fixture alias"] }]);
    const youtubeEvidence = (await db.query(imageQuery, [youtubeKeys])).rows[0].source_evidence;
    const channelImports = [...youtubeEvidence.youtubeImport].sort((a: any,b: any) => a.channelId.localeCompare(b.channelId));
    assert.deepEqual(channelImports.map((row: any) => [row.channelId,row.observedApprovedVideos,row.currentChannelMatched]),
      [["channel-one",2,true],["channel-two",0,true]], "approved observed videos deduplicate aliases and reconcile on their actual channel; zero is observed");
    assert.equal(youtubeEvidence.youtube.approvedVideos, 3);
    assert.equal(youtubeEvidence.youtube.observedVideos, 2);
    assert.equal(youtubeEvidence.youtubeHistory.videos, 0, "candidate-only daily history never enters approved completeness");
    assert.equal(youtubeEvidence.youtubeHistory.days, 0, "stale 2020 native dates cannot satisfy the served 90-day history");
    assert.equal(youtubeEvidence.youtubeHistory.videosWithHistory, 0);
    assert.equal(youtubeEvidence.youtubeHistory.rangeDays, 90);
    assert.equal(youtubeEvidence.youtubeHistory.rangeClock, "database_now_America/New_York");
    assert.equal(youtubeEvidence.youtubeHistory.sourceTable, "youtube_video_daily_snapshots");
    assert.equal(youtubeEvidence.youtubeHistory.allTime.days, 2, "the older actual archive remains inventoried separately");
    assert.equal(youtubeEvidence.youtubeHistory.allTime.videosWithHistory, 1);
    assert.equal(youtubeEvidence.youtubeServing.nativeDailyHistory.candidateOnlyVideosWithHistory, 1);
    const { evaluateMonitoringYoutubeImportProof } = await import("./monitoring-youtube-policy");
    assert.equal(evaluateMonitoringYoutubeImportProof(youtubeEvidence).complete, false);
    assert.equal(evaluateMonitoringYoutubeImportProof(youtubeEvidence).knownMissing, true);
  } finally { await db.close(); }
});


test("pulse contract evaluates finite pairs from the same merged serving history and keeps uninspected sources unknown", () => {
  const { artist, row, now } = fixture();
  const nativePair = [{ date: "2026-08-09", spotifyFollowers: 0 }, { date: "2026-08-10", spotifyFollowers: 0 }];
  const noTrends = row.extended.map(value => ({ ...value, historic_stats: {} }));
  const measured = evaluateMonitoringCandidate(artist, { ...row, extended: noTrends, source_evidence: { ...row.source_evidence,
    currentHistory: { ...row.source_evidence.currentHistory, latestSnapshots: nativePair } } }, now);
  assert.equal((measured.sourceEvidence["dailyPulse"] as { complete: boolean }).complete, true);
  assert.ok(!measured.findings.some(finding => finding.code === "missing_daily_pulse_history"));
  const missingPair = { ...row, extended: noTrends, source_evidence: { ...row.source_evidence,
    currentHistory: { ...row.source_evidence.currentHistory, latestSnapshots: [nativePair[0], { date: "2026-08-10", instagramFollowers: 1 }] } } };
  const incomplete = evaluateMonitoringCandidate(artist, missingPair, now);
  assert.equal(incomplete.publicEligible, false);
  assert.equal((incomplete.sourceEvidence["dailyPulse"] as { reason: string }).reason, "no_paired_metrics");
  assert.ok(incomplete.findings.some(finding => finding.code === "missing_daily_pulse_history" && finding.status === "blocked"));
  const uninspectedCompact = evaluateMonitoringCandidate(artist, { ...missingPair, source_evidence: { ...missingPair.source_evidence,
    compactHistory: { points: 10 } } }, now);
  assert.ok(uninspectedCompact.findings.some(finding => finding.code === "missing_daily_pulse_history" && finding.status === "investigation_required"));
  const latestLicensed = noTrends.map(value => ({ ...value, historic_stats: { stats: [
    { source: "instagram", data: { history: [{ date: "2026-08-08", followers_total: 90 }, { date: "2026-08-11", followers_total: 100 }] } },
  ] } }));
  const newerUnpaired = evaluateMonitoringCandidate(artist, { ...row, extended: latestLicensed, source_evidence: { ...row.source_evidence,
    currentHistory: { ...row.source_evidence.currentHistory, latestSnapshots: nativePair } } }, now);
  assert.equal((newerUnpaired.sourceEvidence["dailyPulse"] as { complete: boolean }).complete, false);
  assert.ok(newerUnpaired.findings.some(finding => finding.code === "missing_daily_pulse_history" && finding.status === "investigation_required"));
});
