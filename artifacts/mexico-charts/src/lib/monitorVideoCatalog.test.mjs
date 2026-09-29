import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {monitorVideoCount, validateMonitorVideoCatalog} from "./monitorVideoCatalog.mjs";
const payload = (totalItems, page=1) => ({artistKey:"a",totalItems,page,pageSize:60,
  totalPages:Math.max(1,Math.ceil(totalItems/60)),hasPreviousPage:page>1,hasNextPage:page<Math.ceil(totalItems/60),
  outOfRange:false,totalViews:"10",items:Array.from({length:Math.min(60,Math.max(0,totalItems-(page-1)*60))},(_,i)=>({video_id:String(i),view_count:0}))});

test("all 16,273 entries survive the existing 272 pages with source records intact", () => {
  for (let page=1;page<=272;page++) {
    const result=validateMonitorVideoCatalog(payload(16273,page),"a",page);
    assert.equal(result.items.length,page===272?13:60);
    assert.equal(result.totalPages,272);
  }
});
test("small, empty, deferred and failed catalogs are distinguished", () => {
  assert.equal(monitorVideoCount({liveVideos: [], youtubeCatalogDeferred: true}), null);
  assert.equal(monitorVideoCount({liveVideos: [], youtubeCatalogDeferred: true, youtubeCatalogSummary: {total: 16273}}), 16273);
  for (const n of [0,1,59,60,61]) assert.equal(validateMonitorVideoCatalog(payload(n),"a").totalItems,n);
  for (const change of [{artistKey:"b"},{totalItems:61},{items:[]},{page:0},{pageSize:61},{totalPages:2},{hasNextPage:true},{outOfRange:true},{totalViews:null}])
    assert.throws(()=>validateMonitorVideoCatalog({...payload(1),...change},"a"));
  assert.throws(()=>validateMonitorVideoCatalog({...payload(1),items:[{video_id:"a",view_count:null}]},"a"));
  assert.throws(()=>validateMonitorVideoCatalog({...payload(2),items:[{video_id:"a",view_count:0},{video_id:"a",view_count:0}]},"a"));
});
test("Panel never starts full collection/history; report explicitly retains its original inputs", () => {
  const source = readFileSync(new URL("../../../api-server/src/routes/monitoring.ts", import.meta.url), "utf8");
  assert.match(source, /const priorityLiveVideos = options.fullReportCatalog \? dashboardStage/);
  assert.match(source, /const liveVideoHistory = options.fullReportCatalog \? await dashboardStage/);
  assert.match(source, /youtube_catalog_summary/);
  assert.match(source, /\{ fullReportCatalog: true \}/);
  assert.match(source, /"\/monitoring\/video-catalog\/:artistKey", requireMonitoringClerkUser/);
  const route=source.slice(source.indexOf('router.get("/monitoring/video-catalog/'),source.indexOf('router.get(\n  "/monitoring/dashboard/'));
  assert.match(route,/resolveMonitoringAccess\(clerkUserId\(res\), artistKey\)/);
  assert.match(route,/!access.allowed \|\| !access.grant/);
  assert.match(route,/monitoringAuthorizedSourceKeys\(access.grant, monitoringIdentityKeyCandidates\)/);
  assert.match(route,/loadMonitoringYoutubePage/); assert.doesNotMatch(route,/loadMonitoringYoutubeLiveVideos/);
  const ui=readFileSync(new URL("../components/monitoring/MonitorProExperience.tsx",import.meta.url),"utf8");
  assert.match(ui,/queryKey: \["monitoring-video-catalog", auth.userId, artistKey, requestedPage\]/);
  assert.match(ui,/page=\$\{requestedPage \+ 1\}&pageSize=60/);
  assert.doesNotMatch(ui,/monitorVideoPage\(videos/);
});
