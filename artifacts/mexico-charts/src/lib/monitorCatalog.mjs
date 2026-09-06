/** Keep unknown values after measured values in either sort direction. */
export function compareCatalogCounts(left, right, direction = "desc") {
  if (left == null) return right == null ? 0 : 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
}

export function formatCatalogDaily(value, format) {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${format(value)}`;
}
