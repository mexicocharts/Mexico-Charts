import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { kworbCoverage, officialArtists, spotifyArtists } from "@workspace/db/schema";
import { logger } from "./logger";
import { SUPPLEMENTAL_ARTISTS, toKworbArtistKey } from "./supplemental-artist-data";

export { mergeSupplementalMetadata, supplementalMetadataRows } from "./supplemental-artist-data";

/** Idempotently registers provider-backed profiles without touching Songstats. */
export async function seedSupplementalArtistCatalog() {
  const now = new Date();
  await db.insert(officialArtists).values(SUPPLEMENTAL_ARTISTS.map(artist => ({
    artistKey: artist.artistKey,
    artistName: artist.artistName,
    normalizedName: artist.artistKey,
    source: "verified_official_chart_review",
    notes: "Provider-backed profile; excluded from Songstats onboarding",
    updatedAt: now,
  }))).onConflictDoNothing();

  await db.insert(kworbCoverage).values(SUPPLEMENTAL_ARTISTS.map(artist => ({
    artistKey: toKworbArtistKey(artist.artistName),
    artistName: artist.artistName,
    spotifyId: artist.spotifyArtistId,
    hasSpotify: true,
    hasYoutube: artist.kworbYoutube ?? false,
    hasItunes: artist.kworbItunes ?? false,
    tier: "B",
    status: "active",
    lastDiscoveredAt: now,
  }))).onConflictDoUpdate({
    target: kworbCoverage.artistKey,
    set: {
      artistName: sql`excluded.artist_name`,
      spotifyId: sql`excluded.spotify_id`,
      hasSpotify: true,
      hasYoutube: sql`${kworbCoverage.hasYoutube} OR excluded.has_youtube`,
      hasItunes: sql`${kworbCoverage.hasItunes} OR excluded.has_itunes`,
      status: "active",
      lastDiscoveredAt: now,
    },
  });

  // Exact mappings are verified against Spotify/Kworb. A shared provider ID
  // (Edwin Luna / La Trakalosa) is safely ignored by the unique constraint.
  for (const artist of SUPPLEMENTAL_ARTISTS) {
    await db.insert(spotifyArtists).values({
      artistKey: artist.artistKey,
      spotifyArtistId: artist.spotifyArtistId,
      spotifyName: artist.artistName,
      spotifyUrl: `https://open.spotify.com/artist/${artist.spotifyArtistId}`,
      spotifyUri: `spotify:artist:${artist.spotifyArtistId}`,
      spotifyGenres: [],
      notes: "Verified exact provider mapping from supplemental catalog",
      verified: true,
      verifiedAt: now,
      spotifyLastUpdated: now,
      linkedAt: now,
    }).onConflictDoNothing();
  }

  logger.info({ artists: SUPPLEMENTAL_ARTISTS.length }, "[artists] supplemental catalog seeded");
}
