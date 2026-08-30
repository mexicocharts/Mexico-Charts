import { Router } from "express";
import { pool } from "@workspace/db";
import {
  listSongstatsCatalogArtists,
  songstatsArtistKeyCandidates,
} from "../lib/songstats-snapshot-service";
import { buildSongstatsPublicInsight } from "../lib/songstats-public-service";
import {
  auditMonitoringReadiness,
  getMonitoringReadyArtist,
} from "../lib/monitoring-readiness-service";
import { logger } from "../lib/logger";
import { clerkConfigured, clerkUserId, requireClerkUser } from "../lib/auth";

const router = Router();
const PRICE_USD_CENTS = 600;
const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];

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
      headline: "Recopilando actividad",
      summary: "Aún no hay cambios calculables.",
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
      ? `${strongest.platform} registró el mayor cambio`
      : "Sin cambios relevantes",
    summary: strongest
      ? `${strongest.label} está ${direction}.`
      : "No hubo cambios entre las dos lecturas más recientes.",
    metricsChanged: changed.length,
    signals: signals.slice(0, 6),
  };
}

async function loadAuthorizedMonitoring(
  userId: string,
  requestedArtistKey: string,
) {
  const lookupKeys = songstatsArtistKeyCandidates(requestedArtistKey);
  const subscription = await pool.query<{
    artist_key: string;
    artist_name: string;
    status: string;
    created_at: Date;
  }>(
    `
    SELECT artist_key, artist_name, status, created_at
    FROM monitoring_subscriptions
    WHERE clerk_user_id = $1
      AND lower(artist_key) = ANY($2::text[])
      AND status = ANY($3::text[])
    ORDER BY updated_at DESC
    LIMIT 1
  `,
    [userId, lookupKeys, ACTIVE_SUBSCRIPTION_STATUSES],
  );
  const active = subscription.rows[0];
  if (!active) return null;

  const activeKeys = songstatsArtistKeyCandidates(active.artist_key);
  const [
    snapshots,
    extended,
    liveVideos,
    liveVideoHistory,
    streamSummary,
    streamItems,
  ] = await Promise.all([
    pool.query<MonitoringSnapshotRow>(
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
    ),
    pool.query<{
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
    ),
    pool.query(
      `
      WITH eastern_bounds AS (
        SELECT
          (date_trunc('day', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York') today_start,
          ((date_trunc('day', now() AT TIME ZONE 'America/New_York') - interval '1 day') AT TIME ZONE 'America/New_York') previous_start
      )
      SELECT
        c.artist_name,
        c.video_id,
        COALESCE(NULLIF(v.title, ''), c.title) title,
        v.thumbnail_url,
        c.canonical_url,
        latest.view_count,
        latest.view_delta,
        latest.seconds_since_previous,
        latest.observed_at::text observed_at,
        CASE WHEN previous_start.view_count IS NULL OR today_start.view_count IS NULL THEN NULL
          ELSE GREATEST(0, today_start.view_count - previous_start.view_count) END views_24h,
        previous_start.observed_at::text views_24h_started_at,
        today_start.observed_at::text views_24h_ended_at,
        CASE WHEN today_start.view_count IS NULL OR latest.view_count IS NULL THEN NULL
          ELSE GREATEST(0, latest.view_count - today_start.view_count) END views_today_et,
        today_start.observed_at::text views_today_et_started_at,
        CASE WHEN today_start.observed_at IS NULL THEN NULL ELSE latest.observed_at::text END views_today_et_ended_at
      FROM youtube_music_catalog_candidates c
      CROSS JOIN eastern_bounds bounds
      JOIN youtube_tracked_videos v ON v.video_id=c.video_id
      JOIN LATERAL (
        SELECT s.view_count, s.view_delta, s.seconds_since_previous, s.observed_at
        FROM youtube_video_intraday_shadow_snapshots s
        WHERE s.video_id=c.video_id
        ORDER BY s.observed_at DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT s.view_count, s.observed_at
        FROM youtube_video_intraday_shadow_snapshots s
        WHERE s.video_id=c.video_id
          AND s.observed_at >= bounds.previous_start
          AND s.observed_at < bounds.previous_start + interval '30 minutes'
        ORDER BY s.observed_at
        LIMIT 1
      ) previous_start ON true
      LEFT JOIN LATERAL (
        SELECT s.view_count, s.observed_at
        FROM youtube_video_intraday_shadow_snapshots s
        WHERE s.video_id=c.video_id
          AND s.observed_at >= bounds.today_start
          AND s.observed_at < bounds.today_start + interval '30 minutes'
        ORDER BY s.observed_at
        LIMIT 1
      ) today_start ON true
      WHERE (
          lower(c.artist_key) = ANY($1::text[])
          OR regexp_replace(
            translate(lower(c.artist_key), 'áéíóúüñ', 'aeiouun'),
            '[^a-z0-9]', '', 'g'
          ) = ANY($1::text[])
        )
        AND c.status IN ('review','verified')
        AND c.sampling_status='shadow'
      ORDER BY latest.view_count DESC, c.title
    `,
      [activeKeys],
    ),
    pool.query(
      `
      SELECT
        s.video_id,
        s.snapshot_date,
        s.view_count,
        s.daily_view_delta
      FROM youtube_video_daily_snapshots s
      WHERE s.snapshot_date >= to_char(
          (now() AT TIME ZONE 'America/New_York')::date - 29,
          'YYYY-MM-DD'
        )
        AND EXISTS (
          SELECT 1
          FROM youtube_music_catalog_candidates c
          WHERE c.video_id=s.video_id
            AND (
              lower(c.artist_key) = ANY($1::text[])
              OR regexp_replace(
                translate(lower(c.artist_key), 'áéíóúüñ', 'aeiouun'),
                '[^a-z0-9]', '', 'g'
              ) = ANY($1::text[])
            )
            AND c.status IN ('review','verified')
            AND c.sampling_status='shadow'
        )
      ORDER BY s.video_id, s.snapshot_date
    `,
      [activeKeys],
    ),
    pool.query<{
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
    ),
    pool.query<{
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
    ),
  ]);
  const extendedRow = extended.rows[0];
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
  const history = snapshots.rows.map(normalizedSnapshot);
  const catalog = insight?.catalog ?? {
    releaseCount: 0,
    trackCount: 0,
    albumCount: 0,
    releasesLast90Days: 0,
    medianReleaseGapDays: null,
    newestReleaseDate: null,
    releases: [],
  };
  const latestStreamSummary = streamSummary.rows[0] ?? null;
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
  const uniqueLiveVideos = liveVideos.rows.filter(
    (video, index, rows) =>
      rows.findIndex((candidate) => candidate.video_id === video.video_id) ===
      index,
  );
  return {
    subscription: {
      artistKey: active.artist_key,
      artistName: active.artist_name,
      status: active.status,
      activatedAt: active.created_at.toISOString(),
    },
    current: history.at(-1) ?? null,
    history,
    dailyPulse: buildDailyPulse(history, catalog),
    growth: insight?.growth ?? {},
    topMexicoCities: insight?.topMexicoCities ?? [],
    catalog,
    latestReleaseImpact: insight?.latestReleaseImpact ?? null,
    liveVideos: uniqueLiveVideos,
    liveVideoHistory: liveVideoHistory.rows,
    spotifyCatalog: {
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
      items: streamItems.rows.map((item) => ({
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

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
  try {
    const audit = await auditMonitoringReadiness({ readyOnly: true });
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
    logger.error({ error }, "Monitoring artist availability failed");
    res
      .status(503)
      .json({ error: "Monitoring availability is temporarily unavailable" });
  }
});

router.get(
  "/monitoring/dashboard/:artistKey",
  requireClerkUser,
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
          .json({
            error: "An active subscription is required for this artist",
          });
        return;
      }
      res.json(dashboard);
    } catch (error) {
      logger.error({ error, artistKey }, "Monitoring dashboard failed");
      res.status(500).json({ error: "Unable to load monitoring dashboard" });
    }
  },
);

router.get(
  "/monitoring/report/:artistKey",
  requireClerkUser,
  async (req, res) => {
    const artistKey = String(req.params.artistKey ?? "")
      .trim()
      .toLowerCase();
    const month = String(req.query.month ?? "").trim();
    if (!artistKey || artistKey.length > 160 || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "A valid artist and month are required" });
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
          .json({
            error: "An active subscription is required for this artist",
          });
        return;
      }
      const rows = dashboard.history.filter((point) =>
        point.date.startsWith(month),
      );
      const header = [
        "date",
        "spotify_monthly_listeners",
        "spotify_followers",
        "youtube_subscribers",
        "youtube_channel_views",
        "instagram_followers",
        "tiktok_followers",
        "facebook_followers",
        "twitter_followers",
        "soundcloud_followers",
        "deezer_followers",
      ];
      const lines = [
        ["Mexico Charts monthly monitoring report"],
        ["artist", dashboard.subscription.artistName],
        ["month", month],
        ["generated_at", new Date().toISOString()],
        [
          "coverage",
          "Licensed and normalized metrics available after subscription activation",
        ],
        [],
        header,
        ...rows.map((point) => [
          point.date,
          point.spotifyMonthlyListeners,
          point.spotifyFollowers,
          point.youtubeSubscribers,
          point.youtubeChannelViews,
          point.instagramFollowers,
          point.tiktokFollowers,
          point.facebookFollowers,
          point.twitterFollowers,
          point.soundcloudFollowers,
          point.deezerFollowers,
        ]),
      ];
      const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\n")}`;
      const safeArtist =
        dashboard.subscription.artistName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "artist";
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader(
        "content-disposition",
        `attachment; filename="mexico-charts-${safeArtist}-${month}.csv"`,
      );
      res.send(csv);
    } catch (error) {
      logger.error({ error, artistKey, month }, "Monitoring report failed");
      res.status(500).json({ error: "Unable to generate monitoring report" });
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
