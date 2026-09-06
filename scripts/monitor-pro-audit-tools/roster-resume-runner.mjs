import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { runRosterProbeBatch } from './roster-probe-batch.mjs';
import { sha256, readBytes, readJson, writeExclusive, privateDirectory, acquireAuditLock, createAttemptStore } from './roster-attempt-store.mjs';

const PIN={population:'84d8cdfe12b187af43328eb946acebcda39149a9bb0aa8eeba3d91d7e70f9e4a',
 complete:'7b31c5e96e4bdcd3729dde93459b90bbd6bb2ab81e4a7b756fe94a2dddf3192f',
 selection:'4c8a24a3802aa4b445a157c5f4b020d64eb59961123473487d2fc1228275313d',
 baseline:'d48c8aa21b7f32e017f36784fe355cc41390f979fd9f2587572bc52792b530bd',
 driver:'428efcefcb429790ada5d4f66293d6724658f1ac6612af7822a2d469f23610ed',
 failure:'d8948d35e44c088691633948a9f71e1969ca719bca3a87f6bad41dd3e588c3f6'};
const orchestratorHashes=Object.fromEntries(['roster-resume-runner.mjs','roster-probe-batch.mjs','roster-attempt-store.mjs'].map(name=>[name,sha256(readBytes(new URL(name,import.meta.url)))]));
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(i%2===0){assert(v.startsWith('--')&&all[i+1]);a.push([v.slice(2),all[i+1]])}return a},[]));
assert(Object.keys(args).every(k=>['base','action','batches'].includes(k)));
assert(args.base && ['verify','run','status','export'].includes(args.action));
const base=path.resolve(args.base),oldRoot=path.join(base,'evidence-configured-467'),runId='configured_467459a_snapshot1';
const original=path.join(oldRoot,runId),output=path.join(base,'roster-resume-a60c2af');
const exact=(file,hash)=>{const b=readBytes(file);assert.equal(sha256(b),hash,'Pinned artifact changed: '+path.basename(file));return JSON.parse(b);};
const population=exact(path.join(original,'population.json'),PIN.population);
const proof=exact(path.join(original,'population-capture/complete.json'),PIN.complete);
const selection=exact(path.join(base,'roster-reconcile-529/scope-selection.json'),PIN.selection);
assert.equal(selection.rosterRows,529);assert.equal(selection.distinctRoutes,528);assert.equal(selection.indices.length,495);
assert.equal(selection.populationSha256,PIN.population);
const baseline=exact(path.join(base,'roster-reconcile-529/saved-readiness-exact-export-v1.json'),PIN.baseline);
assert.equal(baseline.length,19);
const failure=exact(path.join(original,'driver/invocations/a0a333ae-56b3-4558-91c8-53b0b89d6157.result.json'),PIN.failure);
assert.equal(failure.queriesExecuted,0);assert.equal(failure.closeOutcome,'not_opened');
assert(!fs.existsSync(path.join(original,'driver/invocations/a0a333ae-56b3-4558-91c8-53b0b89d6157.session.request.json')));
const driverFile=path.join(base,'configured-monitor-audit-driver-467.cjs');assert.equal(sha256(readBytes(driverFile)),PIN.driver);
const driver=createRequire(import.meta.url)(driverFile),runtime=driver.loadRuntime(path.join(base,'tools-467459a'));
const md5=value=>runtime.replayApi.md5Utf8(runtime.replayApi.canonicalCheckpointJson(value));
const metadata=readJson(path.join(original,'manifest.json'));
const verifyPopulation=root=>driver.loadCapture().verifyPartitionedPopulation({storage:driver.privateStorage(root),runtime,metadata,manifestText:runtime.manifestText});
function decisionFrom(file,index,expectedHash){
 const bytes=readBytes(file);if(expectedHash)assert.equal(sha256(bytes),expectedHash);
 const saved=JSON.parse(bytes),decision=saved.decision??saved.result,candidate=population.candidates[index];
 assert.equal(saved.candidateMd5,md5(candidate));
 if(saved.resultMd5)assert.equal(saved.resultMd5,md5(decision));
 assert.equal(decision.artistKey,candidate.artistKey);assert.equal(decision.artistName,candidate.artistName);
 assert.equal(decision.auditedAt,new Date(readJson(path.join(path.dirname(file).includes('/driver/probes')?path.resolve(path.dirname(file),'../..'):path.resolve(path.dirname(file),'..'),'decoded','evidence_'+index+'.json')).rows[0].audit_captured_at).toISOString());
 return {status:'completed',artifact:file,sha256:sha256(bytes),decision};
}
const preserved=new Map();
for(const row of baseline){assert(selection.indices.includes(row.artistIndex));assert(row.originalArtifact.startsWith(original+'/'));preserved.set(row.artistIndex,decisionFrom(row.originalArtifact,row.artistIndex,row.originalSha256));}
privateDirectory(output);const release=acquireAuditLock(output);
try {
 const initFile=path.join(output,'lineage.json');
 if(!fs.existsSync(initFile)){
  await verifyPopulation(oldRoot);
  const names=new Set([runId+'/manifest.json',runId+'/population.json',runId+'/population-capture/complete.json',...proof.artifacts.map(r=>r.key)]);
  for(const suffix of ['request.json','pg.json','adapter.json']){const key=runId+'/driver/queries/connection_bootstrap.'+suffix;if(fs.existsSync(path.join(oldRoot,key)))names.add(key);}
  const boot=readJson(path.join(original,'driver/queries/connection_bootstrap.pg.json'));
  if(boot.sessionQueryArtifact){names.add(boot.sessionQueryArtifact);const q=boot.sessionQueryArtifact.replace(/\.pg\.json$/,'.request.json');if(fs.existsSync(path.join(oldRoot,q)))names.add(q);}
  const copies=[...names].sort().map(key=>{assert(key.startsWith(runId+'/')&&!key.split('/').includes('..'));const bytes=readBytes(path.join(oldRoot,key));return {key,bytes:bytes.length,sha256:sha256(bytes)}});
  writeExclusive(initFile,{protocol:'roster-continuation-v1',sourceRoot:oldRoot,sourceRunId:runId,pins:PIN,
   meaning:'Byte-exact inherited source snapshot in a distinct continuation root; not a new population capture. All original evaluations and failures remain in the original root.',
   orchestratorHashes,copies,baseline:[...preserved].map(([index,v])=>({index,artifact:v.artifact,sha256:v.sha256})),originalZeroQueryFailure:PIN.failure});
 }
 const lineage=readJson(initFile);assert.deepEqual(lineage.pins,PIN);assert.deepEqual(lineage.orchestratorHashes,orchestratorHashes,'Orchestrator changed; explicit state review required');
 const store=createAttemptStore(path.join(output,'attempts'),PIN.selection);
 function generationNumbers(){const dir=path.join(output,'generations');if(!fs.existsSync(dir))return [];return fs.readdirSync(dir).filter(n=>/^g\d+$/.test(n)).map(n=>Number(n.slice(1))).sort((a,b)=>a-b);}
 async function ensureGeneration(number){
  assert(number<=3,'Repeated zero-query deferrals require systemic review');
  const root=path.join(output,'generations','g'+String(number).padStart(3,'0'));privateDirectory(root);
  const manifest=path.join(root,'INHERITED-SOURCE.json');
  if(!fs.existsSync(manifest)){
   for(const ref of lineage.copies){const source=path.join(oldRoot,ref.key),dest=path.join(root,ref.key),bytes=readBytes(source);assert.equal(sha256(bytes),ref.sha256);if(fs.existsSync(dest))assert.equal(sha256(readBytes(dest)),ref.sha256);else writeExclusive(dest,bytes);}
   await verifyPopulation(root);writeExclusive(manifest,{sourceLineageSha256:sha256(readBytes(initFile)),number,copies:lineage.copies});
  }else assert.equal(readJson(manifest).sourceLineageSha256,sha256(readBytes(initFile)));
  return root;
 }
 let activeGeneration=generationNumbers().at(-1)??0;
 let activeRoot=await ensureGeneration(activeGeneration);
 function inspectAttempt(a){
  const root=a.context.root,prefix=path.join(root,runId),probe=path.join(prefix,'driver/probes',a.index+'.json');
  if(fs.existsSync(probe))return {...decisionFrom(probe,a.index),recovered:true};
  const invDir=path.join(prefix,'driver/invocations');
  const newFiles=fs.existsSync(invDir)?fs.readdirSync(invDir).filter(n=>n.endsWith('.result.json')&&!a.context.previousResults.includes(n)):[];
  if(newFiles.length!==1)return {status:'integrity_failure',reason:'in_flight_attempt_has_no_unique_durable_driver_result',index:a.index};
  const invFile=path.join(invDir,newFiles[0]),r=readJson(invFile);
  const queryFile=path.join(prefix,'driver/queries','evidence_'+a.index+'.pg.json');
  const query=fs.existsSync(queryFile)?readJson(queryFile):null;
  const session=path.join(invDir,r.invocationId+'.session.request.json');
  const evidence={driverInvoked:true,invocationArtifact:invFile,invocationSha256:sha256(readBytes(invFile)),sourceQueries:r.queriesExecuted,closeOutcome:r.closeOutcome,error:query?.error??r.failure,queryArtifact:query?queryFile:null};
  if(r.success)return {status:'integrity_failure',reason:'driver_success_without_saved_probe',...evidence};
  if(r.queriesExecuted===0 && r.closeOutcome==='not_opened' && !fs.existsSync(session)
    && r.elapsedMs>=r.wallBudgetMs-38500 && query?.success===false && !query.queryStartedAt)
   return {status:'zero_query_deferred',reason:'verified_pre_connection_budget_stop',...evidence};
  if(query?.error?.code==='57014' && ['closed','failed','timeout'].includes(r.closeOutcome))
   return {status:'capture_failure',reason:'artist_query_timeout_no_retry',...evidence};
  return {status:'systemic_failure',reason:'driver_failure_requires_review',...evidence};
 }
 async function state(index){
  if(preserved.has(index))return preserved.get(index);
  const a=store.last(index);if(!a)return null;
  let outcome=a.outcome;
  if(!outcome){outcome=inspectAttempt(a);store.finish(a,outcome);}
  if(outcome.status==='completed')decisionFrom(outcome.artifact,index,outcome.sha256);
  return outcome;
 }
 async function summarize(){
  const rows=[];for(const index of selection.indices){const s=await state(index);if(s)rows.push({index,...s});}
  return {selectedCandidates:selection.indices.length,completed:rows.filter(r=>r.status==='completed').length,
   captureFailures:rows.filter(r=>r.status==='capture_failure').length,
   pending:selection.indices.length-rows.filter(r=>['completed','capture_failure'].includes(r.status)).length,
   stopped:rows.filter(r=>['systemic_failure','integrity_failure'].includes(r.status)),rows};
 }
 if(args.action==='run'){
  const maximum=Number(args.batches??1);assert(Number.isSafeInteger(maximum)&&maximum>=1&&maximum<=200);
  const {Client}=createRequire('/home/runner/workspace/lib/db/package.json')('pg');
  for(let batch=0;batch<maximum;batch++){
   const outcome=await runRosterProbeBatch({indices:selection.indices,readState:state,
    reserve:async index=>{
     const old=store.last(index);
     if(old?.outcome?.status==='zero_query_deferred' && old.outcome.driverInvoked){assert(old.number<2,'Repeated zero-query failure requires review');activeRoot=await ensureGeneration(++activeGeneration);}
     const invDir=path.join(activeRoot,runId,'driver/invocations');
     return store.reserve(index,{root:activeRoot,candidateSha256:sha256(Buffer.from(JSON.stringify(population.candidates[index]))),previousResults:fs.existsSync(invDir)?fs.readdirSync(invDir).filter(n=>n.endsWith('.result.json')):[]});
    },
    execute:async(a,options)=>{
     await driver.runDriver({root:a.context.root,runtimeDirectory:path.join(base,'tools-467459a'),runId,phase:'probe',artistKey:population.candidates[a.index].artistKey,wallMs:options.wallMs},{Client});
     return inspectAttempt(a);
    },finish:async(a,o)=>store.finish(a,o),
    checkpoint:async value=>writeExclusive(path.join(output,'batches',crypto.randomUUID()+'.json'),{at:new Date().toISOString(),...value})});
   console.log(JSON.stringify({at:new Date().toISOString(),...outcome}));
   if(['pass_complete','systemic_failure','integrity_failure'].includes(outcome.reason))break;
  }
 }
 const summary=await summarize();
 if(args.action==='export')writeExclusive(path.join(output,'exports',crypto.randomUUID()+'.json'),summary);
 console.log(JSON.stringify({action:args.action,selectedCandidates:summary.selectedCandidates,completed:summary.completed,captureFailures:summary.captureFailures,pending:summary.pending,stopped:summary.stopped.map(r=>({index:r.index,status:r.status,reason:r.reason}))}));
 if(summary.stopped.length)process.exitCode=1;
}finally{release();}
