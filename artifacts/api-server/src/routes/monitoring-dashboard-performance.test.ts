import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./monitoring.ts", import.meta.url), "utf8");

test("monitoring dashboard latest-video reads use compact observation state", () => {
  assert.match(source, /LEFT JOIN youtube_video_intraday_latest_observations pointer/);
  assert.match(source, /latest\.observed_at=pointer\.latest_observed_at/);
  assert.doesNotMatch(
    source,
    /JOIN LATERAL \(\s*SELECT s\.view_count, s\.view_delta, s\.seconds_since_previous, s\.observed_at\s*FROM youtube_video_intraday_shadow_snapshots/s,
  );
});

test("monitoring coverage counts compact latest rows instead of scanning history", () => {
  assert.match(
    source,
    /SELECT count\(DISTINCT sample\.video_id\)\s*FROM youtube_video_intraday_latest_observations sample/s,
  );
  assert.doesNotMatch(source, /FROM youtube_video_intraday_shadow_snapshots sample/);
});

test("dashboard enrichment stages cannot hold the response past the UI timeout", () => {
  assert.match(source, /const dashboardStage = async <T>/);
  assert.match(source, /Promise\.race\(\[loaded, timedOut\]\)/);
  assert.match(source, /DASHBOARD_LOAD_BUDGET_MS - elapsedMilliseconds\(dashboardLoadStartedAt\)/);
  assert.match(source, /DASHBOARD_LOAD_BUDGET_MS = 3_500/);
  assert.match(source, /outcome: "budget_exhausted"/);
  assert.match(source, /outcome: "timeout"/);
  assert.match(source, /Monitoring dashboard stage timed out; using an empty section/);
});

test("dashboard reads use the dedicated three-connection monitoring pool", () => {
  assert.match(source, /import \{ monitoringReadPool \} from "@workspace\/db"/);
  assert.doesNotMatch(source, /publicReadPool/);
  assert.match(source, /const \[prioritizedStreamSummary, prioritizedStreamItems, snapshots\] = await Promise\.all/);
  assert.match(source, /const prioritizedLiveVideos = await dashboardStage/);
  assert.match(source, /const \[youtubeCoverage, availableHistory\] = await Promise\.all/s);
});

test("Spotify catalog and stored YouTube counters are prioritized before optional enrichment", () => {
  const priority = source.indexOf("priority_daily_snapshots");
  const youtube = source.indexOf("priority_youtube_live_videos");
  assert.ok(priority >= 0 && youtube > priority);
  assert.match(source, /const resolvedStreamSummary = prioritizedStreamSummary/);
  assert.match(source, /const resolvedStreamItems = prioritizedStreamItems/);
  assert.match(source, /const resolvedLiveVideos = prioritizedLiveVideos/);
  assert.match(source, /priority_youtube_live_videos[\s\S]*\[activeKeys\]\)\.then\(result => result\.rows\), \[\], 1_500\)/);
});

test("dashboard returns safe empty sections when individual data sources are unavailable", () => {
  for (const stage of [
    "priority_daily_snapshots",
    "extended_artist_data",
    "youtube_live_history",
    "priority_stream_summary",
    "priority_stream_items",
    "priority_youtube_live_videos",
    "youtube_coverage",
    "compact_history_overview",
    "release_impact",
  ]) {
    assert.match(source, new RegExp(`dashboardStage\\(\\s*"${stage}"`));
  }
});

test("internal artist picker lists existing monitored artists without public readiness", () => {
  const routeStart = source.indexOf('router.get("/monitoring/internal/artists"');
  const dashboardStart = source.indexOf('router.get("/monitoring/dashboard/:artistKey"');
  assert.ok(routeStart >= 0 && dashboardStart > routeStart);
  const route = source.slice(routeStart, dashboardStart);
  assert.match(route, /requireMonitoringClerkUser/);
  assert.match(route, /hasInternalArtistProEntitlement\(userId\)/);
  assert.match(route, /FROM songstats_artist_daily_snapshots/);
  assert.match(route, /JOIN latest_snapshots snapshot/);
  assert.doesNotMatch(route, /SELECT count\(\*\)[\s\S]*WHERE stream_item\.artist_key=coverage\.artist_key/);
  assert.doesNotMatch(route, /auditMonitoringReadiness|getMonitoringReadyArtist/);
});

test("internal authorization uses canonical candidates without a public-readiness scan", () => {
  const readinessSource = readFileSync(
    new URL("../lib/monitoring-readiness-service.ts", import.meta.url),
    "utf8",
  );
  const lookupStart = readinessSource.indexOf("export async function getExistingMonitoringArtist");
  const lookupEnd = readinessSource.indexOf("function evaluateRow", lookupStart);
  const lookup = readinessSource.slice(lookupStart, lookupEnd);

  assert.match(lookup, /c\.artist_key = ANY\(\$1::text\[\]\)/);
  assert.doesNotMatch(lookup, /regexp_replace|songstats_artist_daily_snapshots/);
});

test("monitor report endpoint returns a private PDF instead of CSV", () => {
  assert.match(source, /createMonitoringReportPdf/);
  assert.match(source, /content-type", "application\/pdf"/);
  assert.match(source, /monitor-pro-\$\{safeArtist\}-\$\{month\}\.pdf/);
  assert.doesNotMatch(source, /content-type", "text\/csv/);
});
