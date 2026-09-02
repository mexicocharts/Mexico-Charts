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

async function startServer(): Promise<void> {
  const schemaStartedAt = performance.now();
  await initializeAccountSchema();
  logger.info({
    event: "startup_schema_initialized",
    schema: "account",
    durationMs: Math.round((performance.now() - schemaStartedAt) * 10) / 10,
  }, "Account schema initialized before accepting requests");

  await ensureArtistCatalogSchema();

  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
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
  });
  server.on("error", err => {
    logger.fatal({ errorName: err.name }, "Server failed to listen");
    process.exit(1);
  });
}

void startServer().catch(error => {
  logger.fatal({
    event: "startup_schema_failed",
    errorName: error instanceof Error ? error.name : "UnknownStartupError",
  }, "Required database schema initialization failed; refusing to start");
  process.exit(1);
});
