/** Private audit adapter. No product imports, I/O, clock substitution or eligibility writes.
 * baseline must be the source-bound frozen evaluator, not a persisted decision supplied as proof.
 */
import assert from 'node:assert/strict';
import {reconcileCatalogEvidence} from './catalog-evidence-reconciliation.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const day=86400000;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const shift=(x,n)=>new Date(Date.parse(x)+n*day).toISOString().slice(0,10);
const fresh=(x,clock)=>date(x)&&Date.parse(clock)-Date.parse(x)>=-day&&Date.parse(clock)-Date.parse(x)<=14*day;
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(String(x).replaceAll(',','')))&&Number(String(x).replaceAll(',',''))>=0;
const num=x=>Number(String(x).replaceAll(',',''));
export const PIPELINE_VERSION='monitor_audit_evidence_v1';
export const GROWTH_SOURCES=Object.freeze(['licensed_history','verified_compact_history','scheduled_daily_history']);
export const GROWTH_METRICS=Object.freeze({spotifyMonthlyListeners:['spotify','monthly_listeners_current'],instagramFollowers:['instagram','followers_total'],tiktokFollowers:['tiktok','followers_total']});
/** These are two distinct measures. Native evidence never discharges measured-delta requirements. */
export function nativeHistorySatisfies(inspection,approvedVideos,requirement='cumulative_views'){
 const p=inspection?.proof,b=p?.buckets?.find(b=>b.scope==='approved');
 return requirement==='cumulative_views'&&inspection?.status==='complete'&&p.kind==='native_intraday_cumulative'
  &&p.sourceTable==='youtube_video_intraday_shadow_snapshots'&&p.trustedSourceType==='youtube_api_shadow'
  &&p.timeZone==='America/New_York'&&p.rangeDays===90&&p.selection==='last_observation_per_et_date'
  &&p.substitutesForApprovedDailySnapshots===false&&Number.isSafeInteger(approvedVideos)&&approvedVideos>0
  &&b?.eligibleVideos===approvedVideos&&b.renderableVideosWithMultipleDates===approvedVideos
  &&['missingTrackedVideos','invalidVideoIds','unrenderableVideos','invalidSelectedPointCount'].every(k=>b[k]===0);
}
/** Exact observations with a retained source reference are sufficient; no audit-generated file is required.
 * A source is exhaustive only when its bounded read is complete, exact-key scoped,
 * and covers the baseline-through-current interval. Missing/partial sources stay unknown.
 */
