import type { YouTubeLivePreviewVideo } from "../components/YouTubeLivePublicPreview";
export function monitorVideoCount(data: {youtubeCatalogDeferred?: boolean; youtubeCatalogSummary?: {total: number} | null; liveVideos: unknown[]}): number | null;
export function validateMonitorVideoCatalog(payload: unknown, artistKey: string): {artistKey: string; total: number; videos: YouTubeLivePreviewVideo[]};
