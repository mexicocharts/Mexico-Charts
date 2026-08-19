import { pool } from "@workspace/db";

export type ProprietaryChartSheet = {
  headers: string[];
  rows: Array<Record<string, string>>;
  chartDate: string;
};

export async function ensureProprietaryChartArchive(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proprietary_chart_snapshots (
      chart_key text NOT NULL,
      chart_date text NOT NULL,
      generated_at timestamptz NOT NULL DEFAULT now(),
      methodology_version text NOT NULL DEFAULT 'source-sheet-v1',
      row_count integer NOT NULL,
      payload jsonb NOT NULL,
      PRIMARY KEY (chart_key, chart_date)
    );
    CREATE INDEX IF NOT EXISTS proprietary_chart_snapshots_date_idx
      ON proprietary_chart_snapshots(chart_date DESC);
  `);
}

export async function archiveProprietaryCharts(
  sheets: Record<string, ProprietaryChartSheet>,
): Promise<number> {
  await ensureProprietaryChartArchive();
  let saved = 0;
  for (const [chartKey, sheet] of Object.entries(sheets)) {
    if (!sheet.rows.length) continue;
    await pool.query(`
      INSERT INTO proprietary_chart_snapshots
        (chart_key, chart_date, generated_at, methodology_version, row_count, payload)
      VALUES ($1,$2,now(),'source-sheet-v1',$3,$4::jsonb)
      ON CONFLICT (chart_key, chart_date) DO UPDATE SET
        generated_at=excluded.generated_at,
        methodology_version=excluded.methodology_version,
        row_count=excluded.row_count,
        payload=excluded.payload
    `, [chartKey, sheet.chartDate, sheet.rows.length, JSON.stringify({ headers: sheet.headers, rows: sheet.rows })]);
    saved += 1;
  }
  return saved;
}
