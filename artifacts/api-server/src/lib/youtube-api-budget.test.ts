import assert from "node:assert/strict";
import test from "node:test";
import { youtubeQuotaCanReserve, youtubeQuotaCharges } from "./youtube-api-budget";

test("charges search against both the high-cost general bucket and granular search bucket", () => {
  assert.deepEqual(youtubeQuotaCharges("search.list"), [
    { bucket: "general", amount: 100 },
    { bucket: "search_queries", amount: 1 },
  ]);
});

test("keeps batchGetStats in its granular bucket", () => {
  assert.deepEqual(youtubeQuotaCharges("videos.batchGetStats", 3), [
    { bucket: "batch_get_stats", amount: 3 },
  ]);
});

test("combined consumers cannot reserve quota another subsystem already consumed", () => {
  assert.equal(youtubeQuotaCanReserve({ general: 9_900 }, "playlistItems.list"), true);
  assert.equal(youtubeQuotaCanReserve({ general: 9_901 }, "search.list"), false);
  assert.equal(youtubeQuotaCanReserve({ general: 8_000, search_queries: 100 }, "search.list"), false);
  assert.equal(youtubeQuotaCanReserve({ batch_get_stats: 10_000 }, "videos.batchGetStats"), false);
});
