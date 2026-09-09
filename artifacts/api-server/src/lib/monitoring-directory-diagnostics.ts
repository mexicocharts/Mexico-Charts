import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export type DirectoryStage = "schema_inventory" | "candidate_population" | "accepted_aliases" | "discovery_candidates" | "page_evidence" | "directory";
type Record = { requestId: string; stage: DirectoryStage; phase: string; elapsedMs: number; outcome: string; errorClass?: string; errorMessage?: string; ownerRequestId?: string | null };
const context = new AsyncLocalStorage<{ requestId: string; emit: (record: Record) => void }>();
export function directoryRequestId() { return context.getStore()?.requestId ?? null; }
export function directoryDiagnostic(stage: DirectoryStage, phase: string, startedAt: number, outcome: string, error?: unknown, ownerRequestId?: string | null) {
  const current = context.getStore();
  if (!current) return;
  const message = error instanceof Error ? error.message : "";
  // Never emit arbitrary driver messages: they can contain SQL, values or URLs.
  const safeMessage = /query read timeout/i.test(message) ? "query_read_timeout"
    : /statement timeout/i.test(message) ? "statement_timeout"
    : /timeout exceeded when trying to connect|connection.*timeout/i.test(message) ? "connection_acquisition_timeout"
    : /connection terminated/i.test(message) ? "connection_terminated" : "unclassified_error";
  const record: Record = { requestId: current.requestId, stage, phase, elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10, outcome };
  if (error !== undefined) { record.errorClass = error instanceof Error ? "Error" : "NonError"; record.errorMessage = safeMessage; }
  if (ownerRequestId !== undefined) record.ownerRequestId = ownerRequestId;
  try { current.emit(record); } catch { /* Diagnostics must not alter serving outcomes. */ }
}
export async function withDirectoryDiagnostics<T>(emit: (record: Record) => void, run: (requestId: string) => Promise<T>): Promise<T> {
  const requestId = randomUUID();
  return context.run({ requestId, emit }, async () => {
    const startedAt = performance.now();
    try { const value = await run(requestId); directoryDiagnostic("directory", "total", startedAt, "ok"); return value; }
    catch (error) { directoryDiagnostic("directory", "total", startedAt, "error", error); throw error; }
  });
}
