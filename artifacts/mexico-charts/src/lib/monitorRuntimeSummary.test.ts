import assert from "node:assert/strict";
import test from "node:test";
import { monitorRuntimeSummary } from "./monitorRuntimeSummary";
import type { MonitorDashboardData } from "../components/monitoring/MonitorProExperience";

test("runtime measurements preserve failures, nulls, and acceptance limits", () => {
  const data = {
    subscription: { artistKey: "test" }, current: null,
    sectionStatus: { priority_comparisons: "timeout" },
    spotifyCatalog: { source: "archive", pageStatus: null, history: [], items: [
      { type: "track", totalStreams: 0, dailyStreams: null, artworkUrl: null },
      { type: "track", totalStreams: 30, dailyStreams: 0, artworkUrl: "https://example.com/a.jpg" },
      { type: "album", totalStreams: null, dailyStreams: null, artworkUrl: null },
    ] }, history: [], availableHistory: { metrics: [] },
    liveVideos: [{ observed_at: null, view_count: null, view_delta: null },
      { observed_at: "2026-09-28T00:00:00Z", view_count: 0, view_delta: 0 }],
    liveVideoHistory: [], topMexicoCities: [], comparisonArtists: [],
    dailyPulse: { signals: [], status: "unavailable" }, reportCapabilities: {},
  } as unknown as MonitorDashboardData;
  const summary = monitorRuntimeSummary("test", data, 123.4);
  assert.equal(summary.spotify.tracks, 2);
  assert.equal(summary.spotify.albums, 1);
  assert.equal(summary.spotify.tracksWithLifetimeStreams, 2);
  assert.equal(summary.spotify.tracksWithDailyStreams, 1);
  assert.equal(summary.spotify.initialTrackArtwork, 1);
  assert.equal(summary.youtube.withObservations, 1);
  assert.equal(summary.youtube.withRawDeltas, 1);
  assert.equal(summary.sectionStatus?.priority_comparisons, "timeout");
  assert.equal(summary.visualAcceptance, "not_measured");
  assert.equal(summary.reportExportAcceptance, "not_measured");
  assert.equal("userId" in summary, false);
});
