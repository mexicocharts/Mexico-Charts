import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { resolveDatabaseUrl } from "@workspace/db/database-url";
import {
  YOUTUBE_LIVE_COVERAGE_FIELDS,
  YOUTUBE_LIVE_COVERAGE_LATEST_SQL,
  YOUTUBE_LIVE_COVERAGE_LEGACY_SQL,
  youtubeLiveCoverageRowsEqual,
} from "@workspace/db/youtube-live-coverage-query";

const require = createRequire(import.meta.url);
const { Client } = require("../../lib/db/node_modules/pg") as {
  Client: new (config: { connectionString: string; application_name: string }) => {
    connect: () => Promise<void>;
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount?: number }>;
    end: () => Promise<void>;
  };
};

type Mode = "profile" | "backfill" | "verify" | "compare";

function parseArgs() {
  const values = new Map<string, string>();
  for (const argument of process.argv.slice(2)) {
    const [key, value = "true"] = argument.replace(/^--/, "").split("=", 2);
    values.set(key, value);
  }
  const mode = (values.get("mode") ?? "profile") as Mode;
  if (!["profile", "backfill", "verify", "compare"].includes(mode)) {
    throw new Error(`Unsupported --mode=${mode}.`);
  }
  return {
    mode,
    write: values.get("write") === "true",
    batchSize: Math.max(25, Math.min(1_000, Number(values.get("batch-size") ?? 250) || 250)),
    maxBatches: Math.max(1, Math.min(500, Number(values.get("max-batches") ?? 25) || 25)),
    startAfter: values.get("start-after") ?? "",
  };
}

const args = parseArgs();
const databaseUrl = resolveDatabaseUrl();
if (args.mode === "backfill" && !args.write) {
  throw new Error("Backfill is disabled unless --write=true is explicitly supplied.");
}

const client = new Client({
  connectionString: databaseUrl,
  application_name: "youtube-latest-observation-migration",
});

async function timed<T>(name: string, operation: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const startedAt = performance.now();
  const value = await operation();
  const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
  console.log(JSON.stringify({ event: name, durationMs }));
  return { value, durationMs };
}

async function sourceProfile() {
  const result = await timed("source_profile", () => client.query<{
    snapshot_rows: string;
    distinct_videos: string;
    oldest_observation: string | null;
    newest_observation: string | null;
    relation_bytes: string;
  }>(`
    SELECT
      count(*)::text snapshot_rows,
      count(DISTINCT video_id)::text distinct_videos,
      min(observed_at)::text oldest_observation,
      max(observed_at)::text newest_observation,
      pg_total_relation_size('youtube_video_intraday_shadow_snapshots')::text relation_bytes
    FROM youtube_video_intraday_shadow_snapshots
  `));
  const row = result.value.rows[0]!;
  const distinctVideos = Number(row.distinct_videos);
  const expectedBatches = Math.ceil(distinctVideos / args.batchSize);
  console.log(JSON.stringify({
    event: "profile_result",
    snapshotRows: Number(row.snapshot_rows),
    distinctVideos,
    expectedBatches,
    batchSize: args.batchSize,
    oldestObservation: row.oldest_observation,
    newestObservation: row.newest_observation,
    relationBytes: Number(row.relation_bytes),
  }));
  return { distinctVideos, expectedBatches };
}

async function sampleBatch() {
  const result = await timed("sample_batch", () => client.query<{ video_id: string; latest_observed_at: string }>(`
    WITH batch_ids AS MATERIALIZED (
      SELECT video_id
      FROM youtube_video_intraday_shadow_snapshots
      WHERE video_id > $1
      GROUP BY video_id
      ORDER BY video_id
      LIMIT $2
    )
    SELECT sample.video_id, max(sample.observed_at)::text latest_observed_at
    FROM youtube_video_intraday_shadow_snapshots sample
    JOIN batch_ids batch USING (video_id)
    GROUP BY sample.video_id
    ORDER BY sample.video_id
  `, [args.startAfter, args.batchSize]));
  return { rows: result.value.rows.length, durationMs: result.durationMs };
}

