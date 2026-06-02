import { pool } from "@workspace/db";

type PgClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export type DailySnapshotProvider = "youtube" | "spotify";

export interface DailySnapshotRunLogInput {
  provider: DailySnapshotProvider;
  snapshotDate: string;
  reason: string;
}

export interface DailySnapshotRunLogUpdate {
  status: string;
  expectedCount: number;
  fetchedCount: number;
  savedCount: number;
  missingCount: number;
  dateRows: number;
  totalDailyValue: number;
  error?: string | null;
}

export async function ensureDailySnapshotRunLogTable(client: PgClient = pool) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS daily_snapshot_run_logs (
      id serial PRIMARY KEY,
      provider text NOT NULL,
      snapshot_date text NOT NULL,
      reason text NOT NULL,
      status text NOT NULL DEFAULT 'running',
      expected_count integer NOT NULL DEFAULT 0,
      fetched_count integer NOT NULL DEFAULT 0,
      saved_count integer NOT NULL DEFAULT 0,
      missing_count integer NOT NULL DEFAULT 0,
      date_rows integer NOT NULL DEFAULT 0,
      total_daily_value bigint NOT NULL DEFAULT 0,
      error text,
      started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS daily_snapshot_run_logs_provider_date_idx
    ON daily_snapshot_run_logs (provider, snapshot_date);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS daily_snapshot_run_logs_started_at_idx
    ON daily_snapshot_run_logs (started_at);
  `);
}

export async function startDailySnapshotRunLog(input: DailySnapshotRunLogInput): Promise<number | null> {
  try {
    await ensureDailySnapshotRunLogTable();
    const result = await pool.query<{ id: number }>(
      `
        INSERT INTO daily_snapshot_run_logs (provider, snapshot_date, reason, status)
        VALUES ($1, $2, $3, 'running')
        RETURNING id
      `,
      [input.provider, input.snapshotDate, input.reason],
    );
    return result.rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function finishDailySnapshotRunLog(id: number | null, update: DailySnapshotRunLogUpdate) {
  if (!id) return;

  try {
    await ensureDailySnapshotRunLogTable();
    await pool.query(
      `
        UPDATE daily_snapshot_run_logs
        SET status = $2,
            expected_count = $3,
            fetched_count = $4,
            saved_count = $5,
            missing_count = $6,
            date_rows = $7,
            total_daily_value = $8,
            error = $9,
            finished_at = now(),
            updated_at = now()
        WHERE id = $1
      `,
      [
        id,
        update.status,
        update.expectedCount,
        update.fetchedCount,
        update.savedCount,
        update.missingCount,
        update.dateRows,
        update.totalDailyValue,
        update.error ?? null,
      ],
    );
  } catch {
    // Logging must never make the snapshot job fail.
  }
}
