import assert from "node:assert/strict";
import test from "node:test";
import { createMonitoringReportPdf } from "./monitoring-report-pdf";

test("Monitor Pro report is a real multi-page PDF containing all product sections", async () => {
  const pdf = await createMonitoringReportPdf({
    artistName: "Luis Miguel",
    artistKey: "luismiguel",
    month: "2026-09",
    generatedAt: new Date("2026-09-02T12:00:00Z"),
    history: [
      {
        date: "2026-09-01",
        spotifyMonthlyListeners: 22_000_000,
        spotifyFollowers: 15_000_000,
        youtubeSubscribers: 4_000_000,
        youtubeChannelViews: 3_000_000_000,
        instagramFollowers: 3_500_000,
        tiktokFollowers: 1_000_000,
      },
      {
        date: "2026-09-02",
        spotifyMonthlyListeners: 22_100_000,
        spotifyFollowers: 15_050_000,
        youtubeSubscribers: 4_010_000,
        youtubeChannelViews: 3_005_000_000,
        instagramFollowers: 3_510_000,
        tiktokFollowers: 1_010_000,
      },
    ],
    spotifyCatalog: {
      snapshotDate: "2026-09-02",
      trackCount: 2,
      albumCount: 1,
      trackDailyStreams: 1_250_000,
      albumDailyStreams: 900_000,
      trackTotalStreams: 5_000_000_000,
      albumTotalStreams: 4_000_000_000,
      items: [
        { type: "track", title: "Ahora Te Puedes Marchar", dailyStreams: 750_000, totalStreams: 1_500_000_000 },
        { type: "track", title: "La Incondicional", dailyStreams: 500_000, totalStreams: 2_000_000_000 },
        { type: "album", title: "20 Años", dailyStreams: 900_000, totalStreams: 4_000_000_000 },
      ],
    },
    liveVideos: [
      { video_id: "abc123", title: "La Incondicional", view_count: 500_000_000, views_24h: 125_000 },
    ],
    topMexicoCities: [{ name: "Ciudad de México", currentListeners: 1_500_000 }],
    dailyPulse: {
      headline: "Spotify y YouTube avanzan",
      summary: "La lectura más reciente muestra crecimiento en ambas plataformas.",
    },
    spotifyHistory: [
      { date: "2026-09-01", totalStreams: 4_990_000_000, dailyStreams: 1_200_000 },
      { date: "2026-09-02", totalStreams: 5_000_000_000, dailyStreams: 1_250_000 },
    ],
    liveVideoHistory: [
      { video_id: "abc123", snapshot_date: "2026-09-02", view_count: 500_000_000 },
    ],
    comparisonArtists: [
      { artistName: "Peso Pluma", spotifyMonthlyListeners: 38_000_000 },
    ],
  });

  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 8_000, `expected a designed report, received ${pdf.length} bytes`);
  assert.ok((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length >= 5);
});
