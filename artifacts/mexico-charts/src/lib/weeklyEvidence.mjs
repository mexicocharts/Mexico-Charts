function normalized(value) {
  return typeof value === "string" ? value.trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim() : "";
}

function candidate(entry, platform) {
  const row = entry.row;
  const title = platform === "spotify" ? row["Track Name"] || row.Title : row["Song Name"] || row.Title;
  const credit = platform === "spotify" ? row.Artist || row["Artist Names"] : row["Artist Name"] || row.Artist;
  const titleKey = normalized(title);
  const creditKey = normalized(credit);
  if (!titleKey || !creditKey || ["unknown", "desconocido", "n a", "various artists", "varios artistas"].includes(creditKey)) return null;
  return { entry, title, credit, key: JSON.stringify([titleKey, creditKey]) };
}

const isMexican = row => /^(true|yes|1)$/i.test(row["Contains Mexican Artist"] ?? "");

// Exact normalized title/credit candidates are potential matches, not recording IDs.
export function potentialCrossChartGains(spotify, youtube) {
  const left = (spotify?.climbers ?? []).map(entry => candidate(entry, "spotify")).filter(Boolean);
  const right = (youtube?.climbers ?? []).map(entry => candidate(entry, "youtube")).filter(Boolean);
  return left.flatMap(item => {
    const partners = right.filter(other => other.key === item.key);
    if (partners.length !== 1 || left.filter(other => other.key === item.key).length !== 1) return [];
    const partner = partners[0];
    if (!isMexican(item.entry.row) || !isMexican(partner.entry.row)) return [];
    return [{ key: item.key, spotify: item.entry, youtube: partner.entry,
      spotifyTitle: item.title, youtubeTitle: partner.title, spotifyCredit: item.credit, youtubeCredit: partner.credit,
      spotifyDate: spotify.chartDate ?? null, spotifyPreviousDate: spotify.previousChartDate ?? null,
      youtubeDate: youtube.chartDate ?? null, youtubePreviousDate: youtube.previousChartDate ?? null }];
  }).slice(0, 3);
}

export function savedComparisonAvailable(comparison) {
  return Boolean(comparison?.comparisonReady && typeof comparison.previousChartDate === "string"
    && comparison.previousChartDate.trim() && Array.isArray(comparison.mexicanEntries)
    && Array.isArray(comparison.climbers) && Array.isArray(comparison.debuts));
}

export function savedComparisonCopy(language, comparison, unmatched, climbers) {
  const english = language === "en";
  const available = savedComparisonAvailable(comparison);
  return {
    available,
    row: english ? "No match in previous saved edition" : "Sin coincidencia en la edición guardada anterior",
    summary: !available
      ? english ? "No previous saved edition available to compare" : "No hay una edición guardada anterior disponible para comparar"
      : english ? `In the available sample: ${unmatched} entries not matched in the previous saved edition; ${climbers} Mexican climbers.`
        : `En la muestra disponible: ${unmatched} entradas sin coincidencia en la edición guardada anterior; ${climbers} ascensos mexicanos.`,
    explanation: !available ? null
      : english ? `Compared with the saved edition from ${comparison.previousChartDate}. An unmatched entry may be a re-entry, outside the earlier saved chart, or affected by changed identifying fields.`
        : `Comparación con la edición guardada del ${comparison.previousChartDate}. Una entrada sin coincidencia puede ser un reingreso, haber quedado fuera de la lista guardada anterior o tener cambios en sus campos de identificación.`,
  };
}
