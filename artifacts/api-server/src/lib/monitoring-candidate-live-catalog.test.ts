import assert from "node:assert/strict";
import test from "node:test";
import { reconcileMonitoringLiveCatalog } from "./monitoring-candidate-live-catalog";
import { groupMonitoringCandidateIdentities, type MonitoringCandidateEvidenceRow } from "./monitoring-candidate-policy";
import type { MonitoringKworbCatalog } from "./monitoring-kworb-catalog";
const artist = groupMonitoringCandidateIdentities([{ artist_key: "example", artist_name: "Example", spotify_id: "0000000000000000000101", source: "kworb_coverage" }])[0]!;
const row: MonitoringCandidateEvidenceRow = { artist_key: "example", extended: null, snapshot: null, summary: { original: true }, raw_summary: null,
  legacy: null, source_evidence: { youtube: { observedVideos: 42 } } };
const catalog: MonitoringKworbCatalog = { fetchedAt: "2026-09-28T06:00:00Z", source: "kworb_live_complete_catalog",
  snapshotDate: "2026-09-27", sourceDates: { tracks: "2026-09-27", albums: "2026-09-27" }, items: [
    { type: "track", key: "track", title: "Track", totalStreams: 123, dailyStreams: null, artworkUrl: "https://example.com/art.jpg", spotifyUrl: null, compilation: false },
    { type: "album", key: "album", title: "Album", totalStreams: 456, dailyStreams: 0, artworkUrl: null, spotifyUrl: null, compilation: false },
  ] };
test("audit applies exact profile catalog while preserving dates, nulls, legacy and YouTube", async () => {
  const before = JSON.stringify(row);
  const result = await reconcileMonitoringLiveCatalog(artist, row, async id => { assert.equal(id, artist.spotifyIds[0]); return catalog; });
  assert.equal(JSON.stringify(row), before);
  assert.equal(result.summary, row.summary);
  assert.equal(result.source_evidence.youtube, row.source_evidence.youtube);
  assert.equal(result.served_summary?.track_count, 1);
  assert.equal(result.served_summary?.track_daily_streams, null);
  assert.equal(result.served_summary?.snapshot_date, "2026-09-27");
  assert.equal(result.stream_items?.[0]?.artwork_url, catalog.items[0]?.artworkUrl);
  assert.equal((result.source_evidence.catalogCompleteness as any).verified, false);
  assert.equal((result.source_evidence.liveCatalogInvestigation as any).artworkEvidenceApplied, false);
  assert.equal((result.source_evidence.liveCatalogRuntime as any).tracksWithDailyStreams, 0);
});
test("unknown source date is never replaced by fetch date", async () => {
  const result = await reconcileMonitoringLiveCatalog(artist, row, async () => ({ ...catalog, snapshotDate: null }));
  assert.equal(result.served_summary?.snapshot_date, null);
  assert.equal((result.source_evidence.liveCatalogInvestigation as any).observedAt, null);
});

test("partial live evidence preserves stored rows on the failed side and cannot prove completeness", async () => {
  const stored = { ...row, stream_items: [{ item_type: "album", item_key: "stored", title: "Stored album", artwork_url: null }] };
  const result = await reconcileMonitoringLiveCatalog(artist, stored, async () => ({ ...catalog,
    items: catalog.items.filter(item => item.type === "track"), snapshotDate: null,
    sourceDates: { tracks: "2026-09-27", albums: null },
    pageStatus: { tracks: { status: "loaded", httpStatus: 200, reason: null }, albums: { status: "unresolved", httpStatus: 404, reason: "http_error" } },
  }));
  assert.equal(result.stream_items?.length, 2);
  assert.equal(result.stream_items?.[1]?.item_key, "stored");
  assert.equal(result.served_summary?.album_total_streams, null);
  assert.equal((result.source_evidence.liveCatalogInvestigation as any).coverageStatus, "partial_unresolved");
  assert.equal((result.source_evidence.liveCatalogInvestigation as any).artworkEvidenceApplied, false);
  assert.equal((result.source_evidence.catalogCompleteness as any).verified, false);
  assert.equal(result.source_evidence.youtube, row.source_evidence.youtube);
});
test("failed provider read preserves stored data and redacts upstream details", async () => {
  const result = await reconcileMonitoringLiveCatalog(artist, row, async () => { throw Error("credential-must-not-appear"); });
  assert.equal(result.summary, row.summary);
  assert.equal((result.source_evidence.liveCatalogInvestigation as any).status, "failed");
  assert.doesNotMatch(JSON.stringify(result), /credential-must-not-appear/);
});
test("ambiguous identities never request an arbitrary catalog", async () => {
  const result = await reconcileMonitoringLiveCatalog({ ...artist, identityConflict: true }, row, async () => { throw Error("must not load"); });
  assert.equal((result.source_evidence.liveCatalogInvestigation as any).status, "skipped");
});
test("catalog starts before SQL resolves, without swallowing a SQL failure", async () => {
  let release!: (value: MonitoringCandidateEvidenceRow) => void;
  let started = false;
  const pending = reconcileMonitoringLiveCatalog(artist, new Promise(resolve => { release = resolve; }), async () => {
    started = true; return catalog;
  });
  await Promise.resolve();
  assert.equal(started, true);
  release(row);
  assert.equal((await pending).served_summary?.track_count, 1);
  await assert.rejects(reconcileMonitoringLiveCatalog(artist, Promise.reject(Error("SQL failed")), async () => catalog), /SQL failed/);
});
