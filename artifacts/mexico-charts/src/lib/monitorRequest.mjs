import { authenticatedFetch } from "../auth/authenticatedFetch.mjs";
import { MonitoringDashboardHttpError } from "./monitoringAccess.mjs";

// Preserve the existing monitor request budget: the API's 12-second read
// budget plus Clerk's existing three-second token acquisition allowance.
export const MONITOR_REQUEST_TIMEOUT_MS = 15_000;

/** Bound the real request AND body read, and cancel it on route/identity change. */
export async function requestMonitorResource({
  getToken,
  input,
  signal,
  timeoutMs = MONITOR_REQUEST_TIMEOUT_MS,
  fetchAuthenticated = authenticatedFetch,
  readResponse = (response) => response.json(),
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = (handle) => globalThis.clearTimeout(handle),
}) {
  const controller = new AbortController();
  let timer;
  let cancel;
  const interrupted = new Promise((_, reject) => {
    cancel = () => {
      reject(new DOMException("Request cancelled", "AbortError"));
      controller.abort();
    };
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    timer = setTimer(() => {
      reject(
        new MonitoringDashboardHttpError(
          504,
          "La consulta del Monitor agotó su tiempo de respuesta.",
        ),
      );
      controller.abort();
    }, timeoutMs);
  });
  try {
    if (signal?.aborted) return await interrupted;
    const request = (async () => {
      const response = await fetchAuthenticated(getToken, input, {
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new MonitoringDashboardHttpError(
          response.status,
          payload.error || "No se pudo cargar la información del Monitor.",
        );
      }
      try {
        return await readResponse(response);
      } catch (error) {
        if (
          error instanceof MonitoringDashboardHttpError ||
          error?.name === "AbortError"
        )
          throw error;
        throw new MonitoringDashboardHttpError(
          502,
          "El Monitor recibió una respuesta incompleta o inválida.",
        );
      }
    })();
    return await Promise.race([request, interrupted]);
  } finally {
    clearTimer(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export function monitorRequestState({
  isFetching,
  error,
  succeeded,
  observationCount = 0,
  partial = false,
}) {
  if (isFetching) return "loading";
  if (error) {
    if (error.status === 401 || error.status === 403)
      return "authorization_failure";
    if (error.status === 504) return "timeout";
    return "backend_failure";
  }
  if (!succeeded) return "backend_failure";
  if (observationCount === 0) return "empty";
  return partial ? "partial" : "loaded";
}

const validHistoryDate = (date) =>
  typeof date === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(`${date}T12:00:00Z`)) &&
  new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;

export function monitorHistoryRequest({
  userId,
  artistKey,
  metricKey,
  range = "all",
}) {
  if (!["7d", "30d", "90d", "6m", "1y", "all"].includes(range))
    throw new RangeError("Unsupported history range");
  const resolution = range === "all" ? "auto" : "daily";
  return {
    queryKey: [
      "monitor-history",
      userId,
      artistKey,
      metricKey,
      range,
      resolution,
    ],
    input: `/api/monitoring/history/${encodeURIComponent(artistKey)}/${encodeURIComponent(metricKey)}?range=${range}&resolution=${resolution}`,
  };
}

/** Bounded windows use only their exact response, never a filtered min/max series. */
export function monitorHistoryWindowData({
  range,
  allPoints = [],
  allResponse,
  selectedResponse,
}) {
  const response = range === "all" ? allResponse : selectedResponse;
  const pointsByDate = new Map(
    (range === "all" ? allPoints : []).map((point) => [point.date, point]),
  );
  for (const [date, value] of response?.points ?? [])
    pointsByDate.set(date, { date, value });
  const points = [...pointsByDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const missingDateCount = response?.rangeCoverage?.missingDateCount ?? 0;
  return {
    points,
    missingDateCount,
    partial: points.length === 1 || missingDateCount > 0,
  };
}

export function validateMonitorHistory(payload, expectedRange) {
  if (
    !payload ||
    !Array.isArray(payload.points) ||
    !["available", "unavailable"].includes(payload.status) ||
    (payload.status === "available") !== payload.points.length > 0 ||
    payload.points.some(
      (point) =>
        !Array.isArray(point) ||
        !validHistoryDate(point[0]) ||
        !Number.isFinite(point[1]),
    )
  ) {
    throw new MonitoringDashboardHttpError(
      502,
      "La respuesta del historial no contiene observaciones válidas.",
    );
  }
  if (
    expectedRange &&
    expectedRange !== "all" &&
    (payload.points.length > 0 || payload.requestedRange)
  ) {
    const range = payload.requestedRange;
    const days =
      range &&
      validHistoryDate(range.startDate) &&
      validHistoryDate(range.endDate)
        ? Math.round(
            (Date.parse(`${range.endDate}T12:00:00Z`) -
              Date.parse(`${range.startDate}T12:00:00Z`)) /
              86_400_000,
          ) + 1
        : 0;
    if (
      !range ||
      range.preset !== expectedRange ||
      days < 1 ||
      days > ({ "7d": 7, "30d": 30, "90d": 90, "6m": 182, "1y": 365 }[expectedRange] ?? 0) + 1 ||
      payload.resolution?.returned !== "daily" ||
      payload.rangeCoverage?.observationCount !== payload.points.length ||
      new Set(payload.points.map((point) => point[0])).size !==
        payload.points.length ||
      payload.rangeCoverage?.missingDateCount !==
        days - payload.points.length ||
      payload.points.some(
        (point) => point[0] < range.startDate || point[0] > range.endDate,
      )
    ) {
      throw new MonitoringDashboardHttpError(
        502,
        "El historial recibido no corresponde a la ventana diaria solicitada.",
      );
    }
  }
  return payload;
}

export function validateMonitorDashboard(payload) {
  const requiredArrays = [
    payload?.history,
    payload?.dailyPulse?.signals,
    payload?.availableHistory?.metrics,
    payload?.topMexicoCities,
    payload?.catalog?.releases,
    payload?.liveVideos,
    payload?.liveVideoHistory,
    payload?.comparisonArtists,
    payload?.spotifyCatalog?.items,
    payload?.spotifyCatalog?.history,
  ];
  if (
    !payload ||
    typeof payload.subscription?.artistKey !== "string" ||
    typeof payload.subscription?.artistName !== "string" ||
    !["subscription", "internal"].includes(
      payload.subscription?.accessSource,
    ) ||
    !payload.growth ||
    !payload.youtubeCoverage ||
    !payload.reportCapabilities ||
    requiredArrays.some((value) => !Array.isArray(value))
  ) {
    throw new MonitoringDashboardHttpError(
      502,
      "La respuesta del Monitor está incompleta; no se puede confirmar la disponibilidad de datos.",
    );
  }
  return payload;
}

export function canDisplayMonitorData({
  configured,
  isLoaded,
  isSignedIn,
  userId,
  data,
  error,
}) {
  return Boolean(
    configured && isLoaded && isSignedIn && userId && data && !error,
  );
}

export function shouldRetryMonitorRequest(failureCount, error) {
  return (
    error?.name !== "AbortError" &&
    !(error instanceof MonitoringDashboardHttpError) &&
    failureCount < 1
  );
}
