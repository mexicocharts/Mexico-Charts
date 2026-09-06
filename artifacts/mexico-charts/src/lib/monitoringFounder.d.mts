export type MonitoringFinding = {
  code: string;
  section: string;
  status: string;
  evidence: unknown;
  action?: string;
};
export type MonitoringCandidate = {
  artistKey: string;
  artistName: string;
  classification: "A" | "B" | "C" | null;
  publicEligible: boolean;
  legacyPublicEligible?: boolean;
  auditStatus: "complete" | "incomplete";
  findings: MonitoringFinding[];
  readinessReasons: string[];
  lastSnapshotDate: string | null;
  sourceEvidence: Record<string, unknown>;
  candidateSources: string[];
  sourceKeys: string[];
  spotifyIds?: string[];
  invalidSpotifyIds?: string[];
  identityConflict?: boolean;
  declaredAliases?: string[];
  identityMappingStatus?:
    | "provider_id"
    | "accepted_registry"
    | "unverified"
    | "conflict";
  identityAliasEvidence?: Array<{
    source: string;
    artistKey: string;
    mbid?: string;
    candidateId?: string;
    matchedArtistKey?: string;
    verification: string;
    aliases: string[];
  }>;
  candidateRecords?: Array<{
    source: string;
    recordId: string;
    artistName: string | null;
    lookupName: string;
    status: string | null;
    matchedArtistKey: string | null;
  }>;
};
export type MonitoringPopulationScope = {
  databasePopulationComplete?: boolean;
  populationScope?: "database_and_bundled_rosters";
  populationLimitations?: Array<
    | "external_artist_metadata_active_uninspected"
    | "external_mexican_artist_master_uninspected"
  >;
  bundledSourceInventory?: Array<{
    source: "artist_profile_routes" | "supplemental_artist_data";
    rowCount: number;
    sourcePaths: string[];
    freshness: "bundled_source_revision";
  }>;
};
export type MonitoringDirectory = MonitoringPopulationScope & {
  policyVersion: number;
  contractVersion: string | number;
  total: number;
  contract?: unknown;
  populationComplete: boolean;
  missingSchemaTables: string[];
  offset: number;
  limit: number;
  hasMore: boolean;
  auditedAt: string;
  counts: { A: number; B: number; C: number; incomplete: number };
  artists: MonitoringCandidate[];
};
export function validateMonitoringDirectory(data: unknown): MonitoringDirectory;
export function loadCompleteMonitoringAudit(
  loadPage: (
    offset: number,
    signal?: AbortSignal,
  ) => Promise<MonitoringDirectory>,
  options?: {
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
  },
): Promise<
  MonitoringPopulationScope & {
    policyVersion: number;
    contractVersion: string | number;
    auditScope: string;
    contract?: unknown;
    populationComplete: boolean;
    missingSchemaTables: string[];
    pageAuditedAt: string[];
    auditComplete: boolean;
    incompleteAuditCount: number;
    total: number;
    counts: MonitoringDirectory["counts"];
    artists: MonitoringCandidate[];
  }
>;
export function monitoringPopulationSummary(
  data: MonitoringPopulationScope & { populationComplete: boolean },
): string;
export function monitoringPopulationLimitations(
  data: MonitoringPopulationScope,
): string[];
export function monitoringSourceSummary(
  evidence: Record<string, unknown>,
): string[][];
