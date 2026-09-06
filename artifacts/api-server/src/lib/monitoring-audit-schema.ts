import * as database from "@workspace/db";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { executeMonitoringReadinessQuery } from "./monitoring-readiness-service";

export const MONITORING_AUDIT_SOURCE_TABLES = [
  "kworb_coverage", "official_artists", "spotify_artists", "songstats_artists", "musicbrainz_artists", "artist_candidates", "spotify_artist_candidates",
  "songstats_artist_extended_data", "songstats_artist_daily_snapshots", "monitoring_stream_items",
  "monitoring_stream_daily_snapshots", "monitoring_stream_daily_artist_summaries", "spotify_kworb_daily_snapshots",
  "youtube_channels", "youtube_videos", "youtube_channel_daily_snapshots", "youtube_artist_video_links", "youtube_kworb_daily_snapshots", "youtube_artist_video_daily_rollups",
  "songstats_history_provider_identities", "songstats_historical_observations", "artist_images", "deezer_track_covers",
  "youtube_tracked_videos", "youtube_video_daily_snapshots", "songstats_history_metric_definitions", "songstats_history_import_chunks",
  "kworb_snapshots",
  "youtube_music_catalog_candidates", "youtube_video_intraday_latest_observations", "youtube_video_intraday_shadow_snapshots", "youtube_channel_upload_import_state",
] as const;
const definitions = new Map(Object.values(database).filter(value => is(value, PgTable)).map(value => {
  const config = getTableConfig(value as PgTable);
  return [config.name, config] as const;
}));

/** Missing migrations are an explicit unknown, never fabricated zero coverage.
 * Typed empty CTEs permit inspection of the remaining stored sources. They do
 * not create tables or alter the database in any way.
 */
export function withUnavailableMonitoringSources(sql: string, missingTables: string[]): string {
  if (!missingTables.length) return sql;
  const ctes = missingTables.map(name => {
    if (!(MONITORING_AUDIT_SOURCE_TABLES as readonly string[]).includes(name)) throw new Error("Unknown monitoring audit source");
    // This runtime-created table has not yet been declared in Drizzle. These
    // types mirror its existing scheduler DDL; this audit never runs that DDL.
    if (name === "youtube_channel_upload_import_state") return `${name} AS (SELECT NULL::text artist_key, NULL::text channel_id, NULL::text status, NULL::timestamptz completed_at, NULL::text next_page_token, NULL::integer videos_imported, NULL::integer expected_total_videos WHERE false)`;
    const config = definitions.get(name);
    if (!config) throw new Error(`Missing declared monitoring source schema: ${name}`);
    const columns = config.columns.map(column => {
      const type = column.getSQLType().replace(/^serial$/, "integer").replace(/^bigserial$/, "bigint").replace(/^smallserial$/, "smallint");
      return `NULL::${type} AS "${column.name.replaceAll('"', '""')}"`;
    });
    return `"${name}" AS (SELECT ${columns.join(", ")} WHERE false)`;
  });
  return /^\s*WITH\s/i.test(sql)
    ? sql.replace(/^\s*WITH\s/i, `WITH ${ctes.join(", ")}, `)
    : `WITH ${ctes.join(", ")} ${sql}`;
}

let cache: { expiresAt: number; missingTables: string[] } | null = null;
export async function loadMonitoringAuditSchema(readPool: Pick<database.PgPool, "connect"> = database.monitoringReadPool) {
  const cacheable = readPool === database.monitoringReadPool || readPool === database.publicReadPool;
  if (cacheable && cache && cache.expiresAt > Date.now()) return cache.missingTables;
  const rows = await executeMonitoringReadinessQuery<{ table_name: string; present: boolean }>(readPool,
    "SELECT name table_name, to_regclass('public.' || name) IS NOT NULL present FROM unnest($1::text[]) name",
    [[...MONITORING_AUDIT_SOURCE_TABLES]]);
  if (rows.length !== MONITORING_AUDIT_SOURCE_TABLES.length) throw new Error("Monitoring source schema inventory was incomplete");
  const missingTables = rows.filter(row => !row.present).map(row => row.table_name).sort();
  if (cacheable) cache = { expiresAt: Date.now() + 60_000, missingTables };
  return missingTables;
}
