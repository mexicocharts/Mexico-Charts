/** Keep unknown values after measured values in either sort direction. */
export function compareCatalogCounts(left, right, direction = "desc") {
  if (left == null) return right == null ? 0 : 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
}

export function formatCatalogDaily(value, format) {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${format(value)}`;
}

/** A retrieval timestamp never supplies a missing live source date. */
export function formatCatalogCutoff(catalog, formatDate) {
  if (catalog.source !== "kworb_live_complete_catalog" && catalog.sourceDates == null)
    return `Corte ${formatDate(catalog.snapshotDate)}`;
  const { tracks = null, albums = null } = catalog.sourceDates ?? {};
  if (tracks != null && tracks === albums) return `Corte ${formatDate(tracks)}`;
  return `Canciones: ${formatDate(tracks)} · Álbumes: ${formatDate(albums)}`;
}
