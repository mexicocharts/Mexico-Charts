export const GIB = 1024 ** 3;

export interface SongstatsHistoryCapacityPolicy {
  warningDatabaseGiB: number;
  pauseDatabaseGiB: number;
  explicitApprovalDatabaseGiB: number;
  incrementalStorageUsd: number;
  totalDatabaseResourceUsd: number;
  logicalStorageUsdPerGiBMonth: number;
  pitrStorageRatio: number;
  pitrUsdPerGiBMonth: number;
  monthlyComputeBaselineUsd: number;
  compactBytesPerObservation: number;
  approvedWalAmplificationRatio: number | null;
}

export const DEFAULT_SONGSTATS_HISTORY_CAPACITY_POLICY: SongstatsHistoryCapacityPolicy = {
  warningDatabaseGiB: 60,
  pauseDatabaseGiB: 70,
  explicitApprovalDatabaseGiB: 80,
  incrementalStorageUsd: 25,
  totalDatabaseResourceUsd: 60,
  logicalStorageUsdPerGiBMonth: 0.35,
  pitrStorageRatio: 0.171,
  pitrUsdPerGiBMonth: 0.20,
  monthlyComputeBaselineUsd: 33,
  compactBytesPerObservation: 320,
  approvedWalAmplificationRatio: null,
};

export function songstatsHistoryCapacityProjection(input: {
  databaseBytes: number;
  baselineDatabaseBytes: number;
  policy: SongstatsHistoryCapacityPolicy;
}) {
  const databaseGiB = input.databaseBytes / GIB;
  const incrementalGiB = Math.max(0, input.databaseBytes - input.baselineDatabaseBytes) / GIB;
  const storageRate = input.policy.logicalStorageUsdPerGiBMonth
    + input.policy.pitrStorageRatio * input.policy.pitrUsdPerGiBMonth;
  const incrementalStorageUsd = incrementalGiB * storageRate;
  const totalDatabaseResourceUsd = input.policy.monthlyComputeBaselineUsd + databaseGiB * storageRate;
  return { databaseGiB, incrementalGiB, incrementalStorageUsd, totalDatabaseResourceUsd };
}

export function songstatsHistoryCapacityPauseReason(
  projection: ReturnType<typeof songstatsHistoryCapacityProjection>,
  policy: SongstatsHistoryCapacityPolicy,
) {
  if (projection.databaseGiB >= policy.explicitApprovalDatabaseGiB) {
    return "database_80gib_explicit_approval_required";
  }
  if (projection.databaseGiB >= policy.pauseDatabaseGiB) return "database_70gib_pause";
  if (projection.incrementalStorageUsd >= policy.incrementalStorageUsd) {
    return "incremental_storage_cost_pause";
  }
  if (projection.totalDatabaseResourceUsd >= policy.totalDatabaseResourceUsd) {
    return "total_database_resource_cost_pause";
  }
  return null;
}

