/** Shared, request-driven backoff for Spotify artwork only. No timer or job. */
export function createArtworkRateLimit(now: () => number = Date.now) {
  let retryAt = 0;
  const remaining = () => Math.max(0, retryAt - now());
  return {
    remaining,
    async fetch(input: string, options: RequestInit, fetcher: typeof fetch = fetch) {
      if (remaining() > 0) throw new Error("Artwork provider cooling down");
      const response = await fetcher(input, options);
      if (response.status === 429) {
        const header = response.headers.get("retry-after");
        const seconds = header != null && /^\d+(?:\.\d+)?$/.test(header.trim()) ? Number(header) : null;
        const delay = seconds != null ? seconds * 1000 : header ? Date.parse(header) - now() : 0;
        // A missing/zero Retry-After must not cause an immediate retry storm.
        retryAt = Math.max(retryAt, now() + Math.max(60_000, Number.isFinite(delay) ? delay : 0));
      }
      return response;
    },
  };
}

export const monitoringArtworkRateLimit = createArtworkRateLimit();
