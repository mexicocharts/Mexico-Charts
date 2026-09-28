import assert from "node:assert/strict";
import test from "node:test";
import { indexedVideoInventorySql, indexedMonitoringPopulationSql, videoInventoryNameKeys, videoInventoryNamesSql, VIDEO_INVENTORY_SOURCES, MONITORING_HISTORY_IDENTITY_SQL } from "./monitoring-candidate-inventory";
import { groupMonitoringCandidateIdentities, type MonitoringCandidateSourceRow } from "./monitoring-candidate-policy";

const fixtureModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
test("history presence preserves DISTINCT rows, exact keys, duplicates and absent keys", { skip: !fixtureModule }, async () => {
  const { PGlite } = await import(fixtureModule!);
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE songstats_historical_observations(artist_key text); CREATE INDEX ON songstats_historical_observations(artist_key)");
    for (const key of ["natanaelcano", "natanaelcano", "Natanael Cano", "other", "", null]) {
      await db.query("INSERT INTO songstats_historical_observations VALUES ($1)", [key]);
    }
    for (const keys of [[], ["absent"], ["natanaelcano", "natanaelcano", "natanael-cano", "Natanael Cano", "", null]]) {
      const original = await db.query("SELECT DISTINCT artist_key,NULL::text artist_name,NULL::text spotify_id,'songstats_historical_observations'::text source FROM songstats_historical_observations WHERE artist_key=ANY($1::text[])", [keys]);
      const optimized = await db.query(MONITORING_HISTORY_IDENTITY_SQL, [keys]);
      const ordered = (rows: unknown[]) => rows.map(row => JSON.stringify(row)).sort();
      assert.deepEqual(ordered(optimized.rows), ordered(original.rows));
    }
  } finally { await db.close(); }
});
test("indexed inventory retains exact grouped identity and names without scanning named artists' video payloads", { skip: !fixtureModule }, async () => {
  const { PGlite } = await import(fixtureModule!);
  const db = new PGlite();
  try {
    for (const table of VIDEO_INVENTORY_SOURCES) {
      await db.exec(`CREATE TABLE ${table}(artist_key text,artist_name text,video_id text);
        CREATE INDEX ON ${table}(artist_key,video_id)`);
      for (const [artist_key, artist_name] of [["known alias", "Video Name"], ["known alias", "Another Name"],
        ["only videos", "Z name"], ["only videos", "A name"], ["only videos", null],
        ["empty primary name", "Recovered name"], ["東京", "東京"], ["álpha", "Name"], ["álpha", "Other"],
        ["", "invalid"], [null, "invalid"], ["only videos", "A name"]]) {
        await db.query(`INSERT INTO ${table} VALUES ($1,$2,$3)`, [artist_key, artist_name, "video"]);
      }
    }
    const base: MonitoringCandidateSourceRow[] = [
      { artist_key: "known", artist_name: "Canonical Name", spotify_id: "0000000000000000000001", source: "kworb_coverage" },
      { artist_key: "known", artist_name: "Canonical Name", spotify_id: null, source: "musicbrainz_artists", mbid: "accepted", verified: "auto", declared_aliases: ["known alias"] },
      { artist_key: "empty primary name", artist_name: "  ", spotify_id: null, source: "official_artists" },
    ];
    const original = [...base];
    const optimized = [...base];
    for (const table of VIDEO_INVENTORY_SOURCES) {
      original.push(...(await db.query(`SELECT DISTINCT artist_key,artist_name,NULL::text spotify_id,'${table}'::text source FROM ${table}`)).rows);
      optimized.push(...(await db.query(indexedVideoInventorySql(table))).rows);
    }
    const keys = videoInventoryNameKeys(optimized);
    assert.ok(!keys.includes("known alias"), "accepted aliases retain the higher-priority canonical name");
    assert.ok(keys.includes("only videos"));
    assert.ok(keys.includes("empty primary name"));
    for (const table of VIDEO_INVENTORY_SOURCES) optimized.push(...(await db.query(videoInventoryNamesSql(table), [keys])).rows);
    assert.deepEqual(groupMonitoringCandidateIdentities(optimized), groupMonitoringCandidateIdentities(original));
    for (const table of VIDEO_INVENTORY_SOURCES) {
      await db.exec(`DELETE FROM ${table}`);
      assert.deepEqual((await db.query(indexedVideoInventorySql(table))).rows, []);
    }
  } finally { await db.close(); }
});

test("replacement is confined to the two video inventory branches", () => {
  const other = "SELECT artist_key,artist_name,spotify_id,'kworb_coverage' source FROM kworb_coverage";
  const original = [other, ...VIDEO_INVENTORY_SOURCES.map(table => `SELECT DISTINCT artist_key, artist_name, NULL, '${table}' FROM ${table}`)].join(" UNION ALL ");
  const optimized = indexedMonitoringPopulationSql(original);
  assert.ok(optimized.startsWith(other));
  assert.equal((optimized.match(/WITH RECURSIVE/g) ?? []).length, 2);
  assert.throws(() => indexedVideoInventorySql("other" as never));
  assert.throws(() => videoInventoryNamesSql("other" as never));
});
