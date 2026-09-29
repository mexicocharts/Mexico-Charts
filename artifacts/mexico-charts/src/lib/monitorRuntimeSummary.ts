import type { MonitorDashboardData } from "../components/monitoring/MonitorProExperience";

/** Measurements of an authenticated HTTP payload, not visual acceptance or eligibility. */
export function monitorRuntimeSummary(key: string, data: MonitorDashboardData, durationMs: number) {
  const tracks = data.spotifyCatalog.items.filter(item => item.type === "track");
  const albums = data.spotifyCatalog.items.filter(item => item.type === "album");
  return {
    artistKey: key, responseArtistKey: data.subscription.artistKey,
    measuredAt: new Date().toISOString(), durationMs: Math.round(durationMs),
    evidence: "authenticated_dashboard_response", visualAcceptance: "not_measured",
    sectionStatus: data.sectionStatus ?? null,
    identity: data.identityDiagnostics ?? null,
    current: data.current,
    spotify: {
      source: data.spotifyCatalog.source, tracks: tracks.length, albums: albums.length,
      tracksWithLifetimeStreams: tracks.filter(item => item.totalStreams != null).length,
      tracksWithDailyStreams: tracks.filter(item => item.dailyStreams != null).length,
      initialTrackArtwork: tracks.filter(item => item.artworkUrl).length,
      initialAlbumArtwork: albums.filter(item => item.artworkUrl).length,
      finalArtwork: "requires_browser_enrichment_verification",
      historyPoints: data.spotifyCatalog.history.length,
      pageStatus: data.spotifyCatalog.pageStatus,
    },
    platformHistoryPoints: data.history.length,
    availableHistory: data.availableHistory,
    youtube: {
      collectionEvidence: data.youtubeCatalogDeferred ? "summary_only_catalog_independent" : "complete_dashboard_catalog",
      videos: data.youtubeCatalogDeferred ? data.youtubeCatalogSummary?.total ?? null : data.liveVideos.length,
      withObservations: data.youtubeCatalogDeferred ? data.youtubeCatalogSummary?.observed ?? null : data.liveVideos.filter(video => video.observed_at && video.view_count != null).length,
      withRawDeltas: data.youtubeCatalogDeferred ? data.youtubeCatalogSummary?.deltas ?? null : data.liveVideos.filter(video => video.view_delta != null).length,
      freshnessAndRenderedDeltaAcceptance: "not_measured",
      historyPoints: data.liveVideoHistory.length,
    },
    mexicoMarkets: data.topMexicoCities.length,
    comparisonArtists: data.comparisonArtists.length,
    activitySignals: data.dailyPulse.signals.length,
    pulseStatus: data.dailyPulse.status,
    reportCapabilities: data.reportCapabilities,
    reportExportAcceptance: "not_measured",
  };
}
