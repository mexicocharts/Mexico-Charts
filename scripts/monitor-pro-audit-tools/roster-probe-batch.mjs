import assert from 'node:assert/strict';

// Audit orchestration only. runProbe must be the unchanged, pinned configured driver.
// It retains its own read-only connection, query deadlines, evidence validation and close.
export async function runRosterProbeBatch({ reconciliation, candidates, readProbe, runProbe,
  saveCheckpoint, now = () => performance.now(), maximumArtists = 25, wallMs = 150000 }) {
  assert(Number.isSafeInteger(maximumArtists) && maximumArtists >= 1 && maximumArtists <= 25);
  assert(wallMs >= 40000 && wallMs <= 150000);
  assert.equal(reconciliation.scope, 'approved_roster_only');
  assert.equal(reconciliation.auxiliaryCandidates, candidates.length);
  const allowed = new Set(reconciliation.groups.filter(group => group.status === 'roster_route_correspondence')
    .map(group => group.artistIndex));
  const indices = [...new Set(reconciliation.artists.flatMap(artist => artist.evaluateCandidateIndices))];
  for (const index of indices) {
    assert(Number.isSafeInteger(index) && allowed.has(index));
    assert.deepEqual(reconciliation.groups[index].candidate, candidates[index]);
  }
  const started = now(), reused = [], completed = [];
  let failure = null;
  for (const index of indices) {
    const candidate = candidates[index];
    const saved = await readProbe(index);
    if (saved) {
      assert.equal(saved.artistIndex, index);
      assert.equal(saved.decision.artistKey, candidate.artistKey);
      assert.equal(saved.decision.artistName, candidate.artistName);
      reused.push(index); continue;
    }
    if (completed.length >= maximumArtists || wallMs - (now() - started) < 40000) break;
    const result = await runProbe({ artistKey: candidate.artistKey,
      wallMs: Math.floor(wallMs - (now() - started)) });
    if (!result.success) { failure = { artistIndex: index, result }; break; }
    const probe = await readProbe(index);
    assert(probe && probe.artistIndex === index && probe.decision.artistKey === candidate.artistKey
      && probe.decision.artistName === candidate.artistName, 'Missing or mismatched saved probe');
    completed.push(index);
    await saveCheckpoint({ completed: [...completed], reused: [...reused], failure: null });
    // An incomplete classification is a per-artist evidence gap, not a batch stop.
  }
  const result = { completed, reused, failure, automaticRetries: 0,
    elapsedMs: now() - started, maximumArtists, wallMs };
  await saveCheckpoint(result);
  return result;
}
