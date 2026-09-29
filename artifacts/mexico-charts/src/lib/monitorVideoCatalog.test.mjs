import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {monitorVideoCount, validateMonitorVideoCatalog} from "./monitorVideoCatalog.mjs";
import {monitorVideoPage} from "./monitorVideoPage.mjs";

test("all 16,273 entries survive the existing 272 pages with source records intact", () => {
  const videos = Array.from({length: 16273}, (_, i) => ({video_id: String(i), view_count: i, view_delta: 0, relationship_sources: [{source_table: "stored"}]}));
  const payload = validateMonitorVideoCatalog({artistKey: "large", total: videos.length, videos}, "large");
  const pages = Array.from({length: 272}, (_, i) => monitorVideoPage(payload.videos, i));
  assert.deepEqual(pages.flatMap(p => p.items), videos);
  assert.equal(pages[271].items.length, 13);
  assert.equal(pages[135].items[0], videos[8100]);
});
test("small, empty, deferred and failed catalogs are distinguished", () => {
  assert.equal(monitorVideoCount({liveVideos: [], youtubeCatalogDeferred: true}), null);
  assert.equal(monitorVideoCount({liveVideos: [], youtubeCatalogDeferred: true, youtubeCatalogSummary: {total: 16273}}), 16273);
  assert.equal(validateMonitorVideoCatalog({artistKey:"a", total:0, videos:[]}, "a").total, 0);
  const one = {video_id:"1", view_count:0};
  assert.equal(monitorVideoPage(validateMonitorVideoCatalog({artistKey:"a", total:1, videos:[one]}, "a").videos, 0).items.length, 1);
  for (const invalid of [{total:2, videos:[one]}, {total:2, videos:[one,one]}, {total:1, videos:[{video_id:"1",view_count:null}]}]) {
    assert.throws(()=>validateMonitorVideoCatalog({artistKey:"a",...invalid}, "a"));
  }
});
test("Panel never starts full collection/history; report explicitly retains its original inputs", () => {
  const source = readFileSync(new URL("../../../api-server/src/routes/monitoring.ts", import.meta.url), "utf8");
  assert.match(source, /const priorityLiveVideos = options.fullReportCatalog \? dashboardStage/);
  assert.match(source, /const liveVideoHistory = options.fullReportCatalog \? await dashboardStage/);
  assert.match(source, /youtube_catalog_summary/);
  assert.match(source, /\{ fullReportCatalog: true \}/);
  assert.match(source, /"\/monitoring\/video-catalog\/:artistKey", requireMonitoringClerkUser/);
});
