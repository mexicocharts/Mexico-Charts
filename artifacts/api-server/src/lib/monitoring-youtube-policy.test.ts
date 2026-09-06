import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMonitoringYoutubeImportProof } from "./monitoring-youtube-policy";

const state = (channelId: string, observedApprovedVideos = 100) => ({ channelId, currentChannelMatched: true,
  expectedVideos: 100, videosImported: 100, observedApprovedVideos, status: "complete",
  completedAt: "2026-09-01T12:00:00Z", nextPageTokenPresent: false });

test("per-channel import proof rejects a missing channel even when union coverage meets the largest expectation", () => {
  const result = evaluateMonitoringYoutubeImportProof({
    providerIdentities: { youtubeChannelIds: ["channel-one", "channel-two"] },
    youtube: { observedVideos: 100 }, youtubeImport: [state("channel-one"), state("channel-two", 0)],
  });
  assert.equal(result.complete, false);
  assert.equal(result.knownMissing, true);
  assert.equal(result.channels[1]?.observedVideos, 0);
});

test("each current linked channel must have complete individually reconciled import evidence", () => {
  const evidence = { providerIdentities: { youtubeChannelIds: ["channel-one", "channel-two"] },
    youtubeImport: [state("channel-one"), state("channel-two")] };
  assert.equal(evaluateMonitoringYoutubeImportProof(evidence).complete, true);
  const missing = evaluateMonitoringYoutubeImportProof({ ...evidence, youtubeImport: [state("channel-one")] });
  assert.equal(missing.complete, false);
  assert.deepEqual(missing.unaccountedChannelIds, ["channel-two"]);
  const staleBinding = evaluateMonitoringYoutubeImportProof({ ...evidence,
    youtubeImport: [state("channel-one"), { ...state("channel-two"), currentChannelMatched: false }] });
  assert.equal(staleBinding.complete, false);
  assert.equal(staleBinding.knownMissing, false);
});

test("unknown channel identity, observation coverage or unfinished pagination never proves an import complete", () => {
  for (const override of [{ channelId: null }, { observedApprovedVideos: null }, { expectedVideos: null, videosImported: null },
    { nextPageTokenPresent: true }, { status: "retryable" }, { completedAt: "invalid" }]) {
    const result = evaluateMonitoringYoutubeImportProof({ providerIdentities: { youtubeChannelIds: ["channel-one"] },
      youtubeImport: [{ ...state("channel-one"), ...override }] });
    assert.equal(result.complete, false);
  }
});
