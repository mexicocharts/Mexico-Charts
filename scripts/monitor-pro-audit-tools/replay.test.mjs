import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {toolDirectory,esbuildExecutable} from './paths.mjs';
import {prepareAuditQueries} from './manifest-helper.mjs';
import { parseRfc4180Csv, decodeReplitCsv, md5Utf8, createAuditReplay, buildJsonChunkSql } from './replay.mjs';
const columns = ['protocol','total_rows','payload_chars','payload_md5','chunk_start','chunk_chars','chunk'];
const csv = rows => rows.map(row => row.map(value => '"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
const raw = output => ({exitCode:0,exitReason:null,output,success:true});
const metadata = {runId:'test_run',revision:'reviewed_revision',sourceHash:'reviewed_source_hash',evaluatorHash:'reviewed_evaluator_hash',now:'2026-09-06T12:00:00Z',clockMode:'run_fixed'};
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
  const whole=await replay.collectPopulation({sources:[{id:'whole',capture:'whole',totalRows:2,selectAll:()=> 'SELECT source'}]});
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
    const empty=await replay.collectPopulation({sources:[{id:'empty',capture:'digest_chunks',totalRows:0,selectAll:()=> 'SELECT 1 marker WHERE false'}]});
    assert.equal(empty.populationComplete,true);assert.equal(empty.rawRows,0);assert.equal(empty.pages[0].contentProof.chunkCount,1);
  }finally{await db.close();}
});

test('replay requires an explicit clock mode rather than silently treating a transaction query as run-fixed',()=>{
  const {clockMode,...omitted}=metadata;
  assert.throws(()=>createAuditReplay({evaluator,metadata:omitted,...memory(),execute:async()=>{}}),/explicit audit clock/);
  assert.throws(()=>prepareAuditQueries({}, {missingTables:[],now:metadata.now}),/explicit audit clock/);
});
