import type { RequestHandler } from "express";
import type { MonitoringAuthorizationDecision } from "./monitoring-authorization";
import { MonitoringYoutubeVideoAccessError, validMonitoringYoutubeHistoryInput, type MonitoringYoutubeHistoryRange } from "./monitoring-youtube-native-history";

export interface MonitoringYoutubeHistoryRequest {
  artistKey: string;
  artistKeys: string[];
  videoId: string;
  range: MonitoringYoutubeHistoryRange;
  includeCandidateOnly: boolean;
  deadlineAt: number;
}

/** The existing Clerk middleware runs first. Artist entitlement is established
 * before exact video membership and native observations are queried. */
export function createMonitoringYoutubeHistoryHandler(deps: {
  userId: (res: Parameters<RequestHandler>[1]) => string;
  authorize: (userId: string, artistKey: string) => Promise<MonitoringAuthorizationDecision>;
  aliases: (artistKey: string) => string[];
  read: (input: MonitoringYoutubeHistoryRequest) => Promise<unknown>;
  failure: (error: unknown) => { status: number; code: string };
  diagnostic?: (event: Record<string, unknown>) => void;
}): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    const startedAt = performance.now();
    const deadlineAt = Date.now() + 12_000;
    const artistKey = String(req.params.artistKey ?? "").trim().toLowerCase();
    const videoId = String(req.params.videoId ?? "").trim();
    const range = String(req.query.range ?? "30d");
    if (!artistKey || artistKey.length > 160 || !validMonitoringYoutubeHistoryInput(videoId, range)) {
      res.status(400).json({ error: "Unsupported artist, video or history range", code: "invalid_video_history_request" });
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const operation = async () => {
        const access = await deps.authorize(deps.userId(res), artistKey);
        if (Date.now() >= deadlineAt) throw new Error("Monitoring history deadline exceeded");
        if (!access.allowed || !access.grant) {
          const missing = access.source === "internal" && access.outcome === "artist_not_found";
          return { status: missing ? 404 : 403, body: { error: missing ? "Artist not found" : "Artist Pro access is required for this artist",
            code: missing ? "artist_not_found" : "monitoring_access_denied" } };
        }
        const grant = access.grant;
        const body = await deps.read({
          artistKey: grant.artist_key,
          // Source expansion starts only from the granted identity. A route
          // alias or arbitrary video ID never creates a second artist grant.
          artistKeys: grant.identity_conflict ? [grant.artist_key] : [...new Set([
            grant.artist_key, ...(grant.match_keys ?? []), ...deps.aliases(grant.artist_key), ...deps.aliases(grant.artist_name),
          ])], videoId, range, includeCandidateOnly: access.source === "internal", deadlineAt,
        });
        return { status: 200, body };
      };
      const result = await Promise.race([operation(), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Monitoring history deadline exceeded")), Math.max(0, deadlineAt - Date.now()));
      })]);
      res.status(result.status).json(result.body);
      deps.diagnostic?.({ artistKey, videoId, range, outcome: result.status === 200 ? "loaded" : "denied", durationMs: performance.now() - startedAt });
    } catch (error) {
      const denied = error instanceof MonitoringYoutubeVideoAccessError;
      const failure = denied ? { status: 403, code: "monitoring_video_access_denied" } : deps.failure(error);
      res.status(failure.status).json({ error: denied ? "Video history is not available for this artist access"
        : failure.status === 504 ? "The history request exceeded its serving deadline" : "History is temporarily unavailable", code: failure.code });
      deps.diagnostic?.({ artistKey, videoId, range, outcome: failure.code, durationMs: performance.now() - startedAt });
    } finally { if (timer) clearTimeout(timer); }
  };
}
