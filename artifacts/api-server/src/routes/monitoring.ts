import { Router, type RequestHandler } from "express";
import { monitoringReadPool } from "@workspace/db";
import {
  listSongstatsCatalogArtists,
  songstatsArtistKeyCandidates,
} from "../lib/songstats-snapshot-service";
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
  type CompactHistoryRange,
} from "../lib/songstats-history-serving";
import {
  ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES,
  hasInternalArtistProEntitlement,
} from "../lib/artist-pro-entitlement";
import {
  authorizeMonitoringArtist,
  type MonitoringArtistGrant,
} from "../lib/monitoring-authorization";
import {
  elapsedMilliseconds,
  requestDatabaseHttpStatus,
  safeDatabaseDiagnostic,
} from "../lib/request-database";
import { createMonitoringWeeklyReport } from "../lib/monitoring-weekly-report";
import { loadCompleteMonitoringKworbCatalog } from "../lib/monitoring-kworb-catalog";

const router = Router();
const PRICE_USD_CENTS = 600;
const DASHBOARD_LOAD_BUDGET_MS = 12_000;

const requireMonitoringClerkUser: RequestHandler = (req, res, next) => {
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

function mergePlatformHistory(
  snapshots: ReturnType<typeof normalizedSnapshot>[],
  trends: ReturnType<typeof buildSongstatsPublicInsight>["trends"],
) {
  const byDate = new Map(snapshots.map((point) => [point.date, { ...point }]));
  const trendFields = [
    "spotifyMonthlyListeners",
    "instagramFollowers",
    "tiktokFollowers",
    "youtubeSubscribers",
  ] as const;
  for (const field of trendFields) {
    for (const point of trends[field] ?? []) {
      const existing = byDate.get(point.date) ?? {
        date: point.date,
        spotifyFollowers: null,
        spotifyMonthlyListeners: null,
        spotifyPopularity: null,
        youtubeSubscribers: null,
        youtubeChannelViews: null,
        instagramFollowers: null,
        tiktokFollowers: null,
        facebookFollowers: null,
        twitterFollowers: null,
        soundcloudFollowers: null,
        deezerFollowers: null,
      };
      existing[field] = point.value;
      byDate.set(point.date, existing);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

type NormalizedMonitoringSnapshot = ReturnType<typeof normalizedSnapshot>;
type PulseMetricKey = Exclude<
  keyof NormalizedMonitoringSnapshot,
  "date" | "spotifyPopularity"
>;

const PULSE_METRICS: Array<{
  key: PulseMetricKey;
  label: string;
  platform: string;
}> = [
  {
    key: "spotifyMonthlyListeners",
    label: "Oyentes mensuales",
    platform: "Spotify",
  },
  { key: "spotifyFollowers", label: "Seguidores", platform: "Spotify" },
  { key: "youtubeSubscribers", label: "Suscriptores", platform: "YouTube" },
  {
    key: "youtubeChannelViews",
    label: "Vistas del canal",
    platform: "YouTube",
  },
  { key: "instagramFollowers", label: "Seguidores", platform: "Instagram" },
  { key: "tiktokFollowers", label: "Seguidores", platform: "TikTok" },
  { key: "facebookFollowers", label: "Seguidores", platform: "Facebook" },
  { key: "twitterFollowers", label: "Seguidores", platform: "X" },
  { key: "soundcloudFollowers", label: "Seguidores", platform: "SoundCloud" },
  { key: "deezerFollowers", label: "Fans", platform: "Deezer" },
];

function milestoneStep(value: number): number {
  if (value < 100_000) return 10_000;
  if (value < 1_000_000) return 100_000;
  if (value < 10_000_000) return 1_000_000;
  if (value < 100_000_000) return 5_000_000;
  return 10_000_000;
}

function buildDailyPulse(
  history: NormalizedMonitoringSnapshot[],
  catalog: {
    newestReleaseDate: string | null;
    releases: Array<{ title: string; releaseDate: string | null }>;
  },
) {
  const current = history.at(-1);
  const previous = history.at(-2);
  if (!current || !previous) {
    return {
      status: "collecting" as const,
      currentDate: current?.date ?? null,
      previousDate: null,
      headline: "Preparando tu primer Pulso diario",
      summary:
        "Se necesitan dos lecturas guardadas para calcular cambios reales.",
      metricsChanged: 0,
      signals: [],
    };
  }

  const movements = PULSE_METRICS.flatMap((metric) => {
    const currentValue = current[metric.key];
    const previousValue = previous[metric.key];
    if (currentValue == null || previousValue == null) return [];
    const delta = currentValue - previousValue;
    const percentage =
      previousValue === 0 ? null : (delta / previousValue) * 100;
    return [{ ...metric, currentValue, previousValue, delta, percentage }];
  });
  const changed = movements.filter((movement) => movement.delta !== 0);
  const strongest =
    [...changed].sort(
      (a, b) => Math.abs(b.percentage ?? 0) - Math.abs(a.percentage ?? 0),
    )[0] ?? null;
  const signals: Array<Record<string, unknown>> = [];

  for (const movement of [...changed]
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)) {
    signals.push({
      kind: movement.delta > 0 ? "gain" : "decline",
      platform: movement.platform,
      metric: movement.label,
      currentValue: movement.currentValue,
      delta: movement.delta,
      percentage: movement.percentage,
      title: `${movement.platform}: ${movement.delta > 0 ? "subió" : "bajó"} ${movement.label.toLowerCase()}`,
    });
    const step = milestoneStep(movement.currentValue);
    const crossed =
      Math.floor(movement.currentValue / step) >
      Math.floor(movement.previousValue / step);
    if (movement.delta > 0 && crossed) {
      signals.push({
        kind: "milestone",
        platform: movement.platform,
        metric: movement.label,
        currentValue: movement.currentValue,
        delta: movement.delta,
        percentage: movement.percentage,
        title: `${movement.platform}: nuevo hito alcanzado`,
      });
    }
  }

  const recentRelease = catalog.releases.find(
    (release) =>
      release.releaseDate &&
      release.releaseDate <= current.date &&
      release.releaseDate > previous.date,
  );
  if (recentRelease) {
    signals.unshift({
      kind: "release",
      platform: "Catálogo",
      metric: "Nuevo lanzamiento",
      currentValue: null,
      delta: null,
      percentage: null,
      title: `Nuevo lanzamiento detectado: ${recentRelease.title}`,
      releaseDate: recentRelease.releaseDate,
    });
  }

  const direction =
    strongest?.delta === 0 || !strongest
      ? "sin cambios materiales"
      : strongest.delta > 0
        ? "en crecimiento"
        : "a la baja";
  return {
    status: "ready" as const,
    currentDate: current.date,
    previousDate: previous.date,
    headline: strongest
      ? `${strongest.platform} lideró el movimiento diario`
      : "Día estable en las métricas observadas",
    summary: strongest
      ? `${strongest.label} está ${direction}; revisa las señales para ver la variación exacta.`
      : "No se detectaron cambios entre las dos lecturas más recientes.",
    metricsChanged: changed.length,
    signals: signals.slice(0, 6),
  };
}

async function loadAuthorizedMonitoring(
  userId: string,
  requestedArtistKey: string,
) {
  const lookupKeys = songstatsArtistKeyCandidates(requestedArtistKey);
  const authorization = await authorizeMonitoringArtist({
    userId,
    requestedArtistKey,
    findActiveSubscription: async () => {
      const subscription =
        await monitoringReadPool.query<MonitoringArtistGrant>(
          `
        SELECT artist_key, artist_name, status, created_at
        FROM monitoring_subscriptions
        WHERE clerk_user_id = $1
          AND (
            lower(artist_key) = ANY($2::text[])
            OR regexp_replace(
              translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'),
              '[^a-z0-9]',
              '',
              'g'
            ) = ANY($2::text[])
          )
          AND status = ANY($3::text[])
        ORDER BY updated_at DESC
        LIMIT 1
      `,
          [userId, lookupKeys, ACTIVE_ARTIST_PRO_SUBSCRIPTION_STATUSES],
        );
      return subscription.rows[0] ?? null;
    },
    findExistingArtist: async (artistKey) => {
      const artist = await getExistingMonitoringArtist(artistKey);
      return artist
        ? {
            artist_key: artist.artistKey,
            artist_name: artist.artistName,
            status: "internal",
            created_at: null,
          }
        : null;
    },
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
  if (!authorization.allowed || !active) return null;

  const activeKeys = [
    ...new Set([
      ...songstatsArtistKeyCandidates(active.artist_key),
      ...songstatsArtistKeyCandidates(active.artist_name),
      ...lookupKeys,
    ]),
  ];
  const dashboardLoadStartedAt = performance.now();
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
    () =>
      monitoringReadPool
        .query<{
          avatar_url: string | null;
          spotify_artist_id: string | null;
        }>(
          `
    SELECT COALESCE(songstats.avatar_url, image.image_url) avatar_url,
           coverage.spotify_id spotify_artist_id
    FROM kworb_coverage coverage
    LEFT JOIN LATERAL (
      SELECT avatar_url
      FROM songstats_artists
      WHERE lower(artist_key) = ANY($1::text[])
      ORDER BY last_synced_at DESC
      LIMIT 1
    ) songstats ON true
    LEFT JOIN LATERAL (
      SELECT image_url
      FROM artist_images
      WHERE regexp_replace(
        translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]', '', 'g'
      ) = ANY($1::text[])
      LIMIT 1
    ) image ON true
    WHERE lower(coverage.artist_key) = ANY($1::text[])
    LIMIT 1
  `,
          [activeKeys],
        )
        .then((result) => result.rows),
    [],
  );
  const priorityStreamSummary = dashboardStage(
    "priority_stream_summary",
    () =>
      monitoringReadPool
        .query<{
          snapshot_date: string;
          track_count: number;
          album_count: number;
          track_daily_streams: string | number;
          album_daily_streams: string | number;
          track_total_streams: string | number;
          album_total_streams: string | number;
        }>(
          `
    SELECT snapshot_date, track_count, album_count,
           track_daily_streams, album_daily_streams,
           track_total_streams, album_total_streams
    FROM monitoring_stream_daily_artist_summaries
    WHERE lower(artist_key) = ANY($1::text[])
    ORDER BY snapshot_date DESC
    LIMIT 1
  `,
          [activeKeys],
        )
        .then((result) => result.rows),
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
    () =>
      monitoringReadPool
        .query<{
          snapshot_date: string;
          total_streams: string | number | null;
          daily_streams: string | number | null;
        }>(
          `
    SELECT snapshot_date, total_streams, daily_streams
    FROM spotify_kworb_daily_snapshots
    WHERE lower(artist_key) = ANY($1::text[])
    ORDER BY snapshot_date
  `,
          [activeKeys],
        )
        .then((result) => result.rows),
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
          `
    WITH selected AS MATERIALIZED (
    SELECT coverage.artist_key,
           COALESCE(NULLIF(coverage.artist_name, ''), coverage.artist_key) artist_name,
           extended.historic_stats,
           latest.snapshot_date,
           latest.spotify_monthly_listeners,
           latest.youtube_channel_views,
           latest.instagram_followers
    FROM kworb_coverage coverage
    JOIN songstats_artist_extended_data extended ON extended.artist_key=coverage.artist_key
    JOIN LATERAL (
      SELECT snapshot_date, spotify_monthly_listeners, youtube_channel_views, instagram_followers
      FROM songstats_artist_daily_snapshots snapshot
      WHERE snapshot.artist_key=coverage.artist_key
      ORDER BY snapshot.snapshot_date DESC
      LIMIT 1
    ) latest ON true
    WHERE coverage.status='active'
      AND NOT (lower(coverage.artist_key)=ANY($1::text[]))
      AND latest.spotify_monthly_listeners IS NOT NULL
    ORDER BY latest.spotify_monthly_listeners DESC, coverage.artist_key
    LIMIT 4
    )
    SELECT selected.*, image.image_url avatar_url
    FROM selected
    LEFT JOIN LATERAL (
      SELECT image_url
      FROM artist_images
      WHERE regexp_replace(
        translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]', '', 'g'
      )=regexp_replace(
        translate(lower(selected.artist_name), 'áéíóúüñ', 'aeiouun'),
        '[^a-z0-9]', '', 'g'
      )
      LIMIT 1
    ) image ON true
    ORDER BY selected.spotify_monthly_listeners DESC, selected.artist_key
  `,
          [activeKeys],
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
          `
      SELECT
        snapshot_date,
        spotify_followers,
        spotify_monthly_listeners,
        spotify_popularity,
        youtube_subscribers,
        youtube_channel_views,
        instagram_followers,
        tiktok_followers,
        facebook_followers,
        twitter_followers,
        soundcloud_followers,
        deezer_followers
      FROM songstats_artist_daily_snapshots
      WHERE lower(artist_key) = ANY($1::text[])
      ORDER BY snapshot_date ASC
    `,
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

  let resolvedStreamItems = prioritizedStreamItems;
  let resolvedStreamSummary = prioritizedStreamSummary;
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
      const tracks = completeCatalog.items.filter(
        (item) => item.type === "track",
      );
      const albums = completeCatalog.items.filter(
        (item) => item.type === "album",
      );
      const sum = (
        items: typeof completeCatalog.items,
        field: "totalStreams" | "dailyStreams",
      ) => items.reduce((total, item) => total + item[field], 0);
      resolvedStreamSummary = [
        {
          snapshot_date: completeCatalog.fetchedAt.slice(0, 10),
          track_count: tracks.length,
          album_count: albums.length,
          track_daily_streams: sum(tracks, "dailyStreams"),
          album_daily_streams: sum(albums, "dailyStreams"),
          track_total_streams: sum(tracks, "totalStreams"),
          album_total_streams: sum(albums, "totalStreams"),
        },
      ];
    }
  }

  const prioritizedLiveVideos = await dashboardStage(
    "priority_youtube_live_videos",
    () =>
      monitoringReadPool
        .query(
          `
    WITH eligible_sources AS (
      SELECT link.artist_name, link.video_id, link.confidence_score,
             link.priority, link.id
      FROM youtube_artist_video_links link
      WHERE link.active=true
        AND link.confidence_score >= 80
        AND link.artist_key = ANY($1::text[])
      UNION ALL
      SELECT candidate.artist_name, candidate.video_id, candidate.confidence_score,
             0 AS priority, candidate.id
      FROM youtube_music_catalog_candidates candidate
      WHERE candidate.status IN ('review','verified')
        AND candidate.sampling_status='shadow'
        AND candidate.artist_key = ANY($1::text[])
    ), matched_links AS (
      SELECT DISTINCT ON (link.video_id)
        link.artist_name,
        link.video_id,
        link.confidence_score,
        link.priority
      FROM eligible_sources link
      ORDER BY link.video_id, link.confidence_score DESC, link.priority DESC, link.id
    )
    SELECT
      links.artist_name,
      links.video_id,
      tracked.title,
      tracked.thumbnail_url,
      'https://www.youtube.com/watch?v=' || links.video_id canonical_url,
      COALESCE(latest.view_count, tracked.view_count) view_count,
      latest.view_delta,
      latest.seconds_since_previous,
      latest.observed_at::text monitor_observed_at,
      COALESCE(latest.observed_at, tracked.last_snapshot_at, tracked.updated_at)::text observed_at,
      NULL::bigint views_24h,
      NULL::text views_24h_started_at,
      NULL::text views_24h_ended_at,
      NULL::bigint views_today_et,
      NULL::text views_today_et_started_at,
      NULL::text views_today_et_ended_at
    FROM matched_links links
    JOIN youtube_tracked_videos tracked ON tracked.video_id=links.video_id
    LEFT JOIN youtube_video_intraday_latest_observations pointer ON pointer.video_id=links.video_id
    LEFT JOIN youtube_video_intraday_shadow_snapshots latest
      ON latest.video_id=pointer.video_id
     AND latest.observed_at=pointer.latest_observed_at
    WHERE COALESCE(latest.view_count, tracked.view_count) IS NOT NULL
    ORDER BY COALESCE(latest.view_count, tracked.view_count) DESC, tracked.title
  `,
          [activeKeys],
        )
        .then((result) => result.rows),
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
    () =>
      monitoringReadPool
        .query(
          `
      SELECT
        s.video_id,
        s.snapshot_date,
        s.view_count,
        s.daily_view_delta
      FROM youtube_video_daily_snapshots s
      WHERE s.snapshot_date >= to_char(
          (now() AT TIME ZONE 'America/New_York')::date - 89,
          'YYYY-MM-DD'
        )
        AND EXISTS (
          SELECT 1
          FROM youtube_artist_video_links link
          WHERE link.video_id=s.video_id
            AND link.active=true
            AND link.confidence_score >= 80
            AND link.artist_key = ANY($1::text[])
        )
      ORDER BY s.video_id, s.snapshot_date
    `,
          [activeKeys],
        )
        .then((result) => result.rows),
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
  const normalizedReleaseTitle = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+-\s+(single|ep)$/i, "")
      .replace(/\([^)]*(deluxe|version|remaster)[^)]*\)/gi, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const releaseArtwork = new Map(
    catalog.releases
      .filter((release) => release.artworkUrl)
      .map((release) => [
        normalizedReleaseTitle(release.title),
        release.artworkUrl,
      ]),
  );
  for (const track of kworbTrackArtwork(spotifySnapshots[0]?.value)) {
    const key = normalizedReleaseTitle(track.title);
    if (!releaseArtwork.has(key)) releaseArtwork.set(key, track.artworkUrl);
  }
  for (const track of storedTrackArtwork) {
    const key = normalizedReleaseTitle(track.song_title);
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
            releaseDate: catalog.newestReleaseDate,
            queryable: monitoringReadPool,
          })
        : Promise.resolve(null),
    null,
  );
  const completeHistory = mergePlatformHistory(history, insight?.trends ?? {});
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
    dailyPulse: buildDailyPulse(completeHistory, catalog),
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
      })),
      items: resolvedStreamItems.map((item) => ({
        type: item.item_type,
        key: item.item_key,
        title: item.title,
        spotifyUrl: item.spotify_url,
        artworkUrl:
          item.artwork_url ??
          releaseArtwork.get(normalizedReleaseTitle(item.title)) ??
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

router.get(
  "/monitoring/internal/artists",
  requireMonitoringClerkUser,
  async (req, res) => {
    const userId = clerkUserId(res);
    if (!hasInternalArtistProEntitlement(userId)) {
      res.status(403).json({ error: "Internal Artist Pro access is required" });
      return;
    }
    try {
      const result = await monitoringReadPool.query<{
        artist_key: string;
        artist_name: string | null;
        last_snapshot_date: string | null;
        spotify_item_count: string | number;
        youtube_video_count: string | number;
      }>(`
      WITH latest_snapshots AS (
        SELECT artist_key, max(snapshot_date)::text last_snapshot_date
        FROM songstats_artist_daily_snapshots
        GROUP BY artist_key
      ), stream_counts AS (
        SELECT artist_key, count(*)::int spotify_item_count
        FROM monitoring_stream_items
        GROUP BY artist_key
      ), video_counts AS (
        SELECT artist_key, count(DISTINCT video_id)::int youtube_video_count
        FROM youtube_artist_video_links
        WHERE active=true AND confidence_score >= 80
        GROUP BY artist_key
      )
      SELECT
        coverage.artist_key,
        coverage.artist_name,
        snapshot.last_snapshot_date,
        COALESCE(streams.spotify_item_count, 0) spotify_item_count,
        COALESCE(videos.youtube_video_count, 0) youtube_video_count
      FROM kworb_coverage coverage
      JOIN latest_snapshots snapshot
        ON snapshot.artist_key=coverage.artist_key
      LEFT JOIN stream_counts streams ON streams.artist_key=coverage.artist_key
      LEFT JOIN video_counts videos ON videos.artist_key=coverage.artist_key
      WHERE COALESCE(coverage.spotify_id, '') <> ''
      ORDER BY COALESCE(NULLIF(coverage.artist_name, ''), coverage.artist_key)
    `);
      res.setHeader("cache-control", "private, max-age=300");
      res.json({
        count: result.rows.length,
        artists: result.rows.map((artist) => ({
          artistKey: artist.artist_key,
          artistName: artist.artist_name?.trim() || artist.artist_key,
          lastSnapshotDate: artist.last_snapshot_date,
          spotifyItemCount: Number(artist.spotify_item_count ?? 0),
          youtubeVideoCount: Number(artist.youtube_video_count ?? 0),
        })),
      });
    } catch (error) {
      logger.warn(
        {
          event: "internal_monitoring_artist_list_failure",
          identityHash: safeClerkIdentityHash(userId),
          database: safeDatabaseDiagnostic(error),
        },
        "Internal monitoring artist list failed",
      );
      res
        .status(requestDatabaseHttpStatus(error))
        .json({ error: "Monitoring artist list is temporarily unavailable" });
    }
  },
);

router.get(
  "/monitoring/dashboard/:artistKey",
  requireMonitoringClerkUser,
  async (req, res) => {
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
  "/monitoring/history/:artistKey/:metricKey",
  requireMonitoringClerkUser,
  async (req, res) => {
    const artistKey = String(req.params.artistKey ?? "")
      .trim()
      .toLowerCase();
    const metricKey = String(req.params.metricKey ?? "").trim();
    const range = String(req.query.range ?? "all") as CompactHistoryRange;
    const resolution = String(req.query.resolution ?? "auto") as
      | "auto"
      | "daily"
      | "minmax";
    if (
      !artistKey ||
      artistKey.length > 160 ||
      !/^[A-Za-z][A-Za-z0-9]{1,79}$/.test(metricKey)
    ) {
      res
        .status(400)
        .json({ error: "A valid artist and historical metric are required" });
      return;
    }
    if (
      !["7d", "30d", "90d", "6m", "1y", "all", "custom"].includes(range) ||
      !["auto", "daily", "minmax"].includes(resolution)
    ) {
      res
        .status(400)
        .json({ error: "Unsupported history range or resolution" });
      return;
    }
    try {
      const subscription = await loadAuthorizedMonitoring(
        clerkUserId(res),
        artistKey,
      );
      if (!subscription) {
        res.status(403).json({
          error: "An active subscription is required for this artist",
        });
        return;
      }
      const history = await loadCompactMonitoringMetricHistory({
        artistKey: subscription.subscription.artistKey,
        metricKey,
        range,
        startDate: String(req.query.startDate ?? "") || undefined,
        endDate: String(req.query.endDate ?? "") || undefined,
        resolution,
        queryable: monitoringReadPool,
      });
      res.setHeader("Cache-Control", "private, max-age=60");
      res.json(history);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load metric history";
      if (/Unknown|Custom history range/.test(message)) {
        res.status(400).json({ error: message });
        return;
      }
      const status = requestDatabaseHttpStatus(error);
      const unavailable = status === 503;
      logger[unavailable ? "warn" : "error"](
        {
          event: "monitoring_history_failure",
          artistKey,
          metricKey,
          database: safeDatabaseDiagnostic(error),
        },
        "Compact monitoring history failed",
      );
      res.status(status).json({
        error: unavailable
          ? "Monitoring is temporarily unavailable"
          : "Unable to load metric history",
      });
    }
  },
);

router.get(
  "/monitoring/report/:artistKey",
  requireMonitoringClerkUser,
  async (req, res) => {
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
