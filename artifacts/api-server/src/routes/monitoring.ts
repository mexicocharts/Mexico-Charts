import { MONITORING_COMPARISONS_SQL } from "../lib/monitoring-comparisons";
import { Router, type RequestHandler } from "express";
import { monitoringReadPool } from "@workspace/db";
import {
  listSongstatsCatalogArtists,
} from "../lib/songstats-snapshot-service";
import { buildMonitoringDailyPulse, buildMonitoringNativeSnapshotsSql, mergeMonitoringPlatformHistory } from "../lib/monitoring-daily-pulse";
import { buildSongstatsPublicInsight } from "../lib/songstats-public-service";
import {
  auditMonitoringReadiness,
  getExistingMonitoringArtist,
  getMonitoringReadyArtist,
} from "../lib/monitoring-readiness-service";
import { logger } from "../lib/logger";
import {
  clerkConfigured,
  clerkUserId,
  requireClerkUser,
  safeClerkIdentityHash,
} from "../lib/auth";
import { dedupeYoutubeMonitorRows } from "../lib/youtube-monitor-dedupe";
import {
  loadCompactMonitoringHistoryOverview,
  loadCompactMonitoringMetricHistory,
  loadCompactReleaseImpact,
} from "../lib/songstats-history-serving";
import {
  ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES,
  hasInternalArtistProEntitlement,
} from "../lib/artist-pro-entitlement";
import {
  authorizeMonitoringArtist,
  monitoringAuthorizedSourceKeys,
  type MonitoringArtistGrant,
} from "../lib/monitoring-authorization";
import {
  elapsedMilliseconds,
  requestDatabaseHttpStatus,
  safeDatabaseDiagnostic,
} from "../lib/request-database";
import { createMonitoringWeeklyReport } from "../lib/monitoring-weekly-report";
import { getMonitoringCandidateDirectory, getMonitoringCandidateList } from "../lib/monitoring-candidate-audit";
import { monitoringIdentityKeyCandidates } from "../lib/monitoring-candidate-policy";
import { loadLatestMonitoringStreamSummary, loadMonitoringSpotifyHistory, type MonitoringStreamSummaryRow } from "../lib/monitoring-stream-serving";
import { normalizedMonitoringReleaseTitle } from "../lib/monitoring-artwork";
import { createMonitoringHistoryHandler, isMonitoringHistoryTimeout } from "../lib/monitoring-history-request";
import { monitoringBuildIdentity } from "../lib/monitoring-build";
import { loadCompleteMonitoringKworbCatalog, summarizeMonitoringKworbCatalog } from "../lib/monitoring-kworb-catalog";
import { loadMonitoringPriorityArtistIdentity } from "../lib/monitoring-priority-identity";
import { loadMonitoringYoutubeLiveVideos, loadMonitoringYoutubeDailyHistory } from "../lib/monitoring-youtube-serving";
import { loadMonitoringYoutubeNativeHistory } from "../lib/monitoring-youtube-native-history";
import { createMonitoringYoutubeHistoryHandler } from "../lib/monitoring-youtube-history-request";

const router = Router();
const PRICE_USD_CENTS = 600;
const DASHBOARD_LOAD_BUDGET_MS = 12_000;

const requireMonitoringClerkUser: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  let identityResolved = false;
  requireClerkUser(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }
    identityResolved = true;
    next();
  });
  if (!identityResolved) {
    logger.info(
      {
        event: "artist_pro_monitoring_authorization",
        authenticatedIdentityResolved: false,
        identityHash: null,
        requestedArtistKey:
          String(req.params["artistKey"] ?? "")
            .trim()
            .toLowerCase() || null,
        entitlementSource: "denied",
        artistMatched: false,
        matchedArtistKey: null,
        publicReadinessEvaluated: false,
        publicReadinessReady: null,
        authorizationOutcome: "identity_denied",
      },
      "Artist Pro monitoring identity denied",
    );
  }
};

type MonitoringSnapshotRow = {
  snapshot_date: string;
  spotify_followers: string | number | null;
  spotify_monthly_listeners: string | number | null;
  spotify_popularity: string | number | null;
  youtube_subscribers: string | number | null;
  youtube_channel_views: string | number | null;
  instagram_followers: string | number | null;
  tiktok_followers: string | number | null;
  facebook_followers: string | number | null;
  twitter_followers: string | number | null;
  soundcloud_followers: string | number | null;
  deezer_followers: string | number | null;
};

function nullableNumber(value: string | number | null): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function kworbTrackArtwork(
  value: unknown,
): Array<{ title: string; artworkUrl: string }> {
  if (!value || typeof value !== "object") return [];
  const topTracks = (value as Record<string, unknown>)["topTracks"];
  if (!Array.isArray(topTracks)) return [];
  return topTracks.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const title = typeof row["title"] === "string" ? row["title"].trim() : "";
    const artworkUrl =
      typeof row["coverUrl"] === "string" ? row["coverUrl"].trim() : "";
    return title && /^https?:\/\//i.test(artworkUrl)
      ? [{ title, artworkUrl }]
      : [];
  });
}

function normalizedSnapshot(row: MonitoringSnapshotRow) {
  return {
    date: row.snapshot_date,
    spotifyFollowers: nullableNumber(row.spotify_followers),
    spotifyMonthlyListeners: nullableNumber(row.spotify_monthly_listeners),
    spotifyPopularity: nullableNumber(row.spotify_popularity),
    youtubeSubscribers: nullableNumber(row.youtube_subscribers),
    youtubeChannelViews: nullableNumber(row.youtube_channel_views),
    instagramFollowers: nullableNumber(row.instagram_followers),
    tiktokFollowers: nullableNumber(row.tiktok_followers),
    facebookFollowers: nullableNumber(row.facebook_followers),
    twitterFollowers: nullableNumber(row.twitter_followers),
    soundcloudFollowers: nullableNumber(row.soundcloud_followers),
    deezerFollowers: nullableNumber(row.deezer_followers),
  };
}


