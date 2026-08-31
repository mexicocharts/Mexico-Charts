import assert from "node:assert/strict";
import test from "node:test";
import { dedupeYoutubeMonitorRows } from "./youtube-monitor-dedupe";

test("deduplicates aliases for one logical artist and video", () => {
  const rows = dedupeYoutubeMonitorRows([
    { artist_key: "peso-pluma", video_id: "abcdefghijk", canonical_url: "https://music.youtube.com/watch?v=abcdefghijk" },
    { artist_key: "Peso Pluma", video_id: "abcdefghijk", canonical_url: "https://youtu.be/abcdefghijk" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.canonical_url, "https://www.youtube.com/watch?v=abcdefghijk");
});

test("preserves a shared video for genuinely different artists", () => {
  const rows = dedupeYoutubeMonitorRows([
    { artist_key: "artist-a", video_id: "abcdefghijk" },
    { artist_key: "artist-b", video_id: "abcdefghijk" },
  ]);
  assert.equal(rows.length, 2);
});

test("normalizes multiple canonical URL forms by video ID", () => {
  const rows = dedupeYoutubeMonitorRows([
    { artist_key: "artist-a", video_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk" },
    { artist_key: "artist_a", video_id: "abcdefghijk", canonical_url: "https://music.youtube.com/watch?v=abcdefghijk" },
  ]);
  assert.deepEqual(rows.map(row => row.canonical_url), ["https://www.youtube.com/watch?v=abcdefghijk"]);
});

test("does not change non-duplicated rows except for stable canonical representation", () => {
  const rows = dedupeYoutubeMonitorRows([
    { artist_key: "artist-a", video_id: "abcdefghijk", canonical_url: "https://music.youtube.com/watch?v=abcdefghijk" },
    { artist_key: "artist-a", video_id: "lmnopqrstuv", canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv" },
  ]);
  assert.deepEqual(rows.map(row => row.video_id), ["abcdefghijk", "lmnopqrstuv"]);
});
