export interface YoutubeCoverageCandidate {
  artistKey: string;
  videoId: string;
  status: string;
  samplingStatus: string;
}

export interface YoutubeCoveragePair {
  normalizedArtistKey: string;
  videoId: string;
}

export interface YoutubeCoverageCounts {
  catalogArtists: number;
  observedArtists: number;
  freshArtists: number;
  catalogVideos: number;
  observedVideos: number;
  freshVideos: number;
  latestObservedAt: string | null;
}

export type YoutubeCoverageSummaryState = "missing" | "current" | "stale" | "refresh_failed";

/** Mirrors the authoritative PostgreSQL translate/lower/regexp_replace expression. */
export function normalizeYoutubeCoverageArtistKey(value: string): string {
  const translated = value.toLowerCase().replace(/[áéíóúüñ]/g, character => ({
    á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
  })[character] ?? character);
  return translated.replace(/[^a-z0-9]/g, "");
}

export function buildYoutubeCoverageEligiblePairs(
  candidates: YoutubeCoverageCandidate[],
  activeRosterArtistKeys: string[],
): YoutubeCoveragePair[] {
  const roster = new Set(activeRosterArtistKeys.map(normalizeYoutubeCoverageArtistKey));
  const pairs = new Map<string, YoutubeCoveragePair>();
  for (const candidate of candidates) {
    if (!['review', 'verified'].includes(candidate.status) || candidate.samplingStatus !== 'shadow') continue;
    const normalizedArtistKey = normalizeYoutubeCoverageArtistKey(candidate.artistKey);
    if (!roster.has(normalizedArtistKey)) continue;
    const pair = { normalizedArtistKey, videoId: candidate.videoId };
    pairs.set(`${normalizedArtistKey}\u0000${candidate.videoId}`, pair);
  }
  return [...pairs.values()].sort((left, right) =>
    left.normalizedArtistKey.localeCompare(right.normalizedArtistKey)
      || left.videoId.localeCompare(right.videoId));
}

export function calculateYoutubeCoverageCounts(
  pairs: YoutubeCoveragePair[],
  latestObservations: ReadonlyMap<string, string>,
  calculatedAt: Date,
): YoutubeCoverageCounts {
  const freshBoundary = calculatedAt.getTime() - 6 * 60 * 60 * 1_000;
  const artistState = new Map<string, { observed: boolean; fresh: boolean }>();
  const videoState = new Map<string, { observed: boolean; fresh: boolean; timestamp: string | null }>();
  for (const pair of pairs) {
    const timestamp = latestObservations.get(pair.videoId) ?? null;
    const observed = timestamp !== null;
    const fresh = observed && new Date(timestamp).getTime() >= freshBoundary;
    const artist = artistState.get(pair.normalizedArtistKey) ?? { observed: false, fresh: false };
    artist.observed ||= observed;
    artist.fresh ||= fresh;
    artistState.set(pair.normalizedArtistKey, artist);
    const video = videoState.get(pair.videoId) ?? { observed: false, fresh: false, timestamp: null };
    video.observed ||= observed;
    video.fresh ||= fresh;
    if (timestamp && (!video.timestamp || timestamp > video.timestamp)) video.timestamp = timestamp;
    videoState.set(pair.videoId, video);
  }
  const timestamps = [...videoState.values()].flatMap(state => state.timestamp ? [state.timestamp] : []);
  return {
    catalogArtists: artistState.size,
    observedArtists: [...artistState.values()].filter(state => state.observed).length,
    freshArtists: [...artistState.values()].filter(state => state.fresh).length,
    catalogVideos: videoState.size,
    observedVideos: [...videoState.values()].filter(state => state.observed).length,
    freshVideos: [...videoState.values()].filter(state => state.fresh).length,
    latestObservedAt: timestamps.sort().at(-1) ?? null,
  };
}

export function youtubeCoverageSummaryState(
  summary: { calculatedAt: string; lastRefreshError?: string | null } | null,
  now: Date,
  maximumAgeMs = 15 * 60 * 1_000,
): YoutubeCoverageSummaryState {
  if (!summary) return "missing";
  if (summary.lastRefreshError) return "refresh_failed";
  return now.getTime() - new Date(summary.calculatedAt).getTime() > maximumAgeMs ? "stale" : "current";
}

export function shouldRefreshYoutubeCoverageSummary(collectorStatus: string): boolean {
  return collectorStatus === "complete";
}
