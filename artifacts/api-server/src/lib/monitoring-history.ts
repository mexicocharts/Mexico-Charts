export type MonitoringHistoryGranularity = "daily" | "intraday";
export type MonitoringHistoryAcquisitionMode =
  | "songstats_historical"
  | "scheduled_current_snapshot"
  | "mexico_charts_direct";

export interface MonitoringHistoryProvenance {
  provider: "songstats" | "mexico_charts" | string;
  source: string;
  granularity: MonitoringHistoryGranularity;
  acquisitionMode: MonitoringHistoryAcquisitionMode;
  providerObservationDate: string;
  providerObservationAt: string | null;
  fetchedAt: string;
  identityValidationStatus: "verified" | "review" | "rejected";
  requestWindowStartDate?: string;
  requestWindowEndDate?: string;
  importRunId?: string;
  responseHash?: string;
  details?: Record<string, unknown>;
}

export interface MonitoringHistoricalObservation {
  metricKey: string;
  date: string;
  value: number;
  provenance: MonitoringHistoryProvenance;
}

export interface MonitoringMergedHistoryPoint {
  date: string;
  value: number;
  provenance: MonitoringHistoryProvenance;
  alternatives: Array<{
    value: number;
    provenance: MonitoringHistoryProvenance;
  }>;
}

export interface MonitoringGrowthResult {
  requestedDays: number;
  absolute: number;
  percentage: number | null;
  baselineDate: string;
  latestDate: string;
  actualDays: number;
}

export interface MonitoringHistorySeries {
  metricKey: string;
  earliestAvailableDate: string | null;
  latestAvailableDate: string | null;
  points: MonitoringMergedHistoryPoint[];
  missingDateCount: number;
  missingIntervals: Array<{
    startDate: string;
    endDate: string;
    days: number;
  }>;
  growth: {
    days7: MonitoringGrowthResult | null;
    days30: MonitoringGrowthResult | null;
    days90: MonitoringGrowthResult | null;
    months6: MonitoringGrowthResult | null;
    year1: MonitoringGrowthResult | null;
    yearOverYear: MonitoringGrowthResult | null;
  };
  historicalPeak: null | {
    date: string;
    value: number;
    label: "peak_in_available_history";
  };
  multiYear: null | {
    spanDays: number;
    calendarYearsRepresented: number[];
  };
}

const ACQUISITION_PRECEDENCE: Record<MonitoringHistoryAcquisitionMode, number> = {
  songstats_historical: 1,
  scheduled_current_snapshot: 2,
  mexico_charts_direct: 3,
};

function dateDays(date: string): number {
  return Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
}

function targetDate(date: string, days: number): string {
  const target = new Date(`${date}T12:00:00Z`);
  target.setUTCDate(target.getUTCDate() - days);
  return target.toISOString().slice(0, 10);
}

function calendarYearAgo(date: string): string {
  const target = new Date(`${date}T12:00:00Z`);
  target.setUTCFullYear(target.getUTCFullYear() - 1);
  return target.toISOString().slice(0, 10);
}

export function mergeMonitoringHistoricalObservations(
  observations: MonitoringHistoricalObservation[],
): Map<string, MonitoringMergedHistoryPoint[]> {
  const byMetricAndDate = new Map<string, MonitoringHistoricalObservation[]>();
  for (const observation of observations) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observation.date)) continue;
    if (!Number.isFinite(observation.value) || observation.value < 0) continue;
    if (observation.provenance.identityValidationStatus !== "verified") continue;
    const key = `${observation.metricKey}\u0000${observation.date}`;
    byMetricAndDate.set(key, [...(byMetricAndDate.get(key) ?? []), observation]);
  }

  const result = new Map<string, MonitoringMergedHistoryPoint[]>();
  for (const [key, candidates] of byMetricAndDate) {
    const separator = key.indexOf("\u0000");
    const metricKey = key.slice(0, separator);
    const date = key.slice(separator + 1);
    const sorted = [...candidates].sort((left, right) => {
      const precedence = ACQUISITION_PRECEDENCE[right.provenance.acquisitionMode]
        - ACQUISITION_PRECEDENCE[left.provenance.acquisitionMode];
      if (precedence !== 0) return precedence;
      return right.provenance.fetchedAt.localeCompare(left.provenance.fetchedAt);
    });
    const chosen = sorted[0]!;
    const point: MonitoringMergedHistoryPoint = {
      date,
      value: chosen.value,
      provenance: chosen.provenance,
      alternatives: sorted.slice(1).map(candidate => ({
        value: candidate.value,
        provenance: candidate.provenance,
      })),
    };
    result.set(metricKey, [...(result.get(metricKey) ?? []), point]);
  }
  for (const points of result.values()) {
    points.sort((left, right) => left.date.localeCompare(right.date));
  }
  return result;
}

