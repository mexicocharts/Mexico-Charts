import { timingSafeEqual } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Router, type Request } from "express";

import { youtubeCoveragePool, type PoolClient } from "@workspace/db";
import {
  YOUTUBE_LIVE_COVERAGE_ELIGIBLE_PAIR_TOTALS_SQL,
  YOUTUBE_LIVE_COVERAGE_FIELDS,
  YOUTUBE_LIVE_COVERAGE_MAPPING_SQL,
  youtubeLiveCoverageArtistSql,
  youtubeLiveCoverageRowsEqual,
  youtubeLiveCoverageVideoSql,
} from "@workspace/db/youtube-live-coverage-query";

import { getDashboardAdminKey } from "../lib/admin-key";
import {
  ensureYoutubeLiveCoverageSummarySchema,
  YOUTUBE_LIVE_COVERAGE_SUMMARY_LOCK_KEY,
} from "../lib/youtube-live-coverage-summary";
import { safeErrorDetails } from "../lib/safe-error";

const MIGRATION_LOCK_KEY = 392_410_606;
const CONFIRMATION = "youtube-live-coverage-production-migration";
// Replit Autoscale does not provide a documented Git SHA at runtime. Keep the
// guarded rollout pinned to the reviewed migration implementation instead of
// relying on an environment variable that is absent in Production.
const MIGRATION_REVISION = "336a390cd454d902172d0891cbd5b9fdedf3cfe1";
const eligibleSourceSql = `
  WITH roster_keys AS MATERIALIZED (
    SELECT DISTINCT youtube_coverage_normalize_artist_key(artist_key) normalized_artist_key
    FROM kworb_coverage WHERE status='active'
  )
  SELECT DISTINCT youtube_coverage_normalize_artist_key(candidate.artist_key) normalized_artist_key,
    candidate.video_id
  FROM roster_keys roster
  JOIN youtube_music_catalog_candidates candidate
    ON youtube_coverage_normalize_artist_key(candidate.artist_key)=roster.normalized_artist_key
  WHERE candidate.status IN ('review','verified') AND candidate.sampling_status='shadow'
`;

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(req: Request): boolean {
  const expected = getDashboardAdminKey();
  const supplied = req.header("x-admin-key")?.trim() ?? "";
  return expected.length >= 32 && secureEqual(expected, supplied);
}

