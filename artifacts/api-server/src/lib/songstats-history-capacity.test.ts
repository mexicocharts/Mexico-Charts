import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SONGSTATS_HISTORY_CAPACITY_POLICY,
  GIB,
  songstatsHistoryCapacityPauseReason,
  songstatsHistoryCapacityProjection,
} from "./songstats-history-capacity";

const policy = DEFAULT_SONGSTATS_HISTORY_CAPACITY_POLICY;

test("warn/pause thresholds preserve the 60/70/80 GiB policy", () => {
  const at60 = songstatsHistoryCapacityProjection({
    databaseBytes: 60 * GIB,
    baselineDatabaseBytes: 4 * GIB,
    policy,
  });
  assert.equal(at60.databaseGiB, 60);
  assert.equal(songstatsHistoryCapacityPauseReason(at60, policy), null);

  const at70 = songstatsHistoryCapacityProjection({
    databaseBytes: 70 * GIB,
    baselineDatabaseBytes: 4 * GIB,
    policy,
  });
  assert.equal(songstatsHistoryCapacityPauseReason(at70, policy), "database_70gib_pause");

  const at80 = songstatsHistoryCapacityProjection({
    databaseBytes: 80 * GIB,
    baselineDatabaseBytes: 4 * GIB,
    policy,
  });
  assert.equal(
    songstatsHistoryCapacityPauseReason(at80, policy),
    "database_80gib_explicit_approval_required",
  );
});

test("cost guards pause independently of physical size", () => {
  const costPolicy = {
    ...policy,
    pauseDatabaseGiB: 1_000,
    explicitApprovalDatabaseGiB: 1_001,
    monthlyComputeBaselineUsd: 0,
    incrementalStorageUsd: 1,
  };
  const incremental = songstatsHistoryCapacityProjection({
    databaseBytes: 10 * GIB,
    baselineDatabaseBytes: 4 * GIB,
    policy: costPolicy,
  });
  assert.equal(
    songstatsHistoryCapacityPauseReason(incremental, costPolicy),
    "incremental_storage_cost_pause",
  );

  const totalPolicy = {
    ...costPolicy,
    incrementalStorageUsd: 1_000,
    totalDatabaseResourceUsd: 1,
  };
  assert.equal(
    songstatsHistoryCapacityPauseReason(incremental, totalPolicy),
    "total_database_resource_cost_pause",
  );
});

