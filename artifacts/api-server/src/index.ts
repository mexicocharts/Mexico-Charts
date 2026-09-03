import app from "./app";
import { logger } from "./lib/logger";
import { startYoutubeChannelSnapshotScheduler } from "./lib/youtube-channel-snapshot-scheduler";
import { startSpotifyKworbSnapshotScheduler } from "./lib/spotify-kworb-snapshot-scheduler";
import { startYoutubeVideoTrackerScheduler } from "./lib/youtube-video-tracker-scheduler";
import { startSongstatsSnapshotScheduler } from "./lib/songstats-snapshot-scheduler";
import { startArtistSocialDiscoveryScheduler } from "./lib/artist-social-discovery-scheduler";
import { startMexicanIdentityDiscoveryScheduler } from "./lib/mexican-identity-discovery-scheduler";
import { seedSupplementalArtistCatalog } from "./lib/supplemental-artist-catalog";
import { ensureArtistCatalogSchema } from "./lib/artist-catalog-schema";
import { startArtistDataQualityScheduler } from "./lib/artist-data-quality-scheduler";
import { startYoutubeIntradayShadowScheduler } from "./lib/youtube-intraday-shadow-scheduler";
import { startYoutubeAuthorizedLiveValidation } from "./lib/youtube-authorized-live-validation";
import { startChartArchiveScheduler } from "./lib/chart-archive-scheduler";
import { startTouringShadowScheduler } from "./lib/ticketmaster-touring-shadow";
import { startTouringAnnouncementMonitor } from "./lib/touring-announcement-monitor";
import { startTouringAlertDelivery } from "./lib/touring-alert-delivery";
import { startTouringWeeklySummaryScheduler } from "./lib/touring-weekly-summary";
import { initializeAccountSchema } from "./lib/account-schema";
import { databaseTargetConfiguration, monitoringReadPool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

logger[databaseTargetConfiguration.conflictingTargets ? "warn" : "info"]({
  event: "database_target_configuration",
  ...databaseTargetConfiguration,
}, databaseTargetConfiguration.conflictingTargets
  ? "Multiple database targets differ; runtime is using the selected source"
  : "Database target configuration resolved");

let runtimeInitialized = false;
let runtimeRetryTimer: NodeJS.Timeout | null = null;

async function initializeRuntime(): Promise<void> {
  if (runtimeInitialized) return;
  const schemaStartedAt = performance.now();
  await initializeAccountSchema();
  logger.info({
    event: "startup_schema_initialized",
    schema: "account",
    durationMs: Math.round((performance.now() - schemaStartedAt) * 10) / 10,
  }, "Account schema initialized before accepting requests");

  await ensureArtistCatalogSchema();

  runtimeInitialized = true;
  // Start the public live-counter collector first. Several legacy backfills can
  // perform long startup work; live counters must not wait behind them.
  startYoutubeIntradayShadowScheduler();
  // Protected seven-day comparator: writes validation-only tables and leaves
  // the Innertube discovery process and public catalog behavior unchanged.
  startYoutubeAuthorizedLiveValidation();
  startYoutubeChannelSnapshotScheduler();
  startSpotifyKworbSnapshotScheduler();
  startYoutubeVideoTrackerScheduler();
  startSongstatsSnapshotScheduler();
  startArtistSocialDiscoveryScheduler();
  startMexicanIdentityDiscoveryScheduler();
  startArtistDataQualityScheduler();
  startChartArchiveScheduler();
  startTouringShadowScheduler();
  startTouringAnnouncementMonitor();
  startTouringAlertDelivery();
  startTouringWeeklySummaryScheduler();
  void seedSupplementalArtistCatalog().catch(err => {
    logger.error({ err }, "[artists] supplemental catalog seed failed");
  });
}

function scheduleRuntimeInitialization(): void {
  void initializeRuntime().catch(error => {
    logger.error({
      event: "startup_schema_retry_scheduled",
      errorName: error instanceof Error ? error.name : "UnknownStartupError",
    }, "Required database schema initialization failed; API remains healthy and will retry");
    if (!runtimeRetryTimer) {
      runtimeRetryTimer = setTimeout(() => {
        runtimeRetryTimer = null;
        scheduleRuntimeInitialization();
      }, 15_000);
      runtimeRetryTimer.unref();
    }
  });
}

const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
  // Wake the latency-sensitive Artist Pro connection before startup
  // collectors compete for database capacity. This keeps the first signed-in
  // dashboard request out of the database provider's cold-start window.
  void monitoringReadPool.query("SELECT 1")
    .then(() => logger.info({ event: "monitoring_read_pool_warmed" }, "Artist Pro monitoring pool warmed"))
    .catch(error => logger.warn({
      event: "monitoring_read_pool_warm_failed",
      errorName: error instanceof Error ? error.name : "UnknownDatabaseError",
    }, "Artist Pro monitoring pool warm-up failed; requests retain bounded fallbacks"))
    .finally(scheduleRuntimeInitialization);
});

server.on("error", err => {
  logger.fatal({ errorName: err.name }, "Server failed to listen");
  process.exit(1);
});
