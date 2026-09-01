import { createHash } from "node:crypto";
import { artistInfoFromPayload } from "./songstats-info";
import type { SongstatsHistoricStatsResponse } from "./songstats-client";

export const SONGSTATS_HISTORY_DEFINITION_VERSION = 1;
export const SONGSTATS_HISTORY_ACQUISITION_MODE = "songstats_historical" as const;
export const SONGSTATS_HISTORY_GRANULARITY = "daily" as const;

export type SongstatsIdentityValidationStatus =
  | "verified"
  | "review"
  | "rejected";

export interface SongstatsHistoryMetricDefinition {
  source: string;
  providerField: string;
  metricKey: string;
  label: string;
  unit: "count" | "score";
  behavior: "cumulative" | "rolling" | "current_count";
  commercialEndpoint: "artist_historical_stats";
  ingestionStatus: "active" | "quarantined";
}

const metric = (
  source: string,
  providerField: string,
  metricKey: string,
  label: string,
  unit: SongstatsHistoryMetricDefinition["unit"] = "count",
  behavior: SongstatsHistoryMetricDefinition["behavior"] = "cumulative",
  ingestionStatus: SongstatsHistoryMetricDefinition["ingestionStatus"] = "active",
): SongstatsHistoryMetricDefinition => ({
  source,
  providerField,
  metricKey,
  label,
  unit,
  behavior,
  commercialEndpoint: "artist_historical_stats",
  ingestionStatus,
});

// Explicit allow-list from the licensed Artist Historical Stats response. This
// intentionally excludes track, activity, playlist-event, and chart-event
// endpoints, even when similarly named fields exist elsewhere in Songstats.
export const SONGSTATS_HISTORY_METRICS: readonly SongstatsHistoryMetricDefinition[] = [
  metric("spotify", "popularity_current", "spotifyPopularity", "Spotify popularity", "score", "current_count"),
  metric("spotify", "followers_total", "spotifyFollowers", "Spotify followers"),
  metric("spotify", "monthly_listeners_current", "spotifyMonthlyListeners", "Spotify monthly listeners", "count", "rolling"),
  metric("spotify", "streams_total", "spotifyStreams", "Spotify aggregate streams"),
  // Older documented examples used streams_current for the same artist-level
  // series. It remains a separate key until production payload semantics prove
  // equivalence; the importer never silently aliases it to streams_total.
  metric("spotify", "streams_current", "spotifyStreamsCurrent", "Spotify streams (provider current field)", "count", "current_count", "quarantined"),
  metric("spotify", "playlists_current", "spotifyPlaylists", "Spotify current playlists", "count", "current_count"),
  metric("spotify", "playlist_reach_current", "spotifyPlaylistReach", "Spotify current playlist reach", "count", "current_count"),
  metric("spotify", "charts_current", "spotifyCharts", "Spotify current charts", "count", "current_count"),
  metric("spotify", "charted_tracks_current", "spotifyChartedTracks", "Spotify currently charted tracks", "count", "current_count"),

  metric("apple_music", "playlists_current", "appleMusicPlaylists", "Apple Music current playlists", "count", "current_count"),
  metric("apple_music", "charts_current", "appleMusicCharts", "Apple Music current charts", "count", "current_count"),
  metric("apple_music", "track_charts_current", "appleMusicTrackCharts", "Apple Music current track charts", "count", "current_count"),

  metric("deezer", "followers_total", "deezerFollowers", "Deezer followers"),
  metric("deezer", "popularity_current", "deezerPopularity", "Deezer popularity", "score", "current_count"),
  metric("deezer", "playlists_current", "deezerPlaylists", "Deezer current playlists", "count", "current_count"),
  metric("deezer", "playlist_reach_current", "deezerPlaylistReach", "Deezer current playlist reach", "count", "current_count"),

  metric("instagram", "followers_total", "instagramFollowers", "Instagram followers"),
  metric("instagram", "videos_total", "instagramVideos", "Instagram videos"),
  metric("instagram", "views_total", "instagramViews", "Instagram views"),
  metric("instagram", "likes_total", "instagramLikes", "Instagram likes"),
  metric("instagram", "comments_total", "instagramComments", "Instagram comments"),

  metric("tiktok", "followers_total", "tiktokFollowers", "TikTok followers"),
  metric("tiktok", "videos_total", "tiktokVideos", "TikTok videos"),
  metric("tiktok", "views_total", "tiktokViews", "TikTok views"),
  metric("tiktok", "likes_total", "tiktokLikes", "TikTok likes"),
  metric("tiktok", "shares_total", "tiktokShares", "TikTok shares"),
  metric("tiktok", "comments_total", "tiktokComments", "TikTok comments"),
  metric("tiktok", "profile_likes_total", "tiktokProfileLikes", "TikTok profile likes"),

  metric("youtube", "subscribers_total", "youtubeSubscribers", "YouTube subscribers"),
  metric("youtube", "video_views_total", "youtubeChannelViews", "YouTube aggregate video views"),
  metric("youtube", "video_likes_total", "youtubeVideoLikes", "YouTube aggregate video likes"),
  metric("youtube", "video_comments_total", "youtubeVideoComments", "YouTube aggregate video comments"),
  metric("youtube", "videos_total", "youtubeVideos", "YouTube videos"),
  metric("youtube", "shorts_total", "youtubeShorts", "YouTube Shorts"),
  metric("youtube", "short_views_total", "youtubeShortViews", "YouTube Shorts views"),
  metric("youtube", "short_likes_total", "youtubeShortLikes", "YouTube Shorts likes"),
  metric("youtube", "playlists_current", "youtubePlaylists", "YouTube current playlists", "count", "current_count"),

  metric("facebook", "followers_total", "facebookFollowers", "Facebook followers"),
  metric("twitter", "followers_total", "twitterFollowers", "X followers"),
  metric("soundcloud", "followers_total", "soundcloudFollowers", "SoundCloud followers"),
  metric("soundcloud", "streams_total", "soundcloudStreams", "SoundCloud streams"),
  metric("soundcloud", "favorites_total", "soundcloudFavorites", "SoundCloud favorites"),
  metric("soundcloud", "reposts_total", "soundcloudReposts", "SoundCloud reposts"),
  metric("tidal", "followers_total", "tidalFollowers", "TIDAL followers"),
  metric("tidal", "popularity_current", "tidalPopularity", "TIDAL popularity", "score", "current_count"),
  metric("tidal", "playlists_current", "tidalPlaylists", "TIDAL current playlists", "count", "current_count"),
  metric("tidal", "charts_current", "tidalCharts", "TIDAL current charts", "count", "current_count"),
  metric("shazam", "shazams_total", "shazamCount", "Shazams"),
  metric("shazam", "charted_tracks_current", "shazamChartedTracks", "Shazam currently charted tracks", "count", "current_count"),
];

