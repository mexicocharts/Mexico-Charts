/** Source identities only: never cache Clerk users, entitlements or subscriptions.
 * The 60-second lifetime matches the existing accepted-alias inventory cache.
 * Failures and absent artists are never cached; there is no stale-on-error path.
 */
export function createMonitoringIdentityCache<T>(now = Date.now) {
  const values = new Map<string, { expiresAt: number; value: T }>();
  const pending = new Map<string, Promise<T | null>>();
  const maxEntries = 512;
  return async (
    key: string,
    load: () => Promise<T | null>,
    diagnostic?: (outcome: "hit" | "miss" | "coalesced") => void,
  ): Promise<T | null> => {
    const cached = values.get(key);
    if (cached && cached.expiresAt > now()) {
      diagnostic?.("hit");
      return structuredClone(cached.value);
    }
    values.delete(key);
    const shared = pending.get(key);
    if (shared) {
      diagnostic?.("coalesced");
      return structuredClone(await shared);
    }
    diagnostic?.("miss");
    // Bound concurrent cache bookkeeping without rejecting a legitimate read.
    if (pending.size >= maxEntries) return load();
    const operation = Promise.resolve().then(load).then(value => {
      if (value !== null) {
        for (const [oldKey, old] of values) if (old.expiresAt <= now()) values.delete(oldKey);
        if (values.size >= maxEntries) values.delete(values.keys().next().value!);
        values.set(key, { expiresAt: now() + 60_000, value: structuredClone(value) });
      }
      return value;
    });
    pending.set(key, operation);
    try { return structuredClone(await operation); }
    finally { pending.delete(key); }
  };
}
