import { monitoringReadPool, publicReadPool, type PgPool } from "@workspace/db";
import {
  evaluateMonitoringReadinessRow,
  executeMonitoringReadinessQuery,
  type ReadinessRow,
} from "./monitoring-readiness-service";
import { MONITORING_READINESS_POLICY_VERSION, isMonitoringReadinessDateFresh } from "./monitoring-readiness-policy";
import { compactArtistKey, songstatsArtistKeyCandidates } from "./songstats-artist-key";
import { loadMonitoringAuditSchema, withUnavailableMonitoringSources } from "./monitoring-audit-schema";
import { buildSongstatsPublicInsight } from "./songstats-public-service";
import { normalizedMonitoringReleaseTitle } from "./monitoring-artwork";
import { buildLatestMonitoringStreamSummarySql } from "./monitoring-stream-serving";
import { buildMonitoringCompactReadinessSql } from "./monitoring-compact-readiness";
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
}

export interface MonitoringCandidateIdentity {
  artistKey: string;
  artistName: string;
  matchKeys: string[];
  sourceKeys: string[];
  candidateSources: string[];
  spotifyIds: string[];
  identityConflict: boolean;
}

const SOURCE_PRIORITY = ["kworb_coverage", "official_artists", "spotify_artists", "songstats_artists"];
export const MONITORING_CANDIDATE_POPULATION_SQL = `
  SELECT artist_key, artist_name, spotify_id, 'kworb_coverage' source FROM kworb_coverage
  UNION ALL SELECT artist_key, artist_name, NULL, 'official_artists' FROM official_artists
  UNION ALL SELECT artist_key, spotify_name, spotify_artist_id, 'spotify_artists' FROM spotify_artists
  UNION ALL SELECT artist_key, songstats_name, spotify_artist_id, 'songstats_artists' FROM songstats_artists
  UNION ALL SELECT artist_key, NULL, spotify_artist_id, 'songstats_artist_extended_data' FROM songstats_artist_extended_data
  UNION ALL SELECT DISTINCT artist_key, NULL, spotify_artist_id, 'songstats_artist_daily_snapshots' FROM songstats_artist_daily_snapshots
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'monitoring_stream_items' FROM monitoring_stream_items
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'monitoring_stream_daily_snapshots' FROM monitoring_stream_daily_snapshots
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'monitoring_stream_daily_artist_summaries' FROM monitoring_stream_daily_artist_summaries
  UNION ALL SELECT DISTINCT artist_key, NULL, spotify_artist_id, 'spotify_kworb_daily_snapshots' FROM spotify_kworb_daily_snapshots
  UNION ALL SELECT artist_key, title, NULL, 'youtube_channels' FROM youtube_channels
  UNION ALL SELECT DISTINCT artist_key, artist_name, NULL, 'youtube_artist_video_links' FROM youtube_artist_video_links
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'youtube_kworb_daily_snapshots' FROM youtube_kworb_daily_snapshots
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'youtube_artist_video_daily_rollups' FROM youtube_artist_video_daily_rollups
  UNION ALL SELECT artist_key, NULL, spotify_artist_id, 'songstats_history_provider_identities' FROM songstats_history_provider_identities
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'songstats_historical_observations' FROM songstats_historical_observations
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'kworb_snapshots' FROM kworb_snapshots
  UNION ALL SELECT artist_key, NULL, NULL, 'artist_images' FROM artist_images
  UNION ALL SELECT DISTINCT artist_key, artist_name, NULL, 'deezer_track_covers' FROM deezer_track_covers
  UNION ALL SELECT DISTINCT artist_key, artist_name, NULL, 'youtube_music_catalog_candidates' FROM youtube_music_catalog_candidates
`;

/** Deterministic connected identity groups, including explicit aliases and provider IDs.
 * Conflicting provider IDs are retained as a diagnostic and never commercially approved.
 */
