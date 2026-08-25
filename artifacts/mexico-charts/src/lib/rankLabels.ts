/**
 * Public rank labels must name their source. A number from the Spotify Mexico
 * artist chart is not an MX100 position unless it came from the MX100
 * calculation itself.
 */
export function spotifyMexicoRankLabel(rank: number | null | undefined): string {
  return Number.isFinite(rank) && Number(rank) > 0
    ? `Spotify México #${Number(rank)}`
    : "Sin rango de Spotify México";
}

export function mx100RankLabel(rank: number | null | undefined): string {
  return Number.isFinite(rank) && Number(rank) > 0
    ? `MX100 #${Number(rank)}`
    : "Sin posición MX100";
}