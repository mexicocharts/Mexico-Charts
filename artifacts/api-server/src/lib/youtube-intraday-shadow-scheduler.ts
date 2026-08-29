import { pool } from "@workspace/db";
import { logger } from "./logger";
import { ensureYoutubeVideoTrackerTables } from "./youtube-video-tracker-scheduler";
import {
  discoverYoutubeMusicArtist,
  discoverYoutubeTrustedSharedChannel,
  ensureYoutubeShadowTables,
  resolveTrustedYoutubeIdentity,
} from "./youtube-music-shadow-discovery";
import {
  chooseYoutubeRefreshTier,
  observationBucket,
  youtubeApiBatchesAllowed,
  type YoutubeRefreshTier,
} from "./youtube-shadow-policy";
import {
  youtubeShadowArtistIdentityKey,
  youtubeShadowCanonicalChannelId,
  youtubeShadowDiscoveryFailure,
  youtubeShadowPilotIsReady,
} from "./youtube-shadow-bootstrap-policy";

type PgClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  release: () => void;
};

interface DueVideoRow {
  artist_key: string;
  video_id: string;
  refresh_tier: YoutubeRefreshTier;
  last_observed_at: string | null;
  published_at: string | null;
  view_count: string | number | null;
  daily_view_delta: string | number | null;
}

interface YoutubeVideoItem {
  id: string;
  snippet?: {
    channelId?: string;
    title?: string;
    publishedAt?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

interface VideoStats {
  videoId: string;
  channelId: string | null;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  duration: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
}

export interface YoutubeIntradayShadowSummary {
  status: "complete" | "disabled" | "locked" | "quota_exhausted" | "failed";
  reason: string;
  dueVideos: number;
  requestedVideos: number;
  apiCalls: number;
  fetched: number;
  saved: number;
  missing: number;
  artistsUpdated: number;
  bootstrapArtists: number;
  bootstrapSavedCandidates: number;
  bootstrapErrors: string[];
  error?: string;
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const LOCK_KEY = 392_410_604;
const CHECK_MS = 5 * 60 * 1000;
let schedulerStarted = false;
let discoveryRunning = false;
let lastEasternMidnightAnchorDate: string | null = null;

export function youtubeEasternMidnightAnchor(at: Date): { dateKey: string; shouldAnchor: boolean } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  const dateKey = `${value("year")}-${value("month")}-${value("day")}`;
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));
  return { dateKey, shouldAnchor: hour === 0 && minute < 15 };
}

function enabled() {
  // Intraday collection is a production feature. Ignore the legacy opt-in/
  // opt-out flag left over from the four-artist pilot; retain one deliberately
  // named emergency kill switch for incident response.
  return process.env["YOUTUBE_INTRADAY_SHADOW_AUTOMATION_DISABLED"] !== "true";
}

export const YOUTUBE_SHADOW_PILOT_ARTISTS = [
  { artistKey: "peso-pluma", artistName: "Peso Pluma", verifiedChannelId: null },
  { artistKey: "fuerza-regida", artistName: "Fuerza Regida", verifiedChannelId: null },
  { artistKey: "natanael-cano", artistName: "Natanael Cano", verifiedChannelId: null },
  {
    artistKey: "luis-miguel",
    artistName: "Luis Miguel",
    verifiedChannelId: "UCQHnOnsryRQmmr6pU3lAupg",
    trustedSharedChannels: [{
      channelId: "UCP1b9jYyEqiNhJi4GqYdovw",
      evidenceSource: "trusted_warner_music_mexico_exact_title_credit",
    }],
  },
] as const;

