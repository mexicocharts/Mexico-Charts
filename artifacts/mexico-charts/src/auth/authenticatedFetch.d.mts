export type ClerkTokenGetter = () => Promise<string | null>;

export type ClerkAuthTransportEvent = {
  event: "clerk_auth_transport";
  tokenAcquisitionOutcome: "success" | "timeout" | "unavailable";
  authTransport: "bearer" | "cookie_fallback";
  fallbackReason?: "bearer_rejected";
  sameOrigin: boolean;
  requestPath: string;
};

export type AuthenticatedFetch = (
  getToken: ClerkTokenGetter,
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function createAuthenticatedFetch(options?: {
  fetchImpl?: typeof fetch;
  locationHref?: () => string;
  logger?: (event: ClerkAuthTransportEvent) => void;
  tokenTimeoutMs?: number;
  setTimer?: (
    callback: () => void,
    delay: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}): AuthenticatedFetch;

export const authenticatedFetch: AuthenticatedFetch;