async function resolveMonitoringAccess(
  userId: string,
  requestedArtistKey: string,
) {
  const lookupKeys = [...new Set([requestedArtistKey.trim().toLowerCase(), ...monitoringIdentityKeyCandidates(requestedArtistKey)].filter(Boolean))];
  const identities = new Map<string, Promise<MonitoringArtistGrant | null>>();
  const findExistingArtist = (artistKey: string) => {
    if (!identities.has(artistKey)) identities.set(artistKey, getExistingMonitoringArtist(artistKey).then(artist => artist ? {
      artist_key: artist.artistKey, artist_name: artist.artistName, status: "internal", created_at: null,
      match_keys: artist.matchKeys, identity_conflict: artist.identityConflict,
    } : null));
    return identities.get(artistKey)!;
  };
  const authorization = await authorizeMonitoringArtist({
    userId,
    requestedArtistKey,
    findActiveSubscription: async () => {
      const readSubscription = async (keys: string[]) => monitoringReadPool.query<MonitoringArtistGrant>(
          `
        SELECT artist_key, artist_name, status, created_at
        FROM monitoring_subscriptions
        WHERE clerk_user_id = $1
          AND (
            lower(artist_key) = ANY($2::text[])
            OR (
              length(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun')) =
                octet_length(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'))
              AND regexp_replace(
                translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'),
                '[^a-z0-9]', '', 'g'
              ) = ANY($4::text[])
            )
          )
          AND status = ANY($3::text[])
        ORDER BY updated_at DESC
        LIMIT 1
      `,
          [userId, keys, ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES, keys.filter(key => /^[a-z0-9]+$/.test(key))],
        );
      const direct = (await readSubscription(lookupKeys)).rows[0];
      if (direct) return direct;
      // A viewer with no paid grant cannot benefit from alias resolution. Deny
      // before reading source identities, including when those reads would fail.
      const activeViewerGrant = await monitoringReadPool.query<{ found: number }>(
        `SELECT 1 AS found FROM monitoring_subscriptions
         WHERE clerk_user_id = $1 AND status = ANY($2::text[])
         LIMIT 1`,
        [userId, ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES],
      );
      if (!activeViewerGrant.rows.length) return null;
      // A stored paid key may differ from the route's accepted registry alias.
      // Resolve only trusted identity edges; user and active-status predicates
      // remain mandatory on the second artist-specific subscription read.
      const identity = await findExistingArtist(requestedArtistKey);
      if (!identity) return null;
      const acceptedKeys = identity.identity_conflict ? [identity.artist_key]
        : [identity.artist_key, ...(identity.match_keys ?? [])];
      const acceptedLookupKeys = [...new Set(acceptedKeys.flatMap(key =>
        [key.trim().toLowerCase(), ...monitoringIdentityKeyCandidates(key)]).filter(Boolean))];
      return (await readSubscription(acceptedLookupKeys)).rows[0] ?? null;
    },
    findExistingArtist,
  });
  const active = authorization.grant;
  logger.info(
    {
      event: "artist_pro_monitoring_authorization",
      authenticatedIdentityResolved: Boolean(userId),
      identityHash: userId ? safeClerkIdentityHash(userId) : null,
      requestedArtistKey,
      requestedCompactKey: lookupKeys.at(-1) ?? null,
      entitlementSource: authorization.source ?? "denied",
      artistMatched: Boolean(active),
      matchedArtistKey: active?.artist_key ?? null,
      publicReadinessEvaluated: authorization.publicReadinessEvaluated,
      publicReadinessReady: null,
      authorizationOutcome: authorization.outcome,
    },
    "Artist Pro monitoring authorization evaluated",
  );
  return authorization;
}

