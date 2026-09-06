/** Read-only, provider-free Monitor Pro audit. Never imports application startup. */
import { writeFile, mkdir, chmod } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const argumentsList = process.argv.slice(2);
const outputIndex = argumentsList.indexOf("--output");
if (outputIndex >= 0 && (!argumentsList[outputIndex + 1] || argumentsList[outputIndex + 1]!.startsWith("--"))) {
  throw new Error("--output requires a private file path.");
}
const output = resolve(outputIndex >= 0 ? argumentsList[outputIndex + 1]! : "monitor-pro-audit.json");
const raw = process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!raw) throw new Error("The existing serving database configuration is required; no credentials are accepted on the command line.");
let databaseUrl: URL;
try { databaseUrl = new URL(raw); } catch { throw new Error("The serving database configuration is invalid."); }
if (!/^postgres(ql)?:$/.test(databaseUrl.protocol)) throw new Error("PostgreSQL is required.");
databaseUrl.searchParams.set("options", `${databaseUrl.searchParams.get("options") ?? ""} -c default_transaction_read_only=on`.trim());
process.env.NEON_DATABASE_URL = databaseUrl.toString();
process.env.DATABASE_URL = databaseUrl.toString();
const database = await import("@workspace/db");
database.monitoringReadPool.options.max = 1;
let revision: string | null = null;
try { revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* Revision absence is reported. */ }
const startedAt = new Date().toISOString();
const report: Record<string, unknown> = {
  status: "in_progress", startedAt, revision, readOnly: true, providerCalls: 0,
  publicEligibilityWrites: 0, databaseName: null, totalCandidates: null,
  candidatesAudited: 0, counts: { A: 0, B: 0, C: 0, incomplete: 0 }, artists: [], pages: [],
};
async function save() {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  await chmod(output, 0o600);
}
try {
  const identity = await database.monitoringReadPool.query("SELECT current_database() database_name, current_setting('transaction_read_only') read_only");
  if (identity.rows[0]?.read_only !== "on") throw new Error("The PostgreSQL read-only safeguard is not active.");
  report.databaseName = identity.rows[0].database_name;
  const { getMonitoringCandidateDirectory } = await import("../lib/monitoring-candidate-audit");
  const artists: Awaited<ReturnType<typeof getMonitoringCandidateDirectory>>["artists"] = [];
  let offset = 0;
  let total: number | null = null;
  const pages: unknown[] = [];
  do {
    const pageStartedAt = performance.now();
    const page = await getMonitoringCandidateDirectory({ limit: 25, offset });
    if (total !== null && page.total !== total) throw new Error("The candidate population changed during the audit; repeat against a stable population.");
    total = page.total;
    artists.push(...page.artists);
    pages.push({ offset, auditedAt: page.auditedAt, durationMs: Math.round(performance.now() - pageStartedAt), count: page.artists.length });
    report.contract = page.contract;
    report.contractVersion = page.contractVersion;
    report.policyVersion = page.policyVersion;
    report.totalCandidates = total;
    report.artists = artists;
    report.pages = pages;
    report.candidatesAudited = artists.length;
    const counts = { A: 0, B: 0, C: 0, incomplete: 0 };
    artists.forEach(artist => { counts[artist.classification ?? "incomplete"]++; });
    report.counts = counts;
    await save();
    if (!page.hasMore) break;
    if (!page.artists.length) throw new Error("Candidate paging did not advance.");
    offset += page.artists.length;
  } while (true);
  if (new Set(artists.map(artist => artist.artistKey)).size !== total) throw new Error("The audit does not contain exactly one row per candidate.");
  report.status = artists.some(artist => artist.auditStatus === "incomplete") ? "requires_further_investigation" : "complete";
  report.completedAt = new Date().toISOString();
  await save();
  console.log(JSON.stringify({ status: report.status, revision, databaseName: report.databaseName, totalCandidates: total, counts: report.counts, output }));
} catch (error) {
  report.status = "incomplete";
  // Safe diagnostic only; pg errors may contain SQL or connection details.
  report.failure = { name: error instanceof Error ? error.name : "Error", code: typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : null };
  report.completedAt = new Date().toISOString();
  await save();
  console.error("Monitor Pro audit incomplete; the private output preserves completed evidence without classifying missing reads as absent data.");
  process.exitCode = 1;
} finally {
  await Promise.all([database.pool, database.publicReadPool, database.monitoringReadPool, database.youtubeCollectorPool, database.youtubeCoveragePool].map(pool => pool.end()));
}
