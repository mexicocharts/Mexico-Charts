import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_NATANAEL_ESTIMATE_SEEDS,
  NATANAEL_FIX_DATE,
  NATANAEL_FIX_RATE,
  PUBLIC_ESTIMATION_LABEL,
  aggregatePublicTourEstimates,
  evidenceGate,
} from "./ticketmaster-touring-public-estimation";

test("keeps the three approved Natanael point-estimate seeds exact", () => {
  assert.equal(APPROVED_NATANAEL_ESTIMATE_SEEDS.length, 3);
  assert.deepEqual(APPROVED_NATANAEL_ESTIMATE_SEEDS.map(seed => [
    seed.event_id, seed.override_tickets_sold, seed.override_gross_usd,
    seed.override_average_ticket_usd, seed.override_confidence_percent,
  ]), [
    ["140064E7A6C847E4", 58840, 7118000, 120.98, 76],
    ["140064E7A9094A5C", 56300, 4817000, 85.56, 61],
    ["3D0064E988A81234", 20500, 2843000, 138.68, 67],
  ]);
  assert.equal(NATANAEL_FIX_RATE, 16.9460);
  assert.equal(NATANAEL_FIX_DATE, "2026-08-25");
});

test("aggregates an artist tour with weighted confidence and no duplicate event rows", () => {
  const seeds = APPROVED_NATANAEL_ESTIMATE_SEEDS.map((seed) => ({
    eventId: seed.event_id, artistId: seed.artist_id, artistName: seed.artist_name, tourName: seed.tour_name,
    eventName: seed.event_id, date: seed.event_date, venue: seed.venue_name, city: seed.venue_city,
    status: "estimated" as const, estimatedTicketsSold: seed.override_tickets_sold,
    estimatedGrossUsd: Number(seed.override_gross_usd), estimatedAverageTicketUsd: Number(seed.override_average_ticket_usd),
    estimatedCapacityUtilization: (seed.override_tickets_sold ?? 0) / (seed.configured_capacity ?? 1),
    confidencePercent: Number(seed.override_confidence_percent), confidenceLabel: "medium",
    evidenceTimestamp: seed.evidence_timestamp, methodologyVersion: "test", estimateLabel: PUBLIC_ESTIMATION_LABEL,
    lastUpdated: seed.evidence_timestamp,
  }));
  const result = aggregatePublicTourEstimates(seeds);
  assert.equal(result.length, 1);
  assert.equal(result[0].estimatedTicketsSold, 135640);
  assert.equal(result[0].estimatedGrossUsd, 14778000);
  assert.equal(result[0].estimatedAverageTicketUsd, 108.95);
  assert.equal(result[0].confidencePercent, 68);
});

test("blocks public estimates when evidence is incomplete", () => {
  const result = evidenceGate({
    event_id: "missing-evidence", artist_id: "artist", artist_name: "Artist", tour_name: "Tour",
    event_name: "Event", event_date: "2026-09-01", venue_name: "Venue", venue_city: "CDMX",
    venue_id: null, event_kind: "concert", event_status: null, public_sale_start: null, price_ranges: [],
    seat_map_url: null, ticket_limit: null, observed_at: "2026-08-27T00:00:00.000Z",
    capacity_low: null, capacity_high: null, capacity_configuration: null, capacity_confidence: null, capacity_source_url: null,
  });
  assert.equal(result.eligible, false);
  assert.ok(result.missing.includes("configured capacity"));
  assert.ok(result.missing.includes("primary standard price signal"));
  assert.ok(result.missing.includes("demand/availability signal or calibrated comparable"));
});