async function loadAuthorizedMonitoring(
  userId: string,
  requestedArtistKey: string,
) {
  const dashboardLoadStartedAt = performance.now();
  const authorization = await resolveMonitoringAccess(userId, requestedArtistKey);
  const active = authorization.grant;
  if (!authorization.allowed || !active) return null;
  const activeKeys = monitoringAuthorizedSourceKeys(active, monitoringIdentityKeyCandidates);
  const sectionStatus: Record<
    string,
    "loaded" | "failed" | "timeout" | "budget_exhausted"
  > = {};
  const dashboardStage = async <T>(
    stage: string,
    load: () => Promise<T>,
    fallback: T,
    maxStageDurationMs?: number,
  ): Promise<T> => {
    const startedAt = performance.now();
    const remainingDashboardBudgetMs = Math.min(
      DASHBOARD_LOAD_BUDGET_MS - elapsedMilliseconds(dashboardLoadStartedAt),
      maxStageDurationMs ?? Number.POSITIVE_INFINITY,
    );
    if (remainingDashboardBudgetMs <= 0) {
      sectionStatus[stage] = "budget_exhausted";
      logger.warn(
        {
          event: "monitoring_dashboard_stage",
          stage,
          outcome: "budget_exhausted",
          durationMs: 0,
        },
        "Monitoring dashboard budget exhausted; skipping optional section",
      );
      return fallback;
    }
    let timeout: NodeJS.Timeout | undefined;
    let settled = false;
    const loaded = load()
      .then((value) => {
        if (settled) return fallback;
        sectionStatus[stage] = "loaded";
        logger.info(
          {
            event: "monitoring_dashboard_stage",
            stage,
            outcome: "loaded",
            durationMs: elapsedMilliseconds(startedAt),
          },
          "Monitoring dashboard stage completed",
        );
        return value;
      })
      .catch((error) => {
        if (settled) return fallback;
        sectionStatus[stage] = "failed";
        logger.warn(
          {
            event: "monitoring_dashboard_stage",
            stage,
            outcome: "unavailable",
            durationMs: elapsedMilliseconds(startedAt),
            database: safeDatabaseDiagnostic(error),
          },
          "Monitoring dashboard stage unavailable; using an empty section",
        );
        return fallback;
      });
    const timedOut = new Promise<T>((resolve) => {
      timeout = setTimeout(() => {
        sectionStatus[stage] = "timeout";
        logger.warn(
          {
            event: "monitoring_dashboard_stage",
            stage,
            outcome: "timeout",
            durationMs: elapsedMilliseconds(startedAt),
            pool: {
              total: monitoringReadPool.totalCount,
              idle: monitoringReadPool.idleCount,
              waiting: monitoringReadPool.waitingCount,
            },
          },
          "Monitoring dashboard stage timed out; using an empty section",
        );
        resolve(fallback);
      }, remainingDashboardBudgetMs);
    });
    const result = await Promise.race([loaded, timedOut]);
    settled = true;
    if (timeout) clearTimeout(timeout);
    return result;
  };

  // Start the paid Spotify catalog before optional licensed/audience work. The
  // previous global budget could expire while waiting on Songstats or YouTube,
  // leaving an already-populated stream archive invisible to subscribers.
  const priorityArtistIdentity = dashboardStage(
    "priority_artist_identity",
    () => loadMonitoringPriorityArtistIdentity(monitoringReadPool, activeKeys, {
      identityConflict: active.identity_conflict === true,
      canonicalArtistKey: active.artist_key,
    }),
    [],
  );
  const priorityStreamSummary = dashboardStage(
    "priority_stream_summary",
    () => loadLatestMonitoringStreamSummary(monitoringReadPool, activeKeys, {
      deadlineAt: Date.now() + Math.max(0, DASHBOARD_LOAD_BUDGET_MS - elapsedMilliseconds(dashboardLoadStartedAt)),
    }),
    [],
  );
  const priorityStreamItems = dashboardStage(
    "priority_stream_items",
    () =>
      monitoringReadPool
        .query<{
          item_type: "track" | "album";
          item_key: string;
          title: string;
          spotify_url: string | null;
          artwork_url: string | null;
          compilation: boolean;
          total_streams: string | number;
          daily_streams: string | number;
        }>(
          `
    WITH latest_date AS (
      SELECT max(snapshot_date) snapshot_date
      FROM monitoring_stream_daily_snapshots
      WHERE lower(artist_key) = ANY($1::text[])
    )
    SELECT i.item_type, i.item_key, i.title, i.spotify_url,
           to_jsonb(i)->>'artwork_url' artwork_url,
           i.compilation,
           s.total_streams, s.daily_streams
    FROM monitoring_stream_items i
    JOIN latest_date d ON true
    JOIN monitoring_stream_daily_snapshots s
      ON s.artist_key=i.artist_key
     AND s.item_type=i.item_type
     AND s.item_key=i.item_key
     AND s.snapshot_date=d.snapshot_date
    WHERE lower(i.artist_key) = ANY($1::text[])
    ORDER BY i.item_type, s.daily_streams DESC, s.total_streams DESC, i.title
  `,
          [activeKeys],
        )
        .then((result) => result.rows),
    [],
  );
  const prioritySpotifyHistory = dashboardStage(
    "priority_spotify_history",
    () => loadMonitoringSpotifyHistory(monitoringReadPool, activeKeys),
    [],
  );
  const prioritySpotifySnapshot = dashboardStage(
    "priority_spotify_snapshot",
    () =>
      monitoringReadPool
        .query<{
          value: unknown;
        }>(
          `
    SELECT value
    FROM kworb_snapshots
    WHERE lower(artist_key) = ANY($1::text[])
      AND metric_type='spotify'
    ORDER BY fetched_at DESC
    LIMIT 1
  `,
          [activeKeys],
        )
        .then((result) => result.rows),
    [],
  );
  const priorityStoredTrackArtwork = dashboardStage(
    "priority_stored_track_artwork",
    () =>
      monitoringReadPool
        .query<{
          song_title: string;
          cover_url: string;
        }>(
          `
    SELECT song_title, cover_url
    FROM deezer_track_covers
    WHERE regexp_replace(
      translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]', '', 'g'
    ) = ANY($1::text[])
      AND COALESCE(cover_url, '') <> ''
  `,
          [activeKeys],
        )
        .then((result) => result.rows),
    [],
  );
  const priorityComparisonRows = dashboardStage(
    "priority_comparisons",
    () =>
      monitoringReadPool
        .query<{
          artist_key: string;
          artist_name: string;
          avatar_url: string | null;
          historic_stats: unknown;
          snapshot_date: string;
          spotify_monthly_listeners: string | number | null;
          youtube_channel_views: string | number | null;
          instagram_followers: string | number | null;
        }>(
          MONITORING_COMPARISONS_SQL,
          [activeKeys, new Date().toISOString()],
        )
        .then((result) => result.rows),
    [],
    1_500,
  );
  const prioritySnapshots = dashboardStage(
    "priority_daily_snapshots",
    () =>
      monitoringReadPool
        .query<MonitoringSnapshotRow>(
          buildMonitoringNativeSnapshotsSql("$1::text[]"),
          [activeKeys],
        )
        .then((result) => result.rows),
    [],
  );

  // Resolve the core dashboard and Spotify catalog before attempting the
  // heavier YouTube enrichment. A slow video query must never erase already
  // stored audience history from the response.
  const [
    prioritizedArtistIdentity,
    prioritizedStreamSummary,
    prioritizedStreamItems,
    spotifyHistory,
    spotifySnapshots,
    storedTrackArtwork,
    comparisonRows,
    snapshots,
  ] = await Promise.all([
    priorityArtistIdentity,
    priorityStreamSummary,
    priorityStreamItems,
    prioritySpotifyHistory,
    prioritySpotifySnapshot,
    priorityStoredTrackArtwork,
    priorityComparisonRows,
    prioritySnapshots,
  ]);

  let resolvedStreamItems: Array<Omit<(typeof prioritizedStreamItems)[number], "total_streams" | "daily_streams"> & {
    total_streams: string | number | null; daily_streams: string | number | null;
  }> = prioritizedStreamItems;
  let resolvedStreamSummary: Array<Omit<MonitoringStreamSummaryRow,
    "source_table" | "derivation" | "track_daily_streams" | "album_daily_streams" | "track_total_streams" | "album_total_streams"
  > & {
    source_table: string; derivation: string;
    track_daily_streams: string | number | null; album_daily_streams: string | number | null;
    track_total_streams: string | number | null; album_total_streams: string | number | null;
  }> = prioritizedStreamSummary;
  let spotifyCatalogSource:
    | "archive"
    | "kworb_live_complete_catalog"
    | "unavailable" = resolvedStreamItems.length ? "archive" : "unavailable";
  if (prioritizedArtistIdentity[0]?.spotify_artist_id) {
    const completeCatalog = await dashboardStage(
      "complete_kworb_catalog",
      () =>
        loadCompleteMonitoringKworbCatalog(
          prioritizedArtistIdentity[0]!.spotify_artist_id!,
        ),
      null,
      8_500,
    );
    if (completeCatalog) {
      spotifyCatalogSource = completeCatalog.source;
      resolvedStreamItems = completeCatalog.items.map((item) => ({
        item_type: item.type,
        item_key: item.key,
        title: item.title,
        spotify_url: item.spotifyUrl,
        artwork_url: item.artworkUrl,
        compilation: item.compilation,
        total_streams: item.totalStreams,
        daily_streams: item.dailyStreams,
      }));
      const totals = summarizeMonitoringKworbCatalog(completeCatalog.items);
      resolvedStreamSummary = [
        {
          snapshot_date: completeCatalog.fetchedAt.slice(0, 10),
          track_count: totals.trackCount,
          album_count: totals.albumCount,
          track_daily_streams: totals.trackDailyStreams,
          album_daily_streams: totals.albumDailyStreams,
          track_total_streams: totals.trackTotalStreams,
          album_total_streams: totals.albumTotalStreams,
          fetched_at: completeCatalog.fetchedAt,
          source_table: "kworb_live_complete_catalog",
          source_artist_keys: [active.artist_key],
          derivation: "sum_catalog_items",
          recovery_reason: null,
        },
      ];
    }
  }

  const prioritizedLiveVideos = await dashboardStage(
    "priority_youtube_live_videos",
    () => loadMonitoringYoutubeLiveVideos(monitoringReadPool, activeKeys, {
      deadlineAt: Date.now() + Math.max(0, DASHBOARD_LOAD_BUDGET_MS - elapsedMilliseconds(dashboardLoadStartedAt)),
    }),
    [],
    1_500,
  );

  const extended = await dashboardStage(
    "extended_artist_data",
    () =>
      monitoringReadPool
        .query<{
          historic_stats: unknown;
          audience: unknown;
          audience_details: unknown;
          catalog: unknown;
        }>(
          `
      SELECT historic_stats, audience, audience_details, catalog
      FROM songstats_artist_extended_data
      WHERE lower(artist_key) = ANY($1::text[])
      ORDER BY updated_at DESC
      LIMIT 1
    `,
          [activeKeys],
        )
        .then((result) => result.rows),
    [],
    1_000,
  );
  const liveVideoHistory = await dashboardStage(
    "youtube_live_history",
    () => loadMonitoringYoutubeDailyHistory(monitoringReadPool, activeKeys, {
      includeCandidateOnly: authorization.source === "internal",
      deadlineAt: Date.now() + Math.max(0, DASHBOARD_LOAD_BUDGET_MS - elapsedMilliseconds(dashboardLoadStartedAt)),
    }),
    [],
  );
  const [youtubeCoverage, availableHistory] = await Promise.all([
    dashboardStage(
      "youtube_coverage",
      () =>
        monitoringReadPool
          .query<{
            channel_video_count: string | number | null;
            videos_imported: string | number | null;
            expected_total_videos: string | number | null;
            import_status: "complete" | "retryable" | null;
            next_page_token: string | null;
            completed_at: string | null;
            linked_video_count: string | number;
            observed_video_count: string | number;
          }>(
            `
      WITH selected_links AS MATERIALIZED (
        SELECT link.video_id, link.confidence_score
        FROM youtube_artist_video_links link
        WHERE link.active=true
          AND link.artist_key = ANY($1::text[])
      ), counts AS (
        SELECT count(DISTINCT link.video_id) linked_video_count,
               count(DISTINCT link.video_id) FILTER (
                 WHERE link.confidence_score >= 80 AND sample.video_id IS NOT NULL
               ) observed_video_count
        FROM selected_links link
        LEFT JOIN youtube_video_intraday_latest_observations sample ON sample.video_id=link.video_id
      )
      SELECT
        yc.video_count channel_video_count,
        import_state.videos_imported,
        import_state.expected_total_videos,
        import_state.status import_status,
        import_state.next_page_token,
        import_state.completed_at::text,
        counts.linked_video_count,
        counts.observed_video_count
      FROM youtube_channels yc
      CROSS JOIN counts
      LEFT JOIN youtube_channel_upload_import_state import_state
        ON import_state.artist_key=yc.artist_key
      WHERE lower(yc.artist_key) = ANY($1::text[])
      LIMIT 1
    `,
            [activeKeys],
          )
          .then((result) => result.rows),
      [],
    ),
    dashboardStage(
      "compact_history_overview",
      () =>
        loadCompactMonitoringHistoryOverview(
          active.artist_key,
          monitoringReadPool,
          undefined,
          activeKeys,
        ),
      {
        artistKey: active.artist_key,
        historyLabel: "Songstats available daily history",
        metricCount: 0,
        availableMetricCount: 0,
        unavailableMetricCount: 0,
        metrics: [],
        transport: {
          initialPointsIncluded: 0,
          exactDailyEndpoint: "/api/monitoring/history/:artistKey/:metricKey",
          multiYearDisplayMethod: "deterministic_min_max_bucket_v1",
        },
        queryLatencyMs: 8_000,
      },
    ),
  ]);
  const resolvedLiveVideos = prioritizedLiveVideos;
  const extendedRow = extended[0];
  const insight = extendedRow
    ? buildSongstatsPublicInsight(
        {
          historicStats: extendedRow.historic_stats,
          audience: extendedRow.audience,
          audienceDetails: extendedRow.audience_details,
          catalog: extendedRow.catalog,
        },
        { access: "monitoring" },
      )
    : null;
  const history = snapshots.map(normalizedSnapshot);
  const catalog = insight?.catalog ?? {
    releaseCount: 0,
    trackCount: 0,
    albumCount: 0,
    releasesLast90Days: 0,
    medianReleaseGapDays: null,
    newestReleaseDate: null,
    releases: [],
  };
  const latestStreamSummary = resolvedStreamSummary[0] ?? null;
  const releaseArtwork = new Map(
    catalog.releases
      .filter((release) => release.artworkUrl)
      .map((release) => [
        normalizedMonitoringReleaseTitle(release.title),
        release.artworkUrl,
      ]),
  );
  for (const track of kworbTrackArtwork(spotifySnapshots[0]?.value)) {
    const key = normalizedMonitoringReleaseTitle(track.title);
    if (!releaseArtwork.has(key)) releaseArtwork.set(key, track.artworkUrl);
  }
  for (const track of storedTrackArtwork) {
    const key = normalizedMonitoringReleaseTitle(track.song_title);
    if (key && !releaseArtwork.has(key))
      releaseArtwork.set(key, track.cover_url);
  }
  const youtubeCoverageRow = youtubeCoverage[0] ?? null;
  const youtubeChannelVideoCount = nullableNumber(
    youtubeCoverageRow?.channel_video_count ??
      youtubeCoverageRow?.expected_total_videos ??
      null,
  );
  const releaseImpact = await dashboardStage(
    "release_impact",
    () =>
      catalog.newestReleaseDate
        ? loadCompactReleaseImpact({
            artistKey: active.artist_key,
            artistKeys: activeKeys,
            releaseDate: catalog.newestReleaseDate,
            queryable: monitoringReadPool,
            overview: availableHistory,
            deadlineAt: Date.now() + Math.max(0, DASHBOARD_LOAD_BUDGET_MS - elapsedMilliseconds(dashboardLoadStartedAt)),
          })
        : Promise.resolve(null),
    null,
  );
  const completeHistory = mergeMonitoringPlatformHistory(history, insight?.trends ?? {});
  const comparisonArtists = comparisonRows.map((row) => {
    const comparisonInsight = buildSongstatsPublicInsight(
      {
        historicStats: row.historic_stats,
        audience: null,
        audienceDetails: null,
      },
      { access: "monitoring" },
    );
    return {
      artistKey: row.artist_key,
      artistName: comparisonInsight.name ?? row.artist_name,
      artistImageUrl: comparisonInsight.avatarUrl ?? row.avatar_url,
      snapshotDate: row.snapshot_date,
      spotifyMonthlyListeners: nullableNumber(row.spotify_monthly_listeners),
      spotifyGrowth30:
        comparisonInsight.growth.spotifyMonthlyListeners?.days30 ?? null,
      youtubeChannelViews: nullableNumber(row.youtube_channel_views),
      youtubeGrowth30:
        comparisonInsight.growth.youtubeChannelViews?.days30 ?? null,
      instagramFollowers: nullableNumber(row.instagram_followers),
    };
  });
  return {
    sectionStatus,
    identityDiagnostics: authorization.source === "internal" ? {
      canonicalArtistKey: active.artist_key,
      sourceKeys: activeKeys,
      conflict: active.identity_conflict === true || prioritizedArtistIdentity[0]?.identity_conflict === true,
      warnings: active.identity_conflict || prioritizedArtistIdentity[0]?.identity_conflict ? ["conflicting_provider_identity"] : [],
      priorityIdentity: prioritizedArtistIdentity[0] ?? null,
    } : undefined,
    subscription: {
      artistKey: active.artist_key,
      artistName: insight?.name ?? active.artist_name,
      artistImageUrl:
        prioritizedArtistIdentity[0]?.avatar_url ?? insight?.avatarUrl ?? null,
      status: active.status,
      activatedAt: active.created_at?.toISOString() ?? null,
      accessSource: authorization.source,
    },
    current: completeHistory.at(-1) ?? null,
    history: completeHistory,
    dailyPulse: buildMonitoringDailyPulse(completeHistory, catalog),
    growth: insight?.growth ?? {},
    topMexicoCities: insight?.topMexicoCities ?? [],
    catalog,
    latestReleaseImpact: releaseImpact,
    availableHistory,
    liveVideos: dedupeYoutubeMonitorRows(
      resolvedLiveVideos as Array<{
        video_id: string;
        canonical_url?: string | null;
      }>,
    ),
    youtubeCoverage: {
      channelVideoCount: youtubeChannelVideoCount,
      importedVideoCount:
        nullableNumber(youtubeCoverageRow?.videos_imported ?? null) ?? 0,
      linkedVideoCount:
        nullableNumber(youtubeCoverageRow?.linked_video_count ?? null) ?? 0,
      observedVideoCount:
        nullableNumber(youtubeCoverageRow?.observed_video_count ?? null) ?? 0,
      importStatus: youtubeCoverageRow?.import_status ?? "pending",
      complete: Boolean(
        youtubeCoverageRow?.import_status === "complete" &&
        youtubeCoverageRow?.completed_at &&
        !youtubeCoverageRow?.next_page_token,
      ),
    },
    liveVideoHistory,
    comparisonArtists,
    reportCapabilities: {
      weeklyPdf: true,
      monthlyPdf: false,
      weeklyEmail: false,
      csvExport: false,
    },
    spotifyCatalog: {
      source: spotifyCatalogSource,
      summaryProvenance: latestStreamSummary ? {
        source: latestStreamSummary.source_table,
        derivation: latestStreamSummary.derivation,
        recoveryReason: latestStreamSummary.recovery_reason,
        fetchedAt: latestStreamSummary.fetched_at,
        sourceArtistKeys: latestStreamSummary.source_artist_keys,
      } : null,
      snapshotDate: latestStreamSummary?.snapshot_date ?? null,
      trackCount: latestStreamSummary?.track_count ?? 0,
      albumCount: latestStreamSummary?.album_count ?? 0,
      trackDailyStreams: nullableNumber(
        latestStreamSummary?.track_daily_streams ?? null,
      ),
      albumDailyStreams: nullableNumber(
        latestStreamSummary?.album_daily_streams ?? null,
      ),
      trackTotalStreams: nullableNumber(
        latestStreamSummary?.track_total_streams ?? null,
      ),
      albumTotalStreams: nullableNumber(
        latestStreamSummary?.album_total_streams ?? null,
      ),
      history: spotifyHistory.map((point) => ({
        date: point.snapshot_date,
        totalStreams: nullableNumber(point.total_streams),
        dailyStreams: nullableNumber(point.daily_streams),
        source: point.source_type,
        sourceArtistKey: point.source_artist_key,
        fetchedAt: point.fetched_at,
      })),
      items: resolvedStreamItems.map((item) => ({
        type: item.item_type,
        key: item.item_key,
        title: item.title,
        spotifyUrl: item.spotify_url,
        artworkUrl:
          item.artwork_url ??
          releaseArtwork.get(normalizedMonitoringReleaseTitle(item.title)) ??
          null,
        compilation: item.compilation,
        totalStreams: nullableNumber(item.total_streams),
        dailyStreams: nullableNumber(item.daily_streams),
      })),
    },
  };
}

