import { evaluateMonitoringReadinessRow, type ReadinessRow } from "./monitoring-readiness-row";
import { MONITORING_READINESS_POLICY_VERSION, isMonitoringReadinessDateFresh } from "./monitoring-readiness-policy";
import { compactArtistKey, songstatsArtistKeyCandidates } from "./songstats-artist-key";
import { buildSongstatsPublicInsight } from "./songstats-public-service";
import { normalizedMonitoringReleaseTitle } from "./monitoring-artwork";
import { youtubeCoverageFromLatestObservations } from "./youtube-latest-observation";
import { compactGrowthAtTarget, type CompactHistoryPoint } from "./monitoring-history-compact";

/** Read-only inventory. No collector, licensing, identity-validation or provenance writes. */
export const MONITORING_COMPLETE_CONTRACT_VERSION = "monitor_pro_complete_v1";
export const MONITORING_COMPLETE_CONTRACT = Object.freeze({
  legacyPolicyVersion: MONITORING_READINESS_POLICY_VERSION,
  required: ["licensed_audience_and_growth", "spotify_instagram_tiktok_current_and_7_30_90_growth", "current_snapshot", "spotify_track_and_album_catalog",
    "spotify_daily_history", "artist_image", "track_and_album_artwork", "approved_youtube_catalog",
    "youtube_daily_history", "comparison_peer"],
  optional: ["release_impact_when_valid_comparison_windows_exist", "remaining_social_platforms",
    "multi_year_history_before_source_coverage_begins", "persistent_alert_configuration", "scheduled_report_delivery", "touring"],
  scope: "Stored approved sources; source absence does not mean the provider can never supply it.",
  historyPolicy: "At least two exact dated observations are needed to draw a history. Longer ranges disclose actual source coverage; missing dates are never synthesized.",
});

export interface MonitoringCandidateSourceRow {
  artist_key: string;
  artist_name: string | null;
  spotify_id: string | null;
  source: string;
  declared_aliases?: string[] | null;
  mbid?: string | null;
  verified?: string | null;
}

export interface MonitoringCandidateIdentity {
  artistKey: string;
  artistName: string;
  matchKeys: string[];
  sourceKeys: string[];
  candidateSources: string[];
  spotifyIds: string[];
  identityConflict: boolean;
  declaredAliases: string[];
  identityAliasEvidence: Array<{ source: "musicbrainz_artists"; artistKey: string; mbid: string; verification: string; aliases: string[] }>;
  identityMappingStatus: "provider_id" | "accepted_registry" | "unverified" | "conflict";
}

const acceptedRegistryRow = (row: MonitoringCandidateSourceRow) => row.source === "musicbrainz_artists" && Boolean(row.mbid?.trim()) &&
  ["auto", "auto_review_accepted", "manual_review_accepted"].includes(row.verified ?? "");
const declaredRowAliases = (row: MonitoringCandidateSourceRow) => acceptedRegistryRow(row)
  ? [...new Set([row.artist_name, ...(Array.isArray(row.declared_aliases) ? row.declared_aliases : [])]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map(value => value.trim()))] : [];

const SOURCE_PRIORITY = ["kworb_coverage", "official_artists", "spotify_artists", "songstats_artists"];
/** Deterministic connected identity groups, including explicit aliases and provider IDs.
 * Conflicting provider IDs are retained as a diagnostic and never commercially approved.
 */
