import { evaluateMonitoringDailyPulse, mergeMonitoringPlatformHistory, type MonitoringPulseSnapshot } from "./monitoring-daily-pulse";
import { evaluateMonitoringReadinessRow, type ReadinessRow } from "./monitoring-readiness-row";
import { MONITORING_READINESS_POLICY_VERSION, isMonitoringReadinessDateFresh } from "./monitoring-readiness-policy";
import { normalizeArtistKey, songstatsArtistKeyCandidates } from "./songstats-artist-key";
import { buildSongstatsPublicInsight } from "./songstats-public-service";
import { normalizedMonitoringReleaseTitle } from "./monitoring-artwork";
import { youtubeCoverageFromLatestObservations } from "./youtube-latest-observation";
import { compactGrowthAtTarget, type CompactHistoryPoint } from "./monitoring-history-compact";
import { evaluateMonitoringYoutubeImportProof } from "./monitoring-youtube-policy";
import { evaluateMonitoringYoutubeNativeInspection } from "./monitoring-youtube-native-diagnostics";
import { MONITORING_YOUTUBE_NATIVE_HISTORY_CONTRACT } from "./monitoring-youtube-native-contract";

/** Read-only inventory. No collector, licensing, identity-validation or provenance writes. */
export const MONITORING_COMPLETE_CONTRACT_VERSION = "monitor_pro_complete_v1";
export const MONITORING_COMPLETE_CONTRACT = Object.freeze({
  legacyPolicyVersion: MONITORING_READINESS_POLICY_VERSION,
  required: ["licensed_audience_and_growth", "spotify_instagram_tiktok_current_and_7_30_90_growth", "current_snapshot", "daily_pulse_measured_adjacent_observations", "spotify_track_and_album_catalog",
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
  source_record_id?: string | null;
  discovery_status?: string | null;
  matched_artist_key?: string | null;
}

export interface MonitoringCandidateIdentity {
  artistKey: string;
  artistName: string;
  matchKeys: string[];
  sourceKeys: string[];
  candidateSources: string[];
  spotifyIds: string[];
  invalidSpotifyIds: string[];
  identityConflict: boolean;
  declaredAliases: string[];
  identityAliasEvidence: Array<{ source: "musicbrainz_artists" | "artist_candidates"; artistKey: string; mbid?: string; candidateId?: string; matchedArtistKey?: string; verification: string; aliases: string[] }>;
  candidateRecords: Array<{ source: "artist_candidates" | "spotify_artist_candidates"; recordId: string; artistName: string | null; lookupName: string; status: string | null; matchedArtistKey: string | null }>;
  identityMappingStatus: "provider_id" | "accepted_registry" | "unverified" | "conflict";
}

const acceptedRegistryRow = (row: MonitoringCandidateSourceRow) => row.source === "musicbrainz_artists" && Boolean(row.mbid?.trim()) &&
  ["auto", "auto_review_accepted", "manual_review_accepted"].includes(row.verified ?? "");
const acceptedDiscoveryRow = (row: MonitoringCandidateSourceRow) => row.source === "artist_candidates" && Boolean(row.matched_artist_key?.trim()) &&
  ["approved", "linked_existing_artist"].includes(row.discovery_status ?? "");
const declaredRowAliases = (row: MonitoringCandidateSourceRow) => acceptedRegistryRow(row) || acceptedDiscoveryRow(row)
  ? [...new Set([row.artist_name, ...(acceptedDiscoveryRow(row) ? [row.artist_key] : []), ...(Array.isArray(row.declared_aliases) ? row.declared_aliases : [])]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map(value => value.trim()))] : [];
const INSPECTION_SOURCE_PRIORITY = ["monitoring_subscriptions", "mexican_artist_identity_candidates", "artist_social_account_candidates", "youtube_music_artist_candidates", "artist_profile_routes", "supplemental_artist_data"];
const assertedSpotifyId = (row: MonitoringCandidateSourceRow) => ["artist_candidates", "spotify_artist_candidates", ...INSPECTION_SOURCE_PRIORITY].includes(row.source) ? null : row.spotify_id?.trim() || null;
/** Provider IDs are opaque 22-character base62 values. Preserve malformed
 * assertions for review, but never use them as cross-artist identity edges. */
export function isMonitoringSpotifyArtistId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9]{22}$/.test(value);
}

const SOURCE_PRIORITY = ["kworb_coverage", "official_artists", "spotify_artists", "songstats_artists"];
/** Keep Unicode identity names exact. Removing their characters can produce an
 * empty key, or reduce distinct mixed-script names to the same ASCII fragment.
 * ASCII and accent-normalized Latin names retain the established aliases.
 */
export function monitoringIdentityKeyCandidates(value: string): string[] {
  const normalized = normalizeArtistKey(value);
  if (!normalized) return [];
  return /[^\x00-\x7f]/.test(normalized) ? [normalized] : songstatsArtistKeyCandidates(normalized);
}