function siteOrigin(): string {
  return (process.env["PUBLIC_SITE_URL"] ?? "https://mexicochart.com").replace(
    /\/$/,
    "",
  );
}

function stripeSecret(): string {
  return (process.env["STRIPE_SECRET_KEY"] ?? "").trim();
}

function paidMonitoringEnabled(): boolean {
  return (
    process.env["PAID_MONITORING_ENABLED"]?.trim().toLowerCase() === "true"
  );
}

function safeLanguage(raw: unknown): "es" | "en" {
  return String(raw ?? "es").toLowerCase() === "en" ? "en" : "es";
}

router.get("/monitoring/config", (_req, res) => {
  res.json({
    checkoutEnabled:
      paidMonitoringEnabled() && Boolean(stripeSecret()) && clerkConfigured(),
    accountsEnabled: clerkConfigured(),
    priceUsdCents: PRICE_USD_CENTS,
    delivery: "daily_dashboard",
  });
});

// Resolve the existing founder entitlement without account upserts or billing
// reads. /monitoreo navigation must not wait for a collector's database pool.
router.get("/monitoring/access", requireMonitoringClerkUser, (_req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ internalArtistProAccess: hasInternalArtistProEntitlement(clerkUserId(res)) });
});

router.get("/monitoring/artists", async (_req, res) => {
  const totalStartedAt = performance.now();
  try {
    const audit = await auditMonitoringReadiness({
      readyOnly: true,
      onDiagnostic: (diagnostic) => {
        _req.log[
          diagnostic.outcome === "timeout_or_unavailable" ? "warn" : "info"
        ](
          {
            event: "monitoring_readiness_timing",
            ...diagnostic,
          },
          "Monitoring readiness stage completed",
        );
      },
    });
    res.json({
      policyVersion: audit.policyVersion,
      count: audit.ready.length,
      artists: audit.ready.map((artist) => ({
        artistKey: artist.artistKey,
        artistName: artist.artistName,
        matchKeys: artist.matchKeys,
      })),
    });
  } catch (error) {
    _req.log.warn(
      {
        event: "monitoring_readiness_failure",
        stage: "monitoring_artists",
        durationMs: elapsedMilliseconds(totalStartedAt),
        database: safeDatabaseDiagnostic(error),
      },
      "Monitoring artist availability failed",
    );
    res
      .status(503)
      .json({ error: "Monitoring availability is temporarily unavailable" });
  }
});

