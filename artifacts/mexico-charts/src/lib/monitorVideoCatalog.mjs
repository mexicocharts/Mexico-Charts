// A deferred collection is not an empty source. Counts come from the bounded
// summary until an independent, authenticated server page is available.
export function monitorVideoCount(data) {
  return data.youtubeCatalogDeferred
    ? data.youtubeCatalogSummary?.total ?? null
    : data.liveVideos.length;
}

export function validateMonitorVideoCatalog(payload, artistKey, requestedPage = 1) {
  if (!payload || payload.artistKey !== artistKey || !Array.isArray(payload.items)
    || payload.page !== requestedPage || !Number.isSafeInteger(payload.page) || payload.page < 1
    || payload.pageSize !== 60 || !Number.isSafeInteger(payload.totalItems) || payload.totalItems < 0
    || payload.totalPages !== Math.max(1, Math.ceil(payload.totalItems / 60))
    || payload.page > payload.totalPages || payload.outOfRange !== false
    || payload.hasPreviousPage !== (payload.page > 1) || payload.hasNextPage !== (payload.page < payload.totalPages)
    || payload.items.length !== Math.min(60, Math.max(0, payload.totalItems - (payload.page - 1) * 60))
    || payload.totalViews == null || !Number.isFinite(Number(payload.totalViews)) || Number(payload.totalViews) < 0
    || payload.items.some(video => typeof video.video_id !== "string" || !video.video_id
      || video.view_count == null || !Number.isFinite(Number(video.view_count)))
    || new Set(payload.items.map(video => video.video_id)).size !== payload.items.length) {
    throw new Error("Incomplete or invalid linked-video page");
  }
  return payload;
}
