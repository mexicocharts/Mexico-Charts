const METRICS = {
  spotifyMonthlyListeners: "Spotify · oyentes mensuales (ventana móvil)",
  instagramFollowers: "Instagram · seguidores",
  tiktokFollowers: "TikTok · seguidores",
  youtubeSubscribers: "YouTube · suscriptores",
};

/** Stored calendar dates are not provider measurement timestamps. */
export function releaseComparisonText(comparison) {
  const offset = value => value == null ? "no disponible" : `${value > 0 ? "+" : ""}${value} días`;
  const interval = comparison.storedDateIntervalDays == null ? "no disponible" : `${comparison.storedDateIntervalDays} días`;
  return `${METRICS[comparison.metric] ?? comparison.metric}: ${comparison.baseline?.date ?? "base no disponible"} → ${comparison.followup?.date ?? "seguimiento no disponible"}. Intervalo entre fechas guardadas: ${interval}. Distancia a los objetivos: base ${offset(comparison.baselineOffsetDays)}, seguimiento ${offset(comparison.followupOffsetDays)}.`;
}
