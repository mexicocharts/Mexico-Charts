import type { YouTubeLivePreviewVideo } from "../components/YouTubeLivePublicPreview";
export function monitorVideoCount(data: {youtubeCatalogDeferred?: boolean; youtubeCatalogSummary?: {total: number} | null; liveVideos: unknown[]}): number | null;
export function validateMonitorVideoCatalog(payload: unknown, artistKey: string, requestedPage?: number): {artistKey: string; items: YouTubeLivePreviewVideo[]; page: number; pageSize: number; totalItems: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean; outOfRange: false; totalViews: string};
