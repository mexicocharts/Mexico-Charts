export function internalMonitoringEntryPath(input: {
  internalArtistProAccess: boolean;
  requestedArtistKey?: string | null;
}): string | null;

export function shouldLoadPublicMonitoringCatalog(input: {
  isSignedIn: boolean;
  isLoaded?: boolean;
  accountAccess?: { internalArtistProAccess: boolean };
}): boolean;

export function canUseInternalMonitoringAccess(input: {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  accountAccess?: {
    requestedByUserId: string | null;
    internalArtistProAccess: boolean;
  };
  error: unknown;
}): boolean;

export class MonitoringDashboardHttpError extends Error {
  status: number;
  constructor(status: number, message: string);
}

export function shouldRetryMonitoringDashboard(
  failureCount: number,
  error: Error,
): boolean;

export function monitoringDashboardViewState(input: {
  isLoading: boolean;
  error: Error | null;
  hasData: boolean;
}): "loading" | "error" | "ready";
