import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {repoRoot,outputArgument} from './paths.mjs';
import {createPrivateAuditStorage} from './storage.mjs';
const ts=createRequire(resolve(repoRoot,'package.json'))('typescript');
import {execFileSync} from 'node:child_process';
const direct=await import(pathToFileURL(resolve(repoRoot,'artifacts/api-server/src/lib/monitoring-candidate-policy.ts')).href);
const output=outputArgument();
const directory=pathToFileURL(output+sep);
const storage=createPrivateAuditStorage(output);
const code=fs.readFileSync(new URL('monitor-audit-evaluator.js',directory),'utf8');
const meta=JSON.parse(fs.readFileSync(new URL('monitor-audit-evaluator.meta.json',directory),'utf8'));
const revision=execFileSync('git',['-C',repoRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(Object.values(meta.outputs).flatMap(value=>value.imports).length,0);
assert.ok(Object.keys(meta.inputs).every(path=>path.startsWith('artifacts/api-server/src/lib/')));
assert.ok(Object.keys(meta.inputs).includes('artifacts/api-server/src/lib/monitoring-daily-pulse.ts'));
assert.ok(!/\b(?:require|fetch|XMLHttpRequest|WebSocket)\s*\(|\b(?:process|document|window)\s*(?:\.|\[)/.test(code));
assert.ok(!/@workspace\/db|DATABASE_URL|CREATE TABLE|INSERT INTO/.test(code));
const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
vm.runInContext('const NativeDate=Date;globalThis.Date=class extends NativeDate {constructor(...values){if(!values.length)throw new Error("Implicit clock forbidden");super(...values);}static now(){throw new Error("Date.now forbidden");}};',context);
vm.runInContext(code,context,{timeout:1000});
const bundle=context.MonitorAudit;
assert.deepEqual(Object.keys(bundle).sort(),Object.keys(direct).sort());
const json=value=>JSON.parse(JSON.stringify(value));
const source=fs.readFileSync(resolve(repoRoot,'artifacts/api-server/src/lib/monitoring-candidate-audit.test.ts'),'utf8');
const start=source.indexOf('function fixture()'),end=source.indexOf('\n\ntest(',start);
assert.ok(start>=0&&end>start);
const fixtureJs=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const fixture=new Function('groupMonitoringCandidateIdentities',fixtureJs+'\nreturn fixture;')(direct.groupMonitoringCandidateIdentities);
const initial=fixture();
await storage.persist('monitor-audit-evaluator-fixture.json',{...initial,fixtureOnly:true,revision});
const cases=[];
function scenario(name,expected,mutate=()=>{}){const value=fixture();mutate(value);cases.push({name,expected,...value});}
scenario('A_complete_approved_fixture','A');
scenario('B_existing_raw_summary','B',({row})=>{row.summary={...row.summary,track_count:0,album_count:0,track_daily_streams:0,track_total_streams:0,album_total_streams:0};row.legacy[0].summary=row.summary;});
scenario('C_original_spotify_aggregate_history_absent','C',({row})=>{row.source_evidence.spotifyHistory={days:0};});
scenario('unknown_full_catalog_proof',null,({row})=>{row.source_evidence.catalogCompleteness=null;});
scenario('unknown_schema',null,({row})=>{row.missing_schema_tables=['songstats_historical_observations'];});
scenario('unknown_invalid_identity',null,({artist})=>{artist.spotifyIds=['invalid-shared-provider'];});
scenario('unknown_provider_conflict',null,({artist})=>{artist.identityConflict=true;artist.spotifyIds.push('0000000000000000000200');});
scenario('unknown_live_artwork_fallback',null,({row})=>{delete row.source_evidence.liveCatalogInvestigation;row.source_evidence.catalog.albumsWithArtwork=0;});
scenario('unknown_bounded_youtube_history_retains_old_alltime',null,({row})=>{row.source_evidence.youtubeHistory={days:0,videos:0,videosWithHistory:0,rangeDays:90,allTime:{days:50,videos:2,videosWithHistory:2}};});
scenario('unknown_candidate_only_youtube',null,({row})=>{Object.assign(row.source_evidence,{youtube:{approvedVideos:0,observedVideos:0,videosWithArtwork:0},youtubeHistory:{days:0,videos:0,videosWithHistory:0},youtubeObservations:[],youtubeImport:[],youtubeServing:{inspected:true,catalog:{videos:2,candidateOnlyVideos:2},nativeDailyHistory:{points:20,candidateOnlyVideosWithHistory:2}}});});
scenario('B_scoped_licensed_audience_endpoint_contract','B',({artist,row})=>{const extended={...row.extended[0],artist_key:artist.artistKey,audience_details_fetched_at:'2026-08-08T10:00:00Z',audience:null};row.extended=[extended];row.legacy[0].extended=extended;});
scenario('unknown_missing_catalog_endpoint',null,({row})=>{row.extended[0].catalog=null;});
scenario('unknown_undated_comparison',null,({row})=>{delete row.source_evidence.comparisonPeerDates;});
scenario('C_stale_comparison','C',({row})=>{row.source_evidence.comparisonPeerDates=[{date:'2020-01-01',peers:10}];});
const originalDate=globalThis.Date;
try{
  globalThis.Date=class extends originalDate{constructor(...values){if(!values.length)throw new Error('Implicit clock forbidden');super(...values);}static now(){throw new Error('Date.now forbidden');}};
  for(const value of cases){const expected=direct.evaluateMonitoringCandidate(value.artist,value.row,value.now);const actual=bundle.evaluateMonitoringCandidate(value.artist,value.row,value.now);
    assert.equal(expected.classification,value.expected,value.name);assert.deepEqual(json(actual),json(expected),value.name);
    if(value.name==='unknown_bounded_youtube_history_retains_old_alltime'){
      assert.equal(actual.sourceEvidence.youtubeHistory.allTime.days,50);
      assert.ok(actual.findings.some(finding=>finding.code==='youtube_native_intraday_fallback_uninvestigated'&&finding.status==='investigation_required'));
      assert.equal(actual.publicEligible,false);
    }
  }
}finally{globalThis.Date=originalDate;}
const sourceRows=[
  {artist_key:'valid first',artist_name:'First',spotify_id:'0000000000000000000101',source:'kworb_coverage'},
  {artist_key:'valid linked',artist_name:null,spotify_id:'0000000000000000000101',source:'songstats_artists'},
  {artist_key:'invalid first',artist_name:null,spotify_id:'invalid-shared-provider',source:'kworb_coverage'},
  {artist_key:'invalid second',artist_name:null,spotify_id:'invalid-shared-provider',source:'songstats_artists'},
  {artist_key:'accepted first',artist_name:'First Native',spotify_id:null,source:'musicbrainz_artists',mbid:'fixture-first',verified:'auto',declared_aliases:['甲']},
  {artist_key:'accepted second',artist_name:'Second Native',spotify_id:null,source:'musicbrainz_artists',mbid:'fixture-second',verified:'auto',declared_aliases:['乙']},
];
assert.deepEqual(json(bundle.groupMonitoringCandidateIdentities(sourceRows)),json(direct.groupMonitoringCandidateIdentities(sourceRows)));
assert.equal(bundle.groupMonitoringCandidateIdentities(sourceRows).length,5);
const mixedRows=[...sourceRows,
  {artist_key:'banda ejemplo',artist_name:'Banda Ejemplo',spotify_id:'0000000000000000000301',source:'kworb_coverage'},
  {artist_key:'bandaejemplo',artist_name:'Banda Ejemplo Official',spotify_id:'0000000000000000000301',source:'spotify_artists'},
  {artist_key:'bandaejemplodelnorte',artist_name:'Banda Ejemplo del Norte',spotify_id:null,source:'musicbrainz_artists',mbid:'fixture-example',verified:'auto_review_accepted',declared_aliases:['Banda Ejemplo','Ejemplo 😀']},
  {artist_key:'ejemplo descubierto',artist_name:'Ejemplo Descubierto',spotify_id:null,source:'artist_candidates',source_record_id:'accepted-1',discovery_status:'linked_existing_artist',matched_artist_key:'bandaejemplodelnorte'},
  {artist_key:'unrelated pending',artist_name:'Unrelated Pending',spotify_id:'0000000000000000000301',source:'artist_candidates',source_record_id:'pending-1',discovery_status:'pending',matched_artist_key:null},
  {artist_key:'review proposal',artist_name:'Review Proposal',spotify_id:'0000000000000000000301',source:'spotify_artist_candidates',source_record_id:'review-1',discovery_status:'review'},
  {artist_key:'conflicting example',artist_name:'Conflict Example',spotify_id:'0000000000000000000401',source:'kworb_coverage'},
  {artist_key:'conflictingexample',artist_name:null,spotify_id:'0000000000000000000402',source:'songstats_artists'},
];
// Top-level diagnostic relation order is incidental. Preserve the arrays inside
// each source/evidence row exactly, including declared alias order.
const semanticGroups=rows=>json(rows).map(group=>({...group,matchKeys:group.matchKeys.slice().sort(),
  identityAliasEvidence:group.identityAliasEvidence.slice().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),
  candidateRecords:group.candidateRecords.slice().sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))}));
const mixedBefore=JSON.stringify(mixedRows), expectedGroups=semanticGroups(direct.groupMonitoringCandidateIdentities(mixedRows));
let seed=412;
for(let permutation=0;permutation<40;permutation++){
  const values=mixedRows.slice();
  for(let index=values.length-1;index>0;index--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const other=seed%(index+1);[values[index],values[other]]=[values[other],values[index]];}
  assert.deepEqual(semanticGroups(direct.groupMonitoringCandidateIdentities(values)),expectedGroups);
  assert.deepEqual(semanticGroups(bundle.groupMonitoringCandidateIdentities(values)),expectedGroups);
}
assert.equal(JSON.stringify(mixedRows),mixedBefore);
const tiedNames=[
  {artist_key:'same source key',artist_name:'First stored label',spotify_id:null,source:'youtube_artist_video_links'},
  {artist_key:'same source key',artist_name:'Second stored label',spotify_id:null,source:'monitoring_stream_items'},
];
const tiedForward=direct.groupMonitoringCandidateIdentities(tiedNames)[0], tiedReverse=direct.groupMonitoringCandidateIdentities(tiedNames.slice().reverse())[0];
assert.equal(tiedForward.artistKey,tiedReverse.artistKey);assert.notEqual(tiedForward.artistName,tiedReverse.artistName);
const manifest=JSON.parse(fs.readFileSync(new URL('monitor-audit-sql-manifest.json',directory),'utf8'));
assert.equal(manifest.revision,revision);assert.equal(manifest.fixedClockAdaptation.replacedNowCalls,3);
assert.ok(!/\bnow\(\)/.test(manifest.queries.fixedClockEvidence));
assert.equal((manifest.queries.fixedClockEvidence.match(/\$2::timestamptz/g)||[]).length,3);
const report={revision,bundleBytes:Buffer.byteLength(code),sha256:crypto.createHash('sha256').update(code).digest('hex'),exports:Object.keys(bundle).sort(),sourceInputs:Object.keys(meta.inputs),externalImports:0,isolatedVm:true,dynamicCodeGenerationDisabled:true,implicitDateConstructorForbidden:true,dateNowForbidden:true,nodeOrDatabaseOrNetworkGlobalsProvided:false,identityParity:true,identityPermutationParity:{permutations:40,mixedSourceRows:mixedRows.length,sourceAndBundle:true,sourceArraysPreserved:true,tiedNameOrderingLimitationConfirmed:true},evaluatorParityCases:cases.map(({name,expected})=>({name,classification:expected})),actualProductionRowsEvaluated:0,actualFunctionsV8Verified:false,sqlManifestSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL('monitor-audit-sql-manifest.json',directory))).digest('hex')};
await storage.persist('monitor-audit-evaluator.verification.json',report);
console.log(JSON.stringify(report,null,2));
