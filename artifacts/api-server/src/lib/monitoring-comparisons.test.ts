import assert from "node:assert/strict";
import test from "node:test";
import { MONITORING_COMPARISONS_SQL } from "./monitoring-comparisons";

const postgresModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
test("fresh comparison peers remain visible when stale larger artists would occupy every slot", { skip: !postgresModule }, async () => {
  const { PGlite } = await import(postgresModule!);
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE kworb_coverage(artist_key text, artist_name text, status text);
      CREATE TABLE songstats_artist_extended_data(artist_key text, historic_stats jsonb);
      CREATE TABLE songstats_artist_daily_snapshots(artist_key text, snapshot_date date,
        spotify_monthly_listeners bigint, youtube_channel_views bigint, instagram_followers bigint);
      CREATE TABLE artist_images(artist_key text, image_url text);
      INSERT INTO kworb_coverage SELECT 'stale'||n, 'Stale '||n, 'active' FROM generate_series(1,4) n;
      INSERT INTO kworb_coverage VALUES ('fresh','Fresh','active'),('self','Self','active'),('zero','Zero','active'),('future','Future','active');
      INSERT INTO songstats_artist_extended_data SELECT artist_key,'{}'::jsonb FROM kworb_coverage;
      INSERT INTO songstats_artist_daily_snapshots SELECT artist_key,'2026-01-01',1000000,NULL,NULL FROM kworb_coverage;
      INSERT INTO songstats_artist_daily_snapshots VALUES ('fresh','2026-08-10',100,NULL,NULL),
        ('self','2026-08-10',200,NULL,NULL),('zero','2026-08-10',0,NULL,NULL),('future','2026-08-20',300,NULL,NULL);`);
    const result = await db.query(MONITORING_COMPARISONS_SQL, [["self"], "2026-08-10T12:00:00Z"]);
    assert.deepEqual(result.rows.map((row: { artist_key: string }) => row.artist_key), ["fresh"]);
    assert.equal(result.rows[0].spotify_monthly_listeners, 100);
  } finally { await db.close(); }
});
