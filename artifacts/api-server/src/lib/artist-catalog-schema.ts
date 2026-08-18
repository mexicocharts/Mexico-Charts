import { pool } from "@workspace/db";

/**
 * Runtime-created catalog tables predate generated database migrations.
 * Keep this additive and idempotent so existing production data is preserved.
 */
export async function ensureArtistCatalogSchema(): Promise<void> {
  await pool.query(`
    ALTER TABLE kworb_coverage
    ADD COLUMN IF NOT EXISTS songstats_eligible boolean NOT NULL DEFAULT true
  `);
}
