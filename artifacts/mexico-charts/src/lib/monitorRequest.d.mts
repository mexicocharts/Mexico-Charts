export const MONITOR_REQUEST_TIMEOUT_MS: number;
export type MonitorRequestState =
  | "loading"
  | "loaded"
  | "empty"
  | "authorization_failure"
  | "backend_failure"
  | "timeout"
  | "partial";
export type MonitorHistoryResponse = {
  status: "available" | "unavailable";
  points: Array<[string, number, ...unknown[]]>;
  rangeCoverage?: { observationCount: number; missingDateCount: number };
  resolution?: {
    returned: "daily" | "minmax";
    exactSourcePoints: number;
    returnedDisplayPoints: number;
  };
};
export function requestMonitorResource<T>(input: {
  getToken: () => Promise<string | null>;
  input: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  readResponse?: (response: Response) => Promise<T>;
}): Promise<T>;
export function monitorRequestState(input: {
  isFetching: boolean;
  error: unknown;
  succeeded: boolean;
  observationCount?: number;
  partial?: boolean;
}): MonitorRequestState;
export function validateMonitorHistory(
  payload: unknown,
): MonitorHistoryResponse;
export function validateMonitorDashboard<T>(payload: T): T;
export function canDisplayMonitorData(input: {
  configured: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  data: unknown;
  error: unknown;
}): boolean;
export function shouldRetryMonitorRequest(
  failureCount: number,
  error: Error,
): boolean;