/** Deterministic connected identity groups, including explicit aliases and provider IDs.
 * Conflicting provider IDs are retained as a diagnostic and never commercially approved.
 */
export function groupMonitoringCandidateIdentities(rows: MonitoringCandidateSourceRow[]): MonitoringCandidateIdentity[] {
  const groups: MonitoringCandidateSourceRow[][] = [];
  const index = new Map<string, number>();
  const parents: number[] = [];
  const root = (id: number): number => parents[id] === id ? id : (parents[id] = root(parents[id]!));
  for (const row of rows.filter(row => row.artist_key?.trim())) {
    const spotifyId = assertedSpotifyId(row);
    const keys = [...[row.artist_key, ...declaredRowAliases(row), ...(acceptedDiscoveryRow(row) ? [row.matched_artist_key!] : [])].flatMap(monitoringIdentityKeyCandidates).map(key => `key:${key}`),
      ...(isMonitoringSpotifyArtistId(spotifyId) ? [`spotify:${spotifyId}`] : []),
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
    const priority = (source: string) => { const index = SOURCE_PRIORITY.indexOf(source), lead = INSPECTION_SOURCE_PRIORITY.indexOf(source); return lead >= 0 ? 100 + lead : index < 0 ? 99 : index; };
    const ordered = [...group].sort((a, b) => priority(a.source) - priority(b.source) || a.artist_key.localeCompare(b.artist_key));
    // Inspection leads must not replace an existing source's canonical key or
    // display name, including its key fallback and accepted discovery target.
    // The earlier subscription-only representation also keeps precedence over
    // newly inventoried registries. Their verification is not a provider grant.
    const existing = ordered.filter(row => !INSPECTION_SOURCE_PRIORITY.includes(row.source));
    const representatives = existing.length ? existing : ordered.filter(row => priority(row.source) === priority(ordered[0]!.source));
    const first = representatives.find(row => row.source !== "artist_candidates") ?? representatives[0]!;
    // artist_candidates stores discovery names, not serving artist_key values.
    // Preserve those records separately; an accepted matched_artist_id is an
    // explicit relationship, never a fabricated source-data row.
    const sourceKeys = [...new Set(ordered.filter(row => row.source !== "artist_candidates").map(row => row.artist_key))].sort();
    const spotifyIds = [...new Set(ordered.flatMap(row => assertedSpotifyId(row) ? [assertedSpotifyId(row)!] : []))].sort();
    const invalidSpotifyIds = spotifyIds.filter(value => !isMonitoringSpotifyArtistId(value));
    const declaredAliases = [...new Set(group.flatMap(declaredRowAliases))].sort();
    const identityAliasEvidence: MonitoringCandidateIdentity["identityAliasEvidence"] = [
      ...group.filter(acceptedRegistryRow).map(row => ({ source: "musicbrainz_artists" as const,
        artistKey: row.artist_key, mbid: row.mbid!, verification: row.verified!, aliases: declaredRowAliases(row) })),
      ...group.filter(acceptedDiscoveryRow).map(row => ({ source: "artist_candidates" as const,
        artistKey: row.matched_artist_key!, candidateId: row.source_record_id ?? row.artist_key, matchedArtistKey: row.matched_artist_key!,
        verification: row.discovery_status!, aliases: declaredRowAliases(row) })),
    ];
    const acceptedTargets = group.filter(acceptedDiscoveryRow).map(row => row.matched_artist_key!);
    const targetGroups = new Set(acceptedTargets.map(key => monitoringIdentityKeyCandidates(key).filter(token => /^[a-z0-9]+$/.test(token)).sort()[0] ?? normalizeArtistKey(key)));
    const identityConflict = spotifyIds.length > 1 || new Set(identityAliasEvidence.flatMap(value => value.mbid ? [value.mbid] : [])).size > 1 || targetGroups.size > 1;
    const candidateRecords: MonitoringCandidateIdentity["candidateRecords"] = group.filter(row => ["artist_candidates", "spotify_artist_candidates"].includes(row.source))
      .map(row => ({ source: row.source as "artist_candidates" | "spotify_artist_candidates", recordId: row.source_record_id ?? row.artist_key,
        artistName: row.artist_name, lookupName: row.artist_key, status: row.discovery_status ?? null, matchedArtistKey: row.matched_artist_key ?? null }));
    return {
      artistKey: acceptedDiscoveryRow(first) ? first.matched_artist_key! : first.artist_key,
      artistName: representatives.find(row => row.artist_name?.trim())?.artist_name?.trim() || first.artist_key,
      sourceKeys,
      matchKeys: [...new Set([...sourceKeys, ...declaredAliases, ...acceptedTargets, ...candidateRecords.map(row => row.lookupName)]
        .flatMap(key => [key, key.toLowerCase(), ...monitoringIdentityKeyCandidates(key)]))],
      candidateSources: [...new Set(group.map(row => row.source))].sort(),
      spotifyIds,
      invalidSpotifyIds,
      identityConflict,
      declaredAliases,
      identityAliasEvidence,
      candidateRecords,
      identityMappingStatus: identityConflict ? "conflict" as const : spotifyIds.some(isMonitoringSpotifyArtistId) ? "provider_id" as const : identityAliasEvidence.length ? "accepted_registry" as const : "unverified" as const,
    };
  }).sort((a, b) => a.artistKey.localeCompare(b.artistKey));
}

