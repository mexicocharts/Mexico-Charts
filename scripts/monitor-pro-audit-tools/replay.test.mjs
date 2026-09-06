import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {toolDirectory,esbuildExecutable} from './paths.mjs';
import {prepareAuditQueries} from './manifest-helper.mjs';
import { parseRfc4180Csv, decodeReplitCsv, md5Utf8, createAuditReplay, buildJsonChunkSql, canonicalCheckpointJson, CHECKPOINT_HASH_VERSION } from './replay.mjs';
const columns = ['protocol','total_rows','payload_chars','payload_md5','chunk_start','chunk_chars','chunk'];
const csv = rows => rows.map(row => row.map(value => '"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
const raw = output => ({exitCode:0,exitReason:null,output,success:true});
const metadata = {runId:'test_run',revision:'reviewed_revision',sourceHash:'reviewed_source_hash',evaluatorHash:'reviewed_evaluator_hash',now:'2026-09-06T12:00:00Z',clockMode:'run_fixed'};
const retryImplementation={revision:'a'.repeat(40),sha256:'b'.repeat(64)};
const failedEnvelope={success:false,exitCode:1,exitReason:'EXECUTE_SQL_COMMAND_ERROR',output:'exitCode=null exitReason=signal stderr='};
const candidate = (key) => ({artistKey:key,artistName:key,sourceKeys:[key]});
const evaluator = {
  groupMonitoringCandidateIdentities: rows => rows.map(row => candidate(row.artist_key)),
  evaluateMonitoringCandidate: (artist,row,now) => ({...artist,auditedAt:now.toISOString(),classification:row.missing_schema_tables.length ? null : 'C',
    auditStatus:row.missing_schema_tables.length ? 'incomplete' : 'complete',publicEligible:false,readinessReasons:['fixture_blocker']})
};
function memory() {
  const values = new Map(), writes=[];
  return {values,writes,read:async key => values.get(key) ?? null,persist:async (key,value) => {values.set(key,structuredClone(value));writes.push(key);}};
}
function framed(rows, context) {
  const payload=JSON.stringify(rows), chars=Array.from(payload), part=context.chunkSize===null ? payload : chars.slice(context.chunkStart-1,context.chunkStart-1+context.chunkSize).join('');
  return raw(csv([columns,['monitor-audit-json-v1',rows.length,chars.length,md5Utf8(payload),context.chunkStart,Array.from(part).length,part]]));
}
function reordered(value) {
  return Array.isArray(value)?value.map(reordered):value!==null&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().reverse().map(key=>[key,reordered(value[key])])):value;
}
function legacyCheckpoints(storage,population) {
  for(const [key,saved] of storage.values){
    if(key.includes('/decoded/')){
      const frames=[...storage.values.entries()].filter(([rawKey,value])=>rawKey.includes('/raw/')&&value.id===key.split('/').at(-1).replace('.json',''))
        .map(([,value])=>decodeReplitCsv(value.rawResult,{expectedColumns:columns,expectedRows:1})[0]).sort((a,b)=>Number(a.chunk_start)-Number(b.chunk_start));
      const originalRows=JSON.parse(frames.map(value=>value.chunk).join(''));
      saved.normalizedRowsMd5=md5Utf8(JSON.stringify(originalRows));delete saved.normalizedRowsHashVersion;
    }
    if(key.includes('/results/')){
      const index=Number(key.split('/').at(-1).replace('.json',''));
      saved.candidateMd5=md5Utf8(JSON.stringify(population.candidates[index]));delete saved.candidateHashVersion;delete saved.resultMd5;
    }
    if(key.endsWith('/report.json')){
      saved.populationMd5=md5Utf8(JSON.stringify(population.candidates));
      delete saved.populationHashVersion;delete saved.artistsMd5;delete saved.checkpointArtifact;
    }
  }
}

function bundledFixture() {
  const rows=[{artist_key:'alpha',artist_name:'Alpha route',source:'artist_profile_routes',spotify_id:null},
    {artist_key:'bravo',artist_name:'Bravo',source:'artist_profile_routes',spotify_id:null},
    {artist_key:'bravo',artist_name:'Bravo supplemental',source:'supplemental_artist_data',spotify_id:null}];
  return {protocol:'monitor-audit-bundled-population-v1',revision:metadata.revision,rows,
    rowsHashVersion:CHECKPOINT_HASH_VERSION,rowsMd5:md5Utf8(canonicalCheckpointJson(rows)),
    sourceFiles:[{path:'roster/routes.mjs',bytes:42,gitBlob:'a'.repeat(40),sha256:'b'.repeat(64)}],
    sourceInventory:[{source:'artist_profile_routes',rowCount:2,sourcePaths:['roster/routes.mjs'],freshness:'bundled_source_revision'},
      {source:'supplemental_artist_data',rowCount:1,sourcePaths:['roster/routes.mjs'],freshness:'bundled_source_revision'}],
    populationScope:'database_and_bundled_rosters',populationLimitations:['external_artist_metadata_active_uninspected','external_mexican_artist_master_uninspected']};
}

test('bundled manifest rows are explicit durable non-SQL inputs with scoped completeness and immutable resumes',async()=>{
  const storage=memory();let queries=0;
  const grouped={...evaluator,groupMonitoringCandidateIdentities:rows=>[...new Set(rows.map(row=>row.artist_key))].map(candidate)};
  const args={evaluator:grouped,metadata,...storage,execute:async(sql,context)=>{queries++;return framed([{artist_key:'alpha'}],context);}};
  const plan={sources:[{id:'base',capture:'whole',totalRows:1,selectAll:()=> 'SELECT source'}],bundledPopulation:bundledFixture()};
  const population=await createAuditReplay(args).collectPopulation(plan);
  assert.equal(queries,1);assert.equal(population.rawRows,4);assert.equal(population.databaseRawRows,1);
  assert.equal(population.databasePopulationComplete,true);assert.equal(population.populationComplete,false);
  assert.deepEqual(population.candidates.map(row=>row.artistKey),['alpha','bravo']);
  assert.equal(population.bundledSourceProof.rows,3);assert.equal(population.pages.length,1);
  assert.deepEqual(await storage.read('test_run/bundled/population.json'),{sourceHash:metadata.sourceHash,...plan.bundledPopulation});
  const writes=storage.writes.length;
  assert.deepEqual(await createAuditReplay(args).collectPopulation({...plan,bundledPopulation:reordered(plan.bundledPopulation)}),population);
  assert.equal(queries,1);assert.equal(storage.writes.length,writes);
  const report=await createAuditReplay({...args,execute:async(sql,context)=>framed([{artist_key:context.id==='evidence_0'?'alpha':'bravo'}],context)})
    .auditNext({population,evidenceSql:()=> 'SELECT evidence',maximumArtists:2});
  assert.equal(report.candidatesAudited,2);assert.equal(report.databasePopulationComplete,true);assert.equal(report.auditComplete,false);
  assert.deepEqual(report.populationLimitations,plan.bundledPopulation.populationLimitations);
  const changed=structuredClone(plan.bundledPopulation);changed.rows[0].artist_name='Changed';changed.rowsMd5=md5Utf8(canonicalCheckpointJson(changed.rows));
  await assert.rejects(createAuditReplay(args).collectPopulation({...plan,bundledPopulation:changed}),/Bundled population checkpoint mismatch/);
});

test('bundled provenance, row checksums, source counts and untrusted relationship fields fail before SQL',async()=>{
  for(const mutate of [value=>{value.revision='different';},value=>{value.rows[0].artist_name='Changed';},
    value=>{value.rows[0].spotify_id='a'.repeat(22);value.rowsMd5=md5Utf8(canonicalCheckpointJson(value.rows));},
    value=>{value.rows[0].declared_aliases=['unrelated'];value.rowsMd5=md5Utf8(canonicalCheckpointJson(value.rows));},
    value=>{value.sourceFiles[0].sha256='';},value=>{value.sourceFiles[0].path='../outside';},
    value=>{value.sourceInventory[0].rowCount=1;},value=>{value.populationLimitations=[];}]){
    const storage=memory(),bundledPopulation=bundledFixture();mutate(bundledPopulation);let queries=0;
    await assert.rejects(createAuditReplay({evaluator,metadata,...storage,execute:async()=>{queries++;throw Error('must not query');}})
      .collectPopulation({sources:[{id:'base',capture:'whole',totalRows:0,selectAll:()=> 'SELECT source'}],bundledPopulation}));
    assert.equal(queries,0);assert.equal(storage.writes.length,0);
  }
});

test('canonical internal JSON sorts object keys only and retains every JSON value boundary',()=>{
  const value={z:[{b:null,a:'東京 😀'},['b','a']],a:{n:1,s:'1',flag:false}};
  assert.equal(canonicalCheckpointJson(value),canonicalCheckpointJson(reordered(value)));
  for(const changed of [{...value,z:[['b','a'],{b:null,a:'東京 😀'}]}, {...value,a:{...value.a,n:'1'}},
    {...value,a:{...value.a,flag:null}}, {...value,a:{s:'1',flag:false}}, {...value,z:[{b:'null',a:'東京 😀'},['b','a']]}])
    assert.notEqual(canonicalCheckpointJson(changed),canonicalCheckpointJson(value));
  assert.notEqual(canonicalCheckpointJson({a:null}),canonicalCheckpointJson({}));
  for(const invalid of [NaN,Infinity,undefined,[undefined],new Array(2),new Date(),{a:()=>0}])assert.throws(()=>canonicalCheckpointJson(invalid));
});

test('reordered host metadata, implementation, decoded rows, candidates, results and reports resume without extra reads',async()=>{
  const storage=memory();let queries=0,evaluations=0,interrupt=true;
  const persist=async(key,value)=>{await storage.persist(key,reordered(value));if(interrupt&&key.includes('/results/')){interrupt=false;throw Error('stopped after result');}};
  const counted={...evaluator,evaluateMonitoringCandidate:(...args)=>{evaluations++;return evaluator.evaluateMonitoringCandidate(...args);}};
  const execute=async(sql,context)=>{queries++;return framed([{artist_key:'alpha',nested:{b:2,a:1},declared_aliases:[]}],context);};
  const args={evaluator:counted,metadata,persist,read:storage.read,execute,failedToolRetries:1,replayImplementation:retryImplementation};
  const plan={sources:[{id:'base',capture:'whole',totalRows:1,selectAll:()=> 'SELECT source'}]};
  await createAuditReplay(args).collectPopulation(plan);
  const population=await storage.read('test_run/population.json');
  await assert.rejects(createAuditReplay(args).auditNext({population,evidenceSql:()=> 'SELECT evidence'}),/stopped after result/);
  let report=await createAuditReplay(args).auditNext({population:reordered(population),evidenceSql:()=> 'SELECT evidence'});
  assert.equal(report.auditComplete,true);assert.equal(queries,2);assert.equal(evaluations,1);
  report=await createAuditReplay(args).auditNext({population:reordered(population),evidenceSql:()=> 'SELECT evidence'});
  assert.equal(report.candidatesAudited,1);assert.equal(queries,2);assert.equal(evaluations,1);
  assert.equal((await storage.read('test_run/decoded/base_whole.json')).normalizedRowsHashVersion,CHECKPOINT_HASH_VERSION);
  assert.equal((await storage.read('test_run/results/0.json')).candidateHashVersion,CHECKPOINT_HASH_VERSION);
  assert.equal((await storage.read('test_run/report.json')).populationHashVersion,CHECKPOINT_HASH_VERSION);
});

test('legacy object-key recovery validates complete original raw frames and preserves every original checkpoint',async()=>{
  for(const chunked of [false,true]){
    const storage=memory(),rows=[{population:8317,accepted_aliases:406,discovery:81,nested:{z:[],a:['東京 😀',{z:2,a:1}]}}];
    const request={id:'source_counts',sql:'SELECT counts',expectedRows:1,chunked};
    await createAuditReplay({evaluator,metadata,...storage,chunkSize:17,execute:async(sql,context)=>framed(rows,context)}).captureRows(request);
    legacyCheckpoints(storage);
    for(const [key,value] of storage.values)storage.values.set(key,reordered(value));
    const originals=new Map([...storage.values].map(([key,value])=>[key,structuredClone(value)]));let queries=0;
    const options={evaluator,metadata:reordered(metadata),...storage,chunkSize:17,execute:async()=>{queries++;throw Error('must not query');}};
    assert.deepEqual(await createAuditReplay(options).captureRows(request),rows);assert.equal(queries,0);
    const recoveryKey='test_run/canonical-checkpoints/'+CHECKPOINT_HASH_VERSION+'/decoded/source_counts.json';
    const recovery=await storage.read(recoveryKey);
    assert.equal(recovery.normalizedRowsHashVersion,CHECKPOINT_HASH_VERSION);
    assert.equal(recovery.legacyRecovery.rawVerification,'complete_original_frames');
    assert.equal(recovery.payloadMd5,originals.get('test_run/decoded/source_counts.json').payloadMd5);
    for(const [key,value] of originals)assert.deepEqual(await storage.read(key),value);
    const writes=storage.writes.length;
    assert.deepEqual(await createAuditReplay(options).captureRows(request),rows);assert.equal(storage.writes.length,writes);assert.equal(queries,0);
  }
});

test('retained production source-count ordering reproduces the reported legacy mismatch and recovers without SQL',async()=>{
  const storage=memory(),payload='[{"discovery": 81, "population": 8317, "accepted_aliases": 406}]';
  assert.equal(payload.length,64);assert.equal(md5Utf8(payload),'a81d378990f113ed7fa41ceda4f3b360');
  assert.equal(md5Utf8(JSON.stringify(JSON.parse(payload))),'d676671764fe53bb06a4eef025c0e47d');
  const request={id:'source_counts',sql:'SELECT source_count_fixture',expectedRows:1};
  const envelope=raw(csv([columns,['monitor-audit-json-v1',1,64,md5Utf8(payload),1,64,payload]]));
  await createAuditReplay({evaluator,metadata,...storage,execute:async()=>envelope}).captureRows(request);
  legacyCheckpoints(storage);
  const decoded=storage.values.get('test_run/decoded/source_counts.json');
  decoded.rows=[{accepted_aliases:406,discovery:81,population:8317}];
  assert.equal(md5Utf8(JSON.stringify(decoded.rows)),'ed7218c4f3c8d1c0d86127ac27189bbf');
  let calls=0;
  const rows=await createAuditReplay({evaluator,metadata,...storage,execute:async()=>{calls++;throw Error('no SQL');}}).captureRows(request);
  assert.deepEqual(rows,JSON.parse(payload));assert.equal(calls,0);
  assert.equal(decoded.normalizedRowsMd5,'d676671764fe53bb06a4eef025c0e47d');
});

test('legacy normalization rejects changed values, types, array order, requests, missing frames and unsupported hashes without SQL',async()=>{
  for(const kind of ['value','type','array','missing_field','null','missing_raw','truncated','raw_digest','raw_sql','raw_id','legacy_hash','unknown_version','missing_chunk']){
    const storage=memory(),rows=[{artist_key:'alpha',nested:{value:1,nullable:null,aliases:['Z','東京 😀']}}];
    const chunked=kind==='missing_chunk',request={id:'checked',sql:'SELECT source',expectedRows:1,chunked};
    await createAuditReplay({evaluator,metadata,...storage,chunkSize:17,execute:async(sql,context)=>framed(rows,context)}).captureRows(request);
    legacyCheckpoints(storage);for(const [key,value] of storage.values)storage.values.set(key,reordered(value));
    const decoded=storage.values.get('test_run/decoded/checked.json'),rawKey='test_run/raw/checked/'+(chunked?'18':'full')+'.json';
    if(kind==='value')decoded.rows[0].nested.value=2;
    if(kind==='type')decoded.rows[0].nested.value='1';
    if(kind==='array')decoded.rows[0].nested.aliases.reverse();
    if(kind==='missing_field')delete decoded.rows[0].nested.nullable;
    if(kind==='null')decoded.rows[0].nested.value=null;
    if(kind==='missing_raw'||kind==='missing_chunk')storage.values.delete(rawKey);
    if(kind==='truncated')storage.values.get(rawKey).rawResult.truncated=true;
    if(kind==='raw_digest')storage.values.get(rawKey).rawResult.output=storage.values.get(rawKey).rawResult.output.replace(md5Utf8(JSON.stringify(rows)),'0'.repeat(32));
    if(kind==='raw_sql')storage.values.get(rawKey).sql='SELECT other source';
    if(kind==='raw_id')storage.values.get(rawKey).id='another';
    if(kind==='legacy_hash')decoded.normalizedRowsMd5='0'.repeat(32);
    if(kind==='unknown_version')decoded.normalizedRowsHashVersion='unreviewed_version';
    let queries=0;
    await assert.rejects(createAuditReplay({evaluator,metadata,...storage,chunkSize:17,execute:async()=>{queries++;throw Error('must not query');}}).captureRows(request),undefined,kind);
    assert.equal(queries,0,kind);assert.ok(!storage.writes.some(key=>key.includes('/canonical-checkpoints/')),kind);
  }
});

test('legacy reordered candidate and report hashes migrate through verified population and evidence without relabeling originals',async()=>{
  const storage=memory(),source=[{artist_key:'alpha'},{artist_key:'beta'}];
  const execute=async(sql,context)=>framed(context.id==='base_whole'?source:[{artist_key:context.id==='evidence_0'?'alpha':'beta'}],context);
  const initial=createAuditReplay({evaluator,metadata,...storage,execute});
  const population=await initial.collectPopulation({sources:[{id:'base',capture:'whole',totalRows:2,selectAll:()=> 'SELECT source'}]});
  await initial.auditNext({population,evidenceSql:artist=>'SELECT '+artist.artistKey,maximumArtists:2});
  legacyCheckpoints(storage,population);for(const [key,value] of storage.values)storage.values.set(key,reordered(value));
  const originals=new Map([...storage.values].map(([key,value])=>[key,structuredClone(value)]));let queries=0;
  const args={evaluator,metadata:reordered(metadata),...storage,execute:async()=>{queries++;throw Error('must not query');}};
  const report=await createAuditReplay(args).auditNext({population:await storage.read('test_run/population.json'),evidenceSql:artist=>'SELECT '+artist.artistKey,maximumArtists:2});
  assert.equal(report.auditComplete,true);assert.equal(report.candidatesAudited,2);assert.equal(queries,0);
  assert.equal(report.checkpointArtifact,'test_run/canonical-checkpoints/'+CHECKPOINT_HASH_VERSION+'/report.json');
  for(const [key,value] of originals)assert.deepEqual(await storage.read(key),value,'original remains immutable: '+key);
  const again=await createAuditReplay(args).auditNext({population:await storage.read('test_run/population.json'),evidenceSql:artist=>'SELECT '+artist.artistKey});
  assert.equal(again.auditComplete,true);assert.equal(queries,0);
});

test('collectPopulation reuses a reordered legacy population without rewriting it and rejects substantive changes',async()=>{
  const storage=memory(),plan={sources:[{id:'base',capture:'whole',totalRows:1,selectAll:()=> 'SELECT source'}]};
  const population=await createAuditReplay({evaluator,metadata,...storage,execute:async(sql,context)=>framed([{artist_key:'alpha'}],context)}).collectPopulation(plan);
  legacyCheckpoints(storage,population);for(const [key,value] of storage.values)storage.values.set(key,reordered(value));
  const original=structuredClone(await storage.read('test_run/population.json')),writes=storage.writes.filter(key=>key==='test_run/population.json').length;
  let queries=0;const args={evaluator,metadata,...storage,execute:async()=>{queries++;throw Error('must not query');}};
  assert.deepEqual(await createAuditReplay(args).collectPopulation(plan),original);
  assert.equal(storage.writes.filter(key=>key==='test_run/population.json').length,writes);
  assert.deepEqual(await storage.read('test_run/population.json'),original);assert.equal(queries,0);
  storage.values.get('test_run/population.json').candidates[0].artistName='changed';
  await assert.rejects(createAuditReplay(args).collectPopulation(plan),/Existing population checkpoint differs/);
  assert.equal(storage.writes.filter(key=>key==='test_run/population.json').length,writes);assert.equal(queries,0);
});

test('legacy report migration rejects changed candidates, results, prefix facts and missing evidence without production reads',async()=>{
  for(const kind of ['candidate_name','candidate_array','report_value','report_hash','result_value','result_hash','missing_evidence','raw_evidence','unknown_result_version']){
    const storage=memory();
    const first=createAuditReplay({evaluator,metadata,...storage,execute:async(sql,context)=>framed([{artist_key:'alpha'}],context)});
    const population=await first.collectPopulation({sources:[{id:'base',capture:'whole',totalRows:1,selectAll:()=> 'SELECT source'}]});
    await first.auditNext({population,evidenceSql:()=> 'SELECT evidence'});
    legacyCheckpoints(storage,population);for(const [key,value] of storage.values)storage.values.set(key,reordered(value));
    const changedPopulation=await storage.read('test_run/population.json'),report=await storage.read('test_run/report.json'),result=await storage.read('test_run/results/0.json');
    if(kind==='candidate_name')changedPopulation.candidates[0].artistName='Another Artist';
    if(kind==='candidate_array')changedPopulation.candidates[0].sourceKeys.push('unrelated');
    if(kind==='report_value')report.artists[0].classification='A';
    if(kind==='report_hash')report.populationMd5='0'.repeat(32);
    if(kind==='result_value')result.result.classification='A';
    if(kind==='result_hash')result.candidateMd5='0'.repeat(32);
    if(kind==='missing_evidence')storage.values.delete('test_run/raw/evidence_0/full.json');
    if(kind==='raw_evidence')storage.values.get('test_run/raw/evidence_0/full.json').rawResult.output='START TRANSACTION\nROLLBACK\n';
    if(kind==='unknown_result_version')result.candidateHashVersion='unreviewed';
    let queries=0;
    await assert.rejects(createAuditReplay({evaluator,metadata,...storage,execute:async()=>{queries++;throw Error('must not query');}})
      .auditNext({population:changedPopulation,evidenceSql:()=> 'SELECT evidence'}),undefined,kind);
    assert.equal(queries,0,kind);assert.equal(await storage.read('test_run/canonical-checkpoints/'+CHECKPOINT_HASH_VERSION+'/report.json'),null,kind);
  }
});
test('strict CSV retains nested empty arrays, quoted commas and embedded CRLF without invented aliases', () => {
  const rows=[['aliases','evidence'],['[]',JSON.stringify({nested:[[],{text:'line one\r\nline "two",東京 😀'}]})]];
  const decoded=decodeReplitCsv(raw(csv(rows)),{expectedColumns:['aliases','evidence'],expectedRows:1,jsonColumns:{aliases:'array',evidence:'object'}});
  assert.deepEqual(decoded,[{aliases:[],evidence:{nested:[[],{text:'line one\r\nline "two",東京 😀'}]}}]);
  assert.deepEqual(parseRfc4180Csv('a,b\r\n"",last'),[['a','b'],['','last']]);
  for(const value of ['a\n"unterminated','a\n"closed"junk','a,b\nx','a\nbare"quote','a\nbare\r']) assert.throws(()=>parseRfc4180Csv(value));
  assert.throws(()=>decodeReplitCsv(raw('a\n"[]"'),{expectedRows:2}));
  assert.throws(()=>decodeReplitCsv({...raw('a\nx'),truncated:true}));
  assert.throws(()=>decodeReplitCsv({...raw('a\nx'),exitCode:1}));
});
test('pure UTF8 MD5 agrees with PostgreSQL-compatible digest including multibyte boundaries',()=>{
  for(const text of ['', 'abc', '東京 😀\r\nMéxico', '\ud800', ...Array.from({length:140},(_,i)=>'x'.repeat(i))])
    assert.equal(md5Utf8(text),crypto.createHash('md5').update(text).digest('hex'));
});
test('default one-response capture checkpoints raw before decode and reuses it after interruption',async()=>{
  const storage=memory();let queries=0, interrupt=true;
  const execute=async(sql,context)=>{queries++;assert.equal(context.chunkSize,null);return framed([{artist_key:'artist',declared_aliases:[],payload:'😀'.repeat(20000)}],context);};
  const persist=async(key,value)=>{await storage.persist(key,value);if(interrupt&&key.includes('/raw/')){interrupt=false;throw new Error('simulated shutdown after durable raw write');}};
  const args={evaluator,metadata,execute,persist,read:storage.read};
  await assert.rejects(createAuditReplay(args).captureRows({id:'artist',sql:'SELECT source',expectedRows:1}),/simulated shutdown/);
  assert.equal(queries,1);assert.ok(!storage.writes.some(key=>key.includes('/decoded/')));
  const rows=await createAuditReplay({...args,persist:storage.persist}).captureRows({id:'artist',sql:'SELECT source',expectedRows:1});
  assert.equal(queries,1);assert.deepEqual(rows[0].declared_aliases,[]);assert.equal(rows[0].payload.length,40000);
});
test('framing rejects silent truncation, corruption, incorrect artist counts and changing chunks',async()=>{
  for(const mutate of [
    value=>({...value,output:value.output.slice(0,-5)}),
    value=>({...value,output:value.output.replace('artist','artisx')}),
    value=>({...value,output:value.output.replace('monitor-audit-json-v1','wrong-version')}),
    value=>({...value,output:'START TRANSACTION\nROLLBACK\n'})
  ]){
    const storage=memory();const replay=createAuditReplay({evaluator,metadata,...storage,execute:async(sql,context)=>mutate(framed([{artist_key:'artist'}],context))});
    await assert.rejects(replay.captureRows({id:'bad',sql:'SELECT source',expectedRows:1}));
    assert.ok(storage.writes.some(key=>key.includes('/raw/')));assert.ok(!storage.writes.some(key=>key.includes('/decoded/')));
  }
  const storage=memory();let calls=0;
  const replay=createAuditReplay({evaluator,metadata,...storage,chunkSize:12,execute:async(sql,context)=>framed([{artist_key:++calls===1?'first artist':'other artist'}],context)});
  await assert.rejects(replay.captureRows({id:'changing',sql:'SELECT source',expectedRows:1,chunked:true}),/changed between chunks/);
  assert.equal(calls,2);
});
test('bounded population and per-artist restart produce no duplicate queries or report rows',async()=>{
  const storage=memory(), queried=[];
  const execute=async(sql,context)=>{queried.push(context.id);let rows;
    if(context.id==='base_0')rows=[{artist_key:'alpha',declared_aliases:[]}];
    else if(context.id==='base_1')rows=[{artist_key:'beta',declared_aliases:[]}];
    else rows=[{artist_key:context.id==='evidence_0'?'alpha':'beta'}];
    return framed(rows,context);
  };
  let replay=createAuditReplay({evaluator,metadata,...storage,execute});
  const plan={sources:[{id:'base',totalRows:2,pageSize:1,selectPage:({offset})=>'SELECT source OFFSET '+offset}]};
  const population=await replay.collectPopulation(plan);
  let report=await replay.auditNext({population,evidenceSql:artist=>'SELECT '+artist.artistKey});
  assert.equal(report.candidatesAudited,1);assert.equal(report.status,'in_progress');
  replay=createAuditReplay({evaluator,metadata,...storage,execute});
  assert.deepEqual(await replay.collectPopulation(plan),population);
  report=await replay.auditNext({population,evidenceSql:artist=>'SELECT '+artist.artistKey});
  assert.equal(report.candidatesAudited,2);assert.equal(report.auditComplete,false);
  assert.deepEqual(population.populationLimitations,['paged_selects_without_shared_snapshot']);
  report=await replay.auditNext({population,evidenceSql:artist=>'SELECT '+artist.artistKey});
  assert.equal(report.candidatesAudited,2);assert.deepEqual(queried,['base_0','base_1','evidence_0','evidence_1']);
  assert.equal(parseRfc4180Csv(storage.values.get('test_run/report.csv')).length,3);
  assert.ok(storage.writes.indexOf('test_run/raw/evidence_0/full.json') < storage.writes.indexOf('test_run/results/0.json'));
  const mismatched=createAuditReplay({evaluator,metadata:{...metadata,revision:'other_revision'},...storage,execute});
  await assert.rejects(mismatched.captureRows({id:'base_0',sql:'SELECT source OFFSET 0',expectedRows:1}),/metadata/);
});
test('wrong artist evidence is preserved but never evaluated or counted',async()=>{
  const storage=memory();let evaluated=false;
  const replay=createAuditReplay({evaluator:{...evaluator,evaluateMonitoringCandidate:()=>{evaluated=true;}},metadata,...storage,
    execute:async(sql,context)=>framed([{artist_key:'different artist'}],context)});
  await assert.rejects(replay.auditNext({population:{metadata,candidates:[candidate('requested artist')],populationComplete:true,missingSchemaTables:[]},evidenceSql:()=> 'SELECT source'}),/different artist/);
  assert.equal(evaluated,false);assert.ok(storage.writes.some(key=>key.includes('/raw/')));assert.ok(!storage.writes.some(key=>key.includes('/results/')));
});
test('browser IIFE uses no host runtime globals and executes with wall clock reads disabled',()=>{
  const code=execFileSync(esbuildExecutable(),[resolve(toolDirectory,'replay.mjs'),'--bundle','--platform=browser','--format=iife','--global-name=MonitorAuditReplay','--target=es2022','--minify','--tsconfig-raw={"compilerOptions":{"alwaysStrict":false}}'],{encoding:'utf8'});
  assert.ok(!/\b(?:Buffer|TextEncoder|process)\b|\b(?:require|fetch)\s*\(|Date\.now/.test(code));
  const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
  vm.runInContext('Date.now = () => { throw new Error("wall clock unavailable"); };',context);
  vm.runInContext(code,context);
  assert.equal(context.MonitorAuditReplay.md5Utf8('東京 😀'),md5Utf8('東京 😀'));
  assert.deepEqual(JSON.parse(JSON.stringify(context.MonitorAuditReplay.parseRfc4180Csv('a\n"[]"'))),[['a'],['[]']]);
});
const postgresModule=process.env.MONITOR_HISTORY_PGLITE_MODULE;
test('actual PostgreSQL framed whole and chunked SELECT replay nested evidence without loss',{skip:!postgresModule},async()=>{
  const {PGlite}=await import(postgresModule);const db=new PGlite();
  try{
    const storage=memory();let queries=0;
    const execute=async(sql)=>{queries++;const result=await db.query(sql);const keys=Object.keys(result.rows[0]);return raw(csv([keys,...result.rows.map(row=>keys.map(key=>row[key]))]));};
    const replay=createAuditReplay({evaluator,metadata,...storage,execute,chunkSize:17});
    const sql=`SELECT 'quoted artist'::text artist_key, '[]'::jsonb declared_aliases, jsonb_build_object('nested',jsonb_build_array('東京 😀', E'quoted "comma,\nnext line', '[]'::jsonb)) evidence`;
    const whole=await replay.captureRows({id:'whole',sql,expectedRows:1});assert.equal(queries,1);
    const chunked=await replay.captureRows({id:'chunks',sql,expectedRows:1,chunked:true});
    assert.deepEqual(whole,chunked);assert.deepEqual(whole[0].declared_aliases,[]);assert.ok(queries>2);
    assert.ok(buildJsonChunkSql(sql).includes('payload AS chunk'));
    assert.match(buildJsonChunkSql(sql),/^SELECT \* FROM \(WITH monitor_replay_rows AS MATERIALIZED/);
    const withSource=await replay.captureRows({id:'with_source',sql:`WITH source AS (${sql}) SELECT * FROM source`,expectedRows:1});
    assert.deepEqual(withSource,whole);
    const empty=await replay.captureRows({id:'empty_source',sql:'WITH source AS (SELECT 1 marker WHERE false) SELECT * FROM source',expectedRows:0});
    assert.deepEqual(empty,[]);
    const emptyFrame=(await db.query(buildJsonChunkSql('SELECT 1 marker WHERE false'))).rows[0];
    assert.deepEqual(Object.keys(emptyFrame),columns);assert.equal(emptyFrame.total_rows,0);assert.equal(emptyFrame.chunk,'[]');
    const clockFrame=(await db.query(buildJsonChunkSql("WITH capture AS (SELECT transaction_timestamp() captured_at) SELECT captured_at=now() same_clock FROM capture"))).rows[0];
    assert.deepEqual(JSON.parse(clockFrame.chunk),[{same_clock:true}]);
  }finally{await db.close();}
});

test('optional host storage persists private atomic checkpoints across independent instances',async()=>{
  const {mkdtemp,stat,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');
  const {createPrivateAuditStorage}=await import('./storage.mjs');
  const directory=await mkdtemp(tmpdir()+'/monitor-replay-storage-');
  try{
    const first=createPrivateAuditStorage(directory);
    await first.persist('run/raw/one.json',{aliases:[],nested:{text:'line\n"quote"'}});
    await first.persist('run/report.csv','artistKey\r\n"one"\r\n');
    const resumed=createPrivateAuditStorage(directory);
    assert.deepEqual(await resumed.read('run/raw/one.json'),{aliases:[],nested:{text:'line\n"quote"'}});
    assert.equal(await resumed.read('run/report.csv'),'artistKey\r\n"one"\r\n');
    assert.equal((await stat(directory+'/run/raw')).mode&0o777,0o700);
    assert.equal((await stat(directory+'/run/raw/one.json')).mode&0o777,0o600);
    await assert.rejects(first.persist('../escape.json',{}),/Unsafe/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('restart after durable result but before report update reuses the evaluation without duplicates',async()=>{
  const storage=memory();let queries=0,evaluations=0,interrupt=true;
  const counted={...evaluator,evaluateMonitoringCandidate:(...args)=>{evaluations++;return evaluator.evaluateMonitoringCandidate(...args);}};
  const execute=async(sql,context)=>{queries++;return framed([{artist_key:'alpha'}],context);};
  const persist=async(key,value)=>{await storage.persist(key,value);if(interrupt&&key.includes('/results/')){interrupt=false;throw new Error('shutdown before report');}};
  const population={metadata,candidates:[candidate('alpha')],populationComplete:true,missingSchemaTables:[]};
  const options={population,evidenceSql:()=> 'SELECT source'};
  await assert.rejects(createAuditReplay({evaluator:counted,metadata,execute,persist,read:storage.read}).auditNext(options),/shutdown/);
  const report=await createAuditReplay({evaluator:counted,metadata,execute,...storage}).auditNext(options);
  assert.equal(queries,1);assert.equal(evaluations,1);assert.equal(report.candidatesAudited,1);
});

test('per-evidence database clock overrides run start and is mandatory in transaction-clock mode',async()=>{
  const localMetadata={...metadata,clockMode:'evidence_transaction_timestamp'};
  const capturedAt='2026-09-06T18:00:00.123456Z';
  const storage=memory();let supplied;
  const replay=createAuditReplay({evaluator:{...evaluator,evaluateMonitoringCandidate:(artist,row,now)=>{supplied=now.toISOString();return evaluator.evaluateMonitoringCandidate(artist,row,now);}},metadata:localMetadata,...storage,
    execute:async(sql,context)=>framed([{artist_key:'alpha',audit_captured_at:capturedAt}],context)});
  const population={metadata:localMetadata,candidates:[candidate('alpha')],populationComplete:true,missingSchemaTables:[]};
  await replay.auditNext({population,evidenceSql:()=> 'SELECT source'});assert.equal(supplied,'2026-09-06T18:00:00.123Z');
  assert.notEqual(supplied,metadata.now);
  const absent=createAuditReplay({evaluator,metadata:localMetadata,...memory(),execute:async(sql,context)=>framed([{artist_key:'alpha'}],context)});
  await assert.rejects(absent.auditNext({population,evidenceSql:()=> 'SELECT source'}),/evidence capture clock/);
  await assert.rejects(replay.auditNext({population,evidenceSql:()=> 'SELECT source',chunkedArtistKeys:['alpha']}),/one full response/);
});

test('private storage rejects symlink roots, ancestors and final files without reading or changing outside data',async()=>{
  const {mkdtemp,writeFile,readFile,mkdir,symlink,stat,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');
  const {createPrivateAuditStorage}=await import('./storage.mjs');
  const base=await mkdtemp(tmpdir()+'/monitor-replay-symlinks-');
  try{
    const root=base+'/private',outside=base+'/outside';await mkdir(root);await mkdir(outside,{mode:0o755});
    await writeFile(outside+'/secret.json','{"outside":true}');
    await symlink(outside,root+'/run');const storage=createPrivateAuditStorage(root);
    await assert.rejects(storage.read('run/secret.json'),/symlink/);
    await assert.rejects(storage.persist('run/new.json',{}),/symlink/);
    assert.equal((await stat(outside)).mode&0o777,0o755);
    await symlink(outside+'/secret.json',root+'/file.json');
    await assert.rejects(storage.read('file.json'),/symlink/);
    await assert.rejects(storage.persist('file.json',{}),/symlink/);
    assert.equal(await readFile(outside+'/secret.json','utf8'),'{"outside":true}');
    await symlink(outside,base+'/linked-root');const linked=createPrivateAuditStorage(base+'/linked-root');
    await assert.rejects(linked.read('secret.json'),/symlink/);
    await assert.rejects(linked.persist('new.json',{}),/symlink/);
  }finally{await rm(base,{recursive:true,force:true});}
});

test('one immutable whole-source frame proves population coverage; repeated OFFSET pages do not',async()=>{
  const storage=memory();let queries=0;
  const replay=createAuditReplay({evaluator:{...evaluator,groupMonitoringCandidateIdentities:rows=>[...new Map(rows.map(row=>[row.artist_key,candidate(row.artist_key)])).values()]},metadata,...storage,execute:async(sql,context)=>{queries++;
    return framed(context.id.endsWith('_whole')?[{artist_key:'alpha'},{artist_key:'beta'}]:[{artist_key:'alpha'}],context);}});
  const drift=await replay.collectPopulation({sources:[{id:'drift',totalRows:2,pageSize:1,selectPage:({offset})=>'SELECT source OFFSET '+offset}]});
  assert.equal(drift.candidates.length,1);assert.equal(drift.populationComplete,false);
  const whole=await createAuditReplay({evaluator,metadata:{...metadata,runId:'whole_run'},...storage,execute:async(sql,context)=>{queries++;return framed([{artist_key:'alpha'},{artist_key:'beta'}],context);}})
    .collectPopulation({sources:[{id:'whole',capture:'whole',totalRows:2,selectAll:()=> 'SELECT source'}]});
  assert.equal(whole.rawRows,2);assert.equal(whole.populationComplete,true);
  assert.deepEqual(whole.candidates.map(row=>row.artistKey),['alpha','beta']);assert.equal(queries,3);
});

test('digest population capture preserves failed whole output, resumes raw chunks and records complete content proof',async()=>{
  const storage=memory(), rows=[{artist_key:'alpha',declared_aliases:['東京 😀','Alpha']},{artist_key:'beta',declared_aliases:[]}];
  let queries=0,interrupt=true;
  const failed={id:'base_whole',sql:'failed prior full request',rawResult:{exitCode:1,exitReason:'signal',success:false,output:''}};
  await storage.persist('test_run/raw/base_whole/full.json',failed);
  const execute=async(sql,context)=>{queries++;assert.match(sql,/jsonb_agg\(to_jsonb\(monitor_replay_rows\) ORDER BY to_jsonb\(monitor_replay_rows\)::text COLLATE "C"\)/);return framed(rows,context);};
  const persist=async(key,value)=>{await storage.persist(key,value);if(interrupt&&key.endsWith('/raw/base_digest_chunks/18.json')){interrupt=false;throw Error('interrupted after second raw chunk');}};
  const plan={sources:[{id:'base',capture:'digest_chunks',totalRows:2,selectAll:()=> 'SELECT source'}]};
  await assert.rejects(createAuditReplay({evaluator,metadata,...storage,persist,execute,chunkSize:17}).collectPopulation(plan),/interrupted/);
  assert.equal(queries,2);assert.equal(await storage.read('test_run/population.json'),null);
  const population=await createAuditReplay({evaluator,metadata,...storage,execute,chunkSize:17}).collectPopulation(plan);
  const proof=population.pages[0].contentProof, chars=Array.from(JSON.stringify(rows)).length;
  assert.equal(population.populationComplete,true);assert.deepEqual(population.populationLimitations,[]);
  assert.equal(population.pages[0].immutableSourceFrame,false);assert.equal(population.pages[0].consistentSourceContent,true);
  assert.equal(proof.method,'full_source_content_digest_chunks');assert.equal(proof.protocol,'monitor-audit-json-v1');
  assert.equal(proof.payloadMd5,md5Utf8(JSON.stringify(rows)));assert.equal(proof.sourceSqlMd5,md5Utf8('SELECT source'));
  assert.equal(proof.payloadCharacters,chars);assert.equal(proof.totalRows,2);assert.equal(proof.chunkCount,Math.ceil(chars/17));
  assert.equal(queries,proof.chunkCount);assert.equal(proof.rowOrder,'jsonb_text_C');assert.equal(proof.validated,true);
  assert.deepEqual(await storage.read('test_run/raw/base_whole/full.json'),failed);
  assert.deepEqual((await storage.read('test_run/decoded/base_digest_chunks.json')).rows,rows);
  const replay=createAuditReplay({evaluator,metadata,...storage,execute,chunkSize:17});
  assert.deepEqual(await replay.collectPopulation(plan),population);assert.equal(queries,proof.chunkCount);
  await assert.rejects(replay.captureRows({id:'base_digest_chunks',sql:'SELECT source',expectedRows:2}),/request mismatch/);
});

test('digest population never completes on same-size changed content, missing or truncated chunks',async()=>{
  for(const failure of ['changed','missing','truncated','offset']){
    const storage=memory();let calls=0;
    const replay=createAuditReplay({evaluator,metadata,...storage,chunkSize:17,execute:async(sql,context)=>{
      calls++;const result=framed([{artist_key:calls>1&&failure==='changed'?'bravo':'alpha',declared_aliases:['東京 😀']}],context);
      if(calls!==2)return result;
      if(failure==='missing')return raw('START TRANSACTION\nROLLBACK\n');
      if(failure==='truncated')return {...result,output:result.output.slice(0,-5)};
      if(failure==='offset')return framed([{artist_key:'alpha',declared_aliases:['東京 😀']}],{...context,chunkStart:context.chunkStart+1});
      return result;
    }});
    await assert.rejects(replay.collectPopulation({sources:[{id:'bad',capture:'digest_chunks',totalRows:1,selectAll:()=> 'SELECT source'}]}));
    assert.equal(calls,2);assert.equal(await storage.read('test_run/population.json'),null);
    assert.equal(await storage.read('test_run/decoded/bad_digest_chunks.json'),null);
    assert.ok(await storage.read('test_run/raw/bad_digest_chunks/18.json'));
  }
});

test('PostgreSQL canonical population chunks are stable under reordered source plans and preserve nested arrays',{skip:!postgresModule},async()=>{
  const {PGlite}=await import(postgresModule), db=new PGlite();
  try{
    const source=`SELECT * FROM (VALUES ('beta','["Z","東京 😀"]'::jsonb),('alpha','[]'::jsonb),('alpha','[]'::jsonb)) p(artist_key,declared_aliases)`;
    const sqlAscending=source+' ORDER BY artist_key ASC', sqlDescending=source+' ORDER BY artist_key DESC';
    const first=(await db.query(buildJsonChunkSql(sqlAscending,1,null,{canonicalRowOrder:true}))).rows[0];
    const reversed=(await db.query(buildJsonChunkSql(sqlDescending,1,null,{canonicalRowOrder:true}))).rows[0];
    assert.equal(first.payload_md5,reversed.payload_md5);assert.equal(first.chunk,reversed.chunk);
    const storage=memory();let calls=0;
    const execute=async(sql)=>{calls++;const changedOrder=calls%2?sql:sql.replace('ORDER BY artist_key ASC','ORDER BY artist_key DESC');
      const result=await db.query(changedOrder),keys=Object.keys(result.rows[0]);return raw(csv([keys,...result.rows.map(row=>keys.map(key=>row[key]))]));};
    const grouping={...evaluator,groupMonitoringCandidateIdentities:rows=>[...new Map(rows.map(row=>[row.artist_key,candidate(row.artist_key)])).values()]};
    const replay=createAuditReplay({evaluator:grouping,metadata,...storage,execute,chunkSize:23});
    const population=await replay.collectPopulation({sources:[{id:'ordered',capture:'digest_chunks',totalRows:3,selectAll:()=>sqlAscending}]});
    assert.equal(population.populationComplete,true);assert.equal(population.rawRows,3);assert.equal(population.candidates.length,2);
    const decoded=await storage.read('test_run/decoded/ordered_digest_chunks.json');
    assert.deepEqual(decoded.rows.filter(row=>row.artist_key==='beta')[0].declared_aliases,['Z','東京 😀']);
    assert.equal(decoded.transportProof.payloadMd5,first.payload_md5);assert.equal(calls,Math.ceil(first.payload_chars/23));
    const finalRaw=await storage.read('test_run/raw/ordered_digest_chunks/'+(1+23*(calls-1))+'.json');
    const [lastFrame]=decodeReplitCsv(finalRaw.rawResult);assert.ok(Number(lastFrame.chunk_chars)<23);
    const empty=await createAuditReplay({evaluator:grouping,metadata:{...metadata,runId:'empty_run'},...storage,execute,chunkSize:23})
      .collectPopulation({sources:[{id:'empty',capture:'digest_chunks',totalRows:0,selectAll:()=> 'SELECT 1 marker WHERE false'}]});
    assert.equal(empty.populationComplete,true);assert.equal(empty.rawRows,0);assert.equal(empty.pages[0].contentProof.chunkCount,1);
  }finally{await db.close();}
});

test('replay requires an explicit clock mode rather than silently treating a transaction query as run-fixed',()=>{
  const {clockMode,...omitted}=metadata;
  assert.throws(()=>createAuditReplay({evaluator,metadata:omitted,...memory(),execute:async()=>{}}),/explicit audit clock/);
  assert.throws(()=>prepareAuditQueries({}, {missingTables:[],now:metadata.now}),/explicit audit clock/);
});

test('explicit failed-envelope retries preserve every attempt and resume successful population chunks without new SQL',async()=>{
  const storage=memory(), rows=[{artist_key:'alpha',declared_aliases:['東京 😀']},{artist_key:'beta',declared_aliases:[]}];
  const sql='SELECT source', chunkSize=17;
  const firstKey='test_run/raw/base_digest_chunks/1.json', failedKey='test_run/raw/base_digest_chunks/18.json';
  await storage.persist(firstKey,{id:'base_digest_chunks',sql:buildJsonChunkSql(sql,1,chunkSize,{canonicalRowOrder:true}),rawResult:framed(rows,{chunkStart:1,chunkSize})});
  const failure={id:'base_digest_chunks',sql:buildJsonChunkSql(sql,18,chunkSize,{canonicalRowOrder:true}),rawResult:failedEnvelope};
  await storage.persist(failedKey,failure);
  const queries=[];let stopAfterResult=true;
  const execute=async(request,context)=>{queries.push(context);return framed(rows,context);};
  const persist=async(key,value)=>{await storage.persist(key,value);if(stopAfterResult&&key.endsWith('/raw/base_digest_chunks/18.retry-1.json')){stopAfterResult=false;throw Error('stopped after durable successful retry');}};
  const args={evaluator,metadata,...storage,execute,chunkSize,failedToolRetries:1,replayImplementation:retryImplementation};
  const plan={sources:[{id:'base',capture:'digest_chunks',totalRows:2,selectAll:()=>sql}]};
  await assert.rejects(createAuditReplay({...args,persist}).collectPopulation(plan),/stopped/);
  assert.equal(queries.length,1);assert.equal(queries[0].chunkStart,18);assert.equal(queries[0].attempt,1);
  const population=await createAuditReplay(args).collectPopulation(plan), proof=population.pages[0].contentProof;
  assert.equal(population.populationComplete,true);assert.deepEqual(await storage.read(failedKey),failure);
  assert.equal(queries.filter(query=>query.chunkStart===18).length,1);assert.ok(!queries.some(query=>query.chunkStart===1));
  assert.equal(proof.failedAttemptCount,1);assert.equal(proof.attemptCount,proof.chunkCount+1);
  assert.deepEqual(proof.rawAttempts.filter(attempt=>attempt.chunkStart===18).map(attempt=>[attempt.attempt,attempt.outcome]),[[0,'failed_tool_envelope'],[1,'returned_envelope']]);
  assert.deepEqual(proof.replayImplementation,retryImplementation);
  assert.deepEqual(await storage.read('test_run/manifest.json'),metadata);
  const implementation=await storage.read('test_run/replay-implementations/'+retryImplementation.sha256+'.retries-1.json');
  assert.equal(implementation.sourceHash,metadata.sourceHash);assert.equal(implementation.failedToolRetries,1);
  assert.equal(implementation.checkpointHashVersion,CHECKPOINT_HASH_VERSION);
  assert.equal(implementation.scope,'explicit_failed_envelope_retries_and_verified_canonical_recovery');
  const count=queries.length;await createAuditReplay(args).collectPopulation(plan);assert.equal(queries.length,count);
});

test('failed-envelope retry limits are opt-in, bounded and exhausted failures remain immutable on resume',async()=>{
  for(const limit of [0,1,2]){
    const storage=memory();let queries=0;
    const args={evaluator,metadata,...storage,failedToolRetries:limit,replayImplementation:retryImplementation,execute:async()=>{queries++;return failedEnvelope;}};
    const request={id:'failed',sql:'SELECT source',expectedRows:1};
    await assert.rejects(createAuditReplay(args).captureRows(request),/successful completion/);assert.equal(queries,1+limit);
    const snapshots=structuredClone([...storage.values.entries()]);
    await assert.rejects(createAuditReplay(args).captureRows(request),/successful completion/);assert.equal(queries,1+limit);
    assert.deepEqual([...storage.values.entries()],snapshots);assert.equal(await storage.read('test_run/decoded/failed.json'),null);
  }
  for(const limit of [-1,4,Infinity,0.5])assert.throws(()=>createAuditReplay({evaluator,metadata,...memory(),execute:async()=>{},failedToolRetries:limit,replayImplementation:retryImplementation}),/bounded/);
  assert.throws(()=>createAuditReplay({evaluator,metadata,...memory(),execute:async()=>{},failedToolRetries:1}),/implementation/);
});

test('retry opt-in never repeats successful malformed/truncated/drifting frames or mismatched raw artifacts',async()=>{
  for(const kind of ['malformed','truncated','failed_truncated','failed_is_truncated','ambiguous_failure','drift','raw_mismatch','retry_mismatch']){
    const storage=memory();let queries=0;
    const id='checked',sql='SELECT source',chunkSize=17;
    if(kind==='raw_mismatch')await storage.persist('test_run/raw/checked/1.json',{id,sql:'SELECT different source',rawResult:failedEnvelope});
    if(kind==='retry_mismatch'){
      await storage.persist('test_run/raw/checked/1.json',{id,sql:buildJsonChunkSql(sql,1,chunkSize),rawResult:failedEnvelope});
      await storage.persist('test_run/raw/checked/1.retry-1.json',{id,sql:buildJsonChunkSql(sql,1,chunkSize),rawResult:failedEnvelope,retryOf:'wrong.json',attempt:1});
    }
    const execute=async(request,context)=>{queries++;
      if(kind==='malformed')return raw('START TRANSACTION\nROLLBACK\n');
      if(kind==='failed_truncated')return {...failedEnvelope,truncated:true};
      if(kind==='failed_is_truncated')return {...failedEnvelope,isTruncated:true};
      if(kind==='ambiguous_failure')return {...failedEnvelope,exitCode:0};
      const value=framed([{artist_key:kind==='drift'&&queries===2?'bravo':'alpha'}],context);
      return kind==='truncated'?{...value,truncated:true}:value;
    };
    const replay=createAuditReplay({evaluator,metadata,...storage,execute,chunkSize,failedToolRetries:2,replayImplementation:retryImplementation});
    await assert.rejects(replay.captureRows({id,sql,expectedRows:1,chunked:true}));
    assert.equal(queries,['raw_mismatch','retry_mismatch'].includes(kind)?0:kind==='drift'?2:1,kind);
    assert.ok(!storage.writes.some(key=>key.includes('.retry-')&&!['retry_mismatch'].includes(kind)),kind);
    assert.equal(await storage.read('test_run/decoded/checked.json'),null);
  }
});
