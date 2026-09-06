import { MonitoringDashboardHttpError } from "./monitoringAccess.mjs";

const rangeDays = { "7d": 7, "30d": 30, "90d": 90 };
const etDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
const validTime = (value) =>
  typeof value === "string" &&
  validDate(value.slice(0, 10)) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value) &&
  Number(value.slice(11, 13)) < 24 &&
  Number(value.slice(14, 16)) < 60 &&
  Number(value.slice(17, 19)) < 60 &&
  Number.isFinite(Date.parse(value));
// UTC timestamps share a calendar format; padding to PostgreSQL precision makes
// lexical comparison exact without Date.parse truncating sub-millisecond digits.
const canonicalTime = (value) =>
  `${value.slice(0, 19)}.${(value.match(/\.(\d+)Z$/)?.[1] ?? "").padEnd(6, "0")}Z`;
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const nonempty = (value) =>
  typeof value === "string" && value.trim().length > 0;

export function monitorVideoHistoryRequest({
  userId,
  artistKey,
  videoId,
  range = "30d",
  accessSource,
}) {
  if (!Object.hasOwn(rangeDays, range))
    throw new RangeError("Unsupported video history range");
  return {
    queryKey: [
      "monitor-video-native-history",
      userId,
      artistKey,
      videoId,
      range,
      accessSource,
    ],
    input: `/api/monitoring/videos/${encodeURIComponent(artistKey)}/${encodeURIComponent(videoId)}/history?range=${range}`,
  };
}

/** Accept only the requested identity and exact dated cumulative observations.
 * Coverage describes observed dates, never a daily-view or full-catalog claim.
 */
export function validateMonitorVideoHistory(
  payload,
  { artistKey, videoId, range, accessSource },
) {
  const fail = () => {
    throw new MonitoringDashboardHttpError(
      502,
      "El historial del video contiene observaciones o cobertura inválidas.",
    );
  };
  if (
    !payload ||
    payload.artistKey !== artistKey ||
    payload.videoId !== videoId ||
    payload.range !== range ||
    payload.kind !== "native_intraday_cumulative" ||
    payload.timeZone !== "America/New_York" ||
    payload.selection !== "last_observation_per_et_date" ||
    payload.sourceTable !== "youtube_video_intraday_shadow_snapshots" ||
    payload.sourceType !== "youtube_api_shadow" ||
    !validDate(payload.startDate) ||
    !validDate(payload.endDate) ||
    !validTime(payload.asOf) ||
    !Array.isArray(payload.points)
  )
    fail();
  const days = rangeDays[range];
  if (
    !days ||
    payload.endDate !== etDate.format(new Date(payload.asOf)) ||
    Date.parse(payload.endDate + "T12:00:00Z") -
      Date.parse(payload.startDate + "T12:00:00Z") !==
      (days - 1) * 86_400_000
  )
    fail();
  const relationship = payload.relationship;
  if (
    !relationship ||
    typeof relationship.hasApprovedLink !== "boolean" ||
    !["approved_artist_link", "founder_candidate_diagnostic"].includes(
      relationship.visibilityScope,
    ) ||
    (relationship.visibilityScope === "approved_artist_link") !==
      relationship.hasApprovedLink ||
    !nonempty(relationship.relationSource) ||
    !["active", "review", "verified"].includes(relationship.relationStatus) ||
    ![null, "shadow"].includes(relationship.samplingStatus) ||
    !Array.isArray(relationship.relationshipSources) ||
    relationship.relationshipSources.some(
      (row) =>
        !row ||
        !nonempty(row.source_table) ||
        !nonempty(row.artist_key) ||
        !(nonempty(row.source_id) || count(row.source_id)) ||
        !(row.status === null || nonempty(row.status)) ||
        !(row.sampling_status === null || nonempty(row.sampling_status)) ||
        !(
          row.confidence_score === null || Number.isFinite(row.confidence_score)
        ) ||
        !(
          row.evidence_source === null ||
          typeof row.evidence_source === "string"
        ),
    )
  )
    fail();
  if (
    relationship.visibilityScope === "founder_candidate_diagnostic" &&
    accessSource !== "internal"
  ) {
    throw new MonitoringDashboardHttpError(
      403,
      "La cuenta no autoriza este historial de relación candidata.",
    );
  }
  const dates = new Set(),
    ids = new Set();
  let previousDate = "";
  for (const point of payload.points) {
    if (
      !point ||
      !validDate(point.date) ||
      !validTime(point.observedAt) ||
      !nonempty(point.observationId) ||
      !count(point.viewCount) ||
      point.date < payload.startDate ||
      point.date > payload.endDate ||
      point.date <= previousDate ||
      dates.has(point.date) ||
      ids.has(point.observationId) ||
      point.date !== etDate.format(new Date(point.observedAt)) ||
      canonicalTime(point.observedAt) > canonicalTime(payload.asOf)
    )
      fail();
    dates.add(point.date);
    ids.add(point.observationId);
    previousDate = point.date;
  }
  const coverage = payload.coverage;
  if (
    !coverage ||
    coverage.meaning !== "observed_dates_only" ||
    coverage.requestedDays !== days ||
    coverage.observedDays !== dates.size ||
    !count(coverage.rawObservationCount) ||
    coverage.rawObservationCount < dates.size ||
    !Array.isArray(coverage.missingDates) ||
    coverage.missingDates.length !== days - dates.size ||
    new Set(coverage.missingDates).size !== coverage.missingDates.length ||
    coverage.missingDates.some(
      (date) =>
        !validDate(date) ||
        date < payload.startDate ||
        date > payload.endDate ||
        dates.has(date),
    )
  )
    fail();
  const expectedStatus =
    dates.size === 0 ? "empty" : dates.size === days ? "complete" : "partial";
  if (payload.status !== expectedStatus) fail();
  if (!dates.size) {
    if (
      coverage.rawObservationCount !== 0 ||
      coverage.firstObservedAt !== null ||
      coverage.lastObservedAt !== null
    )
      fail();
  } else {
    // The first raw sample can precede the selected last sample on its ET date.
    if (
      !validTime(coverage.firstObservedAt) ||
      !validTime(coverage.lastObservedAt) ||
      etDate.format(new Date(coverage.firstObservedAt)) !==
        payload.points[0].date ||
      canonicalTime(coverage.firstObservedAt) >
        canonicalTime(payload.points[0].observedAt) ||
      canonicalTime(coverage.lastObservedAt) !==
        canonicalTime(payload.points.at(-1).observedAt)
    )
      fail();
  }
  return payload;
}