const requireMonitoringFounder: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!hasInternalArtistProEntitlement(clerkUserId(res))) {
    res.status(403).json({ error: "Founder inspection access is required", code: "founder_access_required" });
    return;
  }
  next();
};

router.get("/monitoring/internal/build", requireMonitoringClerkUser, requireMonitoringFounder, (_req, res) => {
  res.json(monitoringBuildIdentity());
});

router.get(
  "/monitoring/internal/artists",
  requireMonitoringClerkUser,
  requireMonitoringFounder,
  async (_req, res) => {
    try { res.json(await getMonitoringCandidateList()); }
    catch (error) {
      logger.warn({ event: "monitoring_candidate_list_failure", database: safeDatabaseDiagnostic(error) }, "Monitoring candidate directory failed");
      res.status(requestDatabaseHttpStatus(error)).json({ error: "The artist directory is temporarily unavailable", code: "candidate_directory_failed" });
    }
  },
);

router.get(
  "/monitoring/internal/directory",
  requireMonitoringClerkUser,
  requireMonitoringFounder,
  async (req, res) => {
    const limit = Number(req.query.limit ?? 25);
    const offset = Number(req.query.offset ?? 0);
    const search = String(req.query.search ?? "").trim();
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0 || search.length > 160) {
      res.status(400).json({ error: "Invalid directory page or search", code: "invalid_directory_request" });
      return;
    }
    try { res.json(await getMonitoringCandidateDirectory({ limit, offset, search })); }
    catch (error) {
      logger.warn({ event: "monitoring_founder_audit_failure", database: safeDatabaseDiagnostic(error) }, "Founder evidence audit failed");
      res.status(requestDatabaseHttpStatus(error)).json({ error: "The evidence audit could not complete. Source absence has not been established.", code: "candidate_audit_failed" });
    }
  },
);

