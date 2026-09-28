import { createHash } from "node:crypto";
import { summarizeMonitoringKworbCatalog, type MonitoringKworbCatalog } from "./monitoring-kworb-catalog";
import type { MonitoringCandidateEvidenceRow, MonitoringCandidateIdentity } from "./monitoring-candidate-policy";

/** Consumer-only evidence: the exact catalog loader used by the profile.
 * Never changes stored evidence, legacy eligibility, or non-Spotify sources. */
export async function reconcileMonitoringLiveCatalog(
  artist: MonitoringCandidateIdentity,
  row: MonitoringCandidateEvidenceRow,
  load: (id: string) => Promise<MonitoringKworbCatalog>,
): Promise<MonitoringCandidateEvidenceRow> {
  const id = artist.spotifyIds[0];
  const base = { ...row.source_evidence };
  if (artist.identityConflict || artist.spotifyIds.length !== 1 || !id || !/^[A-Za-z0-9]{22}$/.test(id)
      || !["provider_id", "accepted_registry"].includes(artist.identityMappingStatus)) {
    return { ...row, source_evidence: { ...base, liveCatalogInvestigation: {
      status: "skipped", reason: "unambiguous_verified_spotify_identity_required",
      catalogEvidenceApplied: false, artworkEvidenceApplied: false,
    } } };
  }
  let catalog: MonitoringKworbCatalog;
  const started = Date.now();
  try { catalog = await load(id); }
  catch (error) {
    // Do not serialize upstream messages: they may contain request credentials.
    return { ...row, source_evidence: { ...base, liveCatalogInvestigation: {
      status: "failed", source: "kworb_live_complete_catalog", spotifyArtistId: id,
      reason: "profile_catalog_loader_failed", errorType: error instanceof Error ? error.name : "UnknownError",
      attemptedAt: new Date(started).toISOString(), durationMs: Date.now() - started,
      catalogEvidenceApplied: false, artworkEvidenceApplied: false,
    } } };
  }
  const totals = summarizeMonitoringKworbCatalog(catalog.items);
  const reference = `profile-catalog:sha256:${createHash("sha256").update(JSON.stringify({ id, catalog })).digest("hex")}`;
  const streamItems = catalog.items.map(item => ({ item_type: item.type, item_key: item.key, title: item.title,
    artwork_url: item.artworkUrl, spotify_url: item.spotifyUrl, total_streams: item.totalStreams,
    daily_streams: item.dailyStreams, compilation: item.compilation }));
  return { ...row, stream_items: streamItems, served_summary: {
    snapshot_date: catalog.snapshotDate, fetched_at: catalog.fetchedAt,
    track_count: totals.trackCount, album_count: totals.albumCount,
    track_total_streams: totals.trackTotalStreams, track_daily_streams: totals.trackDailyStreams,
    album_total_streams: totals.albumTotalStreams, album_daily_streams: totals.albumDailyStreams,
    source_table: catalog.source, source_artist_keys: [artist.artistKey], derivation: "sum_catalog_items",
  }, source_evidence: { ...base,
    liveCatalogInvestigation: { status: "reviewed", reviewKind: "shared_profile_loader_capture_not_visual_acceptance",
      source: catalog.source, reference, spotifyArtistId: id, observedAt: catalog.snapshotDate,
      sourceDates: catalog.sourceDates, acquiredAt: catalog.fetchedAt,
      attemptedAt: new Date(started).toISOString(), durationMs: Date.now() - started,
      catalogEvidenceApplied: true, artworkEvidenceApplied: catalog.items.every(item => Boolean(item.artworkUrl)),
      artworkLookupAttempted: true,
      artworkStatus: catalog.items.every(item => Boolean(item.artworkUrl)) ? "all_items_matched" : "partial_provider_lookup_unresolved",
      sourceUrls: [`https://kworb.net/spotify/artist/${id}_songs.html`, `https://kworb.net/spotify/artist/${id}_albums.html`],
    },
    // A successful parser is not independent proof of upstream completeness.
    // Populate measured data without promoting strict eligibility on that basis.
    catalogCompleteness: { verified: false, source: catalog.source, reference, spotifyArtistId: id,
      reason: "independent_source_row_coverage_not_verified", measuredTracks: totals.trackCount, measuredAlbums: totals.albumCount },
    liveCatalogRuntime: { reference, source: catalog.source, items: streamItems,
      tracks: totals.trackCount, albums: totals.albumCount,
      tracksWithLifetimeStreams: catalog.items.filter(i => i.type === "track" && i.totalStreams != null).length,
      tracksWithDailyStreams: catalog.items.filter(i => i.type === "track" && i.dailyStreams != null).length,
      tracksWithArtwork: catalog.items.filter(i => i.type === "track" && i.artworkUrl).length,
      albumsWithArtwork: catalog.items.filter(i => i.type === "album" && i.artworkUrl).length,
    },
  } };
}
