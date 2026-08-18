import { pool } from "@workspace/db";

export type ArchivedChartSheet = {
  headers: string[];
  rows: Array<Record<string, string>>;
  chartDate: string | null;
  fetchedAt: string | null;
};

export async function ensureOfficialChartArchive(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS official_chart_snapshots (
      chart_key text NOT NULL,
      chart_date text NOT NULL,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      row_count integer NOT NULL,
      payload jsonb NOT NULL,
      PRIMARY KEY (chart_key, chart_date)
    );
    CREATE INDEX IF NOT EXISTS official_chart_snapshots_date_idx
      ON official_chart_snapshots(chart_date DESC);
  `);
}

export async function archiveOfficialCharts(sheets: Record<string, ArchivedChartSheet>): Promise<number> {
  await ensureOfficialChartArchive();
  let saved = 0;
  for (const [chartKey, sheet] of Object.entries(sheets)) {
    if (!sheet.chartDate || sheet.rows.length === 0) continue;
    await pool.query(`
      INSERT INTO official_chart_snapshots(chart_key, chart_date, fetched_at, row_count, payload)
      VALUES ($1,$2,COALESCE($3::timestamptz,now()),$4,$5::jsonb)
      ON CONFLICT (chart_key, chart_date) DO UPDATE SET
        fetched_at=GREATEST(official_chart_snapshots.fetched_at, excluded.fetched_at),
        row_count=excluded.row_count,
        payload=excluded.payload
    `, [chartKey, sheet.chartDate, sheet.fetchedAt, sheet.rows.length, JSON.stringify({ headers: sheet.headers, rows: sheet.rows })]);
    saved += 1;
  }
  return saved;
}

