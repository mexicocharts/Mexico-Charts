import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assertSongstatsArtistAllowed, isSongstatsArtistExcluded, songstatsArtistSelectionPredicate } from "./songstats-artist-exclusions";
import { fetchLicensedSongstatsArtistHistory } from "./songstats-history-client";

test("excluded live requests cannot acquire a database connection, claim usage or fetch", async () => {
  process.env.NEON_DATABASE_URL = "postgresql://test:test@127.0.0.1:1/never_connect";
  const { pool } = await import("@workspace/db");
  const { claimSongstatsMonthlyArtist } = await import("./songstats-billing-guard");
  const { getSongstatsArtistCurrentStats } = await import("./songstats-client");
  const originalQuery = pool.query, originalConnect = pool.connect, originalFetch = globalThis.fetch;
  let calls = 0;
  const forbidden = () => { calls++; throw Error("unexpected IO"); };
  pool.query = forbidden as typeof pool.query;
  pool.connect = forbidden as typeof pool.connect;
  globalThis.fetch = forbidden;
  try {
    for (const id of [{ spotifyArtistId: "4q3ewBCX7sLwd24euuV69X" }, { songstatsArtistId: "xmcd3klh" }, { appleMusicArtistId: 1126808565 }]) {
      await assert.rejects(claimSongstatsMonthlyArtist(id, "/artists/stats"), { name: "SongstatsArtistExcludedError" });
      await assert.rejects(getSongstatsArtistCurrentStats(id), { name: "SongstatsArtistExcludedError" });
    }
    assert.equal(calls, 0);
  } finally {
    pool.query = originalQuery; pool.connect = originalConnect; globalThis.fetch = originalFetch;
  }
});

test("owner exclusion matches known provider identifiers, not arbitrary artist names", () => {
  for (const identity of [{ spotifyArtistId: "4q3ewBCX7sLwd24euuV69X" }, { songstatsArtistId: "xmcd3klh" }, { appleMusicArtistId: 1126808565 }]) {
    assert.equal(isSongstatsArtistExcluded(identity), true);
    assert.throws(() => assertSongstatsArtistAllowed(identity), { name: "SongstatsArtistExcludedError" });
  }
  for (const spotifyArtistId of ["12GqGscKJx3aE4t07u7eVZ", "2nszmSgqreHSdJA3zWPyrW", "0elWFr7TW8piilVRYJUe4P"])
    assert.doesNotThrow(() => assertSongstatsArtistAllowed({ spotifyArtistId }));
});

test("history requests reject the excluded identity before fetch or credential access", async () => {
  const before = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error("must not fetch"); };
  try {
    await assert.rejects(fetchLicensedSongstatsArtistHistory({ songstatsArtistId: "xmcd3klh", startDate: "2020-01-01", endDate: "2026-09-27" }),
      { name: "SongstatsArtistExcludedError" });
    assert.equal(calls, 0);
  } finally { globalThis.fetch = before; }
});

test("billing exclusion precedes schema, accounting, repeat-usage increments and fetch", () => {
  const billing = readFileSync(new URL("./songstats-billing-guard.ts", import.meta.url), "utf8");
  const claim = billing.slice(billing.indexOf("export async function claimSongstatsMonthlyArtist"));
  assert.ok(claim.indexOf("assertSongstatsArtistAllowed(identifier)") < claim.indexOf("ensureSongstatsBillingUsageTable()"));
  assert.ok(claim.indexOf("assertSongstatsArtistAllowed(identifier)") < claim.indexOf("pool.connect()"));
  const client = readFileSync(new URL("./songstats-client.ts", import.meta.url), "utf8");
  assert.ok(client.indexOf("await claimSongstatsMonthlyArtist(identifier, endpoint)") < client.indexOf("await fetch(url"));
  assert.doesNotMatch(billing, /DELETE FROM|TRUNCATE|DROP TABLE/);
  for (const file of ["songstats-snapshot-service.ts", "songstats-snapshot-scheduler.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /songstatsArtistSelectionPredicate\("COALESCE\(c.spotify_id, s.spotify_artist_id\)"\)/);
  }
  assert.match(songstatsArtistSelectionPredicate("id"), /4q3ewBCX7sLwd24euuV69X/);
});
