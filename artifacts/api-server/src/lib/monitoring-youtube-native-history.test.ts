import assert from "node:assert/strict";
import test from "node:test";
import { loadMonitoringYoutubeNativeHistory, MonitoringYoutubeVideoAccessError, MONITORING_YOUTUBE_NATIVE_HISTORY_SQL } from "./monitoring-youtube-native-history";

const fixtureModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
const schema = `
  CREATE TABLE youtube_artist_video_links(id serial,artist_key text,artist_name text,video_id text,
    confidence_score integer,priority integer,active boolean,source_type text);
  CREATE TABLE youtube_music_catalog_candidates(id serial,artist_key text,artist_name text,video_id text,
    confidence_score integer,status text,sampling_status text,evidence_source text);
  CREATE TABLE youtube_video_intraday_shadow_snapshots(id serial,video_id text,observed_at timestamptz,view_count bigint,source_type text);
  INSERT INTO youtube_artist_video_links(artist_key,artist_name,video_id,confidence_score,priority,active,source_type) VALUES
    ('canonical','Artist','approved001',90,10,true,'approved_catalog'),
    ('vetted alias','Artist','approved001',90,10,true,'approved_catalog'),
    ('canonical','Artist','empty000001',90,10,true,'approved_catalog'),
    ('canonical','Artist','complete001',90,10,true,'approved_catalog'),
    ('canonical','Artist','inactive001',100,10,false,'approved_catalog'),
    ('canonical','Artist','lowconf0001',79,10,true,'approved_catalog'),
    ('unrelated','Other','unrelated01',90,10,true,'approved_catalog');
  INSERT INTO youtube_music_catalog_candidates(artist_key,artist_name,video_id,confidence_score,status,sampling_status,evidence_source) VALUES
    ('canonical','Artist','approved001',99,'review','shadow','youtube_music_innertube'),
    ('vetted alias','Artist','review00001',90,'review','shadow','youtube_music_innertube'),
    ('canonical','Artist','verify00001',90,'verified','shadow','youtube_music_innertube'),
    ('canonical','Artist','rejected001',90,'rejected','shadow','youtube_music_innertube'),
    ('canonical','Artist','paused00001',90,'verified','paused','youtube_music_innertube');
  INSERT INTO youtube_video_intraday_shadow_snapshots(id,video_id,observed_at,view_count,source_type) VALUES
    (1,'approved001','2026-10-27T03:59:59Z',99999,'youtube_api_shadow'),
    (2,'approved001','2026-10-27T04:00:00.000001Z',10,'youtube_api_shadow'),
    (3,'approved001','2026-10-27T12:00:00Z',20,'youtube_api_shadow'),
    (4,'approved001','2026-11-01T05:30:00Z',100,'youtube_api_shadow'),
    (5,'approved001','2026-11-01T06:30:00Z',110,'youtube_api_shadow'),
    (6,'approved001','2026-11-01T23:00:00.123456Z',120,'youtube_api_shadow'),
    (7,'approved001','2026-11-01T23:00:00.123456Z',130,'youtube_api_shadow'),
    (8,'approved001','2026-11-02T17:00:00.654321Z',0,'youtube_api_shadow'),
    (9,'approved001','2026-11-02T17:50:00Z',NULL,'youtube_api_shadow'),
    (10,'approved001','2026-11-02T17:59:00Z',99999,'unknown_source'),
    (11,'approved001','2026-11-02T18:01:00Z',99999,'youtube_api_shadow'),
    (12,'approved001','2020-01-01T12:00:00Z',99999,'youtube_api_shadow'),
    (13,'review00001','2026-11-02T17:00:00Z',200,'youtube_api_shadow'),
    (14,'verify00001','2026-11-02T17:00:00Z',300,'youtube_api_shadow'),
    (15,'unrelated01','2026-11-02T17:00:00Z',99999,'youtube_api_shadow'),
    (16,'empty000001','2026-11-02T17:00:00Z',NULL,'youtube_api_shadow'),
    (17,'empty000001','2026-11-02T17:00:00Z',99999,'unknown_source'),
    (18,'approved001','2026-11-01T23:00:00.123455Z',99999,'youtube_api_shadow');
  INSERT INTO youtube_video_intraday_shadow_snapshots(video_id,observed_at,view_count,source_type)
    SELECT 'complete001',(date '2026-10-27'+day+time '12:00') AT TIME ZONE 'America/New_York',0,'youtube_api_shadow'
    FROM generate_series(0,6) day;
`;

