export interface DatabaseUrlConfiguration {
  selectedName: "NEON_DATABASE_URL" | "DATABASE_URL" | null;
  neonConfigured: boolean;
  databaseConfigured: boolean;
  configuredValuesMatch: boolean | null;
  conflictingTargets: boolean;
}

export function databaseUrlConfiguration(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): DatabaseUrlConfiguration;

export function getDatabaseUrl(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string | undefined;

export function resolveDatabaseUrl(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): string;
