import { timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import type { runSongstatsHistoryBackfill } from "../lib/songstats-history-backfill";
import type {
  buildSongstatsHistoryValidationReport,
  songstatsHistoryValidationState,
} from "../lib/songstats-history-validation-report";
import type { finalizeSongstatsHistoryImportRun } from "../lib/songstats-history-store";

const REQUESTED_ARTISTS = [
  "peso-pluma",
  "banda ms de sergio lizarraga",
  "neton-vega",
] as const;
const CANONICAL_ARTISTS = [
  "pesopluma",
  "bandamsdesergiolizarraga",
  "netonvega",
] as const;
const REQUEST_TO_CANONICAL = new Map(
  REQUESTED_ARTISTS.map((artist, index) => [artist, CANONICAL_ARTISTS[index]!] as const),
);
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;
const APPROVED_TASKS = REQUESTED_ARTISTS.flatMap(requestedArtist =>
  YEARS.map(year => ({
    requestedArtist,
    canonicalArtist: REQUEST_TO_CANONICAL.get(requestedArtist)!,
    year,
  })),
);
const RUN_ID = "songstats-controlled-three-artist-history-2026-09-01";
const CONFIRM = "controlled-three-artist-songstats-history";
const ENABLE_ENV = "SONGSTATS_HISTORY_VALIDATION_HTTP_ENABLED";
const EXPECTED_FINGERPRINT_ENV = "SONGSTATS_HISTORY_VALIDATION_EXPECTED_SOURCE_FINGERPRINT";
const ADMIN_KEY_ENV = "SONGSTATS_ADMIN_KEY";

declare const __SONGSTATS_HISTORY_VALIDATION_FINGERPRINT__: string;
const BAKED_FINGERPRINT =
  typeof __SONGSTATS_HISTORY_VALIDATION_FINGERPRINT__ === "string"
    ? __SONGSTATS_HISTORY_VALIDATION_FINGERPRINT__
    : "";

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(req: Request, env: NodeJS.ProcessEnv): boolean {
  const expected = env[ADMIN_KEY_ENV]?.trim() ?? "";
  const supplied = req.header("x-admin-key")?.trim() ?? "";
  return expected.length >= 64 && secureEqual(expected, supplied);
}

function guardEnabled(
  env: NodeJS.ProcessEnv,
  actualFingerprint: string,
): "ok" | "disabled" | "fingerprint" {
  if (env["NODE_ENV"] !== "production" ||
      env[ENABLE_ENV]?.trim().toLowerCase() !== "true") {
    return "disabled";
  }
  const expected = env[EXPECTED_FINGERPRINT_ENV]?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/.test(expected) ||
      !/^[a-f0-9]{64}$/.test(actualFingerprint) ||
      !secureEqual(expected, actualFingerprint)) {
    return "fingerprint";
  }
  return "ok";
}

function exactKeys(body: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(body).sort().join(",") === [...keys].sort().join(",");
}

function exactChunkBody(body: unknown): body is {
  action: "chunk";
  artist: typeof REQUESTED_ARTISTS[number];
  year: typeof YEARS[number];
  confirm: typeof CONFIRM;
} {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  return exactKeys(record, ["action", "artist", "year", "confirm"]) &&
    record["action"] === "chunk" && record["confirm"] === CONFIRM &&
    REQUESTED_ARTISTS.includes(record["artist"] as typeof REQUESTED_ARTISTS[number]) &&
    YEARS.includes(record["year"] as typeof YEARS[number]);
}

function exactReportBody(body: unknown): boolean {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  return exactKeys(record, ["action", "confirm"]) &&
    record["action"] === "report" && record["confirm"] === CONFIRM;
}

