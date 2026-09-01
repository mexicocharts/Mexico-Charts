export type CompactHistoryResolution = "daily" | "minmax";

export interface CompactHistoryPoint {
  date: string;
  value: number;
  provenanceRef: string;
  acquisitionMode: "songstats_historical" | "scheduled_current_snapshot" | "mexico_charts_direct";
  alternatives?: Array<{
    value: number;
    provenanceRef: string;
    acquisitionMode: CompactHistoryPoint["acquisitionMode"];
  }>;
}

export interface CompactGrowthResult {
  requestedDays: number;
  absolute: number;
  percentage: number | null;
  baselineDate: string;
  latestDate: string;
  actualDays: number;
}

const ACQUISITION_PRECEDENCE: Record<CompactHistoryPoint["acquisitionMode"], number> = {
  songstats_historical: 1,
  scheduled_current_snapshot: 2,
  mexico_charts_direct: 3,
};

export const RELEASE_IMPACT_ELIGIBLE_METRICS = Object.freeze({
  spotifyFollowers: 100,
  spotifyMonthlyListeners: 1_000,
  spotifyStreams: 1_000,
  youtubeSubscribers: 100,
  youtubeChannelViews: 1_000,
  soundcloudStreams: 100,
  shazamCount: 100,
} satisfies Record<string, number>);

export const RELEASE_IMPACT_MAX_PERCENTAGE = 1_000;

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

export function mergeCompactHistoryPoints(points: CompactHistoryPoint[]): CompactHistoryPoint[] {
  const byDate = new Map<string, CompactHistoryPoint[]>();
  for (const point of points) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date) || !Number.isFinite(point.value)) continue;
    byDate.set(point.date, [...(byDate.get(point.date) ?? []), point]);
  }
  return [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, candidates]) => {
    const ordered = [...candidates].sort((left, right) =>
      ACQUISITION_PRECEDENCE[right.acquisitionMode] - ACQUISITION_PRECEDENCE[left.acquisitionMode]);
    const selected = ordered[0]!;
    return {
      ...selected,
      date,
      alternatives: ordered.slice(1).map(candidate => ({
        value: candidate.value,
        provenanceRef: candidate.provenanceRef,
        acquisitionMode: candidate.acquisitionMode,
      })),
    };
  });
}

// Deterministic min/max bucket sampling keeps local extrema visible. The first
// and last exact source points are always retained. This changes only the
// transport/display series; the daily source rows remain untouched.
export function deterministicMinMaxDownsample(
  points: CompactHistoryPoint[],
  maximumPoints = 400,
): CompactHistoryPoint[] {
  const ordered = [...points].sort((left, right) => left.date.localeCompare(right.date));
  if (ordered.length <= maximumPoints || maximumPoints < 4) return ordered;
  const interiorBucketCount = Math.max(1, Math.floor((maximumPoints - 2) / 2));
  const bucketWidth = Math.ceil(ordered.length / interiorBucketCount);
  const selectedIndexes = new Set<number>([0, ordered.length - 1]);
  for (let start = 0; start < ordered.length; start += bucketWidth) {
    const end = Math.min(ordered.length, start + bucketWidth);
    let minimumIndex = start;
    let maximumIndex = start;
    for (let index = start + 1; index < end; index += 1) {
      if (ordered[index]!.value < ordered[minimumIndex]!.value) minimumIndex = index;
      if (ordered[index]!.value > ordered[maximumIndex]!.value) maximumIndex = index;
    }
    selectedIndexes.add(minimumIndex);
    selectedIndexes.add(maximumIndex);
  }
  return [...selectedIndexes].sort((left, right) => left - right).map(index => ordered[index]!);
}

