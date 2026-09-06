import type { PoolClient } from "@workspace/db";

type Queryable = Pick<PoolClient, "query">;

export interface MonitoringYoutubeRelationship {
  source_table: "youtube_artist_video_links" | "youtube_music_catalog_candidates";
  source_id: number;
  artist_key: string;
  status: "active" | "review" | "verified";
  sampling_status: "shadow" | null;
  confidence_score: number;
  evidence_source: string;
}

/** Application-owned SQL expressions only, never request text. This is the
 * existing dashboard catalog predicate. A shadow candidate remains a shadow
 * candidate even when it shares a video with an approved active link.
 */
export function buildMonitoringYoutubeEligibleVideosSql(artistKeysSql: string): string {
  return `
    WITH monitoring_eligible_relationships AS MATERIALIZED (
      SELECT link.artist_key, link.artist_name, link.video_id, link.confidence_score,
             link.priority, link.id,
             'youtube_artist_video_links'::text relation_source,
             'active'::text relation_status, NULL::text sampling_status,
             link.source_type relation_evidence_source
      FROM youtube_artist_video_links link
      WHERE link.active=true AND link.confidence_score >= 80
        AND link.artist_key=ANY(${artistKeysSql})
      UNION ALL
      SELECT candidate.artist_key, candidate.artist_name, candidate.video_id, candidate.confidence_score,
             0 priority, candidate.id,
             'youtube_music_catalog_candidates'::text relation_source,
             candidate.status relation_status, candidate.sampling_status,
             candidate.evidence_source relation_evidence_source
      FROM youtube_music_catalog_candidates candidate
      WHERE candidate.status IN ('review','verified') AND candidate.sampling_status='shadow'
        AND candidate.artist_key=ANY(${artistKeysSql})
    ), monitoring_selected_relationship AS (
      SELECT DISTINCT ON (video_id) * FROM monitoring_eligible_relationships
      ORDER BY video_id, confidence_score DESC, priority DESC, id, relation_source
    ), monitoring_relationship_provenance AS (
      SELECT video_id,
        bool_or(relation_source='youtube_artist_video_links') has_approved_link,
        jsonb_agg(jsonb_build_object(
          'source_table',relation_source, 'source_id',id, 'artist_key',artist_key,
          'status',relation_status, 'sampling_status',sampling_status,
          'confidence_score',confidence_score, 'evidence_source',relation_evidence_source
        ) ORDER BY relation_source,artist_key,id) relationship_sources
      FROM monitoring_eligible_relationships GROUP BY video_id
    )
    SELECT selected.artist_name, selected.video_id, selected.confidence_score, selected.priority,
      selected.relation_source, selected.relation_status, selected.sampling_status,
      selected.relation_evidence_source, provenance.has_approved_link, provenance.relationship_sources
    FROM monitoring_selected_relationship selected
    JOIN monitoring_relationship_provenance provenance USING(video_id)
  `;
}

export const MONITORING_YOUTUBE_LIVE_VIDEOS_SQL = `
  WITH matched_links AS MATERIALIZED (${buildMonitoringYoutubeEligibleVideosSql("$1::text[]")})
  SELECT links.artist_name, links.video_id, tracked.title, tracked.thumbnail_url,
    'https://www.youtube.com/watch?v=' || links.video_id canonical_url,
    COALESCE(latest.view_count, tracked.view_count) view_count,
    latest.view_delta, latest.seconds_since_previous,
    latest.observed_at::text monitor_observed_at,
    COALESCE(latest.observed_at, tracked.last_snapshot_at, tracked.updated_at)::text observed_at,
    NULL::bigint views_24h, NULL::text views_24h_started_at, NULL::text views_24h_ended_at,
    NULL::bigint views_today_et, NULL::text views_today_et_started_at, NULL::text views_today_et_ended_at,
    links.relation_source, links.relation_status, links.sampling_status,
    links.relation_evidence_source, links.has_approved_link, links.relationship_sources,
    CASE WHEN latest.view_count IS NOT NULL THEN 'youtube_video_intraday_shadow_snapshots'
      ELSE 'youtube_tracked_videos' END view_count_source_table,
    CASE WHEN latest.view_count IS NOT NULL THEN latest.source_type ELSE NULL END observation_source_type
  FROM matched_links links
  JOIN youtube_tracked_videos tracked ON tracked.video_id=links.video_id
  LEFT JOIN youtube_video_intraday_latest_observations pointer ON pointer.video_id=links.video_id
  LEFT JOIN youtube_video_intraday_shadow_snapshots latest
    ON latest.video_id=pointer.video_id AND latest.observed_at=pointer.latest_observed_at
  WHERE COALESCE(latest.view_count, tracked.view_count) IS NOT NULL
  ORDER BY COALESCE(latest.view_count, tracked.view_count) DESC, tracked.title
`;

