import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileRoster } from './roster-reconciliation.mjs';
const roster = [{sourceRow:2,artistKey:'original a',artistName:'Original A',canonicalRoute:'/artist/a'}, {sourceRow:3,artistKey:'accepted alias',artistName:'Accepted Alias',canonicalRoute:'/artist/a'}, {sourceRow:4,artistKey:'b',artistName:'B',canonicalRoute:'/artist/b'}];
const routes = new Map([['a','/artist/a'],['alias','/artist/a'],['b','/artist/b'],['extra','/artist/extra']]);
const run = candidates => reconcileRoster({roster,population:{candidates},resolveRoute:value=>routes.get(value) ?? null});
test('duplicate roster rows survive and outside candidates are excluded',()=>{
 const original=[{artistKey:'a',artistName:'Exact A',sourceKeys:['alias'],spotifyIds:['id-a']},{artistKey:'extra',artistName:'Exact Extra'}];
 const before=JSON.stringify(original); const r=run(original);
 assert.equal(r.rosterRows,3);assert.equal(r.distinctRoutes,2);assert.deepEqual(r.outsideCandidateIndices,[1]);
 assert.deepEqual(r.artists[0].rosterRows,roster.slice(0,2));assert.deepEqual(r.artists[0].candidateIndices,[0]);assert.equal(JSON.stringify(original),before);
 assert.equal(r.groups[0].candidate.artistName,'Exact A');assert.equal(r.artists[0].classification,null);
});
test('conflicting routes and explicit identity conflicts never enter evaluation scope',()=>{
 const r=run([{artistKey:'a',sourceKeys:['b']},{artistKey:'a',identityConflict:true},{artistKey:'a',sourceKeys:['extra']}]);
 assert.deepEqual(r.conflictingCandidateIndices,[0,1,2]);assert.deepEqual(r.artists[0].evaluateCandidateIndices,[]);
});
test('unresolved roster rows remain present and normalization is not invented',()=>{
 const r=run([{artistKey:'A',artistName:'unaccepted spelling'}]);
 assert.deepEqual(r.artists[0].mappingIssues,['no_captured_candidate_route_correspondence']);assert.deepEqual(r.outsideCandidateIndices,[0]);
});
test('multiple provider IDs are flagged; same-route candidate boundaries are retained',()=>{
 const r=run([{artistKey:'a',spotifyIds:['one']},{artistKey:'alias',spotifyIds:['two']}]);
 assert.deepEqual(r.artists[0].candidateIndices,[0,1]);assert.deepEqual(r.artists[0].mappingIssues,['multiple_spotify_ids_under_route_require_review']);
 assert.equal(r.providerIdentityMerged,false);assert.equal(r.groups[1].candidate.artistKey,'alias');
});

test('image writer correspondence remains an unresolved lead, not an outside artist or accepted merge',()=>{
 const r=reconcileRoster({roster:[{sourceRow:2,artistKey:'group y band',artistName:'Group Y Band',canonicalRoute:'/artist/group-y-band'}],
 population:{candidates:[{artistKey:'group and band',artistName:'group and band',candidateSources:['artist_images']}]},resolveRoute:()=>null});
 assert.equal(r.groups[0].status,'unresolved_image_alias');assert.deepEqual(r.outsideCandidateIndices,[]);
 assert.deepEqual(r.artists[0].unresolvedImageAliasIndices,[0]);assert.deepEqual(r.artists[0].evaluateCandidateIndices,[]);
});

test('provider identity shared across distinct roster routes is visible without merging routes',()=>{
 const r=run([{artistKey:'a',spotifyIds:['shared']},{artistKey:'b',spotifyIds:['shared']}]);
 assert.deepEqual(r.sharedProviderConflicts,[{spotifyId:'shared',routes:['/artist/a','/artist/b']}]);
 assert.ok(r.artists.every(a=>a.mappingIssues.includes('provider_id_shared_across_roster_routes')));
 assert.equal(r.distinctRoutes,2);
});