export const SONGSTATS_HISTORY_ACTIVE_METRICS = SONGSTATS_HISTORY_METRICS
  .filter(definition => definition.ingestionStatus === "active");

export const SONGSTATS_HISTORY_QUARANTINED_METRICS = SONGSTATS_HISTORY_METRICS
  .filter(definition => definition.ingestionStatus === "quarantined");

const metricByProviderKey = new Map(
  SONGSTATS_HISTORY_METRICS.map(definition => [
    `${definition.source}:${definition.providerField}`,
    definition,
  ]),
);

export interface SongstatsHistoryWindow {
  startDate: string;
  endDate: string;
  year: number;
}

export function yearlySongstatsHistoryWindows(
  startDate: string,
  endDate: string,
): SongstatsHistoryWindow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("Songstats history dates must use YYYY-MM-DD");
  }
  if (startDate > endDate) throw new Error("Songstats history start date must not exceed end date");
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  return Array.from({ length: endYear - startYear + 1 }, (_, offset) => {
    const year = startYear + offset;
    return {
      year,
      startDate: year === startYear ? startDate : `${year}-01-01`,
      endDate: year === endYear ? endDate : `${year}-12-31`,
    };
  });
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function decimalString(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? String(value) : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim();
  return /^\d+(?:\.\d+)?$/.test(normalized) ? normalized : null;
}

export interface NormalizedSongstatsHistoricalObservation {
  artistKey: string;
  metricDefinition: SongstatsHistoryMetricDefinition;
  providerObservationDate: string;
  value: string;
  granularity: typeof SONGSTATS_HISTORY_GRANULARITY;
  acquisitionMode: typeof SONGSTATS_HISTORY_ACQUISITION_MODE;
  fetchedAt: Date;
}

export interface NormalizeSongstatsHistoryResult {
  identityValidationStatus: SongstatsIdentityValidationStatus;
  identityEvidence: Record<string, unknown>;
  songstatsArtistId: string | null;
  observations: NormalizedSongstatsHistoricalObservation[];
  duplicateCount: number;
  ignoredFieldCount: number;
  conflicts: string[];
  responseHash: string;
}

