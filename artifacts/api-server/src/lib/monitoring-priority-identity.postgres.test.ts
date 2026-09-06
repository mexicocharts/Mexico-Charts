import assert from "node:assert/strict";
import test from "node:test";
import { buildMonitoringPriorityIdentitySql, loadMonitoringPriorityArtistIdentity } from "./monitoring-priority-identity";

const fixtureModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
const schema = `
  CREATE TABLE kworb_coverage(artist_key text PRIMARY KEY,spotify_id text,last_fetch_at timestamptz);
  CREATE TABLE spotify_artists(artist_key text PRIMARY KEY,spotify_artist_id text,verified boolean,spotify_image_url text,spotify_last_updated timestamptz);
  CREATE TABLE songstats_artists(artist_key text PRIMARY KEY,spotify_artist_id text,avatar_url text,last_synced_at timestamptz);
  CREATE TABLE songstats_artist_extended_data(artist_key text PRIMARY KEY,spotify_artist_id text,updated_at timestamptz);
  CREATE TABLE songstats_history_provider_identities(artist_key text PRIMARY KEY,spotify_artist_id text,validation_status text,verified_at timestamptz);
  CREATE TABLE artist_images(artist_key text PRIMARY KEY,image_url text);
`;
async function fixture(run: (database: any) => Promise<void>) {
  const { PGlite } = await import(fixtureModule!);
  const database = new PGlite();
  try { await database.exec(schema); await run(database); }
  finally { await database.close(); }
}

test("verified Spotify identity and artwork survive absent Kworb coverage", { skip: !fixtureModule }, async () => fixture(async db => {
  await db.exec(`INSERT INTO spotify_artists VALUES
    ('spotify only','0000000000000000000001',true,'https://example.com/verified.jpg','2026-09-06'),
    ('unverified only','0000000000000000000002',false,'https://example.com/unverified.jpg','2026-09-06');
    INSERT INTO artist_images VALUES ('image only','https://example.com/artist.jpg');
    INSERT INTO songstats_artists VALUES ('songstats only','0000000000000000000003','https://example.com/songstats.jpg','2026-09-06');
    INSERT INTO songstats_artist_extended_data VALUES ('extended only','0000000000000000000004','2026-09-06');
    INSERT INTO songstats_history_provider_identities VALUES ('history only','0000000000000000000005','verified','2026-09-06'),('review only','0000000000000000000006','review','2026-09-06')`);
  const oldResult = await db.query("SELECT coverage.spotify_id FROM kworb_coverage coverage WHERE lower(coverage.artist_key)=ANY($1::text[]) LIMIT 1", [["spotify only"]]);
  assert.equal(oldResult.rows.length, 0, "the old starting relation omits this real stored identity");
  const lookup = async (key: string) => (await db.query(buildMonitoringPriorityIdentitySql(), [[key]])).rows[0];
  const spotify = await lookup("spotify only");
  assert.equal(spotify.spotify_artist_id, "0000000000000000000001");
  assert.equal(spotify.avatar_url, "https://example.com/verified.jpg");
  assert.equal(spotify.avatar_source, "spotify_artists");
  assert.equal(spotify.provider_sources[0].artist_key, "spotify only");
  assert.equal(spotify.identity_conflict, false);
  for (const key of ["unverified only", "review only", "unmapped"]) {
    const row = await lookup(key);
    assert.equal(row.spotify_artist_id, null);
    assert.equal(row.avatar_url, null);
    assert.deepEqual(row.provider_sources, []);
  }
  assert.equal((await lookup("songstats only")).avatar_source, "songstats_artists");
  assert.equal((await lookup("extended only")).spotify_artist_id, "0000000000000000000004");
  assert.equal((await lookup("history only")).spotify_artist_id, "0000000000000000000005");
  assert.equal((await lookup("image only")).avatar_url, "https://example.com/artist.jpg");
  assert.equal((await lookup("image only")).spotify_artist_id, null);
}));

