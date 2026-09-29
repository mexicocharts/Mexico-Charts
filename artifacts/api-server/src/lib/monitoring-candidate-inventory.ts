import { groupMonitoringCandidateIdentities, type MonitoringCandidateSourceRow } from "./monitoring-candidate-policy";

export const VIDEO_INVENTORY_SOURCES = ["youtube_artist_video_links", "youtube_music_catalog_candidates"] as const;
type VideoInventorySource = typeof VIDEO_INVENTORY_SOURCES[number];

/** One presence row per exact requested key, not every dated observation.
 * Preserve the DISTINCT projection while allowing the artist-leading index
 * to stop at the first match. No history or identity edge is changed. */
export const MONITORING_HISTORY_IDENTITY_SQL = `SELECT requested.artist_key,
  NULL::text artist_name, NULL::text spotify_id, 'songstats_historical_observations'::text source
  FROM (SELECT DISTINCT unnest($1::text[]) artist_key) requested
  WHERE EXISTS (SELECT 1 FROM songstats_historical_observations observation
    WHERE observation.artist_key=requested.artist_key LIMIT 1)`;

/** Walk existing artist-leading indexes rather than scanning every video row.
 * The LIMIT applies to each next-key seek, never to the resulting artist set.
 * Video display names do not create identity edges. They are hydrated below
 * wherever they could affect the existing representative-name selection.
 */
export function indexedVideoInventorySql(table: VideoInventorySource): string {
  if (!VIDEO_INVENTORY_SOURCES.includes(table)) throw new Error("Invalid inventory source");
  return `SELECT artist_key, NULL::text artist_name, NULL::text spotify_id, '${table}'::text source FROM (
    WITH RECURSIVE inventory_keys AS (
      (SELECT artist_key FROM ${table} WHERE artist_key IS NOT NULL ORDER BY artist_key LIMIT 1)
      UNION ALL
      SELECT next_key.artist_key FROM inventory_keys previous
      CROSS JOIN LATERAL (SELECT artist_key FROM ${table}
        WHERE artist_key > previous.artist_key ORDER BY artist_key LIMIT 1) next_key
    ) SELECT artist_key FROM inventory_keys
  ) video_inventory`;
}

export function indexedMonitoringPopulationSql(original: string): string {
  const videos = VIDEO_INVENTORY_SOURCES.reduce((sql, table) => sql.replace(
    `SELECT DISTINCT artist_key, artist_name, NULL, '${table}' FROM ${table}`,
    indexedVideoInventorySql(table),
  ), original);
  return videos.replace(
    "SELECT DISTINCT artist_key, NULL, NULL, 'songstats_historical_observations' FROM songstats_historical_observations",
    MONITORING_HISTORY_INVENTORY_SQL,
  );
}

/** Directory presence needs distinct keys, not a scan of every historical
 * observation. Seek the existing artist-leading index once per distinct key.
 * Preserve even a nullable key exactly as SELECT DISTINCT would; downstream
 * identity grouping decides whether that key is usable. No observation read,
 * identity bridge, roster membership or importer behavior changes here. */
export const MONITORING_HISTORY_INVENTORY_SQL = `SELECT artist_key,
  NULL::text artist_name, NULL::text spotify_id, 'songstats_historical_observations'::text source
  FROM (
    WITH RECURSIVE inventory_keys AS (
      (SELECT artist_key FROM songstats_historical_observations
        WHERE artist_key IS NOT NULL ORDER BY artist_key LIMIT 1)
      UNION ALL
      SELECT next_key.artist_key FROM inventory_keys previous
      CROSS JOIN LATERAL (SELECT artist_key FROM songstats_historical_observations
        WHERE artist_key > previous.artist_key ORDER BY artist_key LIMIT 1) next_key
    ) SELECT artist_key FROM inventory_keys
    UNION ALL SELECT NULL::text WHERE EXISTS
      (SELECT 1 FROM songstats_historical_observations WHERE artist_key IS NULL LIMIT 1)
  ) history_inventory`;

/** These four established source priorities always precede video names.
 * Retain all source-only artists and hydrate every distinct stored name for
 * groups lacking such a name; never substitute a sampled/first video title.
 */
export function videoInventoryNameKeys(rows: MonitoringCandidateSourceRow[]): string[] {
  const primary = new Set(["kworb_coverage", "official_artists", "spotify_artists", "songstats_artists"]);
  const namedKeys = new Set(rows.filter(row => primary.has(row.source) && row.artist_name?.trim()).map(row => row.artist_key));
  return groupMonitoringCandidateIdentities(rows).filter(group => !group.sourceKeys.some(key => namedKeys.has(key)))
    .flatMap(group => group.sourceKeys);
}

export function videoInventoryNamesSql(table: VideoInventorySource): string {
  if (!VIDEO_INVENTORY_SOURCES.includes(table)) throw new Error("Invalid inventory source");
  return `SELECT DISTINCT artist_key, artist_name, NULL::text spotify_id, '${table}'::text source
    FROM ${table} WHERE artist_key = ANY($1::text[])`;
}
