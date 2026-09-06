import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./monitoring.ts", import.meta.url),
  "utf8",
);

test("Spotify identity orders by the timestamp actually declared on songstats_artists", () => {
  const identity = source.slice(
    source.indexOf('"priority_artist_identity"'),
    source.indexOf("const priorityStreamSummary"),
  );
  assert.match(
    identity,
    /FROM songstats_artists[\s\S]*ORDER BY last_synced_at DESC/,
  );
  assert.doesNotMatch(identity, /ORDER BY updated_at/);
});

test("paid video read includes the existing public catalog and deduplicates by video ID", () => {
  const videos = source.slice(
    source.indexOf('"priority_youtube_live_videos"'),
    source.indexOf("const extended ="),
  );
  assert.match(videos, /FROM youtube_artist_video_links/);
  assert.match(videos, /UNION ALL[\s\S]*FROM youtube_music_catalog_candidates/);
  assert.match(videos, /candidate.status IN \('review','verified'\)/);
  assert.match(videos, /candidate.sampling_status='shadow'/);
  assert.match(videos, /SELECT DISTINCT ON \(link.video_id\)/);
  assert.match(videos, /link\.artist_key = ANY\(\$1::text\[\]\)/);
  assert.doesNotMatch(videos, /regexp_replace/);
  assert.doesNotMatch(videos, /LIMIT 10\b/);
});

test("paid reads retain both the requested route alias and authorized canonical alias", () => {
  assert.match(
    source,
    /const activeKeys = active\.identity_conflict \? \[active\.artist_key\] : \[[\s\S]*songstatsArtistKeyCandidates\(active\.artist_key\)[\s\S]*songstatsArtistKeyCandidates\(active\.artist_name\)[\s\S]*\.\.\.lookupKeys[\s\S]*\];/,
  );
});