async function comparison(client: PoolClient) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  try {
    const calculatedAt = (await client.query<{ value: string }>("SELECT now()::text value")).rows[0]!.value;
    const [mapping, oldArtists, oldVideos, nextTotals, watermark] = await Promise.all([
      client.query<Record<string, unknown>>(YOUTUBE_LIVE_COVERAGE_MAPPING_SQL),
      client.query<Record<string, unknown>>(youtubeLiveCoverageArtistSql("latest")),
      client.query<Record<string, unknown>>(youtubeLiveCoverageVideoSql("latest")),
      client.query<Record<string, unknown>>(YOUTUBE_LIVE_COVERAGE_ELIGIBLE_PAIR_TOTALS_SQL, [calculatedAt]),
      client.query<{ value: Record<string, unknown> }>(`
        SELECT jsonb_build_object(
          'eligiblePairCount',(SELECT count(*) FROM youtube_live_coverage_eligible_pairs),
          'eligiblePairMaxUpdatedAt',(SELECT max(source_updated_at) FROM youtube_live_coverage_eligible_pairs),
          'latestObservationCount',(SELECT count(*) FROM youtube_video_intraday_latest_observations),
          'latestObservationMaxAt',(SELECT max(latest_observed_at) FROM youtube_video_intraday_latest_observations),
          'activeRosterCount',(SELECT count(*) FROM kworb_coverage WHERE status='active')
        ) value
      `),
    ]);
    const previous = { ...(mapping.rows[0] ?? {}), ...(oldArtists.rows[0] ?? {}), ...(oldVideos.rows[0] ?? {}) };
    const next = { ...(mapping.rows[0] ?? {}), ...(nextTotals.rows[0] ?? {}) };
    const differences = YOUTUBE_LIVE_COVERAGE_FIELDS
      .filter(field => String(previous[field] ?? "") !== String(next[field] ?? ""))
      .map(field => ({ field, previous: previous[field] ?? null, next: next[field] ?? null }));
    return {
      calculatedAt,
      previous,
      next,
      equal: youtubeLiveCoverageRowsEqual(previous, next),
      differences,
      sourceWatermark: watermark.rows[0]?.value ?? {},
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export function createYoutubeLiveCoverageMigrationRouter() {
  const router = Router();
  router.post("/admin/youtube/live-coverage-migration", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (process.env["NODE_ENV"] !== "production") return res.status(404).json({ error: "Not found" });
    if (!authorized(req)) return res.status(403).json({ error: "Forbidden" });

    const body = req.body as Record<string, unknown>;
    const revision = String(body["revision"] ?? "").trim();
    if (!revision || !secureEqual(revision, MIGRATION_REVISION)) {
      return res.status(409).json({ error: "Production revision mismatch" });
    }
    if (body["confirm"] !== CONFIRMATION) return res.status(400).json({ error: "Invalid confirmation" });

    const action = String(body["action"] ?? "status");
    const batchSize = Math.max(100, Math.min(2_000, Number(body["batchSize"] ?? 2_000) || 2_000));
    const afterArtist = String(body["afterArtist"] ?? "");
    const afterVideo = String(body["afterVideo"] ?? "");
    const startedAt = performance.now();
    const client = await youtubeCoveragePool.connect();
    let migrationLocked = false;
    try {
      await client.query("SET statement_timeout='25s'");
      await client.query("SET lock_timeout='2s'");
      const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) locked", [MIGRATION_LOCK_KEY]);
      migrationLocked = Boolean(lock.rows[0]?.locked);
      if (!migrationLocked) return res.status(409).json({ error: "Migration already running" });

      if (action === "schema") {
        await ensureYoutubeLiveCoverageSummarySchema(client);
        return res.json({ action, ok: true, durationMs: Math.round(performance.now() - startedAt) });
      }
      if (action === "profile") {
        const row = (await client.query(`SELECT count(*)::int logical_pairs,
          count(DISTINCT normalized_artist_key)::int logical_artists,
          count(DISTINCT video_id)::int logical_videos FROM (${eligibleSourceSql}) source`)).rows[0];
        return res.json({ action, ...row, durationMs: Math.round(performance.now() - startedAt) });
      }
      if (action === "backfill") {
        const rows = (await client.query<{ normalized_artist_key: string; video_id: string; inserted: boolean }>(`
          WITH expected AS MATERIALIZED (${eligibleSourceSql}), batch AS MATERIALIZED (
            SELECT normalized_artist_key,video_id FROM expected
            WHERE (normalized_artist_key,video_id)>($1::text,$2::text)
            ORDER BY normalized_artist_key,video_id LIMIT $3
          ), inserted AS (
            INSERT INTO youtube_live_coverage_eligible_pairs(normalized_artist_key,video_id,source_updated_at)
            SELECT normalized_artist_key,video_id,now() FROM batch
            ON CONFLICT(normalized_artist_key,video_id) DO NOTHING
            RETURNING normalized_artist_key,video_id
          )
          SELECT batch.normalized_artist_key,batch.video_id,inserted.video_id IS NOT NULL inserted
          FROM batch LEFT JOIN inserted USING(normalized_artist_key,video_id)
          ORDER BY batch.normalized_artist_key,batch.video_id
        `, [afterArtist, afterVideo, batchSize])).rows;
        const last = rows.at(-1);
        return res.json({
          action, scanned: rows.length, inserted: rows.filter(row => row.inserted).length,
          complete: rows.length < batchSize,
          next: last ? { afterArtist: last.normalized_artist_key, afterVideo: last.video_id } : null,
          durationMs: Math.round(performance.now() - startedAt),
        });
      }
      if (action === "verify") {
        const row = (await client.query(`WITH expected AS MATERIALIZED (${eligibleSourceSql}),
          stored AS MATERIALIZED (SELECT normalized_artist_key,video_id FROM youtube_live_coverage_eligible_pairs)
          SELECT (SELECT count(*)::int FROM expected) expected_pairs,
            (SELECT count(*)::int FROM stored) stored_pairs,
            (SELECT count(*)::int FROM expected LEFT JOIN stored USING(normalized_artist_key,video_id) WHERE stored.video_id IS NULL) missing_pairs,
            (SELECT count(*)::int FROM stored LEFT JOIN expected USING(normalized_artist_key,video_id) WHERE expected.video_id IS NULL) stale_pairs`)).rows[0];
        return res.json({ action, ...row, durationMs: Math.round(performance.now() - startedAt) });
      }
      if (action === "compare" || action === "activate") {
        if (action === "activate") await client.query("SELECT pg_advisory_lock($1)", [YOUTUBE_LIVE_COVERAGE_SUMMARY_LOCK_KEY]);
        try {
          const result = await comparison(client);
          if (action === "activate" && result.equal) {
            const row = result.next;
            await client.query(`INSERT INTO youtube_live_coverage_summary(
              summary_key,authoritative,roster_artists,mapped_artists,approved_link_artists,profile_channel_artists,
              kworb_video_artists,catalog_artists,observed_artists,fresh_artists,catalog_videos,observed_videos,
              fresh_videos,latest_observed_at,calculated_at,source_watermark,refresh_duration_ms,last_refresh_attempt_at,last_refresh_error,updated_at
            ) VALUES('current',true,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,now(),NULL,now())
            ON CONFLICT(summary_key) DO UPDATE SET authoritative=true,roster_artists=excluded.roster_artists,
              mapped_artists=excluded.mapped_artists,approved_link_artists=excluded.approved_link_artists,
              profile_channel_artists=excluded.profile_channel_artists,kworb_video_artists=excluded.kworb_video_artists,
              catalog_artists=excluded.catalog_artists,observed_artists=excluded.observed_artists,fresh_artists=excluded.fresh_artists,
              catalog_videos=excluded.catalog_videos,observed_videos=excluded.observed_videos,fresh_videos=excluded.fresh_videos,
              latest_observed_at=excluded.latest_observed_at,calculated_at=excluded.calculated_at,
              source_watermark=excluded.source_watermark,refresh_duration_ms=excluded.refresh_duration_ms,
              last_refresh_attempt_at=excluded.last_refresh_attempt_at,last_refresh_error=NULL,updated_at=now()`, [
              row.roster_artists,row.mapped_artists,row.approved_link_artists,row.profile_channel_artists,row.kworb_video_artists,
              row.catalog_artists,row.observed_artists,row.fresh_artists,row.catalog_videos,row.observed_videos,row.fresh_videos,
              row.latest_observed_at,result.calculatedAt,JSON.stringify(result.sourceWatermark),Math.round(performance.now()-startedAt),
            ]);
          }
          await client.query("COMMIT");
          return res.status(action === "activate" && !result.equal ? 409 : 200).json({
            action, activated: action === "activate" && result.equal, ...result,
            durationMs: Math.round(performance.now() - startedAt),
          });
        } finally {
          if (action === "activate") await client.query("SELECT pg_advisory_unlock($1)", [YOUTUBE_LIVE_COVERAGE_SUMMARY_LOCK_KEY]).catch(() => undefined);
        }
      }
      if (action === "deactivate") {
        await client.query("UPDATE youtube_live_coverage_summary SET authoritative=false,updated_at=now() WHERE summary_key='current'");
        return res.json({ action, authoritative: false, rollbackPath: "latest" });
      }
      if (action === "status") {
        const row = (await client.query(`SELECT summary.*,
          (SELECT count(*)::int FROM youtube_live_coverage_eligible_pairs) eligible_pair_count
          FROM youtube_live_coverage_summary summary WHERE summary_key='current'`)).rows[0] ?? null;
        return res.json({ action, revision: MIGRATION_REVISION, row, durationMs: Math.round(performance.now() - startedAt) });
      }
      return res.status(400).json({ error: "Unsupported action" });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      req.log?.error(safeErrorDetails(error, { action, job: "youtube-live-coverage-migration" }), "migration request failed");
      return res.status(500).json({ error: "Migration request failed" });
    } finally {
      if (migrationLocked) await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => undefined);
      client.release();
    }
  });
  return router;
}

export default createYoutubeLiveCoverageMigrationRouter();
