import { MONITORING_YOUTUBE_NATIVE_HISTORY_CONTRACT as CONTRACT, MONITORING_YOUTUBE_VIDEO_ID_PATTERN } from "./monitoring-youtube-native-contract";

export const MONITORING_YOUTUBE_NATIVE_INSPECTION_VERSION = "monitoring_youtube_native_history_inspection_v2";
const SOURCE_TABLE = CONTRACT.sourceTable;
const SOURCE_TYPE = CONTRACT.sourceType;
const TIME_ZONE = CONTRACT.timeZone;
const RANGE_DAYS = 90;
const REQUIRED_TABLES = [SOURCE_TABLE, "youtube_artist_video_links", "youtube_music_catalog_candidates", "youtube_tracked_videos"];

/** Application-owned SQL only. Reuse the selected relationship set, then scan
 * its bounded archive once. Counts describe real cumulative observations, never
 * approved daily snapshots, derived deltas, or a complete provider catalog. */
export function buildMonitoringYoutubeNativeDiagnosticsSql(artistKeysSql: string, eligibleSql: string, asOfSql = "now()") {
  return `WITH native_inspection_eligible AS MATERIALIZED (${eligibleSql}),
    inspection_clock AS (SELECT ${asOfSql} AS as_of), inspection_bounds AS MATERIALIZED (
      SELECT as_of,(as_of AT TIME ZONE '${TIME_ZONE}')::date end_date,
        (as_of AT TIME ZONE '${TIME_ZONE}')::date-89 start_date FROM inspection_clock
    ), inspection_samples AS MATERIALIZED (
      SELECT s.id,s.video_id,s.observed_at,s.source_type,s.view_count,e.has_approved_link,
        (s.observed_at AT TIME ZONE '${TIME_ZONE}')::date et_date
      FROM ${SOURCE_TABLE} s JOIN native_inspection_eligible e USING(video_id) CROSS JOIN inspection_bounds b
      WHERE s.observed_at >= (b.start_date::timestamp AT TIME ZONE '${TIME_ZONE}') AND s.observed_at <= b.as_of
    ), inspection_raw AS MATERIALIZED (
      SELECT video_id,count(*) any_samples,
        count(*) FILTER(WHERE source_type='${SOURCE_TYPE}' AND view_count IS NOT NULL) trusted_samples,
        min(observed_at) FILTER(WHERE source_type='${SOURCE_TYPE}' AND view_count IS NOT NULL) first_observed_at,
        max(observed_at) FILTER(WHERE source_type='${SOURCE_TYPE}' AND view_count IS NOT NULL) last_observed_at
      FROM inspection_samples GROUP BY video_id
    ), inspection_selected AS MATERIALIZED (
      SELECT DISTINCT ON(video_id,et_date) video_id,et_date,view_count
      FROM inspection_samples WHERE source_type='${SOURCE_TYPE}' AND view_count IS NOT NULL
      ORDER BY video_id,et_date,observed_at DESC,id DESC
    ), inspection_dates AS (
      SELECT video_id,count(*) observed_dates,
        count(*) FILTER(WHERE view_count<0 OR view_count>9007199254740991) invalid_points
      FROM inspection_selected GROUP BY video_id
    ), inspection_videos AS MATERIALIZED (
      SELECT e.video_id,e.has_approved_link,COALESCE(r.any_samples,0) any_samples,
        COALESCE(r.trusted_samples,0) trusted_samples,COALESCE(d.observed_dates,0) observed_dates,
        COALESCE(d.invalid_points,0) invalid_points,r.first_observed_at,r.last_observed_at,
        NOT EXISTS(SELECT 1 FROM youtube_tracked_videos t WHERE t.video_id=e.video_id) missing_tracked
      FROM native_inspection_eligible e LEFT JOIN inspection_raw r USING(video_id) LEFT JOIN inspection_dates d USING(video_id)
    ) SELECT jsonb_build_object(
      'inspectionVersion','${MONITORING_YOUTUBE_NATIVE_INSPECTION_VERSION}','inspected',true,
      'servingContractVersion','${CONTRACT.version}',
      'sourceKeys',to_jsonb(${artistKeysSql}),'sourceTable','${SOURCE_TABLE}','trustedSourceType','${SOURCE_TYPE}',
      'kind','native_intraday_cumulative','selection','last_observation_per_et_date',
      'substitutesForApprovedDailySnapshots',false,'allTimeCoverageInspected',false,
      'timeZone','${TIME_ZONE}','rangeDays',90,
      'captureClock',to_char(b.as_of AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'startDate',b.start_date::text,'endDate',b.end_date::text,
      'startsAt',to_char((b.start_date::timestamp AT TIME ZONE '${TIME_ZONE}') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'sourceTypes',COALESCE((SELECT jsonb_agg(to_jsonb(types) ORDER BY scope, "sourceType" NULLS FIRST) FROM (
        SELECT CASE WHEN has_approved_link THEN 'approved' ELSE 'candidate_only' END scope,source_type "sourceType",
          count(*) rows,count(*) FILTER(WHERE view_count IS NOT NULL) "nonNullViews",count(DISTINCT video_id) videos,
          to_char(min(observed_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') "firstObservedAt",
          to_char(max(observed_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') "lastObservedAt"
        FROM inspection_samples GROUP BY has_approved_link,source_type
      ) types),'[]'::jsonb),
      'buckets',(SELECT jsonb_agg(to_jsonb(coverage) ORDER BY scope) FROM (
        SELECT CASE WHEN scopes.approved THEN 'approved' ELSE 'candidate_only' END scope,
          count(v.video_id) "eligibleVideos",count(v.video_id) FILTER(WHERE any_samples>0) "videosWithAnySamples",
          count(v.video_id) FILTER(WHERE trusted_samples>0) "videosWithTrustedSamples",
          count(v.video_id) FILTER(WHERE observed_dates=0) "videosWithoutTrustedSamples",
          count(v.video_id) FILTER(WHERE observed_dates=1) "videosWithOneDate",
          count(v.video_id) FILTER(WHERE observed_dates>=2) "videosWithMultipleDates",
          count(v.video_id) FILTER(WHERE observed_dates=90) "videosWithAllRequestedDates",
          count(v.video_id) FILTER(WHERE observed_dates>=2 AND invalid_points=0) "renderableVideosWithMultipleDates",
          count(v.video_id) FILTER(WHERE invalid_points>0) "unrenderableVideos",
          COALESCE(sum(trusted_samples),0) "rawObservationCount",COALESCE(sum(observed_dates),0) "selectedPointCount",
          count(v.video_id)*90-COALESCE(sum(observed_dates),0) "missingVideoDates",
          COALESCE(sum(invalid_points),0) "invalidSelectedPointCount",
          count(v.video_id) FILTER(WHERE missing_tracked) "missingTrackedVideos",
          count(v.video_id) FILTER(WHERE v.video_id !~ '${MONITORING_YOUTUBE_VIDEO_ID_PATTERN}') "invalidVideoIds",
          min(observed_dates) "minimumObservedDates",max(observed_dates) "maximumObservedDates",
          to_char(min(first_observed_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') "firstObservedAt",
          to_char(max(last_observed_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') "lastObservedAt"
        FROM (VALUES(true),(false)) scopes(approved) LEFT JOIN inspection_videos v ON v.has_approved_link=scopes.approved
        GROUP BY scopes.approved
      ) coverage)
    ) FROM inspection_bounds b`;
}