router.get(
  "/monitoring/dashboard/:artistKey",
  requireMonitoringClerkUser,
  async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const artistKey = String(req.params.artistKey ?? "")
      .trim()
      .toLowerCase();
    if (!artistKey || artistKey.length > 160) {
      res.status(400).json({ error: "A valid artist key is required" });
      return;
    }
    try {
      const dashboard = await loadAuthorizedMonitoring(
        clerkUserId(res),
        artistKey,
      );
      if (!dashboard) {
        res
          .status(403)
          .json({ error: "Artist Pro access is required for this artist" });
        return;
      }
      res.json(dashboard);
    } catch (error) {
      const status = requestDatabaseHttpStatus(error);
      const unavailable = status === 503;
      logger[unavailable ? "warn" : "error"](
        {
          event: "monitoring_dashboard_failure",
          artistKey,
          database: safeDatabaseDiagnostic(error),
        },
        "Monitoring dashboard failed",
      );
      res.status(status).json({
        error: unavailable
          ? "Monitoring is temporarily unavailable"
          : "Unable to load monitoring dashboard",
      });
    }
  },
);

router.get(
  "/monitoring/videos/:artistKey/:videoId/history",
  requireMonitoringClerkUser,
  createMonitoringYoutubeHistoryHandler({
    userId: clerkUserId,
    authorize: resolveMonitoringAccess,
    aliases: monitoringIdentityKeyCandidates,
    read: (input) => loadMonitoringYoutubeNativeHistory({ ...input, queryable: monitoringReadPool }),
    failure: (error) => {
      const detail = safeDatabaseDiagnostic(error);
      return isMonitoringHistoryTimeout(error) ? { status: 504, code: "monitoring_timeout" }
        : { status: requestDatabaseHttpStatus(error), code: detail.unavailable ? "monitoring_unavailable" : "monitoring_backend_failure" };
    },
    diagnostic: (event) => logger.info({ event: "monitoring_youtube_history_request", ...event }, "Monitoring video history request completed"),
  }),
);

