/* ─────────────────────────────────────────────────────────────────────────────
   ARTIST METADATA SERVICE
   Fetches and normalizes the artist_metadata tab from the
   mexico_charts_artist_metadata_database workbook.

   This is NOT a chart — it carries no rank/order information.
   Rankings always come from the Spotify chart CSVs in dataProvider.ts.

   Matching strategy:
     1. Primary:  artist_key (exact, case-insensitive)
     2. Fallback: normalized display name comparison via normalizeArtistName()
───────────────────────────────────────────────────────────────────────────── */

import { fetchSheetCSV } from "./googleSheetsData";
import { normalizeArtistName } from "@/utils/normalizeArtistName";

/* ── Raw row type (column names must match artist_metadata tab headers) ── */
export interface RawArtistMetadata {
  artist_key?: string;              // Canonical matching key (preferred)
  artist_name?: string;             // Display name
  source_country?: string;          // e.g. "Mexico"
  genre?: string;                   // e.g. "Corridos Tumbados"
  label?: string;                   // Record label
  eligibility_type?: string;        // e.g. "approved", "review"
  eligibility_reason?: string;      // Optional reason text

  // Spotify
  spotify_monthly_listeners?: string;
  spotify_followers?: string;
  spotify_total_streams?: string;
  spotify_playlist_reach?: string;

  // YouTube
  youtube_subscribers?: string;
  youtube_views?: string;

  // Social
  tiktok_followers?: string;
  instagram_followers?: string;
  facebook_followers?: string;
  deezer_fans?: string;
  soundcloud_followers?: string;

  [key: string]: string | undefined;
}

/* ── Normalized metadata consumed by the UI ── */
export interface ArtistMetadata {
  artistKey: string;              // Canonical key for matching
  displayName: string;            // artist_name value
  normalizedName: string;         // For fallback matching

  country: string;
  genre: string;
  label: string;

  // Spotify
  spotifyListeners: number;       // Raw number
  spotifyListenersFmt: string;    // e.g. "32.4M"
  spotifyFollowers: number;
  spotifyFollowersFmt: string;
  spotifyStreams: number;
  spotifyStreamsFmt: string;
  spotifyPlaylistReach: number;
  spotifyPlaylistReachFmt: string;

  // YouTube
  youtubeSubscribers: number;
  youtubeSubscribersFmt: string;
  youtubeViews: number;
  youtubeViewsFmt: string;

  // Social
  tiktokFollowers: number;
  tiktokFollowersFmt: string;
  instagramFollowers: number;
  instagramFollowersFmt: string;
  facebookFollowers: number;
  facebookFollowersFmt: string;
  deezerFans: number;
  deezerFansFmt: string;
  soundcloudFollowers: number;
  soundcloudFollowersFmt: string;
}

/* ── Lookup map: artistKey → ArtistMetadata ── */
export type ArtistMetadataMap = Map<string, ArtistMetadata>;

/* ── Number helpers ── */
function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const s = raw.trim().toUpperCase();
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
}

function fmtNum(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/* ── Normalizer ── */
function normalizeRow(raw: RawArtistMetadata): ArtistMetadata | null {
  const displayName = raw.artist_name?.trim() ?? "";
  if (!displayName) return null;

  const artistKey = (raw.artist_key?.trim() || displayName).toLowerCase();

  const spotifyListeners = parseNum(raw.spotify_monthly_listeners);
  const spotifyFollowers = parseNum(raw.spotify_followers);
  const spotifyStreams = parseNum(raw.spotify_total_streams);
  const spotifyPlaylistReach = parseNum(raw.spotify_playlist_reach);
  const youtubeSubscribers = parseNum(raw.youtube_subscribers);
  const youtubeViews = parseNum(raw.youtube_views);
  const tiktokFollowers = parseNum(raw.tiktok_followers);
  const instagramFollowers = parseNum(raw.instagram_followers);
  const facebookFollowers = parseNum(raw.facebook_followers);
  const deezerFans = parseNum(raw.deezer_fans);
  const soundcloudFollowers = parseNum(raw.soundcloud_followers);

  return {
    artistKey,
    displayName,
    normalizedName: normalizeArtistName(displayName),

    country: raw.source_country?.trim() ?? "",
    genre: raw.genre?.trim() ?? "",
    label: raw.label?.trim() ?? "",

    spotifyListeners,
    spotifyListenersFmt: fmtNum(spotifyListeners),
    spotifyFollowers,
    spotifyFollowersFmt: fmtNum(spotifyFollowers),
    spotifyStreams,
    spotifyStreamsFmt: fmtNum(spotifyStreams),
    spotifyPlaylistReach,
    spotifyPlaylistReachFmt: fmtNum(spotifyPlaylistReach),

    youtubeSubscribers,
    youtubeSubscribersFmt: fmtNum(youtubeSubscribers),
    youtubeViews,
    youtubeViewsFmt: fmtNum(youtubeViews),

    tiktokFollowers,
    tiktokFollowersFmt: fmtNum(tiktokFollowers),
    instagramFollowers,
    instagramFollowersFmt: fmtNum(instagramFollowers),
    facebookFollowers,
    facebookFollowersFmt: fmtNum(facebookFollowers),
    deezerFans,
    deezerFansFmt: fmtNum(deezerFans),
    soundcloudFollowers,
    soundcloudFollowersFmt: fmtNum(soundcloudFollowers),
  };
}

/* ── Public API ── */

/**
 * Fetches and normalizes the artist_metadata CSV.
 * Returns an ArtistMetadataMap (artistKey → ArtistMetadata) and a
 * normalizedName → ArtistMetadata fallback map for name-based lookup.
 */
export async function fetchArtistMetadata(url: string): Promise<{
  byKey: ArtistMetadataMap;
  byName: Map<string, ArtistMetadata>;
  configured: boolean;
}> {
  const result = await fetchSheetCSV<RawArtistMetadata>(url);

  if (result.configured && result.error) {
    throw new Error(result.error);
  }

  const byKey: ArtistMetadataMap = new Map();
  const byName: Map<string, ArtistMetadata> = new Map();

  for (const row of result.rows) {
    const meta = normalizeRow(row);
    if (!meta) continue;
    byKey.set(meta.artistKey, meta);
    if (!byName.has(meta.normalizedName)) {
      byName.set(meta.normalizedName, meta);
    }
  }

  return { byKey, byName, configured: result.configured };
}

/**
 * Looks up an ArtistMetadata entry for a given chart artist name / key.
 * Tries artist_key first (exact), then falls back to normalized name.
 *
 * @param artistKey   - The artist_key value from the chart row (if available)
 * @param artistName  - The display name from the chart row (fallback)
 * @param byKey       - Primary lookup map
 * @param byName      - Fallback lookup map
 */
export function lookupArtistMetadata(
  artistKey: string | undefined,
  artistName: string,
  byKey: ArtistMetadataMap,
  byName: Map<string, ArtistMetadata>
): ArtistMetadata | undefined {
  if (artistKey) {
    const hit = byKey.get(artistKey.toLowerCase().trim());
    if (hit) return hit;
  }
  return byName.get(normalizeArtistName(artistName));
}
