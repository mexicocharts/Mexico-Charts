import { randomUUID } from "node:crypto";
import type { PgPool, QueryResultRow } from "@workspace/db";

// Temporary, one-shot, private-only discriminator. No SQL tagging or pool hooks.
let claimed = false;
export function createBetoStageProbe(artistKey: string, emit: (row: object) => void) {
  if (claimed || artistKey !== "betoquintanilla" || process.env.MONITOR_PRO_READONLY_PREVIEW !== "true"
      || process.env.MONITOR_PRO_BETO_STAGE_PROBE !== "true") return undefined;
  claimed = true;
  const id = randomUUID();
  let start: number | undefined;
  return (phase: string, details: Record<string, number | boolean | null> = {}) => {
    const now = performance.now();
    start ??= now;
    try { emit({ event: "monitor_beto_stage_probe", id, phase, offsetMs: now - start,
      at: new Date().toISOString(), ...details }); } catch { /* Logging cannot change serving. */ }
  };
}
export type BetoStageProbe = ReturnType<typeof createBetoStageProbe>;

export async function probeExtendedQuery<T extends QueryResultRow>(
  pool: PgPool, sql: string, values: unknown[], probe: BetoStageProbe,
): Promise<T[]> {
  if (!probe) return pool.query<T>(sql, values).then(result => result.rows);
  probe("acquisition_start");
  const client = await pool.connect();
  probe("acquisition_end", { driverProcessId: (client as unknown as { processID: number }).processID });
  // processID is a driver protocol identifier, not asserted to be a Neon backend PID.
  return new Promise<T[]>((resolve, reject) => {
    let released = false;
    const release = (error?: Error) => { if (!released) { released = true; client.release(error); } };
    const onError = (error: Error) => { release(error); reject(error); };
    client.once("error", onError);
    try {
      probe("query_dispatch");
      client.query<T>(sql, values, (error, result) => {
        client.removeListener("error", onError);
        probe("query_callback", { failed: Boolean(error), rows: result?.rows.length ?? null });
        // Driver callback occurs after row transfer and built-in JSON decoding.
        // These are NOT separately observable server-execution and wire clocks.
        if (!error) probe("row_transfer_and_driver_decoding_complete", { rows: result.rows.length });
        release(error ?? undefined);
        if (error) { reject(error); return; }
        probe("rows_projection_start");
        const rows = result.rows;
        probe("rows_projection_end", { rows: rows.length });
        resolve(rows);
      });
    } catch (error) {
      client.removeListener("error", onError);
      release(error instanceof Error ? error : undefined);
      reject(error);
    }
  });
}