export function groupMonitoringCandidateIdentities(rows: MonitoringCandidateSourceRow[]): MonitoringCandidateIdentity[] {
  const groups: MonitoringCandidateSourceRow[][] = [];
  const index = new Map<string, number>();
  const parents: number[] = [];
  const root = (id: number): number => parents[id] === id ? id : (parents[id] = root(parents[id]!));
  for (const row of rows.filter(row => row.artist_key?.trim())) {
    const keys = [...songstatsArtistKeyCandidates(row.artist_key).map(key => `key:${compactArtistKey(key)}`),
      ...(row.spotify_id?.trim() ? [`spotify:${row.spotify_id.trim()}`] : [])];
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
    return {
      artistKey: first.artist_key,
      artistName: ordered.find(row => row.artist_name?.trim())?.artist_name?.trim() || first.artist_key,
      sourceKeys,
      matchKeys: [...new Set(sourceKeys.flatMap(key => [key, key.toLowerCase(), ...songstatsArtistKeyCandidates(key)]))],
      candidateSources: [...new Set(group.map(row => row.source))].sort(),
      spotifyIds,
      identityConflict: spotifyIds.length > 1,
    };
  }).sort((a, b) => a.artistKey.localeCompare(b.artistKey));
}

type AuditPool = Pick<PgPool, "connect">;
const CACHE_MS = 5 * 60_000;
const POPULATION_CACHE_MS = 60_000;
let populationCache: { expiresAt: number; value: MonitoringCandidateIdentity[] } | null = null;
let populationPending: Promise<MonitoringCandidateIdentity[]> | null = null;

export async function loadMonitoringCandidatePopulation(readPool: AuditPool = monitoringReadPool) {
  if (readPool !== monitoringReadPool && readPool !== publicReadPool) {
    const missing = await loadMonitoringAuditSchema(readPool);
    return groupMonitoringCandidateIdentities(await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool, withUnavailableMonitoringSources(MONITORING_CANDIDATE_POPULATION_SQL, missing), []));
  }
  if (populationCache && populationCache.expiresAt > Date.now()) return populationCache.value;
  if (populationPending) return populationPending;
  populationPending = loadMonitoringAuditSchema(readPool)
    .then(missing => executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool, withUnavailableMonitoringSources(MONITORING_CANDIDATE_POPULATION_SQL, missing), []))
    .then(rows => {
      const value = groupMonitoringCandidateIdentities(rows);
      populationCache = { expiresAt: Date.now() + POPULATION_CACHE_MS, value };
      return value;
    }).finally(() => { populationPending = null; });
  return populationPending;
}

export async function getMonitoringCandidateIdentity(artistKey: string, readPool: AuditPool = monitoringReadPool) {
  const keys = new Set(songstatsArtistKeyCandidates(artistKey).map(compactArtistKey));
  if (!keys.size) return null;
  const missing = await loadMonitoringAuditSchema(readPool);
  const requested = [...new Set([artistKey, artistKey.trim(), ...songstatsArtistKeyCandidates(artistKey)])];
  const pieces = MONITORING_CANDIDATE_POPULATION_SQL.trim().split(/\s+UNION ALL\s+/i);
  const providerColumns: Record<string, string> = { kworb_coverage: "spotify_id", spotify_artists: "spotify_artist_id", songstats_artists: "spotify_artist_id",
    songstats_artist_extended_data: "spotify_artist_id", songstats_artist_daily_snapshots: "spotify_artist_id", spotify_kworb_daily_snapshots: "spotify_artist_id", songstats_history_provider_identities: "spotify_artist_id" };
  const targeted = pieces.map(sql => {
    const table = sql.match(/FROM ([a-z_]+)$/)?.[1] ?? "";
    const provider = providerColumns[table];
    const boundedIdentity = ["kworb_coverage", "official_artists", "spotify_artists", "songstats_artists", "youtube_channels"].includes(table);
    const normalized = boundedIdentity ? " OR regexp_replace(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g')=ANY($3::text[])" : "";
    return `${sql} WHERE artist_key=ANY($1::text[])${provider ? ` OR ${provider}=ANY($2::text[])` : ""}${normalized}`;
  }).join(" UNION ALL ");
  const initial = await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(targeted, missing), [requested, [], [...keys]]);
  const sourceKeys = [...new Set([...requested, ...initial.flatMap(row => [row.artist_key, ...songstatsArtistKeyCandidates(row.artist_key)])])];
  const spotifyIds = [...new Set(initial.flatMap(row => row.spotify_id ? [row.spotify_id] : []))];
  const rows = initial.length ? await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(targeted, missing), [sourceKeys, spotifyIds, [...keys]]) : [];
  const candidate = groupMonitoringCandidateIdentities(rows).find(candidate => candidate.matchKeys.some(key => keys.has(compactArtistKey(key))));
  if (!candidate) return null;
  if (!candidate.identityConflict) return candidate;
  const exactKey = candidate.sourceKeys.find(key => key === artistKey) ?? candidate.artistKey;
  return { ...candidate, artistKey: exactKey, sourceKeys: [exactKey], matchKeys: [exactKey] };
}

