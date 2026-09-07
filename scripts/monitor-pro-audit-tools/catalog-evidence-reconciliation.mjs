import assert from 'node:assert/strict';
// Job1 only. A source document's acquisition time never substitutes for its data date.
export const CATALOG_CODES=new Set(['missing_stream_catalog','full_stream_catalog_unverified','live_catalog_fallback_uninvestigated','missing_daily_streams','missing_lifetime_streams','stream_snapshot_stale','missing_track_artwork','missing_album_artwork','endpoint_presence_contract_mismatch','missing_licensed_endpoint']);
const clone=x=>JSON.parse(JSON.stringify(x));
export function reconcileCatalogEvidence(candidate,row,documents,reference){
 const manifest={artistKey:candidate.artistKey,artistName:candidate.artistName,identityDeferred:false,
  stored:{items:row.stream_items?.length??0,artworkCache:row.stored_artwork?.length??0,kworbTopTracks:row.kworb_payload?.topTracks??[],kworbDeclaredTrackCount:row.kworb_payload?.trackCount??null,
   licensedCatalogs:(row.extended??[]).filter(e=>e.catalog).map(e=>({artistKey:e.artist_key,spotifyArtistId:e.spotify_artist_id,songstatsArtistId:e.songstats_artist_id,fetchedAt:e.catalog_fetched_at,payload:e.catalog}))},
  partialLicensedItems:(row.extended??[]).flatMap(e=>(Array.isArray(e.catalog?.catalog)?e.catalog.catalog:[]).map(item=>({source:'songstats_artist_extended_data.catalog',sourceArtistKey:e.artist_key,sourceSpotifyArtistId:e.spotify_artist_id,sourceSongstatsArtistId:e.songstats_artist_id,acquiredAt:e.catalog_fetched_at??null,sourceItem:item,completenessCertified:false}))),
  fullCatalogApplied:false,artworkCompletenessVerified:false,sourceAbsenceEstablished:false,reason:'no_complete_identity_bound_capture'};
 if(candidate.identityConflict||!['provider_id','accepted_registry'].includes(candidate.identityMappingStatus)||candidate.spotifyIds.length!==1){manifest.identityDeferred=true;manifest.reason='identity_review_deferred';return {row,manifest};}
 const id=candidate.spotifyIds[0];const found=documents.filter(d=>d.source.spotifyId===id);
 const byKind=kind=>found.filter(d=>d.source.kind===kind).sort((a,b)=>b.source.fetchedAt.localeCompare(a.source.fetchedAt));
 const tracks=byKind('songs')[0],albums=byKind('albums')[0];
 if(!tracks||!albums)return {row,manifest};
 for(const doc of [tracks,albums]){
  assert(doc.scope==='complete_captured_kworb_table_not_all_spotify_objects');
  assert(doc.allRowsAccounted===true&&doc.observedCount===doc.items.length&&doc.expectedCount===doc.items.length&&doc.items.length>0);
  assert(doc.source.httpStatus===200&&/^[a-f0-9]{64}$/.test(doc.source.sha256));
  assert(Number.isFinite(Date.parse(doc.source.fetchedAt)));
  assert(doc.sourceDate==null||(/^\d{4}-\d{2}-\d{2}$/.test(doc.sourceDate)&&new Date(doc.sourceDate).toISOString().slice(0,10)===doc.sourceDate));
  assert(new Set(doc.items.map(i=>i.item_key)).size===doc.items.length);
  assert(doc.items.every(i=>i.item_key&&i.title&&i.item_type===(doc.source.kind==='songs'?'track':'album')));
  assert(doc.source.url===`https://kworb.net/spotify/artist/${id}_${doc.source.kind}.html`);
 }
 // Do not apply evidence acquired after the fixed original evaluation clock.
 if([tracks,albums].some(d=>Date.parse(d.source.fetchedAt)>Date.parse(row.audit_captured_at))){manifest.reason='capture_after_audit_clock';return {row,manifest};}
 const items=[...tracks.items,...albums.items];
 const sum=(group,key)=>group.every(i=>Number.isSafeInteger(i[key])&&i[key]>=0)&&Number.isSafeInteger(group.reduce((n,i)=>n+i[key],0))?group.reduce((n,i)=>n+i[key],0):null;
 const updated=clone(row);updated.stream_items=clone(items);
 const date=tracks.sourceDate===albums.sourceDate?(tracks.sourceDate??null):null;
 updated.served_summary={snapshot_date:date,track_count:tracks.items.length,album_count:albums.items.length,
  track_daily_streams:sum(tracks.items,'dailyStreams'),track_total_streams:sum(tracks.items,'totalStreams'),album_total_streams:sum(albums.items,'totalStreams'),
  source_table:'kworb_live_complete_catalog',provenance:'derived_exact_sum_of_captured_source_items',source_reference:reference,
  fetched_at:[tracks.source.fetchedAt,albums.source.fetchedAt].sort().at(-1)};
 updated.source_evidence={...updated.source_evidence,catalogCompleteness:{verified:true,reference,source:'kworb_live_complete_catalog',spotifyArtistId:id,
  expectedTracks:tracks.expectedCount,expectedAlbums:albums.expectedCount,scope:tracks.scope},
  liveCatalogInvestigation:{status:'reviewed',source:'kworb_live_complete_catalog',reference,spotifyArtistId:id,
   sourceDates:{tracks:tracks.sourceDate??null,albums:albums.sourceDate??null},sourceObservedDate:date??null,acquiredAt:updated.served_summary.fetched_at,catalogEvidenceApplied:true,artworkEvidenceApplied:false}};
 manifest.fullCatalogApplied=true;manifest.reason='complete_captured_source_catalog_applied_artwork_fallback_unverified';
 manifest.sources=[tracks.source,albums.source];manifest.expected={tracks:tracks.expectedCount,albums:albums.expectedCount};
 manifest.observed={tracks:tracks.items.length,albums:albums.items.length};manifest.sourceDates={tracks:tracks.sourceDate,albums:albums.sourceDate};
 manifest.summary=updated.served_summary;manifest.items=items;
 manifest.artworkPolicy='Existing evaluator artist-scoped title matching remains unchanged; no new item-ID equivalence or enrichment certified.';
 return {row:updated,manifest};
}
