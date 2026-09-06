import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import vm from 'node:vm';import assert from 'node:assert/strict';
import {reconcileCatalogEvidence,CATALOG_CODES} from './catalog-evidence-reconciliation.mjs';
const [base,documentsFile,output]=process.argv.slice(2);assert(base&&documentsFile&&output);
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const originalExport=path.join(base,'roster-resume-a60c2af/exports/9319aa08-0170-4c9c-96c8-7197acb63cd7.json');
assert.equal(hash(originalExport),'d6a05e68264cf3f70450849433e6b702c131c60d224c245066498116f1a99b72');
const populationFile=path.join(base,'evidence-configured-467/configured_467459a_snapshot1/population.json');
assert.equal(hash(populationFile),'84d8cdfe12b187af43328eb946acebcda39149a9bb0aa8eeba3d91d7e70f9e4a');
const evaluator=path.join(base,'tools-467459a/monitor-audit-evaluator.js');assert.equal(hash(evaluator),'6da42c52ce9fafd375fd293cff4b3d10f26e4c66302eb557e295385b710e101c');
const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});vm.runInContext(fs.readFileSync(evaluator,'utf8'),context,{timeout:1000});
const evaluate=(c,r,date)=>JSON.parse(JSON.stringify(context.MonitorAudit.evaluateMonitoringCandidate(c,r,new Date(date))));
const before=read(originalExport),population=read(populationFile),documents=read(documentsFile).documents;
assert(!fs.existsSync(output),'Never overwrite prior reconciliation');fs.mkdirSync(output,{recursive:true,mode:0o700});
const write=(name,data)=>{const f=path.join(output,name);fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return {path:f,sha256:hash(f)}};
const rows=[],manifest=[],changes=[];
for(const saved of before.rows){
 if(saved.status!=='completed'){rows.push(saved);continue;}
 assert.equal(hash(saved.artifact),saved.sha256);const index=saved.index,candidate=population.candidates[index];
 let root=path.dirname(saved.artifact);const found=[];for(let i=0;i<4;i++){const f=path.join(root,'decoded',`evidence_${index}.json`);if(fs.existsSync(f))found.push(f);root=path.dirname(root);}assert.equal(found.length,1);
 const evidence=read(found[0]).rows[0],clock=saved.decision.auditedAt;
 const baseline=evaluate(candidate,evidence,clock);assert.equal(canonical(baseline),canonical(saved.decision),'Original evaluator replay drift at '+index);
 const reference=path.join(output,`catalog-${index}.json`),reconciled=reconcileCatalogEvidence(candidate,evidence,documents,reference);
 const decision=evaluate(candidate,reconciled.row,clock);
 // Other jobs cannot have a finding changed, even if overall classification remains unresolved.
 const other=d=>d.findings.filter(f=>!CATALOG_CODES.has(f.code));assert.equal(canonical(other(decision)),canonical(other(baseline)),'Unrelated finding changed at '+index);
 for(const key of Object.keys(evidence))if(!['stream_items','served_summary','source_evidence'].includes(key))assert.equal(canonical(reconciled.row[key]),canonical(evidence[key]));
 for(const key of Object.keys(evidence.source_evidence))assert.equal(canonical(reconciled.row.source_evidence[key]),canonical(evidence.source_evidence[key]));
 const proof=write(`catalog-${index}.json`,{...reconciled.manifest,index,originalEvidence:{path:found[0],sha256:hash(found[0])},documentsSha256:hash(documentsFile)});
 const input=write(`evidence-${index}.json`,reconciled.row),result=write(`evaluation-${index}.json`,{index,candidate,decision,input,originalEvaluation:{path:saved.artifact,sha256:saved.sha256},catalogManifest:proof});
 const removed=baseline.readinessReasons.filter(c=>!decision.readinessReasons.includes(c)),added=decision.readinessReasons.filter(c=>!baseline.readinessReasons.includes(c));
 changes.push({index,applied:reconciled.manifest.fullCatalogApplied,identityDeferred:reconciled.manifest.identityDeferred,removed,added,remaining:decision.readinessReasons});
 rows.push({index,status:'completed',artifact:result.path,sha256:result.sha256,decision});manifest.push({index,...proof,fullCatalogApplied:reconciled.manifest.fullCatalogApplied});
}
const full=write('evaluations.json',{...before,rows,job:'catalog_artwork_only',originalExportSha256:hash(originalExport),documentsSha256:hash(documentsFile)});
write('catalog-manifests.json',manifest);write('changes.json',changes);
const projection=write('projection.json',{sourceExport:{...full,bytes:fs.statSync(full.path).size,localCopy:false},rows:rows.map(v=>[v.index,v.status,v.decision?.classification??null,v.decision?.auditStatus??null,v.decision?.readinessReasons??[],v.decision?.auditedAt??null,v.reason??null]),changes,summary:{replayed:changes.length,applied:changes.filter(x=>x.applied).length,reduced:changes.filter(x=>x.removed.length).length,captureFailures:before.captureFailures,pending:0,otherJobFindingsUnchanged:true,originalReplaysExact:true}});
write('complete.json',{projection,full,originalExportSha256:hash(originalExport),populationSha256:hash(populationFile),evaluatorSha256:hash(evaluator)});
console.log(JSON.stringify({output,projection,full,summary:read(projection.path).summary}));
