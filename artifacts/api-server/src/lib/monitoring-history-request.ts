import type { RequestHandler } from "express";
import type { MonitoringAuthorizationDecision } from "./monitoring-authorization";
import type { CompactHistoryRange } from "./songstats-history-serving";

export function isMonitoringHistoryTimeout(error: unknown): boolean {
  return error instanceof Error && (
    (error as Error & { code?: string }).code === "57014"
    || error.name === "MonitoringHistoryBudgetError"
    || /timeout|timed out|deadline/i.test(error.message)
  );
}

export interface MonitoringHistoryRequest {
  artistKey: string;
  artistKeys: string[];
  metricKey: string;
  range: CompactHistoryRange;
  resolution: "auto" | "daily" | "minmax";
  startDate?: string;
  endDate?: string;
  deadlineAt: number;
}

/** Separate request orchestration makes it impossible to authorize history by
 * rendering a dashboard. Authentication middleware runs before this handler. */
export function createMonitoringHistoryHandler(deps: {
  userId: (res: Parameters<RequestHandler>[1]) => string;
  authorize: (userId: string, artistKey: string) => Promise<MonitoringAuthorizationDecision>;
  aliases: (artistKey: string) => string[];
  read: (input: MonitoringHistoryRequest) => Promise<unknown>;
  failure: (error: unknown) => { status: number; code: string };
  diagnostic?: (event: Record<string, unknown>) => void;
}): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const startedAt = performance.now();
    // Same serving budget as a dashboard, now spent only on authorization and
    // this metric. The browser has a 15s transport/authentication budget.
    const deadlineAt = Date.now() + 12_000;
    const artistKey = String(req.params.artistKey ?? "").trim().toLowerCase();
    const metricKey = String(req.params.metricKey ?? "").trim();
    const range = String(req.query.range ?? "all") as CompactHistoryRange;
    const resolution = String(req.query.resolution ?? "auto") as MonitoringHistoryRequest["resolution"];
    if (!artistKey || artistKey.length > 160 || !/^[A-Za-z][A-Za-z0-9]{1,79}$/.test(metricKey)
      || !["7d", "30d", "90d", "6m", "1y", "all", "custom"].includes(range)
      || !["auto", "daily", "minmax"].includes(resolution)) {
      res.status(400).json({ error: "Unsupported artist, metric or history range", code: "invalid_history_request" });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const operation = async () => {
        const access = await deps.authorize(deps.userId(res), artistKey);
        if (Date.now() >= deadlineAt) throw new Error("Monitoring history deadline exceeded");
        if (!access.allowed || !access.grant) {
          const missing = access.source === "internal" && access.outcome === "artist_not_found";
          return { status: missing ? 404 : 403, body: {
            error: missing ? "Artist not found" : "Artist Pro access is required for this artist",
            code: missing ? "artist_not_found" : "monitoring_access_denied",
          } };
        }
        const body = await deps.read({
          artistKey: access.grant.artist_key,
          artistKeys: access.grant.identity_conflict ? [access.grant.artist_key] : [...new Set([
            access.grant.artist_key,
            ...(access.grant.match_keys ?? []),
            ...deps.aliases(access.grant.artist_key),
            ...deps.aliases(access.grant.artist_name),
            ...deps.aliases(artistKey),
          ])],
          metricKey, range, resolution, deadlineAt,
          startDate: String(req.query.startDate ?? "") || undefined,
          endDate: String(req.query.endDate ?? "") || undefined,
        });
        return { status: 200, body };
      };
      const result = await Promise.race([
        operation(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Monitoring history deadline exceeded")), Math.max(0, deadlineAt - Date.now()));
        }),
      ]);
      res.status(result.status).json(result.body);
      deps.diagnostic?.({ artistKey, metricKey, outcome: result.status === 200 ? "loaded" : "denied", durationMs: performance.now() - startedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const invalid = message === "Unknown or quarantined historical metric"
        || message === "Custom history range requires valid startDate and endDate";
      const failure = invalid ? { status: 400, code: "invalid_history_request" } : deps.failure(error);
      res.status(failure.status).json({
        error: invalid ? "Unsupported metric or history range" : failure.status === 504
          ? "The history request exceeded its serving deadline"
          : "History is temporarily unavailable",
        code: failure.code,
      });
      deps.diagnostic?.({ artistKey, metricKey, outcome: failure.code, durationMs: performance.now() - startedAt });
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
}
