/** Resolve the compact impact response against real catalog identity, not a
 * legacy nested `release` object that the API no longer returns. */
export function monitorReportRecommendation(impact, releases) {
  if (!impact) return "La recomendación se generará cuando exista evidencia suficiente";
  if (impact.metrics?.some(metric => metric.status === "failed" || metric.status === "budget_exhausted"))
    return "Consulta de impacto pendiente; no se infiere ausencia de datos";
  if (!(impact.availableMetricCount > 0))
    return "El impacto todavía no tiene una ventana de comparación suficiente";
  const release = releases.find(item => item.releaseDate?.slice(0, 10) === impact.releaseDate && item.title?.trim());
  return release
    ? `Revisar el impacto real de ${release.title}`
    : `Revisar el impacto del lanzamiento del ${impact.releaseDate}`;
}