export function compactGrowthAtTarget(
  points: CompactHistoryPoint[],
  requestedDays: number,
  toleranceDays = 7,
): CompactGrowthResult | null {
  const ordered = [...points].sort((left, right) => left.date.localeCompare(right.date));
  const latest = ordered.at(-1);
  if (!latest) return null;
  const target = shiftDate(latest.date, -requestedDays);
  const baseline = [...ordered].reverse().find(point => point.date <= target);
  if (!baseline || baseline.date === latest.date) return null;
  const targetGap = dayNumber(target) - dayNumber(baseline.date);
  const actualDays = dayNumber(latest.date) - dayNumber(baseline.date);
  if (targetGap < 0 || targetGap > toleranceDays || actualDays < requestedDays) return null;
  const absolute = latest.value - baseline.value;
  return {
    requestedDays,
    absolute,
    percentage: baseline.value === 0 ? null : Math.round((absolute / baseline.value) * 10_000) / 100,
    baselineDate: baseline.date,
    latestDate: latest.date,
    actualDays,
  };
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!;
}

function windowPoints(points: CompactHistoryPoint[], start: string, end: string) {
  return points.filter(point => point.date >= start && point.date <= end);
}

function completeWindow(points: CompactHistoryPoint[], start: string, end: string, minimumPoints: number) {
  if (points.length < minimumPoints) return false;
  const ordered = [...new Set(points.map(point => point.date))].sort();
  if (!ordered.length) return false;
  if (dayNumber(ordered[0]!) - dayNumber(start) > 2) return false;
  if (dayNumber(end) - dayNumber(ordered.at(-1)!) > 2) return false;
  return ordered.slice(1).every((date, index) =>
    dayNumber(date) - dayNumber(ordered[index]!) <= 3);
}

export function releaseImpactFromCompactHistory(input: {
  releaseDate: string;
  metricKey: string;
  points: CompactHistoryPoint[];
}) {
  const minimumBaseline = RELEASE_IMPACT_ELIGIBLE_METRICS[
    input.metricKey as keyof typeof RELEASE_IMPACT_ELIGIBLE_METRICS
  ];
  if (minimumBaseline == null) {
    return { status: "unavailable" as const, reason: "metric_not_eligible" as const };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.releaseDate)) {
    return { status: "unavailable" as const, reason: "invalid_release_date" as const };
  }
  const ordered = mergeCompactHistoryPoints(input.points);
  const preStart = shiftDate(input.releaseDate, -7);
  const preEnd = shiftDate(input.releaseDate, -1);
  const pre = windowPoints(ordered, preStart, preEnd);
  if (!completeWindow(pre, preStart, preEnd, 5)) {
    return { status: "unavailable" as const, reason: "insufficient_pre_release_history" as const };
  }
  const baseline = median(pre.map(point => point.value));
  if (baseline < minimumBaseline) {
    return { status: "unavailable" as const, reason: "baseline_too_small" as const };
  }
  const windows = [7, 30, 90].map(days => {
    const postStart = shiftDate(input.releaseDate, days - 2);
    const postEnd = shiftDate(input.releaseDate, days + 2);
    const post = windowPoints(ordered, postStart, postEnd);
    const comparisonStart = input.releaseDate;
    const comparison = windowPoints(ordered, comparisonStart, postEnd);
    if (!completeWindow(post, postStart, postEnd, 3) ||
        !completeWindow(comparison, comparisonStart, postEnd, Math.max(3, days - 2))) {
      return { days, status: "unavailable" as const, reason: "insufficient_or_gapped_post_release_history" as const };
    }
    const after = median(post.map(point => point.value));
    const absolute = after - baseline;
    const percentage = (absolute / baseline) * 100;
    if (!Number.isFinite(percentage) || Math.abs(percentage) > RELEASE_IMPACT_MAX_PERCENTAGE) {
      return { days, status: "unavailable" as const, reason: "percentage_outlier" as const };
    }
    return {
      days,
      status: "available" as const,
      baseline,
      after,
      absolute,
      percentage: Math.round(percentage * 10) / 10,
      preWindow: { startDate: preStart, endDate: preEnd, observations: pre.length },
      postWindow: { startDate: postStart, endDate: postEnd, observations: post.length },
    };
  });
  if (!windows.some(window => window.status === "available")) {
    return { status: "unavailable" as const, reason: "no_valid_comparison_window" as const, windows };
  }
  return {
    status: "available" as const,
    releaseDate: input.releaseDate,
    metricKey: input.metricKey,
    method: "median_7d_pre_vs_median_5d_centered_on_post_day_v1" as const,
    windows,
  };
}

