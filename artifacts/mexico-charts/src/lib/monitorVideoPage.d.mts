export const MONITOR_VIDEO_PAGE_SIZE: number;
export function monitorVideoPage<T>(videos: T[], requestedPage: number): {
  page: number; pageCount: number; offset: number; total: number; items: T[];
};