test("disagreeing exact-key provider mappings cannot start a live catalog fetch", { skip: !fixtureModule }, async () => fixture(async db => {
  await db.exec(`INSERT INTO kworb_coverage VALUES ('conflict','0000000000000000000007','2026-09-06');
    INSERT INTO spotify_artists VALUES ('conflict','0000000000000000000008',true,'https://example.com/provider.jpg','2026-09-06');
    INSERT INTO songstats_artists VALUES ('conflict','0000000000000000000007','https://example.com/songstats.jpg','2026-09-06');
    INSERT INTO artist_images VALUES ('conflict','https://example.com/exact-artist.jpg'),('conflicting other','https://example.com/unrelated.jpg')`);
  const row = (await db.query(buildMonitoringPriorityIdentitySql(), [["conflict"]])).rows[0];
  assert.equal(row.spotify_artist_id, null);
  assert.equal(row.identity_conflict, true);
  assert.equal(row.provider_sources.length, 3);
  assert.equal(row.avatar_url, "https://example.com/exact-artist.jpg", "provider-independent exact artist artwork remains inspectable");
  assert.equal(row.avatar_source, "artist_images");
  assert.ok(row.provider_sources.every((source: { artist_key: string }) => source.artist_key === "conflict"));
}));

test("conflict inspection stays on its exact canonical key and never normalizes unrelated names", { skip: !fixtureModule }, async () => fixture(async db => {
  await db.exec(`INSERT INTO spotify_artists VALUES
    ('canonical','0000000000000000000009',true,'https://example.com/canonical.jpg','2026-09-06'),
    ('other','0000000000000000000010',true,'https://example.com/other.jpg','2026-09-06'),
    ('x','0000000000000000000011',true,'https://example.com/ascii.jpg','2026-09-06');
    INSERT INTO artist_images VALUES ('X東京','https://example.com/unicode.jpg')`);
  const pool = { query: (sql: string, values: unknown[]) => db.query(sql, values) };
  const combined = await loadMonitoringPriorityArtistIdentity(pool as never, ["canonical", "other"]);
  assert.equal(combined[0]?.spotify_artist_id, null);
  const restricted = await loadMonitoringPriorityArtistIdentity(pool as never, ["canonical", "other"], { identityConflict: true, canonicalArtistKey: "canonical" });
  assert.equal(restricted[0]?.spotify_artist_id, "0000000000000000000009");
  assert.equal(restricted[0]?.avatar_url, "https://example.com/canonical.jpg");
  assert.ok(restricted[0]?.provider_sources.every(source => source.artist_key === "canonical"));
  const unicode = await loadMonitoringPriorityArtistIdentity(pool as never, ["X東京"]);
  assert.equal(unicode[0]?.spotify_artist_id, null);
  assert.equal(unicode[0]?.avatar_source_artist_key, "X東京");
  const empty = await loadMonitoringPriorityArtistIdentity(pool as never, []);
  assert.equal(empty[0]?.spotify_artist_id, null);
}));

test("malformed asserted Spotify IDs remain diagnostic and never reach the live provider fallback", { skip: !fixtureModule }, async () => fixture(async db => {
  const malformed = "3CsPxFJGyNa9ep79CFWN8xSR";
  assert.notEqual(malformed.length, 22);
  await db.query("INSERT INTO kworb_coverage VALUES ($1,$2,'2026-09-06'),($3,$2,'2026-09-06')", ["malformed only", malformed, "valid plus malformed"]);
  await db.exec("INSERT INTO spotify_artists VALUES ('valid plus malformed','0000000000000000000001',true,'https://example.com/verified.jpg','2026-09-06')");
  for (const key of ["malformed only", "valid plus malformed"]) {
    const row = (await db.query(buildMonitoringPriorityIdentitySql(), [[key]])).rows[0];
    assert.equal(row.spotify_artist_id, null, "dashboard cannot enter its Spotify-ID-gated live catalog call");
    assert.deepEqual(row.malformed_provider_ids, [malformed]);
    assert.ok(row.provider_sources.some((source: { spotify_artist_id: string }) => source.spotify_artist_id === malformed));
    assert.equal(row.identity_conflict, key === "valid plus malformed", "an invalid assertion is not silently discarded to resolve a conflict");
  }
}));
