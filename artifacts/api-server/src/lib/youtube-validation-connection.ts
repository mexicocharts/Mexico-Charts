export type BoundedConnectionRetryOptions<T> = {
  connect: () => Promise<T>;
  maxAttempts: number;
  retryDelayMs: (failedAttempt: number) => number;
  sleep?: (milliseconds: number) => Promise<void>;
  onFailedAttempt?: (details: {
    attempt: number;
    durationMs: number;
    error: unknown;
    maxAttempts: number;
    retryDelayMs: number | null;
  }) => void;
};

const defaultSleep = (milliseconds: number) =>
  new Promise<void>(resolve => setTimeout(resolve, milliseconds));

export async function connectWithBoundedRetry<T>(
  options: BoundedConnectionRetryOptions<T>,
): Promise<T> {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }

  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      return await options.connect();
    } catch (error) {
      lastError = error;
      const retryDelayMs = attempt < options.maxAttempts
        ? Math.max(0, options.retryDelayMs(attempt))
        : null;
      options.onFailedAttempt?.({
        attempt,
        durationMs: Date.now() - startedAt,
        error,
        maxAttempts: options.maxAttempts,
        retryDelayMs,
      });
      if (retryDelayMs !== null) await sleep(retryDelayMs);
    }
  }

  throw lastError;
}