function growthAtTarget(
  points: MonitoringMergedHistoryPoint[],
  target: string,
  requestedDays: number,
  toleranceDays = 7,
): MonitoringGrowthResult | null {
  const latest = points.at(-1);
  if (!latest) return null;
  let baseline: MonitoringMergedHistoryPoint | null = null;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index]!.date <= target) {
      baseline = points[index]!;
      break;
    }
  }
  if (!baseline || baseline.date === latest.date) return null;
  const targetGap = dateDays(target) - dateDays(baseline.date);
  if (targetGap < 0 || targetGap > toleranceDays) return null;
  const actualDays = dateDays(latest.date) - dateDays(baseline.date);
  if (actualDays < requestedDays) return null;
  const absolute = latest.value - baseline.value;
  return {
    requestedDays,
    absolute,
    percentage: baseline.value === 0
      ? null
      : Math.round((absolute / baseline.value) * 10_000) / 100,
    baselineDate: baseline.date,
    latestDate: latest.date,
    actualDays,
  };
}

export function deriveMonitoringHistorySeries(
  metricKey: string,
  points: MonitoringMergedHistoryPoint[],
): MonitoringHistorySeries {
  const ordered = [...points].sort((left, right) => left.date.localeCompare(right.date));
  const latest = ordered.at(-1);
  const earliest = ordered[0];
  const window = (days: number) => latest
    ? growthAtTarget(ordered, targetDate(latest.date, days), days)
    : null;
  const peak = ordered.reduce<MonitoringMergedHistoryPoint | null>(
    (current, point) => !current || point.value > current.value ? point : current,
    null,
  );
  const missingIntervals = ordered.slice(1).flatMap((point, index) => {
    const previous = ordered[index]!;
    const missingDays = dateDays(point.date) - dateDays(previous.date) - 1;
    if (missingDays <= 0) return [];
    const start = new Date(`${previous.date}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(`${point.date}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    return [{
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      days: missingDays,
    }];
  });
  const spanDays = earliest && latest ? dateDays(latest.date) - dateDays(earliest.date) : 0;
  return {
    metricKey,
    earliestAvailableDate: earliest?.date ?? null,
    latestAvailableDate: latest?.date ?? null,
    points: ordered,
    missingDateCount: missingIntervals.reduce((sum, interval) => sum + interval.days, 0),
    missingIntervals,
    growth: {
      days7: window(7),
      days30: window(30),
      days90: window(90),
      months6: window(182),
      year1: window(365),
      yearOverYear: latest
        ? growthAtTarget(ordered, calendarYearAgo(latest.date), 365)
        : null,
    },
    historicalPeak: peak ? {
      date: peak.date,
      value: peak.value,
      label: "peak_in_available_history",
    } : null,
    multiYear: spanDays >= 730 ? {
      spanDays,
      calendarYearsRepresented: [...new Set(ordered.map(point => Number(point.date.slice(0, 4))))],
    } : null,
  };
}

export function assembleMonitoringHistory(
  observations: MonitoringHistoricalObservation[],
): Record<string, MonitoringHistorySeries> {
  return Object.fromEntries(
    [...mergeMonitoringHistoricalObservations(observations)].map(([metricKey, points]) => [
      metricKey,
      deriveMonitoringHistorySeries(metricKey, points),
    ]),
  );
}

export function releaseImpactFromAvailableHistory(input: {
  releaseDate: string;
  series: Record<string, MonitoringHistorySeries>;
  metricKeys: string[];
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.releaseDate)) return null;
  const baselineTarget = targetDate(input.releaseDate, 1);
  const lifts = [7, 30, 90].map(days => {
    const afterDate = new Date(`${input.releaseDate}T12:00:00Z`);
    afterDate.setUTCDate(afterDate.getUTCDate() + days);
    const targetAfter = afterDate.toISOString().slice(0, 10);
    const metricResults = input.metricKeys.flatMap(metricKey => {
      const points = input.series[metricKey]?.points ?? [];
      const baseline = [...points].reverse().find(point => point.date <= baselineTarget);
      const after = points.find(point => point.date >= targetAfter);
      if (!baseline || !after || baseline.value <= 0) return [];
      if (dateDays(baselineTarget) - dateDays(baseline.date) > 7) return [];
      if (dateDays(after.date) - dateDays(targetAfter) > 7) return [];
      return [{
        metricKey,
        baselineDate: baseline.date,
        afterDate: after.date,
        percentage: Math.round(((after.value - baseline.value) / baseline.value) * 1_000) / 10,
      }];
    });
    return { days, metrics: metricResults };
  });
  if (!lifts.some(window => window.metrics.length)) return null;
  return {
    releaseDate: input.releaseDate,
    status: "available" as const,
    windows: lifts,
  };
}

export const MONITORING_SNAPSHOT_METRIC_COLUMNS = {
  spotifyFollowers: "spotify_followers",
  spotifyMonthlyListeners: "spotify_monthly_listeners",
  spotifyPopularity: "spotify_popularity",
  youtubeSubscribers: "youtube_subscribers",
  youtubeChannelViews: "youtube_channel_views",
  instagramFollowers: "instagram_followers",
  tiktokFollowers: "tiktok_followers",
  facebookFollowers: "facebook_followers",
  twitterFollowers: "twitter_followers",
  soundcloudFollowers: "soundcloud_followers",
  deezerFollowers: "deezer_followers",
} as const;