type NativeBucket = Record<string, number | string | null> & { scope: "approved" | "candidate_only" };
type NativeProof = Record<string, unknown> & { sourceKeys: string[]; captureClock: string; startDate: string; endDate: string;
  startsAt: string; buckets: NativeBucket[]; sourceTypes: Array<Record<string, unknown>> };
export type MonitoringYoutubeNativeInspection = {
  status: "complete" | "uninspected" | "unavailable" | "invalid";
  reason: string;
  approvedOutcome: "no_approved_relationships" | "absent_in_range" | "present_one_date_only" | "present_partial" | "present_all_requested_dates" | "present_unrenderable" | null;
  proof: NativeProof | null;
};
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
function instant(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  const fraction = (value.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0");
  return BigInt(milliseconds) * 1000n + BigInt(fraction.slice(3));
}
function nativeInstant(value: unknown): bigint | null {
  return typeof value === "string" && /\.\d{6}Z$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19) ? instant(value) : null;
}
function eastern(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}:${part("second")}` };
}
const countFields = ["eligibleVideos", "videosWithAnySamples", "videosWithTrustedSamples", "videosWithoutTrustedSamples", "videosWithOneDate",
  "videosWithMultipleDates", "videosWithAllRequestedDates", "renderableVideosWithMultipleDates", "unrenderableVideos", "rawObservationCount",
  "selectedPointCount", "missingVideoDates", "invalidSelectedPointCount", "missingTrackedVideos", "invalidVideoIds"];

/** Validate an independently clocked, exact source-key proof. Missing schema,
 * transport/proof fields or contradictions remain unknown; zero is evidence. */
export function evaluateMonitoringYoutubeNativeInspection(value: unknown, options: {
  sourceKeys: readonly string[]; captureClocks: unknown[]; missingTables?: readonly string[]; identityConflict?: boolean;
  approvedTrackedVideos?: unknown;
}): MonitoringYoutubeNativeInspection {
  const result = (status: MonitoringYoutubeNativeInspection["status"], reason: string): MonitoringYoutubeNativeInspection => ({ status, reason, approvedOutcome: null, proof: null });
  if (value == null) return result("uninspected", "native_archive_not_in_evidence");
  const missing = (options.missingTables ?? []).filter(table => REQUIRED_TABLES.includes(table));
  if (missing.length) return result("unavailable", `missing_sources:${missing.sort().join(",")}`);
  if (!object(value) || options.identityConflict) return result("invalid", "invalid_or_conflicted_identity_proof");
  if (value.inspectionVersion !== MONITORING_YOUTUBE_NATIVE_INSPECTION_VERSION || value.inspected !== true
    || value.servingContractVersion !== CONTRACT.version
    || value.sourceTable !== SOURCE_TABLE || value.trustedSourceType !== SOURCE_TYPE || value.timeZone !== TIME_ZONE || value.rangeDays !== RANGE_DAYS
    || value.kind !== "native_intraday_cumulative" || value.selection !== "last_observation_per_et_date"
    || value.substitutesForApprovedDailySnapshots !== false || value.allTimeCoverageInspected !== false) return result("invalid", "wrong_native_source_contract");
  if (!Array.isArray(value.sourceKeys) || !value.sourceKeys.every(key => typeof key === "string" && key.trim())
    || new Set(value.sourceKeys).size !== value.sourceKeys.length || !value.sourceKeys.length
    || JSON.stringify([...value.sourceKeys].sort()) !== JSON.stringify([...new Set(options.sourceKeys)].sort())) return result("invalid", "source_key_scope_mismatch");
  const captured = nativeInstant(value.captureClock), starts = nativeInstant(value.startsAt);
  if (captured == null || starts == null || starts > captured || !options.captureClocks.length
    || options.captureClocks.some(clock => instant(clock) !== captured)) return result("invalid", "capture_clock_mismatch");
  const startDate = new Date(`${value.endDate}T12:00:00Z`);
  if (!Number.isFinite(startDate.getTime())) return result("invalid", "invalid_date_range");
  startDate.setUTCDate(startDate.getUTCDate() - 89);
  if (value.endDate !== eastern(value.captureClock as string).date || value.startDate !== startDate.toISOString().slice(0, 10)
    || eastern(value.startsAt as string).date !== value.startDate || eastern(value.startsAt as string).time !== "00:00:00"
    || !(value.startsAt as string).endsWith(".000000Z")) return result("invalid", "date_range_mismatch");
  const boundedTimes = (first: unknown, last: unknown, hasPoints: boolean) => {
    if (!hasPoints) return first === null && last === null;
    const min = nativeInstant(first), max = nativeInstant(last);
    return min != null && max != null && min >= starts && max <= captured && min <= max;
  };
  if (!Array.isArray(value.buckets) || value.buckets.length !== 2 || !value.buckets.every(object)
    || JSON.stringify(value.buckets.map(bucket => bucket.scope).sort()) !== JSON.stringify(["approved", "candidate_only"])) return result("invalid", "missing_relationship_buckets");
  for (const raw of value.buckets) {
    if (!countFields.every(field => integer(raw[field]))) return result("invalid", "invalid_native_counts");
    const b = raw as Record<string, number>;
    if (b.videosWithoutTrustedSamples + b.videosWithOneDate + b.videosWithMultipleDates !== b.eligibleVideos
      || b.videosWithTrustedSamples + b.videosWithoutTrustedSamples !== b.eligibleVideos
      || b.videosWithAnySamples < b.videosWithTrustedSamples || b.videosWithAnySamples > b.eligibleVideos
      || b.videosWithAllRequestedDates > b.videosWithMultipleDates || b.unrenderableVideos > b.videosWithTrustedSamples
      || b.renderableVideosWithMultipleDates > b.videosWithMultipleDates || b.renderableVideosWithMultipleDates > b.eligibleVideos - b.unrenderableVideos
      || b.videosWithMultipleDates - b.renderableVideosWithMultipleDates > b.unrenderableVideos
      || b.selectedPointCount < b.videosWithOneDate + 90 * b.videosWithAllRequestedDates + 2 * (b.videosWithMultipleDates - b.videosWithAllRequestedDates)
      || b.selectedPointCount > b.videosWithOneDate + 90 * b.videosWithAllRequestedDates + 89 * (b.videosWithMultipleDates - b.videosWithAllRequestedDates)
      || (b.rawObservationCount === 0) !== (b.videosWithTrustedSamples === 0)
      || b.rawObservationCount < b.selectedPointCount || b.missingVideoDates !== 90 * b.eligibleVideos - b.selectedPointCount
      || b.invalidSelectedPointCount < b.unrenderableVideos || b.invalidSelectedPointCount > b.selectedPointCount
      || (b.invalidSelectedPointCount === 0) !== (b.unrenderableVideos === 0) || b.missingTrackedVideos > b.eligibleVideos || b.invalidVideoIds > b.eligibleVideos
      || !boundedTimes(raw.firstObservedAt, raw.lastObservedAt, b.rawObservationCount > 0)) return result("invalid", "native_counts_do_not_reconcile");
    if (b.eligibleVideos === 0 ? raw.minimumObservedDates !== null || raw.maximumObservedDates !== null
      : !integer(raw.minimumObservedDates) || !integer(raw.maximumObservedDates) || b.minimumObservedDates > b.maximumObservedDates || b.maximumObservedDates > 90
        || (b.minimumObservedDates === 0) !== (b.videosWithoutTrustedSamples > 0) || (b.maximumObservedDates === 0) !== (b.videosWithTrustedSamples === 0)
        || (b.minimumObservedDates === 1) !== (b.videosWithoutTrustedSamples === 0 && b.videosWithOneDate > 0)
        || (b.maximumObservedDates === 1) !== (b.videosWithOneDate > 0 && b.videosWithMultipleDates === 0)
        || (b.minimumObservedDates === 90) !== (b.videosWithAllRequestedDates === b.eligibleVideos)
        || (b.maximumObservedDates === 90) !== (b.videosWithAllRequestedDates > 0)
        || b.selectedPointCount < b.minimumObservedDates * (b.eligibleVideos - 1) + b.maximumObservedDates
        || b.selectedPointCount > b.maximumObservedDates * (b.eligibleVideos - 1) + b.minimumObservedDates) return result("invalid", "invalid_per_video_date_bounds");
    if (b.rawObservationCount > 0) {
      const span = (Date.parse(eastern(raw.lastObservedAt as string).date) - Date.parse(eastern(raw.firstObservedAt as string).date)) / 86_400_000 + 1;
      if (b.maximumObservedDates > span) return result("invalid", "observed_dates_exceed_timestamp_span");
    }
  }
  if (!Array.isArray(value.sourceTypes) || !value.sourceTypes.every(object)) return result("invalid", "missing_native_source_inventory");
  const types = new Set<string>();
  for (const source of value.sourceTypes) {
    const key = JSON.stringify([source.scope, source.sourceType]);
    if (types.has(key) || !["approved", "candidate_only"].includes(String(source.scope)) || !(source.sourceType === null || typeof source.sourceType === "string")
      || !integer(source.rows) || !source.rows || !integer(source.nonNullViews) || source.nonNullViews > source.rows
      || !integer(source.videos) || !source.videos || source.videos > source.rows || !boundedTimes(source.firstObservedAt, source.lastObservedAt, true)) return result("invalid", "invalid_native_source_inventory");
    types.add(key);
  }
  for (const bucket of value.buckets) {
    const entries = value.sourceTypes.filter(source => source.scope === bucket.scope);
    const official = entries.find(source => source.sourceType === SOURCE_TYPE);
    if (entries.filter(source => source.sourceType === SOURCE_TYPE).reduce((sum, source) => sum + Number(source.nonNullViews), 0) !== bucket.rawObservationCount
      || entries.filter(source => source.sourceType === SOURCE_TYPE).reduce((sum, source) => sum + Number(source.videos), 0) < Number(bucket.videosWithTrustedSamples)
      || entries.reduce((sum, source) => sum + Number(source.videos), 0) < Number(bucket.videosWithAnySamples)
      || entries.some(source => Number(source.videos) > Number(bucket.videosWithAnySamples))
      || (entries.length === 0) !== (bucket.videosWithAnySamples === 0)) return result("invalid", "source_inventory_coverage_mismatch");
    // Source inventory includes null views, so its interval may be wider than
    // trusted sample coverage, but it cannot exclude any trusted timestamp.
    if (Number(bucket.rawObservationCount) > 0 && (!official
      || nativeInstant(bucket.firstObservedAt)! < nativeInstant(official.firstObservedAt)!
      || nativeInstant(bucket.lastObservedAt)! > nativeInstant(official.lastObservedAt)!)) return result("invalid", "source_inventory_time_mismatch");
  }
  const approved = value.buckets.find(bucket => bucket.scope === "approved")!;
  if ("approvedTrackedVideos" in options && (!integer(options.approvedTrackedVideos)
    || Number(approved.eligibleVideos) - Number(approved.missingTrackedVideos) !== options.approvedTrackedVideos)) return result("invalid", "approved_relationship_scope_mismatch");
  const approvedOutcome = !approved.eligibleVideos ? "no_approved_relationships" : approved.unrenderableVideos ? "present_unrenderable"
    : !approved.videosWithTrustedSamples ? "absent_in_range" : !approved.videosWithMultipleDates ? "present_one_date_only"
      : approved.videosWithAllRequestedDates === approved.eligibleVideos ? "present_all_requested_dates" : "present_partial";
  return { status: "complete", reason: "exact_scoped_native_archive_inspected", approvedOutcome, proof: value as NativeProof };
}
