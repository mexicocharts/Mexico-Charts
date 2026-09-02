import { pool, type PoolClient } from "@workspace/db";

export const ACCOUNT_WRITE_STATEMENT_TIMEOUT_MS = 8_000;

type DatabaseErrorLike = Error & {
  code?: string;
  errno?: string | number;
};

const REQUEST_DATABASE_UNAVAILABLE_CODES = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "53300",
  "57014",
  "57P01",
  "57P02",
  "57P03",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
]);

export function isRequestDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const typed = error as DatabaseErrorLike;
  if (typed.code && REQUEST_DATABASE_UNAVAILABLE_CODES.has(String(typed.code))) return true;
  if (typed.errno && REQUEST_DATABASE_UNAVAILABLE_CODES.has(String(typed.errno))) return true;
  return /(?:connection|pool|query|statement).*(?:timeout|timed out)|timeout exceeded|connection terminated|too many clients/i
    .test(error.message);
}

export function safeDatabaseDiagnostic(error: unknown) {
  const typed = error instanceof Error ? error as DatabaseErrorLike : null;
  return {
    errorName: typed?.name ?? "UnknownDatabaseError",
    errorCode: typed?.code ? String(typed.code).slice(0, 24) : null,
    unavailable: isRequestDatabaseUnavailable(error),
  };
}

export function requestDatabaseHttpStatus(error: unknown): 500 | 503 {
  return isRequestDatabaseUnavailable(error) ? 503 : 500;
}

type AccountWriteClient = Pick<PoolClient, "query" | "release">;

export async function runBoundedAccountUpsert(
  userId: string,
  connect: () => Promise<AccountWriteClient> = () => pool.connect(),
): Promise<void> {
  const client = await connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query(`SET LOCAL statement_timeout = '${ACCOUNT_WRITE_STATEMENT_TIMEOUT_MS}ms'`);
    await client.query({
      text: `INSERT INTO user_accounts (clerk_user_id)
             VALUES ($1)
             ON CONFLICT (clerk_user_id) DO NOTHING`,
      values: [userId],
    });
    await client.query("COMMIT");
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    throw error;
  } finally {
    client.release();
  }
}

export function elapsedMilliseconds(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 10) / 10;
}
