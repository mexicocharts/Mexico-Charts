import test from "node:test";
import assert from "node:assert/strict";
import {runMonitorRosterSmoke} from "./monitorRosterSmoke.mjs";
const artists=Array.from({length:12},(_,i)=>({artistKey:String(i),identityConflict:i===4}));
const good=key=>({subscription:{artistKey:key},identityDiagnostics:{conflict:false},current:{date:"2026-09-29",listeners:0},sectionStatus:new Proxy({},{get:()=>"loaded"})});
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
  assert.equal(result.stopReason,"two_failures_no_retry"); assert.ok(result.attempted<=3);
  assert.equal(result.successful,0); assert.equal(seen.length,new Set(seen).size);
});
test("authorization, identity and missing dependencies cannot be counted as success",async()=>{
  const auth=await runMonitorRosterSmoke(artists,async()=>{throw Object.assign(new Error("auth"),{status:401})},()=>({}),()=>{});
  assert.equal(auth.stopReason,"unexpected_authorization_failure"); assert.equal(auth.successful,0);
  const contract=await runMonitorRosterSmoke(artists,async key=>({...good(key),subscription:{artistKey:"wrong"},sectionStatus:{}}),()=>({}),()=>{});
  assert.equal(contract.successful,0); assert.ok(contract.results.every(r=>r.outcome==="contract_failed"));
});
