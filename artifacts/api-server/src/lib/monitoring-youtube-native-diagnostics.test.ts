import assert from "node:assert/strict";
import test from "node:test";
import { buildMonitoringYoutubeNativeDiagnosticsSql, evaluateMonitoringYoutubeNativeInspection,
  MONITORING_YOUTUBE_NATIVE_INSPECTION_VERSION } from "./monitoring-youtube-native-diagnostics";
import { buildMonitoringYoutubeEligibleVideosSql } from "./monitoring-youtube-serving";
import { evaluateMonitoringCandidate, groupMonitoringCandidateIdentities } from "./monitoring-candidate-policy";

const fixtureModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
const clock = "2026-11-02T18:00:00.123456Z";
const keys = ["canonical", "vetted alias"];
const query = `WITH eligible AS MATERIALIZED (${buildMonitoringYoutubeEligibleVideosSql("$1::text[]")})
  SELECT (${buildMonitoringYoutubeNativeDiagnosticsSql("$1::text[]", "SELECT video_id,has_approved_link FROM eligible", "$2::timestamptz")}) proof`;
const emptyBucket = (scope: string) => ({ scope, eligibleVideos: 0, videosWithAnySamples: 0, videosWithTrustedSamples: 0,
  videosWithoutTrustedSamples: 0, videosWithOneDate: 0, videosWithMultipleDates: 0, videosWithAllRequestedDates: 0,
  renderableVideosWithMultipleDates: 0, unrenderableVideos: 0, rawObservationCount: 0, selectedPointCount: 0,
  missingVideoDates: 0, invalidSelectedPointCount: 0, missingTrackedVideos: 0, invalidVideoIds: 0, minimumObservedDates: null as number | null,
  maximumObservedDates: null as number | null, firstObservedAt: null as string | null, lastObservedAt: null as string | null });
function proofFixture() {
  const approved = { ...emptyBucket("approved"), eligibleVideos: 2, videosWithAnySamples: 2, videosWithTrustedSamples: 2,
    videosWithMultipleDates: 2, renderableVideosWithMultipleDates: 2, rawObservationCount: 4, selectedPointCount: 4,
    missingVideoDates: 176, minimumObservedDates: 2, maximumObservedDates: 2,
    firstObservedAt: "2026-11-01T18:00:00.000001Z", lastObservedAt: "2026-11-02T17:00:00.999999Z" };
  return { inspectionVersion: MONITORING_YOUTUBE_NATIVE_INSPECTION_VERSION, inspected: true, sourceKeys: keys,
    servingContractVersion: "monitoring_youtube_native_history_v1",
    sourceTable: "youtube_video_intraday_shadow_snapshots", trustedSourceType: "youtube_api_shadow",
    kind: "native_intraday_cumulative", selection: "last_observation_per_et_date", substitutesForApprovedDailySnapshots: false,
    allTimeCoverageInspected: false, timeZone: "America/New_York", rangeDays: 90, captureClock: clock,
    startDate: "2026-08-05", endDate: "2026-11-02", startsAt: "2026-08-05T04:00:00.000000Z",
    buckets: [approved, emptyBucket("candidate_only")], sourceTypes: [{ scope: "approved", sourceType: "youtube_api_shadow",
      rows: 4, nonNullViews: 4, videos: 2, firstObservedAt: approved.firstObservedAt, lastObservedAt: approved.lastObservedAt }] };
}