export function createSongstatsHistoryValidationRouter(options: {
  env?: NodeJS.ProcessEnv;
  actualFingerprint?: string;
  loadState?: typeof songstatsHistoryValidationState;
  runBackfill?: typeof runSongstatsHistoryBackfill;
  finalizeRun?: typeof finalizeSongstatsHistoryImportRun;
  buildReport?: typeof buildSongstatsHistoryValidationReport;
} = {}) {
  const env = options.env ?? process.env;
  const actualFingerprint = options.actualFingerprint ?? BAKED_FINGERPRINT;
  const loadState = options.loadState ?? (async input =>
    (await import("../lib/songstats-history-validation-report"))
      .songstatsHistoryValidationState(input));
  const runBackfill = options.runBackfill ?? (async input =>
    (await import("../lib/songstats-history-backfill"))
      .runSongstatsHistoryBackfill(input));
  const finalizeRun = options.finalizeRun ?? (async runId =>
    (await import("../lib/songstats-history-store"))
      .finalizeSongstatsHistoryImportRun(runId));
  const buildReport = options.buildReport ?? (async input =>
    (await import("../lib/songstats-history-validation-report"))
      .buildSongstatsHistoryValidationReport(input));
  const router = Router();
  router.post("/admin/songstats/history-validation", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const guard = guardEnabled(env, actualFingerprint);
    if (guard === "disabled") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!authorized(req, env)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (guard === "fingerprint") {
      res.status(409).json({ error: "Songstats history validation source fingerprint mismatch" });
      return;
    }

    try {
      const state = await loadState({
        runId: RUN_ID,
        artistKeys: CANONICAL_ARTISTS,
      });
      if (state.some(chunk => chunk.run_id !== RUN_ID)) {
        res.status(409).json({ error: "Existing compact chunk belongs to another run" });
        return;
      }
      const terminalFailure = state.find(chunk =>
        ["failed", "identity_blocked", "paused"].includes(chunk.status),
      );
      if (terminalFailure) {
        res.status(409).json({ error: "Validation import stopped", chunk: terminalFailure });
        return;
      }
      const activeRunning = state.find(chunk => {
        if (chunk.status !== "running") return false;
        const updatedAt = chunk.updated_at ? Date.parse(chunk.updated_at) : Number.NaN;
        return !Number.isFinite(updatedAt) || Date.now() - updatedAt < 15 * 60_000;
      });
      if (activeRunning) {
        res.status(409).json({ error: "A validation chunk is already running" });
        return;
      }
      const completed = new Set(state
        .filter(chunk => chunk.status === "completed")
        .map(chunk => `${chunk.artist_key}:${chunk.window_start_date.slice(0, 4)}`));
      const next = APPROVED_TASKS.find(task =>
        !completed.has(`${task.canonicalArtist}:${task.year}`),
      );

      if (exactReportBody(req.body)) {
        if (next) {
          res.status(409).json({ error: "Validation import is not complete", next });
          return;
        }
        await finalizeRun(RUN_ID);
        const report = await buildReport({
          runId: RUN_ID,
          artistKeys: CANONICAL_ARTISTS,
        });
        res.status(200).json({
          fingerprint: actualFingerprint,
          report,
        });
        return;
      }

      if (!exactChunkBody(req.body) || !next ||
          req.body.artist !== next.requestedArtist || req.body.year !== next.year) {
        res.status(400).json({ error: "Invalid or out-of-order validation chunk", next });
        return;
      }

      const requestEvents: Array<Record<string, unknown>> = [];
      const progressEvents: Array<Record<string, unknown>> = [];
      const result = await runBackfill({
        mode: "validation",
        limit: 3,
        artistKeys: [...CANONICAL_ARTISTS],
        startDate: "2020-01-01",
        endDate: "2026-09-01",
        concurrency: 1,
        maxAttempts: 3,
        runId: RUN_ID,
        task: { artistKey: next.canonicalArtist, year: next.year },
        deferFinalize: true,
        onRequestAttempt(event) {
          requestEvents.push(event);
        },
        onProgress(event) {
          progressEvents.push(event as unknown as Record<string, unknown>);
        },
      });
      res.status(200).json({
        fingerprint: actualFingerprint,
        task: next,
        result,
        requestEvents,
        progressEvents,
        endpoint: "/artists/historic_stats",
      });
    } catch (error) {
      req.log?.error({ error }, "[songstats-history-validation] controlled chunk failed");
      res.status(500).json({ error: "Controlled Songstats history validation failed closed" });
    }
  });
  return router;
}

export default createSongstatsHistoryValidationRouter();
