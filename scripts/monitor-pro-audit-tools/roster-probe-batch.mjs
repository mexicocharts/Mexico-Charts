import assert from 'node:assert/strict';

export const BATCH_WALL_MS = 150000;
export const PROBE_WALL_MS = 120000;
export const CHECKPOINT_RESERVE_MS = 5000;

// Reserve the complete probe lifecycle, including source verification and request
// persistence, before claiming an artist. Never hand the driver a shrinking tail.
// readState/reserve/finish must use the durable, exclusively locked attempt store.
export async function runRosterProbeBatch({ indices, readState, reserve, execute,
  finish, checkpoint, now = () => performance.now(), maximumArtists = 25,
  wallMs = BATCH_WALL_MS }) {
  assert.equal(wallMs, BATCH_WALL_MS);
  assert(Number.isSafeInteger(maximumArtists) && maximumArtists >= 1 && maximumArtists <= 25);
  assert(indices.length && new Set(indices).size === indices.length);
  assert(indices.every(i => Number.isSafeInteger(i) && i >= 0));
  const started = now(), completed = [], skipped = [];
  const stop = async (reason, nextIndex, failure = null) => {
    const result = { reason, nextIndex, completed, skipped, failure,
      elapsedMs: now() - started, wallMs, probeWallMs: PROBE_WALL_MS };
    await checkpoint(result); return result;
  };
  for (const index of indices) {
    const state = await readState(index);
    if (state?.status === 'completed' || state?.status === 'capture_failure') {
      skipped.push(index); continue;
    }
    if (state?.status === 'integrity_failure' || state?.status === 'systemic_failure')
      return stop(state.status, index, state);
    assert(!state || state.status === 'zero_query_deferred', 'Unresolved attempt must be recovered before scheduling');
    if (completed.length >= maximumArtists || wallMs - (now() - started) < PROBE_WALL_MS + CHECKPOINT_RESERVE_MS)
      return stop('budget_stop', index);
    const attempt = await reserve(index);
    // Claim persistence is part of the budget. A late claim remains resumable
    // without invoking the driver or consuming the artist's evaluation state.
    if (wallMs - (now() - started) < PROBE_WALL_MS + CHECKPOINT_RESERVE_MS) {
      await finish(attempt, { status: 'zero_query_deferred', sourceQueries: 0, driverInvoked: false });
      return stop('budget_stop', index);
    }
    const outcome = await execute(attempt, { wallMs: PROBE_WALL_MS });
    assert(['completed','capture_failure','zero_query_deferred','systemic_failure','integrity_failure'].includes(outcome.status));
    await finish(attempt, outcome);
    if (outcome.status === 'completed') completed.push(index);
    else if (outcome.status === 'capture_failure') skipped.push(index);
    else return stop(outcome.status, index, outcome);
  }
  return stop('pass_complete', null);
}