/** Native dated video snapshots only. The relation metadata explains why the
 * video is served; it does not reclassify the stored observation's provenance.
 * Channel history, intraday comparator data and inferred points are excluded.
 */
export function buildMonitoringYoutubeDailyHistorySql(
  artistKeysSql: string,
  earliestDateSql: string,
  options: { includeCandidateOnly?: boolean } = {},
): string {
  return `
    WITH eligible_videos AS MATERIALIZED (${buildMonitoringYoutubeEligibleVideosSql(artistKeysSql)})
    SELECT s.video_id, s.snapshot_date, s.view_count, s.daily_view_delta,
      s.fetched_at::text fetched_at, 'youtube_video_daily_snapshots'::text source_table,
      eligible.relation_source, eligible.relation_status, eligible.sampling_status,
      eligible.relation_evidence_source, eligible.has_approved_link, eligible.relationship_sources,
      CASE WHEN eligible.has_approved_link THEN 'approved_artist_link'
        ELSE 'founder_candidate_diagnostic' END visibility_scope
    FROM youtube_video_daily_snapshots s
    JOIN eligible_videos eligible ON eligible.video_id=s.video_id
    WHERE s.snapshot_date >= ${earliestDateSql}
      ${options.includeCandidateOnly ? "" : "AND eligible.has_approved_link=true"}
    ORDER BY s.video_id, s.snapshot_date
  `;
}

export const MONITORING_YOUTUBE_DAILY_HISTORY_SQL = buildMonitoringYoutubeDailyHistorySql(
  "$1::text[]",
  "to_char((now() AT TIME ZONE 'America/New_York')::date - 89, 'YYYY-MM-DD')",
);

/** Inventory the sources already used by the public preview and founder
 * dashboard without changing approved-link completeness or source provenance.
 * Legacy video association is by a vetted linked channel, never a name match.
 */
