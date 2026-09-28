// Pagination bounds DOM work only; the response, totals and ordering stay intact.
export const MONITOR_VIDEO_PAGE_SIZE = 60;
export function monitorVideoPage(videos, requestedPage) {
  const pageCount = Math.max(1, Math.ceil(videos.length / MONITOR_VIDEO_PAGE_SIZE));
  const page = Math.max(0, Math.min(pageCount - 1,
    Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 0));
  const offset = page * MONITOR_VIDEO_PAGE_SIZE;
  return { page, pageCount, offset, total: videos.length,
    items: videos.slice(offset, offset + MONITOR_VIDEO_PAGE_SIZE) };
}
