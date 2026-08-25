export function youtubeShadowPilotIsReady(eligibleCandidates: string | number | null | undefined): boolean {
  return Number(eligibleCandidates ?? 0) > 0;
}

export function youtubeShadowArtistIdentityKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function youtubeShadowCanonicalChannelId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  const match = trimmed.match(/(?:^|\/channel\/)(UC[A-Za-z0-9_-]{22})(?:$|[/?#])/);
  return match?.[1] ?? null;
}

export function youtubeShadowCanUseVerifiedChannelFallback(input: {
  browseId: string | null | undefined;
  trustedBrowseId: boolean | null | undefined;
}): boolean {
  return Boolean(input.trustedBrowseId && youtubeShadowCanonicalChannelId(input.browseId));
}

export function youtubeShadowDiscoveryFailure(result: {
  mappingStatus: string;
  verifiedCandidates?: number;
  reviewCandidates: number;
  error?: string;
}): string | null {
  if (result.error) return result.error;
  if (result.mappingStatus !== "review") return `Mapping status: ${result.mappingStatus}.`;
  if ((result.verifiedCandidates ?? 0) + result.reviewCandidates < 1) {
    return "No eligible shadow candidates were discovered.";
  }
  return null;
}

export function youtubeShadowDiscoveryRetryDelayMs(
  mappingStatus: string,
  lastAttemptAt: Date | string | null | undefined,
  now = Date.now(),
): number {
  if (!lastAttemptAt) return 0;
  const delay = mappingStatus === "failed" || mappingStatus === "retryable" || mappingStatus === "ambiguous"
    ? 15 * 60 * 1000
    : 24 * 60 * 60 * 1000;
  return Math.max(0, delay - (now - new Date(lastAttemptAt).getTime()));
}
