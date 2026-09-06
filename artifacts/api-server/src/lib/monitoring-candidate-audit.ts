import { buildMonitoringPulseEvidenceSql } from "./monitoring-daily-pulse";
import { monitoringReadPool, publicReadPool, type PgPool } from "@workspace/db";
import { executeMonitoringReadinessQuery } from "./monitoring-readiness-service";
import { MONITORING_READINESS_POLICY_VERSION } from "./monitoring-readiness-policy";
import { loadMonitoringAuditSchema, withUnavailableMonitoringSources } from "./monitoring-audit-schema";
import { buildLatestMonitoringStreamSummarySql } from "./monitoring-stream-serving";
import { buildMonitoringCompactReadinessSql } from "./monitoring-compact-readiness";
import { buildMonitoringYoutubeDiagnosticsSql } from "./monitoring-youtube-serving";
import { MONITORING_COMPLETE_CONTRACT_VERSION, MONITORING_COMPLETE_CONTRACT, groupMonitoringCandidateIdentities, evaluateMonitoringCandidate, monitoringIdentityKeyCandidates, isMonitoringSpotifyArtistId,
  type MonitoringCandidateSourceRow, type MonitoringCandidateIdentity, type MonitoringCandidateEvidenceRow, type MonitoringCandidateAuditArtist } from "./monitoring-candidate-policy";
export * from "./monitoring-candidate-policy";

/** Only the accepted entity registry supplies aliases. Search/review candidates
 * are deliberately excluded. These statuses are written by the existing
 * backfill, approve-candidates command and explicit manual acceptance. */
export const MONITORING_ACCEPTED_ALIAS_SQL = `SELECT artist_key, name artist_name, NULL::text spotify_id,
  'musicbrainz_artists' source, aliases declared_aliases, mbid, verified FROM musicbrainz_artists
  WHERE verified IN ('auto', 'auto_review_accepted', 'manual_review_accepted') AND NULLIF(trim(mbid), '') IS NOT NULL`;
/** Discovery queue rows are inspection candidates. Only an already accepted
 * matched_artist_id establishes an alias; provider proposals remain untrusted. */
export const MONITORING_DISCOVERY_CANDIDATES_SQL = `SELECT normalized_name artist_key, artist_name, NULL::text spotify_id,
  'artist_candidates' source, id::text source_record_id, status discovery_status, matched_artist_id matched_artist_key
  FROM artist_candidates
  UNION ALL SELECT artist_key, artist_name, NULL::text, 'spotify_artist_candidates', artist_key, status, NULL::text
  FROM spotify_artist_candidates`;
/** Subscriptions contribute only distinct stored artist keys and display names.
 * Customer, billing and status fields never enter this private source inventory;
 * candidate presence establishes neither a provider identity nor viewer access.
 * Verified nationality, social-account and YouTube Music identity registries
 * can exist before coverage/catalog materialization. They add inspection leads
 * only: no provider IDs, proposed aliases, source URLs or private evidence. */