test("native inspection requires exact keys, independent microsecond clock, provenance and Eastern window", () => {
  const proof = proofFixture();
  const options = { sourceKeys: keys, captureClocks: [clock, "2026-11-02T13:00:00.123456-05:00"], approvedTrackedVideos: 2 };
  assert.equal(evaluateMonitoringYoutubeNativeInspection(proof, options).status, "complete");
  assert.equal(evaluateMonitoringYoutubeNativeInspection(proof, options).approvedOutcome, "present_partial");
  assert.deepEqual(evaluateMonitoringYoutubeNativeInspection(proof, options).proof, proof);
  for (const bad of [
    { sourceKeys: ["canonical"] }, { captureClocks: [] }, { captureClocks: [null] },
    { captureClocks: ["2026-11-02T18:00:00.123455Z"] }, { captureClocks: [clock, "2026-11-02T18:00:00.123457Z"] },
    { identityConflict: true }, { approvedTrackedVideos: 1 }, { approvedTrackedVideos: undefined },
  ]) assert.equal(evaluateMonitoringYoutubeNativeInspection(proof, { ...options, ...bad }).status, "invalid", JSON.stringify(bad));
  for (const bad of [
    { sourceKeys: ["canonical", "vetted alias", "unrelated"] }, { sourceKeys: ["canonical", "canonical"] },
    { sourceTable: "protected_comparator" }, { trustedSourceType: "unknown_source" },
    { servingContractVersion: "unreviewed_endpoint" }, { inspectionVersion: "monitoring_youtube_native_history_inspection_v1" },
    { substitutesForApprovedDailySnapshots: true }, { rangeDays: 89 }, { allTimeCoverageInspected: true },
    { startDate: "2026-08-06" }, { startsAt: "2026-08-05T05:00:00.000000Z" },
    { captureClock: "2026-11-02T18:00:00.123Z" }, { endDate: "2026-11-03" },
  ]) assert.equal(evaluateMonitoringYoutubeNativeInspection({ ...proof, ...bad }, options).status, "invalid", JSON.stringify(bad));
  assert.equal(evaluateMonitoringYoutubeNativeInspection(null, options).status, "uninspected");
  for (const missing of ["youtube_video_intraday_shadow_snapshots", "youtube_artist_video_links", "youtube_music_catalog_candidates", "youtube_tracked_videos"])
    assert.equal(evaluateMonitoringYoutubeNativeInspection(proof, { ...options, missingTables: [missing] }).status, "unavailable");
});

test("native inspection rejects contradictory per-video partitions, points, source inventory and timestamps", () => {
  const options = { sourceKeys: keys, captureClocks: [clock] };
  const changes = [
    { videosWithAllRequestedDates: 2, maximumObservedDates: 90 },
    { videosWithAllRequestedDates: 1, maximumObservedDates: 90 },
    { minimumObservedDates: 1 }, { maximumObservedDates: 3 },
    { rawObservationCount: 0 }, { missingVideoDates: 175 }, { missingTrackedVideos: 3 }, { invalidVideoIds: 3 },
    { videosWithOneDate: 1 }, { invalidSelectedPointCount: 1 },
    { lastObservedAt: "2026-11-02T18:00:00.123457Z" }, { firstObservedAt: "2026-08-05T03:59:59.999999Z" },
  ];
  for (const patch of changes) {
    const proof = proofFixture();Object.assign(proof.buckets[0]!, patch);
    assert.equal(evaluateMonitoringYoutubeNativeInspection(proof, options).status, "invalid", JSON.stringify(patch));
  }
  for (const patch of [{ videos: 1 }, { rows: 3 }, { nonNullViews: 3 }, { scope: "candidate_only" },
    { firstObservedAt: "2026-11-01T18:00:00.000002Z" }, { lastObservedAt: "2026-11-02T17:00:00.999998Z" }]) {
    const proof = proofFixture();Object.assign(proof.sourceTypes[0]!, patch);
    assert.equal(evaluateMonitoringYoutubeNativeInspection(proof, options).status, "invalid", JSON.stringify(patch));
  }
  const proof = proofFixture();proof.sourceTypes.push({ ...proof.sourceTypes[0]! });
  assert.equal(evaluateMonitoringYoutubeNativeInspection(proof, options).status, "invalid");
  const impossibleDates = proofFixture();
  for (const row of [impossibleDates.buckets[0]!, impossibleDates.sourceTypes[0]!]) {
    row.firstObservedAt = "2026-11-02T16:00:00.000000Z";row.lastObservedAt = "2026-11-02T17:00:00.000000Z";
  }
  assert.equal(evaluateMonitoringYoutubeNativeInspection(impossibleDates, options).reason, "observed_dates_exceed_timestamp_span");
});