router.get(
  "/monitoring/history/:artistKey/:metricKey",
  requireMonitoringClerkUser,
  createMonitoringHistoryHandler({
    userId: clerkUserId,
    authorize: resolveMonitoringAccess,
    aliases: monitoringIdentityKeyCandidates,
    read: (input) => loadCompactMonitoringMetricHistory({ ...input, queryable: monitoringReadPool }),
    failure: (error) => {
      const detail = safeDatabaseDiagnostic(error);
      const timeout = isMonitoringHistoryTimeout(error);
      return timeout ? { status: 504, code: "monitoring_timeout" }
        : { status: requestDatabaseHttpStatus(error), code: detail.unavailable ? "monitoring_unavailable" : "monitoring_backend_failure" };
    },
    diagnostic: (event) => logger.info({ event: "monitoring_history_request", ...event }, "Monitoring history request completed"),
  }),
);

router.get(
  "/monitoring/report/:artistKey",
  requireMonitoringClerkUser,
  async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const artistKey = String(req.params.artistKey ?? "")
      .trim()
      .toLowerCase();
    const weekEnd = String(req.query.weekEnd ?? "").trim();
    if (
      !artistKey ||
      artistKey.length > 160 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd) ||
      !Number.isFinite(Date.parse(`${weekEnd}T12:00:00Z`)) ||
      new Date(`${weekEnd}T12:00:00Z`).toISOString().slice(0, 10) !== weekEnd
    ) {
      res
        .status(400)
        .json({ error: "A valid artist and week end date are required" });
      return;
    }
    try {
      const dashboard = await loadAuthorizedMonitoring(
        clerkUserId(res),
        artistKey,
      );
      if (!dashboard) {
        res
          .status(403)
          .json({ error: "Artist Pro access is required for this artist" });
        return;
      }
      if (weekEnd !== dashboard.history.at(-1)?.date) {
        res.status(409).json({
          error:
            "Este período requiere un corte histórico completo de catálogos, videos y mercados. No se sustituye por cifras actuales.",
        });
        return;
      }
      const pdf = await createMonitoringWeeklyReport({
        artistName: dashboard.subscription.artistName,
        artistKey: dashboard.subscription.artistKey,
        weekEnd,
        artistImageUrl: dashboard.subscription.artistImageUrl,
        generatedAt: new Date(),
        history: dashboard.history,
        spotifyCatalog: dashboard.spotifyCatalog,
        liveVideos: dashboard.liveVideos,
        topMexicoCities: dashboard.topMexicoCities,
        dailyPulse: dashboard.dailyPulse,
        spotifyHistory: dashboard.spotifyCatalog.history,
        liveVideoHistory: dashboard.liveVideoHistory,
        comparisonArtists: dashboard.comparisonArtists,
      });
      const safeArtist =
        dashboard.subscription.artistName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "artist";
      res.setHeader("content-type", "application/pdf");
      res.setHeader(
        "content-disposition",
        `attachment; filename="mexico-charts-reporte-semanal-${safeArtist}-${weekEnd}.pdf"`,
      );
      res.setHeader("cache-control", "private, no-store");
      res.send(pdf);
    } catch (error) {
      const status = requestDatabaseHttpStatus(error);
      const unavailable = status === 503;
      logger[unavailable ? "warn" : "error"](
        {
          event: "monitoring_report_failure",
          artistKey,
          weekEnd,
          database: safeDatabaseDiagnostic(error),
        },
        "Monitoring report failed",
      );
      res.status(status).json({
        error: unavailable
          ? "Monitoring is temporarily unavailable"
          : "Unable to generate monitoring report",
      });
    }
  },
);

