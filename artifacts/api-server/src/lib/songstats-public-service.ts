type JsonObject = Record<string, unknown>;

export type SongstatsPublicMetricKey =
  | "spotifyMonthlyListeners"
  | "spotifyFollowers"
  | "instagramFollowers"
  | "tiktokFollowers"
  | "youtubeSubscribers"
  | "youtubeChannelViews"
  | "facebookFollowers"
  | "twitterFollowers"
  | "soundcloudFollowers"
  | "deezerFollowers";

export interface SongstatsPublicTrendPoint {
  date: string;
  value: number;
}

export interface SongstatsPublicGrowthWindow {
  absolute: number;
  percentage: number | null;
}

export interface SongstatsPublicMetricGrowth {
  days7: SongstatsPublicGrowthWindow | null;
  days30: SongstatsPublicGrowthWindow | null;
  days90: SongstatsPublicGrowthWindow | null;
}

export interface SongstatsPublicCity {
  name: string;
  region: string | null;
  countryCode: string;
  currentListeners: number;
  peakListeners: number | null;
}

export interface SongstatsPublicInsight {
  name: string | null;
  avatarUrl: string | null;
  snapshotDate: string | null;
  current: Record<SongstatsPublicMetricKey, number | null>;
  growth: Partial<Record<SongstatsPublicMetricKey, SongstatsPublicMetricGrowth>>;
  trends: Partial<Record<SongstatsPublicMetricKey, SongstatsPublicTrendPoint[]>>;
  topMexicoCities: SongstatsPublicCity[];
}

const METRICS: Array<{
  key: SongstatsPublicMetricKey;
  source: string;
  field: string;
}> = [
  {
    key: "spotifyMonthlyListeners",
    source: "spotify",
    field: "monthly_listeners_current",
  },
  {
    key: "spotifyFollowers",
    source: "spotify",
    field: "followers_total",
  },
  {
    key: "instagramFollowers",
    source: "instagram",
    field: "followers_total",
  },
  {
    key: "tiktokFollowers",
    source: "tiktok",
    field: "followers_total",
  },
  {
    key: "youtubeSubscribers",
    source: "youtube",
    field: "subscribers_total",
  },
  {
    key: "youtubeChannelViews",
    source: "youtube",
    field: "video_views_total",
  },
  {
    key: "facebookFollowers",
    source: "facebook",
    field: "followers_total",
  },
  {
    key: "twitterFollowers",
    source: "twitter",
    field: "followers_total",
  },
  {
    key: "soundcloudFollowers",
    source: "soundcloud",
    field: "followers_total",
  },
  {
    key: "deezerFollowers",
    source: "deezer",
    field: "followers_total",
  },
];

const TREND_KEYS = new Set<SongstatsPublicMetricKey>([
  "spotifyMonthlyListeners",
  "instagramFollowers",
  "tiktokFollowers",
  "youtubeSubscribers",
]);

function objectValue(value: unknown): JsonObject | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceHistories(historicStats: JsonObject | null) {
  const result = new Map<string, JsonObject[]>();
  for (const rawSource of arrayValue(historicStats?.["stats"])) {
    const source = objectValue(rawSource);
    const sourceName = stringValue(source?.["source"])?.toLowerCase();
    const data = objectValue(source?.["data"]);
    if (!sourceName || !data) continue;
    const history = arrayValue(data["history"])
      .map(objectValue)
      .filter((row): row is JsonObject => row != null)
      .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(stringValue(row["date"]) ?? ""))
      .sort((a, b) => String(a["date"]).localeCompare(String(b["date"])));
    if (history.length) result.set(sourceName, history);
  }
  return result;
}

function pointsForMetric(
  histories: Map<string, JsonObject[]>,
  source: string,
  field: string,
): SongstatsPublicTrendPoint[] {
  return (histories.get(source) ?? []).flatMap(row => {
    const date = stringValue(row["date"]);
    const value = numberValue(row[field]);
    return date && value != null && value >= 0 ? [{ date, value }] : [];
  });
}

function closestPointAtOrBefore(
  points: SongstatsPublicTrendPoint[],
  targetDate: Date,
): SongstatsPublicTrendPoint | null {
  const target = targetDate.toISOString().slice(0, 10);
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]!;
    if (point.date <= target) return point;
  }
  return null;
}

