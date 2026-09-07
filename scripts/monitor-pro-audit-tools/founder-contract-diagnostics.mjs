/** Offline three-case adapter. Retained hash-bound evidence only; no provider/database/runtime requests. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {evaluateFounderContract} from './founder-product-contract.mjs';
const [root,output]=process.argv.slice(2);assert(root&&output);assert(!fs.existsSync(output),'Preserve prior outputs');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const inputs={
 'evaluator-validity-three-diagnostics.json':'7aaf033c4c8ede33b58bca1ae9898af52cabb23c8d14aa2bbd8203c8f9378af2',
 'configured467-population-original.json':'84d8cdfe12b187af43328eb946acebcda39149a9bb0aa8eeba3d91d7e70f9e4a',
 'evidence-pipeline-three-comparison.json':'b0977852dd2523c771b20cf42895e0a1249dce040bb9ffe1ec0a050cb4bf0c32'};
const read=n=>{assert.equal(hash(path.join(root,n)),inputs[n]);return JSON.parse(fs.readFileSync(path.join(root,n),'utf8'));};
const diagnostics=read('evaluator-validity-three-diagnostics.json'),population=read('configured467-population-original.json'),previous=read('evidence-pipeline-three-comparison.json');
const cases=[[710,'pesopluma'],[596,'luismiguel'],[662,'natanaelcano']],results=[];
for(const [index,key] of cases){
 const d=diagnostics.find(d=>d.index===index),c=population.candidates[index],p=previous.rows.find(r=>r.index===index);
 assert(d&&p&&c);assert.equal(c.artistKey,key);assert.equal(d.artistKey,key);assert.equal(c.artistName,d.artistName);
 const s=d.snapshot,se=d.sourceEvidence,sourceRef=d.evidenceFile+'@sha256:'+d.evidenceSha256;
 const sourceIdentity=c.sourceKeys.includes(s.artist_key)&&c.spotifyIds.includes(s.spotify_artist_id)&&se.payloadSources.some(x=>x.artistKey===s.artist_key&&x.songstatsId===s.songstats_artist_id&&x.spotifyId===s.spotify_artist_id)&&s.stats?.artist_info?.songstats_artist_id===s.songstats_artist_id;
 const audience={};
 for(const [key,source,field,column] of [['spotifyMonthlyListeners','spotify','monthly_listeners_current','spotify_monthly_listeners'],['youtubeSubscribers','youtube','subscribers_total','youtube_subscribers']]){
  const raw=s.stats?.stats?.find(x=>x.source===source)?.data?.[field];
  audience[key]={source:'songstats',value:s[column],observedDate:s.snapshot_date,identityMatched:sourceIdentity,materializationMatchesSource:raw===s[column],sourceRef:sourceRef+'#songstats_artist_daily_snapshots/'+s.id+'/'+column};
 }
 const native=se.youtubeNativeHistoryInspection,b=native?.proof?.buckets?.find(b=>b.scope==='approved');
 const coreHistories=[];
 for(const metric of ['spotifyMonthlyListeners','youtubeSubscribers']){
  const w=p.after.evidencePipeline.growth[metric]?.find(w=>w.state==='satisfied'&&w.current&&w.baseline);
  if(w)coreHistories.push({metric,identityMatched:sourceIdentity,sameMeasure:true,sourceRef:w.current.reference,points:[w.baseline,w.current]});
 }
 const e={artistKey:key,artistName:c.artistName,
  identity:{verified:c.identityMappingStatus==='provider_id'||c.identityMappingStatus==='accepted_registry',coreConflict:c.identityConflict===true,sourceRef:inputs['configured467-population-original.json']+'#candidate/'+index},audience,
  catalog:{verified:true,matchedTracks:se.catalog.tracks,albums:se.catalog.albums,hasMeasuredStreams:Number.isFinite(se.streamSummary.track_total_streams)&&se.streamSummary.track_total_streams>=0,identityMatched:c.spotifyIds.includes(se.catalogCompleteness.spotifyArtistId),sourceDate:se.streamSummary.snapshot_date,coverage:se.catalogCompleteness.scope,sourceRef:se.catalogCompleteness.reference},
  youtube:{approvedVideos:se.youtube.approvedVideos,approvedObservedVideos:se.youtube.observedVideos,relationshipsVerified:native?.status==='complete'&&b?.scope==='approved'&&b.renderableVideosWithMultipleDates>0,
   freshVideos:se.youtubeObservationCoverage.freshVideos,latestObservedAt:se.youtubeObservationCoverage.latestObservedAt,videosWithMeasuredDelta:se.youtubeObservationCoverage.videosWithObservedDelta,
   videosWithComparableHistory:b?.renderableVideosWithMultipleDates??0,importComplete:se.youtubeImportProof.complete,sourceRef:sourceRef+'#approved_youtube_sources'},
  mexico:{observations:se.mexicoAudience.cities,genuineMarketEvidence:se.mexicoAudience.cities>0,sourceDate:null,dateEvidence:'Only acquisition timestamp retained for audience_details; source observation date not established',sourceRef:sourceRef+'#songstats/audience_details'},
  coreHistories,coreHistoryScopeComplete:false,growth:p.after.evidencePipeline.growth,
  artwork:{complete:se.catalog.tracksWithArtwork===se.catalog.tracks&&se.catalog.albumsWithArtwork===se.catalog.albums},spotifyHistory:se.spotifyHistory,pulse:se.dailyPulse,comparisons:se.comparisonCoverage,
  provenance:{retainedSourceReference:sourceRef,sourceObservationClock:d.auditedAt,requestsPerformed:0,queryPerformed:false}};
 const context={asOf:d.auditedAt,viewer:{verifiedFounder:true,approvedRosterRoute:true},youtubeCollector:{paused:true,sourceRef:'founder_decision_2026_09_07:protected_validation_intentional_pause'},
  serving:{status:'unknown',sourceRef:'REPORT-before-founder-contract-clarification.md',reason:'No retained authenticated production acceptance. Offline source-data evaluation is not an end-to-end serving test.'}};
 const before=JSON.stringify(e);const result=evaluateFounderContract(e,context);
 assert.deepEqual(result,evaluateFounderContract(e,context));assert.equal(JSON.stringify(e),before);
 const unpaused=evaluateFounderContract(e,{...context,youtubeCollector:{paused:false}});
 assert.deepEqual(result.sections.audience,unpaused.sections.audience);assert.deepEqual(result.artistEligibility,unpaused.artistEligibility);
 results.push({index,input:e,result,validation:{deterministic:true,inputImmutable:true,pauseDoesNotChangeSongstatsOrArtistEligibility:true}});
}
for(const [n,h] of Object.entries(inputs))assert.equal(hash(path.join(root,n)),h);
fs.mkdirSync(output,{recursive:true,mode:0o700});
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({contractVersion:results[0].result.contractVersion,inputs,scope:'three_approved_roster_routes_only',noPopulationEvaluation:true,noProductionChange:true,results},null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify(results.map(r=>({artist:r.result.artistName,...r.result.artistEligibility,sections:r.result.sections,warnings:r.result.warnings})),null,2));
