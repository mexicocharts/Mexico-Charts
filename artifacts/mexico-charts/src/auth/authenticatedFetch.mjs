const DEFAULT_TOKEN_TIMEOUT_MS = 3_000;

function requestUrl(input, locationHref) {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  return new URL(raw, locationHref);
}

function cloneRequestInput(input) {
  return typeof Request !== "undefined" && input instanceof Request
    ? input.clone()
    : input;
}

async function acquireToken(getToken, timeoutMs, setTimer, clearTimer) {
  let timeoutHandle;
  const timeout = new Promise((resolve) => {
    timeoutHandle = setTimer(
      () => resolve({ outcome: "timeout", token: null }),
      timeoutMs,
    );
  });
  const tokenRequest = Promise.resolve()
    .then(() => getToken())
    .then((token) => {
      const usableToken =
        typeof token === "string" && token.trim() ? token : null;
      return {
        outcome: usableToken ? "success" : "unavailable",
        token: usableToken,
      };
    })
    .catch(() => ({ outcome: "unavailable", token: null }));

  try {
    return await Promise.race([tokenRequest, timeout]);
  } finally {
    if (timeoutHandle !== undefined) clearTimer(timeoutHandle);
  }
}

function defaultLogger(event) {
  console.info("[clerk_auth_transport]", event);
}

/**
 * Creates the authenticated request helper with injectable browser primitives
 * so the Safari token-timeout and cookie fallback paths can be tested without
 * weakening the real Clerk authentication flow.
 */
export function createAuthenticatedFetch({
  fetchImpl = (...args) => globalThis.fetch(...args),
  locationHref = () => globalThis.location?.href ?? "http://localhost/",
  logger = defaultLogger,
  tokenTimeoutMs = DEFAULT_TOKEN_TIMEOUT_MS,
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = (handle) => globalThis.clearTimeout(handle),
} = {}) {
  return async function authenticatedFetch(getToken, input, init = {}) {
    const url = requestUrl(input, locationHref());
    const currentOrigin = new URL(locationHref()).origin;
    const sameOrigin = url.origin === currentOrigin;
    const requestPath = url.pathname;
    const tokenResult = await acquireToken(
      getToken,
      tokenTimeoutMs,
      setTimer,
      clearTimer,
    );
    const headers = new Headers(init.headers);

    // This helper owns the Clerk Authorization header. A caller-provided stale
    // value must never survive when the helper selects cookie authentication.
    if (sameOrigin) headers.delete("authorization");
    if (tokenResult.token) {
      headers.set("authorization", `Bearer ${tokenResult.token}`);
    }

    const credentials = sameOrigin ? "include" : init.credentials;
    const primaryTransport = tokenResult.token ? "bearer" : "cookie_fallback";
    logger({
      event: "clerk_auth_transport",
      tokenAcquisitionOutcome: tokenResult.outcome,
      authTransport: primaryTransport,
      sameOrigin,
      requestPath,
    });

    const retryInput = cloneRequestInput(input);
    const response = await fetchImpl(input, {
      ...init,
      headers,
      ...(credentials ? { credentials } : {}),
    });

    // Clerk prefers an Authorization bearer when one is present. If that
    // bearer is stale or rejected, replay this same-origin request exactly once
    // without it so Clerk can resolve the valid first-party session cookie.
    if (sameOrigin && tokenResult.token && response.status === 401) {
      const fallbackHeaders = new Headers(init.headers);
      fallbackHeaders.delete("authorization");
      logger({
        event: "clerk_auth_transport",
        tokenAcquisitionOutcome: tokenResult.outcome,
        authTransport: "cookie_fallback",
        fallbackReason: "bearer_rejected",
        sameOrigin: true,
        requestPath,
      });
      return fetchImpl(retryInput, {
        ...init,
        headers: fallbackHeaders,
        credentials: "include",
      });
    }

    return response;
  };
}

export const authenticatedFetch = createAuthenticatedFetch();
