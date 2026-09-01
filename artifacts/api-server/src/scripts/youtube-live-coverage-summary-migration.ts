import { performance } from "node:perf_hooks";

import { youtubeCoveragePool, type PoolClient } from "@workspace/db";
import {
  YOUTUBE_LIVE_COVERAGE_ELIGIBLE_PAIR_TOTALS_SQL,
  YOUTUBE_LIVE_COVERAGE_FIELDS,
  YOUTUBE_LIVE_COVERAGE_MAPPING_SQL,
  youtubeLiveCoverageArtistSql,
  youtubeLiveCoverageRowsEqual,
  youtubeLiveCoverageVideoSql,
} from "@workspace/db/youtube-live-coverage-query";

import {
  ensureYoutubeLiveCoverageSummarySchema,
  YOUTUBE_LIVE_COVERAGE_SUMMARY_LOCK_KEY,
} from "../lib/youtube-live-coverage-summary";

type Mode = "profile" | "backfill" | "reconcile" | "verify" | "compare" | "activate" | "deactivate" | "status";

function parseArgs() {
  const values = new Map<string, string>();
  for (const argument of process.argv.slice(2)) {
    const [key, value = "true"] = argument.replace(/^--/, "").split("=", 2);
    values.set(key, value);
  }
  const mode = (values.get("mode") ?? "profile") as Mode;
  if (!["profile", "backfill", "reconcile", "verify", "compare", "activate", "deactivate", "status"].includes(mode)) {
    throw new Error(`Unsupported --mode=${mode}.`);
  }
  return {
    mode,
    write: values.get("write") === "true",
    batchSize: Math.max(100, Math.min(10_000, Number(values.get("batch-size") ?? 2_000) || 2_000)),
    maxBatches: Math.max(1, Math.min(250, Number(values.get("max-batches") ?? 20) || 20)),
    afterArtist: values.get("after-artist") ?? "",
    afterVideo: values.get("after-video") ?? "",
  };
}

const args = parseArgs();
if (["backfill", "reconcile", "activate", "deactivate"].includes(args.mode) && !args.write) {
  throw new Error(`${args.mode} requires explicit --write=true.`);
}

const MIGRATION_LOCK_KEY = 392_410_606;
const eligibleSourceSql = `
  WITH roster_keys AS MATERIALIZED (
    SELECT DISTINCT youtube_coverage_normalize_artist_key(artist_key) normalized_artist_key
    FROM kworb_coverage
    WHERE status='active'
  )
  SELECT DISTINCT
    youtube_coverage_normalize_artist_key(candidate.artist_key) normalized_artist_key,
    candidate.video_id
  FROM roster_keys roster
  JOIN youtube_music_catalog_candidates candidate
    ON youtube_coverage_normalize_artist_key(candidate.artist_key)=roster.normalized_artist_key
  WHERE candidate.status IN ('review','verified')
    AND candidate.sampling_status='shadow'
`;

function json(event: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...details }));
}

async function timed<T>(name: string, operation: () => Promise<T>) {
  const startedAt = performance.now();
  const value = await operation();
  const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
  json(name, { durationMs });
  return { value, durationMs };
}

async function profile(client: PoolClient) {
  const result = await timed("eligible_pair_profile", () => client.query<{
    logical_pairs: string;
    logical_artists: string;
    logical_videos: string;
  }>(`
    SELECT count(*)::text logical_pairs,
      count(DISTINCT normalized_artist_key)::text logical_artists,
      count(DISTINCT video_id)::text logical_videos
    FROM (${eligibleSourceSql}) eligible
  `));
  const row = result.value.rows[0]!;
  const logicalPairs = Number(row.logical_pairs);
  json("eligible_pair_profile_result", {
    logicalPairs,
    logicalArtists: Number(row.logical_artists),
    logicalVideos: Number(row.logical_videos),
    batchSize: args.batchSize,
    estimatedBatches: Math.ceil(logicalPairs / args.batchSize),
    expectedLoad: "bounded indexed roster-to-candidate reads plus primary-key inserts; 2s lock timeout",
    writePerformed: false,
  });
}

