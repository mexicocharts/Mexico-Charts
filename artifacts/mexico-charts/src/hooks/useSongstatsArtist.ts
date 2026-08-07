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

export interface SongstatsMetricGrowth {
  days7: SongstatsGrowthWindow | null;
  days30: SongstatsGrowthWindow | null;
  days90: SongstatsGrowthWindow | null;
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
}

export function useSongstatsArtist(artistKey: string) {
  return useQuery<SongstatsArtistData | null>({
    queryKey: ["songstatsArtist", artistKey],
    queryFn: async () => {
      if (!artistKey) return null;
      const response = await fetch(
        `/api/providers/songstats/artist?artistKey=${encodeURIComponent(artistKey)}`,
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Songstats artist request failed: ${response.status}`);
      return response.json() as Promise<SongstatsArtistData>;
    },
    enabled: Boolean(artistKey),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
}
