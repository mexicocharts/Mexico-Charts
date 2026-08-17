export type ArtistProfileCoverage = {
  spotify: boolean;
  youtube: boolean;
  appleMusic: boolean;
  deezer: boolean;
  musicbrainz: boolean;
  verifiedSocials: number;
};

export type ArtistProfilePriorityInput = {
  bestRank: number | null;
  chartSources: number;
  chartAppearances: number;
  coverage: ArtistProfileCoverage;
};

const PROVIDER_WEIGHTS = {
  spotify: 25,
  youtube: 20,
  appleMusic: 15,
  deezer: 10,
  musicbrainz: 5,
  socials: 10,
} as const;

export function scoreArtistProfilePriority(input: ArtistProfilePriorityInput) {
  const rank = input.bestRank;
  const chartImpact = rank == null ? 0 : rank <= 10 ? 50 : rank <= 50 ? 40 : rank <= 100 ? 30 : 20;
  const breadth = Math.min(15, Math.max(0, input.chartSources - 1) * 5);
  const recurrence = Math.min(10, Math.max(0, input.chartAppearances - 1));
  const missing: string[] = [];
  let gapScore = 0;

  for (const provider of ["spotify", "youtube", "appleMusic", "deezer", "musicbrainz"] as const) {
    if (!input.coverage[provider]) {
      missing.push(provider);
      gapScore += PROVIDER_WEIGHTS[provider];
    }
  }
  if (input.coverage.verifiedSocials === 0) {
    missing.push("socials");
    gapScore += PROVIDER_WEIGHTS.socials;
  }

  const priorityScore = Math.min(100, chartImpact + breadth + recurrence + Math.round(gapScore * 0.5));
  const complete = missing.length === 0;
  const priorityBand = complete ? "healthy" : priorityScore >= 75 ? "urgent" : priorityScore >= 50 ? "high" : "normal";

  return { priorityScore, priorityBand, complete, missingProviders: missing };
}
