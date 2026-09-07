/** Authoritative founder-approved product policy. Pure evaluation; no I/O, public publication or provider writes.
 * Callers supply verified source evidence, not claims from users or untrusted payload instructions.
 */
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export const MONITOR_PRO_PRODUCT_CONTRACT=freeze({
 version:'monitor_pro_founder_2026_09_07_v1',authority:'founder_decision_2026_09_07',
 required:['canonical_identity','songstats_spotify_monthly_listeners','songstats_youtube_subscribers','usable_music_catalog','approved_video_views','mexico_market','core_comparable_history','reliable_serving'],
 coreAudienceSource:'songstats',coreAudienceMaximumAgeDays:14,
 artwork:'accept_correctly_matched_spotify_or_deezer_artwork_without_visual_review',
 qualityWarnings:['secondary_audience_metrics','catalog_coverage','artwork_coverage','video_freshness','video_import_coverage'],
 sectionRequirements:['growth_windows','measured_video_deltas','per_video_history','spotify_aggregate_history','daily_pulse','comparison_peers'],
 founderAccess:'verified_founder_may_inspect_approved_roster_independent_of_eligibility',
 forbiddenEligibilityGates:['endpoint_object_count','positive_platform_count','all_growth_windows','all_catalog_items','all_artwork','all_fresh_videos','all_video_deltas','all_video_history','audit_artifact_flags'],
 protectedYoutube:'no_validation_semantic_provenance_quota_cadence_or_relationship_changes',
});
const validValue=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function sourceFreshness(observedDate,asOf,maximumDays=14){
 if(!validDate(observedDate))return 'unknown';
 const age=(Date.parse(asOf)-Date.parse(observedDate))/86400000;
 return !Number.isFinite(age)||age < -1?'unknown':age<=maximumDays?'current':'stale';
}
export function providerArtworkAccepted(item){
 return item?.identityMatchAccepted===true&&['spotify','deezer'].includes(item.provider)&&typeof item.providerObjectId==='string'&&item.providerObjectId.length>0&&typeof item.artworkUrl==='string'&&/^https?:\/\//.test(item.artworkUrl)&&Boolean(item.sourceRef);
}
const section=(availability,freshness='unknown',detail={})=>({availability,freshness,...detail});
export function evaluateFounderContract(e,context){
 if(!Number.isFinite(Date.parse(context.asOf)))throw Error('Explicit valid evaluation clock required');
 const hardBlockers=[],warnings=[],requirements={};
 const check=(id,passes,reason,unknown=false)=>{requirements[id]={status:passes?'satisfied':unknown?'unknown':'unsatisfied'};if(!passes)hardBlockers.push({code:reason,requirement:id,kind:unknown?'evidence_unknown':'product_data_gap'});};
 check('canonical_identity',e.identity?.verified===true&&e.identity?.coreConflict===false&&Boolean(e.identity?.sourceRef),'canonical_identity_unverified_or_conflicting',e.identity?.verified!==true);
 const audience={};
 for(const [key,id] of [['spotifyMonthlyListeners','songstats_spotify_monthly_listeners'],['youtubeSubscribers','songstats_youtube_subscribers']]){
  const r=e.audience?.[key],freshness=sourceFreshness(r?.observedDate,context.asOf);
  const valid=r?.source==='songstats'&&r?.identityMatched===true&&r?.materializationMatchesSource===true&&validValue(r?.value)&&Boolean(r?.sourceRef);
  check(id,valid&&freshness==='current',!valid?'invalid_or_unverified_'+id:freshness==='unknown'?'unknown_date_'+id:'stale_'+id,!valid||freshness==='unknown');
  audience[key]={value:valid?r.value:null,source:'songstats',sourceRef:r?.sourceRef??null,observedDate:r?.observedDate??null,freshness};
 }
 check('usable_music_catalog',e.catalog?.matchedTracks>0&&e.catalog?.hasMeasuredStreams===true&&e.catalog?.identityMatched===true&&Boolean(e.catalog?.sourceRef),'usable_matched_catalog_not_established',e.catalog?.verified!==true);
 check('approved_video_views',e.youtube?.approvedObservedVideos>0&&e.youtube?.relationshipsVerified===true&&Boolean(e.youtube?.sourceRef),'approved_video_views_not_established',e.youtube?.relationshipsVerified!==true);
 check('mexico_market',e.mexico?.observations>0&&e.mexico?.genuineMarketEvidence===true&&Boolean(e.mexico?.sourceRef),'mexico_market_evidence_not_established',e.mexico?.genuineMarketEvidence!==true);
 const histories=(e.coreHistories??[]).filter(h=>['spotifyMonthlyListeners','youtubeSubscribers','spotifyAggregateStreams','youtubeVideoViews'].includes(h.metric)&&h.identityMatched===true&&h.sameMeasure===true&&Boolean(h.sourceRef)&&h.points?.length>=2&&h.points.every(p=>validDate(p.date)&&validValue(p.value))&&new Set(h.points.map(p=>p.date)).size>=2&&h.points.every(p=>Date.parse(p.date)<=Date.parse(context.asOf)));
 check('core_comparable_history',histories.length>0,'comparable_core_history_not_established',e.coreHistoryScopeComplete!==true);
 const serving=context.serving??{status:'unknown'};
 const servingVerified=serving.status==='verified'&&Boolean(serving.sourceRef);
 requirements.reliable_serving={status:servingVerified?'satisfied':serving.status==='failed'||serving.status==='repair_required'?'unsatisfied':'unknown'};
 if(!servingVerified)hardBlockers.push({code:serving.status==='repair_required'?'serving_repair_required':serving.status==='failed'?'serving_failed':'serving_not_verified',requirement:'reliable_serving',kind:serving.status==='repair_required'?'repairable_serving_gap':serving.status==='failed'?'operational_failure':'operational_unknown'});
 const y=e.youtube??{},total=y.approvedVideos??0;
 const videoObservationFreshness=typeof y.freshVideos==='number'&&total>0?(y.freshVideos===total?'current':'stale'):'unknown';
 const videoFreshness=context.youtubeCollector?.paused===true?'paused':videoObservationFreshness;
 const sections={audience:section(Object.values(audience).every(r=>r.value!==null)?'available':'unavailable',Object.values(audience).every(r=>r.freshness==='current')?'current':'unknown',{readings:audience}),
  catalog:section(e.catalog?.matchedTracks>0?'available':'unavailable',sourceFreshness(e.catalog?.sourceDate,context.asOf),{tracks:e.catalog?.matchedTracks??0,albums:e.catalog?.albums??null,coverage:e.catalog?.coverage??'unknown'}),
  mexico:section(e.mexico?.observations>0?'available':'unavailable',sourceFreshness(e.mexico?.sourceDate,context.asOf),{dateEvidence:e.mexico?.dateEvidence??'unknown',observations:e.mexico?.observations??0}),
  videoViews:section(y.approvedObservedVideos>0?(y.approvedObservedVideos===total?'available':'partial'):'unavailable',videoFreshness,{observed:y.approvedObservedVideos??0,total,observationFreshness:videoObservationFreshness,latestObservedAt:y.latestObservedAt??null,pauseSource:context.youtubeCollector?.sourceRef??null}),
  videoDeltas:section(y.videosWithMeasuredDelta>0?(y.videosWithMeasuredDelta===total?'available':'partial'):'unavailable',videoFreshness,{covered:y.videosWithMeasuredDelta??0,total}),
  videoHistory:section(y.videosWithComparableHistory>0?(y.videosWithComparableHistory===total?'available':'partial'):'unavailable',videoFreshness,{covered:y.videosWithComparableHistory??0,total,measure:'cumulative_views',rangeDays:90}),
  spotifyAggregateHistory:section(e.spotifyHistory?.days>=2?'available':e.spotifyHistory?.days>0?'partial':'unavailable',sourceFreshness(e.spotifyHistory?.lastDate,context.asOf),{days:e.spotifyHistory?.days??null}),
  dailyPulse:section(e.pulse?.complete===true?'available':'unavailable',sourceFreshness(e.pulse?.currentDate,context.asOf)),
  comparisons:section(e.comparisons?.freshPeers>0?'available':'unavailable',e.comparisons?.freshPeers>0?'current':'unknown'),
  growth:section('unavailable','unknown',{windows:{}})};
 let availableWindows=0,totalWindows=0;
 for(const [metric,windows] of Object.entries(e.growth??{})){
  sections.growth.windows[metric]=windows.map(w=>{totalWindows++;const available=w.state==='satisfied';if(available)availableWindows++;return {days:w.days,availability:available?'available':'unavailable',evidenceState:w.state,baselineDate:w.baselineDate??null,anchorDate:w.anchorDate??null};});
 }
 sections.growth.availability=availableWindows===0?'unavailable':availableWindows===totalWindows?'available':'partial';
 sections.growth.freshness='per_window';
 if(e.catalog?.coverage!=='complete_provider_catalog')warnings.push({code:'catalog_coverage_not_provider_wide',detail:e.catalog?.coverage??'unknown'});
 if(e.artwork?.complete!==true)warnings.push({code:'partial_or_unknown_artwork_coverage',detail:'Correctly matched Spotify/Deezer artwork is accepted. Missing artwork uses a neutral fallback.'});
 if(videoFreshness!=='current')warnings.push({code:'per_video_collector_'+videoFreshness,affects:'video_sections_only',songstatsAudienceUnaffected:true});
 if(y.importComplete!==true||y.approvedObservedVideos!==total)warnings.push({code:'partial_or_unknown_video_coverage'});
 if(sections.videoDeltas.availability!=='available')warnings.push({code:'partial_video_deltas'});
 if(sections.videoHistory.availability!=='available')warnings.push({code:'partial_video_history'});
 if(sections.growth.availability!=='available')warnings.push({code:'partial_growth_windows'});
 if(sections.mexico.freshness!=='current')warnings.push({code:'mexico_market_date_'+sections.mexico.freshness});
 const dataBlockers=hardBlockers.filter(b=>b.requirement!=='reliable_serving');
 return {contractVersion:MONITOR_PRO_PRODUCT_CONTRACT.version,artistKey:e.artistKey,artistName:e.artistName,asOf:context.asOf,
  artistEligibility:{status:hardBlockers.length===0?'eligible':hardBlockers.some(b=>b.kind.endsWith('unknown'))?'unresolved':'not_eligible',
   dataMinimumsSatisfied:dataBlockers.length===0,hardBlockers:hardBlockers.filter(b=>!b.kind.endsWith('unknown')),unverifiedHardRequirements:hardBlockers.filter(b=>b.kind.endsWith('unknown'))},requirements,sections,warnings,
  serving:{...serving,productionAcceptanceClaimed:servingVerified},
  founderAccess:{inspectionAllowed:context.viewer?.verifiedFounder===true&&context.viewer?.approvedRosterRoute===true,independentOfEligibility:true},
  publication:{productionEligibilityChanged:false,publicAccessGranted:false},
  provenance:e.provenance};
}
