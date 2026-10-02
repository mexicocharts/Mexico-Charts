import type { SongstatsArtistData, SongstatsMetricGrowth, SongstatsGrowthEvidence } from "../hooks/useSongstatsArtist";
export function highestAvailableChange(growth: SongstatsArtistData["growth"]): { label: string; growth?: SongstatsMetricGrowth } | null;
export function audienceChangeCopy(language: "es" | "en", evidence?: SongstatsGrowthEvidence | null): {
  heading: string; unavailable: string; endpoints: string | null; target: string; uncertainty: string;
};
