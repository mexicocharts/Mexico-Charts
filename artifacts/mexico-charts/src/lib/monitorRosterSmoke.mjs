// Temporary private acceptance runner. No retry, writes or provider acquisition.
export async function runMonitorRosterSmoke(artists, read, summarize, onResult, signal) {
  const selected = artists.filter(artist => !artist.identityConflict);
  const stages = ["priority_artist_identity","priority_daily_snapshots","extended_artist_data",
    "priority_stream_summary","priority_stream_items","priority_spotify_history","priority_spotify_snapshot",
    "priority_stored_track_artwork","complete_kworb_catalog","youtube_coverage","youtube_catalog_summary",
    "priority_comparisons","compact_history_overview","release_impact"];
  let next = 0, failures = 0, stopReason = null;
  const results = [];
  async function worker() {
    while (!stopReason && !signal?.aborted && next < selected.length) {
      const artist = selected[next++];
      const started = performance.now();
      let result;
      try {
        const data = await read(artist.artistKey);
        const problems = [];
        if (data.subscription?.artistKey !== artist.artistKey || data.identityDiagnostics?.conflict)
          problems.push("identity_mismatch_or_unexpected_conflict");
        if (!data.current || Object.entries(data.current).some(([k,v]) => k !== "date" && v != null && (typeof v !== "number" || !Number.isFinite(v))))
          problems.push("malformed_core_metrics");
        for (const phase of stages) if (data.sectionStatus?.[phase] !== "loaded") problems.push(`${phase}:${data.sectionStatus?.[phase] ?? "missing"}`);
        result = {...summarize(artist.artistKey,data,performance.now()-started),httpStatus:200,
          outcome:problems.length ? "contract_failed" : "passed",problems};
      } catch (error) {
        const status = error?.status ?? null;
        result = {artistKey:artist.artistKey,httpStatus:status,outcome:"request_failed",
          durationMs:Math.round(performance.now()-started),error:error?.message ?? "Unknown read error"};
        if (status === 401 || status === 403) stopReason = "unexpected_authorization_failure";
      }
      if (result.outcome !== "passed" && ++failures >= 2) stopReason ??= "two_failures_no_retry";
      results.push(result);
      onResult(result,{completed:results.length,total:selected.length,stopReason});
    }
  }
  await Promise.all([worker(),worker()]);
  return {total:selected.length,excludedConflicts:artists.length-selected.length,attempted:results.length,
    successful:results.filter(r=>r.outcome==="passed").length,stopReason:signal?.aborted ? "cancelled" : stopReason,results};
}
