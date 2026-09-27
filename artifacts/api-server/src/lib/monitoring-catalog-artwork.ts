/** Request-driven artwork reads only. No database writes, timers/jobs or provider search. */
export type CatalogArtworkResource = { type: "track" | "album"; key: string; artworkUrl?: string | null };
export const ARTWORK_BATCH_SIZE = 12;
const cache = new Map<string, { url: string; expires: number }>();
const inFlight = new Map<string, Promise<string | null>>();
let active = 0;
const waiting: Array<() => void> = [];
const resourceKey = (item: CatalogArtworkResource) => `${item.type}:${item.key}`;

export function parseCatalogArtworkKeys(raw: string): string[] | null {
  const keys = raw.split(",");
  return keys.length > 0 && keys.length <= ARTWORK_BATCH_SIZE &&
    new Set(keys).size === keys.length && keys.every(key => /^(track|album):[A-Za-z0-9]{22}$/.test(key)) ? keys : null;
}

export function cachedCatalogArtwork(item: CatalogArtworkResource): string | null {
  const value = cache.get(resourceKey(item));
  if (!value || value.expires <= Date.now()) return null;
  return value.url;
}

async function acquire(signal: AbortSignal): Promise<() => void> {
  if (signal.aborted) throw signal.reason;
  if (active >= 4) await new Promise<void>((resolve, reject) => {
    const ready = () => { signal.removeEventListener("abort", abort); resolve(); };
    const abort = () => { const index = waiting.indexOf(ready); if (index >= 0) waiting.splice(index, 1); reject(signal.reason); };
    waiting.push(ready);
    signal.addEventListener("abort", abort, { once: true });
  });
  // A release transfers its slot directly to a queued caller.
  else active++;
  return () => { const next = waiting.shift(); if (next) next(); else active--; };
}

async function resolveArtwork(item: CatalogArtworkResource, signal: AbortSignal, fetcher: typeof fetch): Promise<string | null> {
  const key = resourceKey(item);
  const cached = cachedCatalogArtwork(item);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = (async () => {
    let release: (() => void) | undefined;
    try {
      release = await acquire(signal);
      const resource = `https://open.spotify.com/${item.type}/${item.key}`;
      const response = await fetcher(`https://open.spotify.com/oembed?url=${encodeURIComponent(resource)}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(3_000)]), redirect: "error",
      });
      if (!response.ok) return null;
      const payload = await response.json() as { thumbnail_url?: unknown };
      if (typeof payload.thumbnail_url !== "string") return null;
      const url = new URL(payload.thumbnail_url);
      if (url.protocol !== "https:" || url.username || url.password ||
        !/^(i\.scdn\.co|image-cdn-[a-z]+\.spotifycdn\.com)$/.test(url.hostname)) return null;
      if (cache.size >= 5_000) cache.delete(cache.keys().next().value!);
      cache.set(key, { url: url.href, expires: Date.now() + 6 * 60 * 60 * 1_000 });
      return url.href;
    } catch { return null; }
    finally { release?.(); }
  })();
  inFlight.set(key, request);
  try { return await request; } finally { inFlight.delete(key); }
}

/** Membership must be checked against the authenticated artist's real catalog first. */
export async function loadCatalogArtworkBatch(items: CatalogArtworkResource[], fetcher: typeof fetch = fetch) {
  if (!parseCatalogArtworkKeys(items.map(resourceKey).join(","))) throw new Error("Invalid artwork batch");
  const signal = AbortSignal.timeout(8_000);
  return Promise.all(items.map(async item => {
    const artworkUrl = item.artworkUrl || await resolveArtwork(item, signal, fetcher);
    return { resource: resourceKey(item), artworkUrl, status: artworkUrl ? "loaded" as const : "pending" as const };
  }));
}
