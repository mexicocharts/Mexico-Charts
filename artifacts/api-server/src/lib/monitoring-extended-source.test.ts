import test from "node:test";
import assert from "node:assert/strict";
import { MONITORING_EXTENDED_SOURCE_SQL, selectMonitoringExtendedSource } from "./monitoring-extended-source";

test("verified provider ID lookup cannot also admit a conflicting exact key", () => {
  assert.match(MONITORING_EXTENDED_SOURCE_SQL, /\$2::text IS NOT NULL AND spotify_artist_id=\$2/);
  assert.match(MONITORING_EXTENDED_SOURCE_SQL, /\$2::text IS NULL AND lower\(artist_key\)=ANY/);
  assert.doesNotMatch(MONITORING_EXTENDED_SOURCE_SQL, /INSERT|UPDATE|DELETE|youtube_|LIMIT/);
});
test("independent endpoint captures survive a newer null-only alias", () => {
  const rows = [
    { artist_key: "exact", updated_at: "2026-09-28", audience: null, catalog: { releases: [1] } },
    { artist_key: "same-provider", updated_at: "2026-09-27", audience: { cities: [1] }, historic_stats: { points: [1] } },
  ];
  const result = selectMonitoringExtendedSource(rows);
  assert.deepEqual(result.audience, { cities: [1] });
  assert.deepEqual(result.catalog, { releases: [1] });
  assert.equal(result.sourceKeys.audience, "same-provider");
  assert.equal(result.sourceKeys.catalog, "exact");
  assert.deepEqual(rows[0].audience, null);
});
test("endpoint acquisition time wins over unrelated row updates; empty payload stays authoritative", () => {
  const result = selectMonitoringExtendedSource([
    { artist_key: "old", updated_at: "2026-09-28", audience_fetched_at: "2026-09-20", audience: { cities: [1] } },
    { artist_key: "new", audience_fetched_at: "2026-09-27", audience: {} },
  ]);
  assert.deepEqual(result.audience, {});
  assert.equal(result.sourceKeys.audience, "new");
});
