const DATABASE_URL_ENV_NAMES = ["NEON_DATABASE_URL", "DATABASE_URL"];

/**
 * Return configuration metadata without ever returning either URL value.
 * This is safe to include in operational logs and guarded diagnostics.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 */
export function databaseUrlConfiguration(env = process.env) {
  const neon = typeof env.NEON_DATABASE_URL === "string" && env.NEON_DATABASE_URL.trim().length > 0
    ? env.NEON_DATABASE_URL
    : undefined;
  const legacy = typeof env.DATABASE_URL === "string" && env.DATABASE_URL.trim().length > 0
    ? env.DATABASE_URL
    : undefined;
  return {
    selectedName: neon ? "NEON_DATABASE_URL" : legacy ? "DATABASE_URL" : null,
    neonConfigured: Boolean(neon),
    databaseConfigured: Boolean(legacy),
    configuredValuesMatch: neon && legacy ? neon === legacy : null,
    conflictingTargets: Boolean(neon && legacy && neon !== legacy),
  };
}

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
