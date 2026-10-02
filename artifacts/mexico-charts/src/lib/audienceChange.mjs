// Preserve the existing metric order, signed-percentage ranking and stable ties.
export function highestAvailableChange(growth) {
  return [
    { label: "Spotify", growth: growth.spotifyMonthlyListeners },
    { label: "Instagram", growth: growth.instagramFollowers },
    { label: "TikTok", growth: growth.tiktokFollowers },
    { label: "YouTube", growth: growth.youtubeSubscribers },
  ].filter(item => item.growth?.days15?.percentage != null)
    .sort((a, b) => (b.growth?.days15?.percentage ?? -Infinity) - (a.growth?.days15?.percentage ?? -Infinity))[0] ?? null;
}

export function audienceChangeCopy(language, evidence) {
  const english = language === "en";
  return {
    heading: english ? "Highest available percentage change" : "Variación porcentual más alta disponible",
    unavailable: english ? "Percentage change unavailable" : "Variación porcentual no disponible",
    endpoints: evidence?.baseline && evidence?.latest
      ? english ? `Between snapshots dated ${evidence.baseline.date} and ${evidence.latest.date} · ${evidence.storedDateIntervalDays} days between dates`
        : `Entre registros del ${evidence.baseline.date} y el ${evidence.latest.date} · ${evidence.storedDateIntervalDays} días entre fechas` : null,
    target: english ? "Comparison target: 15 days before the latest snapshot; uses the closest snapshot on or before that date."
      : "Objetivo: 15 días antes del último registro; se usa el registro más cercano en esa fecha o antes.",
    uncertainty: evidence
      ? english ? "Collection and provider measurement times are unknown. Metric intervals can differ."
        : "Se desconocen las horas de recopilación y medición del proveedor. Los intervalos pueden variar entre métricas."
      : english ? "Comparison endpoints and provider measurement times are unavailable."
        : "No están disponibles los extremos de comparación ni las horas de medición del proveedor.",
  };
}