router.post("/monitoring/checkout", requireClerkUser, async (req, res) => {
  const artistKey = String(req.body?.artistKey ?? "")
    .trim()
    .toLowerCase();
  const requestedName = String(req.body?.artistName ?? "").trim();
  const language = safeLanguage(req.body?.language);
  const secret = stripeSecret();
  const userId = clerkUserId(res);

  if (!paidMonitoringEnabled()) {
    res.status(503).json({
      error: "Paid monitoring is not available yet",
      code: "paid_monitoring_disabled",
    });
    return;
  }

  if (!secret) {
    res.status(503).json({
      error: "Payments are not configured yet",
      code: "payments_not_configured",
    });
    return;
  }
  if (!artistKey || artistKey.length > 160) {
    res.status(400).json({ error: "A valid artistKey is required" });
    return;
  }

  try {
    const [catalogArtist] = await listSongstatsCatalogArtists({
      limit: 1,
      artistKeys: [artistKey],
    });
    if (!catalogArtist) {
      res.status(404).json({ error: "Artist is not available for monitoring" });
      return;
    }
    const readyArtist = await getMonitoringReadyArtist(catalogArtist.artistKey);
    if (!readyArtist) {
      res.status(409).json({
        error:
          "This artist does not currently meet the complete monitoring-data standard",
        code: "monitoring_not_ready",
      });
      return;
    }

    const artistName =
      catalogArtist.spotifyName?.trim() || requestedName || artistKey;
    const origin = siteOrigin();
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set(
      "success_url",
      `${origin}/monitoreo/exito?session_id={CHECKOUT_SESSION_ID}&lang=${language}`,
    );
    params.set(
      "cancel_url",
      `${origin}/monitoreo?artist=${encodeURIComponent(artistKey)}&lang=${language}`,
    );
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set(
      "line_items[0][price_data][unit_amount]",
      String(PRICE_USD_CENTS),
    );
    params.set("line_items[0][price_data][recurring][interval]", "month");
    params.set(
      "line_items[0][price_data][product_data][name]",
      `Mexico Charts — ${artistName}`,
    );
    params.set(
      "line_items[0][price_data][product_data][description]",
      language === "en"
        ? "Daily artist monitoring with an accumulated metrics history"
        : "Monitoreo diario del artista con historial acumulado de métricas",
    );
    params.set("metadata[artist_key]", catalogArtist.artistKey);
    params.set("metadata[artist_name]", artistName);
    params.set("metadata[product]", "artist_monitoring");
    params.set("metadata[clerk_user_id]", userId);
    params.set("client_reference_id", userId);
    params.set(
      "subscription_data[metadata][artist_key]",
      catalogArtist.artistKey,
    );
    params.set("subscription_data[metadata][artist_name]", artistName);
    params.set("subscription_data[metadata][product]", "artist_monitoring");
    params.set("subscription_data[metadata][clerk_user_id]", userId);

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );
    const payload = (await stripeResponse.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!stripeResponse.ok || !payload.url) {
      logger.error(
        {
          status: stripeResponse.status,
          message: payload.error?.message,
          artistKey: catalogArtist.artistKey,
        },
        "Stripe monitoring checkout creation failed",
      );
      res.status(502).json({ error: "Unable to start secure checkout" });
      return;
    }

    res.json({ checkoutUrl: payload.url });
  } catch (error) {
    logger.error({ error, artistKey }, "Monitoring checkout failed");
    res.status(500).json({ error: "Unable to start monitoring checkout" });
  }
});

export default router;