async function backfill(client: PoolClient) {
  let afterArtist = args.afterArtist;
  let afterVideo = args.afterVideo;
  let totalScanned = 0;
  let totalInserted = 0;
  for (let batchNumber = 1; batchNumber <= args.maxBatches; batchNumber += 1) {
    const batch = await timed("eligible_pair_backfill_batch", () => client.query<{
      normalized_artist_key: string;
      video_id: string;
      inserted: boolean;
    }>(`
      WITH roster_keys AS MATERIALIZED (
        SELECT DISTINCT youtube_coverage_normalize_artist_key(artist_key) normalized_artist_key
        FROM kworb_coverage
        WHERE status='active'
      ), batch AS MATERIALIZED (
        SELECT DISTINCT
          youtube_coverage_normalize_artist_key(candidate.artist_key) normalized_artist_key,
          candidate.video_id
        FROM youtube_music_catalog_candidates candidate
        WHERE candidate.status IN ('review','verified')
          AND candidate.sampling_status='shadow'
          AND (
            youtube_coverage_normalize_artist_key(candidate.artist_key),
            candidate.video_id
          ) > ($1::text, $2::text)
          AND EXISTS (
            SELECT 1 FROM roster_keys roster
            WHERE roster.normalized_artist_key=youtube_coverage_normalize_artist_key(candidate.artist_key)
          )
        ORDER BY normalized_artist_key, candidate.video_id
        LIMIT $3
      ), inserted AS (
        INSERT INTO youtube_live_coverage_eligible_pairs (
          normalized_artist_key, video_id, source_updated_at
        )
        SELECT normalized_artist_key, video_id, now() FROM batch
        ON CONFLICT (normalized_artist_key, video_id) DO NOTHING
        RETURNING normalized_artist_key, video_id
      )
      SELECT batch.normalized_artist_key, batch.video_id,
        inserted.video_id IS NOT NULL inserted
      FROM batch
      LEFT JOIN inserted USING (normalized_artist_key, video_id)
      ORDER BY batch.normalized_artist_key, batch.video_id
    `, [afterArtist, afterVideo, args.batchSize]));
    const rows = batch.value.rows;
    if (!rows.length) {
      json("eligible_pair_backfill_complete", { totalScanned, totalInserted, afterArtist, afterVideo });
      return;
    }
    totalScanned += rows.length;
    totalInserted += rows.filter(row => row.inserted).length;
    afterArtist = rows.at(-1)!.normalized_artist_key;
    afterVideo = rows.at(-1)!.video_id;
    json("eligible_pair_backfill_progress", {
      batchNumber,
      scanned: rows.length,
      inserted: rows.filter(row => row.inserted).length,
      totalScanned,
      totalInserted,
      nextAfterArtist: afterArtist,
      nextAfterVideo: afterVideo,
    });
    if (rows.length < args.batchSize) {
      json("eligible_pair_backfill_complete", { totalScanned, totalInserted, afterArtist, afterVideo });
      return;
    }
  }
  json("eligible_pair_backfill_paused", {
    reason: "bounded_batch_limit",
    totalScanned,
    totalInserted,
    resumeWith: `--mode=backfill --write=true --after-artist=${afterArtist} --after-video=${afterVideo}`,
  });
}

async function reconcile(client: PoolClient) {
  let deleted = 0;
  for (let batchNumber = 1; batchNumber <= args.maxBatches; batchNumber += 1) {
    const result = await client.query<{ normalized_artist_key: string }>(`
      WITH stale AS (
        SELECT ctid
        FROM youtube_live_coverage_eligible_pairs pair
        WHERE NOT youtube_coverage_pair_is_current(pair.normalized_artist_key, pair.video_id)
        LIMIT $1
      )
      DELETE FROM youtube_live_coverage_eligible_pairs pair
      USING stale
      WHERE pair.ctid=stale.ctid
      RETURNING pair.normalized_artist_key
    `, [args.batchSize]);
    deleted += result.rows.length;
    json("eligible_pair_reconcile_progress", { batchNumber, deleted: result.rows.length, totalDeleted: deleted });
    if (result.rows.length < args.batchSize) break;
  }
  json("eligible_pair_reconcile_complete", { totalDeleted: deleted });
}

