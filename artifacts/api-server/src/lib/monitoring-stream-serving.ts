import type { PoolClient } from "@workspace/db";

type Queryable = Pick<PoolClient, "query">;
export type MonitoringStreamSummarySources = { materialized: boolean; raw: boolean };

export interface MonitoringStreamSummaryRow {
  snapshot_date: string;
  track_count: number;
  album_count: number;
  track_daily_streams: string | number;
  album_daily_streams: string | number;
  track_total_streams: string | number;
  album_total_streams: string | number;
  fetched_at: string;
  source_table: "monitoring_stream_daily_artist_summaries" | "monitoring_stream_daily_snapshots";
  source_artist_keys: string[];
  derivation: "stored_artist_summary" | "sum_deduplicated_items";
  recovery_reason: "missing_materialized_summary" | "newer_raw_observations" | null;
}

export interface MonitoringSpotifyHistoryRow {
  snapshot_date: string;
  total_streams: string | number | null;
  daily_streams: string | number | null;
  track_count: number | null;
  source_type: string;
  source_artist_key: string;
  fetched_at: string;
}

function checkedArtistKeys(artistKeys: readonly string[]) {
  const keys = [...new Set(artistKeys.map(key => key.trim()).filter(Boolean))];
  if (!keys.length) throw new Error("An authorized artist identity is required for stream reads");
  return keys;
}

/** SQL expressions passed here are application-owned column/parameter references,
 * never request text. Keep the authorized canonical key first in the array.
 *
 * The archive writer's default PostgreSQL mode persists item observations but
 * materializes summaries only in parquet/hybrid mode. Reconstructing those sums
 * is therefore an existing-data read. It neither collects nor writes history.
 */
export function buildLatestMonitoringStreamSummarySql(
  artistKeysSql: string,
  availableSources: MonitoringStreamSummarySources = { materialized: true, raw: true },
): string {
  const emptySummary = `SELECT NULL::date snapshot_date, 0::int track_count, 0::int album_count,
    0::numeric track_daily_streams, 0::numeric album_daily_streams,
    0::numeric track_total_streams, 0::numeric album_total_streams,
    NULL::timestamptz fetched_at, NULL::text source_table, ARRAY[]::text[] source_artist_keys,
    NULL::text derivation, 0::int source_priority WHERE false`;
  return `
    WITH monitor_latest_summary AS (
      ${availableSources.materialized ? `SELECT snapshot_date, track_count, album_count,
        track_daily_streams, album_daily_streams, track_total_streams, album_total_streams,
        fetched_at, 'monitoring_stream_daily_artist_summaries'::text source_table,
        ARRAY[artist_key] source_artist_keys, 'stored_artist_summary'::text derivation, 0 source_priority
      FROM monitoring_stream_daily_artist_summaries
      WHERE artist_key=ANY(${artistKeysSql})
        AND track_count >= 0 AND album_count >= 0 AND track_count + album_count > 0
      ORDER BY snapshot_date DESC, array_position(${artistKeysSql}, artist_key), fetched_at DESC
      LIMIT 1` : emptySummary}
    ), monitor_latest_raw_date AS (
      ${availableSources.raw ? `SELECT max(snapshot_date) snapshot_date
      FROM monitoring_stream_daily_snapshots WHERE artist_key=ANY(${artistKeysSql})`
        : "SELECT NULL::date snapshot_date"}
    ), monitor_raw_items AS (
      ${availableSources.raw ? `SELECT DISTINCT ON (s.item_type, s.item_key, s.snapshot_date)
        s.artist_key, s.item_type, s.item_key, s.snapshot_date, s.total_streams, s.daily_streams, s.fetched_at
      FROM monitoring_stream_daily_snapshots s
      WHERE s.artist_key=ANY(${artistKeysSql})
        AND s.snapshot_date=(SELECT snapshot_date FROM monitor_latest_raw_date)
      ORDER BY s.item_type, s.item_key, s.snapshot_date,
               array_position(${artistKeysSql}, s.artist_key), s.fetched_at DESC`
        : `SELECT NULL::text artist_key, NULL::text item_type, NULL::text item_key,
          NULL::date snapshot_date, NULL::bigint total_streams, NULL::bigint daily_streams,
          NULL::timestamptz fetched_at WHERE false`}
    ), monitor_raw_summary AS (
      SELECT max(snapshot_date) snapshot_date,
        (count(*) FILTER (WHERE item_type='track'))::int track_count,
        (count(*) FILTER (WHERE item_type='album'))::int album_count,
        COALESCE(sum(daily_streams) FILTER (WHERE item_type='track'), 0) track_daily_streams,
        COALESCE(sum(daily_streams) FILTER (WHERE item_type='album'), 0) album_daily_streams,
        COALESCE(sum(total_streams) FILTER (WHERE item_type='track'), 0) track_total_streams,
        COALESCE(sum(total_streams) FILTER (WHERE item_type='album'), 0) album_total_streams,
        max(fetched_at) fetched_at, 'monitoring_stream_daily_snapshots'::text source_table,
        array_agg(DISTINCT artist_key ORDER BY artist_key) source_artist_keys,
        'sum_deduplicated_items'::text derivation, 1 source_priority
      FROM monitor_raw_items HAVING count(*) > 0
    ), monitor_selected AS (
      SELECT * FROM monitor_latest_summary
      UNION ALL SELECT * FROM monitor_raw_summary
      ORDER BY snapshot_date DESC, fetched_at DESC, source_priority
      LIMIT 1
    )
    SELECT snapshot_date::text, track_count, album_count,
      track_daily_streams, album_daily_streams, track_total_streams, album_total_streams,
      fetched_at::text, source_table, source_artist_keys, derivation,
      CASE WHEN source_priority=0 THEN NULL
        WHEN NOT EXISTS (SELECT 1 FROM monitor_latest_summary) THEN 'missing_materialized_summary'
        ELSE 'newer_raw_observations' END recovery_reason
    FROM monitor_selected
  `;
}

