import { databaseTargetConfiguration } from "@workspace/db";

type QueryClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export interface SafeDatabaseRuntimeIdentity {
  selectedSource: "NEON_DATABASE_URL" | "DATABASE_URL" | null;
  neonConfigured: boolean;
  databaseConfigured: boolean;
  configuredValuesMatch: boolean | null;
  conflictingTargets: boolean;
  databaseName: string;
  databaseUser: string;
  serverAddress: string | null;
  serverPort: number | null;
  observedAt: string;
  applicationName: string;
}

/** Safe operational identity only: no URL, credential, hash, or secret value. */
export async function readSafeDatabaseRuntimeIdentity(
  client: QueryClient,
): Promise<SafeDatabaseRuntimeIdentity> {
  const result = await client.query<{
    database_name: string;
    database_user: string;
    server_address: string | null;
    server_port: number | null;
    observed_at: string;
    application_name: string;
  }>(`
    SELECT
      current_database() database_name,
      current_user database_user,
      inet_server_addr()::text server_address,
      inet_server_port() server_port,
      clock_timestamp()::text observed_at,
      current_setting('application_name') application_name
  `);
  const row = result.rows[0]!;
  return {
    selectedSource: databaseTargetConfiguration.selectedName,
    neonConfigured: databaseTargetConfiguration.neonConfigured,
    databaseConfigured: databaseTargetConfiguration.databaseConfigured,
    configuredValuesMatch: databaseTargetConfiguration.configuredValuesMatch,
    conflictingTargets: databaseTargetConfiguration.conflictingTargets,
    databaseName: row.database_name,
    databaseUser: row.database_user,
    serverAddress: row.server_address,
    serverPort: row.server_port,
    observedAt: row.observed_at,
    applicationName: row.application_name,
  };
}

export type YoutubeRunLogLevel = "info" | "warn" | "error";

export function youtubeCollectorRunLogLevel(
  status: "complete" | "disabled" | "locked" | "quota_exhausted" | "failed",
): YoutubeRunLogLevel {
  if (status === "complete") return "info";
  if (status === "failed") return "error";
  return "warn";
}

export function youtubeValidationRunLogLevel(
  status: "running" | "complete" | "skipped",
): YoutubeRunLogLevel {
  return status === "skipped" ? "warn" : "info";
}