async function verify(client: PoolClient) {
  const result = await timed("eligible_pair_verification", () => client.query<{
    expected_pairs: string;
    stored_pairs: string;
    missing_pairs: string;
    stale_pairs: string;
  }>(`
    WITH expected AS MATERIALIZED (${eligibleSourceSql}), stored AS MATERIALIZED (
      SELECT normalized_artist_key, video_id FROM youtube_live_coverage_eligible_pairs
    )
    SELECT
      (SELECT count(*)::text FROM expected) expected_pairs,
      (SELECT count(*)::text FROM stored) stored_pairs,
      (SELECT count(*)::text FROM expected LEFT JOIN stored USING (normalized_artist_key,video_id)
        WHERE stored.video_id IS NULL) missing_pairs,
      (SELECT count(*)::text FROM stored LEFT JOIN expected USING (normalized_artist_key,video_id)
        WHERE expected.video_id IS NULL) stale_pairs
  `));
  json("eligible_pair_verification_result", result.value.rows[0] ?? {});
}

async function coverageRows(client: PoolClient) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try {
    const calculated = await client.query<{ calculated_at: string }>("SELECT now()::text calculated_at");
    const calculatedAt = calculated.rows[0]!.calculated_at;
    const mapping = await timed("coverage_mapping", () => client.query<Record<string, unknown>>(YOUTUBE_LIVE_COVERAGE_MAPPING_SQL));
    const oldArtists = await timed("coverage_old_artists", () => client.query<Record<string, unknown>>(youtubeLiveCoverageArtistSql("latest")));
    const oldVideos = await timed("coverage_old_videos", () => client.query<Record<string, unknown>>(youtubeLiveCoverageVideoSql("latest")));
    const newTotals = await timed("coverage_new_eligible_pairs", () => client.query<Record<string, unknown>>(
      YOUTUBE_LIVE_COVERAGE_ELIGIBLE_PAIR_TOTALS_SQL,
      [calculatedAt],
    ));
    const oldRow = { ...(mapping.value.rows[0] ?? {}), ...(oldArtists.value.rows[0] ?? {}), ...(oldVideos.value.rows[0] ?? {}) };
    const newRow = { ...(mapping.value.rows[0] ?? {}), ...(newTotals.value.rows[0] ?? {}) };
    const differences = YOUTUBE_LIVE_COVERAGE_FIELDS
      .filter(field => String(oldRow[field] ?? "") !== String(newRow[field] ?? ""))
      .map(field => ({ field, old: oldRow[field] ?? null, next: newRow[field] ?? null }));
    const source = await client.query<{ watermark: Record<string, unknown> }>(`
      SELECT jsonb_build_object(
        'eligiblePairCount', (SELECT count(*) FROM youtube_live_coverage_eligible_pairs),
        'eligiblePairMaxUpdatedAt', (SELECT max(source_updated_at) FROM youtube_live_coverage_eligible_pairs),
        'latestObservationCount', (SELECT count(*) FROM youtube_video_intraday_latest_observations),
        'latestObservationMaxAt', (SELECT max(latest_observed_at) FROM youtube_video_intraday_latest_observations),
        'activeRosterCount', (SELECT count(*) FROM kworb_coverage WHERE status='active')
      ) watermark
    `);
    return {
      calculatedAt,
      oldRow,
      newRow,
      equal: youtubeLiveCoverageRowsEqual(oldRow, newRow),
      differences,
      sourceWatermark: source.rows[0]?.watermark ?? {},
      timings: {
        mappingMs: mapping.durationMs,
        oldArtistsMs: oldArtists.durationMs,
        oldVideosMs: oldVideos.durationMs,
        newEligiblePairsMs: newTotals.durationMs,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function compare(client: PoolClient) {
  const comparison = await coverageRows(client);
  await client.query("COMMIT");
  json("coverage_exact_comparison", comparison);
  if (!comparison.equal) process.exitCode = 2;
}

async function activate(client: PoolClient) {
  const startedAt = performance.now();
  await client.query("SELECT pg_advisory_lock($1)", [YOUTUBE_LIVE_COVERAGE_SUMMARY_LOCK_KEY]);
  try {
    const comparison = await coverageRows(client);
    if (!comparison.equal) {
      await client.query("ROLLBACK");
      json("coverage_activation_refused", { differences: comparison.differences });
      process.exitCode = 2;
      return;
    }
    const row = comparison.newRow;
    await client.query(`
    INSERT INTO youtube_live_coverage_summary (
      summary_key, authoritative, roster_artists, mapped_artists, approved_link_artists,
      profile_channel_artists, kworb_video_artists, catalog_artists, observed_artists,
      fresh_artists, catalog_videos, observed_videos, fresh_videos, latest_observed_at,
      calculated_at, source_watermark, refresh_duration_ms, last_refresh_attempt_at,
      last_refresh_error, updated_at
    ) VALUES ('current',true,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,now(),NULL,now())
    ON CONFLICT (summary_key) DO UPDATE SET
      authoritative=true, roster_artists=excluded.roster_artists,
      mapped_artists=excluded.mapped_artists, approved_link_artists=excluded.approved_link_artists,
      profile_channel_artists=excluded.profile_channel_artists, kworb_video_artists=excluded.kworb_video_artists,
      catalog_artists=excluded.catalog_artists, observed_artists=excluded.observed_artists,
      fresh_artists=excluded.fresh_artists, catalog_videos=excluded.catalog_videos,
      observed_videos=excluded.observed_videos, fresh_videos=excluded.fresh_videos,
      latest_observed_at=excluded.latest_observed_at, calculated_at=excluded.calculated_at,
      source_watermark=excluded.source_watermark, refresh_duration_ms=excluded.refresh_duration_ms,
      last_refresh_attempt_at=excluded.last_refresh_attempt_at, last_refresh_error=NULL, updated_at=now()
    `, [
      row.roster_artists, row.mapped_artists, row.approved_link_artists, row.profile_channel_artists,
      row.kworb_video_artists, row.catalog_artists, row.observed_artists, row.fresh_artists,
      row.catalog_videos, row.observed_videos, row.fresh_videos, row.latest_observed_at,
      comparison.calculatedAt, JSON.stringify(comparison.sourceWatermark), Math.round(performance.now() - startedAt),
    ]);
    await client.query("COMMIT");
    json("coverage_summary_activated", { calculatedAt: comparison.calculatedAt, sourceWatermark: comparison.sourceWatermark });
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [YOUTUBE_LIVE_COVERAGE_SUMMARY_LOCK_KEY]).catch(() => undefined);
  }
}

async function status(client: PoolClient) {
  const result = await client.query(`
    SELECT summary.*, (SELECT count(*)::int FROM youtube_live_coverage_eligible_pairs) eligible_pair_count
    FROM youtube_live_coverage_summary summary WHERE summary_key='current'
  `);
  json("coverage_summary_status", { row: result.rows[0] ?? null });
}

await ensureYoutubeLiveCoverageSummarySchema();
const client = await youtubeCoveragePool.connect();
let migrationLocked = false;
try {
  await client.query("SET statement_timeout='180s'");
  await client.query("SET lock_timeout='2s'");
  const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) locked", [MIGRATION_LOCK_KEY]);
  migrationLocked = Boolean(lock.rows[0]?.locked);
  if (!migrationLocked) throw new Error("Another eligible-pair migration is already running.");
  if (args.mode === "profile") await profile(client);
  else if (args.mode === "backfill") await backfill(client);
  else if (args.mode === "reconcile") await reconcile(client);
  else if (args.mode === "verify") await verify(client);
  else if (args.mode === "compare") await compare(client);
  else if (args.mode === "activate") await activate(client);
  else if (args.mode === "deactivate") {
    await client.query("UPDATE youtube_live_coverage_summary SET authoritative=false,updated_at=now() WHERE summary_key='current'");
    json("coverage_summary_deactivated", { rollbackPath: "latest" });
  } else await status(client);
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(JSON.stringify({
    event: "coverage_migration_failed",
    mode: args.mode,
    message: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
} finally {
  if (migrationLocked) await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => undefined);
  client.release();
  await youtubeCoveragePool.end();
}
