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

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  try {
    await ensureArtistCatalogSchema();
  } catch (schemaError) {
    logger.fatal({ err: schemaError }, "[artists] catalog schema initialization failed");
    process.exit(1);
  }
  startYoutubeChannelSnapshotScheduler();
  startSpotifyKworbSnapshotScheduler();
  startYoutubeVideoTrackerScheduler();
  startSongstatsSnapshotScheduler();
  startArtistSocialDiscoveryScheduler();
  startMexicanIdentityDiscoveryScheduler();
  void seedSupplementalArtistCatalog().catch(err => {
    logger.error({ err }, "[artists] supplemental catalog seed failed");
  });
});
