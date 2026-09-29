import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonitoringYoutubeEligibleVideosSql,
  buildMonitoringYoutubeDailyHistorySql,
  buildMonitoringYoutubeDiagnosticsSql,
  loadMonitoringYoutubeLiveVideos,
  loadMonitoringYoutubeDailyHistory,
  loadMonitoringYoutubeSummary,
  loadMonitoringYoutubePage,
  parseMonitoringVideoPage,
} from "./monitoring-youtube-serving";

const fixtureModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
const schema = `
  CREATE TABLE youtube_artist_video_links (id integer, artist_key text, artist_name text, video_id text,
    confidence_score integer, priority integer, active boolean, source_type text);
  CREATE TABLE youtube_music_catalog_candidates (id integer, artist_key text, artist_name text, video_id text,
    confidence_score integer, status text, sampling_status text, evidence_source text);
  CREATE TABLE youtube_tracked_videos (video_id text PRIMARY KEY, title text, thumbnail_url text,
    view_count bigint, last_snapshot_at timestamptz, updated_at timestamptz);
  CREATE TABLE youtube_video_intraday_latest_observations (video_id text PRIMARY KEY, latest_observed_at timestamptz);
  CREATE TABLE youtube_video_intraday_shadow_snapshots (video_id text, observed_at timestamptz,
    view_count bigint, view_delta bigint, seconds_since_previous integer, source_type text, id serial);
  CREATE TABLE youtube_video_daily_snapshots (video_id text, snapshot_date text, view_count bigint,
    daily_view_delta bigint, fetched_at timestamptz, PRIMARY KEY(video_id,snapshot_date));
  CREATE TABLE youtube_channels (artist_key text, channel_id text);
  CREATE TABLE youtube_videos (video_id text, channel_id text, view_count bigint, cached_at timestamptz);
  CREATE TABLE youtube_channel_daily_snapshots (artist_key text, channel_id text, snapshot_date text,
    view_count bigint, daily_view_delta bigint, source_type text, fetched_at timestamptz);
`;

async function fixture(run: (database: any) => Promise<void>) {
  const { PGlite } = await import(fixtureModule!);
  const database = new PGlite();
  try { await database.exec(schema); await run(database); }
  finally { await database.close(); }
}

const candidates = `
  INSERT INTO youtube_music_catalog_candidates VALUES
    (1,'canonical','Artist','review-only',70,'review','shadow','youtube_music_innertube'),
    (2,'canonical','Artist','verified-only',95,'verified','shadow','youtube_music_innertube'),
    (3,'canonical','Artist','rejected',99,'rejected','shadow','youtube_music_innertube'),
    (4,'canonical','Artist','paused',99,'verified','paused','youtube_music_innertube'),
    (5,'canonical','Artist','disabled',99,'review','disabled','youtube_music_innertube'),
    (6,'other-artist','Other','unrelated',99,'verified','shadow','youtube_music_innertube');
  INSERT INTO youtube_tracked_videos VALUES
    ('review-only','Review','https://example.com/review.jpg',100,'2026-09-01T12:00:00Z','2026-09-01T12:00:00Z'),
    ('verified-only','Verified','https://example.com/verified.jpg',200,'2026-09-01T12:00:00Z','2026-09-01T12:00:00Z'),
    ('rejected','Rejected',null,999,null,null),('paused','Paused',null,999,null,null),
    ('disabled','Disabled',null,999,null,null),('unrelated','Unrelated',null,999,null,null);
  INSERT INTO youtube_video_intraday_latest_observations VALUES ('review-only','2026-09-02T12:00:00Z');
  INSERT INTO youtube_video_intraday_shadow_snapshots VALUES
    ('review-only','2026-09-02T12:00:00Z',0,0,300,'youtube_api_shadow'),
    ('review-only','2026-09-01T12:00:00Z',99999,123,300,'youtube_api_shadow');
  INSERT INTO youtube_video_daily_snapshots VALUES
    ('review-only','2026-09-01',0,null,'2026-09-01T12:00:00Z'),
    ('review-only','2026-09-02',0,0,'2026-09-02T12:00:00Z'),
    ('verified-only','2026-09-01',100,null,'2026-09-01T12:00:00Z'),
    ('verified-only','2026-09-02',200,100,'2026-09-02T12:00:00Z'),
    ('rejected','2026-09-02',999,999,'2026-09-02T12:00:00Z'),
    ('paused','2026-09-02',999,999,'2026-09-02T12:00:00Z'),
    ('disabled','2026-09-02',999,999,'2026-09-02T12:00:00Z'),
    ('unrelated','2026-09-02',999,999,'2026-09-02T12:00:00Z');
`;

