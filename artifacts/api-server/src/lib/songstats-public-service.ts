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

export interface SongstatsPublicRelease {
  id: string;
  title: string;
  type: "album" | "single" | "ep" | "track" | "release";
  releaseDate: string | null;
  artworkUrl: string | null;
  platformCount: number;
}

export interface SongstatsPublicCatalog {
  releaseCount: number;
  trackCount: number;
  albumCount: number;
  releasesLast90Days: number;
  medianReleaseGapDays: number | null;
  newestReleaseDate: string | null;
  releases: SongstatsPublicRelease[];
}

export interface SongstatsPublicReleaseImpact {
  release: SongstatsPublicRelease;
  score: number | null;
  confidence: "high" | "medium" | "collecting";
  platformsMeasured: number;
  lift7: number | null;
  lift30: number | null;
  lift90: number | null;
}

export interface SongstatsPublicInsight {
  name: string | null;
  avatarUrl: string | null;
  platformLinks: Array<{ source: string; url: string }>;
  snapshotDate: string | null;
  current: Record<SongstatsPublicMetricKey, number | null>;
  growth: Partial<Record<SongstatsPublicMetricKey, SongstatsPublicMetricGrowth>>;
  trends: Partial<Record<SongstatsPublicMetricKey, SongstatsPublicTrendPoint[]>>;
  topMexicoCities: SongstatsPublicCity[];
  catalog: SongstatsPublicCatalog;
  latestReleaseImpact: SongstatsPublicReleaseImpact | null;
}

function normalizedPlatformLinks(artistInfo: JsonObject | null) {
  const links = arrayValue(artistInfo?.["links"]);
  const seen = new Set<string>();
  return links.flatMap(rawLink => {
    const link = objectValue(rawLink);
    const url = stringValue(link?.["url"] ?? link?.["href"] ?? link?.["link"]);
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return [];
    const explicitSource = stringValue(link?.["source"] ?? link?.["platform"] ?? link?.["name"]);
    let source = explicitSource?.toLowerCase().replace(/[^a-z0-9]+/g, "_") ?? "website";
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes("spotify")) source = "spotify";
      else if (host.includes("youtube") || host.includes("youtu.be")) source = "youtube";
      else if (host.includes("music.apple")) source = "apple_music";
      else if (host.includes("instagram")) source = "instagram";
      else if (host.includes("tiktok")) source = "tiktok";
      else if (host.includes("deezer")) source = "deezer";
      else if (host.includes("musicbrainz")) source = "musicbrainz";
    } catch {
      return [];
    }
    seen.add(url);
    return [{ source, url }];
  });
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

function firstString(record: JsonObject | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = stringValue(record?.[key]);
    if (value) return value;
  }
  return null;
}

function isoDateValue(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0]!;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function firstDate(record: JsonObject | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = isoDateValue(record?.[key]);
    if (value) return value;
  }
  return null;
}

function firstArrayAtKeys(root: JsonObject | null, keys: string[]): unknown[] {
  if (!root) return [];
  const queue: JsonObject[] = [root];
  const visited = new Set<JsonObject>();
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const key of keys) {
      const candidate = current[key];
      if (Array.isArray(candidate)) return candidate;
    }
    for (const value of Object.values(current)) {
      const nested = objectValue(value);
      if (nested) queue.push(nested);
    }
  }
  return [];
}

function releaseType(record: JsonObject | null, fallback: SongstatsPublicRelease["type"]) {
  const raw = firstString(record, ["type", "release_type", "album_type", "kind"])?.toLowerCase();
  if (raw?.includes("album")) return "album";
  if (raw?.includes("single")) return "single";
  if (raw === "ep" || raw?.includes("extended")) return "ep";
  if (raw?.includes("track")) return "track";
  return fallback;
}

