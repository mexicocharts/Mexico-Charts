import type { PoolClient } from "@workspace/db";
import { buildMonitoringYoutubeEligibleVideosSql, type MonitoringYoutubeRelationship } from "./monitoring-youtube-serving";

export type MonitoringYoutubeHistoryRange = "7d" | "30d" | "90d";
const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

export interface MonitoringYoutubeNativeHistory {
  kind: "native_intraday_cumulative";
  artistKey: string;
  videoId: string;
  range: MonitoringYoutubeHistoryRange;
  timeZone: "America/New_York";
  startDate: string;
  endDate: string;
  asOf: string;
  selection: "last_observation_per_et_date";
  sourceTable: "youtube_video_intraday_shadow_snapshots";
  sourceType: "youtube_api_shadow";
  status: "complete" | "partial" | "empty";
  points: Array<{ date: string; observedAt: string; observationId: string; viewCount: number }>;
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
    relationshipSources: MonitoringYoutubeRelationship[];
  };
}

export class MonitoringYoutubeVideoAccessError extends Error {
  constructor() { super("Video history is not authorized for this artist"); this.name = "MonitoringYoutubeVideoAccessError"; }
}

export function validMonitoringYoutubeHistoryInput(videoId: string, range: string): range is MonitoringYoutubeHistoryRange {
  return /^[A-Za-z0-9_-]{11}$/.test(videoId) && Object.hasOwn(RANGE_DAYS, range);
}

/** One exact eligible video, one bounded native archive read. The selected
 * cumulative observations keep their original ID and timestamp. No daily
 * values, missing observations, or relationship approvals are synthesized. */
export const MONITORING_YOUTUBE_NATIVE_HISTORY_SQL = `
  WITH selected_relationships AS MATERIALIZED (${buildMonitoringYoutubeEligibleVideosSql("$1::text[]")}),
  eligible AS MATERIALIZED (
    SELECT * FROM selected_relationships
    WHERE video_id=$2 AND (has_approved_link OR $4::boolean)
  ), clock AS (SELECT now() as_of), bounds AS (
    SELECT as_of,(as_of AT TIME ZONE 'America/New_York')::date end_date,
      (as_of AT TIME ZONE 'America/New_York')::date-($3::integer-1) start_date
    FROM clock
  ), native AS MATERIALIZED (
    SELECT sample.id,sample.observed_at,sample.view_count,
      (sample.observed_at AT TIME ZONE 'America/New_York')::date observation_date
    FROM youtube_video_intraday_shadow_snapshots sample CROSS JOIN bounds
    WHERE sample.video_id=$2 AND EXISTS(SELECT 1 FROM eligible)
      AND sample.source_type='youtube_api_shadow' AND sample.view_count IS NOT NULL
      AND sample.observed_at>=(bounds.start_date::timestamp AT TIME ZONE 'America/New_York')
      AND sample.observed_at<=bounds.as_of
  ), selected_points AS (
    SELECT DISTINCT ON(observation_date) * FROM native
    ORDER BY observation_date,observed_at DESC,id DESC
  )
  SELECT eligible.has_approved_link,eligible.relation_source,eligible.relation_status,
    eligible.sampling_status,eligible.relationship_sources,
    bounds.as_of::text,bounds.start_date::text,bounds.end_date::text,
    (SELECT count(*)::text FROM native) raw_observation_count,
    (SELECT min(observed_at)::text FROM native) first_observed_at,
    (SELECT max(observed_at)::text FROM native) last_observed_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('date',observation_date::text,
      'observedAt',observed_at::text,'observationId',id::text,'viewCount',view_count::text)
      ORDER BY observation_date) FROM selected_points),'[]'::jsonb) points
  FROM eligible CROSS JOIN bounds
`;

function safeCount(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < 0) throw new Error("Invalid native history count");
  return number;
}

function iso(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error("Invalid native history timestamp");
  return new Date(value).toISOString();
}

