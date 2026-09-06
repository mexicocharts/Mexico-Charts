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
  declaredAliases?: string[];
  identityMappingStatus?: "provider_id" | "accepted_registry" | "unverified" | "conflict";
  identityAliasEvidence?: Array<{ source: string; artistKey: string; mbid: string; verification: string; aliases: string[] }>;
};
export type MonitoringDirectory = {
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
): Promise<{
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
}>;
export function monitoringSourceSummary(
  evidence: Record<string, unknown>,
): string[][];
