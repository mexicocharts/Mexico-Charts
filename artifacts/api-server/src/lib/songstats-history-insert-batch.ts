// Opt-in for the bounded history importer. The normal ingestion default is unchanged.
// 1,000 rows use 9,000 parameters, below PostgreSQL's 65,535 parameter limit.
export function historyInsertBatchSize(configured?: string): number {
  return configured === "1000" ? 1000 : 250;
}
