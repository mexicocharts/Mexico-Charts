export interface SongstatsInsertWal {
  scope: "observation_insert_statements";
  bytes: number;
  records: number;
  fullPageImages: number;
  inserted: number;
}

export function readSongstatsUpdateWal(planDocument: unknown) {
  const plan = (planDocument as Array<{ Plan?: Record<string, unknown> }>)?.[0]?.Plan;
  if (!plan || plan["Operation"] !== "Update") throw new Error("Expected measured UPDATE plan");
  const count = (name: string) => {
    const value = plan[name];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      throw new Error(`Missing or invalid measured UPDATE ${name}`);
    return value;
  };
  return { scope: "chunk_completion_update" as const, bytes: count("WAL Bytes"),
    records: count("WAL Records"), fullPageImages: count("WAL FPI") };
}

export function historyWalAmplification(walBytes: number, logicalBytes: number): number | null {
  if (!Number.isFinite(walBytes) || walBytes < 0 || !Number.isFinite(logicalBytes) || logicalBytes < 0)
    throw new Error("Invalid history WAL measurement");
  // No new observation bytes means no defined amplification ratio, not a
  // one-byte observation. Absolute storage/cost guards still run for every task.
  return logicalBytes === 0 ? null : walBytes / logicalBytes;
}

// EXPLAIN ANALYZE executes the original INSERT once. Never repeat that INSERT
// after measuring, and never use EXPLAIN's rowCount (the number of plan rows).
export function readSongstatsInsertWal(planDocument: unknown): SongstatsInsertWal {
  const plan = (planDocument as Array<{ Plan?: Record<string, unknown> }>)?.[0]?.Plan;
  if (!plan || plan["Operation"] !== "Insert") throw new Error("Expected measured INSERT plan");
  const count = (name: string) => {
    const value = plan[name];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      throw new Error(`Missing or invalid measured INSERT ${name}`);
    return value;
  };
  return {
    scope: "observation_insert_statements",
    bytes: count("WAL Bytes"),
    records: count("WAL Records"),
    fullPageImages: count("WAL FPI"),
    inserted: count("Tuples Inserted"),
  };
}