function growthWindow(
  points: SongstatsPublicTrendPoint[],
  days: number,
): SongstatsPublicGrowthWindow | null {
  const latest = points.at(-1);
  if (!latest) return null;
  const target = new Date(`${latest.date}T12:00:00.000Z`);
  target.setUTCDate(target.getUTCDate() - days);
  const previous = closestPointAtOrBefore(points, target);
  if (!previous || previous.date === latest.date) return null;
  const absolute = latest.value - previous.value;
  const percentage = previous.value === 0
    ? null
    : Math.round((absolute / previous.value) * 10_000) / 100;
  return { absolute, percentage };
}

function downsampleRecent(
  points: SongstatsPublicTrendPoint[],
  days = 180,
  maximumPoints = 30,
): SongstatsPublicTrendPoint[] {
  const latest = points.at(-1);
  if (!latest) return [];
  const cutoff = new Date(`${latest.date}T12:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const recent = points.filter(point => point.date >= cutoffDate);
  if (recent.length <= maximumPoints) return recent;
  const step = (recent.length - 1) / (maximumPoints - 1);
  return Array.from({ length: maximumPoints }, (_, index) => (
    recent[Math.round(index * step)]!
  ));
}

function artistInfoFromPayload(historicStats: JsonObject | null) {
  return objectValue(historicStats?.["artist_info"]);
}

function spotifyAudienceData(payload: JsonObject | null): JsonObject | null {
  const spotifyEntry = arrayValue(payload?.["audience"])
    .map(objectValue)
    .find(entry => stringValue(entry?.["source"])?.toLowerCase() === "spotify");
  return objectValue(spotifyEntry?.["data"]);
}

function spotifyDetailPayload(audienceDetails: JsonObject | null): JsonObject | null {
  const sources = objectValue(audienceDetails?.["sources"]);
  return objectValue(sources?.["spotify"]);
}

function topMexicoCities(
  audience: JsonObject | null,
  audienceDetails: JsonObject | null,
): SongstatsPublicCity[] {
  const detailsData = spotifyAudienceData(spotifyDetailPayload(audienceDetails));
  const generalData = spotifyAudienceData(audience);
  const cityRows = arrayValue(
    detailsData?.["monthly_listeners"] ?? generalData?.["monthly_listeners"],
  );
  return cityRows.flatMap(rawCity => {
    const city = objectValue(rawCity);
    const name = stringValue(city?.["city_name"]);
    const countryCode = stringValue(city?.["country_code"])?.toUpperCase();
    const currentListeners = numberValue(city?.["current_listeners"]);
    if (!name || countryCode !== "MX" || currentListeners == null) return [];
    return [{
      name,
      region: stringValue(city?.["city_region"]),
      countryCode,
      currentListeners,
      peakListeners: numberValue(city?.["peak_listeners"]),
    }];
  })
    .sort((a, b) => b.currentListeners - a.currentListeners)
    .slice(0, 5);
}

export function buildSongstatsPublicInsight(input: {
  historicStats: unknown;
  audience: unknown;
  audienceDetails: unknown;
}): SongstatsPublicInsight {
  const historicStats = objectValue(input.historicStats);
  const audience = objectValue(input.audience);
  const audienceDetails = objectValue(input.audienceDetails);
  const histories = sourceHistories(historicStats);
  const current = Object.fromEntries(
    METRICS.map(metric => [metric.key, null]),
  ) as Record<SongstatsPublicMetricKey, number | null>;
  const growth: SongstatsPublicInsight["growth"] = {};
  const trends: SongstatsPublicInsight["trends"] = {};
  let snapshotDate: string | null = null;

  for (const metric of METRICS) {
    const points = pointsForMetric(histories, metric.source, metric.field);
    const latest = points.at(-1);
    current[metric.key] = latest?.value ?? null;
    if (latest?.date && (!snapshotDate || latest.date > snapshotDate)) {
      snapshotDate = latest.date;
    }
    if (points.length >= 2) {
      growth[metric.key] = {
        days7: growthWindow(points, 7),
        days30: growthWindow(points, 30),
        days90: growthWindow(points, 90),
      };
    }
    if (TREND_KEYS.has(metric.key)) {
      const sampled = downsampleRecent(points);
      if (sampled.length >= 2) trends[metric.key] = sampled;
    }
  }

  const artistInfo = artistInfoFromPayload(historicStats);
  return {
    name: stringValue(artistInfo?.["name"]),
    avatarUrl: stringValue(artistInfo?.["avatar"]),
    snapshotDate,
    current,
    growth,
    trends,
    topMexicoCities: topMexicoCities(audience, audienceDetails),
  };
}