export function normalizeSongstatsHistoricStats(input: {
  artistKey: string;
  spotifyArtistId: string;
  expectedSongstatsArtistId: string | null;
  requestIdentityType: "spotify_artist_id" | "songstats_artist_id";
  requestIdentityValue: string;
  windowStartDate: string;
  windowEndDate: string;
  fetchedAt: Date;
  importRunId: string;
  includeQuarantined?: boolean;
  payload: SongstatsHistoricStatsResponse;
}): NormalizeSongstatsHistoryResult {
  const responseHash = createHash("sha256")
    .update(JSON.stringify(input.payload))
    .digest("hex");
  const payloadRecord = input.payload as Record<string, unknown>;
  const info = artistInfoFromPayload(payloadRecord);
  const returnedSongstatsArtistId = info?.songstats_artist_id?.trim() || null;
  const expectedSongstatsArtistId = input.expectedSongstatsArtistId?.trim() || null;
  const identityValidationStatus: SongstatsIdentityValidationStatus =
    !expectedSongstatsArtistId || !returnedSongstatsArtistId
      ? "review"
      : expectedSongstatsArtistId === returnedSongstatsArtistId
        ? "verified"
        : "rejected";
  const identityEvidence = {
    requestedSpotifyArtistId: input.spotifyArtistId,
    expectedSongstatsArtistId,
    returnedSongstatsArtistId,
    returnedName: info?.name ?? null,
    validationRule: "stored_songstats_id_matches_historic_payload_artist_info",
  };

  if (identityValidationStatus !== "verified" || !returnedSongstatsArtistId) {
    return {
      identityValidationStatus,
      identityEvidence,
      songstatsArtistId: returnedSongstatsArtistId,
      observations: [],
      duplicateCount: 0,
      ignoredFieldCount: 0,
      conflicts: [],
      responseHash,
    };
  }

  const observations = new Map<string, NormalizedSongstatsHistoricalObservation>();
  const conflicts: string[] = [];
  let duplicateCount = 0;
  let ignoredFieldCount = 0;
  for (const rawSource of Array.isArray(input.payload.stats) ? input.payload.stats : []) {
    const source = String(rawSource.source ?? "").trim().toLowerCase();
    const data = recordValue(rawSource.data);
    const history = Array.isArray(data?.["history"]) ? data["history"] : [];
    for (const rawRow of history) {
      const row = recordValue(rawRow);
      if (!row) continue;
      const date = typeof row?.["date"] === "string" ? row["date"] : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (date < input.windowStartDate || date > input.windowEndDate) continue;
      for (const [providerField, rawValue] of Object.entries(row)) {
        if (providerField === "date") continue;
        const definition = metricByProviderKey.get(`${source}:${providerField}`);
        const value = decimalString(rawValue);
        if (!definition || value == null) {
          ignoredFieldCount += 1;
          continue;
        }
        if (definition.ingestionStatus === "quarantined" && !input.includeQuarantined) {
          ignoredFieldCount += 1;
          continue;
        }
        const key = `${source}:${definition.metricKey}:${date}`;
        const existing = observations.get(key);
        if (existing) {
          duplicateCount += 1;
          if (existing.value !== value) {
            conflicts.push(`${key}:${existing.value}:${value}`);
          }
          continue;
        }
        observations.set(key, {
          artistKey: input.artistKey,
          metricDefinition: definition,
          providerObservationDate: date,
          value,
          granularity: SONGSTATS_HISTORY_GRANULARITY,
          acquisitionMode: SONGSTATS_HISTORY_ACQUISITION_MODE,
          fetchedAt: input.fetchedAt,
        });
      }
    }
  }

  return {
    identityValidationStatus,
    identityEvidence,
    songstatsArtistId: returnedSongstatsArtistId,
    observations: conflicts.length ? [] : [...observations.values()],
    duplicateCount,
    ignoredFieldCount,
    conflicts,
    responseHash,
  };
}

export function estimateSongstatsHistoryStorage(input: {
  artistCount: number;
  startDate: string;
  endDate: string;
  metricCount: number;
  bytesPerObservation?: number;
}) {
  const start = Date.parse(`${input.startDate}T12:00:00Z`);
  const end = Date.parse(`${input.endDate}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new Error("Invalid storage-estimate date range");
  }
  const inclusiveDays = Math.floor((end - start) / 86_400_000) + 1;
  const observationCount = input.artistCount * inclusiveDays * input.metricCount;
  const bytesPerObservation = input.bytesPerObservation ?? 320;
  const observationBytes = observationCount * bytesPerObservation;
  return {
    inclusiveDays,
    observationCount,
    bytesPerObservation,
    observationBytes,
    gibibytes: Math.round((observationBytes / 1024 ** 3) * 100) / 100,
    note: "Compact-schema all-in planning target; validate heap and index bytes per point with representative test imports",
  };
}

export function planSongstatsHistoryBackfill(input: {
  artistCount: number;
  startDate: string;
  endDate: string;
  metricCount?: number;
}) {
  const windows = yearlySongstatsHistoryWindows(input.startDate, input.endDate);
  const metricCount = input.metricCount ?? SONGSTATS_HISTORY_ACTIVE_METRICS.length;
  return {
    endpoint: "/artists/historic_stats" as const,
    commercialEndpoint: "artist_historical_stats" as const,
    source: "all" as const,
    withAggregates: true,
    artistCount: input.artistCount,
    startDate: input.startDate,
    endDate: input.endDate,
    yearlyWindows: windows,
    requestsPerArtist: windows.length,
    plannedRequestCount: input.artistCount * windows.length,
    excludedEndpoints: [
      "/artists/activities",
      "/tracks/historic_stats",
      "/tracks/stats",
      "playlist event endpoints",
      "chart event endpoints",
    ],
    storageUpperBound: estimateSongstatsHistoryStorage({
      artistCount: input.artistCount,
      startDate: input.startDate,
      endDate: input.endDate,
      metricCount,
    }),
  };
}
