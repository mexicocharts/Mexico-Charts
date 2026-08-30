import {
  buildSongstatsPublicInsight,
  type SongstatsPublicInsight,
  type SongstatsPublicMetricKey,
} from "./songstats-public-service";

export const MONITORING_READINESS_POLICY_VERSION = 2;

export type MonitoringReadinessReason =
  | "missing_licensed_endpoint"
  | "missing_current_snapshot"
  | "current_snapshot_stale"
  | "missing_spotify_audience"
  | "missing_youtube_audience"
  | "insufficient_platform_breadth"
  | "insufficient_growth_history"
  | "insufficient_trend_history"
  | "missing_mexico_audience"
  | "missing_stream_catalog"
  | "stream_snapshot_stale"
  | "missing_daily_streams";

export interface MonitoringReadinessInput {
  historicStats: unknown;
  audience: unknown;
  audienceDetails: unknown;
  catalog: unknown;
  currentSnapshotDate: string | Date | null;
  currentMetrics: Partial<Record<SongstatsPublicMetricKey, number | null>>;
  streamSnapshotDate: string | Date | null;
  trackCount: number;
  albumCount: number;
  trackDailyStreams: number;
  trackTotalStreams: number;
  albumTotalStreams: number;
  now?: Date;
}

export interface MonitoringReadinessResult {
  ready: boolean;
  score: number;
  reasons: MonitoringReadinessReason[];
  availablePlatformMetrics: number;
  completeGrowthMetrics: number;
  trendSeries: number;
  mexicoCities: number;
}

const PLATFORM_METRICS: SongstatsPublicMetricKey[] = [
  "spotifyMonthlyListeners",
  "spotifyFollowers",
  "youtubeSubscribers",
  "youtubeChannelViews",
  "instagramFollowers",
  "tiktokFollowers",
  "facebookFollowers",
  "twitterFollowers",
  "soundcloudFollowers",
  "deezerFollowers",
];

function positive(value: number | null | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasPayload(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null) return false;
  if (Array.isArray(value)) return value.some(item => hasPayload(item, depth + 1));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .some(item => hasPayload(item, depth + 1));
  }
  return typeof value === "string" ? value.trim().length > 0 : true;
}

function dateValue(value: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fresh(value: string | Date | null, maximumAgeDays: number, now: Date): boolean {
  const parsed = dateValue(value);
  if (!parsed) return false;
  const age = now.getTime() - parsed.getTime();
  return age >= -86_400_000 && age <= maximumAgeDays * 86_400_000;
}

function mergedCurrent(
  insight: SongstatsPublicInsight,
  snapshot: MonitoringReadinessInput["currentMetrics"],
): Record<SongstatsPublicMetricKey, number | null> {
  return Object.fromEntries(PLATFORM_METRICS.map(key => [
    key,
    positive(snapshot[key]) ? snapshot[key]! : insight.current[key],
  ])) as Record<SongstatsPublicMetricKey, number | null>;
}

export function evaluateMonitoringReadiness(
  input: MonitoringReadinessInput,
): MonitoringReadinessResult {
  const now = input.now ?? new Date();
  const insight = buildSongstatsPublicInsight({
    historicStats: input.historicStats,
    audience: input.audience,
    audienceDetails: input.audienceDetails,
  }, { access: "monitoring" });
  const current = mergedCurrent(insight, input.currentMetrics);
  const availablePlatformMetrics = PLATFORM_METRICS.filter(key => positive(current[key])).length;
  const completeGrowthMetrics = Object.values(insight.growth).filter(growth => (
    growth?.days7 != null && growth.days30 != null && growth.days90 != null
  )).length;
  const trendSeries = Object.values(insight.trends).filter(points => (points?.length ?? 0) >= 2).length;
  const mexicoCities = insight.topMexicoCities.length;

  const checks: Array<[boolean, MonitoringReadinessReason]> = [
    [
      hasPayload(input.historicStats)
        && hasPayload(input.audience)
        && hasPayload(input.audienceDetails)
        && hasPayload(input.catalog),
      "missing_licensed_endpoint",
    ],
    [input.currentSnapshotDate != null, "missing_current_snapshot"],
    [fresh(input.currentSnapshotDate, 14, now), "current_snapshot_stale"],
    [positive(current.spotifyMonthlyListeners), "missing_spotify_audience"],
    [positive(current.youtubeSubscribers), "missing_youtube_audience"],
    [availablePlatformMetrics >= 4, "insufficient_platform_breadth"],
    [completeGrowthMetrics >= 1, "insufficient_growth_history"],
    [trendSeries >= 2, "insufficient_trend_history"],
    [mexicoCities >= 1, "missing_mexico_audience"],
    // Songstats' licensed catalog payload is required above. Per-track daily
    // stream summaries are enrichment, not a launch gate: they are not
    // consistently available for every otherwise monitorable artist.
  ];
  const reasons = checks.filter(([passed]) => !passed).map(([, reason]) => reason);
  return {
    ready: reasons.length === 0,
    score: Math.round((checks.filter(([passed]) => passed).length / checks.length) * 100),
    reasons,
    availablePlatformMetrics,
    completeGrowthMetrics,
    trendSeries,
    mexicoCities,
  };
}
