import test from "node:test";
import assert from "node:assert/strict";
import {runMonitorRosterSmoke, classifySmokeResult, remainingSmokeKeys, oneShotAuthenticatedFetch} from "./monitorRosterSmoke.mjs";
import checkpoint from "./monitorRosterCheckpoint.json" with {type:"json"};
const artists=Array.from({length:12},(_,i)=>({artistKey:String(i),identityConflict:i===4}));
const good=key=>({subscription:{artistKey:key},identityDiagnostics:{conflict:false},current:{date:"2026-09-29",listeners:0},sectionStatus:new Proxy({},{get:()=>"loaded"})});
test("one-shot transport preserves a real 401 without a second network request",async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('{"error":"Sign in required"}',{status:401})};
  try {
    const response=await oneShotAuthenticatedFetch(async()=>"test-token","http://localhost/api/monitoring/dashboard/example",{});
    assert.equal(calls,1);assert.equal(response.status,401);assert.equal((await response.json()).error,"Sign in required");
  } finally {globalThis.fetch=original}
});
test("one pass excludes conflicts, caps concurrency at two and never repeats an artist",async()=>{
  let active=0,peak=0; const seen=[];
  const result=await runMonitorRosterSmoke(artists,async key=>{
    active++; peak=Math.max(peak,active); seen.push(key);
    await new Promise(resolve=>setTimeout(resolve,1)); active--; return good(key);
  },key=>({artistKey:key}),()=>{});
  assert.equal(peak,2); assert.equal(result.attempted,11); assert.equal(result.successful,11);
  assert.equal(result.excludedConflicts,1); assert.equal(new Set(seen).size,11); assert.ok(!seen.includes("4"));
});
test("repeated timeouts stop dispatch; no retries and in-flight results are preserved",async()=>{
  const seen=[];
  const result=await runMonitorRosterSmoke(artists,async key=>{
    seen.push(key); throw Object.assign(new Error("timeout"),{status:503});
  },key=>({artistKey:key}),()=>{});
  assert.equal(result.stopReason,"two_consecutive_identical_runtime_failures"); assert.ok(result.attempted<=3);
  assert.equal(result.successful,0); assert.equal(seen.length,new Set(seen).size);
});
test("authorization, identity and missing dependencies cannot be counted as success",async()=>{
  const auth=await runMonitorRosterSmoke(artists,async()=>{throw Object.assign(new Error("auth"),{status:401})},()=>({}),()=>{});
  assert.equal(auth.stopReason,"two_consecutive_identical_runtime_failures"); assert.equal(auth.successful,0);
  const contract=await runMonitorRosterSmoke(artists,async key=>({...good(key),subscription:{artistKey:"wrong"},sectionStatus:{}}),()=>({}),()=>{});
  assert.equal(contract.successful,0); assert.ok(contract.results.every(r=>r.outcome==="contract_failed"));
});
test("frozen continuation requests exactly 442 keys, never the original 67", async () => {
  const roster=[...checkpoint.selectedKeys.map(artistKey=>({artistKey})),...checkpoint.excludedKeys.map(artistKey=>({artistKey,identityConflict:true}))];
  const frozen=JSON.stringify(checkpoint), seen=[];
  assert.deepEqual(remainingSmokeKeys(roster,checkpoint).keys,checkpoint.remainingKeys);
  const result=await runMonitorRosterSmoke(roster,async key=>{seen.push(key);return good(key)},key=>({artistKey:key}),()=>{},undefined,checkpoint);
  assert.equal(seen.length,442); assert.equal(new Set(seen).size,442);
  assert.ok(seen.every(k=>!checkpoint.originalResults.some(r=>r.artistKey===k)));
  assert.equal(result.attempted,509); assert.equal(result.successful,507);
  assert.equal(JSON.stringify(checkpoint),frozen);
});
test("known scoped failures do not stop serving smoke; known artist timeouts still count", async()=>{
  const sourceKeys=["5050 flow malandro","cri-cri","gala montes"];
  const result=await runMonitorRosterSmoke(sourceKeys.map(artistKey=>({artistKey})),async key=>({...good(key),sectionStatus:new Proxy({},{get:(_,p)=>p==="complete_kworb_catalog"?"failed":"loaded"})}),key=>({artistKey:key}),()=>{});
  assert.equal(result.stopReason,null); assert.equal(result.successful,0); assert.equal(result.attempted,3);
  assert.ok(result.results.every(r=>r.classification==="known_source_exception"));
  assert.equal(classifySmokeResult({artistKey:"cri-cri",httpStatus:200,outcome:"contract_failed",problems:["complete_kworb_catalog:timeout"]}),"runtime_failure");
});
test("three different current failures in twenty stop, isolated historical records do not",async()=>{
  const result=await runMonitorRosterSmoke(Array.from({length:30},(_,i)=>({artistKey:String(i)})),async key=>{
    if(["1","5","9"].includes(key))throw Object.assign(new Error("failure-"+key),{status:503});return good(key);
  },key=>({artistKey:key}),()=>{});
  assert.equal(result.stopReason,"three_runtime_failures_in_twenty");assert.ok(result.attempted<=11);
});
test("a continuation excludes completed keys and rejects duplicate/mismatched checkpoints before reads",()=>{
  const roster=checkpoint.selectedKeys.map(artistKey=>({artistKey}));
  const done={artistKey:checkpoint.remainingKeys[0]};
  assert.equal(remainingSmokeKeys(roster,checkpoint,[done]).keys.length,441);
  assert.throws(()=>remainingSmokeKeys(roster,checkpoint,[checkpoint.originalResults[0]]),/Duplicate/);
  assert.throws(()=>remainingSmokeKeys(roster.slice(1),checkpoint),/mismatch/);
});
