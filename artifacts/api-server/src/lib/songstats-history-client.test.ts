import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  fetchLicensedSongstatsArtistHistory,
  SONGSTATS_HISTORY_ONLY_ENDPOINT,
} from "./songstats-history-client";

test("dedicated history client can call only the licensed historic_stats endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env["SONGSTATS_API_KEY"];
  let requested: URL | null = null;
  process.env["SONGSTATS_API_KEY"] = "test-key";
  globalThis.fetch = (async input => {
    requested = new URL(String(input));
    return new Response(JSON.stringify({ result: "success", stats: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await fetchLicensedSongstatsArtistHistory({
      songstatsArtistId: "artist-id",
      startDate: "2020-01-01",
      endDate: "2020-12-31",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey == null) delete process.env["SONGSTATS_API_KEY"];
    else process.env["SONGSTATS_API_KEY"] = originalKey;
  }
  const requestedUrl = requested as URL | null;
  assert.ok(requestedUrl);
  assert.ok(requestedUrl.pathname.endsWith(SONGSTATS_HISTORY_ONLY_ENDPOINT));
  assert.equal(requestedUrl.searchParams.get("songstats_artist_id"), "artist-id");
  assert.equal(requestedUrl.searchParams.get("start_date"), "2020-01-01");
  assert.equal(requestedUrl.searchParams.get("end_date"), "2020-12-31");
});

test("history-only client has no billing-table or schema mutation dependency", () => {
  const source = readFileSync(new URL("./songstats-history-client.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /songstats-billing-guard|pool\.query|CREATE TABLE|INSERT INTO|UPDATE /);
  assert.match(source, /\/artists\/historic_stats/);
  assert.doesNotMatch(source, /\/artists\/(?:stats|info|audience|catalog|activities|tracks)/);
});
