import type { PgPool } from "@workspace/db";
import { FOUNDER_ROSTER_MONTH, FOUNDER_ROSTER_SQL, verifiedFounderRosterIds } from "./monitoring-founder-roster";

export type MonitoringPriorityIdentity = {
  avatar_url: string | null;
  avatar_source: string | null;
  avatar_source_artist_key: string | null;
  spotify_artist_id: string | null;
  identity_conflict: boolean;
  malformed_provider_ids: string[];
  provider_sources: Array<{ source: string; artist_key: string; spotify_artist_id: string; fetched_at: string | null }>;
  roster_catalog_inspection?: { spotifyArtistId: string; artistKey: string; source: "exact_key_roster_source_agreement" };
};

/** Inspection only: never resolves the conflict, merges identities, or grants
 * eligibility. A registry-only alternative outside the fixed roster cannot
 * erase an otherwise unanimous exact-key catalog mapping for the founder. */
export function founderRosterCatalogInspection(
  identity: MonitoringPriorityIdentity, artistKey: string, allowed: ReadonlySet<string>,
): MonitoringPriorityIdentity["roster_catalog_inspection"] {
  if (!identity.identity_conflict || identity.malformed_provider_ids.length || !artistKey) return undefined;
  const sources = identity.provider_sources;
  if (!sources.length || sources.some(row => row.artist_key !== artistKey || !/^[A-Za-z0-9]{22}$/.test(row.spotify_artist_id))) return undefined;
  const established = sources.filter(row => row.source !== "spotify_artists");
  const ids = new Set(established.map(row => row.spotify_artist_id));
  if (ids.size !== 1 || !established.some(row => row.source === "kworb_coverage") || !established.some(row => row.source === "songstats_artists")) return undefined;
  const [spotifyArtistId] = ids;
  if (!spotifyArtistId || !allowed.has(spotifyArtistId)) return undefined;
  const alternatives = sources.filter(row => row.spotify_artist_id !== spotifyArtistId);
  if (!alternatives.length || alternatives.some(row => row.source !== "spotify_artists" || allowed.has(row.spotify_artist_id))) return undefined;
  return { spotifyArtistId, artistKey, source: "exact_key_roster_source_agreement" };
}

/** Exact authorized source keys only. Discovery proposals never supply IDs.
 * A catalog source is usable only when the established mappings agree. */
export function buildMonitoringPriorityIdentitySql(artistKeysSql = "$1::text[]"): string {
  return `WITH requested AS MATERIALIZED (
    SELECT artist_key, min(ordinal) ordinal FROM unnest(${artistKeysSql}) WITH ORDINALITY AS input(artist_key, ordinal)
    WHERE NULLIF(trim(artist_key),'') IS NOT NULL GROUP BY artist_key
  ), provider_sources AS MATERIALIZED (
    SELECT c.artist_key, NULLIF(trim(c.spotify_id),'') spotify_artist_id, 'kworb_coverage'::text source, c.last_fetch_at fetched_at
    FROM kworb_coverage c JOIN requested r USING(artist_key)
    UNION ALL SELECT s.artist_key, NULLIF(trim(s.spotify_artist_id),''), 'spotify_artists', s.spotify_last_updated
    FROM spotify_artists s JOIN requested r USING(artist_key) WHERE s.verified IS TRUE
    UNION ALL SELECT s.artist_key, NULLIF(trim(s.spotify_artist_id),''), 'songstats_artists', s.last_synced_at
    FROM songstats_artists s JOIN requested r USING(artist_key)
    UNION ALL SELECT e.artist_key, NULLIF(trim(e.spotify_artist_id),''), 'songstats_artist_extended_data', e.updated_at
    FROM songstats_artist_extended_data e JOIN requested r USING(artist_key)
    UNION ALL SELECT h.artist_key, NULLIF(trim(h.spotify_artist_id),''), 'songstats_history_provider_identities', h.verified_at
    FROM songstats_history_provider_identities h JOIN requested r USING(artist_key) WHERE h.validation_status='verified'
  ), identity AS (
    SELECT CASE WHEN count(DISTINCT spotify_artist_id)=1 THEN min(spotify_artist_id) FILTER(WHERE spotify_artist_id ~ '^[A-Za-z0-9]{22}$') END spotify_artist_id,
      count(DISTINCT spotify_artist_id)>1 identity_conflict,
      COALESCE(array_agg(DISTINCT spotify_artist_id ORDER BY spotify_artist_id) FILTER(WHERE spotify_artist_id !~ '^[A-Za-z0-9]{22}$'),ARRAY[]::text[]) malformed_provider_ids,
      COALESCE(jsonb_agg(jsonb_build_object('source',source,'artist_key',artist_key,'spotify_artist_id',spotify_artist_id,'fetched_at',fetched_at)
        ORDER BY source,artist_key) FILTER(WHERE spotify_artist_id IS NOT NULL),'[]'::jsonb) provider_sources
    FROM provider_sources
  ), image_sources AS (
    SELECT s.avatar_url, 'songstats_artists'::text source, s.artist_key, 0 source_priority, r.ordinal, s.last_synced_at fetched_at
    FROM songstats_artists s JOIN requested r USING(artist_key) CROSS JOIN identity i
    WHERE s.spotify_artist_id=i.spotify_artist_id AND s.avatar_url ~* '^https?://'
    UNION ALL SELECT a.image_url, 'artist_images', a.artist_key, 1, r.ordinal, NULL::timestamptz
    FROM artist_images a JOIN requested r USING(artist_key) WHERE a.image_url ~* '^https?://'
    UNION ALL SELECT s.spotify_image_url, 'spotify_artists', s.artist_key, 2, r.ordinal, s.spotify_last_updated
    FROM spotify_artists s JOIN requested r USING(artist_key) CROSS JOIN identity i
    WHERE s.verified IS TRUE AND s.spotify_artist_id=i.spotify_artist_id AND s.spotify_image_url ~* '^https?://'
  )
  SELECT image.avatar_url, image.source avatar_source, image.artist_key avatar_source_artist_key,
    identity.spotify_artist_id, identity.identity_conflict, identity.malformed_provider_ids, identity.provider_sources
  FROM identity LEFT JOIN LATERAL (
    SELECT * FROM image_sources ORDER BY source_priority, fetched_at DESC NULLS LAST, ordinal, artist_key LIMIT 1
  ) image ON true`;
}

export async function loadMonitoringPriorityArtistIdentity(
  readPool: Pick<PgPool, "query">,
  artistKeys: string[],
  options: { identityConflict?: boolean; canonicalArtistKey?: string; allowRosterScopedCatalogInspection?: boolean } = {},
): Promise<MonitoringPriorityIdentity[]> {
  const selected = options.identityConflict ? [options.canonicalArtistKey ?? artistKeys[0] ?? ""] : artistKeys;
  const keys = [...new Set(selected.filter(key => typeof key === "string" && Boolean(key.trim())))];
  const result = await readPool.query<MonitoringPriorityIdentity>(buildMonitoringPriorityIdentitySql(), [keys]);
  if (options.allowRosterScopedCatalogInspection && keys.length === 1 && result.rows.some(row => row.identity_conflict)) {
    const roster = await readPool.query<{ spotify_id: string }>(FOUNDER_ROSTER_SQL, [FOUNDER_ROSTER_MONTH]);
    const allowed = verifiedFounderRosterIds(roster.rows);
    for (const row of result.rows) row.roster_catalog_inspection = founderRosterCatalogInspection(row, keys[0]!, allowed);
  }
  return result.rows;
}
