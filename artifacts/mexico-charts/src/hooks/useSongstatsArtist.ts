import { useQuery } from "@tanstack/react-query";

export interface SongstatsArtistSnapshot {
  snapshotDate: string | null;
  spotifyFollowers: number | null;
  spotifyMonthlyListeners: number | null;
  spotifyPopularity: number | null;
  youtubeSubscribers: number | null;
  youtubeChannelViews: number | null;
  instagramFollowers: number | null;
  tiktokFollowers: number | null;
  facebookFollowers: number | null;
  twitterFollowers: number | null;
  soundcloudFollowers: number | null;
  deezerFollowers: number | null;
  fetchedAt: string | null;
}

export interface SongstatsGrowthWindow {
  absolute: number;
  percentage: number | null;
}

export interface SongstatsGrowthEvidence {
  requestedDays: number;
  baselineTargetDate: string;
  baseline: SongstatsTrendPoint | null;
  latest: SongstatsTrendPoint | null;
  baselineOffsetDays: number | null;
  storedDateIntervalDays: number | null;
  dateBasis: "normalized_history_date";
  collectionTime: null;
  collectionIntervalDays: null;
  providerMeasurementTime: null;
  providerMeasurementIntervalDays: null;
  percentageAvailability: "available" | "zero_baseline" | "missing_baseline" | "same_date";
}

export interface SongstatsMetricGrowth {
  days7: SongstatsGrowthWindow | null;
  days15: SongstatsGrowthWindow | null;
  days30: SongstatsGrowthWindow | null;
  days90: SongstatsGrowthWindow | null;
  evidence?: Record<"days7" | "days15" | "days30" | "days90", SongstatsGrowthEvidence | null>;
}

export interface SongstatsTrendPoint {
  date: string;
  value: number;
}

export interface SongstatsMexicoCity {
  name: string;
  region: string | null;
  countryCode: string;
  currentListeners: number;
  peakListeners: number | null;
}

export interface SongstatsRelease {
  id: string;
  title: string;
  type: "album" | "single" | "ep" | "track" | "release";
  releaseDate: string | null;
  artworkUrl: string | null;
  platformCount: number;
}

export interface SongstatsCatalogSummary {
  releaseCount: number;
  trackCount: number;
  albumCount: number | null;
  releasesLast90Days: number;
  medianReleaseGapDays: number | null;
  newestReleaseDate: string | null;
  releases: SongstatsRelease[];
}

export interface SongstatsReleaseComparison {
  metric: string;
  nominalDaysAfterRelease: number;
  baselineTargetDate: string;
  followupTargetDate: string;
  baseline: SongstatsTrendPoint | null;
  followup: SongstatsTrendPoint | null;
  baselineOffsetDays: number | null;
  followupOffsetDays: number | null;
  storedDateIntervalDays: number | null;
  dateBasis: "normalized_history_date";
  providerMeasurementTime: null;
  percentage: number | null;
}

export interface SongstatsReleaseImpact {
  release: SongstatsRelease;
  score: number | null;
  confidence: "high" | "medium" | "collecting";
  platformsMeasured: number;
  lift7: number | null;
  lift30: number | null;
  lift90: number | null;
  comparisons?: SongstatsReleaseComparison[];
}

export interface SongstatsArtistData {
  artistKey: string;
  name: string | null;
  avatarUrl: string | null;
  snapshot: SongstatsArtistSnapshot;
  growth: Partial<Record<
    | "spotifyMonthlyListeners"
    | "spotifyFollowers"
    | "instagramFollowers"
    | "tiktokFollowers"
    | "youtubeSubscribers"
    | "youtubeChannelViews"
    | "facebookFollowers"
    | "twitterFollowers"
    | "soundcloudFollowers"
    | "deezerFollowers",
    SongstatsMetricGrowth
  >>;
  trends: Partial<Record<
    | "spotifyMonthlyListeners"
    | "instagramFollowers"
    | "tiktokFollowers"
    | "youtubeSubscribers",
    SongstatsTrendPoint[]
  >>;
  topMexicoCities: SongstatsMexicoCity[];
  catalog: SongstatsCatalogSummary;
  latestReleaseImpact: SongstatsReleaseImpact | null;
}

async function fetchSongstatsArtist(artistKey: string): Promise<SongstatsArtistData | null> {
  if (!artistKey) return null;
  const response = await fetch(
    `/api/providers/songstats/artist?artistKey=${encodeURIComponent(artistKey)}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Songstats artist request failed: ${response.status}`);
  return response.json() as Promise<SongstatsArtistData>;
}

export function useSongstatsArtist(artistKey: string) {
  return useQuery<SongstatsArtistData | null>({
    queryKey: ["songstatsArtist", artistKey],
    queryFn: () => fetchSongstatsArtist(artistKey),
    enabled: Boolean(artistKey),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
}

/** Fetches a small, explicit artist set from the same stored snapshots used by profiles. */
export function useSongstatsArtists(artistKeys: string[]) {
  const keys = [...new Set(artistKeys.filter(Boolean))].sort();
  return useQuery<Record<string, SongstatsArtistData | null>>({
    queryKey: ["songstatsArtists", keys.join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        keys.map(async key => [key, await fetchSongstatsArtist(key)] as const),
      );
      return Object.fromEntries(entries);
    },
    enabled: keys.length > 0,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
}