export interface MonitoringCandidateEvidenceRow {
  artist_key: string;
  extended: Array<Record<string, unknown>> | null;
  snapshot: Record<string, unknown> | null;
  summary: Record<string, unknown> | null;
  raw_summary: Record<string, unknown> | null;
  legacy: Array<{ coverage: Record<string, unknown>; extended: Record<string, unknown> | null; snapshot: Record<string, unknown> | null; summary: Record<string, unknown> | null }> | null;
  source_evidence: Record<string, unknown>;
  served_summary?: Record<string, unknown> | null;
  compact_history?: ReadinessRow["compact_history"];
  stream_items?: Array<{ item_type: string; item_key: string; title: string; artwork_url: string | null }> | null;
  stored_artwork?: Array<{ song_title: string; cover_url: string }> | null;
  kworb_payload?: unknown;
  missing_schema_tables?: string[];
}

// The requested page is materialized first. All evidence is aggregated in one
// database statement; no per-artist API calls and no provider network requests.
export const MONITORING_CANDIDATE_EVIDENCE_SQL = `
WITH requested AS MATERIALIZED (
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(artist_key text, source_keys text[])
)
SELECT c.artist_key,
  to_jsonb(served_stream) served_summary,
  to_jsonb(compact_readiness) compact_history,
  (SELECT jsonb_agg(jsonb_build_object('item_type',i.item_type,'item_key',i.item_key,'title',i.title,'artwork_url',to_jsonb(i)->>'artwork_url')) FROM monitoring_stream_items i WHERE i.artist_key=ANY(c.source_keys)
    AND EXISTS(SELECT 1 FROM monitoring_stream_daily_snapshots s WHERE s.artist_key=i.artist_key AND s.item_type=i.item_type AND s.item_key=i.item_key
      AND s.snapshot_date=(SELECT max(snapshot_date) FROM monitoring_stream_daily_snapshots WHERE artist_key=ANY(c.source_keys)))) stream_items,
  (SELECT jsonb_agg(jsonb_build_object('song_title',song_title,'cover_url',cover_url)) FROM deezer_track_covers WHERE artist_key=ANY(c.source_keys)) stored_artwork,
  (SELECT value FROM kworb_snapshots WHERE artist_key=ANY(c.source_keys) AND metric_type='spotify' ORDER BY fetched_at DESC LIMIT 1) kworb_payload,
  (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.updated_at DESC, e.artist_key) FROM songstats_artist_extended_data e WHERE e.artist_key=ANY(c.source_keys)) extended,
  (SELECT to_jsonb(s) FROM songstats_artist_daily_snapshots s WHERE s.artist_key=ANY(c.source_keys) ORDER BY s.snapshot_date DESC, s.artist_key LIMIT 1) snapshot,
  (SELECT to_jsonb(s) FROM monitoring_stream_daily_artist_summaries s WHERE s.artist_key=ANY(c.source_keys) ORDER BY s.snapshot_date DESC, s.artist_key LIMIT 1) summary,
  (SELECT jsonb_build_object('snapshot_date',max(s.snapshot_date)::text,
    'track_count',count(*) FILTER(WHERE s.item_type='track'), 'album_count',count(*) FILTER(WHERE s.item_type='album'),
    'track_daily_streams',sum(s.daily_streams) FILTER(WHERE s.item_type='track'),
    'track_total_streams',sum(s.total_streams) FILTER(WHERE s.item_type='track'),
    'album_total_streams',sum(s.total_streams) FILTER(WHERE s.item_type='album'))
    FROM (SELECT DISTINCT ON (s.item_type,s.item_key) s.* FROM monitoring_stream_daily_snapshots s
      WHERE s.artist_key=ANY(c.source_keys)
        AND s.snapshot_date=(SELECT max(snapshot_date) FROM monitoring_stream_daily_snapshots WHERE artist_key=ANY(c.source_keys))
      ORDER BY s.item_type,s.item_key,s.artist_key) s) raw_summary,
  (SELECT jsonb_agg(jsonb_build_object('coverage',to_jsonb(k),'extended',to_jsonb(e),'snapshot',to_jsonb(s),'summary',to_jsonb(a)))
    FROM kworb_coverage k
    LEFT JOIN songstats_artist_extended_data e ON e.artist_key=k.artist_key
    LEFT JOIN LATERAL (SELECT * FROM songstats_artist_daily_snapshots WHERE artist_key=k.artist_key ORDER BY snapshot_date DESC LIMIT 1) s ON true
    LEFT JOIN LATERAL (SELECT * FROM monitoring_stream_daily_artist_summaries WHERE artist_key=k.artist_key ORDER BY snapshot_date DESC LIMIT 1) a ON true
    WHERE k.artist_key=ANY(c.source_keys)) legacy,
  jsonb_build_object(
    'currentHistory', (SELECT jsonb_build_object('days',count(DISTINCT snapshot_date),'firstDate',min(snapshot_date),'lastDate',max(snapshot_date),
      'previousDate',(array_agg(DISTINCT snapshot_date ORDER BY snapshot_date DESC))[2], 'lastFetchedAt',max(fetched_at)) FROM songstats_artist_daily_snapshots WHERE artist_key=ANY(c.source_keys)),
    'spotifyHistory', (SELECT jsonb_build_object('days',count(DISTINCT snapshot_date),'firstDate',min(snapshot_date),'lastDate',max(snapshot_date),'lastFetchedAt',max(fetched_at)) FROM spotify_kworb_daily_snapshots WHERE artist_key=ANY(c.source_keys) AND (total_streams IS NOT NULL OR daily_streams IS NOT NULL)),
    'streamHistory', (SELECT jsonb_build_object('days',count(DISTINCT snapshot_date),'firstDate',min(snapshot_date)::text,'lastDate',max(snapshot_date)::text) FROM monitoring_stream_daily_snapshots WHERE artist_key=ANY(c.source_keys)),
    'catalog', (SELECT jsonb_build_object('tracks',count(*) FILTER(WHERE item_type='track'),'albums',count(*) FILTER(WHERE item_type='album'),
      'tracksWithArtwork',count(*) FILTER(WHERE item_type='track' AND has_artwork),'albumsWithArtwork',count(*) FILTER(WHERE item_type='album' AND has_artwork))
      FROM (SELECT DISTINCT ON (i.item_type,i.item_key) i.item_type,i.item_key,
        (NULLIF(to_jsonb(i)->>'artwork_url','') IS NOT NULL OR EXISTS(SELECT 1 FROM deezer_track_covers cover WHERE cover.artist_key=ANY(c.source_keys)
          AND NULLIF(cover.cover_url,'') IS NOT NULL AND lower(trim(cover.song_title))=lower(trim(i.title)))) has_artwork
        FROM monitoring_stream_items i WHERE i.artist_key=ANY(c.source_keys) ORDER BY i.item_type,i.item_key,(NULLIF(to_jsonb(i)->>'artwork_url','') IS NOT NULL) DESC) items),
    'artistImage', (EXISTS(SELECT 1 FROM artist_images WHERE artist_key=ANY(c.source_keys) AND NULLIF(image_url,'') IS NOT NULL)
      OR EXISTS(SELECT 1 FROM songstats_artists WHERE artist_key=ANY(c.source_keys) AND NULLIF(avatar_url,'') IS NOT NULL)
      OR EXISTS(SELECT 1 FROM spotify_artists WHERE artist_key=ANY(c.source_keys) AND NULLIF(spotify_image_url,'') IS NOT NULL)),
    'youtube', (SELECT jsonb_build_object('approvedVideos',count(DISTINCT link.video_id),
      'observedVideos',count(DISTINCT link.video_id) FILTER(WHERE COALESCE(latest.view_count,video.view_count) IS NOT NULL),
      'videosWithArtwork',count(DISTINCT link.video_id) FILTER(WHERE NULLIF(video.thumbnail_url,'') IS NOT NULL))
      FROM youtube_artist_video_links link JOIN youtube_tracked_videos video USING(video_id)
      LEFT JOIN youtube_video_intraday_latest_observations pointer ON pointer.video_id=link.video_id
      LEFT JOIN youtube_video_intraday_shadow_snapshots latest ON latest.video_id=pointer.video_id AND latest.observed_at=pointer.latest_observed_at
      WHERE link.artist_key=ANY(c.source_keys) AND link.active=true AND link.confidence_score>=80),
    'youtubeImport', (SELECT jsonb_agg(jsonb_build_object('status',status,'completedAt',completed_at,'nextPageTokenPresent',next_page_token IS NOT NULL,
      'videosImported',videos_imported,'expectedVideos',expected_total_videos)) FROM youtube_channel_upload_import_state WHERE artist_key=ANY(c.source_keys)),
    'youtubeObservations', (SELECT jsonb_agg(jsonb_build_object('videoId',link.video_id,'observedAt',latest.observed_at,
      'delta',latest.view_delta,'secondsSincePrevious',latest.seconds_since_previous))
      FROM youtube_artist_video_links link JOIN youtube_video_intraday_latest_observations pointer ON pointer.video_id=link.video_id
      JOIN youtube_video_intraday_shadow_snapshots latest ON latest.video_id=pointer.video_id AND latest.observed_at=pointer.latest_observed_at
      WHERE link.artist_key=ANY(c.source_keys) AND link.active=true AND link.confidence_score>=80),
    'youtubeHistory', (SELECT jsonb_build_object('days',count(DISTINCT s.snapshot_date),'points',count(*),'videos',count(DISTINCT s.video_id),
      'videosWithHistory',count(DISTINCT s.video_id) FILTER(WHERE s.video_days>=2),
      'firstDate',min(s.snapshot_date),'lastDate',max(s.snapshot_date)) FROM (
      SELECT s.*,count(*) OVER(PARTITION BY s.video_id) video_days FROM youtube_video_daily_snapshots s
      WHERE s.view_count IS NOT NULL AND EXISTS(SELECT 1 FROM youtube_artist_video_links link WHERE link.artist_key=ANY(c.source_keys)
        AND link.video_id=s.video_id AND link.active=true AND link.confidence_score>=80)) s),
    'compactHistory', (SELECT jsonb_build_object('points',count(*),'metrics',count(DISTINCT d.metric_key),
      'firstDate',min(o.provider_observation_date)::text,'lastDate',max(o.provider_observation_date)::text)
      FROM songstats_historical_observations o
      JOIN songstats_history_provider_identities identity ON identity.id=o.provider_identity_id AND identity.validation_status='verified'
      JOIN songstats_history_metric_definitions d ON d.id=o.metric_definition_id AND d.ingestion_status='active'
      JOIN songstats_history_import_chunks chunk ON chunk.id=o.import_chunk_id
      WHERE o.artist_key=ANY(c.source_keys) AND o.acquisition_mode='songstats_historical'),
    'youtubeKworbHistory', (SELECT jsonb_build_object('days',count(DISTINCT snapshot_date),'firstDate',min(snapshot_date),'lastDate',max(snapshot_date)) FROM youtube_kworb_daily_snapshots WHERE artist_key=ANY(c.source_keys)),
    'youtubeRollupHistory', (SELECT jsonb_build_object('days',count(DISTINCT snapshot_date),'firstDate',min(snapshot_date),'lastDate',max(snapshot_date)) FROM youtube_artist_video_daily_rollups WHERE artist_key=ANY(c.source_keys)),
    'providerIdentities', jsonb_build_object(
      'songstatsIds',(SELECT array_agg(DISTINCT songstats_artist_id) FILTER(WHERE songstats_artist_id IS NOT NULL) FROM songstats_artists WHERE artist_key=ANY(c.source_keys)),
      'youtubeChannelIds',(SELECT array_agg(DISTINCT channel_id) FROM youtube_channels WHERE artist_key=ANY(c.source_keys))),
    'comparisonPeers', (SELECT count(DISTINCT k.artist_key) FROM kworb_coverage k WHERE NOT k.artist_key=ANY(c.source_keys)
      AND k.status='active' AND EXISTS(SELECT 1 FROM songstats_artist_extended_data e WHERE e.artist_key=k.artist_key)
      AND EXISTS(SELECT 1 FROM songstats_artist_daily_snapshots s WHERE s.artist_key=k.artist_key AND s.spotify_monthly_listeners>0))
  ) source_evidence
FROM requested c
LEFT JOIN LATERAL (${buildLatestMonitoringStreamSummarySql("(ARRAY[c.artist_key] || c.source_keys)")}) served_stream ON true
LEFT JOIN LATERAL (${buildMonitoringCompactReadinessSql("c.source_keys")}) compact_readiness ON true
ORDER BY c.artist_key
`;

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
  const legacyResults = (row.legacy ?? []).map(value => ({
    available: Boolean(value.coverage["spotify_id"] && value.extended && value.snapshot),
    readiness: evaluateMonitoringReadinessRow(readinessRow(artist, object(value.extended), object(value.snapshot), object(value.summary)), now),
  }));
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
    evidence: `${artist.spotifyIds.length} different Spotify identities share the resolved artist aliases.`,
    action: "Resolve the identity conflict before making any commercial eligibility decision.",
  });
  const incomplete = findings.some(finding => finding.status === "investigation_required");
  const blocked = findings.some(finding => finding.status === "blocked");
  const sourceIntegrityUnknown = artist.identityConflict || Boolean(row.missing_schema_tables?.length);
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
export type MonitoringCandidateDirectoryOptions = { limit?: number; offset?: number; search?: string; artistKeys?: string[] };
type AuditDependencies = { readPool?: AuditPool; now?: Date };
const evidenceCache = new Map<string, { expiresAt: number; value: MonitoringCandidateAuditArtist }>();

