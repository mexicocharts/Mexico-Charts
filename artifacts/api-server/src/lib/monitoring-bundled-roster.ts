import { artistProfileRoutes } from "../../../mexico-charts/scripts/artist-profile-routes.mjs";
import { SUPPLEMENTAL_ARTISTS } from "./supplemental-artist-data";
import type { MonitoringCandidateSourceRow } from "./monitoring-candidate-policy";

/** Existing public route identities and explicit supplemental source keys are
 * inspection leads. This adapter never imports a loader, creates a database
 * row, fetches a sheet, or asserts an artist's provider identity/eligibility. */
export function buildMonitoringBundledRosterRows(
  routes: ReadonlyArray<{ path: string; name: string }>,
  supplemental: ReadonlyArray<{ artistKey: string; artistName: string }>,
): MonitoringCandidateSourceRow[] {
  return [
    ...routes.map(row => {
      if (!/^\/artist\/[a-z0-9]+(?:-+[a-z0-9]+)*$/.test(row.path) || !row.name.trim()) {
        throw new Error("Invalid bundled monitoring profile identity");
      }
      return { artist_key: row.path.slice("/artist/".length), artist_name: row.name,
        spotify_id: null, source: "artist_profile_routes" };
    }),
    ...supplemental.map(row => {
      if (!row.artistKey.trim() || !row.artistName.trim()) throw new Error("Invalid bundled monitoring supplemental identity");
      return { artist_key: row.artistKey, artist_name: row.artistName,
        spotify_id: null, source: "supplemental_artist_data" };
    }),
  ];
}

const rows = buildMonitoringBundledRosterRows(artistProfileRoutes, SUPPLEMENTAL_ARTISTS);
export function getMonitoringBundledRosterRows(): MonitoringCandidateSourceRow[] {
  return rows.map(row => ({ ...row }));
}

/** The offline audit captures these exact existing bytes and their hashes.
 * Their revision describes bundled identity provenance, never data freshness. */
export const MONITORING_BUNDLED_ROSTER_SOURCE_PATHS = [
  "artifacts/mexico-charts/scripts/artist-profile-routes.mjs",
  "artifacts/mexico-charts/scripts/supplemental-artist-routes.mjs",
  "artifacts/api-server/src/lib/supplemental-artist-data.ts",
] as const;
export const MONITORING_BUNDLED_ROSTER_SOURCE_INVENTORY = [
  { source: "artist_profile_routes", rowCount: artistProfileRoutes.length,
    sourcePaths: MONITORING_BUNDLED_ROSTER_SOURCE_PATHS.slice(0, 2), freshness: "bundled_source_revision" },
  { source: "supplemental_artist_data", rowCount: SUPPLEMENTAL_ARTISTS.length,
    sourcePaths: [MONITORING_BUNDLED_ROSTER_SOURCE_PATHS[2]], freshness: "bundled_source_revision" },
] as const;

export function monitoringCandidatePopulationScope(missingSchemaTables: readonly string[]) {
  return {
    populationComplete: false,
    databasePopulationComplete: missingSchemaTables.length === 0,
    populationScope: "database_and_bundled_rosters" as const,
    populationLimitations: ["external_artist_metadata_active_uninspected", "external_mexican_artist_master_uninspected"],
    bundledSourceInventory: MONITORING_BUNDLED_ROSTER_SOURCE_INVENTORY,
  };
}