test("bounded Panel summary uses identical eligibility, zero/null observation truth and top video", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(candidates);
  const full = await loadMonitoringYoutubeLiveVideos(database, ["canonical"]);
  const summary = await loadMonitoringYoutubeSummary(database, ["canonical"]);
  assert.equal(summary.total, full.length);
  assert.equal(summary.observed, full.filter(v => v.monitor_observed_at != null).length);
  assert.equal(summary.deltas, full.filter(v => v.view_delta != null).length);
  assert.equal(summary.topVideos.length, 1);
  assert.equal(summary.topVideos[0].video_id, full[0].video_id);
  assert.equal(summary.topVideos[0].view_count, full[0].view_count);
  assert.deepEqual(await loadMonitoringYoutubeSummary(database, ["absent"]), {total: 0, observed: 0, deltas: 0, topVideos: []});
}));

test("16,273-video catalog remains complete while Panel receives one featured row", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(`
    INSERT INTO youtube_artist_video_links SELECT n,'large','Large','v'||n,90,0,true,'youtube_uploads' FROM generate_series(1,16273) n;
    INSERT INTO youtube_tracked_videos SELECT 'v'||n,'Video '||n,null,n,null,null FROM generate_series(1,16273) n;
    INSERT INTO youtube_video_intraday_latest_observations SELECT 'v'||n,'2026-09-01T00:00:00Z'::timestamptz FROM generate_series(1,16273) n;
    INSERT INTO youtube_video_intraday_shadow_snapshots SELECT 'v'||n,'2026-09-01T00:00:00Z'::timestamptz,n,0,300,'youtube_api_shadow' FROM generate_series(1,16273) n;
  `);
  const summary = await loadMonitoringYoutubeSummary(database, ["large"]);
  assert.equal(summary.total, 16273); assert.equal(summary.observed, 16273); assert.equal(summary.deltas, 16273);
  assert.equal(summary.topVideos.length, 1);
  const full = await loadMonitoringYoutubeLiveVideos(database, ["large"]);
  assert.equal(full.length, 16273); assert.equal(new Set(full.map(v => v.video_id)).size, 16273);
  assert.ok(full.every(v => v.relationship_sources.length === 1 && Number(v.view_delta) === 0));
  const seen: string[] = [];
  for (let page = 1; page <= 272; page++) {
    const result = await loadMonitoringYoutubePage(database, ["large"], page);
    assert.equal(result.totalItems, 16273); assert.equal(result.totalPages, 272);
    assert.equal(result.items.length, page === 272 ? 13 : 60);
    assert.equal(result.hasPreviousPage, page > 1); assert.equal(result.hasNextPage, page < 272);
    for (const row of result.items) {
      const n = Number(row.video_id.slice(1));
      assert.equal(Number(row.view_count), n); assert.equal(Number(row.view_delta), 0);
      assert.equal(row.seconds_since_previous, 300);
      assert.equal(new Date(row.monitor_observed_at).toISOString(), "2026-09-01T00:00:00.000Z");
      assert.equal(row.observation_source_type, "youtube_api_shadow");
      assert.equal(row.relationship_sources[0].source_id, n);
      seen.push(row.video_id);
    }
  }
  assert.deepEqual(seen, full.map(v => v.video_id));
  assert.equal(new Set(seen).size, 16273);
  assert.deepEqual((await loadMonitoringYoutubePage(database, ["large"], 136)).items.map((v: any) => v.video_id), seen.slice(8100,8160));
  const outside = await loadMonitoringYoutubePage(database, ["large"], 273);
  assert.equal(outside.outOfRange, true); assert.deepEqual(outside.items, []);
}));

test("server pages preserve membership/provenance and zero versus missing readings", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(candidates);
  const full = await loadMonitoringYoutubeLiveVideos(database, ["canonical"]);
  const page = await loadMonitoringYoutubePage(database, ["canonical"], 1);
  assert.deepEqual(JSON.parse(JSON.stringify(page.items)), JSON.parse(JSON.stringify(full)));
  assert.equal(page.totalViews, "200");
  assert.deepEqual((await loadMonitoringYoutubePage(database, ["absent"], 1)).items, []);
  await assert.rejects(loadMonitoringYoutubePage(database, [], 1), /authorized artist identity/);
}));

