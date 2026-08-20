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

export function youtubeShadowCanUseVerifiedChannelFallback(input: {
  browseId: string | null | undefined;
  trustedBrowseId: boolean | null | undefined;
}): boolean {
  return Boolean(input.trustedBrowseId && /^UC[A-Za-z0-9_-]{22}$/.test(input.browseId ?? ""));
}

export function youtubeShadowDiscoveryFailure(result: {
  mappingStatus: string;
  reviewCandidates: number;
  error?: string;
}): string | null {
  if (result.error) return result.error;
  if (result.mappingStatus !== "review") return `Mapping status: ${result.mappingStatus}.`;
  if (result.reviewCandidates < 1) return "No eligible review candidates were discovered.";
  return null;
}
