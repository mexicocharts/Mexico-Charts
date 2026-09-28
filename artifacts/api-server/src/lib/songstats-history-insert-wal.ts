export interface SongstatsInsertWal {
  scope: "observation_insert_statements";
  bytes: number;
  records: number;
  fullPageImages: number;
  inserted: number;
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
