export function internalMonitoringEntryPath({
  internalArtistProAccess,
  requestedArtistKey,
}) {
  if (!internalArtistProAccess) return null;
  const artistKey = String(requestedArtistKey || "").trim();
  return artistKey
    ? `/monitoreo/${encodeURIComponent(artistKey)}`
    : "/monitoreo/founder";
}

export function shouldLoadPublicMonitoringCatalog({
  isSignedIn,
  isLoaded = true,
  accountAccess,
}) {
  if (!isLoaded) return false;
  return !isSignedIn || accountAccess?.internalArtistProAccess === false;
}

export function canUseInternalMonitoringAccess({
  isLoaded,
  isSignedIn,
  userId,
  accountAccess,
  error,
}) {
  return Boolean(
    isLoaded &&
    isSignedIn &&
    userId &&
    !error &&
    accountAccess?.requestedByUserId === userId &&
    accountAccess.internalArtistProAccess === true,
  );
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