export function growthWindows({metric,artistKey,sourceKeys,clock,sources}){
 assert(Object.hasOwn(GROWTH_METRICS,metric));assert(date(clock.slice(0,10)));
 const trusted=sources.filter(s=>GROWTH_SOURCES.includes(s.source)&&s.metric===metric&&s.artistKey===artistKey
  &&Array.isArray(s.sourceKeys)&&JSON.stringify([...s.sourceKeys].sort())===JSON.stringify([...sourceKeys].sort())
  &&typeof s.reference==='string'&&s.reference.length>0&&Array.isArray(s.points)
  &&Number.isFinite(Date.parse(s.capturedAt))&&Date.parse(s.capturedAt)<=Date.parse(clock));
 const points=trusted.flatMap(s=>s.points.filter(p=>date(p.date)&&finite(p.value)&&Date.parse(p.date)<=Date.parse(clock))
  .map(p=>({date:p.date,value:num(p.value),reference:s.reference,source:s.source})));
 const latestDate=points.map(p=>p.date).sort().at(-1)??null;
 const latest=points.filter(p=>p.date===latestDate);
 const conflict=dates=>dates.some(d=>new Set(points.filter(p=>p.date===d).map(p=>p.value)).size>1);
 return [7,30,90].map(days=>{
  const anchor=latestDate??clock.slice(0,10),target=shift(anchor,-days),start=shift(target,-7);
  const baselineDate=points.filter(p=>p.date>=start&&p.date<=target).map(p=>p.date).sort().at(-1)??null;
  const baseline=points.filter(p=>p.date===baselineDate);
  const scoped=trusted.filter(s=>s.status==='complete'&&Date.parse(s.capturedAt)===Date.parse(clock)&&date(s.startDate)&&s.startDate<=start&&date(s.endDate)&&s.endDate>=clock.slice(0,10)
   &&s.points.every(p=>date(p.date)&&finite(p.value)));
  const scopeComplete=GROWTH_SOURCES.every(source=>scoped.some(s=>s.source===source));
  const conflicting=conflict([latestDate,baselineDate].filter(Boolean));
  const satisfied=latestDate&&fresh(latestDate,clock)&&baselineDate&&!conflicting;
  const observed=points.filter(p=>p.date>=start&&p.date<=anchor);
  return {days,targetDate:target,baselineStart:start,anchorDate:latestDate,baselineDate,
   state:satisfied?'satisfied':conflicting?'undetermined':observed.length?'observations_incomplete':scopeComplete?'conclusively_no_observations':'undetermined',
   absenceEstablished:!satisfied&&!conflicting&&scopeComplete,
   scopeComplete,sourceScope:GROWTH_SOURCES,missingSourceScopes:GROWTH_SOURCES.filter(source=>!scoped.some(s=>s.source===source)),
   current:latest[0]??null,baseline:baseline[0]??null,observationsInWindow:observed.length,
   reason:conflicting?'conflicting_exact_observations':satisfied?'exact_fresh_baseline_and_current':scopeComplete?'complete_scoped_read_lacks_required_window':'available_sources_do_not_establish_absence'};
 });
}
function retainedGrowthSources(candidate,row,metric,reference){
 const [source,field]=GROWTH_METRICS[metric];
 const sources=[];
 for(const e of row.extended??[]){
  if(!candidate.sourceKeys.includes(e.artist_key)||(e.spotify_artist_id&&!candidate.spotifyIds.includes(e.spotify_artist_id)))continue;
  const stats=e.historic_stats?.stats;
  const history=Array.isArray(stats)?stats.find(s=>String(s.source).toLowerCase()===source)?.data?.history:null;
  if(!Array.isArray(history))continue;
  // A retained endpoint response proves its contents, not that every configured source was exhausted.
  sources.push({source:'licensed_history',metric,artistKey:candidate.artistKey,sourceKeys:candidate.sourceKeys,
   reference:reference+'#extended/'+e.artist_key+'/historic_stats/'+source,capturedAt:row.audit_captured_at,
   status:'partial',points:history.filter(p=>p[field]!=null).map(p=>({date:p.date,value:p[field]}))});
 }
 // Optional complete raw scoped reads, not boolean completeness flags. Kept separate from legacy aggregate keys.
 for(const s of row.source_evidence?.growthObservations??[])sources.push(s);
 return sources;
}
export function classifyFindings(findings,identityUnknown=false){
 const incomplete=identityUnknown||findings.some(f=>f.status==='investigation_required');
 return {classification:incomplete?null:findings.some(f=>f.status==='blocked')?'C':findings.length?'B':'A',auditStatus:incomplete?'incomplete':'complete'};
}
export function createEvidenceEvaluator(baseline){
 assert.equal(typeof baseline.evaluateMonitoringCandidate,'function');
 return {evaluate(candidate,input,clock,{documents=[],reference}={}){
  assert.equal(input.artist_key,candidate.artistKey);assert(reference&&typeof reference==='string');
  assert.equal(new Date(input.audit_captured_at).toISOString(),new Date(clock).toISOString());
  const original=clone(input),reconciled=reconcileCatalogEvidence(candidate,original,documents,reference+'#catalog');
  const row=reconciled.row;
  const prior=baseline.evaluateMonitoringCandidate(clone(candidate),clone(input),new Date(clock));
  const result=clone(baseline.evaluateMonitoringCandidate(clone(candidate),clone(row),new Date(clock)));
  const se=result.sourceEvidence??{},findings=result.findings;
  const remove=codes=>{for(let i=findings.length-1;i>=0;i--)if(codes.includes(findings[i].code))findings.splice(i,1);};
  const catalog=se.catalog??{},summary=row.served_summary??row.summary??{};
  const catalogBound=reconciled.manifest.fullCatalogApplied===true;
  const artworkComplete=catalogBound&&catalog.tracks>0&&catalog.albums>0&&catalog.tracks===catalog.tracksWithArtwork&&catalog.albums===catalog.albumsWithArtwork;
  const temporal={sourceDates:reconciled.manifest.sourceDates??null,sourceDate:catalogBound?summary.snapshot_date:null,
   acquiredAt:catalogBound?summary.fetched_at:null,sourceDateKnown:catalogBound&&date(summary.snapshot_date),
   sourceFresh:catalogBound&&fresh(summary.snapshot_date,clock),identityBound:catalogBound};
  if(catalogBound){
   remove(['full_stream_catalog_unverified']);
   if(!date(summary.snapshot_date)){
    for(const f of findings)if(f.code==='stream_snapshot_stale'){f.status='investigation_required';f.evidence='Source-declared catalog date is unknown or differs between pages; capture time is not a source date.';}
   }
   if(artworkComplete)remove(['missing_track_artwork','missing_album_artwork','live_catalog_fallback_uninvestigated']);
   const mismatch=se.endpointPresenceContractMismatch;
   if(mismatch){
    for(const e of mismatch.endpoints??[])if(e.endpoint==='catalog'){
     e.identityAndCaptureBound=true;e.summarySnapshotDate=summary.snapshot_date;
     e.datasetComplete=artworkComplete&&temporal.sourceFresh&&['track_daily_streams','track_total_streams','album_total_streams'].every(k=>finite(summary[k])&&num(summary[k])>0);
     e.complete=e.datasetComplete;e.alternateSource='kworb_live_complete_catalog';
    }
    const missing=se.missingEndpoints??[];
    mismatch.complete=missing.length>0&&missing.every(k=>(k==='historic_stats'&&row.compact_history?.licensed_endpoint===true)||mismatch.endpoints.some(e=>e.endpoint===k&&e.complete));
    if(mismatch.complete)for(const f of findings)if(['endpoint_presence_contract_mismatch','missing_licensed_endpoint'].includes(f.code)){
     f.status='repairable';f.evidence='Exact existing canonical datasets satisfy the endpoint data requirements. The unchanged public legacy endpoint-presence guard still requires a serving/eligibility repair.';
    }
   }
  }
  const nativeSatisfied=nativeHistorySatisfies(se.youtubeNativeHistoryInspection,se.youtube?.approvedVideos);
  if(nativeSatisfied)remove(['youtube_native_history_contract_mismatch','missing_youtube_daily_history','youtube_native_history_contract_review_required','youtube_native_intraday_fallback_uninvestigated']);
  const growth={};
  for(const metric of Object.keys(GROWTH_METRICS)){
   const windows=growthWindows({metric,artistKey:candidate.artistKey,sourceKeys:candidate.sourceKeys,clock,sources:retainedGrowthSources(candidate,row,metric,reference)});
   if(row.compact_history?.growth_metric_keys?.includes(metric)&&fresh(row.compact_history.metric_latest_dates?.[metric],clock)) {
    for(const w of windows)if(w.state!=='satisfied'&&w.reason!=='conflicting_exact_observations')Object.assign(w,{state:'satisfied',absenceEstablished:false,reason:'verified_configured_compact_projection_checks_each_7_30_90_window'});
   }
   growth[metric]=windows;const code='missing_required_'+metric+'_growth';
   const previous=prior.findings.find(f=>f.code===code)??{code,section:'trends',action:'Resolve exact scoped window evidence without interpreting undiscovered observations as absent.'};
   // A compact aggregate flag is not a substitute for per-window diagnostics; retain an existing
   // successful scoped policy result unless actual contradictory evidence is now established.
   if(windows.every(w=>w.state==='satisfied'))remove([code]);
   else if(previous){
    remove([code]);const conclusive=windows.some(w=>w.absenceEstablished);
    findings.push({...previous,status:conclusive?'blocked':'investigation_required',
     evidence:JSON.stringify({metric,windows:windows.map(w=>({days:w.days,state:w.state,absenceEstablished:w.absenceEstablished,baselineDate:w.baselineDate,anchorDate:w.anchorDate})),
      reason:conclusive?'required_baseline_absent_in_complete_approved_scope':'missing_window_not_proven_absent_across_approved_scope'})});
   }
  }
  const identityUnknown=candidate.identityConflict||!['provider_id','accepted_registry'].includes(candidate.identityMappingStatus)||(row.missing_schema_tables?.length??0)>0
   ||candidate.spotifyIds.some(id=>!/^\w{22}$/.test(id)||id.includes('_'));
  const classification=classifyFindings(findings,identityUnknown);
  return {...result,...classification,publicEligible:false,publicEligibilityEvaluated:false,
   contractValidation:classification.classification==='A'?'full_contract_evidence':'incomplete',
   readinessReasons:[...new Set(findings.map(f=>f.code))],
   evidencePipeline:{version:PIPELINE_VERSION,reference,originalClassification:prior.classification,originalAuditStatus:prior.auditStatus,
    catalog:temporal,catalogArtifactIndependent:catalogBound,artworkComplete,
    nativeHistory:{satisfied:nativeSatisfied,requirement:'cumulative_views',minimumExactDates:2,rangeDays:90,timeZone:'America/New_York',dailyDeltaRequirementUnchanged:true},growth},
   sourceEvidence:se};
 }};
}
