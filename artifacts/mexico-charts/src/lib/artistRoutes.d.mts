export interface CanonicalArtistRoute {
  path: string;
  name: string;
  context: string;
  slug: string;
}

export const artistCatalogCount: number;
export const canonicalArtistCatalog: readonly CanonicalArtistRoute[];
export function resolveCanonicalArtist(value: string | null | undefined): CanonicalArtistRoute | null;
export function canonicalArtistHref(value: string | null | undefined): string | null;
export function artistSearchHref(value: string | null | undefined): string;
export function slugifyArtist(value?: string): string;
