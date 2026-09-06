export function compareCatalogCounts(left: number | null | undefined, right: number | null | undefined, direction?: "asc" | "desc"): number;
export function formatCatalogDaily(value: number | null | undefined, format: (value: number) => string): string;
export function formatCatalogCutoff(catalog: { source?: string; snapshotDate: string | null; sourceDates?: { tracks: string | null; albums: string | null } | null }, formatDate: (value: string | null) => string): string;
