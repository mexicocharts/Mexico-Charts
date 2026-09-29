// Temporary private acceptance runner. Same immutable pass, two readers, no retry.
import { createAuthenticatedFetch } from "../auth/authenticatedFetch.mjs";

// Keep real Clerk token/cookie selection, but never send a fallback HTTP retry.
export async function oneShotAuthenticatedFetch(getToken, input, init, diagnostic) {
  let sent = false;
  let firstResponse;
  return createAuthenticatedFetch({ logger: () => {}, fetchImpl: async (...args) => {
    if (sent) return firstResponse;
    sent = true;
    firstResponse = await globalThis.fetch(...args);
    return firstResponse;
  }})(getToken, input, init, diagnostic);
}
const knownKworb = new Set(["5050 flow malandro", "cri-cri", "gala montes", "baektowo", "dj aza", "elcomandoexclusivo", "lapuradoblep", "remp"]);
const stages = ["priority_artist_identity","priority_daily_snapshots","extended_artist_data",
  "priority_stream_summary","priority_stream_items","priority_spotify_history","priority_spotify_snapshot",
  "priority_stored_track_artwork","complete_kworb_catalog","youtube_coverage","youtube_catalog_summary",
  "priority_comparisons","compact_history_overview","release_impact"];

export function classifySmokeResult(result) {
  if (result.outcome === "passed") return "strict_complete";
  if (result.httpStatus === 200 && result.problems?.length && knownKworb.has(result.artistKey)
      && result.problems.every(p => p === "complete_kworb_catalog:failed")) return "known_source_exception";
  return "runtime_failure";
}
export function remainingSmokeKeys(artists, checkpoint, continuedResults = []) {
  const selected = checkpoint?.selectedKeys ?? artists.filter(a => !a.identityConflict).map(a => a.artistKey);
  const original = checkpoint?.originalResults ?? [], done = [...original, ...continuedResults];
  if (new Set(selected).size !== selected.length || new Set(done.map(r => r.artistKey)).size !== done.length)
    throw new Error("Duplicate checkpoint keys; no requests issued");
  const live = new Map(artists.map(a => [a.artistKey, a]));
  if (selected.some(k => !live.has(k) || live.get(k).identityConflict) || done.some(r => !selected.includes(r.artistKey)))
    throw new Error("Frozen roster/checkpoint mismatch; no requests issued");
  const keys = selected.filter(k => !done.some(r => r.artistKey === k));
  if (checkpoint && (selected.length !== 509 || original.length !== 67 || keys.length + done.length !== 509))
    throw new Error("Invalid frozen 509/67 checkpoint; no requests issued");
  return {selected, keys, original, continuedResults};
}
export async function runMonitorRosterSmoke(artists, read, summarize, onResult, signal, checkpoint, continuedResults = []) {
  const {selected, keys, original} = remainingSmokeKeys(artists, checkpoint, continuedResults);
  const results = [...original, ...continuedResults];
  let next = 0, stopReason = null, previousFailure = null;
  const recent = [];
  async function worker() {
    while (!stopReason && !signal?.aborted && next < keys.length) {
      const key = keys[next++], started = performance.now();
      let result;
      try {
        const data = await read(key), problems = [];
        if (data.subscription?.artistKey !== key || data.identityDiagnostics?.conflict)
          problems.push("identity_mismatch_or_unexpected_conflict");
        if (!data.current || Object.entries(data.current).some(([k,v]) => k !== "date" && v != null && (typeof v !== "number" || !Number.isFinite(v))))
          problems.push("malformed_core_metrics");
        for (const phase of stages) if (data.sectionStatus?.[phase] !== "loaded") problems.push(phase + ":" + (data.sectionStatus?.[phase] ?? "missing"));
        result = {...summarize(key,data,performance.now()-started),artistKey:key,httpStatus:200,
          outcome:problems.length ? "contract_failed" : "passed",problems};
      } catch (error) {
        result = {artistKey:key,httpStatus:error?.status ?? null,outcome:"request_failed",
          durationMs:Math.round(performance.now()-started),error:error?.message ?? "Unknown read error"};
      }
      result.classification = classifySmokeResult(result);
      const failed = result.classification === "runtime_failure";
      const signature = failed ? String(result.httpStatus) + ":" + [...(result.problems ?? [result.error])].sort().join("|") : null;
      recent.push(failed); if (recent.length > 20) recent.shift();
      if (failed && signature === previousFailure) stopReason = "two_consecutive_identical_runtime_failures";
      if (recent.filter(Boolean).length >= 3) stopReason ??= "three_runtime_failures_in_twenty";
      previousFailure = signature;
      results.push(result);
      onResult(result,{completed:results.length,total:selected.length,stopReason});
    }
  }
  await Promise.all([worker(),worker()]);
  return {total:selected.length,excludedConflicts:artists.length-selected.length,attempted:results.length,
    successful:results.filter(r=>r.outcome==="passed").length,stopReason:signal?.aborted ? "cancelled" : stopReason,results};
}