async function bootstrapPilotCatalog(client: PgClient, force: boolean) {
  const existing = await client.query<{
    artist_key: string;
    eligible_candidates: number;
    last_attempt_at: string | null;
    status: string | null;
    mapping_status: string | null;
  }>(`
    SELECT p.artist_key,
      count(c.id) FILTER (WHERE c.status IN ('review','verified') AND c.sampling_status='shadow')::int eligible_candidates,
      latest.finished_at::text last_attempt_at,
      latest.status,
      COALESCE(latest.summary->>'mappingStatus', '') mapping_status
    FROM (VALUES
      ('peso-pluma'), ('fuerza-regida'), ('natanael-cano'), ('luis-miguel')
    ) p(artist_key)
    LEFT JOIN youtube_music_catalog_candidates c ON c.artist_key=p.artist_key
    LEFT JOIN LATERAL (
      SELECT finished_at, status, summary
      FROM youtube_music_shadow_runs
      WHERE artist_key=p.artist_key AND run_type='discovery'
      ORDER BY finished_at DESC NULLS LAST, id DESC
      LIMIT 1
    ) latest ON true
    GROUP BY p.artist_key, latest.finished_at, latest.status, latest.summary
  `);
  const readiness = new Map(existing.rows.map(row => [row.artist_key, row]));
  const missingPilotArtists = YOUTUBE_SHADOW_PILOT_ARTISTS.filter(
    pilot => {
      const state = readiness.get(pilot.artistKey);
      if (youtubeShadowPilotIsReady(state?.eligible_candidates)) return false;
      if (force || !state?.last_attempt_at) return true;
      const retryable = state.status === "failed"
        || state.status === "retryable"
        || state.mapping_status === "ambiguous";
      const retryDelay = retryable ? 15 * 60 * 1000 : 60 * 60 * 1000;
      return Date.now() - new Date(state.last_attempt_at).getTime() >= retryDelay;
    },
  );
  let artists = 0;
  let savedCandidates = 0;
  const errors: string[] = [];
  for (const pilot of missingPilotArtists) {
    const resolvedIdentity = await resolveTrustedYoutubeIdentity(client, pilot.artistKey, pilot.artistName);
    const trustedBrowseId = resolvedIdentity.identity?.browseId ?? pilot.verifiedChannelId;
    const result = await discoverYoutubeMusicArtist({
      ...pilot,
      browseId: trustedBrowseId,
      trustedBrowseId: Boolean(trustedBrowseId),
      trustedIdentityCandidates: resolvedIdentity.ambiguous ? resolvedIdentity.candidates : undefined,
      write: true,
      dbClient: client,
    });
    const failure = youtubeShadowDiscoveryFailure(result);
    if (failure) {
      errors.push(`${pilot.artistName}: ${failure}`);
      continue;
    }
    if (result.savedCandidates > 0) artists += 1;
    savedCandidates += result.savedCandidates;
  }

  for (const pilot of YOUTUBE_SHADOW_PILOT_ARTISTS) {
    if (!("trustedSharedChannels" in pilot)) continue;
    const mappedChannel = await client.query<{ channel_id: string | null }>(
      `SELECT channel_id FROM youtube_channels
       WHERE regexp_replace(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g')=$2
         AND channel_id IS NOT NULL
       ORDER BY CASE WHEN artist_key=$1 THEN 0 ELSE 1 END LIMIT 1`,
      [pilot.artistKey, youtubeShadowArtistIdentityKey(pilot.artistKey)],
    );
    const artistBrowseId = youtubeShadowCanonicalChannelId(mappedChannel.rows[0]?.channel_id)
      ?? pilot.verifiedChannelId;
    if (!artistBrowseId) continue;
    for (const source of pilot.trustedSharedChannels) {
      const existingSource = await client.query<{ count: number }>(
        `SELECT count(*)::int count FROM youtube_music_catalog_candidates
         WHERE artist_key=$1 AND evidence_sources ? $2`,
        [pilot.artistKey, source.evidenceSource],
      );
      if (Number(existingSource.rows[0]?.count ?? 0) > 0) continue;
      const result = await discoverYoutubeTrustedSharedChannel({
        artistKey: pilot.artistKey,
        artistName: pilot.artistName,
        artistBrowseId,
        sourceChannelId: source.channelId,
        evidenceSource: source.evidenceSource,
        write: true,
        dbClient: client,
      });
      if (result.error) {
        errors.push(`${pilot.artistName} (${source.evidenceSource}): ${result.error}`);
        continue;
      }
      if (result.savedCandidates > 0) artists += 1;
      savedCandidates += result.savedCandidates;
    }
  }
  return { artists, savedCandidates, errors };
}

