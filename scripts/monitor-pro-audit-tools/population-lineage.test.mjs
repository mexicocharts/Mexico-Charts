import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createAuditReplay,canonicalCheckpointJson,md5Utf8,buildJsonChunkSql,CHECKPOINT_HASH_VERSION} from './replay.mjs';
import {sha256Utf8} from './sha256.mjs';
import {createPrivateAuditStorage} from './storage.mjs';
import {prepareAuditQueries} from './manifest-helper.mjs';
import {esbuildExecutable,repoRoot} from './paths.mjs';
const hash=value=>md5Utf8(canonicalCheckpointJson(value));
const csv=rows=>rows.map(row=>row.map(cell=>'"'+String(cell).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
const columns=['protocol','total_rows','payload_chars','payload_md5','chunk_start','chunk_chars','chunk'];
const frame=(rows,context)=>{const text=JSON.stringify(rows),chars=Array.from(text),chunk=context.chunkSize===null?text:chars.slice(context.chunkStart-1,context.chunkStart-1+context.chunkSize).join('');
  return {success:true,exitCode:0,exitReason:null,output:csv([columns,['monitor-audit-json-v1',rows.length,chars.length,md5Utf8(text),context.chunkStart,Array.from(chunk).length,chunk]])};};
function storage(){const values=new Map(),writes=[];return {values,writes,
  readText:async key=>values.get(key)??null,
  read:async key=>values.has(key)?JSON.parse(values.get(key)):null,
  persist:async(key,value)=>{values.set(key,typeof value==='string'?value:JSON.stringify(value)+'\n');writes.push(key);}};}
const evaluator={groupMonitoringCandidateIdentities:rows=>[...new Map(rows.map(row=>[row.artist_key,{artistKey:row.artist_key,artistName:row.artist_name??row.artist_key,sourceKeys:[row.artist_key],aliases:row.aliases??[]}])).values()],
  evaluateMonitoringCandidate:(candidate,row,now)=>({...candidate,auditedAt:now.toISOString(),classification:'B',auditStatus:'complete',publicEligible:false,readinessReasons:['new_evidence_only'],evidenceMarker:row.marker})};
function sourceManifest(revision){const rows=[{artist_key:'bundled',artist_name:'Bundled',source:'artist_profile_routes',spotify_id:null}];return {revision,readOnly:true,providerCalls:0,
  sourceTables:['artists'],emptySourceCtes:{artists:'artists AS (SELECT NULL::text artist_key WHERE false)'},
  queries:{schema:"SELECT 'artists' table_name, true present",population:'SELECT base_source',acceptedAliases:'SELECT alias_source',discovery:'SELECT discovery_source',transactionClockEvidence:'SELECT $1::jsonb request, now() audit_captured_at',fixedClockEvidence:'SELECT $1::jsonb request, $2::timestamptz audit_captured_at'},
  fixedClockAdaptation:{replacedNowCalls:1},bundledPopulation:{protocol:'monitor-audit-bundled-population-v1',revision,rows,rowsHashVersion:CHECKPOINT_HASH_VERSION,rowsMd5:hash(rows),
    sourceFiles:[{path:'roster.mjs',bytes:20,sha256:'c'.repeat(64),gitBlob:'d'.repeat(40)}],
    sourceInventory:[{source:'artist_profile_routes',rowCount:1,sourcePaths:['roster.mjs'],freshness:'bundled_source_revision'},
      {source:'supplemental_artist_data',rowCount:0,sourcePaths:['roster.mjs'],freshness:'bundled_source_revision'}],
    populationScope:'database_and_bundled_rosters',populationLimitations:['external_artist_metadata_active_uninspected','external_mexican_artist_master_uninspected']}};}
async function fixture({capture='digest_chunks',factory=createAuditReplay,legacy=false}={}){
  const saved=storage(),parentManifest=sourceManifest('parent_revision'),childManifest=sourceManifest('new_evidence_revision');
  childManifest.queries.transactionClockEvidence+=' /* changed evidence only */';
  const parentManifestText=JSON.stringify(parentManifest)+'\n',manifestText=JSON.stringify(childManifest)+'\n';
  const parentMetadata={runId:'parent_f4',revision:parentManifest.revision,sourceHash:sha256Utf8(parentManifestText),evaluatorHash:'a'.repeat(64),replayHash:'b'.repeat(64),databaseName:'fixture_db',now:'2026-09-06T12:00:00Z',clockMode:'evidence_transaction_timestamp'};
  const metadata={...parentMetadata,runId:'new_evidence',revision:childManifest.revision,sourceHash:sha256Utf8(manifestText),evaluatorHash:'c'.repeat(64),now:'2026-09-07T12:00:00Z'};
  const rows={population:[{artist_key:'alpha',aliases:['first','東京 😀']},{artist_key:'beta'}],accepted_aliases:[],discovery:[]};
  const sources=Object.entries({population:'population',accepted_aliases:'acceptedAliases',discovery:'discovery'}).map(([id,name])=>({id,capture,totalRows:rows[id].length,selectAll:()=>parentManifest.queries[name]}));
  const parentReplay=factory({evaluator,metadata:parentMetadata,...saved,chunkSize:31,execute:async(sql,context)=>frame(
    context.id==='schema_inventory'?[{table_name:'artists',present:true}]:context.id==='source_counts'?[{population:2,accepted_aliases:0,discovery:0}]:rows[context.id.replace(/_(digest_chunks|whole)$/,'')],context)});
  await parentReplay.captureRows({id:'schema_inventory',sql:parentManifest.queries.schema,expectedRows:1});
  await parentReplay.captureRows({id:'source_counts',sql:prepareAuditQueries(parentManifest,{missingTables:[],now:parentMetadata.now,clockMode:parentMetadata.clockMode}).sourceCounts,expectedRows:1});
  const parent=await parentReplay.collectPopulation({sources,bundledPopulation:parentManifest.bundledPopulation});
  if(legacy){for(const [key,text] of saved.values){if(!key.includes('/decoded/'))continue;const value=JSON.parse(text);delete value.normalizedRowsHashVersion;value.normalizedRowsMd5=md5Utf8(JSON.stringify(value.rows));saved.values.set(key,JSON.stringify(value)+'\n');}}
  const binding={runId:parentMetadata.runId,metadataSha256:sha256Utf8(await saved.readText('parent_f4/manifest.json')),
    populationSha256:sha256Utf8(await saved.readText('parent_f4/population.json')),candidatesMd5:hash(parent.candidates),manifestText:parentManifestText,chunkSize:31};
  metadata.populationBasis={kind:'inherited_verified_cohort',parentRunId:binding.runId,parentMetadataSha256:binding.metadataSha256,
    parentPopulationSha256:binding.populationSha256,parentCandidatesMd5:binding.candidatesMd5,parentSourceHash:parentMetadata.sourceHash,parentEvaluatorHash:parentMetadata.evaluatorHash};
  const executions=[];const execute=async(sql,context)=>{executions.push({sql,context});assert.ok(context.id.startsWith('evidence_'));
    const index=Number(context.id.split('_')[1]);return frame([{artist_key:parent.candidates[index].artistKey,audit_captured_at:'2026-09-08T15:16:17.123456Z',marker:'fresh_child_row'}],context);};
  return {saved,parent,parentMetadata,parentManifest,childManifest,metadata,manifestText,binding,executions,execute,
    child:()=>factory({evaluator,metadata,...saved,execute}),evidenceSql:prepareAuditQueries(childManifest,{missingTables:[],now:metadata.now,clockMode:metadata.clockMode}).evidence,request:()=>({parent:binding,manifestText})};
}

test('UTF8 SHA256 matches exact Node bytes including Unicode, replacement surrogates and block boundaries',()=>{
  for(const text of ['', 'abc','a'.repeat(55),'a'.repeat(56),'a'.repeat(64),'a'.repeat(10000),'東京 😀\n\uD800'])
    assert.equal(sha256Utf8(text),crypto.createHash('sha256').update(text).digest('hex'));
});

test('complete cohort inheritance preserves originals, order, independent captures and fresh evidence lineage across resume',async()=>{
  for(const legacy of [false,true]){
    const f=await fixture({legacy}),originals=new Map(f.saved.values),count=f.saved.writes.length;
    const population=await f.child().inheritPopulation(f.request());
    assert.equal(f.executions.length,0);assert.ok(f.saved.writes.slice(count).every(key=>key.startsWith('new_evidence/')));
    assert.deepEqual(population.candidates,f.parent.candidates);assert.deepEqual(population.pages,f.parent.pages);
    assert.deepEqual(population.bundledSourceProof,f.parent.bundledSourceProof);
    assert.equal(population.databasePopulationComplete,false);assert.equal(population.populationComplete,false);
    assert.equal(population.populationBasis.originalCaptureCoverage.databasePopulationComplete,true);
    assert.equal(population.populationBasis.originalCaptureCoverage.populationComplete,false);
    assert.equal(population.populationBasis.parentMetadata.now,'2026-09-06T12:00:00Z');
    assert.equal(population.populationBasis.sourceCaptureClock,'original_source_artifacts_only_no_new_capture');
    assert.equal(population.populationBasis.evidenceBasis.evaluatorHash,f.metadata.evaluatorHash);
    assert.ok(population.populationLimitations.includes('inherited_cohort_not_fresh_population'));
    for(const [key,text] of originals)assert.equal(await f.saved.readText(key),text);
    const writes=f.saved.writes.length;assert.deepEqual(await f.child().inheritPopulation(f.request()),population);assert.equal(f.saved.writes.length,writes);
    let report=await f.child().auditNext({population,evidenceSql:f.evidenceSql,maximumArtists:1});
    assert.equal(report.candidatesAudited,1);assert.equal(report.populationBasisMd5,hash(population.populationBasis));
    report=await f.child().auditNext({population,evidenceSql:f.evidenceSql,maximumArtists:25});
    assert.equal(report.candidatesAudited,3);assert.equal(f.executions.length,3);assert.equal(report.auditComplete,false);
    assert.match(f.saved.values.get('new_evidence/report.csv'),/populationFreshness/);
    assert.match(f.saved.values.get('new_evidence/report.csv'),/inherited_verified_cohort/);
    assert.equal(report.status,'requires_further_investigation');assert.equal(report.databasePopulationComplete,false);
    assert.deepEqual(report.populationLimitations,population.populationLimitations);
    const result=await f.saved.read('new_evidence/results/0.json');assert.equal(result.result.evidenceMarker,'fresh_child_row');
    assert.equal(result.result.auditedAt,'2026-09-08T15:16:17.123Z');assert.equal(result.populationBasisMd5,hash(population.populationBasis));
    await f.child().auditNext({population,evidenceSql:()=>{throw Error('No SQL');}});assert.equal(f.executions.length,3);
    for(const [key,text] of originals)assert.equal(await f.saved.readText(key),text);
  }
});

test('source SQL, inventory, empty schema, bundled file/hash/rows/order changes reject before SQL or child writes',async()=>{
  for(const kind of ['population','acceptedAliases','discovery','sourceTables','emptySourceCtes','bundle_hash','bundle_rows','bundle_file','bundle_inventory','missing_bundle']){
    const f=await fixture(),manifest=structuredClone(f.childManifest);
    if(['population','acceptedAliases','discovery'].includes(kind))manifest.queries[kind]+=' changed';
    if(kind==='sourceTables')manifest.sourceTables.push('new_source');
    if(kind==='emptySourceCtes')manifest.emptySourceCtes.artists+=' changed';
    if(kind==='bundle_hash')manifest.bundledPopulation.rowsMd5='0'.repeat(32);
    if(kind==='bundle_rows'){manifest.bundledPopulation.rows[0].artist_name='Changed';manifest.bundledPopulation.rowsMd5=hash(manifest.bundledPopulation.rows);}
    if(kind==='bundle_file')manifest.bundledPopulation.sourceFiles[0].sha256='0'.repeat(64);
    if(kind==='bundle_inventory')manifest.bundledPopulation.sourceInventory.reverse();
    if(kind==='missing_bundle')delete manifest.bundledPopulation;
    const manifestText=JSON.stringify(manifest),metadata={...f.metadata,sourceHash:sha256Utf8(manifestText)},before=f.saved.writes.length;
    await assert.rejects(createAuditReplay({evaluator,metadata,...f.saved,execute:f.execute}).inheritPopulation({parent:f.binding,manifestText}),/inputs changed/);
    assert.equal(f.executions.length,0);assert.equal(f.saved.writes.length,before,kind);
  }
});

test('parent candidate/metadata corruption, order changes, false completeness and missing raw bytes fail closed',async()=>{
  for(const kind of ['population_hash','metadata_hash','candidate_hash','schema_missing','count_changed','candidate_reorder','nested_array','raw_missing','raw_changed','decoded_changed','page_proof','complete','missing_schema','plans_order','same_run','manifest_text','database']){
    const f=await fixture(),request=f.request(),before=f.saved.writes.length;
    const change=(key,mutate)=>{const value=JSON.parse(f.saved.values.get(key));mutate(value);f.saved.values.set(key,JSON.stringify(value)+'\n');};
    if(kind==='population_hash')request.parent.populationSha256='0'.repeat(64);
    if(kind==='metadata_hash')request.parent.metadataSha256='0'.repeat(64);
    if(kind==='candidate_hash')request.parent.candidatesMd5='0'.repeat(32);
    if(kind==='schema_missing')f.saved.values.delete('parent_f4/raw/schema_inventory/full.json');
    if(kind==='count_changed')change('parent_f4/decoded/source_counts.json',value=>{value.rows[0].population=0;value.normalizedRowsMd5=hash(value.rows);});
    if(kind==='candidate_reorder')change('parent_f4/population.json',value=>value.candidates.reverse());
    if(kind==='nested_array')change('parent_f4/population.json',value=>value.candidates[0].aliases.reverse());
    if(kind==='raw_missing')f.saved.values.delete('parent_f4/raw/population_digest_chunks/32.json');
    if(kind==='raw_changed')change('parent_f4/raw/population_digest_chunks/32.json',value=>{value.rawResult.output+='x';});
    if(kind==='decoded_changed')change('parent_f4/decoded/population_digest_chunks.json',value=>{value.rows[0].artist_key='other';value.normalizedRowsMd5=hash(value.rows);});
    if(kind==='page_proof')change('parent_f4/population.json',value=>{value.pages[0].contentProof.totalRows=1;});
    if(kind==='complete')change('parent_f4/population.json',value=>{value.databasePopulationComplete=false;});
    if(kind==='missing_schema')change('parent_f4/population.json',value=>{value.missingSchemaTables=['artists'];});
    if(kind==='plans_order')change('parent_f4/population.json',value=>{value.sourcePlans.reverse();});
    if(kind==='same_run')request.parent.runId=f.metadata.runId;
    if(kind==='manifest_text')request.parent.manifestText+=' ';
    // Repin modified candidate artifacts to verify regrouping, not only a stale outer hash.
    if(['candidate_reorder','nested_array','page_proof','complete','missing_schema','plans_order'].includes(kind)){
      request.parent.populationSha256=sha256Utf8(await f.saved.readText('parent_f4/population.json'));
      request.parent.candidatesMd5=hash((await f.saved.read('parent_f4/population.json')).candidates);
    }
    const metadata=kind==='database'?{...f.metadata,databaseName:'other_db'}:structuredClone(f.metadata);
    // Repin the external run descriptor too: structural proof checks must still reject these.
    if(['candidate_reorder','nested_array','page_proof','complete','missing_schema','plans_order'].includes(kind)){
      metadata.populationBasis.parentPopulationSha256=request.parent.populationSha256;metadata.populationBasis.parentCandidatesMd5=request.parent.candidatesMd5;
    }
    await assert.rejects(createAuditReplay({evaluator,metadata,...f.saved,execute:f.execute}).inheritPopulation(request));
    assert.equal(f.executions.length,0);assert.equal(f.saved.writes.length,before,kind);
  }
});

test('inherited audit resume rejects swapped basis/candidate order and original-byte mutations before evidence',async()=>{
  for(const kind of ['basis','missing_basis','missing_basis_resume','candidate','parent_bytes','lineage','coherent_inventory_rewrite','coherent_scope_rewrite','old_evidence_sql','result_basis','report_basis']){
    const f=await fixture(),population=await f.child().inheritPopulation(f.request());
    if(['result_basis','report_basis','missing_basis_resume'].includes(kind))await f.child().auditNext({population,evidenceSql:f.evidenceSql,maximumArtists:1});
    const calls=f.executions.length;
    if(kind==='basis')population.populationBasis.parentRunId='different';
    if(kind==='missing_basis'||kind==='missing_basis_resume')delete population.populationBasis;
    if(kind==='candidate')population.candidates.reverse();
    if(kind==='parent_bytes')f.saved.values.set('parent_f4/manifest.json',f.saved.values.get('parent_f4/manifest.json')+' ');
    if(kind==='lineage'){const value=await f.saved.read('new_evidence/population-lineage.json');value.parentCandidatesMd5='0'.repeat(32);await f.saved.persist('new_evidence/population-lineage.json',value);}
    if(kind==='coherent_inventory_rewrite'){const lineage=await f.saved.read('new_evidence/population-lineage.json');
      lineage.parentArtifacts=lineage.parentArtifacts.filter(item=>!item.artifact.includes('/raw/'));
      population.populationBasis.lineageMd5=hash(lineage);await f.saved.persist('new_evidence/population-lineage.json',lineage);await f.saved.persist('new_evidence/population.json',population);}
    if(kind==='coherent_scope_rewrite'){population.pages[0].contentProof.payloadCharacters=1;await f.saved.persist('new_evidence/population.json',population);}
    if(kind==='result_basis'){const value=await f.saved.read('new_evidence/results/0.json');value.populationBasisMd5='0'.repeat(32);await f.saved.persist('new_evidence/results/0.json',value);
      f.saved.values.delete('new_evidence/report.json');}
    if(kind==='report_basis'){const value=await f.saved.read('new_evidence/report.json');value.populationBasisMd5='0'.repeat(32);await f.saved.persist('new_evidence/report.json',value);}
    await assert.rejects(f.child().auditNext({population,evidenceSql:kind==='old_evidence_sql'?()=> 'SELECT old evidence':f.evidenceSql}));assert.equal(f.executions.length,calls);
  }
});

test('new grouping changes reject, object key order remains equivalent, separate captures cannot be inherited',async()=>{
  const f=await fixture();const factory=()=>createAuditReplay({evaluator:{...evaluator,groupMonitoringCandidateIdentities:rows=>evaluator.groupMonitoringCandidateIdentities(rows).reverse()},metadata:f.metadata,...f.saved,execute:f.execute});
  await assert.rejects(factory().inheritPopulation(f.request()),/grouping differs/);
  const reordered=JSON.stringify(JSON.parse(f.manifestText),(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).reverse()):value);
  const reorderedMetadata={...f.metadata,sourceHash:sha256Utf8(reordered)};
  const value=await createAuditReplay({evaluator,metadata:reorderedMetadata,...f.saved,execute:f.execute}).inheritPopulation({parent:f.binding,manifestText:reordered});
  assert.equal(value.candidates.length,3);assert.equal(f.executions.length,0);
  await assert.rejects(f.child().collectPopulation({sources:[]}),/Inherited run metadata/);
});

test('host exact-byte reader preserves UTF8 and rejects symlinks and unsafe paths with existing guards',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'monitor-lineage-storage-'));
  try{const store=createPrivateAuditStorage(directory);await store.persist('run/file.json',{value:'東京 😀'});
    assert.equal(await store.readText('run/file.json'),'{"value":"東京 😀"}\n');assert.deepEqual(await store.read('run/file.json'),{value:'東京 😀'});
    fs.writeFileSync(path.join(directory,'invalid.json'),Buffer.from([0xff]));await assert.rejects(store.readText('invalid.json'),/valid UTF8/);
    fs.symlinkSync(path.join(directory,'run/file.json'),path.join(directory,'linked.json'));
    await assert.rejects(store.readText('linked.json'),/symlinks/);await assert.rejects(store.readText('../outside'),/Unsafe/);
    fs.symlinkSync(path.join(directory,'run'),path.join(directory,'linked-dir'));await assert.rejects(store.readText('linked-dir/file.json'),/symlinks/);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('browser IIFE inheritance runs without Node globals, implicit Date construction or Date.now',async()=>{
  const output=execFileSync(esbuildExecutable(),['scripts/monitor-pro-audit-tools/replay.mjs','--bundle','--platform=browser','--format=iife','--global-name=MonitorAuditReplay','--target=es2022','--tsconfig-raw={"compilerOptions":{"alwaysStrict":false}}'],{cwd:repoRoot,encoding:'utf8',maxBuffer:1024*1024});
  const NativeDate=Date;class ExplicitDate extends NativeDate{constructor(...args){if(!args.length)throw Error('implicit Date forbidden');super(...args);}static now(){throw Error('Date.now forbidden');}}
  const context=vm.createContext({Date:ExplicitDate});vm.runInContext(output,context);
  assert.equal(vm.runInContext('typeof process+typeof Buffer+typeof TextEncoder+typeof require',context),'undefinedundefinedundefinedundefined');
  const f=await fixture({factory:context.MonitorAuditReplay.createAuditReplay}),population=await f.child().inheritPopulation(f.request());
  const report=await f.child().auditNext({population,evidenceSql:f.evidenceSql,maximumArtists:25});
  assert.equal(report.candidatesAudited,3);assert.equal(report.auditComplete,false);assert.equal(f.executions.length,3);
});

const postgresModule=process.env.MONITOR_HISTORY_PGLITE_MODULE;
test('PostgreSQL complete digest frames retain overlapping identities, empty arrays and source order on inherited audit',{skip:!postgresModule},async()=>{
  const {PGlite}=await import(postgresModule),db=new PGlite();
  try{
    const f=await fixture({capture:'whole'}),manifest=structuredClone(f.parentManifest);
    manifest.queries.population=`SELECT * FROM (VALUES ('alpha','["Z","東京 😀"]'::jsonb),('beta','[]'::jsonb)) s(artist_key,aliases)`;
    manifest.queries.acceptedAliases=`SELECT 'alpha' artist_key, '["Z","東京 😀"]'::jsonb aliases`;
    manifest.queries.discovery=`SELECT NULL::text artist_key WHERE false`;
    const manifestText=JSON.stringify(manifest),parentMetadata={...f.parentMetadata,sourceHash:sha256Utf8(manifestText)};
    const saved=storage();const execute=async(sql)=>{const result=await db.query(sql),keys=Object.keys(result.rows[0]);return {success:true,exitCode:0,exitReason:null,output:csv([keys,...result.rows.map(row=>keys.map(key=>row[key]))])};};
    const original=createAuditReplay({evaluator,metadata:parentMetadata,...saved,chunkSize:41,execute});
    await original.captureRows({id:'schema_inventory',sql:manifest.queries.schema,expectedRows:1});
    await original.captureRows({id:'source_counts',sql:prepareAuditQueries(manifest,{missingTables:[],now:parentMetadata.now,clockMode:parentMetadata.clockMode}).sourceCounts,expectedRows:1});
    const population=await original.collectPopulation({bundledPopulation:manifest.bundledPopulation,
      sources:Object.entries({population:['population',2],accepted_aliases:['acceptedAliases',1],discovery:['discovery',0]}).map(([id,[key,totalRows]])=>({id,totalRows,capture:'digest_chunks',selectAll:()=>manifest.queries[key]}))});
    const nextManifest={...manifest,revision:'next_revision',bundledPopulation:{...manifest.bundledPopulation,revision:'next_revision'}},nextText=JSON.stringify(nextManifest);
    const nextMetadata={...f.metadata,revision:'next_revision',sourceHash:sha256Utf8(nextText),populationBasis:{kind:'inherited_verified_cohort',parentRunId:'parent_f4',
      parentMetadataSha256:sha256Utf8(await saved.readText('parent_f4/manifest.json')),parentPopulationSha256:sha256Utf8(await saved.readText('parent_f4/population.json')),
      parentCandidatesMd5:hash(population.candidates),parentSourceHash:parentMetadata.sourceHash,parentEvaluatorHash:parentMetadata.evaluatorHash}};let queries=0;
    const child=createAuditReplay({evaluator,metadata:nextMetadata,...saved,execute:async()=>{queries++;throw Error('no SQL');}});
    const inherited=await child.inheritPopulation({manifestText:nextText,parent:{runId:'parent_f4',metadataSha256:sha256Utf8(await saved.readText('parent_f4/manifest.json')),
      populationSha256:sha256Utf8(await saved.readText('parent_f4/population.json')),candidatesMd5:hash(population.candidates),manifestText,chunkSize:41}});
    assert.equal(queries,0);assert.deepEqual(inherited.candidates.map(row=>row.artistKey),['alpha','beta','bundled']);
    assert.deepEqual(inherited.candidates[0].aliases,['Z','東京 😀']);assert.equal(inherited.rawRows,4);assert.equal(inherited.populationComplete,false);
  }finally{await db.close();}
});
