import { useQuery } from "@tanstack/react-query";

/* ── Types ─────────────────────────────────────────────────────────────── */
export interface KworbTrack {
  title: string;
  streams: number;
  streamsFmt: string;
  daily: number;
  dailyFmt: string;
}

export interface KworbVideo {
  title: string;
  views: number;
  viewsFmt: string;
  daily: number;
  dailyFmt: string;
  published: string;
}

export interface KworbChartPosition {
  song: string;
  spotifyMx?: number;
  appleMusicMx?: number;
  youtubeMx?: number;
  itunesMx?: number;
  deezerMx?: number;
}

export interface KworbSpotifyStats {
  totalStreams: number;
  totalStreamsFmt: string;
  dailyStreams: number;
  dailyStreamsFmt: string;
  trackCount: number;
  topTracks: KworbTrack[];
}

export interface KworbYouTubeStats {
  totalViews: number;
  totalViewsFmt: string;
  dailyAvg: number;
  dailyAvgFmt: string;
  topVideos: KworbVideo[];
}

export interface KworbStats {
  slug: string;
  spotifyId: string | null;
  spotify: KworbSpotifyStats | null;
  youtube: KworbYouTubeStats | null;
  chartPositions: KworbChartPosition[] | null;
}

/* ── Single artist full stats (for artist detail page) ────────────────── */
export function useKworbStats(artistName: string) {
  return useQuery<KworbStats | null>({
    queryKey: ["kworbStats", artistName],
    queryFn: async () => {
      if (!artistName) return null;
      const resp = await fetch(
        `/api/kworb/artist-stats?name=${encodeURIComponent(artistName)}`
      );
      if (!resp.ok) return null;
      const data = await resp.json() as KworbStats;
      // Return null if absolutely no useful data
      if (!data.spotify && !data.youtube && !data.chartPositions) return null;
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    enabled: !!artistName,
  });
}

/* ── Batch total-streams for roster (single API call for all artists) ─── */
export function useBatchKworbStreams(names: string[]) {
  const key = [...names].sort().join(",");
  return useQuery<Record<string, number | null>>({
    queryKey: ["kworbBatch", key],
    queryFn: async () => {
      if (!names.length) return {};
      const resp = await fetch(
        `/api/kworb/batch-streams?names=${encodeURIComponent(names.join(","))}`
      );
      if (!resp.ok) return {};
      return resp.json() as Promise<Record<string, number | null>>;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    enabled: names.length > 0,
  });
}
