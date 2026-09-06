/** The legacy readiness parser requires a dated 90-day baseline for one of
 * ten audience metrics and two dated points for two of its four trend metrics.
 * The full experience uses the existing compact-serving seven-day baseline
 * tolerance for each requested window, so long gaps cannot pass as growth.
 * This projection evaluates those predicates over the protected compact
 * history, without downloading it or altering any observation/provenance row.
 */
export function buildMonitoringCompactReadinessSql(artistKeysSql: string): string {
  return `WITH verified AS (
    SELECT definition.metric_key, observation.provider_observation_date observed_date
    FROM songstats_historical_observations observation
    JOIN songstats_history_provider_identities identity ON identity.id=observation.provider_identity_id AND identity.validation_status='verified'
    JOIN songstats_history_metric_definitions definition ON definition.id=observation.metric_definition_id
      AND definition.ingestion_status='active' AND definition.commercial_endpoint='artist_historical_stats'
    JOIN songstats_history_import_chunks chunk ON chunk.id=observation.import_chunk_id
    WHERE observation.artist_key=ANY(${artistKeysSql}) AND observation.acquisition_mode='songstats_historical'
      AND observation.value>=0 AND observation.value::text NOT IN ('NaN','Infinity','-Infinity')
  ), available AS (
    SELECT * FROM verified
    UNION ALL
    SELECT metric.metric_key, snapshot.snapshot_date::date
    FROM songstats_artist_daily_snapshots snapshot
    CROSS JOIN LATERAL (VALUES ('spotifyMonthlyListeners',snapshot.spotify_monthly_listeners),
      ('spotifyFollowers',snapshot.spotify_followers),('instagramFollowers',snapshot.instagram_followers),
      ('tiktokFollowers',snapshot.tiktok_followers),('youtubeSubscribers',snapshot.youtube_subscribers),
      ('youtubeChannelViews',snapshot.youtube_channel_views)) metric(metric_key,value)
    WHERE snapshot.artist_key=ANY(${artistKeysSql}) AND metric.value>=0
  ), metrics AS (
    SELECT metric_key,min(observed_date) first_date,max(observed_date) last_date,count(DISTINCT observed_date) days,
      array_agg(DISTINCT observed_date) observation_dates
    FROM available GROUP BY metric_key
  ) SELECT EXISTS(SELECT 1 FROM verified) licensed_endpoint,
    COALESCE(array_agg(metric_key ORDER BY metric_key), ARRAY[]::text[]) available_metric_keys,
    COALESCE(jsonb_object_agg(metric_key,last_date), '{}'::jsonb) metric_latest_dates,
    COALESCE(array_agg(metric_key ORDER BY metric_key) FILTER(WHERE
      EXISTS(SELECT 1 FROM unnest(observation_dates) d WHERE d BETWEEN last_date-14 AND last_date-7)
      AND EXISTS(SELECT 1 FROM unnest(observation_dates) d WHERE d BETWEEN last_date-37 AND last_date-30)
      AND EXISTS(SELECT 1 FROM unnest(observation_dates) d WHERE d BETWEEN last_date-97 AND last_date-90)
      AND metric_key IN
      ('spotifyMonthlyListeners','spotifyFollowers','youtubeSubscribers','youtubeChannelViews','instagramFollowers','tiktokFollowers','facebookFollowers','twitterFollowers','soundcloudFollowers','deezerFollowers')), ARRAY[]::text[]) growth_metric_keys,
    COALESCE(array_agg(metric_key ORDER BY metric_key) FILTER(WHERE days>=2 AND metric_key IN
      ('spotifyMonthlyListeners','instagramFollowers','tiktokFollowers','youtubeSubscribers')), ARRAY[]::text[]) trend_metric_keys
    FROM metrics`;
}
