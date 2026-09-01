export function getDatabaseUrl(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string | undefined;

export function resolveDatabaseUrl(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string;