export const MONITORING_CANDIDATE_POPULATION_SQL = `
  SELECT artist_key, artist_name, spotify_id, 'kworb_coverage' source FROM kworb_coverage
  UNION ALL SELECT artist_key, artist_name, NULL, 'official_artists' FROM official_artists
  UNION ALL SELECT artist_key, spotify_name, CASE WHEN verified IS TRUE THEN spotify_artist_id END, 'spotify_artists' FROM spotify_artists
  UNION ALL SELECT artist_key, songstats_name, spotify_artist_id, 'songstats_artists' FROM songstats_artists
  UNION ALL SELECT artist_key, NULL, spotify_artist_id, 'songstats_artist_extended_data' FROM songstats_artist_extended_data
  UNION ALL SELECT DISTINCT artist_key, NULL, spotify_artist_id, 'songstats_artist_daily_snapshots' FROM songstats_artist_daily_snapshots
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'monitoring_stream_items' FROM monitoring_stream_items
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'monitoring_stream_daily_snapshots' FROM monitoring_stream_daily_snapshots
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'monitoring_stream_daily_artist_summaries' FROM monitoring_stream_daily_artist_summaries
  UNION ALL SELECT DISTINCT artist_key, NULL, spotify_artist_id, 'spotify_kworb_daily_snapshots' FROM spotify_kworb_daily_snapshots
  UNION ALL SELECT artist_key, title, NULL, 'youtube_channels' FROM youtube_channels
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'youtube_channel_daily_snapshots' FROM youtube_channel_daily_snapshots
  UNION ALL SELECT DISTINCT artist_key, artist_name, NULL, 'youtube_artist_video_links' FROM youtube_artist_video_links
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'youtube_kworb_daily_snapshots' FROM youtube_kworb_daily_snapshots
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'youtube_artist_video_daily_rollups' FROM youtube_artist_video_daily_rollups
  UNION ALL SELECT artist_key, NULL, CASE WHEN validation_status='verified' THEN spotify_artist_id END, 'songstats_history_provider_identities' FROM songstats_history_provider_identities
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'songstats_historical_observations' FROM songstats_historical_observations
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'kworb_snapshots' FROM kworb_snapshots
  UNION ALL SELECT artist_key, NULL, NULL, 'artist_images' FROM artist_images
  UNION ALL SELECT DISTINCT artist_key, artist_name, NULL, 'deezer_track_covers' FROM deezer_track_covers
  UNION ALL SELECT DISTINCT artist_key, artist_name, NULL, 'youtube_music_catalog_candidates' FROM youtube_music_catalog_candidates
  UNION ALL SELECT DISTINCT artist_key, artist_name, NULL, 'monitoring_subscriptions' FROM monitoring_subscriptions
  UNION ALL SELECT normalized_name AS artist_key, artist_name, NULL, 'mexican_artist_identity_candidates' FROM mexican_artist_identity_candidates WHERE status='verified'
  UNION ALL SELECT DISTINCT artist_key, NULL, NULL, 'artist_social_account_candidates' FROM artist_social_account_candidates WHERE status='verified'
  UNION ALL SELECT DISTINCT artist_key, artist_name, NULL, 'youtube_music_artist_candidates' FROM youtube_music_artist_candidates WHERE status='verified'
`;

type AuditPool = Pick<PgPool, "connect">;
const CACHE_MS = 5 * 60_000;
const POPULATION_CACHE_MS = 60_000;
let populationCache: { expiresAt: number; value: MonitoringCandidateIdentity[] } | null = null;
let populationPending: Promise<MonitoringCandidateIdentity[]> | null = null;
let aliasCache: { expiresAt: number; value: MonitoringCandidateSourceRow[] } | null = null;
async function loadMonitoringIdentityCatalog(readPool: AuditPool, missing: string[]) {
  const cacheable = readPool === monitoringReadPool || readPool === publicReadPool;
  if (cacheable && aliasCache && aliasCache.expiresAt > Date.now()) return aliasCache.value;
  const accepted = await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(MONITORING_ACCEPTED_ALIAS_SQL, missing), []);
  const discovery = await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(MONITORING_DISCOVERY_CANDIDATES_SQL, missing), []);
  const value = [...accepted, ...discovery];
  if (cacheable) aliasCache = { expiresAt: Date.now() + POPULATION_CACHE_MS, value };
  return value;
}

async function loadCandidateRows(readPool: AuditPool, missing: string[]) {
  const rows = await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(MONITORING_CANDIDATE_POPULATION_SQL, missing), []);
  return [...rows, ...await loadMonitoringIdentityCatalog(readPool, missing)];
}

export async function loadMonitoringCandidatePopulation(readPool: AuditPool = monitoringReadPool) {
  if (readPool !== monitoringReadPool && readPool !== publicReadPool) {
    const missing = await loadMonitoringAuditSchema(readPool);
    return groupMonitoringCandidateIdentities(await loadCandidateRows(readPool, missing));
  }
  if (populationCache && populationCache.expiresAt > Date.now()) return populationCache.value;
  if (populationPending) return populationPending;
  populationPending = loadMonitoringAuditSchema(readPool)
    .then(missing => loadCandidateRows(readPool, missing))
    .then(rows => {
      const value = groupMonitoringCandidateIdentities(rows);
      populationCache = { expiresAt: Date.now() + POPULATION_CACHE_MS, value };
      return value;
    }).finally(() => { populationPending = null; });
  return populationPending;
}