const schema = `
  CREATE TABLE youtube_artist_video_links(id serial,artist_key text,artist_name text,video_id text,
    confidence_score integer,priority integer,active boolean,source_type text);
  CREATE TABLE youtube_music_catalog_candidates(id serial,artist_key text,artist_name text,video_id text,
    confidence_score integer,status text,sampling_status text,evidence_source text);
  CREATE TABLE youtube_tracked_videos(video_id text PRIMARY KEY);
  CREATE TABLE youtube_video_intraday_shadow_snapshots(id serial,video_id text,observed_at timestamptz,
    bucket_start timestamptz,view_count bigint,source_type text);
  CREATE INDEX ON youtube_video_intraday_shadow_snapshots(video_id,bucket_start);
  CREATE INDEX ON youtube_video_intraday_shadow_snapshots(observed_at);
  INSERT INTO youtube_artist_video_links(artist_key,video_id,confidence_score,active) VALUES
    ('canonical','empty000001',90,true),('canonical','single00001',90,true),('canonical','multi000001',90,true),
    ('vetted alias','multi000001',90,true),('canonical','sparse00001',90,true),('canonical','full0000001',90,true),
    ('canonical','wrong000001',90,true),('canonical','null0000001',90,true),('canonical','invalid0001',90,true),
    ('canonical','missing0001',90,true),('canonical','future00001',90,true),
    ('canonical','inactive',100,false),('canonical','low-confidence',79,true),('unrelated','other',90,true);
  INSERT INTO youtube_music_catalog_candidates(artist_key,video_id,confidence_score,status,sampling_status) VALUES
    ('canonical','multi000001',99,'review','shadow'),('vetted alias','canone00001',90,'review','shadow'),
    ('canonical','canmulti001',90,'verified','shadow'),('canonical','rejected',90,'rejected','shadow'),
    ('canonical','paused',90,'verified','paused');
  INSERT INTO youtube_tracked_videos SELECT DISTINCT video_id FROM youtube_artist_video_links WHERE video_id!='missing0001'
    UNION SELECT video_id FROM youtube_music_catalog_candidates;
  INSERT INTO youtube_video_intraday_shadow_snapshots(video_id,observed_at,view_count,source_type) VALUES
    ('single00001','2026-11-02T17:00:00Z',0,'youtube_api_shadow'),
    ('multi000001','2026-11-01T05:30:00Z',10,'youtube_api_shadow'),
    ('multi000001','2026-11-01T06:30:00Z',11,'youtube_api_shadow'),
    ('multi000001','2026-11-02T17:00:00.123455Z',-1,'youtube_api_shadow'),
    ('multi000001','2026-11-02T17:00:00.123456Z',12,'youtube_api_shadow'),
    ('multi000001','2026-11-02T17:00:00.123456Z',0,'youtube_api_shadow'),
    ('multi000001','2026-11-02T17:00:00.123455Z',-1,'youtube_api_shadow'),
    ('multi000001','2026-11-02T17:50:00Z',NULL,'youtube_api_shadow'),
    ('multi000001','2026-11-02T17:59:00Z',999,'unknown_source'),
    ('sparse00001','2026-08-05T04:00:00.000001Z',1,'youtube_api_shadow'),
    ('sparse00001','2026-11-02T17:00:00Z',100,'youtube_api_shadow'),
    ('wrong000001','2026-11-02T17:00:00Z',99,'unapproved_source'),
    ('null0000001','2026-11-02T17:00:00Z',NULL,'youtube_api_shadow'),
    ('null0000001','2026-11-02T17:00:00Z',44,NULL),
    ('invalid0001','2026-11-01T17:00:00Z',-1,'youtube_api_shadow'),
    ('invalid0001','2026-11-02T17:00:00Z',9007199254740992,'youtube_api_shadow'),
    ('future00001','2026-11-02T18:00:00.123457Z',55,'youtube_api_shadow'),
    ('empty000001','2026-08-05T03:59:59.999999Z',55,'youtube_api_shadow'),
    ('empty000001','2020-01-01T12:00:00Z',55,'youtube_api_shadow'),
    ('canone00001','2026-11-02T17:00:00Z',0,'youtube_api_shadow'),
    ('canmulti001','2026-11-01T17:00:00Z',0,'youtube_api_shadow'),
    ('canmulti001','2026-11-02T17:00:00Z',1,'youtube_api_shadow'),
    ('other','2026-11-01T17:00:00Z',888,'youtube_api_shadow'),
    ('rejected','2026-11-01T17:00:00Z',888,'youtube_api_shadow');
  INSERT INTO youtube_video_intraday_shadow_snapshots(video_id,observed_at,view_count,source_type)
    SELECT 'full0000001',(date '2026-08-05'+day+time '12:00') AT TIME ZONE 'America/New_York',0,'youtube_api_shadow'
    FROM generate_series(0,89) day;
`;

