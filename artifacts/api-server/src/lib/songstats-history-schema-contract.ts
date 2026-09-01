export const SONGSTATS_HISTORY_SCHEMA_VERSION = 2 as const;

export const SONGSTATS_HISTORY_COMPACT_TABLES = [
  "songstats_history_metric_definitions",
  "songstats_history_provider_identities",
  "songstats_history_import_runs",
  "songstats_history_import_chunks",
  "songstats_historical_observations",
] as const;

export const SONGSTATS_HISTORY_COMPACT_RUNNER_WRITE_TARGETS = [
  "songstats_history_provider_identities",
  "songstats_history_import_runs",
  "songstats_history_import_chunks",
  "songstats_historical_observations",
] as const;
