export const YOUTUBE_VALIDATION_AUTO_START = false;

export function normalizeYoutubeValidationArtistKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function isYoutubeComparatorWindowCandidate(input: {
  catalogDiscoveredAt: string | Date | null | undefined;
  publishedAt: string | Date | null | undefined;
  sessionStartedAt: string | Date;
}): boolean {
  const sessionStartedAt = new Date(input.sessionStartedAt).getTime();
  const catalogDiscoveredAt = input.catalogDiscoveredAt == null
    ? Number.NaN
    : new Date(input.catalogDiscoveredAt).getTime();
  const publishedAt = input.publishedAt == null
    ? Number.NaN
    : new Date(input.publishedAt).getTime();
  return Number.isFinite(sessionStartedAt)
    && Number.isFinite(catalogDiscoveredAt)
    && Number.isFinite(publishedAt)
    && catalogDiscoveredAt >= sessionStartedAt
    && publishedAt >= sessionStartedAt - 24 * 60 * 60 * 1_000;
}