test("0, 1, 59, 60 and 61 rows have exact page boundaries and stable equal-ranked ties", { skip: !fixtureModule }, async () => fixture(async database => {
  for (const count of [0,1,59,60,61]) {
    await database.exec(`TRUNCATE youtube_artist_video_links,youtube_tracked_videos;
      INSERT INTO youtube_artist_video_links SELECT n,'edge','Edge','v'||lpad(n::text,3,'0'),90,0,true,'uploads' FROM generate_series(1,${count}) n;
      INSERT INTO youtube_tracked_videos SELECT 'v'||lpad(n::text,3,'0'),'Equal',null,0,null,null FROM generate_series(1,${count}) n;`);
    const first = await loadMonitoringYoutubePage(database, ["edge"], 1);
    assert.equal(first.totalItems, count); assert.equal(first.items.length, Math.min(60,count));
    assert.equal(first.totalPages, count > 60 ? 2 : 1);
    assert.equal(first.outOfRange, false);
    assert.deepEqual(first.items.map((v: any) => v.video_id), Array.from({length: Math.min(60,count)}, (_, i) => `v${String(i+1).padStart(3,"0")}`));
    const second = await loadMonitoringYoutubePage(database, ["edge"], 2);
    assert.equal(second.outOfRange, count <= 60); assert.equal(second.items.length, count === 61 ? 1 : 0);
  }
}));

test("page validation and read errors fail closed rather than report an empty source", async () => {
  assert.deepEqual(parseMonitoringVideoPage(), {page:1,pageSize:60});
  for (const bad of ["0","-1","1.1","Infinity","NaN","9007199254740991",[],{},1]) assert.throws(() => parseMonitoringVideoPage(bad));
  for (const bad of ["0","61","10000",60,[]]) assert.throws(() => parseMonitoringVideoPage("1",bad));
  await assert.rejects(loadMonitoringYoutubePage({query: async () => { throw new Error("read timeout"); }} as any, ["a"],1), /read timeout/);
});

test("candidate-only served videos retain review/verified status and recover their real native daily history", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(candidates);
  assert.equal((await database.query("SELECT count(*)::int count FROM youtube_artist_video_links")).rows[0].count, 0);
  const videos = await loadMonitoringYoutubeLiveVideos(database, ["canonical"]);
  assert.deepEqual(videos.map(row => row.video_id).sort(), ["review-only", "verified-only"]);
  const review = videos.find(row => row.video_id === "review-only")!;
  assert.equal(Number(review.view_count), 0, "a real zero from the selected latest observation is retained");
  assert.equal(Number(review.view_delta), 0);
  assert.equal(review.observation_source_type, "youtube_api_shadow");
  assert.equal(review.view_count_source_table, "youtube_video_intraday_shadow_snapshots");
  assert.equal(review.relation_status, "review");
  assert.equal(review.sampling_status, "shadow");
  assert.equal(review.has_approved_link, false);
  assert.equal(review.relationship_sources[0].evidence_source, "youtube_music_innertube");
  const verified = videos.find(row => row.video_id === "verified-only")!;
  assert.equal(verified.relation_status, "verified");
  assert.equal(verified.has_approved_link, false, "verified candidate is not relabeled as an approved link");
  assert.equal(verified.view_count_source_table, "youtube_tracked_videos");
  assert.equal(verified.observation_source_type, null);
  const approvedHistory = (await database.query(buildMonitoringYoutubeDailyHistorySql("$1::text[]", "$2::text"), [["canonical"], "2026-09-01"])).rows;
  assert.deepEqual(approvedHistory, [], "paid history retains its prior approved-link authority");
  const history = (await database.query(buildMonitoringYoutubeDailyHistorySql("$1::text[]", "$2::text", { includeCandidateOnly: true }), [["canonical"], "2026-09-01"])).rows;
  assert.equal(history.length, 4);
  assert.ok(history.every((row: any) => row.source_table === "youtube_video_daily_snapshots"));
  assert.ok(history.every((row: any) => row.has_approved_link === false && row.sampling_status === "shadow"));
  assert.ok(history.every((row: any) => row.visibility_scope === "founder_candidate_diagnostic"));
  assert.equal(history[0].daily_view_delta, null);
  assert.equal(Number(history[1].daily_view_delta), 0);
  assert.equal(history[0].relation_status, "review");
  assert.equal(history[2].relation_status, "verified");
  assert.equal(new Date(history[3].fetched_at).toISOString(), "2026-09-02T12:00:00.000Z");
  const diagnostics = (await database.query(buildMonitoringYoutubeDiagnosticsSql("$1::text[]", "'2026-09-01'"), [["canonical"]])).rows[0].diagnostics;
  assert.equal(diagnostics.catalog.approvedLinkVideos, 0);
  assert.equal(diagnostics.catalog.candidateOnlyVideos, 2);
  assert.equal(diagnostics.nativeDailyHistory.candidateOnlyVisibility, "founder_diagnostic");
  assert.equal(diagnostics.nativeDailyHistory.candidateOnlyVideosWithHistory, 2);
  assert.deepEqual(diagnostics.relationships.map((row: any) => row.status).sort(), ["review", "verified"]);
}));