export async function loadLatestMonitoringStreamSummary(
  queryable: Queryable,
  artistKeys: readonly string[],
  options: { deadlineAt?: number } = {},
) {
  const keys = checkedArtistKeys(artistKeys);
  const requireReadBudget = () => {
    if (options.deadlineAt != null && Date.now() >= options.deadlineAt) {
      throw new Error("Monitoring stream read deadline exceeded");
    }
  };
  requireReadBudget();
  const availability = await queryable.query<MonitoringStreamSummarySources>(`
    SELECT to_regclass('public.monitoring_stream_daily_artist_summaries') IS NOT NULL materialized,
           to_regclass('public.monitoring_stream_daily_snapshots') IS NOT NULL raw
  `);
  const sources = availability.rows[0];
  if (!sources || (!sources.materialized && !sources.raw)) {
    throw Object.assign(new Error("Stored stream summary sources are unavailable"), { code: "42P01" });
  }
  // A late schema lookup must not enqueue another query after the caller has
  // already returned its terminal timeout response.
  requireReadBudget();
  const result = await queryable.query<MonitoringStreamSummaryRow>(
    buildLatestMonitoringStreamSummarySql("$1::text[]", sources), [keys],
  );
  return result.rows;
}

export const MONITORING_SPOTIFY_HISTORY_SQL = `
  SELECT DISTINCT ON (snapshot_date) snapshot_date, total_streams, daily_streams,
         track_count, source_type, artist_key source_artist_key, fetched_at::text
  FROM spotify_kworb_daily_snapshots
  WHERE artist_key=ANY($1::text[]) AND (total_streams IS NOT NULL OR daily_streams IS NOT NULL)
  ORDER BY snapshot_date, array_position($1::text[], artist_key), fetched_at DESC, id DESC
`;

/** Preserve the provider's stored artist-level Streams/Daily observations.
 * The catalog archive sums item rows; equality with the page header is not
 * established, so those sums must never silently fill this historical series.
 */
export async function loadMonitoringSpotifyHistory(queryable: Queryable, artistKeys: readonly string[]) {
  const result = await queryable.query<MonitoringSpotifyHistoryRow>(
    MONITORING_SPOTIFY_HISTORY_SQL, [checkedArtistKeys(artistKeys)],
  );
  return result.rows;
}
