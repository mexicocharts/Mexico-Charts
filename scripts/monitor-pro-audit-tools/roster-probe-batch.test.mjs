import test from 'node:test';
import assert from 'node:assert/strict';
import { runRosterProbeBatch, PROBE_WALL_MS } from './roster-probe-batch.mjs';
function fixture(){
 let time=0;const states=new Map(),starts=[],calls=[],checkpoints=[];
 return {indices:[1,4,9],states,starts,calls,checkpoints,now:()=>time,advance:n=>time+=n,
 readState:async i=>states.get(i),reserve:async i=>{const a={index:i};starts.push(a);return a},
 execute:async(a,o)=>{calls.push([a.index,o]);return {status:'completed',decision:{classification:'C',auditStatus:'incomplete'}}},
 finish:async(a,o)=>states.set(a.index,o),checkpoint:async r=>checkpoints.push(structuredClone(r))};
}
test('historical 41788ms tail stops before reserving or invoking next artist',async()=>{
 const f=fixture();f.execute=async(a,o)=>{f.calls.push([a.index,o]);f.advance(108212);return {status:'completed'}};
 const r=await runRosterProbeBatch(f);assert.equal(r.reason,'budget_stop');assert.equal(r.nextIndex,4);assert.equal(f.starts.length,1);assert.equal(f.calls[0][1].wallMs,120000);
});
test('claim persistence exhausting admission budget produces zero-query deferral',async()=>{
 const f=fixture();f.reserve=async i=>{f.advance(30000);return {index:i}};
 const r=await runRosterProbeBatch(f);assert.equal(r.nextIndex,1);assert.equal(f.calls.length,0);assert.equal(f.states.get(1).status,'zero_query_deferred');
});
test('full fixed probe budget includes pre-query work and never shrinks',async()=>{
 const f=fixture();f.execute=async(a,o)=>{assert.equal(o.wallMs,PROBE_WALL_MS);assert.ok(o.wallMs-3498>38500);f.advance(10000);f.calls.push(a.index);return {status:'completed'}};
 const r=await runRosterProbeBatch(f);assert.equal(r.reason,'pass_complete');assert.deepEqual(f.calls,[1,4,9]);
});
test('partial batch and repeated resume reuse completed incomplete evaluations',async()=>{
 const f=fixture();await runRosterProbeBatch({...f,maximumArtists:1});assert.equal(f.states.get(1).decision.auditStatus,'incomplete');
 await runRosterProbeBatch({...f,maximumArtists:1});await runRosterProbeBatch(f);const r=await runRosterProbeBatch(f);
 assert.deepEqual(f.calls.map(x=>x[0]),[1,4,9]);assert.equal(r.reason,'pass_complete');assert.equal(r.nextIndex,null);
});
test('zero-query failure does not advance next index and can safely resume',async()=>{
 const f=fixture();let attempts=0;f.execute=async()=>++attempts===1?{status:'zero_query_deferred',sourceQueries:0}:{status:'completed'};
 const first=await runRosterProbeBatch(f);assert.equal(first.nextIndex,1);assert.deepEqual(first.completed,[]);
 await runRosterProbeBatch(f);assert.equal(attempts,4);assert.equal(f.states.get(1).status,'completed');
});
test('individual capture failures skip later without replay; systemic failures stop',async()=>{
 const f=fixture();f.states.set(1,{status:'capture_failure'});f.execute=async(a)=>{f.calls.push(a.index);return a.index===4?{status:'completed'}:{status:'systemic_failure'}};
 const r=await runRosterProbeBatch(f);assert.deepEqual(f.calls,[4,9]);assert.equal(r.reason,'systemic_failure');
 await runRosterProbeBatch(f);assert.deepEqual(f.calls,[4,9]);
});
test('unknown in-flight evidence prevents another external request',async()=>{
 const f=fixture();f.states.set(1,{status:'in_flight'});await assert.rejects(runRosterProbeBatch(f));assert.equal(f.calls.length,0);
});
test('recovered completion after interruption is not executed again',async()=>{
 const f=fixture();f.readState=async i=>i===1?{status:'completed',recovered:true}:f.states.get(i);
 await runRosterProbeBatch(f);assert.deepEqual(f.calls.map(x=>x[0]),[4,9]);
});
test('checkpoint persistence failure stops before next request',async()=>{
 const f=fixture();f.finish=async()=>{throw new Error('fsync failed')};await assert.rejects(runRosterProbeBatch(f),/fsync failed/);assert.equal(f.calls.length,1);
});
