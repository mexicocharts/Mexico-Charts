/** The served peer list uses each latest snapshot and the existing 14-day freshness policy. */
export const MONITORING_COMPARISONS_SQL = `
    WITH selected AS MATERIALIZED (
    SELECT coverage.artist_key,
           COALESCE(NULLIF(coverage.artist_name, ''), coverage.artist_key) artist_name,
           extended.historic_stats,
           latest.snapshot_date,
           latest.spotify_monthly_listeners,
           latest.youtube_channel_views,
           latest.instagram_followers
    FROM kworb_coverage coverage
    JOIN songstats_artist_extended_data extended ON extended.artist_key=coverage.artist_key
    JOIN LATERAL (
      SELECT snapshot_date, spotify_monthly_listeners, youtube_channel_views, instagram_followers
      FROM songstats_artist_daily_snapshots snapshot
      WHERE snapshot.artist_key=coverage.artist_key
      ORDER BY snapshot.snapshot_date DESC
      LIMIT 1
    ) latest ON true
    WHERE coverage.status='active'
      AND NOT (lower(coverage.artist_key)=ANY($1::text[]))
      AND latest.spotify_monthly_listeners > 0
      AND latest.snapshot_date::timestamptz BETWEEN $2::timestamptz - INTERVAL '14 days'
        AND $2::timestamptz + INTERVAL '1 day'
    ORDER BY latest.spotify_monthly_listeners DESC, coverage.artist_key
    LIMIT 4
    )
    SELECT selected.*, image.image_url avatar_url
    FROM selected
    LEFT JOIN LATERAL (
      SELECT image_url
      FROM artist_images
      WHERE regexp_replace(
        translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]', '', 'g'
      )=regexp_replace(
        translate(lower(selected.artist_name), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]', '', 'g'
      )
      LIMIT 1
    ) image ON true
    ORDER BY selected.spotify_monthly_listeners DESC, selected.artist_key
  `;
