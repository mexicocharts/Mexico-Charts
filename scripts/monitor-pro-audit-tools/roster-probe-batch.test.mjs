import test from 'node:test';
import assert from 'node:assert/strict';
import { runRosterProbeBatch } from './roster-probe-batch.mjs';
function fixture() {
 const candidates=[{artistKey:'outside',artistName:'Outside'}, {artistKey:'a',artistName:'A'}, {artistKey:'b',artistName:'B'}];
 const reconciliation={scope:'approved_roster_only',auxiliaryCandidates:3,groups:candidates.map((candidate,artistIndex)=>({candidate,artistIndex,status:artistIndex?'roster_route_correspondence':'outside_approved_roster'})),artists:[{evaluateCandidateIndices:[1,2,1]}]};
 const saved=new Map(),calls=[],checkpoints=[];
 return {candidates,reconciliation,saved,calls,checkpoints,readProbe:async index=>saved.get(index),
 runProbe:async options=>{calls.push(options);const i=candidates.findIndex(c=>c.artistKey===options.artistKey);saved.set(i,{artistIndex:i,decision:{...candidates[i],classification:null,auditStatus:'incomplete'}});return {success:true};},
 saveCheckpoint:async value=>checkpoints.push(value),now:()=>0};
}
test('only roster candidates run, duplicate row does not duplicate query, individual gaps continue',async()=>{
 const f=fixture(),r=await runRosterProbeBatch(f);assert.deepEqual(f.calls.map(c=>c.artistKey),['a','b']);assert.deepEqual(r.completed,[1,2]);assert.equal(r.failure,null);
});
test('saved results reuse exact identities without another query',async()=>{
 const f=fixture();f.saved.set(1,{artistIndex:1,decision:{...f.candidates[1]}});const r=await runRosterProbeBatch(f);assert.deepEqual(r.reused,[1]);assert.equal(f.calls.length,1);
});
test('out-of-roster injection and candidate mutation are rejected before execution',async()=>{
 const f=fixture();f.reconciliation.artists[0].evaluateCandidateIndices.push(0);await assert.rejects(runRosterProbeBatch(f));assert.equal(f.calls.length,0);
 const g=fixture();g.reconciliation.groups[1].candidate={artistKey:'wrong'};await assert.rejects(runRosterProbeBatch(g));assert.equal(g.calls.length,0);
});
test('failed bounded driver operation is saved and never automatically retried',async()=>{
 const f=fixture();let count=0;f.runProbe=async()=>{count++;return {success:false,error:{code:'57014'}}};const r=await runRosterProbeBatch(f);assert.equal(count,1);assert.equal(r.failure.artistIndex,1);assert.equal(r.automaticRetries,0);
});
test('artist cap and remaining wall budget are respected',async()=>{
 const f=fixture();const r=await runRosterProbeBatch({...f,maximumArtists:1});assert.deepEqual(r.completed,[1]);
 const g=fixture();let t=0;g.now=()=>{t+=60000;return t};const s=await runRosterProbeBatch(g);assert.equal(s.completed.length,1);
});
test('mismatched saved evidence rejects without querying',async()=>{
 const f=fixture();f.saved.set(1,{artistIndex:1,decision:{artistKey:'a',artistName:'wrong'}});await assert.rejects(runRosterProbeBatch(f));assert.equal(f.calls.length,0);
});
