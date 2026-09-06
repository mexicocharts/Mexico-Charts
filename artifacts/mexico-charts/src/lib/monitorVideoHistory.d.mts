export type MonitorVideoHistoryRange = "7d" | "30d" | "90d";
export type MonitorVideoHistoryRequest = {
  userId?: string | null;
  artistKey: string;
  videoId: string;
  range: MonitorVideoHistoryRange;
  accessSource: "internal" | "subscription";
};
export type MonitorVideoHistoryResponse = {
  kind: "native_intraday_cumulative";
  artistKey: string;
  videoId: string;
  range: MonitorVideoHistoryRange;
  timeZone: "America/New_York";
  startDate: string;
  endDate: string;
  asOf: string;
  selection: "last_observation_per_et_date";
  sourceTable: "youtube_video_intraday_shadow_snapshots";
  sourceType: "youtube_api_shadow";
  status: "complete" | "partial" | "empty";
  points: Array<{
    date: string;
    observedAt: string;
    observationId: string;
    viewCount: number;
  }>;
  coverage: {
    requestedDays: number;
    observedDays: number;
    missingDates: string[];
    rawObservationCount: number;
    firstObservedAt: string | null;
    lastObservedAt: string | null;
    meaning: "observed_dates_only";
  };
  relationship: {
    hasApprovedLink: boolean;
    visibilityScope: "approved_artist_link" | "founder_candidate_diagnostic";
    relationSource: string;
    relationStatus: "active" | "review" | "verified";
    samplingStatus: "shadow" | null;
    relationshipSources: Array<{
      source_table: string;
      source_id: string | number;
      artist_key: string;
      status: string | null;
      sampling_status: string | null;
      confidence_score: number | null;
      evidence_source: string | null;
    }>;
  };
};
export function monitorVideoHistoryRequest(input: MonitorVideoHistoryRequest): {
  queryKey: Array<string | null | undefined>;
  input: string;
};
export function validateMonitorVideoHistory(
  payload: unknown,
  expected: Omit<MonitorVideoHistoryRequest, "userId">,
): MonitorVideoHistoryResponse;
