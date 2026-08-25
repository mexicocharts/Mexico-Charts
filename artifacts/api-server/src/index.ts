import app from "./app";
import { logger } from "./lib/logger";
import { startYoutubeChannelSnapshotScheduler } from "./lib/youtube-channel-snapshot-scheduler";
import { startSpotifyKworbSnapshotScheduler } from "./lib/spotify-kworb-snapshot-scheduler";
import { startYoutubeVideoTrackerScheduler } from "./lib/youtube-video-tracker-scheduler";
import { startSongstatsSnapshotScheduler } from "./lib/songstats-snapshot-scheduler";
import { startArtistSocialDiscoveryScheduler } from "./lib/artist-social-discovery-scheduler";
import { seedSupplementalArtistCatalog } from "./lib/supplemental-artist-catalog";
import { startYoutubeIntradayShadowScheduler } from "./lib/youtube-intraday-shadow-scheduler";
import { startTouringShadowScheduler } from "./lib/ticketmaster-touring-shadow";
import { startTouringAnnouncementMonitor } from "./lib/touring-announcement-monitor";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startYoutubeChannelSnapshotScheduler();
  startSpotifyKworbSnapshotScheduler();
  startYoutubeVideoTrackerScheduler();
  startSongstatsSnapshotScheduler();
  startArtistSocialDiscoveryScheduler();
  startYoutubeIntradayShadowScheduler();
  startTouringShadowScheduler();
  startTouringAnnouncementMonitor();
  void seedSupplementalArtistCatalog().catch(err => {
    logger.error({ err }, "[artists] supplemental catalog seed failed");
  });
});
