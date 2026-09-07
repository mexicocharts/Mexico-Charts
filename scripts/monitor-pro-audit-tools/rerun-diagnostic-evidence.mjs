/** Exactly three retained diagnostic cases; deliberately no population-loop interface. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import vm from 'node:vm';import assert from 'node:assert/strict';
import {createEvidenceEvaluator} from './evidence-pipeline.mjs';
const [base,output]=process.argv.slice(2);assert(base&&output);
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const evaluator=path.join(base,'tools-467459a/monitor-audit-evaluator.js');
assert.equal(hash(evaluator),'6da42c52ce9fafd375fd293cff4b3d10f26e4c66302eb557e295385b710e101c');
const ctx=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});vm.runInContext(fs.readFileSync(evaluator,'utf8'),ctx,{timeout:1000});
const adapter=createEvidenceEvaluator(ctx.MonitorAudit);
const cases=[[710,'pesopluma','9676659eb0e525d7757e9937391a57b248451d9601dbabd6ce287941c0e23575'],[596,'luismiguel','645ab3f2450f341a44b4440776bdb59767adae868cd1d9b56aef7003d6d843a2'],[662,'natanaelcano','3dda0c7a439afbf6375777a25703b2d6e652dac3522ac8c20e9f91d95312f282']];
assert(!fs.existsSync(output),'Never overwrite prior evidence');fs.mkdirSync(output,{recursive:true,mode:0o700});
const write=(name,v)=>{const f=path.join(output,name);fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{mode:0o600,flag:'wx'});return {path:f,sha256:hash(f)};};
const rows=[];
for(const [index,key,expected] of cases){
 const pairFile=path.join(base,'catalog-job1-results-v1',`evaluation-${index}.json`),pair=read(pairFile),input=pair.input.path;
 assert.equal(hash(input),expected);assert.equal(hash(input),pair.input.sha256);assert.equal(pair.candidate.artistKey,key);assert.equal(pair.index,index);
 const manifestFile=pair.catalogManifest.path;assert.equal(hash(manifestFile),pair.catalogManifest.sha256);
 const row=read(input),m=read(manifestFile);assert(m.fullCatalogApplied);assert.equal(m.artistKey,key);
 // The retained job1 manifest already records independently reconciled complete source tables.
 // Rehydrate only those exact items; no invented source completeness or provider requests.
 const documents=m.sources.map(source=>{const type=source.kind==='songs'?'track':'album',plural=type==='track'?'tracks':'albums',items=m.items.filter(i=>i.item_type===type);
  assert.equal(items.length,m.expected[plural]);assert.equal(items.length,m.observed[plural]);
  return {source,items,scope:'complete_captured_kworb_table_not_all_spotify_objects',sourceDate:m.sourceDates[plural],
   allRowsAccounted:m.fullCatalogApplied&&m.expected[plural]===m.observed[plural],expectedCount:m.expected[plural],observedCount:m.observed[plural]};});
 const before=JSON.parse(JSON.stringify(ctx.MonitorAudit.evaluateMonitoringCandidate(pair.candidate,structuredClone(row),new Date(pair.decision.auditedAt))));
 assert.equal(canonical(before),canonical(pair.decision),'Original replay drift: '+key);
 const options={documents,reference:input+'@sha256:'+expected};
 const after=adapter.evaluate(pair.candidate,row,pair.decision.auditedAt,options);
 assert.equal(canonical(after),canonical(adapter.evaluate(pair.candidate,row,pair.decision.auditedAt,options)),'Nondeterministic replay');
 assert.equal(hash(input),expected);assert.equal(canonical(row),canonical(read(input)),'Input mutated');
 const full=write(`evaluation-${index}.json`,{candidate:pair.candidate,before,after,sourceEvidence:{path:input,sha256:expected},catalogManifest:pair.catalogManifest});
 rows.push({index,artistKey:key,artistName:pair.candidate.artistName,auditedAt:after.auditedAt,full,
  before:{classification:before.classification,auditStatus:before.auditStatus,findings:before.findings},
  after:{classification:after.classification,auditStatus:after.auditStatus,findings:after.findings,evidencePipeline:after.evidencePipeline},
  removed:before.findings.filter(f=>!after.findings.some(a=>a.code===f.code)).map(f=>f.code),
  changed:before.findings.filter(f=>after.findings.some(a=>a.code===f.code&&a.status!==f.status)).map(f=>({code:f.code,before:f.status,after:after.findings.find(a=>a.code===f.code).status}))});
}
const report=write('comparison.json',{scope:'three_diagnostics_only',populationReplayed:false,providerRequests:0,databaseQueries:0,
 frozenEvaluatorSha256:hash(evaluator),originalReplaysExact:true,repeatedReplayExact:true,rows});
console.log(JSON.stringify(report));
