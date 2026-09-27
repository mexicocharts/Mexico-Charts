export type CompactMonitorReleaseImpact = {
  releaseDate: string;
  availableMetricCount: number;
  metrics: Array<{ metricKey: string; status: "available" | "unavailable" | "failed" | "budget_exhausted"; reason?: string }>;
};
export function monitorReportRecommendation(
  impact: CompactMonitorReleaseImpact | null,
  releases: Array<{ title: string; releaseDate: string | null }>,
): string;
