import { useQuery } from "@tanstack/react-query";

export interface SongstatsArtistSnapshot {
  snapshotDate: string;
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
  fetchedAt: string;
}

export interface SongstatsArtistData {
  artistKey: string;
  name: string | null;
  avatarUrl: string | null;
  snapshot: SongstatsArtistSnapshot;
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