export function groupMonitoringCandidateIdentities(rows: MonitoringCandidateSourceRow[]): MonitoringCandidateIdentity[] {
  const groups: MonitoringCandidateSourceRow[][] = [];
  const index = new Map<string, number>();
  const parents: number[] = [];
  const root = (id: number): number => parents[id] === id ? id : (parents[id] = root(parents[id]!));
  for (const row of rows.filter(row => row.artist_key?.trim())) {
    const keys = [...[row.artist_key, ...declaredRowAliases(row)].flatMap(songstatsArtistKeyCandidates).map(key => `key:${compactArtistKey(key)}`),
      ...(row.spotify_id?.trim() ? [`spotify:${row.spotify_id.trim()}`] : []),
      ...(acceptedRegistryRow(row) ? [`musicbrainz:${row.mbid}`] : [])];
    const previous = keys.flatMap(key => index.has(key) ? [root(index.get(key)!)] : []);
    const id = previous.length ? Math.min(...previous) : groups.length;
    if (!previous.length) { groups.push([]); parents.push(id); }
    for (const found of previous) if (root(found) !== root(id)) parents[root(found)] = root(id);
    groups[id]!.push(row);
    keys.forEach(key => index.set(key, id));
  }
  const merged = new Map<number, MonitoringCandidateSourceRow[]>();
  groups.forEach((group, id) => merged.set(root(id), [...(merged.get(root(id)) ?? []), ...group]));
  return [...merged.values()].map(group => {
    const priority = (source: string) => { const index = SOURCE_PRIORITY.indexOf(source); return index < 0 ? 99 : index; };
    const ordered = [...group].sort((a, b) => priority(a.source) - priority(b.source) || a.artist_key.localeCompare(b.artist_key));
    const first = ordered[0]!;
    const sourceKeys = [...new Set(ordered.map(row => row.artist_key))].sort();
    const spotifyIds = [...new Set(ordered.flatMap(row => row.spotify_id?.trim() ? [row.spotify_id.trim()] : []))].sort();
    const declaredAliases = [...new Set(group.flatMap(declaredRowAliases))].sort();
    const identityAliasEvidence = group.filter(acceptedRegistryRow).map(row => ({ source: "musicbrainz_artists" as const,
      artistKey: row.artist_key, mbid: row.mbid!, verification: row.verified!, aliases: declaredRowAliases(row) }));
    const identityConflict = spotifyIds.length > 1 || new Set(identityAliasEvidence.map(value => value.mbid)).size > 1;
    return {
      artistKey: first.artist_key,
      artistName: ordered.find(row => row.artist_name?.trim())?.artist_name?.trim() || first.artist_key,
      sourceKeys,
      matchKeys: [...new Set([...sourceKeys, ...declaredAliases].flatMap(key => [key, key.toLowerCase(), ...songstatsArtistKeyCandidates(key)]))],
      candidateSources: [...new Set(group.map(row => row.source))].sort(),
      spotifyIds,
      identityConflict,
      declaredAliases,
      identityAliasEvidence,
      identityMappingStatus: identityConflict ? "conflict" as const : spotifyIds.length ? "provider_id" as const : identityAliasEvidence.length ? "accepted_registry" as const : "unverified" as const,
    };
  }).sort((a, b) => a.artistKey.localeCompare(b.artistKey));
}

export interface MonitoringCandidateEvidenceRow {
  artist_key: string;
  extended: Array<Record<string, unknown>> | null;
  snapshot: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  raw_summary: Record<string, unknown> | null;
  legacy: Array<{ coverage: Record<string, unknown>; extended_artist_key?: string | null; extended?: Record<string, unknown> | null; snapshot: Record<string, unknown> | null; summary: Record<string, unknown> | null }> | null;
  source_evidence: Record<string, unknown>;
  served_summary?: Record<string, unknown> | null;
  compact_history?: ReadinessRow["compact_history"];
  stream_items?: Array<{ item_type: string; item_key: string; title: string; artwork_url: string | null }> | null;
  stored_artwork?: Array<{ song_title: string; cover_url: string }> | null;
  kworb_payload?: unknown;
  missing_schema_tables?: string[];
}

