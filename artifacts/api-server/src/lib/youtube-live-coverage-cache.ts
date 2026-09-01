export type YoutubeLiveCoverageCacheSource = "hit" | "miss" | "coalesced";

export interface YoutubeLiveCoverageCacheResult<T> {
  value: T;
  source: YoutubeLiveCoverageCacheSource;
  waitMs: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * A short-lived, per-process cache for the exact public coverage aggregate.
 * It never serves an expired value and never falls back to stale data after a
 * loader failure. Single-flight coalescing prevents a burst of public requests
 * from multiplying the same expensive read on the dedicated database pool.
 */
export class YoutubeLiveCoverageCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async getOrLoad(key: string, loader: () => Promise<T>): Promise<YoutubeLiveCoverageCacheResult<T>> {
    const startedAt = this.now();
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > this.now()) {
      return { value: cached.value, source: "hit", waitMs: this.now() - startedAt };
    }
    if (cached) this.entries.delete(key);

    const pending = this.inFlight.get(key);
    if (pending) {
      return { value: await pending, source: "coalesced", waitMs: this.now() - startedAt };
    }

    const load = loader();
    this.inFlight.set(key, load);
    try {
      const value = await load;
      this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
      return { value, source: "miss", waitMs: this.now() - startedAt };
    } finally {
      this.inFlight.delete(key);
    }
  }
}
