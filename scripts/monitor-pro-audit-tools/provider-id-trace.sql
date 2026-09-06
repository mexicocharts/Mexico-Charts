-- Audit discovery only. Preserve original rows; a match does not grant identity.
-- $1 exact Spotify artist IDs; $2 exact track IDs; $3 exact album IDs.
WITH identities AS MATERIALIZED (
  SELECT i.* FROM songstats_history_provider_identities i
  WHERE i.spotify_artist_id = ANY($1::text[])
), matched AS (
  SELECT 'identity'::text source_category, 'spotify_artists'::text source_table,
    s.artist_key::text source_key, s.spotify_artist_id::text source_id,
    s.spotify_last_updated::text source_date, to_jsonb(s) original_row
  FROM spotify_artists s WHERE s.spotify_artist_id = ANY($1::text[])
  UNION ALL
  SELECT 'catalog', 'monitoring_stream_items', s.artist_key, s.item_key,
    s.last_seen_at::text, to_jsonb(s)
  FROM monitoring_stream_items s
  WHERE (s.item_type='track' AND s.item_key=ANY($2::text[]))
    OR (s.item_type='album' AND s.item_key=ANY($3::text[]))
  UNION ALL
  SELECT 'history_identity', 'songstats_history_provider_identities', i.artist_key,
    i.id::text, COALESCE(i.verified_at,i.updated_at,i.created_at)::text, to_jsonb(i)
  FROM identities i
  UNION ALL
  SELECT 'history', 'songstats_historical_observations', o.artist_key,
    o.id::text, o.provider_observation_date::text, to_jsonb(o)
  FROM songstats_historical_observations o JOIN identities i ON i.id=o.provider_identity_id
  WHERE o.acquisition_mode='songstats_historical'
)
SELECT source_category,source_table,source_key,source_id,source_date,original_row
FROM matched ORDER BY source_table,source_key,source_id,source_date NULLS FIRST