export async function getMonitoringCandidateList() {
  const artists = await loadMonitoringCandidatePopulation();
  const missingSchemaTables = await loadMonitoringAuditSchema();
  return { count: artists.length, artists, populationComplete: missingSchemaTables.length === 0, missingSchemaTables };
}

export async function getMonitoringCandidateDirectory(options: MonitoringCandidateDirectoryOptions = {}, dependencies: AuditDependencies = {}) {
  const readPool = dependencies.readPool ?? monitoringReadPool;
  const now = dependencies.now ?? new Date();
  const limit = Math.max(1, Math.min(200, Math.trunc(options.limit ?? 50) || 50));
  const offset = Math.max(0, Math.trunc(options.offset ?? 0) || 0);
  const search = compactArtistKey(options.search ?? "");
  const requestedKeys = new Set((options.artistKeys ?? []).flatMap(songstatsArtistKeyCandidates).map(compactArtistKey));
  const missingSchemaTables = await loadMonitoringAuditSchema(readPool);
  const population = (await loadMonitoringCandidatePopulation(readPool)).filter(artist =>
    (!search || compactArtistKey(artist.artistName).includes(search) || artist.matchKeys.some(key => compactArtistKey(key).includes(search))) &&
    (!requestedKeys.size || artist.matchKeys.some(key => requestedKeys.has(compactArtistKey(key)))));
  const page = population.slice(offset, offset + limit);
  const cacheable = (readPool === monitoringReadPool || readPool === publicReadPool) && !dependencies.now;
  const cacheKey = (artist: MonitoringCandidateIdentity) => JSON.stringify([artist.artistKey, artist.sourceKeys, artist.spotifyIds, missingSchemaTables]);
  const uncached = page.filter(artist => !cacheable || (evidenceCache.get(cacheKey(artist))?.expiresAt ?? 0) <= Date.now());
  const fresh = new Map<string, MonitoringCandidateAuditArtist>();
  if (uncached.length) {
    const rows = await executeMonitoringReadinessQuery<MonitoringCandidateEvidenceRow>(readPool, withUnavailableMonitoringSources(MONITORING_CANDIDATE_EVIDENCE_SQL, missingSchemaTables),
      [JSON.stringify(uncached.map(artist => ({ artist_key: artist.artistKey, source_keys: artist.sourceKeys })))]);
    const byKey = new Map(rows.map(row => [row.artist_key, row]));
    for (const artist of uncached) {
      const row = byKey.get(artist.artistKey);
      if (!row) throw new Error("Monitoring source audit did not return every requested candidate");
      const value = evaluateMonitoringCandidate(artist, { ...row, missing_schema_tables: missingSchemaTables }, now);
      fresh.set(artist.artistKey, value);
      if (cacheable) evidenceCache.set(cacheKey(artist), { expiresAt: Date.now() + CACHE_MS, value });
    }
    // Bound process memory even while the catalog grows or identities change.
    if (evidenceCache.size > 5_000) for (const [key, entry] of evidenceCache) {
      if (entry.expiresAt <= Date.now() || evidenceCache.size > 5_000) evidenceCache.delete(key);
    }
  }
  const artists = page.map(artist => fresh.get(artist.artistKey) ?? evidenceCache.get(cacheKey(artist))!.value);
  return {
    policyVersion: MONITORING_READINESS_POLICY_VERSION,
    contractVersion: MONITORING_COMPLETE_CONTRACT_VERSION,
    contract: MONITORING_COMPLETE_CONTRACT,
    populationComplete: missingSchemaTables.length === 0,
    missingSchemaTables,
    total: population.length,
    offset, limit, hasMore: offset + artists.length < population.length,
    auditedAt: now.toISOString(), auditScope: "page" as const,
    counts: { A: artists.filter(artist => artist.classification === "A").length,
      B: artists.filter(artist => artist.classification === "B").length,
      C: artists.filter(artist => artist.classification === "C").length,
      incomplete: artists.filter(artist => artist.classification == null).length },
    artists,
  };
}
