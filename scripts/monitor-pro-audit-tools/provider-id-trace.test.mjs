import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const sql=await fs.readFile(new URL('./provider-id-trace.sql',import.meta.url),'utf8');
const modulePath=process.env.MONITOR_HISTORY_PGLITE_MODULE;
test('provider trace executes real schema columns and preserves source identities', {skip:!modulePath}, async()=>{
 const {PGlite}=await import(modulePath);const db=new PGlite();
 try {
  await db.exec(`CREATE TABLE spotify_artists(artist_key text,spotify_artist_id text,spotify_last_updated timestamptz,verified boolean);
   CREATE TABLE monitoring_stream_items(artist_key text,item_key text,item_type text,last_seen_at timestamptz,title text);
   CREATE TABLE songstats_history_provider_identities(id int,artist_key text,spotify_artist_id text,verified_at timestamptz,updated_at timestamptz,created_at timestamptz,validation_status text);
   CREATE TABLE songstats_historical_observations(id int,artist_key text,provider_identity_id int,provider_observation_date date,acquisition_mode text,value numeric);
   INSERT INTO spotify_artists VALUES('different display key','exact-provider','2026-09-05',true),('unrelated','other-provider','2026-09-05',true);
   INSERT INTO monitoring_stream_items VALUES('existing catalog key','track-id','track','2026-09-05','Original track'),('wrong type','track-id','album','2026-09-05','Do not match type');
   INSERT INTO songstats_history_provider_identities VALUES(1,'history alias','exact-provider',null,'2026-09-05','2026-09-01','review');
   INSERT INTO songstats_historical_observations VALUES(2,'original observation key',1,'2026-09-04','songstats_historical',123.45),(3,'original observation key',1,'2026-09-04','other_mode',999);`);
  const result=await db.query(sql,[['exact-provider'],['track-id'],[]]);
  assert.equal(result.rows.length,4);
  assert.equal(result.rows.find(r=>r.source_table==='spotify_artists').source_id,'exact-provider');
  assert.equal(result.rows.find(r=>r.source_table==='monitoring_stream_items').original_row.title,'Original track');
  assert.equal(result.rows.find(r=>r.source_table==='songstats_history_provider_identities').original_row.validation_status,'review');
  assert.equal(result.rows.find(r=>r.source_category==='history').source_key,'original observation key');
  assert.equal(result.rows.find(r=>r.source_category==='history').original_row.value,123.45);
  assert.equal((await db.query(sql,[['missing'],[],[]])).rows.length,0);
  await assert.rejects(db.query(sql.replaceAll('s.spotify_artist_id','s.spotify_id'),[['exact-provider'],[],[]]),e=>e.code==='42703');
 } finally {await db.close();}
});
