/** Explicit owner-directed exclusion, not a nationality inference. Historical
 * rows and billing claims remain untouched; only future Songstats work is denied. */
export const SONGSTATS_EXCLUDED_SPOTIFY_IDS = ["4q3ewBCX7sLwd24euuV69X"] as const;
export const SONGSTATS_EXCLUDED_PROVIDER_IDS = ["xmcd3klh"] as const;
// Verified against https://music.apple.com/us/artist/bad-bunny/1126808565
export const SONGSTATS_EXCLUDED_APPLE_IDS = [1126808565] as const;

export class SongstatsArtistExcludedError extends Error {
  constructor() {
    super("Artist excluded from Songstats collection by owner policy");
    this.name = "SongstatsArtistExcludedError";
  }
}

export function isSongstatsArtistExcluded(identifier: {
  spotifyArtistId?: string;
  songstatsArtistId?: string;
  appleMusicArtistId?: number;
}): boolean {
  return SONGSTATS_EXCLUDED_SPOTIFY_IDS.some(id => id === identifier.spotifyArtistId?.trim()) ||
    SONGSTATS_EXCLUDED_PROVIDER_IDS.some(id => id === identifier.songstatsArtistId?.trim()) ||
    SONGSTATS_EXCLUDED_APPLE_IDS.some(id => id === identifier.appleMusicArtistId);
}

export function assertSongstatsArtistAllowed(identifier: Parameters<typeof isSongstatsArtistExcluded>[0]): void {
  if (isSongstatsArtistExcluded(identifier)) throw new SongstatsArtistExcludedError();
}

/** Only internal SQL column expressions are supplied, never request input. */
export function songstatsArtistSelectionPredicate(spotifyIdExpression: string): string {
  return `${spotifyIdExpression} NOT IN (${SONGSTATS_EXCLUDED_SPOTIFY_IDS.map(id => `'${id}'`).join(", ")})`;
}
