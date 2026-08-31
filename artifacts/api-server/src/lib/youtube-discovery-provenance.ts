export const AUTHORIZED_YOUTUBE_EVIDENCE_MARKERS = [
  "approved_artist_video_link",
  "verified_profile_channel",
  "verified_official_channel_upload",
  "kworb_top_videos",
  "youtube_uploads_playlist",
  "manual_youtube_metadata_review",
] as const;

export const INNERTUBE_YOUTUBE_EVIDENCE_MARKERS = [
  "youtube_music_innertube",
  "all_songs",
  "albums",
  "singles",
  "videos",
  "songs",
  "release_track",
  "Videos",
  "Top songs",
  "Live performances",
] as const;

export const INNERTUBE_PRIMARY_SOURCE = "youtube_music_innertube";
export const LIVE_COMPARATOR_PUBLICATION_LOOKBACK_MS = 24 * 60 * 60 * 1_000;

export type YoutubeDiscoveryProvenance = "authorized" | "innertube" | "mixed" | "unknown";

function authorizedMarker(value: string) {
  return AUTHORIZED_YOUTUBE_EVIDENCE_MARKERS.includes(value as typeof AUTHORIZED_YOUTUBE_EVIDENCE_MARKERS[number])
    || value.startsWith("trusted_")
    || value.startsWith("licensed_")
    || value.startsWith("verified_");
}

function innertubeMarker(value: string) {
  return INNERTUBE_YOUTUBE_EVIDENCE_MARKERS.includes(value as typeof INNERTUBE_YOUTUBE_EVIDENCE_MARKERS[number]);
}

export function classifyYoutubeDiscoveryProvenance(input: {
  primarySource?: string | null;
  evidenceSources?: unknown;
}): YoutubeDiscoveryProvenance {
  const primary = String(input.primarySource ?? "").trim();
  const sources = Array.isArray(input.evidenceSources)
    ? input.evidenceSources.filter((value): value is string => typeof value === "string")
    : [];
  const authorized = authorizedMarker(primary) || sources.some(authorizedMarker);
  const innertube = primary === INNERTUBE_PRIMARY_SOURCE
    || (!authorizedMarker(primary) && sources.some(innertubeMarker));
  if (authorized && innertube) return "mixed";
  if (authorized) return "authorized";
  if (innertube) return "innertube";
  return "unknown";
}

export function isYoutubeLiveComparatorCandidate(input: {
  primarySource?: string | null;
  discoveredAt?: string | Date | null;
  publishedAt?: string | Date | null;
  sessionStartedAt: string | Date;
}): boolean {
  if (input.primarySource !== INNERTUBE_PRIMARY_SOURCE) return false;
  const sessionStartedAt = new Date(input.sessionStartedAt).getTime();
  const discoveredAt = input.discoveredAt == null ? Number.NaN : new Date(input.discoveredAt).getTime();
  const publishedAt = input.publishedAt == null ? Number.NaN : new Date(input.publishedAt).getTime();
  return Number.isFinite(sessionStartedAt)
    && Number.isFinite(discoveredAt)
    && Number.isFinite(publishedAt)
    && discoveredAt >= sessionStartedAt
    && publishedAt >= sessionStartedAt - LIVE_COMPARATOR_PUBLICATION_LOOKBACK_MS;
}