export async function getMonitoringCandidateIdentity(artistKey: string, readPool: AuditPool = monitoringReadPool) {
  const keys = new Set(monitoringIdentityKeyCandidates(artistKey));
  if (!keys.size) return null;
  const missing = await loadMonitoringAuditSchema(readPool);
  const acceptedAliases = await loadMonitoringIdentityCatalog(readPool, missing);
  const aliasGroups = groupMonitoringCandidateIdentities(acceptedAliases);
  const expandAliases = (values: string[]) => {
    const tokens = new Set(values.flatMap(monitoringIdentityKeyCandidates));
    return [...new Set([...values, ...aliasGroups.filter(group => group.matchKeys.flatMap(monitoringIdentityKeyCandidates).some(key => tokens.has(key))).flatMap(group => group.matchKeys)])];
  };
  const requested = expandAliases([...new Set([artistKey, artistKey.trim(), ...monitoringIdentityKeyCandidates(artistKey)])]);
  const compactSqlKeys = (values: string[]) => [...new Set(values.flatMap(monitoringIdentityKeyCandidates).filter(key => /^[a-z0-9]+$/.test(key)))];
  const pieces = MONITORING_CANDIDATE_POPULATION_SQL.trim().split(/\s+UNION ALL\s+/i);
  // Unaccepted mappings stay visible as source-key inventory rows, but never
  // establish a provider-ID bridge to another artist or paid grant.
  const providerColumns: Record<string, string> = { kworb_coverage: "spotify_id",
    spotify_artists: "(CASE WHEN verified IS TRUE THEN spotify_artist_id END)", songstats_artists: "spotify_artist_id",
    songstats_artist_extended_data: "spotify_artist_id", songstats_artist_daily_snapshots: "spotify_artist_id", spotify_kworb_daily_snapshots: "spotify_artist_id",
    songstats_history_provider_identities: "(CASE WHEN validation_status='verified' THEN spotify_artist_id END)" };
  const targeted = pieces.map(sql => {
    const table = sql.match(/FROM ([a-z_]+)(?: WHERE status='verified')?$/)?.[1] ?? "";
    const verifiedLead = ["mexican_artist_identity_candidates", "artist_social_account_candidates", "youtube_music_artist_candidates"].includes(table);
    const keyColumn = table === "mexican_artist_identity_candidates" ? "normalized_name" : "artist_key";
    const provider = providerColumns[table];
    const boundedIdentity = verifiedLead || ["kworb_coverage", "official_artists", "spotify_artists", "songstats_artists", "youtube_channels", "monitoring_subscriptions"].includes(table);
    const latinKey = `translate(lower(${keyColumn}), 'áéíóúüñ', 'aeiouun')`;
    const normalized = boundedIdentity ? ` OR (length(${latinKey})=octet_length(${latinKey}) AND regexp_replace(${latinKey}, '[^a-z0-9]', '', 'g')=ANY($3::text[]))` : "";
    // Keep the source's verified predicate outside all exact/normalized ORs.
    // The nationality registry stores normalized_name, not an artist_key column.
    return `${sql}${verifiedLead ? " AND" : " WHERE"} (${keyColumn}=ANY($1::text[])${provider ? ` OR ${provider}=ANY($2::text[])` : ""}${normalized})`;
  }).join(" UNION ALL ");
  const initial = await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(targeted, missing), [requested, [], compactSqlKeys(requested)]);
  const sourceKeys = expandAliases([...new Set([...requested, ...initial.flatMap(row => [row.artist_key, ...monitoringIdentityKeyCandidates(row.artist_key)])])]);
  const spotifyIds = [...new Set(initial.map(row => row.spotify_id?.trim()).filter(isMonitoringSpotifyArtistId))];
  const rows = await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(targeted, missing), [sourceKeys, spotifyIds, compactSqlKeys(sourceKeys)]);
  const candidate = groupMonitoringCandidateIdentities([...rows, ...acceptedAliases]).find(candidate => candidate.matchKeys.flatMap(monitoringIdentityKeyCandidates).some(key => keys.has(key)));
  if (!candidate) return null;
  if (!candidate.identityConflict) return candidate;
  const exactKey = candidate.sourceKeys.find(key => key === artistKey) ?? candidate.artistKey;
  return { ...candidate, artistKey: exactKey, sourceKeys: [exactKey], matchKeys: [exactKey] };
}

