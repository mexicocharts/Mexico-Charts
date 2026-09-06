import { isMonitoringReadinessDateFresh } from "./monitoring-readiness-policy";

export const MONITORING_PULSE_COLUMNS = {
  spotifyMonthlyListeners: "spotify_monthly_listeners",
  spotifyFollowers: "spotify_followers",
  youtubeSubscribers: "youtube_subscribers",
  youtubeChannelViews: "youtube_channel_views",
  instagramFollowers: "instagram_followers",
  tiktokFollowers: "tiktok_followers",
  facebookFollowers: "facebook_followers",
  twitterFollowers: "twitter_followers",
  soundcloudFollowers: "soundcloud_followers",
  deezerFollowers: "deezer_followers",
} as const;
type PulseMetricKey = keyof typeof MONITORING_PULSE_COLUMNS;
export type MonitoringPulseSnapshot = {
  date: string;
  spotifyPopularity?: number | string | null;
} & Partial<Record<PulseMetricKey, number | string | null>>;
function pulseNumber(value: unknown): number | null {
  if (
    value == null ||
    (typeof value === "string" && !value.trim()) ||
    (typeof value !== "number" && typeof value !== "string")
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function evaluateMonitoringDailyPulse(
  history: readonly MonitoringPulseSnapshot[],
  now = new Date(),
) {
  const byDate = new Map(
    history
      .filter((point) => validDate(point?.date))
      .map((point) => [point.date, point]),
  );
  const ordered = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const current = ordered.at(-1) ?? null;
  const previous = ordered.at(-2) ?? null;
  const gapDays =
    current && previous
      ? (Date.parse(current.date) - Date.parse(previous.date)) / 86_400_000
      : null;
  const fresh = isMonitoringReadinessDateFresh(current?.date ?? null, 14, now);
  const pairedMetricKeys =
    current && previous
      ? (Object.keys(MONITORING_PULSE_COLUMNS) as PulseMetricKey[]).filter(
          (key) =>
            pulseNumber(current[key]) != null &&
            pulseNumber(previous[key]) != null,
        )
      : [];
  const reason = !current
    ? "no_current_snapshot"
    : !previous
      ? "no_previous_snapshot"
      : !fresh
        ? "snapshot_stale"
        : gapDays !== 1
          ? "non_adjacent_snapshots"
          : pairedMetricKeys.length === 0
            ? "no_paired_metrics"
            : null;
  return {
    complete: reason == null,
    status:
      reason == null
        ? ("ready" as const)
        : reason === "snapshot_stale"
          ? ("stale" as const)
          : current
            ? ("partial" as const)
            : ("unavailable" as const),
    reason,
    current,
    previous,
    currentDate: current?.date ?? null,
    previousDate: previous?.date ?? null,
    gapDays,
    fresh,
    pairedMetricKeys,
  };
}

/** Preserve the dashboard's existing licensed-trend precedence on exact dates. */
export function mergeMonitoringPlatformHistory(
  snapshots: readonly MonitoringPulseSnapshot[],
  trends: Partial<
    Record<PulseMetricKey, Array<{ date: string; value: number }>>
  >,
) {
  const empty = {
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
  const byDate = new Map(
    snapshots.map((point) => {
      const normalized = { date: point.date, ...empty } as {
        date: string;
        spotifyPopularity: number | null;
      } & Record<PulseMetricKey, number | null>;
      for (const field of [
        ...Object.keys(MONITORING_PULSE_COLUMNS),
        "spotifyPopularity",
      ] as const) {
        normalized[field as PulseMetricKey | "spotifyPopularity"] = pulseNumber(
          point[field as PulseMetricKey | "spotifyPopularity"],
        );
      }
      return [point.date, normalized];
    }),
  );
  for (const field of [
    "spotifyMonthlyListeners",
    "instagramFollowers",
    "tiktokFollowers",
    "youtubeSubscribers",
  ] as const) {
    for (const point of trends[field] ?? []) {
      const existing = byDate.get(point.date) ?? { date: point.date, ...empty };
      existing[field] = point.value;
      byDate.set(point.date, existing);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Shared native source precedence: one actual row per date, canonical key first. */
export function buildMonitoringNativeSnapshotsSql(keysSql: string): string {
  return `SELECT daily.artist_key,daily.snapshot_date::text AS snapshot_date,daily.fetched_at,
    daily.spotify_popularity,${Object.values(MONITORING_PULSE_COLUMNS)
      .map((column) => `daily.${column}`)
      .join(",")} FROM (
    SELECT DISTINCT ON (snapshot_date) * FROM songstats_artist_daily_snapshots
    WHERE artist_key=ANY(${keysSql})
    ORDER BY snapshot_date DESC, array_position(${keysSql},artist_key), fetched_at DESC
  ) daily ORDER BY snapshot_date ASC`;
}
export function buildMonitoringPulseEvidenceSql(keysSql: string): string {
  const values = Object.entries(MONITORING_PULSE_COLUMNS)
    .map(([key, column]) => `'${key}',${column}`)
    .join(",");
  return `WITH daily AS MATERIALIZED (${buildMonitoringNativeSnapshotsSql(keysSql)}),
    latest_two AS (SELECT * FROM daily ORDER BY snapshot_date DESC LIMIT 2)
    SELECT jsonb_build_object('days',count(*),'firstDate',min(snapshot_date),'lastDate',max(snapshot_date),
      'previousDate',(SELECT snapshot_date FROM latest_two ORDER BY snapshot_date DESC OFFSET 1 LIMIT 1),
      'lastFetchedAt',max(fetched_at),
      'selectionPolicy','canonical_key_then_latest_fetch_per_date',
      'latestSnapshots',COALESCE((SELECT jsonb_agg(jsonb_build_object('date',snapshot_date,${values}) ORDER BY snapshot_date) FROM latest_two),'[]'::jsonb)
    ) history FROM daily`;
}

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

export function buildMonitoringDailyPulse(
  history: MonitoringPulseSnapshot[],
  catalog: {
    newestReleaseDate: string | null;
    releases: Array<{ title: string; releaseDate: string | null }>;
  },
  now = new Date(),
) {
  const coverage = evaluateMonitoringDailyPulse(history, now);
  const { current, previous } = coverage;
  if (!coverage.complete || !current || !previous) {
    const explanation =
      coverage.reason === "snapshot_stale"
        ? "La última lectura no cumple la ventana de actualización; no se afirma un cambio diario actual."
        : coverage.reason === "non_adjacent_snapshots"
          ? `Las dos últimas lecturas están separadas por ${coverage.gapDays ?? "varios"} días; no forman una comparación diaria.`
          : coverage.reason === "no_paired_metrics"
            ? "Ninguna métrica tiene un valor medido en ambas lecturas. No se puede afirmar que no hubo cambios."
            : "Se necesitan dos lecturas diarias con al menos una métrica medida en ambas.";
    return {
      status: coverage.status,
      currentDate: coverage.currentDate,
      previousDate: coverage.previousDate,
      headline:
        coverage.status === "stale"
          ? "Pulso diario desactualizado"
          : "Pulso diario no disponible",
      summary: explanation,
      metricsChanged: null,
      signals: [],
      coverage: {
        complete: false,
        reason: coverage.reason,
        gapDays: coverage.gapDays,
        measuredMetricCount: coverage.pairedMetricKeys.length,
        pairedMetricKeys: coverage.pairedMetricKeys,
      },
    };
  }

  const movements = PULSE_METRICS.flatMap((metric) => {
    const currentValue = pulseNumber(current[metric.key]);
    const previousValue = pulseNumber(previous[metric.key]);
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
    coverage: {
      complete: true,
      reason: null,
      gapDays: coverage.gapDays,
      measuredMetricCount: coverage.pairedMetricKeys.length,
      pairedMetricKeys: coverage.pairedMetricKeys,
    },
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
