const CANONICAL_ARTIST_KEY_BY_ALIAS: Record<string, string> = {
  "banda el recodo de cruz lizarraga": "banda el recodo",
  "banda sinaloense ms de sergio lizarraga": "banda ms de sergio lizarraga",
  "banda tito y su torbellino": "tito torbellino",
  "ramon ayala y sus bravos del norte": "ramon ayala",
};

function normalizeArtistKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function compactArtistKey(value: string): string {
  return normalizeArtistKey(value).replace(/[^a-z0-9]/g, "");
}

export function songstatsArtistKeyCandidates(value: string): string[] {
  const normalized = normalizeArtistKey(value);
  const canonical = CANONICAL_ARTIST_KEY_BY_ALIAS[normalized] ?? normalized;
  return [...new Set([
    normalized,
    canonical,
    compactArtistKey(normalized),
    compactArtistKey(canonical),
  ].filter(Boolean))];
}

export function monitoringArtistAliasesMatch(
  storedArtistKey: string,
  requestedArtistKey: string,
): boolean {
  const requested = new Set(songstatsArtistKeyCandidates(requestedArtistKey));
  return songstatsArtistKeyCandidates(storedArtistKey).some(candidate => requested.has(candidate));
}
