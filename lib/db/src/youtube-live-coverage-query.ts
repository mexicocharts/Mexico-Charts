export type YoutubeLiveCoverageReadMode = "legacy" | "latest";

export const YOUTUBE_LIVE_COVERAGE_FIELDS = [
  "roster_artists",
  "mapped_artists",
  "approved_link_artists",
  "profile_channel_artists",
  "kworb_video_artists",
  "catalog_artists",
  "observed_artists",
  "fresh_artists",
  "catalog_videos",
  "observed_videos",
  "fresh_videos",
  "latest_observed_at",
] as const;

const commonPrefix = `
  WITH roster_keys AS MATERIALIZED (
    SELECT DISTINCT regexp_replace(
      translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]', '', 'g'
    ) artist_key
    FROM kworb_coverage
    WHERE status='active'
  ), approved_link_keys AS MATERIALIZED (
    SELECT DISTINCT regexp_replace(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g') artist_key
    FROM youtube_artist_video_links
    WHERE active=true AND confidence_score >= 80
  ), profile_channel_keys AS MATERIALIZED (
    SELECT DISTINCT regexp_replace(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g') artist_key
    FROM youtube_channels
    WHERE channel_id IS NOT NULL
  ), kworb_video_keys AS MATERIALIZED (
    SELECT DISTINCT regexp_replace(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g') artist_key
    FROM kworb_snapshots
    WHERE metric_type='youtube'
      AND jsonb_typeof(value->'topVideos')='array'
      AND jsonb_array_length(value->'topVideos') > 0
  ), mapping_totals AS (
    SELECT
      count(*) FILTER (
        WHERE link.artist_key IS NOT NULL
           OR channel.artist_key IS NOT NULL
           OR kworb.artist_key IS NOT NULL
      )::int mapped_artists,
      count(*) FILTER (WHERE link.artist_key IS NOT NULL)::int approved_link_artists,
      count(*) FILTER (WHERE channel.artist_key IS NOT NULL)::int profile_channel_artists,
      count(*) FILTER (WHERE kworb.artist_key IS NOT NULL)::int kworb_video_artists
    FROM roster_keys roster
    LEFT JOIN approved_link_keys link USING (artist_key)
    LEFT JOIN profile_channel_keys channel USING (artist_key)
    LEFT JOIN kworb_video_keys kworb USING (artist_key)
  ), eligible_candidates AS MATERIALIZED (
    SELECT DISTINCT candidate_key.artist_key, candidate_key.video_id
    FROM (
      SELECT
        regexp_replace(
          translate(lower(candidate.artist_key), 'áéíóúüñ', 'aeiouun'),
          '[^a-z0-9]', '', 'g'
        ) artist_key,
        candidate.video_id
      FROM youtube_music_catalog_candidates candidate
      WHERE candidate.status IN ('review','verified')
        AND candidate.sampling_status='shadow'
    ) candidate_key
    JOIN roster_keys roster USING (artist_key)
  )`;

const candidateTotals = `
  , candidate_state AS MATERIALIZED (
    SELECT
      candidate.artist_key,
      candidate.video_id,
      sample.latest_observed_at
    FROM eligible_candidates candidate
    LEFT JOIN snapshot_state sample USING (video_id)
  ), candidate_artist_state AS MATERIALIZED (
    SELECT
      artist_key,
      bool_or(latest_observed_at IS NOT NULL) observed,
      bool_or(latest_observed_at >= now() - interval '6 hours') fresh
    FROM candidate_state
    GROUP BY artist_key
  ), candidate_video_state AS MATERIALIZED (
    SELECT
      video_id,
      bool_or(latest_observed_at IS NOT NULL) observed,
      bool_or(latest_observed_at >= now() - interval '6 hours') fresh,
      max(latest_observed_at) latest_observed_at
    FROM candidate_state
    GROUP BY video_id
  ), candidate_totals AS (
    SELECT
      (SELECT count(*)::int FROM candidate_artist_state) catalog_artists,
      (SELECT count(*) FILTER (WHERE observed)::int FROM candidate_artist_state) observed_artists,
      (SELECT count(*) FILTER (WHERE fresh)::int FROM candidate_artist_state) fresh_artists,
      (SELECT count(*)::int FROM candidate_video_state) catalog_videos,
      (SELECT count(*) FILTER (WHERE observed)::int FROM candidate_video_state) observed_videos,
      (SELECT count(*) FILTER (WHERE fresh)::int FROM candidate_video_state) fresh_videos,
      (SELECT max(latest_observed_at)::text FROM candidate_video_state) latest_observed_at
  )
  SELECT
    (SELECT count(*)::int FROM kworb_coverage WHERE status='active') roster_artists,
    mapping.*,
    candidate.*
  FROM mapping_totals mapping
  CROSS JOIN candidate_totals candidate
`;

export const YOUTUBE_LIVE_COVERAGE_LEGACY_SQL = `${commonPrefix}
  , eligible_video_ids AS MATERIALIZED (
    SELECT DISTINCT video_id
    FROM eligible_candidates
  ), snapshot_state AS MATERIALIZED (
    SELECT sample.video_id, max(sample.observed_at) latest_observed_at
    FROM youtube_video_intraday_shadow_snapshots sample
    JOIN eligible_video_ids eligible USING (video_id)
    GROUP BY sample.video_id
  )
  ${candidateTotals}
`;

export const YOUTUBE_LIVE_COVERAGE_LATEST_SQL = `${commonPrefix}
  , snapshot_state AS MATERIALIZED (
    SELECT latest.video_id, latest.latest_observed_at
    FROM youtube_video_intraday_latest_observations latest
    JOIN (SELECT DISTINCT video_id FROM eligible_candidates) eligible USING (video_id)
  )
  ${candidateTotals}
`;

export function youtubeLiveCoverageReadMode(
  env: NodeJS.ProcessEnv = process.env,
): YoutubeLiveCoverageReadMode {
  return env["YOUTUBE_LIVE_COVERAGE_READ_MODE"] === "legacy" ? "legacy" : "latest";
}

export function youtubeLiveCoverageSql(mode: YoutubeLiveCoverageReadMode): string {
  return mode === "latest" ? YOUTUBE_LIVE_COVERAGE_LATEST_SQL : YOUTUBE_LIVE_COVERAGE_LEGACY_SQL;
}

export function youtubeLiveCoverageRowsEqual(
  legacy: Record<string, unknown>,
  latest: Record<string, unknown>,
): boolean {
  return YOUTUBE_LIVE_COVERAGE_FIELDS.every(field => String(legacy[field] ?? "") === String(latest[field] ?? ""));
}
