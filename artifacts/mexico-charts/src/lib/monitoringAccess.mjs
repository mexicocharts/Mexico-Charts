export const INTERNAL_ARTIST_PRO_DEFAULT_ARTIST_KEY = "luismiguel";

export function internalMonitoringEntryPath({
  internalArtistProAccess,
  requestedArtistKey,
}) {
  if (!internalArtistProAccess) return null;
  const artistKey = String(requestedArtistKey || INTERNAL_ARTIST_PRO_DEFAULT_ARTIST_KEY).trim();
  return artistKey ? `/monitoreo/${encodeURIComponent(artistKey)}` : null;
}

export function shouldLoadPublicMonitoringCatalog({ isSignedIn, accountAccess }) {
  return !isSignedIn || accountAccess?.internalArtistProAccess === false;
}

export class MonitoringDashboardHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "MonitoringDashboardHttpError";
    this.status = status;
  }
}

export function shouldRetryMonitoringDashboard(failureCount, error) {
  if (error instanceof MonitoringDashboardHttpError) {
    return false;
  }
  return failureCount < 1;
}

export function monitoringDashboardViewState({ isLoading, error, hasData }) {
  if (error) return "error";
  if (isLoading) return "loading";
  if (!hasData) return "error";
  return "ready";
}
