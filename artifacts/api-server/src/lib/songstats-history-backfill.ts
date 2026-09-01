import { randomUUID } from "node:crypto";
import type { SongstatsHistoricStatsResponse } from "./songstats-client";
import {
  fetchLicensedSongstatsArtistHistory,
  SongstatsHistoryHttpError,
} from "./songstats-history-client";
import {
  normalizeSongstatsHistoricStats,
  planSongstatsHistoryBackfill,
  SONGSTATS_HISTORY_ACTIVE_METRICS,
  SONGSTATS_HISTORY_QUARANTINED_METRICS,
  yearlySongstatsHistoryWindows,
  type SongstatsHistoryWindow,
} from "./songstats-history-model";
import {
  checkpointSongstatsHistoryImportRun,
  assertSongstatsHistoryCompactSchema,
  claimSongstatsHistoryChunk,
  completeSongstatsHistoryChunk,
  createSongstatsHistoryImportRun,
  failSongstatsHistoryChunk,
  finalizeSongstatsHistoryImportRun,
  listSongstatsHistoryRoster,
  pauseSongstatsHistoryImportRun,
  recordSongstatsHistoryRequestAttempt,
  recordSongstatsHistoryChunkTelemetry,
  songstatsHistoryCapacitySnapshot,
  songstatsHistoryStorageImpact,
  songstatsHistoryWalBytesSince,
  type SongstatsHistoryRosterArtist,
} from "./songstats-history-store";
import {
  DEFAULT_SONGSTATS_HISTORY_CAPACITY_POLICY,
  songstatsHistoryCapacityPauseReason,
  songstatsHistoryCapacityProjection,
  type SongstatsHistoryCapacityPolicy,
} from "./songstats-history-capacity";

const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Songstats history error";
}

function errorCode(error: unknown): string {
  return error instanceof SongstatsHistoryHttpError
    ? `songstats_http_${error.status}`
    : error instanceof Error && error.name
      ? error.name.toLowerCase()
      : "unknown_error";
}

function retryable(error: unknown): boolean {
  return error instanceof SongstatsHistoryHttpError
    ? TRANSIENT_STATUS_CODES.has(error.status)
    : error instanceof TypeError;
}

export interface SongstatsHistoryBackfillProgress {
  runId: string;
  artistKey: string;
  window: SongstatsHistoryWindow;
  status: "completed" | "skipped" | "failed" | "identity_blocked" | "warning" | "paused";
  inserted?: number;
  duplicates?: number;
  error?: string;
  safeguard?: Record<string, unknown>;
}

export interface SongstatsHistoryBackfillOptions {
  mode: "test" | "validation" | "full";
  startDate?: string;
  endDate?: string;
  limit: number;
  artistKeys?: string[];
  concurrency?: number;
  maxAttempts?: number;
  runId?: string;
  task?: { artistKey: string; year: number };
  deferFinalize?: boolean;
  capacityPolicy?: Partial<SongstatsHistoryCapacityPolicy>;
  onProgress?: (progress: SongstatsHistoryBackfillProgress) => void;
  onRequestAttempt?: (event: {
    artistKey: string;
    window: SongstatsHistoryWindow;
    attempt: number;
    outcome: "started" | "failed";
    error?: string;
  }) => Promise<void> | void;
  fetchHistoricStats?: (
    artist: SongstatsHistoryRosterArtist,
    window: SongstatsHistoryWindow,
  ) => Promise<SongstatsHistoricStatsResponse>;
}


