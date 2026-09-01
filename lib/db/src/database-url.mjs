const DATABASE_URL_ENV_NAMES = ["NEON_DATABASE_URL", "DATABASE_URL"];

/**
 * Resolve the configured PostgreSQL URL without creating a connection.
 * NEON_DATABASE_URL intentionally takes precedence over the legacy name.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string | undefined}
 */
export function getDatabaseUrl(env = process.env) {
  for (const name of DATABASE_URL_ENV_NAMES) {
    const value = env[name];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

/**
 * Resolve the configured PostgreSQL URL or fail without including either
 * potentially sensitive value in the error.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveDatabaseUrl(env = process.env) {
  const databaseUrl = getDatabaseUrl(env);
  if (!databaseUrl) {
    throw new Error(
      "Database connection is not configured. Set NEON_DATABASE_URL or DATABASE_URL.",
    );
  }
  return databaseUrl;
}

