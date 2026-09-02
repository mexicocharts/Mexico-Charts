import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./monitoring.ts", import.meta.url), "utf8");

test("monitoring dashboard latest-video reads use compact observation state", () => {
  assert.match(source, /JOIN youtube_video_intraday_latest_observations latest_pointer/);
  assert.match(source, /latest\.observed_at=latest_pointer\.latest_observed_at/);
  assert.doesNotMatch(
    source,
    /JOIN LATERAL \(\s*SELECT s\.view_count, s\.view_delta, s\.seconds_since_previous, s\.observed_at\s*FROM youtube_video_intraday_shadow_snapshots/s,
  );
});

test("monitoring coverage counts compact latest rows instead of scanning history", () => {
  assert.match(
    source,
    /SELECT count\(DISTINCT sample\.video_id\)\s*FROM youtube_video_intraday_latest_observations sample/s,
  );
  assert.doesNotMatch(source, /FROM youtube_video_intraday_shadow_snapshots sample/);
});

test("dashboard query batches never exceed the three-connection public read pool", () => {
  assert.match(source, /const \[\s*snapshots,\s*extended,\s*liveVideos,\s*\] = await Promise\.all/s);
  assert.match(source, /const \[\s*liveVideoHistory,\s*streamSummary,\s*streamItems,\s*\] = await Promise\.all/s);
  assert.match(source, /const youtubeCoverage = await publicReadPool\.query/);
});