export interface MonitoringCandidateEvidenceRow {
  artist_key: string;
  native_history_captured_at?: string | null;
  audit_captured_at?: string | null;
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
  const pulseHistory = object(sourceEvidence["currentHistory"]);
  const pulseSnapshots = Array.isArray(pulseHistory["latestSnapshots"])
    ? pulseHistory["latestSnapshots"].map(object) as MonitoringPulseSnapshot[] : [];
  const pulse = evaluateMonitoringDailyPulse(mergeMonitoringPlatformHistory(pulseSnapshots, recoveredInsight.trends), now);
  const pulseEvidenceInspected = Array.isArray(pulseHistory["latestSnapshots"]);
  const pulseComplete = pulseEvidenceInspected && pulse.complete;
  sourceEvidence["dailyPulse"] = { currentDate: pulse.currentDate, previousDate: pulse.previousDate,
    gapDays: pulse.gapDays, fresh: pulse.fresh, complete: pulseComplete, reason: pulse.reason,
    measuredMetricCount: pulse.pairedMetricKeys.length, pairedMetricKeys: pulse.pairedMetricKeys,
    source: "songstats_artist_daily_snapshots_and_licensed_trends", evidenceInspected: pulseEvidenceInspected,
    rawLicensedRecoveryUninvestigated: !pulseComplete && payload(recoveredExtended["historic_stats"]),
    compactRecoveryUninvestigated: !pulseComplete && count(object(sourceEvidence["compactHistory"])["points"]) > 0 };
  const comparisonDates = Array.isArray(sourceEvidence["comparisonPeerDates"]) ? sourceEvidence["comparisonPeerDates"].map(object) : null;
  const freshComparisonPeers = comparisonDates?.reduce((total, bucket) => total +
    (typeof bucket["date"] === "string" && isMonitoringReadinessDateFresh(bucket["date"], 14, now) ? count(bucket["peers"]) : 0), 0) ?? null;
  sourceEvidence["comparisonCoverage"] = { storedPeers: count(sourceEvidence["comparisonPeers"]), freshPeers: freshComparisonPeers,
    maximumAgeDays: 14, source: "latest_songstats_artist_daily_snapshots" };
  sourceEvidence["reportPrerequisites"] = { period: "weekly", layout: "eight_page_weekly", currentSnapshot: Boolean(row.snapshot),
    previousSnapshot: Boolean(pulse.previous), dailyPulseComplete: pulseComplete,
    mexicoCities: readiness.mexicoCities, comparisonPeers: freshComparisonPeers, generationVerified: false,
    verification: "Actual authenticated PDF generation and visual review are separate runtime acceptance checks." };
  const findings: MonitoringCandidateFinding[] = [];
  // The dashboard already serves a live Kworb catalog and Spotify artwork
  // enrichment. SQL absence alone does not investigate those approved sources.
  // A reviewed capture must identify the artist and its reproducible evidence;
  // the caller must apply that evidence to the same items/summary being audited.
  const liveInvestigation = object(sourceEvidence["liveCatalogInvestigation"]);
  const reviewedLiveCapture = liveInvestigation["status"] === "reviewed"
    && liveInvestigation["source"] === "kworb_live_complete_catalog"
    && typeof liveInvestigation["reference"] === "string" && Boolean(liveInvestigation["reference"].trim())
    && typeof liveInvestigation["observedAt"] === "string" && Number.isFinite(Date.parse(liveInvestigation["observedAt"]))
    && typeof liveInvestigation["spotifyArtistId"] === "string" && artist.spotifyIds.includes(liveInvestigation["spotifyArtistId"]);
  const liveCatalogApplied = reviewedLiveCapture && liveInvestigation["catalogEvidenceApplied"] === true;
  const liveArtworkApplied = liveCatalogApplied && liveInvestigation["artworkEvidenceApplied"] === true;
  const liveCatalogReasons = new Set(["missing_stream_catalog", "stream_snapshot_stale", "missing_daily_streams", "missing_lifetime_streams"]);
  let needsLiveInvestigation = false;
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
  // Inspect the datasets already used by the canonical renderer independently.
  // Never fabricate endpoint payloads or change the exact legacy readiness call.
  const detailsRow = extendedRows.find(value => payload(value["audience_details"]));
  const detailCities = buildSongstatsPublicInsight({ historicStats: null, audience: null, audienceDetails: detailsRow?.["audience_details"] }, { access: "monitoring" }).topMexicoCities;
  const detailsDate = detailsRow?.["audience_details_fetched_at"];
  const detailsSourceKey = detailsRow?.["artist_key"];
  const detailsProven = detailCities.length > 0 && typeof detailsSourceKey === "string" && artist.sourceKeys.includes(detailsSourceKey)
    && typeof detailsDate === "string" && Number.isFinite(Date.parse(detailsDate));
  const endpointCatalog = object(sourceEvidence["catalog"]);
  const endpointCatalogProof = object(sourceEvidence["catalogCompleteness"]);
  const inspectedCatalogItems = row.stream_items ?? [];
  const inspectedTracks = new Set(inspectedCatalogItems.filter(item => item.item_type === "track" && item.item_key && item.title).map(item => item.item_key)).size;
  const inspectedAlbums = new Set(inspectedCatalogItems.filter(item => item.item_type === "album" && item.item_key && item.title).map(item => item.item_key)).size;
  const catalogDatasetComplete = inspectedTracks > 0 && inspectedAlbums > 0
    && endpointCatalogProof["verified"] === true
    && typeof endpointCatalogProof["reference"] === "string" && Boolean(endpointCatalogProof["reference"].trim())
    && count(endpointCatalogProof["expectedTracks"]) === inspectedTracks && count(endpointCatalogProof["expectedAlbums"]) === inspectedAlbums
    && count(endpointCatalog["tracks"]) === inspectedTracks && count(endpointCatalog["albums"]) === inspectedAlbums
    && count(endpointCatalog["tracksWithArtwork"]) === inspectedTracks && count(endpointCatalog["albumsWithArtwork"]) === inspectedAlbums
    && count(servedSummary["track_count"]) === inspectedTracks && count(servedSummary["album_count"]) === inspectedAlbums
    && isMonitoringReadinessDateFresh(typeof servedSummary["snapshot_date"] === "string" ? servedSummary["snapshot_date"] : null, 14, now)
    && count(servedSummary["track_daily_streams"]) > 0 && count(servedSummary["track_total_streams"]) > 0 && count(servedSummary["album_total_streams"]) > 0;
  const liveCatalogProofBound = liveCatalogApplied && liveArtworkApplied && !artist.identityConflict
    && artist.spotifyIds.length === 1 && isMonitoringSpotifyArtistId(liveInvestigation["spotifyArtistId"])
    && isMonitoringReadinessDateFresh(typeof liveInvestigation["observedAt"] === "string" ? liveInvestigation["observedAt"] : null, 14, now)
    && servedSummary["snapshot_date"] === String(liveInvestigation["observedAt"]).slice(0, 10)
    && endpointCatalogProof["source"] === "kworb_live_complete_catalog"
    && endpointCatalogProof["reference"] === liveInvestigation["reference"]
    && endpointCatalogProof["spotifyArtistId"] === liveInvestigation["spotifyArtistId"];
  const archiveProofKeys = endpointCatalogProof["sourceKeys"];
  const archiveCatalogProofBound = !artist.identityConflict && ["monitoring_stream_items", "monitoring_stream_daily_snapshots"].includes(String(endpointCatalogProof["source"]))
    && endpointCatalogProof["artistKey"] === artist.artistKey && endpointCatalogProof["evidenceApplied"] === true
    && Array.isArray(archiveProofKeys) && archiveProofKeys.length > 0
    && archiveProofKeys.every(key => typeof key === "string" && artist.sourceKeys.includes(key))
    && String(servedSummary["source_table"] ?? "").startsWith("monitoring_stream_");
  const catalogAlternateProven = catalogDatasetComplete && (liveCatalogProofBound || archiveCatalogProofBound);
  const endpointMismatches = [
    ...(missingEndpoints.includes("audience") && detailCities.length > 0 ? [{ endpoint: "audience", complete: detailsProven,
      alternateSource: "songstats_artist_extended_data.audience_details", sourceArtistKey: detailsSourceKey ?? null,
      fetchedAt: detailsDate ?? null, parsedMexicoCities: detailCities.length }] : []),
    ...(missingEndpoints.includes("catalog") ? [{ endpoint: "catalog", complete: catalogAlternateProven,
      alternateSource: catalogAlternateProven ? endpointCatalogProof["source"] : "canonical_archive_or_live_kworb_catalog",
      reference: endpointCatalogProof["reference"] ?? null, inspectedTracks, inspectedAlbums,
      datasetComplete: catalogDatasetComplete, identityAndCaptureBound: liveCatalogProofBound || archiveCatalogProofBound,
      spotifyArtistId: endpointCatalogProof["spotifyArtistId"] ?? null, sourceKeys: archiveProofKeys ?? null,
      summarySnapshotDate: servedSummary["snapshot_date"] ?? null }] : []),
  ];
  const endpointOnlyContractMismatch = missingEndpoints.length > 0 && missingEndpoints.every(endpoint =>
    endpointMismatches.some(mismatch => mismatch.endpoint === endpoint)
      || endpoint === "historic_stats" && row.compact_history?.licensed_endpoint === true);
  const endpointAlternatesComplete = endpointOnlyContractMismatch && endpointMismatches.every(mismatch => mismatch.complete);
  if (endpointMismatches.length) {
    sourceEvidence["endpointPresenceContractMismatch"] = { legacyReadinessPreserved: true, complete: endpointAlternatesComplete, endpoints: endpointMismatches };
    findings.push({ code: "endpoint_presence_contract_mismatch", section: "source_inventory",
      status: endpointAlternatesComplete ? "repairable" : "investigation_required",
      evidence: `The legacy v${MONITORING_READINESS_POLICY_VERSION} gate requires endpoint payloads for ${endpointMismatches.map(value => value.endpoint).join(", ")}; the canonical renderer has an existing alternate dataset path. ${endpointAlternatesComplete ? "The corresponding actual datasets, identity, capture provenance and catalog coverage have been inspected and applied." : "The complete corresponding dataset and provenance proof have not all been established."}`,
      action: endpointAlternatesComplete ? "Review and align the endpoint-presence contract with the proven canonical datasets. Legacy eligibility stays unchanged until that contract correction is made."
        : "Inspect the existing licensed audience detail or canonical catalog items, identity, timestamps and artwork; apply complete scoped evidence before treating the endpoint mismatch as repairable." });
  }
  for (const reason of readiness.reasons) {
    const repairable = !repairedReadiness.reasons.includes(reason);
    const endpointMismatch = reason === "missing_licensed_endpoint" && endpointOnlyContractMismatch;
    const endpointFailure = reason === "missing_licensed_endpoint" && missingEndpoints.some(endpoint => failedEndpoints.includes(endpoint));
    const compactNeedsEvaluation = (["insufficient_growth_history", "insufficient_trend_history", "missing_licensed_endpoint"].includes(reason)
      && count(object(sourceEvidence["compactHistory"])["points"]) > 0)
      || (["missing_spotify_audience", "missing_youtube_audience", "insufficient_platform_breadth"].includes(reason)
        && Boolean(row.compact_history?.available_metric_keys?.length));
    const liveSourceUninvestigated = liveCatalogReasons.has(reason) && !liveCatalogApplied;
    if (!repairable && liveSourceUninvestigated) needsLiveInvestigation = true;
    findings.push({
      code: reason,
      section: /stream/.test(reason) ? "spotify" : /mexico/.test(reason) ? "markets" : "audience_and_growth",
      status: endpointMismatch ? endpointAlternatesComplete ? "repairable" : "investigation_required"
        : repairable ? "repairable" : endpointFailure || compactNeedsEvaluation || liveSourceUninvestigated ? "investigation_required" : "blocked",
      evidence: reason === "missing_licensed_endpoint"
        ? `Missing stored licensed payloads: ${missingEndpoints.join(", ")}. Failed endpoint keys: ${failedEndpoints.join(", ") || "none"}.`
        : liveSourceUninvestigated ? "The stored catalog fails this check; the dashboard's approved live Kworb catalog has not been reviewed and applied to this audit. Stored absence does not establish source absence."
          : compactNeedsEvaluation ? "Verified compact historical observations exist; the legacy payload parser cannot prove their growth/trend coverage."
          : repairable ? "Existing exact raw stream rows satisfy this check; the serving summary does not."
          : `The existing v${MONITORING_READINESS_POLICY_VERSION} check fails across the resolved stored source keys.`,
      action: endpointMismatch ? "See endpoint_presence_contract_mismatch; preserve the failed legacy endpoint gate without claiming the rendered dataset is absent."
        : repairable ? "Serve or rebuild the artist summary from the existing exact dated track and album rows."
        : liveSourceUninvestigated ? "Investigate the existing live catalog and apply its actual items, timestamps and exact summary before classifying this gap."
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
  const youtubeServing = object(sourceEvidence["youtubeServing"]);
  const youtubeServedCatalog = object(youtubeServing["catalog"]);
  const youtubeLegacyVideos = object(youtubeServing["legacyVideos"]);
  const youtubeChannelHistory = object(youtubeServing["channelDailyHistory"]);
  const youtubeServedNativeHistory = object(youtubeServing["nativeDailyHistory"]);
  const youtubeSourceNeedsReview = count(youtube["approvedVideos"]) === 0 && (youtubeServing["inspected"] !== true
    || count(youtubeServedCatalog["videos"]) > 0 || count(youtubeLegacyVideos["videos"]) > 0
    || count(youtubeChannelHistory["points"]) > 0 || count(youtubeServedNativeHistory["points"]) > 0);
  if (youtubeSourceNeedsReview) findings.push({
    code: "youtube_serving_source_requires_investigation", section: "youtube", status: "investigation_required",
    evidence: `${count(youtubeServedCatalog["videos"])} existing served videos, ${count(youtubeServedNativeHistory["points"])} native per-video snapshots, ${count(youtubeLegacyVideos["videos"])} linked-channel cached videos, and ${count(youtubeChannelHistory["points"])} exact channel snapshots are recorded outside approved-link coverage. ${youtubeServing["inspected"] === true ? "Their relationship and measurement provenance remain separate." : "Those serving sources have not been inventoried in this evidence."}`,
    action: "Inspect the existing serving relationships and dated sources. Review/shadow relationships never become approved links, and channel history never substitutes for per-video completeness.",
  });
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
  addMissing(pulseComplete, "missing_daily_pulse_history", "pulse",
    `Daily pulse dates are ${pulse.previousDate ?? "missing"} and ${pulse.currentDate ?? "missing"}, with ${pulse.pairedMetricKeys.length} paired finite metrics. Adjacent fresh dates and at least one measured pair are required; an unmeasured change is not zero.`,
    false, !pulseEvidenceInspected || count(object(sourceEvidence["compactHistory"])["points"]) > 0 || payload(recoveredExtended["historic_stats"]));
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
    "stale_or_missing_youtube_observations", "youtube", `${observationCoverage.freshVideos}/${count(youtube["approvedVideos"])} approved videos satisfy the existing six-hour observation freshness policy.`, false, youtubeSourceNeedsReview);
  addMissing(validDeltas.size === count(youtube["approvedVideos"]) && validDeltas.size > 0,
    "missing_youtube_observed_deltas", "youtube", `${validDeltas.size}/${count(youtube["approvedVideos"])} approved videos have an observed delta and positive elapsed interval; missing deltas are never replaced with zero.`, false, youtubeSourceNeedsReview);
  const importProof = evaluateMonitoringYoutubeImportProof(sourceEvidence);
  sourceEvidence["youtubeImportProof"] = importProof;
  if (!importProof.complete) {
    findings.push({ code: "incomplete_youtube_catalog", section: "youtube", status: importProof.knownMissing && !youtubeSourceNeedsReview ? "blocked" : "investigation_required",
      evidence: `${importProof.channels.length} channel import states for ${importProof.linkedChannelCount} linked channels; each expected/imported count must reconcile with observed approved videos on that exact channel. Unaccounted channels: ${importProof.unaccountedChannelIds.join(", ") || "none"}.`,
      action: "Verify every linked channel's import identity, completion, remaining pages and observed approved-video coverage before claiming a complete YouTube catalog." });
  }
  addMissing(sourceEvidence["artistImage"] === true, "missing_artist_image", "identity", "No stored artist image is available in the artist, Spotify or Songstats image sources.");
  for (const [kind, countKey, artworkKey] of [["track", "tracks", "tracksWithArtwork"], ["album", "albums", "albumsWithArtwork"]] as const) {
    const total = count(catalog[countKey]);
    const covered = count(catalog[artworkKey]);
    const coveredCompletely = total > 0 && covered === total;
    if (!coveredCompletely && !liveArtworkApplied) needsLiveInvestigation = true;
    addMissing(coveredCompletely, `missing_${kind}_artwork`, "spotify", `${covered}/${total} stored ${kind} catalog items have matched artwork.${!liveArtworkApplied ? " The approved live catalog and Spotify artwork fallback have not been reviewed and applied to this audit." : ""}`, false, !liveArtworkApplied);
  }
  if (needsLiveInvestigation) findings.push({
    code: "live_catalog_fallback_uninvestigated", section: "spotify", status: "investigation_required",
    evidence: "The dashboard already supports a live Kworb catalog with Spotify artwork enrichment. This stored-data audit has no reviewed, applied capture of that fallback for the failing catalog checks.",
    action: "Read and validate the existing live source, preserve its reference and artist identity, and evaluate the actual served catalog and artwork. Do not invent counts or require a new database write.",
  });
  addMissing(count(spotifyHistory["days"]) >= 2, "missing_spotify_daily_history", "spotify",
    `${count(spotifyHistory["days"])} stored Spotify aggregate dates; ${count(streamHistory["days"])} exact stream catalog dates. Raw track sums are a distinct measure and do not replace the original Spotify aggregate series.`);
  addMissing(count(youtube["approvedVideos"]) > 0 && count(youtube["observedVideos"]) === count(youtube["approvedVideos"]),
    "missing_approved_youtube_catalog", "youtube", `${count(youtube["observedVideos"])}/${count(youtube["approvedVideos"])} active approved video links have observed views.`, false, youtubeSourceNeedsReview);
  addMissing(count(youtube["approvedVideos"]) > 0 && count(youtube["videosWithArtwork"]) === count(youtube["approvedVideos"]),
    "missing_youtube_artwork", "youtube", `${count(youtube["videosWithArtwork"])}/${count(youtube["approvedVideos"])} approved videos have thumbnails.`, false, youtubeSourceNeedsReview);
  const youtubeDailyHistoryComplete = count(youtubeHistory["days"]) >= 2
    && count(youtubeHistory["videosWithHistory"]) === count(youtube["approvedVideos"]);
  const nativeInspection = evaluateMonitoringYoutubeNativeInspection(youtubeServing["nativeIntradayHistory"], {
    sourceKeys: artist.sourceKeys, captureClocks: [row.native_history_captured_at, ...(row.audit_captured_at === undefined ? [] : [row.audit_captured_at])],
    missingTables: row.missing_schema_tables, identityConflict: artist.identityConflict,
    approvedTrackedVideos: youtube["approvedVideos"],
  });
  sourceEvidence["youtubeNativeHistoryInspection"] = nativeInspection;
  const approvedNative = nativeInspection.proof?.buckets.find(bucket => bucket.scope === "approved");
  const nativeInspected = nativeInspection.status === "complete";
  const nativeHistoryRepairProven = nativeInspected && !artist.identityConflict
    && artist.artistKey.trim().length > 0 && artist.artistKey.trim().length <= 160
    && ["provider_id", "accepted_registry"].includes(artist.identityMappingStatus)
    && artist.spotifyIds.every(isMonitoringSpotifyArtistId)
    && count(approvedNative?.["eligibleVideos"]) > 0
    && count(approvedNative?.["renderableVideosWithMultipleDates"]) === count(approvedNative?.["eligibleVideos"])
    && count(approvedNative?.["missingTrackedVideos"]) === 0 && count(approvedNative?.["invalidVideoIds"]) === 0
    && count(approvedNative?.["unrenderableVideos"]) === 0 && count(approvedNative?.["invalidSelectedPointCount"]) === 0;
  const nativeContractNeedsReview = nativeInspected && !nativeHistoryRepairProven && (count(approvedNative?.["rawObservationCount"]) > 0
    || count(approvedNative?.["invalidVideoIds"]) > 0 || count(approvedNative?.["missingTrackedVideos"]) > 0);
  sourceEvidence["youtubeNativeHistoryRepair"] = {
    status: youtubeDailyHistoryComplete ? "not_needed" : nativeHistoryRepairProven ? "repairable" : "unproven",
    reason: "existing_native_cumulative_history_table_contract_mismatch",
    servingContract: MONITORING_YOUTUBE_NATIVE_HISTORY_CONTRACT,
    servingImplementation: "current_shared_source", runtimeAcceptance: "not_established_by_source_audit",
    approvedVideos: count(approvedNative?.["eligibleVideos"]), minimumObservedDatesPerVideo: 2,
    range: "90d", dailyTableGatePassed: youtubeDailyHistoryComplete, publicGateChanged: false,
    proof: nativeHistoryRepairProven ? { inspectionVersion: nativeInspection.proof!["inspectionVersion"],
      servingContractVersion: nativeInspection.proof!["servingContractVersion"], sourceKeys: nativeInspection.proof!.sourceKeys,
      captureClock: nativeInspection.proof!.captureClock } : null,
  };
  // Completing this investigation never changes the approved daily gate. The
  // archive may be absent, partial or a different measured contract after a
  // successful inspection; those are known outcomes, not uninspected sources.
  if (!youtubeDailyHistoryComplete && !nativeInspected) findings.push({
    code: "youtube_native_intraday_fallback_uninvestigated", section: "youtube", status: "investigation_required",
    evidence: `The approved daily snapshot history is incomplete. Exact official native intraday investigation is ${nativeInspection.status}: ${nativeInspection.reason}. Empty daily storage does not establish absence of native cumulative observations.`,
    action: "Capture complete exact-key native archive evidence with an independent statement clock and reconciled per-video Eastern-date coverage. Candidate/channel histories and protected comparator records never satisfy approved daily history.",
  });
  if (!youtubeDailyHistoryComplete && nativeContractNeedsReview) findings.push({
    code: "youtube_native_history_contract_review_required", section: "youtube", status: "investigation_required",
    evidence: `${count(approvedNative?.["rawObservationCount"])} official cumulative observations were inspected for approved video relationships; ${count(approvedNative?.["invalidVideoIds"])} IDs are invalid and ${count(approvedNative?.["missingTrackedVideos"])} have no tracked record. The existing native history endpoint serves the last real sample per ET date for usable identities. A different or empty daily table does not establish that required historical data is absent.`,
    action: "Review the exact per-video union of existing dated observations and the required serving contract. Preserve source timestamps, missing dates and relationship provenance; do not infer a daily delta, public eligibility or an applied repair from aggregate counts.",
  });
  if (!youtubeDailyHistoryComplete && nativeHistoryRepairProven) findings.push({
    code: "youtube_native_history_contract_mismatch", section: "youtube", status: "repairable",
    evidence: `All approved videos (${count(approvedNative?.["eligibleVideos"])}) have valid tracked identities and at least two renderable native cumulative ET dates in the exact 90-day proof. The current shared endpoint already serves that source contract; the daily-table predicate remains unmet.`,
    action: "Review and align the table-specific history requirement with this proven shared cumulative-history source. Keep public eligibility unchanged until that contract decision; no new observations, daily deltas or database writes are required to provide this history.",
  });
  if (!youtubeDailyHistoryComplete) findings.push({
    code: "missing_youtube_daily_history", section: "youtube",
    status: nativeHistoryRepairProven ? "repairable" : !nativeInspected || nativeContractNeedsReview || youtubeSourceNeedsReview ? "investigation_required" : "blocked",
    evidence: `${count(youtubeHistory["videos"])}/${count(youtube["approvedVideos"])} approved videos have daily snapshots across ${count(youtubeHistory["days"])} distinct dates in the dashboard's 90-day Eastern range. ${nativeInspected
      ? `Native cumulative history was inspected: ${count(approvedNative?.["videosWithMultipleDates"])}/${count(approvedNative?.["eligibleVideos"])} approved video IDs have at least two observed ET dates (${nativeInspection.approvedOutcome}). The existing daily-table gate remains unmet.${nativeHistoryRepairProven ? " The complete approved native source supports an existing-data contract repair through the current shared endpoint." : nativeContractNeedsReview ? " Available native observations or unresolved video identities require a separate serving-contract review; this is not a claim that native historical data is absent." : " No trusted approved native observations were found in this exact range."}`
      : "The separate official native intraday archive has no complete scoped inspection proof."} Shadow/review relationships and cumulative readings do not automatically replace this daily check.`,
    action: nativeHistoryRepairProven ? "See youtube_native_history_contract_mismatch: source access is implemented, while the table-specific eligibility decision remains separate."
      : "Inspect and reconcile the required approved history and source/date semantics before changing eligibility.",
  });
  addMissing(freshComparisonPeers != null && freshComparisonPeers > 0, "missing_comparison_peer", "comparisons",
    `${freshComparisonPeers ?? "Unknown"} fresh peers out of ${count(sourceEvidence["comparisonPeers"])} stored peer artists; only each peer's latest positive snapshot within the existing 14-day freshness limit qualifies.`,
    false, comparisonDates == null && count(sourceEvidence["comparisonPeers"]) > 0);
  if (artist.identityConflict) findings.push({
    code: "conflicting_provider_identity", section: "identity", status: "investigation_required",
    evidence: `${artist.spotifyIds.length} Spotify identities, ${new Set(artist.identityAliasEvidence.flatMap(value => value.mbid ? [value.mbid] : [])).size} accepted MusicBrainz identities, and ${new Set(artist.identityAliasEvidence.flatMap(value => value.matchedArtistKey ? [value.matchedArtistKey] : [])).size} accepted discovery targets share the resolved artist aliases.`,
    action: "Resolve the identity conflict before making any commercial eligibility decision.",
  });
  const invalidSpotifyIds = artist.spotifyIds.filter(value => !isMonitoringSpotifyArtistId(value));
  if (invalidSpotifyIds.length) findings.push({
    code: "invalid_artist_mapping", section: "identity", status: "investigation_required",
    evidence: `Stored Spotify identity assertions have an invalid provider format: ${invalidSpotifyIds.join(", ")}. They remain diagnostic and cannot join source keys or start provider lookups.`,
    action: "Review the source identity assertions before making any commercial eligibility decision; do not infer a replacement ID.",
  });
  const identityMappingUnverified = artist.identityMappingStatus === "unverified";
  if (identityMappingUnverified) findings.push({
    code: "identity_source_mapping_unverified", section: "identity", status: "investigation_required",
    evidence: "The stored source keys have no provider identity or accepted entity-registry mapping. Missing joins cannot establish that the artist's data is absent.",
    action: "Investigate the accepted identity registry and provider mapping before classifying this source-key group.",
  });
  const incomplete = findings.some(finding => finding.status === "investigation_required");
  const blocked = findings.some(finding => finding.status === "blocked");
  const sourceIntegrityUnknown = artist.identityConflict || invalidSpotifyIds.length > 0 || identityMappingUnverified || Boolean(row.missing_schema_tables?.length);
  const classification = sourceIntegrityUnknown ? null : blocked ? "C" as const : incomplete ? null : findings.length ? "B" as const : "A" as const;
  return {
    ...artist,
    invalidSpotifyIds,
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
