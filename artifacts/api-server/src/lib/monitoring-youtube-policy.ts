function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function nonnegativeCount(value: unknown): number | null {
  if (value == null || typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

/** Unioned observed videos cannot prove completeness for each linked channel. */
export function evaluateMonitoringYoutubeImportProof(sourceEvidence: Record<string, unknown>) {
  const states = Array.isArray(sourceEvidence["youtubeImport"]) ? sourceEvidence["youtubeImport"].map(object) : [];
  const ids = object(sourceEvidence["providerIdentities"])["youtubeChannelIds"];
  const linkedChannels = [...new Set((Array.isArray(ids) ? ids : []).filter((id): id is string => typeof id === "string" && Boolean(id.trim())))];
  const channels = states.map(state => {
    const channelId = typeof state["channelId"] === "string" && state["channelId"].trim() ? state["channelId"] : null;
    const expected = nonnegativeCount(state["expectedVideos"]);
    const imported = nonnegativeCount(state["videosImported"]);
    const expectedVideos = expected == null && imported == null ? null : Math.max(expected ?? 0, imported ?? 0);
    const observedVideos = nonnegativeCount(state["observedApprovedVideos"]);
    const bound = channelId != null && linkedChannels.includes(channelId) && state["currentChannelMatched"] === true;
    const completedAt = typeof state["completedAt"] === "string" ? Date.parse(state["completedAt"]) : NaN;
    return {
      channelId, expectedVideos, observedVideos, currentChannelMatched: bound,
      knownMissing: bound && expectedVideos != null && observedVideos != null && observedVideos < expectedVideos,
      complete: bound && expectedVideos != null && observedVideos != null && observedVideos >= expectedVideos
        && state["status"] === "complete" && Number.isFinite(completedAt) && state["nextPageTokenPresent"] === false,
    };
  });
  const unaccountedChannelIds = linkedChannels.filter(id => !channels.some(channel => channel.channelId === id));
  return {
    policy: "per_linked_channel_approved_video_coverage",
    complete: linkedChannels.length > 0 && channels.length > 0 && unaccountedChannelIds.length === 0 && channels.every(channel => channel.complete),
    knownMissing: channels.some(channel => channel.knownMissing),
    linkedChannelCount: linkedChannels.length,
    unaccountedChannelIds,
    channels,
  };
}
