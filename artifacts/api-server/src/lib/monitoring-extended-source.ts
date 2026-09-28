// Read-serving only: source identity is supplied by the existing verified
// identity resolver. This does not add aliases or mutate any provider records.
export const MONITORING_EXTENDED_SOURCE_SQL = `
SELECT artist_key, historic_stats, audience, audience_details, catalog,
       historic_fetched_at, audience_fetched_at, audience_details_fetched_at,
       catalog_fetched_at, updated_at
FROM songstats_artist_extended_data
WHERE ($2::text IS NOT NULL AND spotify_artist_id=$2)
   OR ($2::text IS NULL AND lower(artist_key)=ANY($1::text[]))
`;

type Field = "historic_stats" | "audience" | "audience_details" | "catalog";
type Row = { artist_key: string; updated_at?: string | Date | null } &
  Partial<Record<Field, unknown>> & Partial<Record<
    "historic_fetched_at" | "audience_fetched_at" | "audience_details_fetched_at" | "catalog_fetched_at", string | Date | null>>;
const fields = {
  historic_stats: "historic_fetched_at", audience: "audience_fetched_at",
  audience_details: "audience_details_fetched_at", catalog: "catalog_fetched_at",
} as const;
const time = (value: string | Date | null | undefined) => value == null ? 0 : new Date(value).getTime() || 0;

export function selectMonitoringExtendedSource(rows: Row[]) {
  const result = { historic_stats: null, audience: null, audience_details: null, catalog: null } as Record<Field, unknown>;
  const sourceKeys: Partial<Record<Field, string>> = {};
  for (const field of Object.keys(fields) as Field[]) {
    // A newer explicit empty payload is authoritative; do not silently replace
    // it with older populated data. Null means this endpoint was not captured.
    const candidates = rows.filter(row => row[field] != null).sort((a, b) =>
      time(b[fields[field]] ?? b.updated_at) - time(a[fields[field]] ?? a.updated_at)
      || a.artist_key.localeCompare(b.artist_key));
    if (candidates[0]) { result[field] = candidates[0][field]; sourceKeys[field] = candidates[0].artist_key; }
  }
  return { ...result, sourceKeys };
}