async function withFixture(run: (queryable: any) => Promise<void>) {
  const { PGlite } = await import(fixtureModule!);
  const db = new PGlite();
  try {
    await db.exec(schema);
    await run({ query: (sql: string, params: unknown[]) => db.query(sql.replace("SELECT now() as_of", "SELECT '2026-11-02T18:00:00Z'::timestamptz as_of"), params) });
  } finally { await db.close(); }
}

const input = (queryable: any, videoId = "approved001", includeCandidateOnly = false) => ({
  queryable, artistKey: "canonical", artistKeys: ["canonical", "vetted alias"], videoId,
  range: "7d" as const, includeCandidateOnly, deadlineAt: Date.now() + 12_000,
});

test("native video history preserves exact observed cumulative samples, alias deduplication and Eastern gaps", { skip: !fixtureModule }, async () => withFixture(async queryable => {
  const result = await loadMonitoringYoutubeNativeHistory(input(queryable));
  assert.equal(result.kind, "native_intraday_cumulative");
  assert.equal(result.selection, "last_observation_per_et_date");
  assert.equal(result.sourceType, "youtube_api_shadow");
  assert.equal(result.sourceTable, "youtube_video_intraday_shadow_snapshots");
  assert.equal(result.timeZone, "America/New_York");
  assert.equal(result.startDate, "2026-10-27");assert.equal(result.endDate, "2026-11-02");
  assert.equal(result.asOf, "2026-11-02T18:00:00.000000Z");
  assert.equal(result.status, "partial");
  assert.deepEqual(result.points, [
    { date: "2026-10-27", observedAt: "2026-10-27T12:00:00.000000Z", observationId: "3", viewCount: 20 },
    { date: "2026-11-01", observedAt: "2026-11-01T23:00:00.123456Z", observationId: "7", viewCount: 130 },
    { date: "2026-11-02", observedAt: "2026-11-02T17:00:00.654321Z", observationId: "8", viewCount: 0 },
  ]);
  assert.deepEqual(result.coverage, { requestedDays: 7, observedDays: 3, rawObservationCount: 8,
    missingDates: ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"],
    firstObservedAt: "2026-10-27T04:00:00.000001Z", lastObservedAt: "2026-11-02T17:00:00.654321Z", meaning: "observed_dates_only" });
  assert.equal(result.points[1]?.observationId, "7", "a higher ID one microsecond earlier cannot defeat the actual latest timestamp; an exact timestamp tie uses ID");
  assert.equal(result.relationship.hasApprovedLink, true);
  assert.equal(result.relationship.visibilityScope, "approved_artist_link");
  assert.equal(result.relationship.relationStatus, "active");
  assert.equal(result.relationship.relationSource, "youtube_artist_video_links");
  assert.equal(result.relationship.samplingStatus, null);
  assert.equal(result.relationship.relationshipSources.length, 2);
  assert.ok(result.relationship.relationshipSources.every(source => source.source_table === "youtube_artist_video_links" && source.status === "active"));
  assert.doesNotMatch(JSON.stringify(result.relationship), /youtube_music_catalog_candidates|youtube_music_innertube|review|shadow/,
    "a higher-confidence review candidate never leaks founder-only relationship diagnostics to a subscriber");
  assert.equal(result.relationship.relationshipSources[0]?.evidence_source, "approved_catalog", "actual approved provenance is retained");
  const founder = await loadMonitoringYoutubeNativeHistory(input(queryable, "approved001", true));
  assert.equal(founder.relationship.hasApprovedLink, true);
  assert.equal(founder.relationship.relationStatus, "review", "the founder retains the actual selected candidate relationship");
  assert.equal(founder.relationship.samplingStatus, "shadow");
  assert.equal(founder.relationship.relationshipSources.length, 3);
  assert.ok(founder.relationship.relationshipSources.some(source => source.source_table === "youtube_music_catalog_candidates" && source.evidence_source === "youtube_music_innertube"));
  assert.deepEqual(founder.points, result.points, "subscriber serialization changes no native observations");
  assert.deepEqual(founder.coverage, result.coverage);
  assert.equal(founder.sourceTable, result.sourceTable);assert.equal(founder.sourceType, result.sourceType);
  assert.ok(result.points.every(point => !Object.hasOwn(point, "daily_view_delta") && !Object.hasOwn(point, "snapshot_date")));
}));