test("real PostgreSQL native inspection reconciles relationship-first coverage, aliases, exact samples and excluded sources", { skip: !fixtureModule }, async () => {
  const { PGlite } = await import(fixtureModule!);const db = new PGlite();
  try {
    await db.exec(schema);
    const proof = (await db.query(query, [keys, clock])).rows[0].proof;
    const result = evaluateMonitoringYoutubeNativeInspection(proof, { sourceKeys: keys, captureClocks: [clock], approvedTrackedVideos: 9 });
    assert.equal(result.status, "complete", result.reason);assert.equal(result.approvedOutcome, "present_unrenderable");
    assert.equal(proof.startDate, "2026-08-05");assert.equal(proof.startsAt, "2026-08-05T04:00:00.000000Z");
    const approved = proof.buckets.find((bucket: any) => bucket.scope === "approved");
    assert.deepEqual(approved, { scope: "approved", eligibleVideos: 10, videosWithAnySamples: 7, videosWithTrustedSamples: 5,
      videosWithoutTrustedSamples: 5, videosWithOneDate: 1, videosWithMultipleDates: 4, videosWithAllRequestedDates: 1,
      renderableVideosWithMultipleDates: 3, unrenderableVideos: 1, rawObservationCount: 101, selectedPointCount: 97,
      missingVideoDates: 803, invalidSelectedPointCount: 2, missingTrackedVideos: 1, invalidVideoIds: 0, minimumObservedDates: 0, maximumObservedDates: 90,
      firstObservedAt: "2026-08-05T04:00:00.000001Z", lastObservedAt: "2026-11-02T17:00:00.123456Z" });
    const candidate = proof.buckets.find((bucket: any) => bucket.scope === "candidate_only");
    assert.equal(candidate.eligibleVideos, 2);assert.equal(candidate.videosWithOneDate, 1);assert.equal(candidate.videosWithMultipleDates, 1);
    assert.equal(candidate.rawObservationCount, 3);assert.equal(candidate.selectedPointCount, 3);
    assert.equal(proof.sourceTypes.find((source: any) => source.scope === "approved" && source.sourceType === "youtube_api_shadow").nonNullViews, 101);
    assert.ok(proof.sourceTypes.some((source: any) => source.sourceType === null));
    assert.ok(proof.sourceTypes.some((source: any) => source.sourceType === "unknown_source"));
    assert.equal(proof.sourceTypes.reduce((count: number, source: any) => count + source.rows, 0), 109);
    const blank = (await db.query(query, [["not-related"], clock])).rows[0].proof;
    assert.equal(evaluateMonitoringYoutubeNativeInspection(blank, { sourceKeys: ["not-related"], captureClocks: [clock], approvedTrackedVideos: 0 }).approvedOutcome, "no_approved_relationships");
    assert.deepEqual(blank.buckets, [emptyBucket("approved"), emptyBucket("candidate_only")]);
    const { monitoringSourceSummary } = await import("../../../mexico-charts/src/lib/monitoringFounder.mjs");
    const artist = groupMonitoringCandidateIdentities(keys.map(artist_key => ({ artist_key, artist_name: null, source: "kworb_coverage",
      spotify_id: "0000000000000000000101" })))[0]!;
    const evaluated = evaluateMonitoringCandidate(artist, { artist_key: artist.artistKey, native_history_captured_at: clock,
      extended: [], snapshot: null, summary: null, raw_summary: null, legacy: [],
      audit_captured_at: "2026-11-02T13:00:00.123456-05:00", source_evidence: {
        youtube: { approvedVideos: 9 }, youtubeHistory: { days: 0, videos: 0, videosWithHistory: 0 },
        youtubeServing: { inspected: true, nativeIntradayHistory: proof },
      } }, new Date(clock));
    assert.equal((evaluated.sourceEvidence.youtubeNativeHistoryInspection as any).status, "complete");
    assert.ok(!evaluated.findings.some(finding => finding.code === "youtube_native_intraday_fallback_uninvestigated"));
    assert.ok(evaluated.findings.some(finding => finding.code === "missing_youtube_daily_history" && finding.status === "investigation_required"));
    assert.ok(evaluated.findings.some(finding => finding.code === "youtube_native_history_contract_review_required"));
    assert.equal(evaluated.publicEligible, false);
    const summary = monitoringSourceSummary(evaluated.sourceEvidence);
    assert.ok(summary.some((row: string[]) => row[1]!.includes("Consulta del archivo completada")));
    assert.ok(summary.some((row: string[]) => row[1]!.includes("4 / 10 videos")));
    assert.ok(summary.some((row: string[]) => row[1]!.includes(clock)));
    assert.ok(summary.some((row: string[]) => row[1]!.includes("Solo inspección interna")));
  } finally { await db.close(); }
});

