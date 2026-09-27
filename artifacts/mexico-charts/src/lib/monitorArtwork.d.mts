export function missingArtworkBatches(items: Array<{ type: string; key: string; artworkUrl: string | null }>, size?: number): string[][];
export function validateArtworkResponse(payload: unknown, requested: string[]): Array<{ resource: string; artworkUrl: string | null; status: "loaded" | "pending" }>;
