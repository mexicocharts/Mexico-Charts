export type YoutubeShadowStatus = "verified" | "review" | "rejected";
export type YoutubeRefreshTier = "hot" | "warm" | "baseline";

export interface YoutubeMusicCredit {
  name: string;
  channelId?: string;
}

export interface YoutubeMusicCandidateInput {
  videoId: string;
  credits: YoutubeMusicCredit[];
  sourceSections: string[];
  uploaderChannelId?: string | null;
}

export interface YoutubeMusicCandidateDecision {
  status: YoutubeShadowStatus;
  confidence: number;
  reason: string;
}

const REFRESH_INTERVALS_MS: Record<YoutubeRefreshTier, number> = {
  hot: 15 * 60 * 1000,
  warm: 60 * 60 * 1000,
  baseline: 4 * 60 * 60 * 1000,
};

export function normalizeYoutubeArtistName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function decideYoutubeMusicCandidate(
  input: YoutubeMusicCandidateInput,
  artistName: string,
  artistBrowseId: string,
): YoutubeMusicCandidateDecision {
  if (!/^[A-Za-z0-9_-]{11}$/.test(input.videoId)) {
    return { status: "rejected", confidence: 0, reason: "invalid_video_id" };
  }

  const normalizedArtist = normalizeYoutubeArtistName(artistName);
  const exactIdCredit = input.credits.some(credit => credit.channelId === artistBrowseId);
  const exactNameCredit = input.credits.some(
    credit => normalizeYoutubeArtistName(credit.name) === normalizedArtist,
  );
  const exactUploader = input.uploaderChannelId === artistBrowseId;

  if (exactIdCredit || exactUploader) {
    return {
      status: "verified",
      confidence: 100,
      reason: exactUploader && !exactIdCredit
        ? "verified_youtube_uploader_channel"
        : "verified_youtube_artist_credit",
    };
  }
  if (exactNameCredit) {
    return {
      status: "review",
      confidence: 78,
      reason: "exact_normalized_artist_credit",
    };
  }

  return {
    status: "rejected",
    confidence: 20,
    reason: "artist_credit_not_confirmed",
  };
}

export function chooseYoutubeRefreshTier(input: {
  publishedAt?: Date | null;
  viewCount?: number | null;
  dailyViewDelta?: number | null;
}): YoutubeRefreshTier {
  const ageMs = input.publishedAt ? Date.now() - input.publishedAt.getTime() : Number.POSITIVE_INFINITY;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (ageDays <= 14 || (input.dailyViewDelta ?? 0) >= 500_000) return "hot";
  if (ageDays <= 90 || (input.dailyViewDelta ?? 0) >= 50_000 || (input.viewCount ?? 0) >= 100_000_000) {
    return "warm";
  }
  return "baseline";
}

export function refreshIntervalMs(tier: YoutubeRefreshTier): number {
  return REFRESH_INTERVALS_MS[tier];
}

export function observationBucket(date: Date, tier: YoutubeRefreshTier): Date {
  const interval = refreshIntervalMs(tier);
  return new Date(Math.floor(date.getTime() / interval) * interval);
}

export function youtubeApiBatchesAllowed(input: {
  dailyBudget: number;
  callsUsed: number;
  requestedVideos: number;
}): number {
  const budgetRemaining = Math.max(0, Math.floor(input.dailyBudget) - Math.floor(input.callsUsed));
  const requestedBatches = Math.ceil(Math.max(0, input.requestedVideos) / 50);
  return Math.min(budgetRemaining, requestedBatches);
}
