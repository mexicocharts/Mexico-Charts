import assert from "node:assert/strict";
import test from "node:test";
import {
  artistInfoFromPayload,
  sourceIdsFromInfoPayload,
} from "./songstats-info";

test("reads artist info and source IDs from the response root", () => {
  const payload = {
    artist_info: {
      songstats_artist_id: "artist-1",
      name: "Artist One",
      links: [{ source: "youtube", url: "https://example.com/youtube" }],
    },
    source_ids: ["spotify:1", "youtube:2"],
  };

  assert.equal(artistInfoFromPayload(payload)?.songstats_artist_id, "artist-1");
  assert.deepEqual(sourceIdsFromInfoPayload(payload), ["spotify:1", "youtube:2"]);
});

test("reads artist info from nested and direct data envelopes", () => {
  assert.equal(artistInfoFromPayload({
    data: { artist_info: { songstats_artist_id: "nested" } },
  })?.songstats_artist_id, "nested");

  assert.equal(artistInfoFromPayload({
    data: { songstats_artist_id: "direct", links: [] },
  })?.songstats_artist_id, "direct");
});

test("ignores malformed source IDs", () => {
  assert.deepEqual(sourceIdsFromInfoPayload({
    data: { source_ids: ["spotify:1", 2, null] },
  }), ["spotify:1"]);
});