function requestedDates(startDate: string, endDate: string, days: number): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new Error("Invalid native history dates");
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(`${startDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  if (dates[0] !== startDate || dates.at(-1) !== endDate) throw new Error("Invalid native history date range");
  return dates;
}

export async function loadMonitoringYoutubeNativeHistory(input: {
  queryable: Pick<PoolClient, "query">;
  artistKey: string;
  artistKeys: readonly string[];
  videoId: string;
  range: MonitoringYoutubeHistoryRange;
  includeCandidateOnly: boolean;
  deadlineAt: number;
}): Promise<MonitoringYoutubeNativeHistory> {
  const keys = [...new Set(input.artistKeys.map(key => key.trim()).filter(Boolean))];
  if (!input.artistKey.trim() || !keys.length || !validMonitoringYoutubeHistoryInput(input.videoId, input.range)) {
    throw new Error("Invalid authorized native history input");
  }
  if (Date.now() >= input.deadlineAt) throw new Error("Monitoring history deadline exceeded");
  // The existing monitoring pool bounds connection/query/statement time; the
  // handler additionally races the full authorization+read against 12 seconds.
  const rows = (await input.queryable.query(MONITORING_YOUTUBE_NATIVE_HISTORY_SQL,
    [keys, input.videoId, RANGE_DAYS[input.range], input.includeCandidateOnly])).rows;
  if (Date.now() >= input.deadlineAt) throw new Error("Monitoring history deadline exceeded");
  if (!rows.length) throw new MonitoringYoutubeVideoAccessError();
  if (rows.length !== 1) throw new Error("Ambiguous native video relationship");
  const row = rows[0]!;
  if (!Array.isArray(row.points) || !Array.isArray(row.relationship_sources)
    || typeof row.has_approved_link !== "boolean" || (!row.has_approved_link && !input.includeCandidateOnly)) {
    throw new Error("Invalid native video history response");
  }
  const asOf = iso(row.as_of);
  const dates = requestedDates(row.start_date, row.end_date, RANGE_DAYS[input.range]);
  const points: MonitoringYoutubeNativeHistory["points"] = row.points.map((point: Record<string, unknown>) => {
    if (typeof point.date !== "string" || !dates.includes(point.date)
      || typeof point.observationId !== "string" || !/^\d+$/.test(point.observationId)) throw new Error("Invalid native history point");
    const observedAt = iso(point.observedAt);
    if (observedAt > asOf) throw new Error("Invalid future native history point");
    return { date: point.date, observedAt, observationId: point.observationId, viewCount: safeCount(point.viewCount) };
  });
  if (new Set(points.map(point => point.date)).size !== points.length
    || points.some((point, index) => index > 0 && point.date <= points[index - 1]!.date)) throw new Error("Invalid native history ordering");
  const observedDates = new Set(points.map(point => point.date));
  const rawObservationCount = safeCount(row.raw_observation_count);
  if (rawObservationCount < points.length || (points.length === 0) !== (rawObservationCount === 0)) throw new Error("Invalid native history coverage");
  // Candidate relationship IDs, keys, review status and discovery provenance
  // belong to founder diagnostics. A subscriber keeps the actual approved
  // relationship and all native measurement provenance, even when the shared
  // selector's highest-confidence primary row was a review candidate.
  const relationshipSources: MonitoringYoutubeRelationship[] = input.includeCandidateOnly ? row.relationship_sources
    : row.relationship_sources.filter((relation: MonitoringYoutubeRelationship) => relation.source_table === "youtube_artist_video_links"
      && relation.status === "active" && relation.confidence_score >= 80);
  if (!relationshipSources.length) throw new Error("Missing authorized native history relationship");
  const approvedPrimary = input.includeCandidateOnly ? null : relationshipSources[0]!;
  return {
    kind: "native_intraday_cumulative", artistKey: input.artistKey, videoId: input.videoId, range: input.range,
    timeZone: "America/New_York", startDate: row.start_date, endDate: row.end_date, asOf,
    selection: "last_observation_per_et_date", sourceTable: "youtube_video_intraday_shadow_snapshots", sourceType: "youtube_api_shadow",
    status: !points.length ? "empty" : points.length === dates.length ? "complete" : "partial", points,
    coverage: { requestedDays: dates.length, observedDays: points.length, missingDates: dates.filter(date => !observedDates.has(date)),
      rawObservationCount, firstObservedAt: row.first_observed_at == null ? null : iso(row.first_observed_at),
      lastObservedAt: row.last_observed_at == null ? null : iso(row.last_observed_at), meaning: "observed_dates_only" },
    relationship: { hasApprovedLink: row.has_approved_link,
      visibilityScope: row.has_approved_link ? "approved_artist_link" : "founder_candidate_diagnostic",
      relationSource: approvedPrimary ? approvedPrimary.source_table : row.relation_source,
      relationStatus: approvedPrimary ? approvedPrimary.status : row.relation_status,
      samplingStatus: approvedPrimary ? approvedPrimary.sampling_status : row.sampling_status,
      relationshipSources },
  };
}