test("native history enforces approved membership for paid access and preserves founder candidate provenance", { skip: !fixtureModule }, async () => withFixture(async queryable => {
  for (const videoId of ["review00001", "verify00001"]) {
    await assert.rejects(loadMonitoringYoutubeNativeHistory(input(queryable, videoId)), MonitoringYoutubeVideoAccessError);
    const founder = await loadMonitoringYoutubeNativeHistory(input(queryable, videoId, true));
    assert.equal(founder.relationship.hasApprovedLink, false);
    assert.equal(founder.relationship.visibilityScope, "founder_candidate_diagnostic");
    assert.equal(founder.relationship.relationStatus, videoId === "review00001" ? "review" : "verified");
    assert.equal(founder.relationship.relationshipSources[0]?.evidence_source, "youtube_music_innertube");
  }
  for (const videoId of ["unrelated01", "inactive001", "lowconf0001", "rejected001", "paused00001", "missing0001"]) {
    for (const founder of [false, true]) await assert.rejects(loadMonitoringYoutubeNativeHistory(input(queryable, videoId, founder)), MonitoringYoutubeVideoAccessError);
  }
  await assert.rejects(loadMonitoringYoutubeNativeHistory({ ...input(queryable, "review00001", true), artistKeys: ["canonical"] }), MonitoringYoutubeVideoAccessError,
    "a candidate on a vetted alias is available only when that alias belongs to the authorized source identity");
}));

test("empty, complete date coverage and requested range are explicit without inventing observations", { skip: !fixtureModule }, async () => withFixture(async queryable => {
  const empty = await loadMonitoringYoutubeNativeHistory(input(queryable, "empty000001"));
  assert.equal(empty.status, "empty");assert.deepEqual(empty.points, []);
  assert.equal(empty.coverage.rawObservationCount, 0);assert.equal(empty.coverage.missingDates.length, 7);
  assert.equal(empty.coverage.firstObservedAt, null);assert.equal(empty.coverage.lastObservedAt, null);
  const complete = await loadMonitoringYoutubeNativeHistory(input(queryable, "complete001"));
  assert.equal(complete.status, "complete");assert.equal(complete.points.length, 7);
  assert.deepEqual(complete.coverage.missingDates, []);assert.ok(complete.points.every(point => point.viewCount === 0));
  for (const range of ["30d", "90d"] as const) {
    const result = await loadMonitoringYoutubeNativeHistory({ ...input(queryable), range });
    assert.equal(result.coverage.requestedDays, range === "30d" ? 30 : 90);
    assert.equal(result.status, "partial");
    assert.equal(result.points.length, 4, "the older real October26 ET sample now falls inside the requested range");
    assert.equal(result.coverage.rawObservationCount, 9);
  }
}));

test("native history starts no query after its deadline and a failed query never becomes empty", async () => {
  let reads = 0;
  const queryable = { query: async () => { reads++; throw new Error("fixture query failure"); } } as any;
  await assert.rejects(loadMonitoringYoutubeNativeHistory({ ...input(queryable), deadlineAt: 0 }), /deadline/);
  await assert.rejects(loadMonitoringYoutubeNativeHistory({ ...input(queryable), artistKeys: [] }), /Invalid authorized/);
  await assert.rejects(loadMonitoringYoutubeNativeHistory({ ...input(queryable), videoId: "../outside" }), /Invalid authorized/);
  assert.equal(reads, 0);
  await assert.rejects(loadMonitoringYoutubeNativeHistory(input(queryable)), /fixture query failure/);
  assert.equal(reads, 1);
  assert.doesNotMatch(MONITORING_YOUTUBE_NATIVE_HISTORY_SQL, /youtube_discovery_validation_|youtube_video_daily_snapshots|youtube_channel_daily_snapshots|\b(?:INSERT|UPDATE|DELETE)\b/);
});