function releaseFromRow(raw: unknown, fallback: SongstatsPublicRelease["type"]): SongstatsPublicRelease | null {
  const row = objectValue(raw);
  if (!row) return null;
  const nestedAlbum = objectValue(row["album"] ?? row["release"]);
  const title = firstString(row, ["name", "title", "track_name", "album_name", "release_name"])
    ?? firstString(nestedAlbum, ["name", "title", "album_name"]);
  if (!title) return null;
  const releaseDate = firstDate(row, ["release_date", "releaseDate", "released_at", "date", "published_at"])
    ?? firstDate(nestedAlbum, ["release_date", "releaseDate", "released_at", "date"]);
  const id = firstString(row, ["id", "track_id", "album_id", "release_id", "spotify_id", "isrc", "upc"])
    ?? `${title.toLowerCase()}|${releaseDate ?? "unknown"}`;
  const artworkUrl = firstString(row, ["artwork_url", "image_url", "cover_url", "thumbnail_url"])
    ?? firstString(nestedAlbum, ["artwork_url", "image_url", "cover_url", "thumbnail_url"]);
  const links = arrayValue(row["links"] ?? row["platform_links"] ?? row["sources"]);
  return {
    id,
    title,
    type: releaseType(row, fallback),
    releaseDate,
    artworkUrl: artworkUrl && /^https?:\/\//i.test(artworkUrl) ? artworkUrl : null,
    platformCount: links.length,
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function normalizedCatalog(catalogPayload: JsonObject | null): SongstatsPublicCatalog {
  const trackRows = firstArrayAtKeys(catalogPayload, ["tracks", "songs", "recordings"]);
  const albumRows = firstArrayAtKeys(catalogPayload, ["albums", "releases", "discography"]);
  const candidates = [
    ...albumRows.map(row => releaseFromRow(row, "album")),
    ...trackRows.map(row => releaseFromRow(row, "track")),
  ].filter((release): release is SongstatsPublicRelease => release != null);
  const deduped = [...new Map(candidates.map(release => [release.id, release])).values()]
    .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
  const dated = deduped.filter(release => release.releaseDate != null);
  const latest = dated[0]?.releaseDate ?? null;
  const ninetyDayCutoff = latest ? new Date(`${latest}T12:00:00.000Z`) : null;
  ninetyDayCutoff?.setUTCDate(ninetyDayCutoff.getUTCDate() - 89);
  const gaps = dated.slice(1).flatMap((release, index) => {
    const newer = dated[index]?.releaseDate;
    if (!newer || !release.releaseDate) return [];
    return [Math.round((Date.parse(`${newer}T12:00:00Z`) - Date.parse(`${release.releaseDate}T12:00:00Z`)) / 86_400_000)];
  }).filter(gap => gap >= 0);
  return {
    releaseCount: deduped.length,
    trackCount: trackRows.length,
    albumCount: albumRows.length,
    releasesLast90Days: ninetyDayCutoff
      ? dated.filter(release => Date.parse(`${release.releaseDate}T12:00:00Z`) >= ninetyDayCutoff.getTime()).length
      : 0,
    medianReleaseGapDays: median(gaps),
    newestReleaseDate: latest,
    releases: deduped.slice(0, 12),
  };
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

function pointAtOrAfter(points: SongstatsPublicTrendPoint[], targetDate: string) {
  return points.find(point => point.date >= targetDate) ?? null;
}

function dateOffset(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function releaseLift(points: SongstatsPublicTrendPoint[], releaseDate: string, days: number) {
  const baseline = closestPointAtOrBefore(points, new Date(`${dateOffset(releaseDate, -1)}T12:00:00.000Z`));
  const after = pointAtOrAfter(points, dateOffset(releaseDate, days));
  if (!baseline || !after || baseline.value <= 0) return null;
  return Math.round(((after.value - baseline.value) / baseline.value) * 1_000) / 10;
}

function average(values: Array<number | null>) {
  const available = values.filter((value): value is number => value != null);
  if (!available.length) return null;
  return Math.round((available.reduce((sum, value) => sum + value, 0) / available.length) * 10) / 10;
}

function latestReleaseImpact(
  catalog: SongstatsPublicCatalog,
  trends: SongstatsPublicInsight["trends"],
): SongstatsPublicReleaseImpact | null {
  const release = catalog.releases.find(item => item.releaseDate != null);
  if (!release?.releaseDate) return null;
  const series = [
    trends.spotifyMonthlyListeners ?? [],
    trends.instagramFollowers ?? [],
    trends.tiktokFollowers ?? [],
    trends.youtubeSubscribers ?? [],
  ].filter(points => points.length >= 2);
  if (!series.length) {
    return { release, score: null, confidence: "collecting", platformsMeasured: 0, lift7: null, lift30: null, lift90: null };
  }
  const lift7 = average(series.map(points => releaseLift(points, release.releaseDate!, 7)));
  const lift30 = average(series.map(points => releaseLift(points, release.releaseDate!, 30)));
  const lift90 = average(series.map(points => releaseLift(points, release.releaseDate!, 90)));
  const measured = series.filter(points => releaseLift(points, release.releaseDate!, 30) != null).length;
  const score = lift30 == null ? null : Math.max(0, Math.min(100, Math.round((Math.max(0, lift30) / 40) * 100)));
  return {
    release,
    score,
    confidence: measured >= 3 ? "high" : measured >= 2 ? "medium" : "collecting",
    platformsMeasured: measured,
    lift7,
    lift30,
    lift90,
  };
}

export function buildSongstatsPublicInsight(input: {
  historicStats: unknown;
  audience: unknown;
  audienceDetails: unknown;
  catalog?: unknown;
}): SongstatsPublicInsight {
  const historicStats = objectValue(input.historicStats);
  const audience = objectValue(input.audience);
  const audienceDetails = objectValue(input.audienceDetails);
  const catalog = normalizedCatalog(objectValue(input.catalog));
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
    platformLinks: normalizedPlatformLinks(artistInfo),
    snapshotDate,
    current,
    growth,
    trends,
    topMexicoCities: topMexicoCities(audience, audienceDetails),
    catalog,
    latestReleaseImpact: latestReleaseImpact(catalog, trends),
  };
}
