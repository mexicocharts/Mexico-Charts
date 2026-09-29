// A deferred collection is not an empty source. Counts come from the bounded
// summary until the independent, authenticated full collection is available.
export function monitorVideoCount(data) {
  return data.youtubeCatalogDeferred
    ? data.youtubeCatalogSummary?.total ?? null
    : data.liveVideos.length;
}

export function validateMonitorVideoCatalog(payload, artistKey) {
  if (!payload || payload.artistKey !== artistKey || !Array.isArray(payload.videos)
    || !Number.isInteger(payload.total) || payload.total !== payload.videos.length
    || payload.videos.some(video => typeof video.video_id !== "string" || !video.video_id || video.view_count == null)
    || new Set(payload.videos.map(video => video.video_id)).size !== payload.total) {
    throw new Error("Incomplete or invalid linked-video catalog");
  }
  return payload;
}
