/* ─────────────────────────────────────────────────────────────────────────────
   ARTIST NAME NORMALIZER
   Used to match Spotify chart artist names against artist_metadata rows.
   Primary key: artist_key (preferred when present on both sides).
   Fallback:    normalized display name comparison.
───────────────────────────────────────────────────────────────────────────── */

/**
 * Converts any artist name string to a lowercase ASCII key suitable for
 * fuzzy-but-consistent matching.
 *
 * e.g. "Peso Pluma" → "peso pluma"
 *      "Natanael Cano" → "natanael cano"
 *      "C-Kan" → "c kan"
 *      "Ángela Aguilar" → "angela aguilar"
 */
export function normalizeArtistName(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip accents
    .replace(/[^a-z0-9\s]/g, " ")      // replace non-alphanumeric with space
    .replace(/\s+/g, " ")              // collapse whitespace
    .trim();
}

/**
 * Converts an artist name to a URL slug.
 * e.g. "Peso Pluma" → "peso-pluma"
 */
export function slugifyArtist(raw: string | undefined): string {
  return normalizeArtistName(raw).replace(/\s+/g, "-");
}
