import { performance } from "node:perf_hooks";

import { youtubeCoveragePool, type PoolClient } from "@workspace/db";
import {
  YOUTUBE_LIVE_COVERAGE_ELIGIBLE_PAIR_TOTALS_SQL,
  YOUTUBE_LIVE_COVERAGE_MAPPING_SQL,
} from "@workspace/db/youtube-live-coverage-query";

import { logger } from "./logger";
import { safeErrorDetails } from "./safe-error";

export const YOUTUBE_LIVE_COVERAGE_SUMMARY_LOCK_KEY = 392_410_605;
let schemaPromise: Promise<void> | null = null;

export async function ensureYoutubeLiveCoverageSummarySchema(client?: PoolClient): Promise<void> {
  if (!client) {
    schemaPromise ??= (async () => {
      const owned = await youtubeCoveragePool.connect();
      try { await ensureYoutubeLiveCoverageSummarySchema(owned); }
      finally { owned.release(); }
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
    return schemaPromise;
  }

  await client.query(`
    CREATE OR REPLACE FUNCTION youtube_coverage_normalize_artist_key(input text)
    RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
      SELECT regexp_replace(
        translate(lower(COALESCE(input, '')), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]', '', 'g'
      )
    $$
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_live_coverage_eligible_pairs (
      normalized_artist_key text NOT NULL,
      video_id text NOT NULL REFERENCES youtube_tracked_videos(video_id) ON DELETE CASCADE,
      source_updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (normalized_artist_key, video_id)
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS youtube_live_coverage_eligible_pairs_video_idx
      ON youtube_live_coverage_eligible_pairs(video_id)
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_live_coverage_summary (
      summary_key text PRIMARY KEY CHECK (summary_key='current'),
      authoritative boolean NOT NULL DEFAULT false,
      roster_artists integer NOT NULL,
      mapped_artists integer NOT NULL,
      approved_link_artists integer NOT NULL,
      profile_channel_artists integer NOT NULL,
      kworb_video_artists integer NOT NULL,
      catalog_artists integer NOT NULL,
      observed_artists integer NOT NULL,
      fresh_artists integer NOT NULL,
      catalog_videos integer NOT NULL,
      observed_videos integer NOT NULL,
      fresh_videos integer NOT NULL,
      latest_observed_at timestamptz,
      calculated_at timestamptz NOT NULL,
      source_watermark jsonb NOT NULL,
      refresh_duration_ms integer NOT NULL,
      last_refresh_attempt_at timestamptz NOT NULL,
      last_refresh_error text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION youtube_coverage_pair_is_current(p_key text, p_video_id text)
    RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT EXISTS (
        SELECT 1
        FROM youtube_music_catalog_candidates candidate
        WHERE youtube_coverage_normalize_artist_key(candidate.artist_key)=p_key
          AND candidate.video_id=p_video_id
          AND candidate.status IN ('review','verified')
          AND candidate.sampling_status='shadow'
      ) AND EXISTS (
        SELECT 1 FROM kworb_coverage roster
        WHERE roster.status='active'
          AND youtube_coverage_normalize_artist_key(roster.artist_key)=p_key
      )
    $$
  `);
  await client.query(`
    CREATE OR REPLACE FUNCTION youtube_coverage_sync_candidate_pair()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE old_key text; new_key text;
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        old_key := youtube_coverage_normalize_artist_key(OLD.artist_key);
        IF NOT youtube_coverage_pair_is_current(old_key, OLD.video_id) THEN
          DELETE FROM youtube_live_coverage_eligible_pairs
          WHERE normalized_artist_key=old_key AND video_id=OLD.video_id;
        END IF;
      END IF;
      IF TG_OP <> 'DELETE' THEN
        new_key := youtube_coverage_normalize_artist_key(NEW.artist_key);
        IF youtube_coverage_pair_is_current(new_key, NEW.video_id) THEN
          INSERT INTO youtube_live_coverage_eligible_pairs (
            normalized_artist_key, video_id, source_updated_at
          ) VALUES (new_key, NEW.video_id, now())
          ON CONFLICT (normalized_artist_key, video_id) DO UPDATE SET
            source_updated_at=excluded.source_updated_at;
        END IF;
      END IF;
      IF TG_OP='DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END
    $$
  `);
  await client.query(`
    CREATE OR REPLACE FUNCTION youtube_coverage_sync_roster_key(p_key text)
    RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      DELETE FROM youtube_live_coverage_eligible_pairs pair
      WHERE pair.normalized_artist_key=p_key
        AND NOT youtube_coverage_pair_is_current(pair.normalized_artist_key, pair.video_id);

      IF EXISTS (
        SELECT 1 FROM kworb_coverage roster
        WHERE roster.status='active'
          AND youtube_coverage_normalize_artist_key(roster.artist_key)=p_key
      ) THEN
        INSERT INTO youtube_live_coverage_eligible_pairs (
          normalized_artist_key, video_id, source_updated_at
        )
        SELECT DISTINCT p_key, candidate.video_id, now()
        FROM youtube_music_catalog_candidates candidate
        WHERE youtube_coverage_normalize_artist_key(candidate.artist_key)=p_key
          AND candidate.status IN ('review','verified')
          AND candidate.sampling_status='shadow'
        ON CONFLICT (normalized_artist_key, video_id) DO UPDATE SET
          source_updated_at=excluded.source_updated_at;
      END IF;
    END
    $$
  `);
  await client.query(`
    CREATE OR REPLACE FUNCTION youtube_coverage_sync_roster_change()
    RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE old_key text; new_key text;
    BEGIN
      IF TG_OP <> 'INSERT' THEN
        old_key := youtube_coverage_normalize_artist_key(OLD.artist_key);
        PERFORM youtube_coverage_sync_roster_key(old_key);
      END IF;
      IF TG_OP <> 'DELETE' THEN
        new_key := youtube_coverage_normalize_artist_key(NEW.artist_key);
        IF old_key IS DISTINCT FROM new_key OR TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
          PERFORM youtube_coverage_sync_roster_key(new_key);
        END IF;
      END IF;
      IF TG_OP='DELETE' THEN RETURN OLD; END IF;
      RETURN NEW;
    END
    $$
  `);
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='youtube_coverage_candidate_pair_trigger') THEN
        CREATE TRIGGER youtube_coverage_candidate_pair_trigger
        AFTER INSERT OR DELETE OR UPDATE OF artist_key, video_id, status, sampling_status
        ON youtube_music_catalog_candidates
        FOR EACH ROW EXECUTE FUNCTION youtube_coverage_sync_candidate_pair();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='youtube_coverage_roster_trigger') THEN
        CREATE TRIGGER youtube_coverage_roster_trigger
        AFTER INSERT OR DELETE OR UPDATE OF artist_key, status
        ON kworb_coverage
        FOR EACH ROW EXECUTE FUNCTION youtube_coverage_sync_roster_change();
      END IF;
    END $$
  `);
}

type RefreshStatus = "refreshed" | "locked" | "failed";
export interface YoutubeCoverageRefreshResult {
  status: RefreshStatus;
  durationMs: number;
  eligiblePairs?: number;
  calculatedAt?: string;
  sourceWatermark?: Record<string, unknown>;
  error?: string;
}

export async function refreshYoutubeLiveCoverageSummary(
  reason: string,
): Promise<YoutubeCoverageRefreshResult> {
  const startedAt = performance.now();
  let stage = "schema";
  let client: PoolClient | null = null;
  let locked = false;
  try {
    await ensureYoutubeLiveCoverageSummarySchema();
    stage = "pool_acquire";
    client = await youtubeCoveragePool.connect();
    stage = "advisory_lock";
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) locked",
      [YOUTUBE_LIVE_COVERAGE_SUMMARY_LOCK_KEY],
    );
    locked = Boolean(lock.rows[0]?.locked);
    if (!locked) return { status: "locked", durationMs: performance.now() - startedAt };

    stage = "record_attempt";
    await client.query(`
      UPDATE youtube_live_coverage_summary
      SET last_refresh_attempt_at=now(), updated_at=now()
      WHERE summary_key='current'
    `);
    stage = "aggregate";
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const calculated = await client.query<{ calculated_at: string }>("SELECT now()::text calculated_at");
    const calculatedAt = calculated.rows[0]!.calculated_at;
    const mapping = await client.query<Record<string, unknown>>(YOUTUBE_LIVE_COVERAGE_MAPPING_SQL);
    const totals = await client.query<Record<string, unknown>>(
      YOUTUBE_LIVE_COVERAGE_ELIGIBLE_PAIR_TOTALS_SQL,
      [calculatedAt],
    );
    const watermarkResult = await client.query<{ watermark: Record<string, unknown> }>(`
      SELECT jsonb_build_object(
        'eligiblePairCount', (SELECT count(*) FROM youtube_live_coverage_eligible_pairs),
        'eligiblePairMaxUpdatedAt', (SELECT max(source_updated_at) FROM youtube_live_coverage_eligible_pairs),
        'latestObservationCount', (SELECT count(*) FROM youtube_video_intraday_latest_observations),
        'latestObservationMaxAt', (SELECT max(latest_observed_at) FROM youtube_video_intraday_latest_observations),
        'activeRosterCount', (SELECT count(*) FROM kworb_coverage WHERE status='active'),
        'activeRosterFingerprint', (
          SELECT md5(string_agg(youtube_coverage_normalize_artist_key(artist_key), ',' ORDER BY youtube_coverage_normalize_artist_key(artist_key)))
          FROM kworb_coverage WHERE status='active'
        )
      ) watermark
    `);
    await client.query("COMMIT");

    const row = { ...(mapping.rows[0] ?? {}), ...(totals.rows[0] ?? {}) };
    const sourceWatermark = watermarkResult.rows[0]?.watermark ?? {};
    const durationMs = Math.round(performance.now() - startedAt);
    stage = "persist";
    await client.query("BEGIN");
    try {
      await client.query(`
        INSERT INTO youtube_live_coverage_summary (
          summary_key, roster_artists, mapped_artists, approved_link_artists,
          profile_channel_artists, kworb_video_artists, catalog_artists,
          observed_artists, fresh_artists, catalog_videos, observed_videos,
          fresh_videos, latest_observed_at, calculated_at, source_watermark,
          refresh_duration_ms, last_refresh_attempt_at, last_refresh_error, updated_at
        ) VALUES (
          'current',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,now(),NULL,now()
        )
        ON CONFLICT (summary_key) DO UPDATE SET
          roster_artists=excluded.roster_artists,
          mapped_artists=excluded.mapped_artists,
          approved_link_artists=excluded.approved_link_artists,
          profile_channel_artists=excluded.profile_channel_artists,
          kworb_video_artists=excluded.kworb_video_artists,
          catalog_artists=excluded.catalog_artists,
          observed_artists=excluded.observed_artists,
          fresh_artists=excluded.fresh_artists,
          catalog_videos=excluded.catalog_videos,
          observed_videos=excluded.observed_videos,
          fresh_videos=excluded.fresh_videos,
          latest_observed_at=excluded.latest_observed_at,
          calculated_at=excluded.calculated_at,
          source_watermark=excluded.source_watermark,
          refresh_duration_ms=excluded.refresh_duration_ms,
          last_refresh_attempt_at=excluded.last_refresh_attempt_at,
          last_refresh_error=NULL,
          updated_at=now()
      `, [
        row.roster_artists ?? 0, row.mapped_artists ?? 0, row.approved_link_artists ?? 0,
        row.profile_channel_artists ?? 0, row.kworb_video_artists ?? 0,
        row.catalog_artists ?? 0, row.observed_artists ?? 0, row.fresh_artists ?? 0,
        row.catalog_videos ?? 0, row.observed_videos ?? 0, row.fresh_videos ?? 0,
        row.latest_observed_at ?? null, calculatedAt, JSON.stringify(sourceWatermark), durationMs,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
    const result = {
      status: "refreshed" as const,
      durationMs,
      eligiblePairs: Number(sourceWatermark["eligiblePairCount"] ?? 0),
      calculatedAt,
      sourceWatermark,
    };
    logger.info({ reason, ...result }, "[youtube:live-coverage-summary] refreshed");
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : String(error);
    await client?.query("ROLLBACK").catch(() => undefined);
    const recordFailure = (failureClient: Pick<PoolClient, "query">) => failureClient.query(`
      UPDATE youtube_live_coverage_summary
      SET last_refresh_attempt_at=now(), last_refresh_error=left($1,500), updated_at=now()
      WHERE summary_key='current'
    `, [`${stage}: ${message}`]);
    if (client) {
      await recordFailure(client).catch(recordError => {
        logger.error(
          safeErrorDetails(recordError, { reason, stage, job: "live-coverage-summary-record-failure" }),
          "[youtube:live-coverage-summary] could not persist refresh failure",
        );
      });
    } else {
      await youtubeCoveragePool.connect().then(async diagnosticClient => {
        try { await recordFailure(diagnosticClient); }
        finally { diagnosticClient.release(); }
      }).catch(recordError => {
        logger.error(
          safeErrorDetails(recordError, { reason, stage, job: "live-coverage-summary-record-failure" }),
          "[youtube:live-coverage-summary] could not persist pre-connection refresh failure",
        );
      });
    }
    logger.error(
      safeErrorDetails(error, {
        reason,
        stage,
        job: "live-coverage-summary",
        durationMs,
        pool: {
          total: youtubeCoveragePool.totalCount,
          idle: youtubeCoveragePool.idleCount,
          waiting: youtubeCoveragePool.waitingCount,
        },
      }),
      "[youtube:live-coverage-summary] refresh failed",
    );
    return { status: "failed", durationMs, error: message };
  } finally {
    if (locked && client) {
      await client.query("SELECT pg_advisory_unlock($1)", [YOUTUBE_LIVE_COVERAGE_SUMMARY_LOCK_KEY]).catch(() => undefined);
    }
    client?.release();
  }
}
