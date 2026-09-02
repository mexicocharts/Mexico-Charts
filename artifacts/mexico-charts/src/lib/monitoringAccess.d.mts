export const INTERNAL_ARTIST_PRO_DEFAULT_ARTIST_KEY: string;

export function internalMonitoringEntryPath(input: {
  internalArtistProAccess: boolean;
  requestedArtistKey?: string | null;
}): string | null;

export function shouldLoadPublicMonitoringCatalog(input: {
  isSignedIn: boolean;
  accountAccess?: { internalArtistProAccess: boolean };
}): boolean;

export class MonitoringDashboardHttpError extends Error {
  status: number;
  constructor(status: number, message: string);
}

export function shouldRetryMonitoringDashboard(failureCount: number, error: Error): boolean;

export function monitoringDashboardViewState(input: {
  isLoading: boolean;
  error: Error | null;
  hasData: boolean;
}): "loading" | "error" | "ready";