test("monitoring dashboard latest-video reads use compact observation state", () => {
  assert.match(
    source,
    /LEFT JOIN youtube_video_intraday_latest_observations pointer/,
  );
  assert.match(source, /latest\.observed_at=pointer\.latest_observed_at/);
  assert.doesNotMatch(
    source,
    /JOIN LATERAL \(\s*SELECT s\.view_count, s\.view_delta, s\.seconds_since_previous, s\.observed_at\s*FROM youtube_video_intraday_shadow_snapshots/s,
  );
});

test("monitoring coverage counts compact latest rows instead of scanning history", () => {
  assert.match(
    source,
    /LEFT JOIN youtube_video_intraday_latest_observations sample ON sample\.video_id=link\.video_id/s,
  );
  assert.doesNotMatch(
    source,
    /FROM youtube_video_intraday_shadow_snapshots sample/,
  );
});

test("dashboard enrichment stages cannot hold the response past the UI timeout", () => {
  assert.match(source, /const dashboardStage = async <T>/);
  assert.match(source, /Promise\.race\(\[loaded, timedOut\]\)/);
  assert.match(
    source,
    /DASHBOARD_LOAD_BUDGET_MS - elapsedMilliseconds\(dashboardLoadStartedAt\)/,
  );
  assert.match(source, /DASHBOARD_LOAD_BUDGET_MS = 12_000/);
  assert.match(source, /outcome: "budget_exhausted"/);
  assert.match(source, /outcome: "timeout"/);
  assert.match(
    source,
    /Monitoring dashboard stage timed out; using an empty section/,
  );
});

test("dashboard reads use the dedicated three-connection monitoring pool", () => {
  assert.match(source, /import \{ monitoringReadPool \} from "@workspace\/db"/);
  assert.doesNotMatch(source, /publicReadPool/);
  assert.match(
    source,
    /const \[\s*prioritizedArtistIdentity,[\s\S]*?snapshots,\s*\] = await Promise\.all/,
  );
  assert.match(source, /const prioritizedLiveVideos = await dashboardStage/);
  assert.match(
    source,
    /const \[youtubeCoverage, availableHistory\] = await Promise\.all/s,
  );
});

test("Spotify catalog and stored YouTube counters are prioritized before optional enrichment", () => {
  const priority = source.indexOf("priority_daily_snapshots");
  const youtube = source.indexOf("priority_youtube_live_videos");
  assert.ok(priority >= 0 && youtube > priority);
  assert.match(source, /let resolvedStreamSummary[^\n]*= prioritizedStreamSummary/);
  assert.match(source, /let resolvedStreamItems = prioritizedStreamItems/);
  assert.match(source, /const resolvedLiveVideos = prioritizedLiveVideos/);
  assert.match(
    source,
    /priority_youtube_live_videos[\s\S]*\[activeKeys\][\s\S]*?result\.rows[\s\S]*?1_500/,
  );
});

test("dashboard returns safe empty sections when individual data sources are unavailable", () => {
  for (const stage of [
    "priority_daily_snapshots",
    "extended_artist_data",
    "youtube_live_history",
    "priority_stream_summary",
    "priority_stream_items",
    "priority_artist_identity",
    "priority_spotify_history",
    "priority_spotify_snapshot",
    "priority_comparisons",
    "complete_kworb_catalog",
    "priority_youtube_live_videos",
    "youtube_coverage",
    "compact_history_overview",
    "release_impact",
  ]) {
    assert.match(source, new RegExp(`dashboardStage\\(\\s*"${stage}"`));
  }
});

test("canonical Monitor Pro receives the stored artist identity image without substituting catalog art", () => {
  assert.match(
    source,
    /SELECT COALESCE\(songstats\.avatar_url, image\.image_url\) avatar_url/s,
  );
  assert.match(source, /FROM artist_images/);
  assert.match(
    source,
    /artistImageUrl:[\s\S]*?prioritizedArtistIdentity\[0\]\?\.avatar_url \?\?[\s\S]*?insight\?\.avatarUrl \?\? null/,
  );
});

test("complete Spotify catalog reuses the existing stored artwork layer", () => {
  assert.match(source, /priority_stored_track_artwork/);
  assert.match(source, /FROM deezer_track_covers/);
  assert.match(source, /for \(const track of storedTrackArtwork\)/);
});

test("internal artist picker requires founder authentication and lists the broad shared directory privately", () => {
  const routeStart = source.indexOf('"/monitoring/internal/artists"');
  const directoryStart = source.indexOf('"/monitoring/internal/directory"');
  const gateStart = source.indexOf("const requireMonitoringFounder");
  assert.ok(gateStart >= 0 && routeStart > gateStart && directoryStart > routeStart);
  const gate = source.slice(gateStart, routeStart);
  const route = source.slice(routeStart, directoryStart);
  assert.match(gate, /hasInternalArtistProEntitlement\(clerkUserId\(res\)\)/);
  assert.match(gate, /Cache-Control", "private, no-store"/);
  assert.match(gate, /res\.status\(403\)/);
  assert.match(route, /requireMonitoringClerkUser,\s*requireMonitoringFounder,/);
  assert.match(route, /await getMonitoringCandidateList\(\)/);
  assert.doesNotMatch(route, /auditMonitoringReadiness|getMonitoringReadyArtist|evaluateMonitoringCandidate/);
  assert.doesNotMatch(route, /getMonitoringCandidateDirectory|JOIN latest_snapshots|FROM songstats_artist_daily_snapshots/);
  assert.match(route, /candidate_directory_failed/);
  assert.doesNotMatch(route, /res\.json\(\{[^}]*artists: \[\]/);
});

test("founder evidence reads remain separately authenticated and bounded by page size", () => {
  const route = source.slice(
    source.indexOf('"/monitoring/internal/directory"'),
    source.indexOf('"/monitoring/dashboard/:artistKey"'),
  );
  assert.match(route, /requireMonitoringClerkUser,\s*requireMonitoringFounder,/);
  assert.match(route, /limit > 200/);
  assert.match(route, /offset < 0/);
  assert.match(route, /search\.length > 160/);
  assert.match(route, /await getMonitoringCandidateDirectory\(\{ limit, offset, search \}\)/);
  assert.match(route, /candidate_audit_failed/);
});

test("internal authorization targets indexed identities without running the population or detailed evidence audit", () => {
  const readinessSource = readFileSync(new URL("../lib/monitoring-readiness-service.ts", import.meta.url), "utf8");
  const lookupStart = readinessSource.indexOf("export async function getExistingMonitoringArtist");
  const lookupEnd = readinessSource.indexOf("async function runMonitoringReadinessAudit", lookupStart);
  assert.ok(lookupStart >= 0 && lookupEnd > lookupStart);
  const lookup = readinessSource.slice(lookupStart, lookupEnd);
  assert.match(lookup, /return getMonitoringCandidateIdentity\(artistKey\)/);
  assert.doesNotMatch(lookup, /getMonitoringReadyArtist|auditMonitoringReadiness|evaluateMonitoringReadiness\(/);

  const candidateSource = readFileSync(new URL("../lib/monitoring-candidate-audit.ts", import.meta.url), "utf8");
  const identityStart = candidateSource.indexOf("export async function getMonitoringCandidateIdentity");
  const identityEnd = candidateSource.indexOf("// The requested page is materialized first.", identityStart);
  assert.ok(identityStart >= 0 && identityEnd > identityStart);
  const identity = candidateSource.slice(identityStart, identityEnd);
  assert.doesNotMatch(identity, /await loadMonitoringCandidatePopulation\(/);
  assert.match(identity, /WHERE artist_key=ANY/);
  assert.match(identity, /withUnavailableMonitoringSources\(targeted, missing\)/);
  assert.match(identity, /if \(!candidate\.identityConflict\) return candidate/);
  assert.doesNotMatch(identity, /getMonitoringCandidateDirectory|evaluateMonitoringCandidate|EVIDENCE_SQL/);
  const populationLoader = candidateSource.slice(candidateSource.indexOf("export async function loadMonitoringCandidatePopulation"), identityStart);
  assert.match(populationLoader, /populationCache && populationCache\.expiresAt > Date\.now\(\)/);
  assert.match(populationLoader, /if \(populationPending\) return populationPending/);
  assert.match(populationLoader, /finally\(\(\) => \{ populationPending = null;/);
  assert.doesNotMatch(populationLoader, /EVIDENCE_SQL|evaluateMonitoringCandidate/);
  const populationSql = candidateSource.slice(candidateSource.indexOf("export const MONITORING_CANDIDATE_POPULATION_SQL"), candidateSource.indexOf("type AuditPool"));
  for (const table of ["official_artists", "songstats_artists", "youtube_channels", "songstats_historical_observations"]) {
    assert.match(populationSql, new RegExp(`FROM ${table}`));
  }
  assert.doesNotMatch(populationSql, /WHERE.*spotify_id|JOIN latest_snapshots/);
});

test("monitor report endpoint returns a private PDF instead of CSV", () => {
  const report = source.slice(
    source.indexOf('"/monitoring/report/:artistKey"'),
  );
  assert.match(source, /createMonitoringWeeklyReport/);
  assert.match(source, /content-type", "application\/pdf"/);
  assert.match(source, /reporte-semanal-\$\{safeArtist\}-\$\{weekEnd\}\.pdf/);
  assert.doesNotMatch(source, /content-type", "text\/csv/);
  assert.doesNotMatch(report, /Object\.values\(dashboard\.sectionStatus\)/);
});
