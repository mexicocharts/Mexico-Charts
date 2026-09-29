import { createHash } from "node:crypto";
import { directoryRequestId, privateIdentityDiagnostic, type DirectoryStage } from "./monitoring-directory-diagnostics";

// Private launcher opt-in only. No timers, extra connections or background jobs.
// At most one plan per selected profile/phase in this process; ordinary serving
// never enters this path. Bind values and SQL bodies are never logged.
const planned = new Set<string>();
export function identityProbeEnabled(stage: DirectoryStage | undefined, values: unknown[]) {
  if (process.env.MONITOR_PRO_READONLY_PREVIEW !== "true" || !directoryRequestId()
    || (stage !== "identity_initial" && stage !== "identity_expanded")) return false;
  const selected = (process.env.MONITOR_PRO_IDENTITY_DIAGNOSTIC_KEYS ?? "").split(",").filter(Boolean).slice(0,3);
  return Array.isArray(values[0]) && selected.some(key => (values[0] as unknown[]).includes(key));
}
export function summarizeIdentityPlan(plan: any): unknown {
  const walk = (n: any): unknown => ({ node:n["Node Type"], relation:n["Relation Name"], index:n["Index Name"],
    rows:n["Plan Rows"], cost:n["Total Cost"], parallel:n["Parallel Aware"], workers:n["Workers Planned"],
    actualRows:n["Actual Rows"], loops:n["Actual Loops"], sharedHit:n["Shared Hit Blocks"], sharedRead:n["Shared Read Blocks"],
    children:(n.Plans ?? []).map(walk) });
  return { plan:walk(plan.Plan), planningMs:plan["Planning Time"], executionMs:plan["Execution Time"] };
}
export async function prepareIdentityProbe(client: {query: (...args: any[]) => Promise<any>}, stage: DirectoryStage, text: string, values: unknown[]) {
  if (!identityProbeEnabled(stage, values)) return text;
  const started = performance.now();
  const tag = `monitor:${directoryRequestId()}:${stage}`;
  const metadata = await client.query("SELECT pg_backend_pid() pid, current_setting('statement_timeout') statement_timeout, current_setting('transaction_read_only') read_only");
  privateIdentityDiagnostic(stage,"bound_query",{tag,backendPid:metadata.rows[0]?.pid,
    statementTimeout:metadata.rows[0]?.statement_timeout,readOnly:metadata.rows[0]?.read_only,
    sqlSha256:createHash("sha256").update(text).digest("hex"),sqlBytes:Buffer.byteLength(text),
    keyCounts:values.map(v=>Array.isArray(v)?v.length:null),metadataMs:performance.now()-started});
  const planKey=JSON.stringify([stage,values]);
  if (!planned.has(planKey) && planned.size < 6) {
    planned.add(planKey);
    const planStarted=performance.now();
    try {
      const result=await client.query({text:`EXPLAIN (FORMAT JSON) ${text}`,values});
      privateIdentityDiagnostic(stage,"exact_bound_plan",{...summarizeIdentityPlan(result.rows[0]["QUERY PLAN"][0]) as object,elapsedMs:performance.now()-planStarted});
    } catch (error) {
      privateIdentityDiagnostic(stage,"plan_unavailable",{elapsedMs:performance.now()-planStarted,statementTimeout:(error as {code?:string}).code==="57014"});
      // A client-side timeout can leave a statement running. The caller must
      // discard that connection instead of queuing the real query behind it.
      if (error instanceof Error && /query read timeout|connection terminated|connection.*closed/i.test(error.message)) throw error;
    }
  }
  return `/* ${tag} */ ${text}`;
}
