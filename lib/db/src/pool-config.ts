export const DEFAULT_POOL_MAX = 10;
export const DEFAULT_POOL_CONNECTION_TIMEOUT_MS = 5_000;

export const PUBLIC_READ_POOL_MAX = 3;
export const PUBLIC_READ_CONNECTION_TIMEOUT_MS = 3_000;
export const PUBLIC_READ_STATEMENT_TIMEOUT_MS = 15_000;
export const PUBLIC_READ_QUERY_TIMEOUT_MS = 17_000;

export const MONITORING_READ_POOL_MAX = 3;
export const MONITORING_READ_CONNECTION_TIMEOUT_MS = 3_000;
export const MONITORING_READ_STATEMENT_TIMEOUT_MS = 10_000;
export const MONITORING_READ_QUERY_TIMEOUT_MS = 12_000;

export const SCHEMA_BOOTSTRAP_CONNECTION_TIMEOUT_MS = 5_000;
export const SCHEMA_BOOTSTRAP_STATEMENT_TIMEOUT_MS = 30_000;
export const SCHEMA_BOOTSTRAP_QUERY_TIMEOUT_MS = 35_000;

export const defaultPoolOptions = {
  max: DEFAULT_POOL_MAX,
  connectionTimeoutMillis: DEFAULT_POOL_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: 30_000,
} as const;

export const publicReadPoolOptions = {
  application_name: "mexico-charts-public-read",
  max: PUBLIC_READ_POOL_MAX,
  connectionTimeoutMillis: PUBLIC_READ_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: 30_000,
  statement_timeout: PUBLIC_READ_STATEMENT_TIMEOUT_MS,
  query_timeout: PUBLIC_READ_QUERY_TIMEOUT_MS,
} as const;

export const monitoringReadPoolOptions = {
  application_name: "mexico-charts-monitoring-read",
  max: MONITORING_READ_POOL_MAX,
  connectionTimeoutMillis: MONITORING_READ_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: 30_000,
  statement_timeout: MONITORING_READ_STATEMENT_TIMEOUT_MS,
  query_timeout: MONITORING_READ_QUERY_TIMEOUT_MS,
} as const;

export const schemaBootstrapPoolOptions = {
  application_name: "mexico-charts-schema-bootstrap",
  max: 1,
  connectionTimeoutMillis: SCHEMA_BOOTSTRAP_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: 10_000,
  statement_timeout: SCHEMA_BOOTSTRAP_STATEMENT_TIMEOUT_MS,
  query_timeout: SCHEMA_BOOTSTRAP_QUERY_TIMEOUT_MS,
} as const;