test("shared video relationships deduplicate rows while retaining approved-link and candidate evidence", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(`INSERT INTO youtube_artist_video_links VALUES
    (1,'canonical','Artist','shared',90,50,true,'youtube_uploads'),
    (2,'known-alias','Alias','shared',95,50,true,'approved_catalog'),
    (3,'canonical','Artist','inactive',100,99,false,'youtube_uploads'),
    (4,'canonical','Artist','low-confidence',79,99,true,'youtube_uploads');
    INSERT INTO youtube_music_catalog_candidates VALUES
      (3,'canonical','Artist','shared',99,'review','shadow','youtube_music_innertube'),
      (4,'known-alias','Alias','shared',85,'verified','shadow','youtube_music_innertube');
    INSERT INTO youtube_video_daily_snapshots VALUES ('shared','2026-09-02',100,5,'2026-09-02T12:00:00Z')`);
  const selected = (await database.query(buildMonitoringYoutubeEligibleVideosSql("$1::text[]"), [["canonical", "known-alias"]])).rows;
  assert.equal(selected.length, 1);
  assert.equal(selected[0].relation_status, "review", "existing highest-confidence ordering is unchanged");
  assert.equal(selected[0].has_approved_link, true);
  assert.equal(selected[0].relationship_sources.length, 4);
  assert.deepEqual(selected[0].relationship_sources.map((row: any) => row.status).sort(), ["active", "active", "review", "verified"]);
  const history = (await database.query(buildMonitoringYoutubeDailyHistorySql("$1::text[]", "$2::text"), [["canonical", "known-alias"], "2026-09-01"])).rows;
  assert.equal(history.length, 1, "multiple relation rows never duplicate a native daily point");
  assert.equal(Number(history[0].daily_view_delta), 5);
  assert.equal(history[0].visibility_scope, "approved_artist_link");
  assert.deepEqual(history[0].relationship_sources, selected[0].relationship_sources);
}));

test("legacy channel observations and unrelated videos never substitute for a video's missing native daily history", { skip: !fixtureModule }, async () => fixture(async database => {
  await database.exec(candidates);
  await database.exec(`DELETE FROM youtube_video_daily_snapshots WHERE video_id IN ('review-only','verified-only');
    INSERT INTO youtube_channels VALUES ('canonical','canonical-channel'),('other-artist','other-channel');
    INSERT INTO youtube_videos VALUES ('review-only','canonical-channel',500,'2026-09-02T12:00:00Z'),('unrelated','other-channel',999999,'2026-09-02T12:00:00Z');
    INSERT INTO youtube_channel_daily_snapshots VALUES
      ('canonical','canonical-channel','2026-09-01',100,10,'official_artist_channel','2026-09-01T12:00:00Z'),
      ('canonical','canonical-channel','2026-09-02',200,100,'official_artist_channel','2026-09-02T12:00:00Z'),
      ('other-artist','other-channel','2026-09-02',999999,999,'official_artist_channel','2026-09-02T12:00:00Z'),
      ('canonical','other-channel','2026-09-03',999999,999,'official_artist_channel','2026-09-03T12:00:00Z')`);
  const history = (await database.query(buildMonitoringYoutubeDailyHistorySql("$1::text[]", "$2::text", { includeCandidateOnly: true }), [["canonical"], "2026-09-01"])).rows;
  assert.deepEqual(history, []);
  const videos = await loadMonitoringYoutubeLiveVideos(database, ["canonical"]);
  assert.deepEqual(videos.map(row => row.video_id).sort(), ["review-only", "verified-only"]);
  assert.equal(Number(videos.find(row => row.video_id === "review-only")!.view_count), 0, "legacy cache must not replace the existing observed counter");
  const diagnostics = (await database.query(buildMonitoringYoutubeDiagnosticsSql("$1::text[]", "'2026-09-01'"), [["canonical"]])).rows[0].diagnostics;
  assert.equal(diagnostics.legacyVideos.videos, 1);
  assert.equal(diagnostics.legacyVideos.channels, 1);
  assert.equal(diagnostics.channelDailyHistory.points, 2, "the artist key alone cannot admit a different channel's history");
  assert.equal(diagnostics.channelDailyHistory.latestSnapshots[0].channel_id, "canonical-channel");
  assert.equal(diagnostics.channelDailyHistory.lastDate, "2026-09-02");
  assert.equal(diagnostics.nativeDailyHistory.points, 0);
}));

test("YouTube serving helpers reject empty identities and expired budgets before reading", async () => {
  let reads = 0;
  const queryable = { async query() { reads++; return { rows: [] }; } } as never;
  for (const load of [loadMonitoringYoutubeLiveVideos, loadMonitoringYoutubeDailyHistory]) {
    await assert.rejects(load(queryable, ["", " "]), /authorized artist identity/);
    await assert.rejects(load(queryable, ["canonical"], { deadlineAt: 0 }), /deadline exceeded/);
  }
  assert.equal(reads, 0);
});
