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

/* ── Blocked artists (archived — never show on site) ── */
const BLOCKED_ARTIST_KEYS = new Set([
  "jesse",
  "banda toro",
  "jonathan caro",
  "baektowo",
  "jose mejia",
  "el frizian",
  "los 2 primos",
  "el gerry oficial",
  "lupe borbon y su blindaje 7",
  "juanchito",
  "meloleon",
  "badguychapo",
]);

/* ── Raw row type (column names must match artist_metadata tab headers) ── */
export interface RawArtistMetadata {
  artist_key?: string;              // Canonical matching key (preferred)
  artist_name?: string;             // Display name
  source_country?: string;          // e.g. "Mexico"
  genre?: string;                   // Broad Spotify category (e.g. "Latin")
  subgenre?: string;                // Specific display genre (e.g. "Corridos Tumbados")
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
  subgenre: string;
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

/* ── Fallback subgenre map keyed by artist_key (lowercase, trimmed) ──────────
   Used when the sheet's subgenre column is blank. Sheet value always wins.
   Values must exactly match HomeV6 GENRE_SYNONYMS keys or their synonyms.
───────────────────────────────────────────────────────────────────────────── */
const SUBGENRE_BY_KEY: Record<string, string> = {
  /* Corridos Tumbados */
  "fuerza regida":                         "corridos tumbados",
  "peso pluma":                            "corridos tumbados",
  "junior h":                              "corridos tumbados",
  "neton vega":                            "corridos tumbados",
  "tito double p":                         "corridos tumbados",
  "el bogueto":                            "corridos tumbados",
  "oscar maydon":                          "corridos tumbados",
  "natanael cano":                         "corridos tumbados",
  "luis r conriquez":                      "corridos tumbados",
  "gabito ballesteros":                    "corridos tumbados",
  "calle 24":                              "corridos tumbados",
  "chino pacas":                           "corridos tumbados",
  "chuyin":                                "corridos tumbados",
  "virlan garcia":                         "corridos tumbados",
  "gael valenzuela":                       "corridos tumbados",
  "emmanuellcortess":                      "corridos tumbados",
  "jasiel nunez":                          "corridos tumbados",
  "jorsshh":                               "corridos tumbados",
  "lencho":                                "corridos tumbados",
  "los dos de tamaulipas":                 "corridos tumbados",
  "jr torres":                             "corridos tumbados",
  "ian cordova":                           "corridos tumbados",
  "el fantasma":                           "corridos tumbados",
  "estevan plazola":                       "corridos tumbados",
  "panter belico":                         "corridos tumbados",
  "el de las r s":                         "corridos tumbados",
  "gerardo coronel":                       "corridos tumbados",
  "esau ortiz":                            "corridos tumbados",
  "kane rodriguez":                        "corridos tumbados",
  "codiciado":                             "corridos tumbados",
  "los alegres del barranco":              "corridos tumbados",
  "dannylux":                              "corridos tumbados",
  "codigo fn":                             "corridos tumbados",
  "moy bobadilla":                         "corridos tumbados",
  "los dos carnales":                      "corridos tumbados",
  "grupo arriesgado":                      "corridos tumbados",

  /* Regional Mexicano */
  "grupo frontera":                        "regional mexicano",
  "carin leon":                            "regional mexicano",
  "christian nodal":                       "regional mexicano",
  "xavi":                                  "regional mexicano",
  "grupo firme":                           "regional mexicano",
  "victor mendivil":                       "regional mexicano",
  "grupo marca registrada":               "regional mexicano",
  "alejandro fernandez":                   "regional mexicano",
  "lenin ramirez":                         "regional mexicano",
  "joan sebastian":                        "regional mexicano",
  "eslabon armado":                        "regional mexicano",
  "eden munoz":                            "regional mexicano",
  "los dareyes de la sierra":              "regional mexicano",
  "alfredo olivas":                        "regional mexicano",
  "vicente fernandez":                     "regional mexicano",
  "herencia de grandes":                   "regional mexicano",
  "omar camacho":                          "regional mexicano",
  "edgardo nunez":                         "regional mexicano",
  "juan gabriel":                          "regional mexicano",
  "clave especial":                        "regional mexicano",
  "los angeles azules":                    "regional mexicano",
  "gerardo ortiz":                         "regional mexicano",
  "yahritza y su esencia":                 "regional mexicano",
  "la adictiva":                           "regional mexicano",
  "los plebes del rancho de ariel camacho": "regional mexicano",
  "los bukis":                             "regional mexicano",
  "espinoza paz":                          "regional mexicano",
  "pepe aguilar":                          "regional mexicano",
  "ariel camacho y los plebes del rancho": "regional mexicano",
  "ivan cornejo":                          "regional mexicano",
  "los temrarios":                         "regional mexicano",
  "bronco":                                "regional mexicano",
  "el chapo de sinaloa":                   "regional mexicano",
  "edicion especial":                      "regional mexicano",
  "jr":                                    "regional mexicano",
  "grupo mojado":                          "regional mexicano",
  "valentin elizalde":                     "regional mexicano",
  "el komander":                           "regional mexicano",
  "sergio vega el shaka":                  "regional mexicano",
  "t3r elemento":                          "regional mexicano",
  "angela aguilar":                        "regional mexicano",
  "grupo cañaveral":                       "regional mexicano",
  "chalino sanchez":                       "regional mexicano",
  "pancho barraza":                        "regional mexicano",
  "los angeles de charly":                 "regional mexicano",
  "el bebeto":                             "regional mexicano",
  "luis mexia":                            "regional mexicano",
  "grupo bryndis":                         "regional mexicano",
  "los gemelos de sinaloa":               "regional mexicano",
  "regulo molina":                         "regional mexicano",
  "edwin luna y la trakalosa de monterrey": "regional mexicano",
  "ana gabriel":                           "regional mexicano",

  /* Norteño */
  "julion alvarez and su norteno banda":   "norteño",
  "calibre 50":                            "norteño",
  "los tigres del norte":                  "norteño",
  "los tucanes de tijuana":                "norteño",
  "conjunto primavera":                    "norteño",
  "pesado":                                "norteño",
  "los invasores de nuevo leon":           "norteño",
  "cardenales de nuevo leon":              "norteño",
  "bobby pulido":                          "norteño",
  "el duelo":                              "norteño",
  "intocable":                             "norteño",
  "hermanos espinoza":                     "norteño",

  /* Banda */
  "banda ms de sergio lizarraga":          "banda",
  "la arrolladora banda el limon":         "banda",
  "banda el recodo":                       "banda",
  "banda el recodo de cruz lizarraga":     "banda",
  "banda los recoditos":                   "banda",
  "el coyote y su banda tierra santa":     "banda",
  "remmy valenzuela":                      "banda",

  /* Hip-Hop Mexicano */
  "yng lvcas":                             "hip-hop",
  "el malilla":                            "hip-hop",

  /* Pop */
  "luis miguel":                           "pop",
  "reik":                                  "pop",
  "marco antonio solis":                   "pop",
  "julieta venegas":                       "pop",
  "mon laferte":                           "pop",
  "jesse and joy":                         "pop",
  "cristian castro":                       "pop",
  "jose jose":                             "pop",
  "camila":                                "pop",
  "belinda":                               "pop",
  "selena":                                "pop",
  "belanova":                              "pop",
  "carla morrison":                        "pop",
  "thalia":                                "pop",
  "ha ash":                                "pop",
  "emmanuel":                              "pop",
  "gloria trevi":                          "pop",
  "sin bandera":                           "pop",
  "yurdia":                                "pop",
  "kenia os":                              "pop",
  "humbe":                                 "pop",
  "diego verdaguer":                       "pop",
  "paulina rubio":                         "pop",
  "reyli barba":                           "pop",
  "alan arrieta":                          "pop",
  "kevin amf":                             "pop",
  "amanda miguel":                         "pop",
  "hupe$":                                 "pop",
  "angel almaguer":                        "pop",
  "yeri mua":                              "pop",
  "carlos rivera":                         "pop",
  "alejandra guzman":                      "pop",
  "marisela":                              "pop",
  "becky g":                               "pop",
  "bellakath":                             "pop",
  "armenta":                               "pop",
};

/* ── Normalizer ── */
function normalizeRow(raw: RawArtistMetadata): ArtistMetadata | null {
  const displayName = raw.artist_name?.trim() ?? "";
  if (!displayName) return null;

  const artistKey = (raw.artist_key?.trim() || displayName).toLowerCase();
  if (BLOCKED_ARTIST_KEYS.has(artistKey)) return null;

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
    subgenre: raw.subgenre?.trim() || SUBGENRE_BY_KEY[artistKey] || "",
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
