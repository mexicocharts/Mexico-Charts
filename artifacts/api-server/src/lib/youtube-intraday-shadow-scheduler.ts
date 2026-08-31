import { pool, youtubeCollectorPool } from "@workspace/db";
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

interface YoutubeBatchStatsItem {
  id: string;
  snippet?: { publishTime?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
}

interface StoredChannelRow {
  artist_key: string;
  artist_name: string;
  channel_id: string;
  playlist_id: string | null;
  next_page_token: string | null;
  videos_imported: number | null;
  expected_total_videos: number | null;
  import_status: "complete" | "retryable" | null;
  completed_at: string | null;
}

interface StoredChannelVideo {
  artistKey: string;
  artistName: string;
  channelId: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
}

interface StoredChannelImportState {
  artist_key: string;
  channel_id: string;
  playlist_id: string | null;
  status: "complete" | "retryable";
  error: string | null;
  next_page_token: string | null;
  videos_imported: number;
  expected_total_videos: number | null;
  next_retry_at: string | null;
  completed_at: string | null;
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
  seededCatalogVideos: number;
  seededCatalogArtists: number;
  reusedStoredVideos: number;
  reusedStoredArtists: number;
  importedChannelVideos: number;
  importedChannelArtists: number;
  importedChannelErrors: string[];
  error?: string;
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const LOCK_KEY = 392_410_604;
const CHECK_MS = 5 * 60 * 1000;
let schedulerStarted = false;
let discoveryRunning = false;

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
  return { dateKey, shouldAnchor: hour === 0 && minute < 30 };
}

export function youtubeIntradayShadowAutomationEnabled(
  env: NodeJS.ProcessEnv = process.env,
) {
  // Intraday collection is a production feature. Ignore the legacy opt-in/
  // opt-out flag left over from the four-artist pilot; retain one deliberately
  // named emergency kill switch for incident response.
  return env["YOUTUBE_INTRADAY_SHADOW_AUTOMATION_DISABLED"] !== "true";
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
  const raw = Number(process.env["YOUTUBE_INTRADAY_SHADOW_MAX_VIDEOS"] ?? "250");
  // A production secret from the former pilot may still request thousands.
  // Enforce the database-safe ceiling in code.
  return Number.isFinite(raw) ? Math.max(1, Math.min(250, Math.floor(raw))) : 250;
}

function batch<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

export function youtubeChannelUploadImportProgress(input: {
  videosImported: number | null | undefined;
  pageVideoCount: number;
  nextPageToken: string | null | undefined;
  expectedTotalVideos: number | null | undefined;
  refreshingCompleteChannel?: boolean;
}) {
  const existingVideosImported = Math.max(0, Number(input.videosImported ?? 0));
  const pageVideoCount = Math.max(0, Math.floor(input.pageVideoCount));
  const nextPageToken = input.nextPageToken?.trim() || null;
  const expectedTotalVideos = input.expectedTotalVideos == null
    ? null
    : Math.max(0, Math.floor(input.expectedTotalVideos));
  if (input.refreshingCompleteChannel) {
    return {
      status: "complete" as const,
      nextPageToken: null,
      videosImported: Math.max(
        existingVideosImported,
        expectedTotalVideos ?? existingVideosImported,
      ),
      expectedTotalVideos,
      complete: true,
    };
  }
  const videosImported = existingVideosImported + pageVideoCount;
  return {
    status: nextPageToken ? "retryable" as const : "complete" as const,
    nextPageToken,
    videosImported,
    expectedTotalVideos,
    complete: !nextPageToken,
  };
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

async function seedApprovedVideoLinksIntoIntradayCatalog(client: PgClient) {
  const seeded = await client.query<{ artist_key: string }>(`
    INSERT INTO youtube_music_catalog_candidates (
      artist_key,
      artist_name,
      artist_browse_id,
      video_id,
      title,
      canonical_url,
      evidence_source,
      evidence_sources,
      confidence_score,
      status,
      sampling_status,
      refresh_tier,
      evidence,
      last_checked_at,
      updated_at
    )
    SELECT
      l.artist_key,
      COALESCE(NULLIF(l.artist_name, ''), l.artist_key),
      COALESCE(v.channel_id, yc.channel_id, 'existing-link:' || l.artist_key),
      l.video_id,
      COALESCE(v.title, ''),
      'https://www.youtube.com/watch?v=' || l.video_id,
      'approved_artist_video_link',
      jsonb_build_array('approved_artist_video_link', l.source_type),
      l.confidence_score,
      'review',
      'shadow',
      CASE
        WHEN COALESCE(v.published_at, now() - interval '10 years') >= now() - interval '14 days' THEN 'hot'
        WHEN COALESCE(v.published_at, now() - interval '10 years') >= now() - interval '90 days' THEN 'warm'
        ELSE 'baseline'
      END,
      jsonb_build_object(
        'seedSource', 'youtube_artist_video_links',
        'linkSourceType', l.source_type,
        'linkConfidenceScore', l.confidence_score
      ),
      now(),
      now()
    FROM youtube_artist_video_links l
    JOIN youtube_tracked_videos v ON v.video_id=l.video_id
    LEFT JOIN youtube_channels yc ON yc.artist_key=l.artist_key
    WHERE l.active=true
      AND l.confidence_score >= 80
      AND EXISTS (
        SELECT 1
        FROM kworb_coverage roster
        WHERE roster.status='active'
          AND regexp_replace(
            translate(lower(roster.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          ) = regexp_replace(
            translate(lower(l.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          )
      )
    ON CONFLICT (artist_key, video_id) DO UPDATE SET
      artist_name=excluded.artist_name,
      artist_browse_id=CASE
        WHEN youtube_music_catalog_candidates.artist_browse_id LIKE 'existing-link:%'
          THEN excluded.artist_browse_id
        ELSE youtube_music_catalog_candidates.artist_browse_id
      END,
      title=COALESCE(NULLIF(excluded.title, ''), youtube_music_catalog_candidates.title),
      confidence_score=GREATEST(youtube_music_catalog_candidates.confidence_score, excluded.confidence_score),
      sampling_status=CASE
        WHEN youtube_music_catalog_candidates.status='rejected' THEN youtube_music_catalog_candidates.sampling_status
        ELSE 'shadow'
      END,
      evidence_sources=(
        SELECT jsonb_agg(DISTINCT source)
        FROM jsonb_array_elements(
          youtube_music_catalog_candidates.evidence_sources || excluded.evidence_sources
        ) source
      ),
      evidence=youtube_music_catalog_candidates.evidence || excluded.evidence,
      updated_at=now()
    WHERE youtube_music_catalog_candidates.status <> 'rejected'
    RETURNING artist_key
  `);
  return {
    videos: seeded.rows.length,
    artists: new Set(seeded.rows.map(row => row.artist_key)).size,
  };
}

async function enforceActiveYoutubeRosterScope(client: PgClient) {
  const links = await client.query<{ artist_key: string }>(`
    UPDATE youtube_artist_video_links link
    SET active=false, updated_at=now()
    WHERE link.active=true
      AND NOT EXISTS (
        SELECT 1
        FROM kworb_coverage roster
        WHERE roster.status='active'
          AND regexp_replace(
            translate(lower(roster.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          ) = regexp_replace(
            translate(lower(link.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          )
      )
    RETURNING artist_key
  `);
  const candidates = await client.query<{ artist_key: string }>(`
    UPDATE youtube_music_catalog_candidates candidate
    SET sampling_status='disabled', updated_at=now()
    WHERE candidate.sampling_status='shadow'
      AND NOT EXISTS (
        SELECT 1
        FROM kworb_coverage roster
        WHERE roster.status='active'
          AND regexp_replace(
            translate(lower(roster.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          ) = regexp_replace(
            translate(lower(candidate.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          )
      )
    RETURNING artist_key
  `);
  return {
    linksDisabled: links.rows.length,
    candidatesDisabled: candidates.rows.length,
  };
}

async function reuseStoredYoutubeSources(client: PgClient) {
  // Kworb snapshots already contain public video IDs and titles. Reuse the
  // newest stored snapshot per artist instead of spending Search quota to
  // rediscover the same videos.
  await client.query(`
    WITH latest AS (
      SELECT DISTINCT ON (s.artist_key)
        s.artist_key,
        COALESCE(c.artist_name, s.artist_key) artist_name,
        s.value
      FROM kworb_snapshots s
      JOIN kworb_coverage c ON c.artist_key=s.artist_key AND c.status='active'
      WHERE s.metric_type='youtube'
      ORDER BY s.artist_key, s.fetched_at DESC NULLS LAST
    ), videos AS (
      SELECT
        latest.artist_key,
        latest.artist_name,
        item->>'videoId' video_id,
        COALESCE(item->>'title', '') title,
        NULLIF(item->>'thumbnailUrl', '') thumbnail_url,
        CASE
          WHEN COALESCE(item->>'views', '') ~ '^[0-9,]+$'
            THEN replace(item->>'views', ',', '')::bigint
          ELSE NULL
        END view_count
      FROM latest
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(latest.value->'topVideos')='array'
          THEN latest.value->'topVideos' ELSE '[]'::jsonb END
      ) item
      WHERE COALESCE(item->>'videoId', '') ~ '^[A-Za-z0-9_-]{11}$'
    )
    INSERT INTO youtube_tracked_videos (
      video_id, title, thumbnail_url, view_count, metadata, last_seen_at, updated_at
    )
    SELECT DISTINCT ON (video_id)
      video_id,
      title,
      thumbnail_url,
      view_count,
      jsonb_build_object('seedSource', 'kworb_top_videos_reuse'),
      now(),
      now()
    FROM videos
    ORDER BY video_id, view_count DESC NULLS LAST
    ON CONFLICT (video_id) DO UPDATE SET
      title=COALESCE(NULLIF(excluded.title, ''), youtube_tracked_videos.title),
      thumbnail_url=COALESCE(excluded.thumbnail_url, youtube_tracked_videos.thumbnail_url),
      view_count=COALESCE(excluded.view_count, youtube_tracked_videos.view_count),
      metadata=youtube_tracked_videos.metadata || excluded.metadata,
      last_seen_at=now(),
      updated_at=now()
  `);

  const kworbLinks = await client.query<{ artist_key: string }>(`
    WITH latest AS (
      SELECT DISTINCT ON (s.artist_key)
        s.artist_key,
        COALESCE(c.artist_name, s.artist_key) artist_name,
        s.value
      FROM kworb_snapshots s
      JOIN kworb_coverage c ON c.artist_key=s.artist_key AND c.status='active'
      WHERE s.metric_type='youtube'
      ORDER BY s.artist_key, s.fetched_at DESC NULLS LAST
    ), videos AS (
      SELECT
        latest.artist_key,
        latest.artist_name,
        item->>'videoId' video_id,
        COALESCE(item->>'title', '') title
      FROM latest
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(latest.value->'topVideos')='array'
          THEN latest.value->'topVideos' ELSE '[]'::jsonb END
      ) item
      WHERE COALESCE(item->>'videoId', '') ~ '^[A-Za-z0-9_-]{11}$'
    )
    INSERT INTO youtube_artist_video_links (
      artist_key, artist_name, video_id, source_type,
      confidence_score, priority, active, metadata, updated_at
    )
    SELECT DISTINCT ON (artist_key, video_id)
      artist_key,
      artist_name,
      video_id,
      'kworb_top_videos',
      88,
      80,
      true,
      jsonb_build_object('seedSource', 'kworb_top_videos_reuse', 'title', title),
      now()
    FROM videos
    ON CONFLICT (artist_key, video_id) DO UPDATE SET
      artist_name=COALESCE(NULLIF(excluded.artist_name, ''), youtube_artist_video_links.artist_name),
      confidence_score=GREATEST(youtube_artist_video_links.confidence_score, excluded.confidence_score),
      priority=GREATEST(youtube_artist_video_links.priority, excluded.priority),
      active=true,
      metadata=youtube_artist_video_links.metadata || excluded.metadata,
      updated_at=now()
    RETURNING artist_key
  `);

  // Reuse any videos already fetched for verified profile channels, even when
  // the older tracker never created the artist/video association.
  const channelLinks = await client.query<{ artist_key: string }>(`
    INSERT INTO youtube_artist_video_links (
      artist_key, artist_name, video_id, source_type,
      confidence_score, priority, active, metadata, updated_at
    )
    SELECT DISTINCT ON (yc.artist_key, v.video_id)
      yc.artist_key,
      COALESCE(c.artist_name, yc.title, yc.artist_key),
      v.video_id,
      'verified_profile_channel',
      90,
      90,
      true,
      jsonb_build_object('seedSource', 'verified_profile_channel', 'channelId', yc.channel_id),
      now()
    FROM youtube_channels yc
    JOIN youtube_tracked_videos v ON v.channel_id=yc.channel_id
    LEFT JOIN kworb_coverage c ON c.artist_key=yc.artist_key
    WHERE yc.channel_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM kworb_coverage roster
        WHERE roster.status='active'
          AND regexp_replace(
            translate(lower(roster.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          ) = regexp_replace(
            translate(lower(yc.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          )
      )
    ON CONFLICT (artist_key, video_id) DO UPDATE SET
      confidence_score=GREATEST(youtube_artist_video_links.confidence_score, excluded.confidence_score),
      priority=GREATEST(youtube_artist_video_links.priority, excluded.priority),
      active=true,
      metadata=youtube_artist_video_links.metadata || excluded.metadata,
      updated_at=now()
    RETURNING artist_key
  `);

  const artistKeys = [...kworbLinks.rows, ...channelLinks.rows].map(row => row.artist_key);
  return { videos: kworbLinks.rows.length + channelLinks.rows.length, artists: new Set(artistKeys).size };
}

async function fetchYoutubeJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube API ${response.status}: ${(await response.text()).slice(0, 240)}`);
  return await response.json() as T;
}

async function saveStoredChannelImportChunk(
  client: PgClient,
  videos: StoredChannelVideo[],
  states: StoredChannelImportState[],
) {
  await client.query("BEGIN");
  try {
    if (videos.length) {
      const payload = JSON.stringify(videos.map(video => ({
        artist_key: video.artistKey,
        artist_name: video.artistName,
        channel_id: video.channelId,
        video_id: video.videoId,
        title: video.title,
        thumbnail_url: video.thumbnailUrl,
        published_at: video.publishedAt,
      })));
      await client.query(`
        INSERT INTO youtube_tracked_videos (
          video_id, channel_id, title, thumbnail_url, published_at,
          metadata, last_seen_at, updated_at
        )
        SELECT DISTINCT ON (video_id)
          video_id, channel_id, title, thumbnail_url, published_at,
          jsonb_build_object('seedSource', 'verified_profile_channel_uploads'), now(), now()
        FROM jsonb_to_recordset($1::jsonb) AS input(
          artist_key text, artist_name text, channel_id text, video_id text,
          title text, thumbnail_url text, published_at timestamptz
        )
        ON CONFLICT (video_id) DO UPDATE SET
          channel_id=COALESCE(excluded.channel_id, youtube_tracked_videos.channel_id),
          title=COALESCE(NULLIF(excluded.title, ''), youtube_tracked_videos.title),
          thumbnail_url=COALESCE(excluded.thumbnail_url, youtube_tracked_videos.thumbnail_url),
          published_at=COALESCE(excluded.published_at, youtube_tracked_videos.published_at),
          metadata=youtube_tracked_videos.metadata || excluded.metadata,
          last_seen_at=now(), updated_at=now()
      `, [payload]);
      await client.query(`
        INSERT INTO youtube_artist_video_links (
          artist_key, artist_name, video_id, source_type,
          confidence_score, priority, active, metadata, updated_at
        )
        SELECT DISTINCT ON (artist_key, video_id)
          artist_key, artist_name, video_id, 'verified_profile_channel',
          90, 90, true,
          jsonb_build_object('seedSource', 'verified_profile_channel_uploads', 'channelId', channel_id),
          now()
        FROM jsonb_to_recordset($1::jsonb) AS input(
          artist_key text, artist_name text, channel_id text, video_id text,
          title text, thumbnail_url text, published_at timestamptz
        )
        ON CONFLICT (artist_key, video_id) DO UPDATE SET
          confidence_score=GREATEST(youtube_artist_video_links.confidence_score, excluded.confidence_score),
          priority=GREATEST(youtube_artist_video_links.priority, excluded.priority),
          active=true,
          metadata=youtube_artist_video_links.metadata || excluded.metadata,
          updated_at=now()
      `, [payload]);
    }
    await client.query(`
      INSERT INTO youtube_channel_upload_import_state (
        artist_key, channel_id, playlist_id, status, error, next_page_token,
        videos_imported, expected_total_videos, last_attempt_at, next_retry_at,
        completed_at, updated_at
      )
      SELECT artist_key, channel_id, playlist_id, status, error, next_page_token,
             videos_imported, expected_total_videos, now(), next_retry_at,
             completed_at, now()
      FROM jsonb_to_recordset($1::jsonb) AS input(
        artist_key text, channel_id text, playlist_id text, status text, error text,
        next_page_token text, videos_imported integer, expected_total_videos integer,
        next_retry_at timestamptz, completed_at timestamptz
      )
      ON CONFLICT (artist_key) DO UPDATE SET
        channel_id=excluded.channel_id,
        playlist_id=COALESCE(excluded.playlist_id, youtube_channel_upload_import_state.playlist_id),
        status=excluded.status,
        error=excluded.error,
        next_page_token=excluded.next_page_token,
        videos_imported=GREATEST(youtube_channel_upload_import_state.videos_imported, excluded.videos_imported),
        expected_total_videos=COALESCE(excluded.expected_total_videos, youtube_channel_upload_import_state.expected_total_videos),
        last_attempt_at=now(),
        next_retry_at=excluded.next_retry_at,
        completed_at=CASE
          WHEN excluded.error IS NOT NULL
            THEN youtube_channel_upload_import_state.completed_at
          ELSE excluded.completed_at
        END,
        updated_at=now()
    `, [JSON.stringify(states)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function importStoredProfileChannelUploads(client: PgClient, callsAvailable: number) {
  const artistLimit = Math.max(0, Math.min(200, callsAvailable - 1));
  if (artistLimit <= 0) return { artists: 0, videos: 0, apiCalls: 0 };
  const channels = await client.query<StoredChannelRow>(`
    SELECT
      yc.artist_key,
      COALESCE(c.artist_name, yc.title, yc.artist_key) artist_name,
      yc.channel_id,
      import_state.playlist_id,
      import_state.next_page_token,
      import_state.videos_imported,
      import_state.expected_total_videos,
      import_state.status import_status,
      import_state.completed_at::text
    FROM youtube_channels yc
    LEFT JOIN kworb_coverage c ON c.artist_key=yc.artist_key
    LEFT JOIN youtube_channel_upload_import_state import_state ON import_state.artist_key=yc.artist_key
    WHERE yc.channel_id ~ '^UC[A-Za-z0-9_-]{22}$'
      AND EXISTS (
        SELECT 1
        FROM kworb_coverage roster
        WHERE roster.status='active'
          AND regexp_replace(
            translate(lower(roster.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          ) = regexp_replace(
            translate(lower(yc.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          )
      )
      AND (
        import_state.artist_key IS NULL
        OR (
          import_state.status='retryable'
          AND (import_state.next_retry_at IS NULL OR import_state.next_retry_at <= now())
        )
        OR (
          import_state.status='complete'
          AND (
            import_state.completed_at IS NULL
            OR import_state.next_retry_at IS NULL
            OR import_state.next_retry_at <= now()
          )
        )
      )
    ORDER BY
      CASE WHEN import_state.next_page_token IS NOT NULL THEN 0
           WHEN import_state.artist_key IS NULL THEN 1
           ELSE 2 END,
      import_state.last_attempt_at ASC NULLS FIRST,
      yc.artist_key
    LIMIT $1
  `, [artistLimit]);
  if (!channels.rows.length) return { artists: 0, videos: 0, apiCalls: 0 };

  let apiCalls = 0;
  const uploadsByChannel = new Map(
    channels.rows.flatMap(row => row.playlist_id
      ? [[row.channel_id, row.playlist_id] as const]
      : []),
  );
  const channelsMissingPlaylist = channels.rows.filter(row => !row.playlist_id);
  if (channelsMissingPlaylist.length) {
    const channelData = await fetchYoutubeJson<{
      items?: Array<{ id: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
    }>("channels", {
      part: "contentDetails",
      id: channelsMissingPlaylist.map(row => row.channel_id).join(","),
      maxResults: String(channelsMissingPlaylist.length),
    });
    apiCalls += 1;
    await recordUsage(client, 0, 0);
    for (const item of channelData.items ?? []) {
      const uploads = item.contentDetails?.relatedPlaylists?.uploads;
      if (uploads) uploadsByChannel.set(item.id, uploads);
    }
  }

  let importedVideos = 0;
  const importedArtists = new Set<string>();
  for (const group of batch(channels.rows, 10)) {
    const groupVideos: StoredChannelVideo[] = [];
    const groupStates: StoredChannelImportState[] = [];
    const results = await Promise.all(group.map(async artist => {
      const playlistId = uploadsByChannel.get(artist.channel_id);
      if (!playlistId) return {
        artist,
        playlistId: null,
        attempted: false,
        items: [] as StoredChannelVideo[],
        nextPageToken: artist.next_page_token,
        expectedTotalVideos: artist.expected_total_videos,
        error: "Uploads playlist unavailable.",
      };
      try {
        const data = await fetchYoutubeJson<{
          nextPageToken?: string;
          pageInfo?: { totalResults?: number };
          items?: Array<{ snippet?: {
            title?: string;
            publishedAt?: string;
            thumbnails?: Record<string, { url?: string }>;
            resourceId?: { videoId?: string };
          } }>;
        }>("playlistItems", {
          part: "snippet",
          playlistId,
          maxResults: "50",
          ...(artist.next_page_token ? { pageToken: artist.next_page_token } : {}),
        });
        const items = (data.items ?? []).flatMap(item => {
          const videoId = item.snippet?.resourceId?.videoId;
          if (!videoId) return [];
          const thumbs = item.snippet?.thumbnails ?? {};
          return [{
            artistKey: artist.artist_key,
            artistName: artist.artist_name,
            channelId: artist.channel_id,
            videoId,
            title: item.snippet?.title ?? "",
            thumbnailUrl: thumbs.maxres?.url ?? thumbs.standard?.url ?? thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null,
            publishedAt: item.snippet?.publishedAt ?? null,
          }];
        });
        return {
          artist,
          playlistId,
          attempted: true,
          items,
          nextPageToken: data.nextPageToken ?? null,
          expectedTotalVideos: data.pageInfo?.totalResults ?? artist.expected_total_videos,
          error: null,
        };
      } catch (error) {
        return {
          artist,
          playlistId,
          attempted: true,
          items: [] as StoredChannelVideo[],
          nextPageToken: artist.next_page_token,
          expectedTotalVideos: artist.expected_total_videos,
          error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        };
      }
    }));
    for (const result of results) {
      if (result.attempted) {
        apiCalls += 1;
        await recordUsage(client, 50, result.items.length);
      }
      groupVideos.push(...result.items);
      if (result.items.length) importedArtists.add(result.artist.artist_key);
      const progress = youtubeChannelUploadImportProgress({
        videosImported: result.artist.videos_imported,
        pageVideoCount: result.items.length,
        nextPageToken: result.nextPageToken,
        expectedTotalVideos: result.expectedTotalVideos,
        refreshingCompleteChannel: Boolean(
          result.artist.completed_at && !result.artist.next_page_token,
        ),
      });
      groupStates.push({
        artist_key: result.artist.artist_key,
        channel_id: result.artist.channel_id,
        playlist_id: result.playlistId,
        status: result.error ? "retryable" : progress.status,
        error: result.error,
        next_page_token: progress.nextPageToken,
        videos_imported: progress.videosImported,
        expected_total_videos: progress.expectedTotalVideos,
        next_retry_at: result.error
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : progress.complete
            ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + CHECK_MS).toISOString(),
        completed_at: result.error
          ? result.artist.completed_at
          : progress.complete
            ? new Date().toISOString()
            : null,
      });
    }
    await saveStoredChannelImportChunk(client, groupVideos, groupStates);
    importedVideos += groupVideos.length;
  }
  const importErrors = await client.query<{ artist_key: string; error: string }>(`
    SELECT artist_key, error
    FROM youtube_channel_upload_import_state
    WHERE last_attempt_at >= now() - interval '5 minutes'
      AND status='retryable'
      AND error IS NOT NULL
    ORDER BY artist_key
    LIMIT 50
  `);
  return {
    artists: importedArtists.size,
    videos: importedVideos,
    apiCalls,
    errors: importErrors.rows.map(row => `${row.artist_key}: ${row.error}`),
  };
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
      batch_stats_api_calls integer NOT NULL DEFAULT 0,
      batch_stats_videos_requested integer NOT NULL DEFAULT 0,
      batch_stats_videos_returned integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`ALTER TABLE youtube_shadow_api_usage ADD COLUMN IF NOT EXISTS batch_stats_api_calls integer NOT NULL DEFAULT 0;`);
  await client.query(`ALTER TABLE youtube_shadow_api_usage ADD COLUMN IF NOT EXISTS batch_stats_videos_requested integer NOT NULL DEFAULT 0;`);
  await client.query(`ALTER TABLE youtube_shadow_api_usage ADD COLUMN IF NOT EXISTS batch_stats_videos_returned integer NOT NULL DEFAULT 0;`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_channel_upload_import_state (
      artist_key text PRIMARY KEY,
      channel_id text NOT NULL,
      playlist_id text,
      status text NOT NULL CHECK (status IN ('complete','retryable')),
      error text,
      next_page_token text,
      videos_imported integer NOT NULL DEFAULT 0,
      expected_total_videos integer,
      last_attempt_at timestamptz NOT NULL DEFAULT now(),
      next_retry_at timestamptz,
      completed_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`ALTER TABLE youtube_channel_upload_import_state ADD COLUMN IF NOT EXISTS playlist_id text;`);
  await client.query(`ALTER TABLE youtube_channel_upload_import_state ADD COLUMN IF NOT EXISTS next_page_token text;`);
  await client.query(`ALTER TABLE youtube_channel_upload_import_state ADD COLUMN IF NOT EXISTS videos_imported integer NOT NULL DEFAULT 0;`);
  await client.query(`ALTER TABLE youtube_channel_upload_import_state ADD COLUMN IF NOT EXISTS expected_total_videos integer;`);
  await client.query(`ALTER TABLE youtube_channel_upload_import_state ADD COLUMN IF NOT EXISTS completed_at timestamptz;`);
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

export function youtubeBatchStatsItems(items: YoutubeBatchStatsItem[]): VideoStats[] {
  return items.map(item => ({
    videoId: item.id,
    channelId: null,
    title: "",
    thumbnailUrl: null,
    publishedAt: item.snippet?.publishTime ? new Date(item.snippet.publishTime) : null,
    duration: item.contentDetails?.duration ?? null,
    viewCount: numeric(item.statistics?.viewCount),
    likeCount: numeric(item.statistics?.likeCount),
    commentCount: numeric(item.statistics?.commentCount),
  }));
}

async function fetchYoutubeBatchStats(videoIds: string[]): Promise<VideoStats[]> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");
  const url = new URL(`${YOUTUBE_API_BASE}/videos:batchGetStats`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("part", "statistics,contentDetails,snippet");
  url.searchParams.set("id", videoIds.join(","));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube batch stats API ${response.status}: ${(await response.text()).slice(0, 240)}`);
  const data = await response.json() as { items?: YoutubeBatchStatsItem[] };
  return youtubeBatchStatsItems(data.items ?? []);
}

async function callsUsedToday(client: PgClient): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const result = await client.query<{ api_calls: number }>(
    `SELECT api_calls FROM youtube_shadow_api_usage WHERE usage_date=$1`,
    [date],
  );
  return result.rows[0]?.api_calls ?? 0;
}

async function batchStatsCallsUsedToday(client: PgClient): Promise<number> {
  const date = new Date().toISOString().slice(0, 10);
  const result = await client.query<{ batch_stats_api_calls: number }>(
    `SELECT batch_stats_api_calls FROM youtube_shadow_api_usage WHERE usage_date=$1`,
    [date],
  );
  return result.rows[0]?.batch_stats_api_calls ?? 0;
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

async function recordBatchStatsUsage(client: PgClient, requested: number, returned: number) {
  const date = new Date().toISOString().slice(0, 10);
  await client.query(
    `
      INSERT INTO youtube_shadow_api_usage (
        usage_date, batch_stats_api_calls, batch_stats_videos_requested, batch_stats_videos_returned
      ) VALUES ($1,1,$2,$3)
      ON CONFLICT (usage_date) DO UPDATE SET
        batch_stats_api_calls = youtube_shadow_api_usage.batch_stats_api_calls + 1,
        batch_stats_videos_requested = youtube_shadow_api_usage.batch_stats_videos_requested + excluded.batch_stats_videos_requested,
        batch_stats_videos_returned = youtube_shadow_api_usage.batch_stats_videos_returned + excluded.batch_stats_videos_returned,
        updated_at = now()
    `,
    [date, requested, returned],
  );
}

async function saveObservationsBulk(
  client: PgClient,
  stats: VideoStats[],
  previousTiers: Map<string, YoutubeRefreshTier>,
) {
  if (!stats.length) return 0;
  const ids = stats.map(item => item.videoId);
  const previous = await client.query<{ video_id: string; view_count: string | number | null; observed_at: string }>(
    `SELECT DISTINCT ON (video_id) video_id, view_count, observed_at::text
     FROM youtube_video_intraday_shadow_snapshots
     WHERE video_id = ANY($1::text[])
     ORDER BY video_id, observed_at DESC`,
    [ids],
  );
  const previousById = new Map(previous.rows.map(row => [row.video_id, row]));
  const now = new Date();
  const rows = stats.map(item => {
    const prior = previousById.get(item.videoId);
    const previousViews = numeric(prior?.view_count);
    const previousAt = prior?.observed_at ? new Date(prior.observed_at) : null;
    const delta = item.viewCount == null || previousViews == null ? null : Math.max(0, item.viewCount - previousViews);
    const seconds = previousAt ? Math.max(0, Math.round((now.getTime() - previousAt.getTime()) / 1000)) : null;
    const previousTier = previousTiers.get(item.videoId) ?? "baseline";
    const tier = chooseYoutubeRefreshTier({
      publishedAt: item.publishedAt,
      viewCount: item.viewCount,
      dailyViewDelta: seconds && delta != null ? Math.round(delta * (86_400 / seconds)) : null,
    });
    return {
      video_id: item.videoId,
      channel_id: item.channelId,
      title: item.title,
      thumbnail_url: item.thumbnailUrl,
      published_at: item.publishedAt?.toISOString() ?? null,
      duration: item.duration,
      view_count: item.viewCount,
      like_count: item.likeCount,
      comment_count: item.commentCount,
      refresh_tier: previousTier,
      next_refresh_tier: tier,
      bucket_start: observationBucket(now, previousTier).toISOString(),
      view_delta: delta,
      seconds_since_previous: seconds,
    };
  });
  const payload = JSON.stringify(rows);

  await client.query("BEGIN");
  try {
    await client.query(`
      UPDATE youtube_tracked_videos video SET
        channel_id=COALESCE(input.channel_id,video.channel_id),
        title=COALESCE(NULLIF(input.title,''),video.title),
        thumbnail_url=COALESCE(input.thumbnail_url,video.thumbnail_url),
        published_at=COALESCE(input.published_at,video.published_at),
        duration=COALESCE(input.duration,video.duration),
        view_count=input.view_count, like_count=input.like_count, comment_count=input.comment_count,
        last_seen_at=now(), updated_at=now()
      FROM jsonb_to_recordset($1::jsonb) AS input(
        video_id text, channel_id text, title text, thumbnail_url text, published_at timestamptz,
        duration text, view_count bigint, like_count bigint, comment_count bigint
      )
      WHERE video.video_id=input.video_id
    `, [payload]);
    await client.query(`
      INSERT INTO youtube_video_intraday_shadow_snapshots (
        video_id, refresh_tier, bucket_start, observed_at, view_count, like_count, comment_count,
        view_delta, seconds_since_previous, updated_at
      )
      SELECT video_id, refresh_tier, bucket_start, now(), view_count, like_count, comment_count,
             view_delta, seconds_since_previous, now()
      FROM jsonb_to_recordset($1::jsonb) AS input(
        video_id text, refresh_tier text, bucket_start timestamptz, view_count bigint,
        like_count bigint, comment_count bigint, view_delta bigint, seconds_since_previous integer
      )
      ON CONFLICT (video_id, bucket_start) DO UPDATE SET
        observed_at=now(), view_count=excluded.view_count, like_count=excluded.like_count,
        comment_count=excluded.comment_count, view_delta=excluded.view_delta,
        seconds_since_previous=excluded.seconds_since_previous, updated_at=now()
    `, [payload]);
    await client.query(`
      UPDATE youtube_music_catalog_candidates candidate SET
        refresh_tier=input.next_refresh_tier, last_observed_at=now(), updated_at=now()
      FROM jsonb_to_recordset($1::jsonb) AS input(video_id text, next_refresh_tier text)
      WHERE candidate.video_id=input.video_id AND candidate.sampling_status='shadow'
    `, [payload]);
    await client.query("COMMIT");
    return rows.length;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
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
      AND EXISTS (
        SELECT 1
        FROM kworb_coverage roster
        WHERE roster.status='active'
          AND regexp_replace(
            translate(lower(roster.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          ) = regexp_replace(
            translate(lower(c.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          )
      )
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
    seededCatalogVideos: 0, seededCatalogArtists: 0,
    reusedStoredVideos: 0, reusedStoredArtists: 0,
    importedChannelVideos: 0, importedChannelArtists: 0,
    importedChannelErrors: [],
  };
  if (!force && !youtubeIntradayShadowAutomationEnabled()) return { ...summary, status: "disabled" };
  if (!process.env["YOUTUBE_API_KEY"]) return { ...summary, status: "failed", error: "Missing YOUTUBE_API_KEY." };
  const client = await youtubeCollectorPool.connect();
  try {
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    if (!lock.rows[0]?.locked) return { ...summary, status: "locked" };
    try {
      await ensureYoutubeVideoTrackerTables(client);
      await ensureYoutubeShadowTables(client);
      await ensureYoutubeIntradayShadowTables(client);
      const rosterScope = await enforceActiveYoutubeRosterScope(client);
      if (rosterScope.linksDisabled || rosterScope.candidatesDisabled) {
        logger.info(rosterScope, "[youtube-shadow:intraday] disabled out-of-roster mappings");
      }
      const usedBeforeImport = await callsUsedToday(client);
      try {
        const importedChannels = await importStoredProfileChannelUploads(
          client,
          Math.max(0, dailyBudget() - usedBeforeImport),
        );
        summary.importedChannelVideos = importedChannels.videos;
        summary.importedChannelArtists = importedChannels.artists;
        summary.importedChannelErrors = importedChannels.errors ?? [];
        summary.apiCalls += importedChannels.apiCalls;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summary.importedChannelErrors.push(message);
        logger.error({ error }, "[youtube-shadow:intraday] catalog import failed; continuing live measurements");
      }
      const reusedStored = await reuseStoredYoutubeSources(client);
      summary.reusedStoredVideos = reusedStored.videos;
      summary.reusedStoredArtists = reusedStored.artists;
      const seededCatalog = await seedApprovedVideoLinksIntoIntradayCatalog(client);
      summary.seededCatalogVideos = seededCatalog.videos;
      summary.seededCatalogArtists = seededCatalog.artists;
      let oldApiCallsRemaining = Math.max(0, dailyBudget() - await callsUsedToday(client));
      const batchStatsUsed = await batchStatsCallsUsedToday(client);
      const rows = await client.query<DueVideoRow>(`
        SELECT * FROM (
          SELECT DISTINCT ON (c.video_id)
            c.video_id, c.artist_key, c.refresh_tier, c.last_observed_at::text,
            v.published_at::text, v.view_count, daily.daily_view_delta,
            EXISTS (
              SELECT 1
              FROM youtube_music_catalog_candidates artist_candidate
              JOIN youtube_video_intraday_shadow_snapshots artist_sample
                ON artist_sample.video_id=artist_candidate.video_id
              WHERE artist_candidate.artist_key=c.artist_key
                AND artist_sample.observed_at >= (
                  date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
                )
                AND artist_sample.observed_at < (
                  date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'
                ) + interval '30 minutes'
            ) artist_has_midnight_anchor
          FROM youtube_music_catalog_candidates c
          JOIN youtube_tracked_videos v ON v.video_id=c.video_id
          LEFT JOIN LATERAL (
            SELECT daily_view_delta FROM youtube_video_daily_snapshots d
            WHERE d.video_id=c.video_id ORDER BY snapshot_date DESC LIMIT 1
          ) daily ON true
          WHERE c.status IN ('verified','review')
            AND c.sampling_status='shadow'
            AND EXISTS (
              SELECT 1
              FROM kworb_coverage roster
              WHERE roster.status='active'
                AND regexp_replace(
                  translate(lower(roster.artist_key), 'áéíóúüñ', 'aeiouun'),
                  '[^a-z0-9]', '', 'g'
                ) = regexp_replace(
                  translate(lower(c.artist_key), 'áéíóúüñ', 'aeiouun'),
                  '[^a-z0-9]', '', 'g'
                )
            )
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
        ORDER BY CASE WHEN $3::boolean AND artist_has_midnight_anchor THEN 1 ELSE 0 END,
                 CASE WHEN $3::boolean THEN
                   row_number() OVER (
                     PARTITION BY artist_key
                     ORDER BY view_count DESC NULLS LAST, video_id
                   )
                 ELSE 1 END,
                 min(last_observed_at) OVER (PARTITION BY artist_key) ASC NULLS FIRST,
                 row_number() OVER (
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
      const allowedBatches = youtubeApiBatchesAllowed({ dailyBudget: 10_000, callsUsed: batchStatsUsed, requestedVideos: fairRows.length });
      if (allowedBatches <= 0 && rows.rows.length) return { ...summary, status: "quota_exhausted" };
      const selected = fairRows.slice(0, allowedBatches * 50);
      summary.requestedVideos = selected.length;

      for (const group of batch(selected, 50)) {
        let stats: VideoStats[];
        let usedBatchStats = true;
        try {
          stats = await fetchYoutubeBatchStats(group.map(row => row.video_id));
        } catch (batchError) {
          if (oldApiCallsRemaining <= 0) throw batchError;
          logger.warn({ error: batchError }, "[youtube-shadow:intraday] batch stats failed; using videos.list fallback");
          stats = await fetchYoutubeVideos(group.map(row => row.video_id));
          usedBatchStats = false;
          oldApiCallsRemaining -= 1;
        }
        const publishedAtById = new Map(group.map(row => [row.video_id, row.published_at]));
        stats = stats.map(item => item.publishedAt ? item : {
          ...item,
          publishedAt: publishedAtById.get(item.videoId) ? new Date(publishedAtById.get(item.videoId)!) : null,
        });
        summary.apiCalls += 1;
        summary.fetched += stats.length;
        summary.missing += group.length - stats.length;
        if (usedBatchStats) await recordBatchStatsUsage(client, group.length, stats.length);
        else await recordUsage(client, group.length, stats.length);
        const tiers = new Map(group.map(row => [row.video_id, row.refresh_tier]));
        summary.saved += await saveObservationsBulk(client, stats, tiers);
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
  if (!youtubeIntradayShadowAutomationEnabled()) {
    logger.info("[youtube-shadow:intraday] disabled by emergency kill switch");
    return;
  }
  const runScheduledCheck = (reason: string) => {
    const eastern = youtubeEasternMidnightAnchor(new Date());
    // Run every five-minute pass in the anchor window. Each pass excludes
    // videos already sampled in that window and prioritizes artists that do
    // not have any midnight sample yet, so the whole roster receives a daily
    // boundary instead of stopping after the first 250-video batch.
    const forceMidnightAnchor = eastern.shouldAnchor;
    void runYoutubeIntradayShadow(
      forceMidnightAnchor ? "eastern-midnight-anchor" : reason,
      false,
      false,
    ).then(summary => {
      logger.info(summary, "[youtube-shadow:intraday] run complete");
      if (!discoveryRunning) {
        discoveryRunning = true;
        void bootstrapActiveCatalog()
          .then(result => logger.info(result, "[youtube-shadow:catalog] discovery pass complete"))
          .catch(error => logger.error({ error }, "[youtube-shadow:catalog] discovery pass failed"))
          .finally(() => { discoveryRunning = false; });
      }
    }).catch(error => {
      logger.error({ error, reason }, "[youtube-shadow:intraday] scheduler invocation failed");
    });
  };
  setTimeout(() => runScheduledCheck("startup"), 1_000).unref();
  setInterval(() => runScheduledCheck("five-minute-check"), CHECK_MS).unref();
  logger.info({ dailyBudget: dailyBudget(), maxVideosPerRun: maxVideosPerRun() }, "[youtube-shadow:intraday] private automation enabled");
}
