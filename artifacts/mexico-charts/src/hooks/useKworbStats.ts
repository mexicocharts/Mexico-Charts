import { useQuery } from "@tanstack/react-query";

/* ── Types ─────────────────────────────────────────────────────────────── */
export interface KworbTrack {
  title: string;
  coverUrl?: string | null;
  coverSource?: "deezer" | null;
  deezerUrl?: string | null;
  streams: number;
  streamsFmt: string;
  daily: number;
  dailyFmt: string;
}

export interface KworbVideo {
  title: string;
  videoId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  views: number;
  viewsFmt: string;
  daily: number;
  dailyFmt: string;
  published: string;
}

export interface KworbChartPosition {
  song: string;
  coverUrl?: string | null;
  coverSource?: "deezer" | "youtube" | null;
  deezerUrl?: string | null;
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
    staleTime: 15 * 60 * 1000,
    retry: 1,
    enabled: !!artistName,
  });
}

/* ── Refresh status (last scheduler run) ─────────────────────────────── */
export interface KworbRefreshStatus {
  lastRefreshedAt:  number | null;
  lastRefreshedFmt: string | null;
  nextPollAt:       number | null;
  nextPollFmt:      string | null;
  todayUpdated:     boolean;
  artistsUpdated:   number;
  inProgress:       boolean;
  totalArtists:     number;
}

export function useRefreshStatus() {
  return useQuery<KworbRefreshStatus | null>({
    queryKey: ["kworbRefreshStatus"],
    queryFn: async () => {
      const resp = await fetch("/api/kworb/refresh-status");
      if (!resp.ok) return null;
      return resp.json() as Promise<KworbRefreshStatus>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

async function fetchBatchKworbStreamsChunk<T>(names: string[], details = false): Promise<Record<string, T | null>> {
  if (!names.length) return {};
  const resp = await fetch(
    `/api/kworb/batch-streams?names=${encodeURIComponent(names.join(","))}${details ? "&details=1" : ""}`
  );
  if (!resp.ok) return {};
  return resp.json() as Promise<Record<string, T | null>>;
}

async function fetchBatchKworbStreams<T>(names: string[], details = false): Promise<Record<string, T | null>> {
  const chunks: string[][] = [];
  for (let i = 0; i < names.length; i += 100) chunks.push(names.slice(i, i + 100));
  const results = await Promise.all(chunks.map((chunk) => fetchBatchKworbStreamsChunk<T>(chunk, details)));
  return Object.assign({}, ...results);
}

/* ── Batch total-streams for roster (single API call for all artists) ─── */
export function useBatchKworbStreams(names: string[]) {
  const key = [...names].sort().join(",");
  return useQuery<Record<string, number | null>>({
    queryKey: ["kworbBatch", key],
    queryFn: async () => {
      return fetchBatchKworbStreams<number>(names);
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    enabled: names.length > 0,
  });
}

export interface KworbStreamSnapshot {
  totalStreams: number | null;
  dailyStreams: number | null;
}

/* ── Batch daily-stream snapshots for MX100 ──────────────────────────── */
export function useBatchKworbStreamStats(names: string[]) {
  const key = [...names].sort().join(",");
  return useQuery<Record<string, KworbStreamSnapshot | null>>({
    queryKey: ["kworbBatchStats", key],
    queryFn: async () => {
      return fetchBatchKworbStreams<KworbStreamSnapshot>(names, true);
    },
    staleTime: 15 * 60 * 1000,
    retry: 1,
    enabled: names.length > 0,
  });
}
