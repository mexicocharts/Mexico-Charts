import assert from "node:assert/strict";
import test from "node:test";
import { buildSongstatsPublicInsight, monitoringSourceGrowth } from "./songstats-public-service";
import { reportGrowth } from "./monitoring-weekly-report";

test("report uses the identical source delta and dates as Monitor, not a conflicting snapshot", () => {
  const historicStats = {stats:[{source:"youtube",data:{history:[{date:"2026-08-26",video_views_total:100},{date:"2026-09-25",video_views_total:380}]}}]};
  // Use the provider's established field mapping, checked below against insight.
  const growth = monitoringSourceGrowth(historicStats);
  const insight = buildSongstatsPublicInsight({historicStats,audience:null,audienceDetails:null},{access:"monitoring"});
  assert.equal(growth.youtubeChannelViews?.days30?.absolute, 280);
  assert.equal(growth.youtubeChannelViews?.days30?.baselineDate, "2026-08-26");
  assert.equal(growth.youtubeChannelViews?.days30?.latestDate, "2026-09-25");
  for (const [metric, windows] of Object.entries(insight.growth)) {
    for (const days of [7,15,30,90]) assert.equal(growth[metric]?.[`days${days}`]?.absolute, windows?.[`days${days}` as keyof typeof windows]?.absolute);
  }
  const input = { history: [], growth: { youtubeChannelViews: { days30: {
    absolute: 280, baselineDate:"2026-08-26",latestDate:"2026-09-25",baselineValue:100,latestValue:380,source:"songstats_extended_history",
  } } } };
  assert.deepEqual(reportGrowth(input,"youtubeChannelViews",30), input.growth.youtubeChannelViews.days30);
  assert.equal(reportGrowth({...input,growth:{youtubeChannelViews:{days30:null}}},"youtubeChannelViews",30),null);
});
