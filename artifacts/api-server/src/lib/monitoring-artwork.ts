/** Keep catalog fallback matching identical between serving and diagnostics. */
export function normalizedMonitoringReleaseTitle(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\s+-\s+(single|ep)$/i, "")
    .replace(/\([^)]*(deluxe|version|remaster)[^)]*\)/gi, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
