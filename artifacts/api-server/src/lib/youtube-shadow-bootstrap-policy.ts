export function youtubeShadowPilotIsReady(eligibleCandidates: string | number | null | undefined): boolean {
  return Number(eligibleCandidates ?? 0) > 0;
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
