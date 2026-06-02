import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

async function main() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const counts = await pool.query<{ table_name: string; row_count: string }>(`
      SELECT 'chart_snapshots' AS table_name, COUNT(*)::text AS row_count FROM chart_snapshots
      UNION ALL
      SELECT 'chart_snapshot_rows', COUNT(*)::text FROM chart_snapshot_rows
      UNION ALL
      SELECT 'artist_candidates', COUNT(*)::text FROM artist_candidates
      UNION ALL
      SELECT 'artist_candidate_events', COUNT(*)::text FROM artist_candidate_events
      UNION ALL
      SELECT 'artist_candidate_signals', COUNT(*)::text FROM artist_candidate_signals
      ORDER BY table_name;
    `);

    const byStatus = await pool.query<{ status: string; count: string }>(`
      SELECT status, COUNT(*)::text AS count
      FROM artist_candidates
      GROUP BY status
      ORDER BY count DESC, status ASC;
    `);

    const snapshots = await pool.query(`
      SELECT source, chart_type, country, chart_date, COUNT(r.id)::integer AS rows
      FROM chart_snapshots s
      LEFT JOIN chart_snapshot_rows r ON r.snapshot_id = s.id
      GROUP BY s.id
      ORDER BY s.chart_date DESC, s.source ASC, s.chart_type ASC
      LIMIT 20;
    `);

    const candidates = await pool.query(`
      SELECT
        artist_name,
        status,
        confidence_score,
        first_seen_date,
        last_seen_date,
        total_appearances,
        source_count
      FROM artist_candidates
      ORDER BY confidence_score DESC, total_appearances DESC, artist_name ASC
      LIMIT 20;
    `);

    console.log("ARTIST DISCOVERY TABLE COUNTS");
    for (const row of counts.rows) console.log(`${row.table_name}: ${row.row_count}`);

    console.log("\nCANDIDATES BY STATUS");
    for (const row of byStatus.rows) console.log(`${row.status}: ${row.count}`);

    console.log("\nRECENT SNAPSHOTS");
    for (const row of snapshots.rows) console.log(JSON.stringify(row));

    console.log("\nTOP CANDIDATES");
    for (const row of candidates.rows) console.log(JSON.stringify(row));
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