export interface MonitoringCandidateFinding {
  code: string;
  section: string;
  status: "repairable" | "blocked" | "investigation_required";
  evidence: string;
  action: string;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function count(value: unknown): number { const n = Number(value ?? 0); return Number.isFinite(n) ? n : 0; }
function payload(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some(payload);
  if (typeof value === "object") return Object.values(value).some(payload);
  return typeof value === "string" ? value.trim().length > 0 : true;
}
function licensedMetricPoints(historicStats: unknown, source: string, field: string): CompactHistoryPoint[] {
  const rawStats = object(historicStats)["stats"];
  const rawSource = (Array.isArray(rawStats) ? rawStats : []).map(object).find(value => String(value["source"]).toLowerCase() === source);
  const rawHistory = object(rawSource?.["data"])["history"];
  return (Array.isArray(rawHistory) ? rawHistory : []).flatMap(value => {
    const point = object(value);
    const number = Number(String(point[field] ?? "").replaceAll(",", ""));
    return typeof point["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(point["date"]) && point[field] != null && Number.isFinite(number) && number >= 0
      ? [{ date: point["date"], value: number, provenanceRef: "stored_licensed_payload", acquisitionMode: "songstats_historical" as const }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
}
function readinessRow(artist: MonitoringCandidateIdentity, extended: Record<string, unknown>, snapshot: Record<string, unknown>, summary: Record<string, unknown>, compact?: ReadinessRow["compact_history"]): ReadinessRow {
  return {
    artist_key: artist.artistKey, artist_name: artist.artistName,
    ...extended, ...snapshot,
    stream_snapshot_date: summary["snapshot_date"] ?? null,
    track_count: summary["track_count"] ?? 0,
    album_count: summary["album_count"] ?? 0,
    track_daily_streams: summary["track_daily_streams"] ?? 0,
    track_total_streams: summary["track_total_streams"] ?? 0,
    album_total_streams: summary["album_total_streams"] ?? 0,
    compact_history: compact,
  } as ReadinessRow;
}

export function evaluateMonitoringCandidate(
  artist: MonitoringCandidateIdentity,
  row: MonitoringCandidateEvidenceRow,
  now = new Date(),
) {
  const sourceEvidence = { ...row.source_evidence };
  const extendedRows = row.extended ?? [];
  const recoveredExtended = Object.fromEntries(["historic_stats", "audience", "audience_details", "catalog"]
    .map(key => [key, extendedRows.find(value => payload(value[key]))?.[key] ?? null]));
  const recoveredInsight = buildSongstatsPublicInsight({ historicStats: recoveredExtended["historic_stats"],
    audience: recoveredExtended["audience"], audienceDetails: recoveredExtended["audience_details"], catalog: recoveredExtended["catalog"] }, { access: "monitoring" });
  sourceEvidence["artistImage"] = sourceEvidence["artistImage"] === true || Boolean(recoveredInsight.avatarUrl);
  if (row.stream_items !== undefined) {
    const artworkTitles = new Set(recoveredInsight.catalog.releases.filter(release => release.artworkUrl)
      .map(release => normalizedMonitoringReleaseTitle(release.title)));
    for (const cover of row.stored_artwork ?? []) if (/^https?:\/\//i.test(cover.cover_url)) artworkTitles.add(normalizedMonitoringReleaseTitle(cover.song_title));
    const kworb = object(row.kworb_payload)["topTracks"];
    for (const raw of Array.isArray(kworb) ? kworb : []) {
      const track = object(raw);
      if (typeof track["title"] === "string" && typeof track["coverUrl"] === "string" && /^https?:\/\//i.test(track["coverUrl"])) {
        artworkTitles.add(normalizedMonitoringReleaseTitle(track["title"]));
      }
    }
    const items = new Map<string, { type: string; artwork: boolean }>();
    for (const item of row.stream_items ?? []) {
      const key = `${item.item_type}:${item.item_key}`;
      items.set(key, { type: item.item_type, artwork: items.get(key)?.artwork === true || /^https?:\/\//i.test(item.artwork_url ?? "") || artworkTitles.has(normalizedMonitoringReleaseTitle(item.title)) });
    }
    sourceEvidence["catalog"] = {
      tracks: [...items.values()].filter(item => item.type === "track").length,
      albums: [...items.values()].filter(item => item.type === "album").length,
      tracksWithArtwork: [...items.values()].filter(item => item.type === "track" && item.artwork).length,
      albumsWithArtwork: [...items.values()].filter(item => item.type === "album" && item.artwork).length,
      artworkSourcesInvestigated: ["monitoring_stream_items", "songstats_artist_extended_data.catalog", "kworb_snapshots.value.topTracks", "deezer_track_covers"],
    };
  }
  const legacyResults = (row.legacy ?? []).map(value => {
    // The exact-key legacy join is preserved; do not substitute another alias's
    // payload or the merged recovered endpoints. Older saved audits may still
    // carry the full extended object and remain evaluable without migration.
    const extended = value.extended_artist_key !== undefined
      ? extendedRows.find(row => row["artist_key"] === value.extended_artist_key) ?? null
      : value.extended ?? null;
    return {
      available: Boolean(value.coverage["spotify_id"] && extended && value.snapshot),
      readiness: evaluateMonitoringReadinessRow(readinessRow(artist, object(extended), object(value.snapshot), object(value.summary)), now),
    };
  });
  const legacyPublicEligible = legacyResults.some(value => value.available && value.readiness.ready);
  const servedSummary = object(row.served_summary ?? row.summary);
  const servedReadiness = evaluateMonitoringReadinessRow(readinessRow(artist, recoveredExtended, object(row.snapshot), servedSummary, row.compact_history), now);
  const repairedReadiness = evaluateMonitoringReadinessRow(readinessRow(artist, recoveredExtended, object(row.snapshot), object(row.raw_summary), row.compact_history), now);
  const readiness = servedReadiness;
  sourceEvidence["payloadSources"] = extendedRows.map(value => ({ artistKey: value["artist_key"], spotifyId: value["spotify_artist_id"], songstatsId: value["songstats_artist_id"],
    updatedAt: value["updated_at"], historicFetchedAt: value["historic_fetched_at"], audienceFetchedAt: value["audience_fetched_at"],
    audienceDetailsFetchedAt: value["audience_details_fetched_at"], catalogFetchedAt: value["catalog_fetched_at"] }));
  sourceEvidence["audienceHistoryCoverage"] = row.compact_history ?? null;
  sourceEvidence["streamSummary"] = servedSummary;
  sourceEvidence["mexicoAudience"] = { cities: readiness.mexicoCities, citiesWithPeakListeners: recoveredInsight.topMexicoCities.filter(city => city.peakListeners != null).length };
  sourceEvidence["dailyPulse"] = { currentDate: object(sourceEvidence["currentHistory"])["lastDate"] ?? null,
    previousDate: object(sourceEvidence["currentHistory"])["previousDate"] ?? null, source: "songstats_artist_daily_snapshots" };
  sourceEvidence["reportPrerequisites"] = { period: "weekly", layout: "eight_page_weekly", currentSnapshot: Boolean(row.snapshot),
    previousSnapshot: count(object(sourceEvidence["currentHistory"])["days"]) >= 2,
    mexicoCities: readiness.mexicoCities, comparisonPeers: count(sourceEvidence["comparisonPeers"]), generationVerified: false,
    verification: "Actual authenticated PDF generation and visual review are separate runtime acceptance checks." };
  const findings: MonitoringCandidateFinding[] = [];
  if (row.missing_schema_tables?.length) findings.push({
    code: "source_schema_unavailable", section: "source_inventory", status: "investigation_required",
    evidence: `Source tables unavailable: ${row.missing_schema_tables.join(", ")}. Remaining tables were still inspected.`,
    action: "Verify the missing source schemas before claiming an exhaustive source audit.",
  });
  if (!legacyResults.some(value => value.available) && servedReadiness.ready) findings.push({
    code: "legacy_source_join_mismatch", section: "identity", status: "repairable",
    evidence: "Resolved stored sources satisfy the legacy checks, but the public exact-key catalog join does not.",
    action: "Align the serving and eligibility source-key lookups, then rerun the complete audit.",
  });
  const missingEndpoints = ["historic_stats", "audience", "audience_details", "catalog"].filter(key => !payload(recoveredExtended[key]));
  const failedEndpoints = [...new Set(extendedRows.flatMap(value => Object.keys(object(value["sync_errors"]))))].sort();
  for (const reason of readiness.reasons) {
    const repairable = !repairedReadiness.reasons.includes(reason);
    const endpointFailure = reason === "missing_licensed_endpoint" && missingEndpoints.some(endpoint => failedEndpoints.includes(endpoint));
    const compactNeedsEvaluation = (["insufficient_growth_history", "insufficient_trend_history", "missing_licensed_endpoint"].includes(reason)
      && count(object(sourceEvidence["compactHistory"])["points"]) > 0)
      || (["missing_spotify_audience", "missing_youtube_audience", "insufficient_platform_breadth"].includes(reason)
        && Boolean(row.compact_history?.available_metric_keys?.length));
    findings.push({
      code: reason,
      section: /stream/.test(reason) ? "spotify" : /mexico/.test(reason) ? "markets" : "audience_and_growth",
      status: repairable ? "repairable" : endpointFailure || compactNeedsEvaluation ? "investigation_required" : "blocked",
      evidence: reason === "missing_licensed_endpoint"
        ? `Missing stored licensed payloads: ${missingEndpoints.join(", ")}. Failed endpoint keys: ${failedEndpoints.join(", ") || "none"}.`
        : compactNeedsEvaluation ? "Verified compact historical observations exist; the legacy payload parser cannot prove their growth/trend coverage."
          : repairable ? "Existing exact raw stream rows satisfy this check; the serving summary does not."
          : `The existing v${MONITORING_READINESS_POLICY_VERSION} check fails across the resolved stored source keys.`,
      action: repairable ? "Serve or rebuild the artist summary from the existing exact dated track and album rows."
        : compactNeedsEvaluation ? "Evaluate the existing verified compact metric dates and baselines before assigning a source classification."
          : endpointFailure ? "Investigate the recorded endpoint failure before assigning a complete source classification."
          : "Obtain the missing approved source evidence before enabling paid monitoring.",
    });
  }
  const addMissing = (passes: boolean, code: string, section: string, evidence: string, repairable = false, sourceUncertain = false) => {
    if (!passes) findings.push({ code, section, status: sourceUncertain ? "investigation_required" : repairable ? "repairable" : "blocked", evidence,
      action: repairable ? "Connect the existing approved source rows to this dashboard section."
        : "Populate and verify the missing approved source evidence before enabling paid monitoring." });
  };
  const catalog = object(sourceEvidence["catalog"]);
  const spotifyHistory = object(sourceEvidence["spotifyHistory"]);
  const streamHistory = object(sourceEvidence["streamHistory"]);
  const youtube = object(sourceEvidence["youtube"]);
  const youtubeHistory = object(sourceEvidence["youtubeHistory"]);
  // These three platforms and their 7/30/90 windows are explicit in the
  // approved Tendencias experience; the old breadth count alone is insufficient.
  for (const [metric, column] of [["spotifyMonthlyListeners", "spotify_monthly_listeners"], ["instagramFollowers", "instagram_followers"], ["tiktokFollowers", "tiktok_followers"]] as const) {
    const current = count(row.snapshot?.[column]) || count(recoveredInsight.current[metric]);
    const source = metric === "spotifyMonthlyListeners" ? "spotify" : metric === "instagramFollowers" ? "instagram" : "tiktok";
    const field = metric === "spotifyMonthlyListeners" ? "monthly_listeners_current" : "followers_total";
    const exactPoints = licensedMetricPoints(recoveredExtended["historic_stats"], source, field);
    const completeGrowth = (row.compact_history?.growth_metric_keys.includes(metric)
      && isMonitoringReadinessDateFresh(row.compact_history.metric_latest_dates?.[metric] ?? null, 14, now))
      || (isMonitoringReadinessDateFresh(exactPoints.at(-1)?.date ?? null, 14, now)
        && [7,30,90].every(days => compactGrowthAtTarget(exactPoints, days) != null));
    const olderSourceNeedsReview = row.compact_history?.available_metric_keys?.includes(metric) === true;
    addMissing(current > 0, `missing_required_${metric}`, "audience_and_growth", `Required ${metric} current audience is missing in the selected serving snapshot; ${olderSourceNeedsReview ? "other stored observations exist and need per-metric recency review" : "no equivalent current observation was found"}.`, false, olderSourceNeedsReview);
    const observationDate = count(row.snapshot?.[column]) > 0 ? String(row.snapshot?.["snapshot_date"] ?? "") : exactPoints.at(-1)?.date ?? null;
    addMissing(isMonitoringReadinessDateFresh(observationDate, 14, now), `stale_required_${metric}`, "audience_and_growth", `Required ${metric} was observed on ${observationDate ?? "an unknown date"}; each metric must satisfy the existing 14-day current-audience freshness limit.`, false, olderSourceNeedsReview);
    addMissing(Boolean(completeGrowth), `missing_required_${metric}_growth`, "trends", `Required ${metric} does not have the approved 7/30/90-day growth baselines in the existing licensed or scheduled daily history.`);
  }
  for (const [metric, column, field, source] of [["spotifyFollowers", "spotify_followers", "followers_total", "spotify"], ["youtubeChannelViews", "youtube_channel_views", "video_views_total", "youtube"], ["youtubeSubscribers", "youtube_subscribers", "subscribers_total", "youtube"]] as const) {
    const native = count(row.snapshot?.[column]);
    const latest = licensedMetricPoints(recoveredExtended["historic_stats"], source, field).at(-1);
    const value = native || count(latest?.value);
    const date = native > 0 ? String(row.snapshot?.["snapshot_date"] ?? "") : latest?.date ?? null;
    addMissing(value > 0 && isMonitoringReadinessDateFresh(date, 14, now), `missing_or_stale_${metric}`, "audience_and_growth", `Required ${metric}: value ${value || "missing"}, actual observation date ${date ?? "unknown"}.`, false, row.compact_history?.available_metric_keys?.includes(metric) === true);
  }
  addMissing(count(object(sourceEvidence["currentHistory"])["days"]) >= 2, "missing_daily_pulse_history", "pulse", "The observed daily pulse requires both a current and previous stored daily snapshot.");
  const catalogProof = object(sourceEvidence["catalogCompleteness"]);
  const catalogProven = catalogProof["verified"] === true && typeof catalogProof["reference"] === "string"
    && count(catalogProof["expectedTracks"]) === count(catalog["tracks"]) && count(catalogProof["expectedAlbums"]) === count(catalog["albums"]);
  if (!catalogProven) findings.push({ code: "full_stream_catalog_unverified", section: "spotify", status: "investigation_required",
    evidence: `${count(catalog["tracks"])} tracks and ${count(catalog["albums"])} albums exist; stored row counts alone do not prove the complete current source catalog.`,
    action: "Reconcile the full source track and album catalogs with their dated acquisition evidence; prior example counts cannot substitute for measurement." });
  const observations = Array.isArray(sourceEvidence["youtubeObservations"]) ? sourceEvidence["youtubeObservations"].map(object) : [];
  const latest = new Map<string, Date>();
  const validDeltas = new Set<string>();
  for (const point of observations) {
    if (typeof point["videoId"] !== "string" || typeof point["observedAt"] !== "string") continue;
    const date = new Date(point["observedAt"]);
    if (!Number.isFinite(date.getTime())) continue;
    latest.set(point["videoId"], date);
    if (point["delta"] != null && count(point["secondsSincePrevious"]) > 0) validDeltas.add(point["videoId"]);
  }
  const observationCoverage = youtubeCoverageFromLatestObservations([...latest.keys()].map(videoId => ({ artistKey: artist.artistKey, videoId })), latest, now);
  sourceEvidence["youtubeObservationCoverage"] = { ...observationCoverage, videosWithObservedDelta: validDeltas.size, policy: "youtubeCoverageFromLatestObservations_default_6h" };
  addMissing(observationCoverage.freshVideos === count(youtube["approvedVideos"]) && observationCoverage.freshVideos > 0,
    "stale_or_missing_youtube_observations", "youtube", `${observationCoverage.freshVideos}/${count(youtube["approvedVideos"])} approved videos satisfy the existing six-hour observation freshness policy.`);
  addMissing(validDeltas.size === count(youtube["approvedVideos"]) && validDeltas.size > 0,
    "missing_youtube_observed_deltas", "youtube", `${validDeltas.size}/${count(youtube["approvedVideos"])} approved videos have an observed delta and positive elapsed interval; missing deltas are never replaced with zero.`);
  const importStates = Array.isArray(sourceEvidence["youtubeImport"]) ? sourceEvidence["youtubeImport"].map(object) : [];
  const expected = Math.max(0, ...importStates.map(state => Math.max(count(state["expectedVideos"]), count(state["videosImported"]))));
  if (!importStates.length || expected > count(youtube["observedVideos"]) || importStates.some(state => state["status"] !== "complete" || !state["completedAt"] || state["nextPageTokenPresent"] === true)) {
    const knownMissing = expected > count(youtube["observedVideos"]);
    findings.push({ code: "incomplete_youtube_catalog", section: "youtube", status: knownMissing ? "blocked" : "investigation_required",
      evidence: `${importStates.length} stored channel import states; ${count(youtube["observedVideos"])} observed approved videos; ${expected || "unknown"} expected videos. No complete import proof is available.`,
      action: "Verify the existing channel import evidence and remaining pages before claiming a complete YouTube catalog." });
  }
  addMissing(sourceEvidence["artistImage"] === true, "missing_artist_image", "identity", "No stored artist image is available in the artist, Spotify or Songstats image sources.");
  for (const [kind, countKey, artworkKey] of [["track", "tracks", "tracksWithArtwork"], ["album", "albums", "albumsWithArtwork"]] as const) {
    const total = count(catalog[countKey]);
    const covered = count(catalog[artworkKey]);
    addMissing(total > 0 && covered === total, `missing_${kind}_artwork`, "spotify", `${covered}/${total} stored ${kind} catalog items have matched artwork.`);
  }
  addMissing(count(spotifyHistory["days"]) >= 2, "missing_spotify_daily_history", "spotify",
    `${count(spotifyHistory["days"])} stored Spotify aggregate dates; ${count(streamHistory["days"])} exact stream catalog dates. Raw track sums are a distinct measure and do not replace the original Spotify aggregate series.`);
  addMissing(count(youtube["approvedVideos"]) > 0 && count(youtube["observedVideos"]) === count(youtube["approvedVideos"]),
    "missing_approved_youtube_catalog", "youtube", `${count(youtube["observedVideos"])}/${count(youtube["approvedVideos"])} active approved video links have observed views.`);
  addMissing(count(youtube["approvedVideos"]) > 0 && count(youtube["videosWithArtwork"]) === count(youtube["approvedVideos"]),
    "missing_youtube_artwork", "youtube", `${count(youtube["videosWithArtwork"])}/${count(youtube["approvedVideos"])} approved videos have thumbnails.`);
  addMissing(count(youtubeHistory["days"]) >= 2 && count(youtubeHistory["videosWithHistory"]) === count(youtube["approvedVideos"]),
    "missing_youtube_daily_history", "youtube", `${count(youtubeHistory["videos"])}/${count(youtube["approvedVideos"])} approved videos have stored history across ${count(youtubeHistory["days"])} distinct dates. Shadow and review links do not satisfy this check.`);
  addMissing(count(sourceEvidence["comparisonPeers"]) > 0, "missing_comparison_peer", "comparisons", `${count(sourceEvidence["comparisonPeers"])} stored peer artists have usable comparison snapshots.`);
  if (artist.identityConflict) findings.push({
    code: "conflicting_provider_identity", section: "identity", status: "investigation_required",
    evidence: `${artist.spotifyIds.length} Spotify identities and ${new Set(artist.identityAliasEvidence.map(value => value.mbid)).size} accepted MusicBrainz identities share the resolved artist aliases.`,
    action: "Resolve the identity conflict before making any commercial eligibility decision.",
  });
  const identityMappingUnverified = artist.identityMappingStatus === "unverified";
  if (identityMappingUnverified) findings.push({
    code: "identity_source_mapping_unverified", section: "identity", status: "investigation_required",
    evidence: "The stored source keys have no provider identity or accepted entity-registry mapping. Missing joins cannot establish that the artist's data is absent.",
    action: "Investigate the accepted identity registry and provider mapping before classifying this source-key group.",
  });
  const incomplete = findings.some(finding => finding.status === "investigation_required");
  const blocked = findings.some(finding => finding.status === "blocked");
  const sourceIntegrityUnknown = artist.identityConflict || identityMappingUnverified || Boolean(row.missing_schema_tables?.length);
  const classification = sourceIntegrityUnknown ? null : blocked ? "C" as const : incomplete ? null : findings.length ? "B" as const : "A" as const;
  return {
    ...artist,
    auditedAt: now.toISOString(),
    legacyPublicEligible,
    publicEligible: classification === "A",
    contractValidation: classification === "A" ? "full_contract_evidence" as const : "incomplete" as const,
    classification,
    auditStatus: incomplete ? "incomplete" as const : "complete" as const,
    readiness,
    readinessReasons: findings.map(finding => finding.code),
    findings,
    sourceEvidence: { ...sourceEvidence, licensedEndpoints: Object.fromEntries(["historic_stats", "audience", "audience_details", "catalog"].map(key => [key, payload(recoveredExtended[key])])), missingEndpoints, failedEndpoints } as Record<string, unknown>,
    repairsPerformed: [
      ...(servedSummary["recovery_reason"] ? [{ code: "stream_summary_from_existing_raw", reason: servedSummary["recovery_reason"], source: servedSummary["source_table"], date: servedSummary["snapshot_date"], fetchedAt: servedSummary["fetched_at"] }] : []),
      ...(row.compact_history?.licensed_endpoint ? [{ code: "verified_compact_history_connected", growthMetricKeys: row.compact_history.growth_metric_keys, trendMetricKeys: row.compact_history.trend_metric_keys }] : []),
    ],
    lastSnapshotDate: row.snapshot?.["snapshot_date"] as string | null ?? null,
    spotifyItemCount: count(catalog["tracks"]) + count(catalog["albums"]),
    youtubeVideoCount: count(youtube["approvedVideos"]),
  };
}

export type MonitoringCandidateAuditArtist = ReturnType<typeof evaluateMonitoringCandidate>;