export async function buildSongstatsHistoryDryRun(options: {
  limit: number;
  artistKeys?: string[];
  startDate?: string;
  endDate?: string;
}) {
  const startDate = options.startDate ?? "2020-01-01";
  const endDate = options.endDate ?? new Date().toISOString().slice(0, 10);
  const roster = await listSongstatsHistoryRoster({
    limit: options.limit,
    artistKeys: options.artistKeys,
  });
  const verified = roster.filter(artist => artist.identityValidationStatus === "verified");
  const blocked = roster.filter(artist => artist.identityValidationStatus !== "verified");
  return {
    dryRun: true,
    writes: false,
    apiCalls: 0,
    plan: planSongstatsHistoryBackfill({
      artistCount: roster.length,
      startDate,
      endDate,
    }),
    roster: {
      selected: roster.length,
      identityVerified: verified.length,
      identityBlocked: blocked.length,
      blockedArtists: blocked.map(artist => ({
        artistKey: artist.artistKey,
        spotifyArtistId: artist.spotifyArtistId,
        status: artist.identityValidationStatus,
        evidence: artist.identityEvidence,
      })),
    },
    billing: {
      model: "unique_artist_per_month",
      euroPerUniqueArtist: 0.4,
      maximumEuro: Math.round(roster.length * 0.4 * 100) / 100,
      incrementalIfAlreadyRequestedThisMonth: 0,
    },
    safety: {
      endpoint: "/artists/historic_stats",
      commercialScope: "artist_historical_stats",
      outsideScopeEndpointsUsed: [],
      executionRequiresExplicitFlag: true,
      capacityPolicy: DEFAULT_SONGSTATS_HISTORY_CAPACITY_POLICY,
      activeMetricDefinitions: SONGSTATS_HISTORY_ACTIVE_METRICS.length,
      quarantinedMetricDefinitions: SONGSTATS_HISTORY_QUARANTINED_METRICS.map(metric => metric.metricKey),
      emergencyStopEnvironmentVariable: "SONGSTATS_HISTORY_EMERGENCY_STOP",
    },
  };
}

async function fetchWithRetry(
  request: () => Promise<SongstatsHistoricStatsResponse>,
  maxAttempts: number,
  onAttempt?: (
    attempt: number,
    outcome: "started" | "failed",
    error?: unknown,
  ) => Promise<void> | void,
): Promise<SongstatsHistoricStatsResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await onAttempt?.(attempt, "started");
      return await request();
    } catch (error) {
      lastError = error;
      await onAttempt?.(attempt, "failed", error);
      if (!retryable(error) || attempt >= maxAttempts) break;
      const exponential = 750 * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(exponential + jitter);
    }
  }
  throw lastError;
}