export function buildMonitoringYoutubeDiagnosticsSql(
  artistKeysSql: string,
  earliestDateSql = "to_char((now() AT TIME ZONE 'America/New_York')::date - 89, 'YYYY-MM-DD')",
): string {
  return `
    WITH eligible AS MATERIALIZED (${buildMonitoringYoutubeEligibleVideosSql(artistKeysSql)}),
    linked_channels AS MATERIALIZED (
      SELECT DISTINCT artist_key,channel_id FROM youtube_channels WHERE artist_key=ANY(${artistKeysSql})
    ), native_history AS MATERIALIZED (
      SELECT s.*,eligible.has_approved_link,
        count(*) OVER(PARTITION BY s.video_id) video_days
      FROM youtube_video_daily_snapshots s JOIN eligible USING(video_id)
      WHERE s.view_count IS NOT NULL
        AND s.snapshot_date >= ${earliestDateSql}
    ), legacy_videos AS MATERIALIZED (
      SELECT video.* FROM youtube_videos video
      WHERE EXISTS(SELECT 1 FROM linked_channels channel WHERE channel.channel_id=video.channel_id)
    ), channel_history AS MATERIALIZED (
      SELECT snapshot.* FROM youtube_channel_daily_snapshots snapshot
      WHERE EXISTS(SELECT 1 FROM linked_channels channel
        WHERE channel.artist_key=snapshot.artist_key AND channel.channel_id=snapshot.channel_id)
    )
    SELECT jsonb_build_object(
      'inspected',true, 'scope','existing_serving_sources_diagnostic',
      'catalog',(SELECT jsonb_build_object(
        'videos',count(*), 'approvedLinkVideos',count(*) FILTER(WHERE eligible.has_approved_link),
        'candidateOnlyVideos',count(*) FILTER(WHERE NOT eligible.has_approved_link),
        'observedVideos',count(*) FILTER(WHERE COALESCE(latest.view_count,tracked.view_count) IS NOT NULL),
        'videosWithArtwork',count(*) FILTER(WHERE NULLIF(tracked.thumbnail_url,'') IS NOT NULL),
        'latestObservedAt',max(latest.observed_at)
      ) FROM eligible JOIN youtube_tracked_videos tracked USING(video_id)
        LEFT JOIN youtube_video_intraday_latest_observations pointer USING(video_id)
        LEFT JOIN youtube_video_intraday_shadow_snapshots latest
          ON latest.video_id=pointer.video_id AND latest.observed_at=pointer.latest_observed_at),
      'relationships',(SELECT jsonb_agg(to_jsonb(relations)) FROM (
        SELECT relation->>'source_table' source_table,relation->>'status' status,
          relation->>'sampling_status' sampling_status,relation->>'evidence_source' evidence_source,
          count(DISTINCT eligible.video_id) videos
        FROM eligible CROSS JOIN LATERAL jsonb_array_elements(eligible.relationship_sources) relation
        GROUP BY 1,2,3,4 ORDER BY 1,2,3,4
      ) relations),
      'nativeDailyHistory',(SELECT jsonb_build_object(
        'sourceTable','youtube_video_daily_snapshots','rangeDays',90,
        'candidateOnlyVisibility','founder_diagnostic',
        'days',count(DISTINCT snapshot_date),'points',count(*),'videos',count(DISTINCT video_id),
        'videosWithHistory',count(DISTINCT video_id) FILTER(WHERE video_days>=2),
        'candidateOnlyVideosWithHistory',count(DISTINCT video_id) FILTER(WHERE video_days>=2 AND NOT has_approved_link),
        'firstDate',min(snapshot_date),'lastDate',max(snapshot_date),'lastFetchedAt',max(fetched_at)
      ) FROM native_history),
      'legacyVideos',(SELECT jsonb_build_object(
        'sourceTable','youtube_videos','relationship','exact_linked_channel',
        'videos',count(*),'observedVideos',count(*) FILTER(WHERE view_count IS NOT NULL),
        'channels',count(DISTINCT channel_id),'latestCachedAt',max(cached_at)
      ) FROM legacy_videos),
      'channelDailyHistory',(SELECT jsonb_build_object(
        'sourceTable','youtube_channel_daily_snapshots','relationship','exact_artist_and_linked_channel',
        'days',count(DISTINCT snapshot_date),'points',count(*),'channels',count(DISTINCT channel_id),
        'firstDate',min(snapshot_date),'lastDate',max(snapshot_date),'lastFetchedAt',max(fetched_at),
        'sourceTypes',array_agg(DISTINCT source_type ORDER BY source_type),
        'latestSnapshots',(SELECT jsonb_agg(to_jsonb(latest)) FROM (
          SELECT DISTINCT ON(channel_id) * FROM channel_history ORDER BY channel_id,snapshot_date DESC,fetched_at DESC
        ) latest)
      ) FROM channel_history)
    ) diagnostics
  `;
}

const MONITORING_YOUTUBE_FOUNDER_DAILY_HISTORY_SQL = buildMonitoringYoutubeDailyHistorySql(
  "$1::text[]",
  "to_char((now() AT TIME ZONE 'America/New_York')::date - 89, 'YYYY-MM-DD')",
  { includeCandidateOnly: true },
);

function checkedArtistKeys(artistKeys: readonly string[], deadlineAt?: number) {
  const keys = [...new Set(artistKeys.map(key => key.trim()).filter(Boolean))];
  if (!keys.length) throw new Error("An authorized artist identity is required for YouTube reads");
  if (deadlineAt != null && Date.now() >= deadlineAt) throw new Error("Monitoring YouTube read deadline exceeded");
  return keys;
}

export async function loadMonitoringYoutubeLiveVideos(queryable: Queryable, artistKeys: readonly string[], options: { deadlineAt?: number } = {}) {
  return (await queryable.query(MONITORING_YOUTUBE_LIVE_VIDEOS_SQL, [checkedArtistKeys(artistKeys, options.deadlineAt)])).rows;
}

export async function loadMonitoringYoutubeDailyHistory(queryable: Queryable, artistKeys: readonly string[], options: { deadlineAt?: number; includeCandidateOnly?: boolean } = {}) {
  const sql = options.includeCandidateOnly ? MONITORING_YOUTUBE_FOUNDER_DAILY_HISTORY_SQL : MONITORING_YOUTUBE_DAILY_HISTORY_SQL;
  return (await queryable.query(sql, [checkedArtistKeys(artistKeys, options.deadlineAt)])).rows;
}