test("native inspection remains one bounded SELECT over a realistic synthetic archive", { skip: !fixtureModule }, async context => {
  const { PGlite } = await import(fixtureModule!);const db = new PGlite();
  try {
    await db.exec(schema);
    await db.exec(`INSERT INTO youtube_artist_video_links(artist_key,video_id,confidence_score,active)
      SELECT 'benchmark','bench'||lpad(video::text,6,'0'),90,true FROM generate_series(1,100) video;
      INSERT INTO youtube_tracked_videos SELECT 'bench'||lpad(video::text,6,'0') FROM generate_series(1,100) video;
      INSERT INTO youtube_video_intraday_shadow_snapshots(video_id,observed_at,bucket_start,view_count,source_type)
      SELECT 'bench'||lpad(video::text,6,'0'),instant,instant,video*1000+day,'youtube_api_shadow'
      FROM generate_series(1,100) video CROSS JOIN generate_series(0,89) day CROSS JOIN generate_series(0,3) sample
      CROSS JOIN LATERAL(SELECT (date '2026-08-05'+day+(time '01:00'+sample*interval '3 hours')) AT TIME ZONE 'America/New_York' instant) instant;
      INSERT INTO youtube_video_intraday_shadow_snapshots(video_id,observed_at,bucket_start,view_count,source_type)
      SELECT 'unrelated-'||video,'2026-11-01'::timestamptz,'2026-11-01'::timestamptz,1,'youtube_api_shadow' FROM generate_series(1,20000) video;
      ANALYZE youtube_video_intraday_shadow_snapshots;`);
    const timings: number[] = [];let proof: any;
    for (let run = 0; run < 4; run++) {
      const started = performance.now();proof = (await db.query(query, [["benchmark"], clock])).rows[0].proof;
      if (run) timings.push(Math.round((performance.now() - started) * 100) / 100);
    }
    const result = evaluateMonitoringYoutubeNativeInspection(proof, { sourceKeys: ["benchmark"], captureClocks: [clock], approvedTrackedVideos: 100 });
    assert.equal(result.status, "complete", result.reason);assert.equal(result.approvedOutcome, "present_all_requested_dates");
    assert.equal(proof.buckets[0].rawObservationCount, 36_000);assert.equal(proof.buckets[0].selectedPointCount, 9_000);
    assert.equal(proof.buckets[0].videosWithAllRequestedDates, 100);assert.equal(proof.buckets[0].missingVideoDates, 0);
    context.diagnostic(JSON.stringify({ fixture: "synthetic_pglite_not_production", relevantObservations: 36000, unrelatedObservations: 20000,
      warmedQueryMs: timings, outputBytes: Buffer.byteLength(JSON.stringify(proof)), rangeDays: 90 }));
    assert.equal((query.match(/FROM youtube_video_intraday_shadow_snapshots/g) ?? []).length, 1);
    assert.match(query, /s\.observed_at >= .*s\.observed_at <= b\.as_of/);
    assert.doesNotMatch(query, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER)\b|validation_comparator/i);
  } finally { await db.close(); }
});