export async function runSongstatsHistoryBackfill(
  options: SongstatsHistoryBackfillOptions,
): Promise<Record<string, unknown>> {
  const startDate = options.startDate ?? "2020-01-01";
  const endDate = options.endDate ?? new Date().toISOString().slice(0, 10);
  const maxAttempts = Math.max(1, Math.min(5, Math.floor(options.maxAttempts ?? 3)));
  const concurrency = Math.max(1, Math.min(5, Math.floor(options.concurrency ?? 2)));
  if (options.mode === "test" && (!options.artistKeys?.length || options.artistKeys.length > 3)) {
    throw new Error("Test mode requires one to three explicit --artist-key values");
  }
  if (options.mode === "test" && process.env["SONGSTATS_HISTORY_TARGET_ENVIRONMENT"] !== "nonproduction") {
    throw new Error("Test mode is locked to an explicitly labeled nonproduction database");
  }
  if (options.mode === "test" && process.env["SONGSTATS_HISTORY_TEST_APPROVED"] !== "true") {
    throw new Error("Representative test requests are locked until SONGSTATS_HISTORY_TEST_APPROVED=true is explicitly authorized");
  }
  if (options.mode === "validation" && (!options.artistKeys?.length || options.artistKeys.length > 3)) {
    throw new Error("Production validation mode requires one to three explicit --artist-key values");
  }
  if (options.mode === "validation" && process.env["SONGSTATS_HISTORY_TARGET_ENVIRONMENT"] !== "production-validation") {
    throw new Error("Production validation mode requires SONGSTATS_HISTORY_TARGET_ENVIRONMENT=production-validation");
  }
  if (options.mode === "validation" && process.env["SONGSTATS_HISTORY_PRODUCTION_VALIDATION_APPROVED"] !== "true") {
    throw new Error("Production validation requests are locked until SONGSTATS_HISTORY_PRODUCTION_VALIDATION_APPROVED=true is explicitly authorized");
  }
  if (options.mode === "validation" && concurrency !== 1) {
    throw new Error("Production validation mode is limited to concurrency=1");
  }
  if (options.mode === "full" && process.env["SONGSTATS_FULL_HISTORY_BACKFILL_APPROVED"] !== "true") {
    throw new Error("Full backfill is locked; set SONGSTATS_FULL_HISTORY_BACKFILL_APPROVED=true only after explicit approval");
  }

  await assertSongstatsHistoryCompactSchema();
  const capacityPolicy: SongstatsHistoryCapacityPolicy = {
    ...DEFAULT_SONGSTATS_HISTORY_CAPACITY_POLICY,
    ...options.capacityPolicy,
  };
  const approvedWalFromEnvironment = Number(process.env["SONGSTATS_APPROVED_WAL_AMPLIFICATION_RATIO"]);
  if (Number.isFinite(approvedWalFromEnvironment) && approvedWalFromEnvironment > 0) {
    capacityPolicy.approvedWalAmplificationRatio = approvedWalFromEnvironment;
  }
  if (options.mode === "full" && capacityPolicy.approvedWalAmplificationRatio == null) {
    throw new Error("Full backfill requires an approved WAL amplification ratio from representative validation");
  }
  const baselineCapacity = await songstatsHistoryCapacitySnapshot();
  const baselineStorage = await songstatsHistoryStorageImpact();
  const roster = await listSongstatsHistoryRoster({
    limit: options.limit,
    artistKeys: options.artistKeys,
  });
  const windows = yearlySongstatsHistoryWindows(startDate, endDate);
  if (options.task) {
    if (!options.artistKeys?.includes(options.task.artistKey)) {
      throw new Error("Selected history task artist is outside the approved roster");
    }
    if (!windows.some(window => window.year === options.task!.year)) {
      throw new Error("Selected history task year is outside the approved request range");
    }
  }
  const runId = options.runId ?? randomUUID();
  await createSongstatsHistoryImportRun({
    runId,
    mode: options.mode,
    startDate,
    endDate,
    rosterSize: roster.length,
    plannedRequestCount: roster.length * windows.length,
    options: {
      concurrency,
      maxAttempts,
      artistKeys: options.artistKeys ?? null,
      endpoint: "/artists/historic_stats",
      commercialEndpoint: "artist_historical_stats",
      capacityPolicy,
      baselineDatabaseBytes: baselineCapacity.databaseBytes,
      baselineStorage: {
        databaseBytes: baselineCapacity.databaseBytes,
        ...baselineStorage,
      },
    },
  });

  const tasks = roster
    .flatMap(artist => windows.map(window => ({ artist, window })))
    .filter(task => !options.task || (
      task.artist.artistKey === options.task.artistKey &&
      task.window.year === options.task.year
    ));
  let nextTask = 0;
  let pauseReason: string | null = null;
  let warningEmitted = false;
  const fetchHistoricStats = options.fetchHistoricStats ?? (async (artist, window) => {
    if (!artist.songstatsArtistId) throw new Error("Songstats artist ID is required after identity validation");
    return fetchLicensedSongstatsArtistHistory({
      songstatsArtistId: artist.songstatsArtistId,
      source: "all",
      startDate: window.startDate,
      endDate: window.endDate,
      withAggregates: true,
    });
  });

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (nextTask < tasks.length && !pauseReason) {
      if (process.env["SONGSTATS_HISTORY_EMERGENCY_STOP"] === "true") {
        pauseReason = "runner_emergency_stop";
        await pauseSongstatsHistoryImportRun({
          runId,
          reason: pauseReason,
          capacity: { emergencyStop: true },
        });
        break;
      }
      const capacityBefore = await songstatsHistoryCapacitySnapshot();
      const projection = songstatsHistoryCapacityProjection({
        databaseBytes: capacityBefore.databaseBytes,
        baselineDatabaseBytes: baselineCapacity.databaseBytes,
        policy: capacityPolicy,
      });
      const guardReason = songstatsHistoryCapacityPauseReason(projection, capacityPolicy);
      if (guardReason) {
        pauseReason = guardReason;
        await pauseSongstatsHistoryImportRun({ runId, reason: guardReason, capacity: projection });
        options.onProgress?.({
          runId,
          artistKey: "__runner__",
          window: windows[0]!,
          status: "paused",
          safeguard: { reason: guardReason, ...projection },
        });
        break;
      }
      if (!warningEmitted && projection.databaseGiB >= capacityPolicy.warningDatabaseGiB) {
        warningEmitted = true;
        options.onProgress?.({
          runId,
          artistKey: "__runner__",
          window: windows[0]!,
          status: "warning",
          safeguard: { reason: "database_60gib_warning", ...projection },
        });
      }
      const task = tasks[nextTask++]!;
      const progressBase = {
        runId,
        artistKey: task.artist.artistKey,
        window: task.window,
      };
      const claim = await claimSongstatsHistoryChunk({ runId, ...task });
      if (claim.status === "completed") {
        options.onProgress?.({ ...progressBase, status: "skipped" });
        continue;
      }
      if (claim.status === "busy") {
        throw new Error(
          `Songstats history chunk is already running for ${task.artist.artistKey} ${task.window.year}`,
        );
      }
      if (claim.status === "identity_blocked") {
        options.onProgress?.({ ...progressBase, status: "identity_blocked" });
        await checkpointSongstatsHistoryImportRun(runId);
        continue;
      }
      const chunkStartedAt = process.hrtime.bigint();
      let chunkRetryCount = 0;
      let chunkFailureCount = 0;
      try {
        const remainingAttempts = maxAttempts - claim.priorAttemptCount;
        if (remainingAttempts < 1) {
          throw new Error("Songstats history chunk exhausted its bounded request attempts");
        }
        const fetchedAt = new Date();
        const payload = await fetchWithRetry(
          () => fetchHistoricStats(task.artist, task.window),
          remainingAttempts,
          async (attempt, outcome, error) => {
            const absoluteAttempt = claim.priorAttemptCount + attempt;
            const message = error ? errorMessage(error) : undefined;
            if (outcome === "started" && absoluteAttempt > 1) {
              chunkRetryCount = Math.max(chunkRetryCount, absoluteAttempt - 1);
            }
            if (outcome === "failed") chunkFailureCount += 1;
            await recordSongstatsHistoryRequestAttempt({
              chunkId: claim.chunkId,
              attempt: absoluteAttempt,
              outcome,
              error: message,
            });
            await options.onRequestAttempt?.({
              artistKey: task.artist.artistKey,
              window: task.window,
              attempt: absoluteAttempt,
              outcome,
              error: message,
            });
          },
        );
        const normalized = normalizeSongstatsHistoricStats({
          artistKey: task.artist.artistKey,
          spotifyArtistId: task.artist.spotifyArtistId,
          expectedSongstatsArtistId: task.artist.songstatsArtistId,
          requestIdentityType: "songstats_artist_id",
          requestIdentityValue: task.artist.songstatsArtistId!,
          windowStartDate: task.window.startDate,
          windowEndDate: task.window.endDate,
          fetchedAt,
          importRunId: runId,
          includeQuarantined: options.mode === "test" || options.mode === "validation",
          payload,
        });
        if (normalized.identityValidationStatus !== "verified") {
          await failSongstatsHistoryChunk({
            artistKey: task.artist.artistKey,
            window: task.window,
            errorCode: "payload_identity_mismatch",
            errorMessage: "Songstats historic response did not match the saved Songstats artist identity",
            identityValidationStatus: normalized.identityValidationStatus,
            identityEvidence: normalized.identityEvidence,
          });
          options.onProgress?.({ ...progressBase, status: "identity_blocked" });
        } else if (normalized.conflicts.length) {
          await failSongstatsHistoryChunk({
            artistKey: task.artist.artistKey,
            window: task.window,
            errorCode: "conflicting_provider_points",
            errorMessage: `Conflicting duplicate Songstats observations: ${normalized.conflicts.slice(0, 5).join(", ")}`,
          });
          options.onProgress?.({ ...progressBase, status: "failed", error: "Conflicting provider observations" });
        } else {
          const saved = await completeSongstatsHistoryChunk({
            runId,
            artistKey: task.artist.artistKey,
            window: task.window,
            responseHash: normalized.responseHash,
            fetchedAt,
            chunkId: claim.chunkId,
            providerIdentityId: claim.providerIdentityId,
            observations: normalized.observations,
            parserDuplicateCount: normalized.duplicateCount,
          });
          options.onProgress?.({ ...progressBase, status: "completed", ...saved });
          const walBytes = await songstatsHistoryWalBytesSince(capacityBefore.walLsn);
          const estimatedLogicalBytes = Math.max(
            1,
            saved.inserted * capacityPolicy.compactBytesPerObservation,
          );
          const walAmplificationRatio = walBytes / estimatedLogicalBytes;
          await recordSongstatsHistoryChunkTelemetry({
            chunkId: claim.chunkId,
            walBytes,
            estimatedLogicalBytes,
            rowsInserted: saved.inserted,
            elapsedMs: Number(process.hrtime.bigint() - chunkStartedAt) / 1_000_000,
            retryCount: chunkRetryCount,
            failureCount: chunkFailureCount,
          });
          const approvedRatio = capacityPolicy.approvedWalAmplificationRatio;
          if (approvedRatio != null && walAmplificationRatio > approvedRatio * 2) {
            pauseReason = "pitr_write_amplification_anomaly";
            await pauseSongstatsHistoryImportRun({
              runId,
              reason: pauseReason,
              capacity: { walBytes, estimatedLogicalBytes, walAmplificationRatio, approvedRatio },
            });
            options.onProgress?.({
              ...progressBase,
              status: "paused",
              safeguard: { reason: pauseReason, walBytes, estimatedLogicalBytes, walAmplificationRatio, approvedRatio },
            });
          } else if (options.mode === "test" || options.mode === "validation") {
            options.onProgress?.({
              ...progressBase,
              status: "warning",
              safeguard: { reason: "test_measurement", walBytes, estimatedLogicalBytes, walAmplificationRatio },
            });
          }
        }
      } catch (error) {
        await failSongstatsHistoryChunk({
          artistKey: task.artist.artistKey,
          window: task.window,
          errorCode: errorCode(error),
          errorMessage: errorMessage(error),
        });
        const failedWalBytes = await songstatsHistoryWalBytesSince(capacityBefore.walLsn);
        await recordSongstatsHistoryChunkTelemetry({
          chunkId: claim.chunkId,
          walBytes: failedWalBytes,
          estimatedLogicalBytes: 0,
          rowsInserted: 0,
          elapsedMs: Number(process.hrtime.bigint() - chunkStartedAt) / 1_000_000,
          retryCount: chunkRetryCount,
          failureCount: Math.max(1, chunkFailureCount),
        });
        options.onProgress?.({
          ...progressBase,
          status: "failed",
          error: errorMessage(error),
        });
      }
      await checkpointSongstatsHistoryImportRun(runId);
      await sleep(125);
    }
  });
  await Promise.all(workers);
  if (pauseReason) {
    return { runId, status: "paused", pauseReason };
  }
  if (options.deferFinalize) {
    await checkpointSongstatsHistoryImportRun(runId);
    return { runId, status: "running", deferredFinalization: true };
  }
  return finalizeSongstatsHistoryImportRun(runId);
}