// The requested page is materialized first. All evidence is aggregated in one
// database statement; no per-artist API calls and no provider network requests.
export const MONITORING_CANDIDATE_EVIDENCE_SQL = `
WITH requested AS MATERIALIZED (
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(artist_key text, source_keys text[])
), comparison_snapshots AS MATERIALIZED (
  SELECT k.artist_key, s.snapshot_date
  FROM kworb_coverage k
  JOIN LATERAL (SELECT snapshot_date, spotify_monthly_listeners FROM songstats_artist_daily_snapshots
    WHERE artist_key=k.artist_key ORDER BY snapshot_date DESC LIMIT 1) s ON true
  WHERE k.status='active' AND s.spotify_monthly_listeners>0
    AND EXISTS(SELECT 1 FROM songstats_artist_extended_data e WHERE e.artist_key=k.artist_key)
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
  (SELECT jsonb_agg(jsonb_build_object('coverage',to_jsonb(k),'extended_artist_key',e.artist_key,'snapshot',to_jsonb(s),'summary',to_jsonb(a)))
    FROM kworb_coverage k
    LEFT JOIN songstats_artist_extended_data e ON e.artist_key=k.artist_key
    LEFT JOIN LATERAL (SELECT * FROM songstats_artist_daily_snapshots WHERE artist_key=k.artist_key ORDER BY snapshot_date DESC LIMIT 1) s ON true
    LEFT JOIN LATERAL (SELECT * FROM monitoring_stream_daily_artist_summaries WHERE artist_key=k.artist_key ORDER BY snapshot_date DESC LIMIT 1) a ON true
    WHERE k.artist_key=ANY(c.source_keys)) legacy,
  jsonb_build_object(
    'currentHistory',pulse_evidence.history,
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
      OR EXISTS(SELECT 1 FROM spotify_artists WHERE artist_key=ANY(c.source_keys) AND verified IS TRUE AND NULLIF(spotify_image_url,'') IS NOT NULL)),
    'youtube', (SELECT jsonb_build_object('approvedVideos',count(DISTINCT link.video_id),
      'observedVideos',count(DISTINCT link.video_id) FILTER(WHERE COALESCE(latest.view_count,video.view_count) IS NOT NULL),
      'videosWithArtwork',count(DISTINCT link.video_id) FILTER(WHERE NULLIF(video.thumbnail_url,'') IS NOT NULL))
      FROM youtube_artist_video_links link JOIN youtube_tracked_videos video USING(video_id)
      LEFT JOIN youtube_video_intraday_latest_observations pointer ON pointer.video_id=link.video_id
      LEFT JOIN youtube_video_intraday_shadow_snapshots latest ON latest.video_id=pointer.video_id AND latest.observed_at=pointer.latest_observed_at
      WHERE link.artist_key=ANY(c.source_keys) AND link.active=true AND link.confidence_score>=80),
    'youtubeServing',youtube_diagnostics.diagnostics,
    'youtubeImport', (SELECT jsonb_agg(jsonb_build_object(
      'artistKey',state.artist_key,'channelId',state.channel_id,
      'currentChannelMatched',EXISTS(SELECT 1 FROM youtube_channels channel WHERE channel.artist_key=ANY(c.source_keys) AND channel.channel_id=state.channel_id),
      'status',state.status,'completedAt',state.completed_at,'nextPageTokenPresent',state.next_page_token IS NOT NULL,
      'videosImported',state.videos_imported,'expectedVideos',state.expected_total_videos,
      'observedApprovedVideos',(SELECT count(DISTINCT link.video_id) FROM youtube_artist_video_links link
        JOIN youtube_tracked_videos video ON video.video_id=link.video_id AND video.channel_id=state.channel_id
        LEFT JOIN youtube_video_intraday_latest_observations pointer ON pointer.video_id=link.video_id
        LEFT JOIN youtube_video_intraday_shadow_snapshots latest ON latest.video_id=pointer.video_id AND latest.observed_at=pointer.latest_observed_at
        WHERE link.artist_key=ANY(c.source_keys) AND link.active=true AND link.confidence_score>=80
          AND COALESCE(latest.view_count,video.view_count) IS NOT NULL)
      )) FROM youtube_channel_upload_import_state state WHERE state.artist_key=ANY(c.source_keys)),
    'youtubeObservations', (SELECT jsonb_agg(jsonb_build_object('videoId',link.video_id,'observedAt',latest.observed_at,
      'delta',latest.view_delta,'secondsSincePrevious',latest.seconds_since_previous))
      FROM youtube_artist_video_links link JOIN youtube_video_intraday_latest_observations pointer ON pointer.video_id=link.video_id
      JOIN youtube_video_intraday_shadow_snapshots latest ON latest.video_id=pointer.video_id AND latest.observed_at=pointer.latest_observed_at
      WHERE link.artist_key=ANY(c.source_keys) AND link.active=true AND link.confidence_score>=80),
    'youtubeHistory', (SELECT jsonb_build_object('sourceTable','youtube_video_daily_snapshots','rangeDays',90,
      'rangeClock','database_now_America/New_York',
      'days',count(DISTINCT s.snapshot_date) FILTER(WHERE s.in_serving_range),'points',count(*) FILTER(WHERE s.in_serving_range),
      'videos',count(DISTINCT s.video_id) FILTER(WHERE s.in_serving_range),
      'videosWithHistory',count(DISTINCT s.video_id) FILTER(WHERE s.in_serving_range AND s.video_days>=2),
      'firstDate',min(s.snapshot_date) FILTER(WHERE s.in_serving_range),'lastDate',max(s.snapshot_date) FILTER(WHERE s.in_serving_range),
      'allTime',jsonb_build_object('days',count(DISTINCT s.snapshot_date),'points',count(*),'videos',count(DISTINCT s.video_id),
        'videosWithHistory',count(DISTINCT s.video_id) FILTER(WHERE s.all_time_video_days>=2),
        'firstDate',min(s.snapshot_date),'lastDate',max(s.snapshot_date))) FROM (
      SELECT s.*,s.snapshot_date>=to_char((now() AT TIME ZONE 'America/New_York')::date - 89,'YYYY-MM-DD') in_serving_range,
        count(*) FILTER(WHERE s.snapshot_date>=to_char((now() AT TIME ZONE 'America/New_York')::date - 89,'YYYY-MM-DD')) OVER(PARTITION BY s.video_id) video_days,
        count(*) OVER(PARTITION BY s.video_id) all_time_video_days
      FROM youtube_video_daily_snapshots s
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
    'comparisonPeers', (SELECT count(*) FROM comparison_snapshots p WHERE NOT p.artist_key=ANY(c.source_keys)),
    'comparisonPeerDates', (SELECT jsonb_agg(jsonb_build_object('date',snapshot_date,'peers',peers))
      FROM (SELECT snapshot_date,count(*) peers FROM comparison_snapshots p
        WHERE NOT p.artist_key=ANY(c.source_keys) GROUP BY snapshot_date) dates)
  ) source_evidence
FROM requested c
LEFT JOIN LATERAL (${buildLatestMonitoringStreamSummarySql("(ARRAY[c.artist_key] || c.source_keys)")}) served_stream ON true
LEFT JOIN LATERAL (${buildMonitoringCompactReadinessSql("c.source_keys")}) compact_readiness ON true
LEFT JOIN LATERAL (${buildMonitoringPulseEvidenceSql("(ARRAY[c.artist_key] || c.source_keys)")}) pulse_evidence ON true
LEFT JOIN LATERAL (${buildMonitoringYoutubeDiagnosticsSql("c.source_keys")}) youtube_diagnostics ON true
ORDER BY c.artist_key
`;

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
  const searchKeys = monitoringIdentityKeyCandidates(options.search ?? "");
  const requestedKeys = new Set((options.artistKeys ?? []).flatMap(monitoringIdentityKeyCandidates));
  const missingSchemaTables = await loadMonitoringAuditSchema(readPool);
  const population = (await loadMonitoringCandidatePopulation(readPool)).filter(artist =>
    (!searchKeys.length || [artist.artistName, ...artist.matchKeys].flatMap(monitoringIdentityKeyCandidates).some(key => searchKeys.some(search => key.includes(search)))) &&
    (!requestedKeys.size || artist.matchKeys.flatMap(monitoringIdentityKeyCandidates).some(key => requestedKeys.has(key))));
  const page = population.slice(offset, offset + limit);
  const cacheable = (readPool === monitoringReadPool || readPool === publicReadPool) && !dependencies.now;
  const cacheKey = (artist: MonitoringCandidateIdentity) => JSON.stringify([artist.artistKey, artist.sourceKeys, artist.spotifyIds, artist.identityAliasEvidence, artist.candidateRecords, missingSchemaTables]);
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
    populationUnit: "resolved_identity_groups" as const,
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