test("real PostgreSQL inventories malformed approved and candidate IDs independently of tracked rows and renderable samples", { skip: !fixtureModule }, async () => {
  const { PGlite } = await import(fixtureModule!);const db = new PGlite();
  try {
    await db.exec(schema);
    await db.exec(`INSERT INTO youtube_artist_video_links(artist_key,video_id,confidence_score,active) VALUES
      ('bad-ids','bad tracked id',90,true),('bad-empty','bad empty id',90,true),('missing-tracked','missing0002',90,true);
      INSERT INTO youtube_music_catalog_candidates(artist_key,video_id,confidence_score,status,sampling_status)
        VALUES ('bad-ids','candidate invalid',90,'review','shadow');
      INSERT INTO youtube_tracked_videos(video_id) VALUES('bad tracked id'),('candidate invalid'),('bad empty id');
      INSERT INTO youtube_video_intraday_shadow_snapshots(video_id,observed_at,view_count,source_type)
      SELECT video,(date '2026-11-01'+day+time '12:00') AT TIME ZONE 'America/New_York',0,'youtube_api_shadow'
      FROM (VALUES('bad tracked id'),('candidate invalid')) videos(video) CROSS JOIN generate_series(0,1) day;`);
    const proof = (await db.query(query, [["bad-ids"], clock])).rows[0].proof;
    const inspected = evaluateMonitoringYoutubeNativeInspection(proof, { sourceKeys: ["bad-ids"], captureClocks: [clock], approvedTrackedVideos: 1 });
    assert.equal(inspected.status, "complete");
    for (const bucket of proof.buckets) {
      assert.equal(bucket.eligibleVideos, 1);assert.equal(bucket.invalidVideoIds, 1);assert.equal(bucket.missingTrackedVideos, 0);
      assert.equal(bucket.renderableVideosWithMultipleDates, 1, "valid numeric readings do not repair a malformed video identifier");
    }
    for (const [key, invalidIds, missingTracked] of [["bad-empty", 1, 0], ["missing-tracked", 0, 1]] as const) {
      const empty = (await db.query(query, [[key], clock])).rows[0].proof;
      assert.equal(evaluateMonitoringYoutubeNativeInspection(empty, { sourceKeys: [key], captureClocks: [clock], approvedTrackedVideos: 1 - missingTracked }).status, "complete");
      assert.equal(empty.buckets[0].invalidVideoIds, invalidIds);assert.equal(empty.buckets[0].missingTrackedVideos, missingTracked);
      assert.equal(empty.buckets[0].rawObservationCount, 0);
    }
  } finally { await db.close(); }
});
