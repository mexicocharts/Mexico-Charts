import type { YoutubeShadowStatus } from "./youtube-shadow-policy";

export interface YoutubeShadowManualReview {
  artistKey: string;
  videoId: string;
  status: Extract<YoutubeShadowStatus, "review" | "rejected">;
  confidence: number;
  reason: string;
  reviewedAt: string;
  evidenceSource: "manual_youtube_metadata_review";
}

const REVIEWED_AT = "2026-08-19";

const recovered: Array<[string, string, string]> = [
  ["peso-pluma", "BQEGrJD-GnU", "official_label_metadata_credits_artist"],
  ["fuerza-regida", "Fc6zq40xY20", "youtube_provided_metadata_credits_artist"],
  ["fuerza-regida", "_ymicn0_GYc", "official_title_credits_artist"],
  ["fuerza-regida", "ao3SN7fkQQU", "official_artist_channel_and_title"],
  ["fuerza-regida", "SmksFnrd4RM", "official_artist_channel_and_title"],
  ["natanael-cano", "RC0PywybCkI", "official_topic_channel_metadata"],
  ["natanael-cano", "Mi_VH9T2bws", "youtube_provided_metadata_credits_artist"],
  ["natanael-cano", "KGCkchk-BaA", "official_artist_title"],
  ["natanael-cano", "xh9ymx2bPjA", "official_artist_title"],
  ["natanael-cano", "1M2id9ma-2E", "official_title_credits_artist"],
  ["luis-miguel", "a5bCH95kA00", "verified_official_artist_channel"],
];

const rejected: Array<[string, string, string]> = [
  ["peso-pluma", "A-0VkKWYKss", "solo_performance_by_other_artist"],
  ["peso-pluma", "ThV4QdTRt2w", "unrelated_performance"],
  ["peso-pluma", "Db3SwT-9EeU", "editorial_recap_not_music_recording"],
  ["natanael-cano", "nnEDveDt7r4", "no_artist_credit_evidence"],
  ["natanael-cano", "r0fZp488avE", "recording_by_other_artist"],
  ["natanael-cano", "Zkd4Xr1pJr0", "recording_by_other_artist"],
  ["natanael-cano", "vwlD55Q_6GI", "recording_by_other_artist"],
  ["natanael-cano", "a11k2Dv2cbg", "recording_by_other_artist"],
  ["natanael-cano", "LBsbQqpD5oU", "recording_by_other_artist"],
  ["natanael-cano", "sALYKh-CvX0", "recording_by_other_artist"],
  ["natanael-cano", "LKDx8lhQc8g", "recording_by_other_artist"],
  ["natanael-cano", "5nJTrH-iieo", "recording_by_other_artist"],
  ["natanael-cano", "pusPEzJ0sQY", "recording_by_other_artist"],
  ["natanael-cano", "hsBOb65fga8", "recording_by_other_artist"],
  ["natanael-cano", "dpPvvtcN1MU", "recording_by_other_artist"],
  ["natanael-cano", "FfkLVylmpec", "recording_by_other_artist"],
  ["natanael-cano", "rYYEKWZxsGs", "recording_by_other_artist"],
  ["natanael-cano", "7RbRbCBk2Qs", "recording_by_other_artist"],
  ["natanael-cano", "czkUEwwjr8U", "recording_by_other_artist"],
  ["natanael-cano", "DqGdc2Xwn8A", "recording_by_other_artist"],
  ["luis-miguel", "s-QMm3B6S8E", "impersonation_cover_not_artist_recording"],
];

export const youtubeShadowManualReviews: YoutubeShadowManualReview[] = [
  ...recovered.map(([artistKey, videoId, reason]) => ({
    artistKey,
    videoId,
    status: "review" as const,
    confidence: 85,
    reason,
    reviewedAt: REVIEWED_AT,
    evidenceSource: "manual_youtube_metadata_review" as const,
  })),
  ...rejected.map(([artistKey, videoId, reason]) => ({
    artistKey,
    videoId,
    status: "rejected" as const,
    confidence: 0,
    reason,
    reviewedAt: REVIEWED_AT,
    evidenceSource: "manual_youtube_metadata_review" as const,
  })),
];

const reviewIndex = new Map(
  youtubeShadowManualReviews.map(review => [`${review.artistKey}:${review.videoId}`, review]),
);

export function getYoutubeShadowManualReview(artistKey: string, videoId: string) {
  return reviewIndex.get(`${artistKey}:${videoId}`) ?? null;
}