async function createLatestTable() {
  await client.query(`SET lock_timeout='2s'`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_video_intraday_latest_observations (
      video_id text PRIMARY KEY REFERENCES youtube_tracked_videos(video_id) ON DELETE cascade,
      latest_observed_at timestamptz NOT NULL
    )
  `);
}

async function backfill() {
  const profile = await sourceProfile();
  const sample = await sampleBatch();
  console.log(JSON.stringify({
    event: "backfill_estimate",
    expectedBatches: profile.expectedBatches,
    sampleBatchMs: sample.durationMs,
    estimatedRuntimeSeconds: Math.round(profile.expectedBatches * sample.durationMs / 100) / 10,
    maximumBatchesThisRun: args.maxBatches,
    maximumRowsThisRun: args.maxBatches * args.batchSize,
  }));
  await createLatestTable();
  let cursor = args.startAfter;
  let totalRows = 0;
  for (let batchNumber = 1; batchNumber <= args.maxBatches; batchNumber += 1) {
    const batch = await timed("backfill_batch", () => client.query<{ video_id: string }>(`
      WITH batch_ids AS MATERIALIZED (
        SELECT video_id
        FROM youtube_video_intraday_shadow_snapshots
        WHERE video_id > $1
        GROUP BY video_id
        ORDER BY video_id
        LIMIT $2
      ), maxima AS MATERIALIZED (
        SELECT sample.video_id, max(sample.observed_at) latest_observed_at
        FROM youtube_video_intraday_shadow_snapshots sample
        JOIN batch_ids batch USING (video_id)
        GROUP BY sample.video_id
      )
      INSERT INTO youtube_video_intraday_latest_observations (video_id, latest_observed_at)
      SELECT video_id, latest_observed_at
      FROM maxima
      ON CONFLICT (video_id) DO UPDATE SET
        latest_observed_at = GREATEST(
          youtube_video_intraday_latest_observations.latest_observed_at,
          excluded.latest_observed_at
        )
      RETURNING video_id
    `, [cursor, args.batchSize]));
    const ids = batch.value.rows.map(row => row.video_id).sort();
    if (!ids.length) {
      console.log(JSON.stringify({ event: "backfill_complete", totalRows, cursor }));
      return;
    }
    cursor = ids.at(-1)!;
    totalRows += ids.length;
    console.log(JSON.stringify({
      event: "backfill_progress",
      batchNumber,
      rows: ids.length,
      totalRows,
      nextStartAfter: cursor,
    }));
    if (ids.length < args.batchSize) {
      console.log(JSON.stringify({ event: "backfill_complete", totalRows, cursor }));
      return;
    }
  }
  console.log(JSON.stringify({
    event: "backfill_paused",
    reason: "bounded_batch_limit",
    totalRows,
    resumeWith: `--mode=backfill --write=true --start-after=${cursor}`,
  }));
}

async function verify() {
  const result = await timed("integrity_verification", () => client.query<{
    historical_rows: string;
    historical_distinct_videos: string;
    latest_rows: string;
    missing_latest_rows: string;
    mismatched_timestamps: string;
  }>(`
    WITH historical AS MATERIALIZED (
      SELECT video_id, max(observed_at) latest_observed_at
      FROM youtube_video_intraday_shadow_snapshots
      GROUP BY video_id
    )
    SELECT
      (SELECT count(*)::text FROM youtube_video_intraday_shadow_snapshots) historical_rows,
      (SELECT count(*)::text FROM historical) historical_distinct_videos,
      (SELECT count(*)::text FROM youtube_video_intraday_latest_observations) latest_rows,
      count(*) FILTER (WHERE latest.video_id IS NULL)::text missing_latest_rows,
      count(*) FILTER (
        WHERE latest.video_id IS NOT NULL
          AND latest.latest_observed_at IS DISTINCT FROM historical.latest_observed_at
      )::text mismatched_timestamps
    FROM historical
    LEFT JOIN youtube_video_intraday_latest_observations latest USING (video_id)
  `));
  console.log(JSON.stringify({ event: "integrity_result", ...result.value.rows[0] }));
}

async function compareCoverage() {
  // A repeatable-read transaction gives both queries the same catalog,
  // observation snapshot, and transaction-stable now() freshness boundary.
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const legacy = await timed("legacy_coverage", () => client.query<Record<string, unknown>>(YOUTUBE_LIVE_COVERAGE_LEGACY_SQL));
    const latest = await timed("latest_coverage", () => client.query<Record<string, unknown>>(YOUTUBE_LIVE_COVERAGE_LATEST_SQL));
    const legacyRow = legacy.value.rows[0] ?? {};
    const latestRow = latest.value.rows[0] ?? {};
    const differences = YOUTUBE_LIVE_COVERAGE_FIELDS
      .filter(field => String(legacyRow[field] ?? "") !== String(latestRow[field] ?? ""))
      .map(field => ({ field, legacy: legacyRow[field] ?? null, latest: latestRow[field] ?? null }));
    console.log(JSON.stringify({
      event: "coverage_comparison",
      equal: youtubeLiveCoverageRowsEqual(legacyRow, latestRow),
      differences,
      legacyDurationMs: legacy.durationMs,
      latestDurationMs: latest.durationMs,
    }));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

await client.connect();
try {
  await client.query(`SET statement_timeout='180s'`);
  if (args.mode === "profile") {
    const profile = await sourceProfile();
    const sample = await sampleBatch();
    console.log(JSON.stringify({
      event: "profile_estimate",
      expectedBatches: profile.expectedBatches,
      estimatedRuntimeSeconds: Math.round(profile.expectedBatches * sample.durationMs / 100) / 10,
      writePerformed: false,
    }));
  } else if (args.mode === "backfill") await backfill();
  else if (args.mode === "verify") await verify();
  else await compareCoverage();
} catch (error) {
  console.error(JSON.stringify({
    event: "migration_failed",
    mode: args.mode,
    startAfter: args.startAfter,
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "UnknownError",
  }));
  process.exitCode = 1;
} finally {
  await client.end();
}
