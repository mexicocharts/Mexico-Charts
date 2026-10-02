export function metricValue(value: unknown, options?: { editorial?: boolean }): number | null;
export function comparisonBars(a: number | null, b: number | null, options?: { compatible?: boolean }): {
  comparable: boolean; a: number | null; b: number | null; winner: "a" | "b" | null;
};
export function snapshotCompatibility(a: { source: string; date: string | null }, b: { source: string; date: string | null }): { compatible: boolean; note: string };
export function formatComparisonValue(value: number | null): string;
export function commonSourceReadings<T extends { value: number | null; source: string; date: string | null }>(a: T, b: T, fallbackA: T, fallbackB: T): { a: T; b: T; usedFallback: boolean };
export function comparisonScore(metrics: Array<{ a: { value: number | null }; b: { value: number | null }; compatible: boolean }>): {
  a: number; b: number; ties: number; unavailable: number; compared: number; total: number; winner: "a" | "b" | null;
};
