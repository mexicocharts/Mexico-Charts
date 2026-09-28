/** Shared, request-driven backoff for Spotify artwork only. No timer or job. */
export function createArtworkRateLimit(now: () => number = Date.now) {
  let retryAt = 0;
  let active = 0;
  const waiting: Array<() => void> = [];
  async function acquire(signal?: AbortSignal | null) {
    signal?.throwIfAborted();
    if (active < 4) active++;
    else await new Promise<void>((resolve, reject) => {
      const ready = () => { signal?.removeEventListener("abort", aborted); resolve(); };
      const aborted = () => {
        const index = waiting.indexOf(ready);
        if (index >= 0) waiting.splice(index, 1);
        reject(signal?.reason);
      };
      waiting.push(ready);
      signal?.addEventListener("abort", aborted, { once: true });
    });
    // Transfer the occupied slot to the next waiter; never start a timer/job.
    return () => { const next = waiting.shift(); if (next) next(); else active--; };
  }
  const remaining = () => Math.max(0, retryAt - now());
  return {
    remaining,
    async fetch(input: string, options: RequestInit, fetcher: typeof fetch = fetch) {
      if (remaining() > 0) throw new Error("Artwork provider cooling down");
      const release = await acquire(options.signal);
      try {
        options.signal?.throwIfAborted();
        // Another in-flight request can establish cooldown while this one waits.
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
      } finally { release(); }
    },
  };
}

export const monitoringArtworkRateLimit = createArtworkRateLimit();
