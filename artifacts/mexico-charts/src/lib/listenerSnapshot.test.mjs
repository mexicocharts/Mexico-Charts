import test from 'node:test';
import assert from 'node:assert/strict';
import {listenerSnapshot} from './listenerSnapshot.mjs';
test('dated shared listener snapshots reconcile exact and one-decimal displays',()=>{
  for (const [metadataValue,saved,compact] of [[47400000,43979322,'44.0M'],[25000000,26597483,'26.6M']]) {
    const result=listenerSnapshot({spotifyListeners:metadataValue},{snapshot:{spotifyMonthlyListeners:saved,snapshotDate:'2026-09-30'}});
    assert.equal(result.value,saved);assert.equal(result.compact,compact);assert.match(result.context,/Songstats.*2026-09-30/);
  }
});
test('fallback exposes missing date and preserves a recorded zero',()=>{
  assert.match(listenerSnapshot({spotifyListeners:123},null).context,/fecha no disponible/);
  assert.equal(listenerSnapshot({spotifyListeners:123},{snapshot:{spotifyMonthlyListeners:0,snapshotDate:'2026-09-30'}}).value,0);
  assert.equal(listenerSnapshot(null,null).value,null);
});
