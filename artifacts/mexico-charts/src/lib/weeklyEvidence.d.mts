type Entry = { rank: number; previousRank: number | null; movement: number | null; debut: boolean; row: Record<string, string> };
type Comparison = { comparisonReady: boolean; chartDate: string; previousChartDate: string | null; mexicanEntries: Entry[]; climbers: Entry[]; debuts: Entry[] };
export function potentialCrossChartGains(spotify?: Comparison, youtube?: Comparison): Array<{
  key: string; spotify: Entry; youtube: Entry; spotifyTitle: string; youtubeTitle: string; spotifyCredit: string; youtubeCredit: string;
  spotifyDate: string | null; spotifyPreviousDate: string | null; youtubeDate: string | null; youtubePreviousDate: string | null;
}>;
export function savedComparisonAvailable(comparison?: Comparison): boolean;
export function savedComparisonCopy(language: "es" | "en", comparison: Comparison | undefined, unmatched: number, climbers: number): {
  available: boolean; row: string; summary: string; explanation: string | null;
};
