/** Pure serving contract shared by the actual endpoint and its read-only
 * coverage proof. It describes cumulative observations, not daily deltas. */
export const MONITORING_YOUTUBE_NATIVE_HISTORY_CONTRACT = Object.freeze({
  version: "monitoring_youtube_native_history_v1",
  kind: "native_intraday_cumulative",
  sourceTable: "youtube_video_intraday_shadow_snapshots",
  sourceType: "youtube_api_shadow",
  timeZone: "America/New_York",
  selection: "last_observation_per_et_date",
  endpoint: "/api/monitoring/videos/:artistKey/:videoId/history",
} as const);

export const MONITORING_YOUTUBE_VIDEO_ID_PATTERN = "^[A-Za-z0-9_-]{11}$";
export const isMonitoringYoutubeVideoId = (value: string) => new RegExp(MONITORING_YOUTUBE_VIDEO_ID_PATTERN).test(value);