function discoveryArtistsPerRun() {
  const raw = Number(process.env["YOUTUBE_SHADOW_DISCOVERY_ARTISTS_PER_RUN"] ?? "5");
  return Number.isFinite(raw) ? Math.max(0, Math.min(20, Math.floor(raw))) : 5;
}

async function bootstrapActiveCatalog() {
  const limit = discoveryArtistsPerRun();
  if (limit === 0) return { artists: 0, savedCandidates: 0, errors: [] as string[] };
  const client = await pool.connect();
  let candidates: Array<{ artist_key: string; artist_name: string; browse_id: string | null; ambiguous: boolean; identity_candidates: Array<{ browseId: string; name: string }> }> = [];
  try {
    await ensureYoutubeVideoTrackerTables(client);
    await ensureYoutubeShadowTables(client);
    const pending = await client.query<{ artist_key: string; artist_name: string }>(`
    SELECT c.artist_key, c.artist_name
    FROM kworb_coverage c
    LEFT JOIN LATERAL (
      SELECT r.finished_at::text AS last_attempt_at, r.status,
             COALESCE(r.summary->>'mappingStatus', '') AS mapping_status
      FROM youtube_music_shadow_runs r
      WHERE r.artist_key=c.artist_key AND r.run_type='discovery'
      ORDER BY r.finished_at DESC NULLS LAST, r.id DESC
      LIMIT 1
    ) latest ON true
    WHERE c.status='active'
      AND NOT EXISTS (
        SELECT 1
        FROM youtube_music_catalog_candidates candidate
        WHERE candidate.artist_key=c.artist_key
          AND candidate.status IN ('review','verified')
          AND candidate.sampling_status='shadow'
      )
       AND (
         latest.last_attempt_at IS NULL
         OR latest.last_attempt_at <= now() - CASE
           WHEN latest.status IN ('failed','retryable') OR latest.mapping_status='ambiguous'
             THEN interval '15 minutes'
           ELSE interval '24 hours'
         END
       )
    ORDER BY CASE
               WHEN latest.status IN ('failed','retryable') OR latest.mapping_status='ambiguous' THEN 0
               ELSE 1
             END,
             latest.last_attempt_at ASC NULLS FIRST, c.artist_name
    LIMIT $1
  `, [limit]);
    candidates = await Promise.all(pending.rows.map(async artist => {
      const resolved = await resolveTrustedYoutubeIdentity(client, artist.artist_key, artist.artist_name);
      return {
        ...artist,
        browse_id: resolved.identity?.browseId ?? null,
        ambiguous: resolved.ambiguous,
        identity_candidates: resolved.candidates,
      };
    }));
  } finally {
    client.release();
  }

  let artists = 0;
  let savedCandidates = 0;
  const errors: string[] = [];
  for (const artist of candidates) {
    const result = await discoverYoutubeMusicArtist({
      artistKey: artist.artist_key,
      artistName: artist.artist_name,
      browseId: artist.browse_id,
      trustedBrowseId: Boolean(artist.browse_id),
      trustedIdentityCandidates: artist.ambiguous ? artist.identity_candidates : undefined,
      write: true,
    });
    const failure = youtubeShadowDiscoveryFailure(result);
    if (failure) {
      errors.push(`${artist.artist_name}: ${failure}`);
      continue;
    }
    artists += 1;
    savedCandidates += result.savedCandidates;
  }
  return { artists, savedCandidates, errors };
}

