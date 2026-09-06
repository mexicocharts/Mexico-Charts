import { monitoringReadPool, publicReadPool, type PgPool } from "@workspace/db";
import { executeMonitoringReadinessQuery } from "./monitoring-readiness-service";
import { MONITORING_READINESS_POLICY_VERSION } from "./monitoring-readiness-policy";
import { compactArtistKey, songstatsArtistKeyCandidates } from "./songstats-artist-key";
import { loadMonitoringAuditSchema, withUnavailableMonitoringSources } from "./monitoring-audit-schema";
import { buildLatestMonitoringStreamSummarySql } from "./monitoring-stream-serving";
import { buildMonitoringCompactReadinessSql } from "./monitoring-compact-readiness";
import { MONITORING_COMPLETE_CONTRACT_VERSION, MONITORING_COMPLETE_CONTRACT, groupMonitoringCandidateIdentities, evaluateMonitoringCandidate,
  type MonitoringCandidateSourceRow, type MonitoringCandidateIdentity, type MonitoringCandidateEvidenceRow, type MonitoringCandidateAuditArtist } from "./monitoring-candidate-policy";
export * from "./monitoring-candidate-policy";

/** Only the accepted entity registry supplies aliases. Search/review candidates
 * are deliberately excluded. These statuses are written by the existing
 * backfill, approve-candidates command and explicit manual acceptance. */
export const MONITORING_ACCEPTED_ALIAS_SQL = `SELECT artist_key, name artist_name, NULL::text spotify_id,
  'musicbrainz_artists' source, aliases declared_aliases, mbid, verified FROM musicbrainz_artists
  WHERE verified IN ('auto', 'auto_review_accepted', 'manual_review_accepted') AND NULLIF(trim(mbid), '') IS NOT NULL`;
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

type AuditPool = Pick<PgPool, "connect">;
const CACHE_MS = 5 * 60_000;
const POPULATION_CACHE_MS = 60_000;
let populationCache: { expiresAt: number; value: MonitoringCandidateIdentity[] } | null = null;
let populationPending: Promise<MonitoringCandidateIdentity[]> | null = null;
let aliasCache: { expiresAt: number; value: MonitoringCandidateSourceRow[] } | null = null;
async function loadAcceptedMonitoringAliases(readPool: AuditPool, missing: string[]) {
  const cacheable = readPool === monitoringReadPool || readPool === publicReadPool;
  if (cacheable && aliasCache && aliasCache.expiresAt > Date.now()) return aliasCache.value;
  const value = await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(MONITORING_ACCEPTED_ALIAS_SQL, missing), []);
  if (cacheable) aliasCache = { expiresAt: Date.now() + POPULATION_CACHE_MS, value };
  return value;
}

async function loadCandidateRows(readPool: AuditPool, missing: string[]) {
  const rows = await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(MONITORING_CANDIDATE_POPULATION_SQL, missing), []);
  return [...rows, ...await loadAcceptedMonitoringAliases(readPool, missing)];
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
  const keys = new Set(songstatsArtistKeyCandidates(artistKey).map(compactArtistKey));
  if (!keys.size) return null;
  const missing = await loadMonitoringAuditSchema(readPool);
  const acceptedAliases = await loadAcceptedMonitoringAliases(readPool, missing);
  const aliasGroups = groupMonitoringCandidateIdentities(acceptedAliases);
  const expandAliases = (values: string[]) => {
    const tokens = new Set(values.map(compactArtistKey));
    return [...new Set([...values, ...aliasGroups.filter(group => group.matchKeys.some(key => tokens.has(compactArtistKey(key)))).flatMap(group => group.matchKeys)])];
  };
  const requested = expandAliases([...new Set([artistKey, artistKey.trim(), ...songstatsArtistKeyCandidates(artistKey)])]);
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
    withUnavailableMonitoringSources(targeted, missing), [requested, [], requested.map(compactArtistKey)]);
  const sourceKeys = expandAliases([...new Set([...requested, ...initial.flatMap(row => [row.artist_key, ...songstatsArtistKeyCandidates(row.artist_key)])])]);
  const spotifyIds = [...new Set(initial.flatMap(row => row.spotify_id ? [row.spotify_id] : []))];
  const rows = await executeMonitoringReadinessQuery<MonitoringCandidateSourceRow>(readPool,
    withUnavailableMonitoringSources(targeted, missing), [sourceKeys, spotifyIds, sourceKeys.map(compactArtistKey)]);
  const candidate = groupMonitoringCandidateIdentities([...rows, ...acceptedAliases]).find(candidate => candidate.matchKeys.some(key => keys.has(compactArtistKey(key))));
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
  const cacheKey = (artist: MonitoringCandidateIdentity) => JSON.stringify([artist.artistKey, artist.sourceKeys, artist.spotifyIds, artist.identityAliasEvidence, missingSchemaTables]);
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