function dailyBudget() {
  const raw = Number(process.env["YOUTUBE_INTRADAY_SHADOW_DAILY_BUDGET"] ?? "10000");
  return Number.isFinite(raw) ? Math.max(0, Math.min(10_000, Math.floor(raw))) : 10_000;
}

function maxVideosPerRun() {
  // Keep each five-minute pass short enough that public API/database work is
  // never starved. The oldest-due ordering rotates through the complete
  // catalog over successive passes.
  const raw = Number(process.env["YOUTUBE_INTRADAY_SHADOW_MAX_VIDEOS"] ?? "50");
  // A production secret from the former pilot may still request thousands.
  // Enforce the database-safe ceiling in code.
  return Number.isFinite(raw) ? Math.max(1, Math.min(50, Math.floor(raw))) : 50;
}

function batch<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

function roundRobinArtists(rows: DueVideoRow[], limit: number): DueVideoRow[] {
  const queues = new Map<string, DueVideoRow[]>();
  for (const row of rows) {
    const queue = queues.get(row.artist_key) ?? [];
    queue.push(row);
    queues.set(row.artist_key, queue);
  }
  const selected: DueVideoRow[] = [];
  while (selected.length < limit) {
    let added = false;
    for (const queue of queues.values()) {
      const row = queue.shift();
      if (!row) continue;
      selected.push(row);
      added = true;
      if (selected.length >= limit) break;
    }
    if (!added) break;
  }
  return selected;
}

function numeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function ensureYoutubeIntradayShadowTables(client: PgClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_video_intraday_shadow_snapshots (
      id serial PRIMARY KEY,
      video_id text NOT NULL REFERENCES youtube_tracked_videos(video_id) ON DELETE cascade,
      refresh_tier text NOT NULL CHECK (refresh_tier IN ('hot','warm','baseline')),
      bucket_start timestamptz NOT NULL,
      observed_at timestamptz NOT NULL DEFAULT now(),
      view_count bigint,
      like_count bigint,
      comment_count bigint,
      view_delta bigint,
      seconds_since_previous integer,
      source_type text NOT NULL DEFAULT 'youtube_api_shadow',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_artist_intraday_shadow_current (
      artist_key text PRIMARY KEY,
      tracked_video_count integer NOT NULL DEFAULT 0,
      videos_with_observations integer NOT NULL DEFAULT 0,
      total_views bigint NOT NULL DEFAULT 0,
      latest_observed_at timestamptz,
      source_type text NOT NULL DEFAULT 'youtube_music_shadow',
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_shadow_api_usage (
      usage_date text PRIMARY KEY,
      api_calls integer NOT NULL DEFAULT 0,
      videos_requested integer NOT NULL DEFAULT 0,
      videos_returned integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS youtube_video_intraday_shadow_video_bucket_unique ON youtube_video_intraday_shadow_snapshots(video_id, bucket_start);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_video_intraday_shadow_observed_idx ON youtube_video_intraday_shadow_snapshots(observed_at DESC);`);
}

async function fetchYoutubeVideos(videoIds: string[]): Promise<VideoStats[]> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");
  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("maxResults", String(videoIds.length));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube API ${response.status}: ${(await response.text()).slice(0, 240)}`);
  const data = await response.json() as { items?: YoutubeVideoItem[] };
  return (data.items ?? []).map(item => {
    const thumbs = item.snippet?.thumbnails ?? {};
    return {
      videoId: item.id,
      channelId: item.snippet?.channelId ?? null,
      title: item.snippet?.title ?? "",
      thumbnailUrl: thumbs.maxres?.url ?? thumbs.standard?.url ?? thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null,
      publishedAt: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null,
      duration: item.contentDetails?.duration ?? null,
      viewCount: numeric(item.statistics?.viewCount),
      likeCount: numeric(item.statistics?.likeCount),
      commentCount: numeric(item.statistics?.commentCount),
    };
  });
}

async function callsUsedToday(client: PgClient): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const result = await client.query<{ api_calls: number }>(
    `SELECT api_calls FROM youtube_shadow_api_usage WHERE usage_date=$1`,
    [date],
  );
  return result.rows[0]?.api_calls ?? 0;
}

async function recordUsage(client: PgClient, requested: number, returned: number) {
  const date = new Date().toISOString().slice(0, 10);
  await client.query(
    `
      INSERT INTO youtube_shadow_api_usage (usage_date, api_calls, videos_requested, videos_returned)
      VALUES ($1,1,$2,$3)
      ON CONFLICT (usage_date) DO UPDATE SET
        api_calls = youtube_shadow_api_usage.api_calls + 1,
        videos_requested = youtube_shadow_api_usage.videos_requested + excluded.videos_requested,
        videos_returned = youtube_shadow_api_usage.videos_returned + excluded.videos_returned,
        updated_at = now()
    `,
    [date, requested, returned],
  );
}

async function saveObservation(client: PgClient, stats: VideoStats, previousTier: YoutubeRefreshTier) {
  const previous = await client.query<{ view_count: string | number | null; observed_at: string }>(
    `SELECT view_count, observed_at::text FROM youtube_video_intraday_shadow_snapshots WHERE video_id=$1 ORDER BY observed_at DESC LIMIT 1`,
    [stats.videoId],
  );
  const previousViews = numeric(previous.rows[0]?.view_count);
  const previousAt = previous.rows[0]?.observed_at ? new Date(previous.rows[0].observed_at) : null;
  const now = new Date();
  const delta = stats.viewCount == null || previousViews == null ? null : Math.max(0, stats.viewCount - previousViews);
  const seconds = previousAt ? Math.max(0, Math.round((now.getTime() - previousAt.getTime()) / 1000)) : null;
  const tier = chooseYoutubeRefreshTier({
    publishedAt: stats.publishedAt,
    viewCount: stats.viewCount,
    dailyViewDelta: seconds && delta != null ? Math.round(delta * (86_400 / seconds)) : null,
  });
  const bucket = observationBucket(now, previousTier);

  await client.query(
    `
      UPDATE youtube_tracked_videos SET
        channel_id=COALESCE($2,channel_id), title=COALESCE(NULLIF($3,''),title),
        thumbnail_url=COALESCE($4,thumbnail_url), published_at=COALESCE($5,published_at),
        duration=COALESCE($6,duration), view_count=$7, like_count=$8, comment_count=$9,
        last_seen_at=now(), updated_at=now()
      WHERE video_id=$1
    `,
    [stats.videoId, stats.channelId, stats.title, stats.thumbnailUrl, stats.publishedAt, stats.duration, stats.viewCount, stats.likeCount, stats.commentCount],
  );
  await client.query(
    `
      INSERT INTO youtube_video_intraday_shadow_snapshots (
        video_id, refresh_tier, bucket_start, observed_at, view_count, like_count, comment_count,
        view_delta, seconds_since_previous, updated_at
      ) VALUES ($1,$2,$3,now(),$4,$5,$6,$7,$8,now())
      ON CONFLICT (video_id, bucket_start) DO UPDATE SET
        observed_at=now(), view_count=excluded.view_count, like_count=excluded.like_count,
        comment_count=excluded.comment_count, view_delta=excluded.view_delta,
        seconds_since_previous=excluded.seconds_since_previous, updated_at=now()
    `,
    [stats.videoId, previousTier, bucket, stats.viewCount, stats.likeCount, stats.commentCount, delta, seconds],
  );
  await client.query(
    `UPDATE youtube_music_catalog_candidates SET refresh_tier=$2, last_observed_at=now(), updated_at=now() WHERE video_id=$1 AND sampling_status='shadow'`,
    [stats.videoId, tier],
  );
}

async function rebuildCurrentArtistTotals(client: PgClient): Promise<number> {
  const result = await client.query<{ artist_key: string }>(`
    INSERT INTO youtube_artist_intraday_shadow_current (
      artist_key, tracked_video_count, videos_with_observations, total_views, latest_observed_at, updated_at
    )
    SELECT
      c.artist_key,
      count(DISTINCT c.video_id)::int,
      count(DISTINCT latest.video_id)::int,
      COALESCE(sum(latest.view_count),0)::bigint,
      max(latest.observed_at),
      now()
    FROM youtube_music_catalog_candidates c
    LEFT JOIN LATERAL (
      SELECT s.video_id, s.view_count, s.observed_at
      FROM youtube_video_intraday_shadow_snapshots s
      WHERE s.video_id=c.video_id
      ORDER BY s.observed_at DESC LIMIT 1
    ) latest ON true
    WHERE c.status IN ('verified','review') AND c.sampling_status='shadow'
    GROUP BY c.artist_key
    ON CONFLICT (artist_key) DO UPDATE SET
      tracked_video_count=excluded.tracked_video_count,
      videos_with_observations=excluded.videos_with_observations,
      total_views=excluded.total_views,
      latest_observed_at=excluded.latest_observed_at,
      updated_at=now()
    RETURNING artist_key
  `);
  return result.rows.length;
}

export async function runYoutubeIntradayShadow(
  reason: string,
  force = false,
  forceMeasure = false,
): Promise<YoutubeIntradayShadowSummary> {
  const fillEasternMidnightAnchor = reason === "eastern-midnight-anchor";
  const summary: YoutubeIntradayShadowSummary = {
    status: "complete", reason, dueVideos: 0, requestedVideos: 0, apiCalls: 0,
    fetched: 0, saved: 0, missing: 0, artistsUpdated: 0,
    bootstrapArtists: 0, bootstrapSavedCandidates: 0,
    bootstrapErrors: [],
  };
  if (!force && !enabled()) return { ...summary, status: "disabled" };
  if (!process.env["YOUTUBE_API_KEY"]) return { ...summary, status: "failed", error: "Missing YOUTUBE_API_KEY." };
  const client = await pool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    if (!lock.rows[0]?.locked) return { ...summary, status: "locked" };
    try {
      await ensureYoutubeVideoTrackerTables(client);
      await ensureYoutubeShadowTables(client);
      await ensureYoutubeIntradayShadowTables(client);
      const used = await callsUsedToday(client);
      const rows = await client.query<DueVideoRow>(`
        SELECT * FROM (
          SELECT DISTINCT ON (c.video_id)
            c.video_id, c.artist_key, c.refresh_tier, c.last_observed_at::text,
            v.published_at::text, v.view_count, daily.daily_view_delta
          FROM youtube_music_catalog_candidates c
          JOIN youtube_tracked_videos v ON v.video_id=c.video_id
          LEFT JOIN LATERAL (
            SELECT daily_view_delta FROM youtube_video_daily_snapshots d
            WHERE d.video_id=c.video_id ORDER BY snapshot_date DESC LIMIT 1
          ) daily ON true
          WHERE c.status IN ('verified','review')
            AND c.sampling_status='shadow'
            AND (
              $2::boolean OR
              ($3::boolean AND NOT EXISTS (
                SELECT 1
                FROM youtube_video_intraday_shadow_snapshots midnight_sample
                WHERE midnight_sample.video_id=c.video_id
                  AND midnight_sample.observed_at >= (
                    date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
                  )
                  AND midnight_sample.observed_at < (
                    date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
                  ) + interval '30 minutes'
              )) OR
              c.last_observed_at IS NULL OR
              c.last_observed_at <= now() - CASE c.refresh_tier
                WHEN 'hot' THEN interval '15 minutes'
                WHEN 'warm' THEN interval '1 hour'
                ELSE interval '4 hours'
              END
            )
          ORDER BY c.video_id,
                   CASE c.refresh_tier WHEN 'hot' THEN 1 WHEN 'warm' THEN 2 ELSE 3 END
        ) due
        ORDER BY row_number() OVER (
                   PARTITION BY artist_key
                   ORDER BY CASE refresh_tier WHEN 'hot' THEN 1 WHEN 'warm' THEN 2 ELSE 3 END,
                            last_observed_at ASC NULLS FIRST, video_id
                 ),
                 artist_key,
                 CASE refresh_tier WHEN 'hot' THEN 1 WHEN 'warm' THEN 2 ELSE 3 END,
                 last_observed_at ASC NULLS FIRST,
                 video_id
        LIMIT $1
      `, [maxVideosPerRun() * 10, forceMeasure, fillEasternMidnightAnchor]);
      summary.dueVideos = rows.rows.length;
      const fairRows = roundRobinArtists(rows.rows, maxVideosPerRun());
      const allowedBatches = youtubeApiBatchesAllowed({ dailyBudget: dailyBudget(), callsUsed: used, requestedVideos: fairRows.length });
      if (allowedBatches <= 0 && rows.rows.length) return { ...summary, status: "quota_exhausted" };
      const selected = fairRows.slice(0, allowedBatches * 50);
      summary.requestedVideos = selected.length;

      for (const group of batch(selected, 50)) {
        const stats = await fetchYoutubeVideos(group.map(row => row.video_id));
        summary.apiCalls += 1;
        summary.fetched += stats.length;
        summary.missing += group.length - stats.length;
        await recordUsage(client, group.length, stats.length);
        const tiers = new Map(group.map(row => [row.video_id, row.refresh_tier]));
        for (const item of stats) {
          await saveObservation(client, item, tiers.get(item.videoId) ?? "baseline");
          summary.saved += 1;
        }
      }
      summary.artistsUpdated = await rebuildCurrentArtistTotals(client);
      return summary;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    }
  } catch (error) {
    summary.status = "failed";
    summary.error = error instanceof Error ? error.message : String(error);
    logger.error({ error, reason }, "[youtube-shadow:intraday] run failed");
    return summary;
  } finally {
    client.release();
  }
}

export function startYoutubeIntradayShadowScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  if (!enabled()) {
    logger.info("[youtube-shadow:intraday] disabled by emergency kill switch");
    return;
  }
  const runScheduledCheck = (reason: string) => {
    const eastern = youtubeEasternMidnightAnchor(new Date());
    const forceMidnightAnchor = eastern.shouldAnchor && lastEasternMidnightAnchorDate !== eastern.dateKey;
    if (forceMidnightAnchor) lastEasternMidnightAnchorDate = eastern.dateKey;
    void runYoutubeIntradayShadow(
      forceMidnightAnchor ? "eastern-midnight-anchor" : reason,
      false,
      false,
    ).then(summary => {
      logger.info(summary, "[youtube-shadow:intraday] run complete");
      if (forceMidnightAnchor && summary.status !== "complete") lastEasternMidnightAnchorDate = null;
      if (!discoveryRunning) {
        discoveryRunning = true;
        void bootstrapActiveCatalog()
          .then(result => logger.info(result, "[youtube-shadow:catalog] discovery pass complete"))
          .catch(error => logger.error({ error }, "[youtube-shadow:catalog] discovery pass failed"))
          .finally(() => { discoveryRunning = false; });
      }
    }).catch(error => {
      logger.error({ error, reason }, "[youtube-shadow:intraday] scheduler invocation failed");
      if (forceMidnightAnchor) lastEasternMidnightAnchorDate = null;
    });
  };
  setTimeout(() => runScheduledCheck("startup"), 1_000).unref();
  setInterval(() => runScheduledCheck("five-minute-check"), CHECK_MS).unref();
  logger.info({ dailyBudget: dailyBudget(), maxVideosPerRun: maxVideosPerRun() }, "[youtube-shadow:intraday] private automation enabled");
}
