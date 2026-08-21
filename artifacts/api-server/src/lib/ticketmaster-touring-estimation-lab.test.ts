import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateEstimate,
  consolidateEstimationEvents,
  loadCompleteShadowRunSnapshots,
  normalizeEstimationVenue,
  selectPrior,
  type ConsolidatedEvent,
} from "./ticketmaster-touring-estimation-lab";
import { shouldRecalculateTouringEstimates } from "./ticketmaster-touring-shadow-scheduler";
import {
  ESTIMATION_LAB_ADMIN_ROUTE_PATHS,
  isShadowAdminHeaderAuthorized,
  PUBLIC_TOURING_ROUTE_PATHS,
} from "../routes/touring";

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  run_id: 2,
  artist_key: "carin-leon",
  artist_name: "Carín León",
  event_id: "event-a",
  event_name: "Carín León",
  event_url: "https://ticketmaster.example/event-a",
  event_date: "2026-09-04",
  event_time: "20:00:00",
  event_status: "onsale",
  public_sale_start_at: "2026-06-01T16:00:00Z",
  price_min: 75,
  price_max: 250,
  price_currency: "USD",
  venue_name: "Sphere",
  venue_type: "arena",
  venue_city: "Las Vegas",
  venue_country: "US",
  venue_timezone: "America/Los_Angeles",
  observed_at: "2026-08-21T00:00:00Z",
  ...overrides,
});

const profile = {
  venueKey: "sphere",
  venueName: "Sphere",
  normalizedVenue: "sphere",
  venueType: "arena-residency",
  capacityLow: 17600,
  capacityCentral: 18800,
  capacityHigh: 20000,
  citationKeys: ["sphere-venue"],
  notes: "Test profile",
};

const prior = {
  prior_key: "carin-leon-2024-us",
  artist_key: "carin-leon",
  venue_type: "all",
  tickets_total: 259000,
  gross_usd_total: 36300000,
  show_count: 25,
  citation_keys: ["artist-priors-2024"],
};

function assertOrdered(value: { low: number; central: number; high: number }) {
  assert.ok(value.low <= value.central);
  assert.ok(value.central <= value.high);
}

test("deduplicates same artist/date/normalized venue and preserves every source ID", () => {
  const consolidated = consolidateEstimationEvents([
    snapshot({ id: 1, event_id: "tm-a", venue_name: "Sphere", observed_at: "2026-08-20T00:00:00Z" }),
    snapshot({ id: 2, event_id: "tm-b", venue_name: "SPHERE!", observed_at: "2026-08-21T00:00:00Z" }),
  ]);
  assert.equal(consolidated.length, 1);
  assert.deepEqual(consolidated[0].sourceEventIds, ["tm-a", "tm-b"]);
  assert.equal(consolidated[0].representative.id, 2);
  assert.equal(normalizeEstimationVenue("SPHÉRE!"), "sphere");
});

test("normalizes PostgreSQL bigint provenance IDs to JSON numbers", () => {
  const consolidated = consolidateEstimationEvents([
    snapshot({ id: "12", run_id: "7", event_id: "tm-a" }) as never,
  ]);
  assert.deepEqual(consolidated[0].sourceSnapshotIds, [12]);
  assert.deepEqual(consolidated[0].sourceRunIds, [7]);
});

test("produces ordered conservative ranges and retains the residency warning", () => {
  const event = consolidateEstimationEvents([snapshot()])[0] as ConsolidatedEvent;
  const estimate = calculateEstimate(event, profile, prior, new Date("2026-08-21T12:00:00Z"));
  assertOrdered(estimate.sellableCapacity);
  assertOrdered(estimate.ticketsMoved);
  assertOrdered(estimate.finalAttendance);
  assertOrdered(estimate.averagePaidPriceUsd);
  assertOrdered(estimate.finalGrossUsd);
  assert.ok(estimate.residencyGroup);
  assert.match(estimate.warnings.join(" "), /model forecasts, not measured Ticketmaster inventory/i);
  assert.match(estimate.warnings.join(" "), /linked residency demand run/i);
});

test("widens price uncertainty when Discovery has null prices", () => {
  const event = consolidateEstimationEvents([
    snapshot({ price_min: null, price_max: null, price_currency: null }),
  ])[0] as ConsolidatedEvent;
  const estimate = calculateEstimate(event, profile, prior, new Date("2026-08-21T12:00:00Z"));
  assertOrdered(estimate.averagePaidPriceUsd);
  assert.ok(estimate.averagePaidPriceUsd.high > estimate.averagePaidPriceUsd.central);
  assert.match(estimate.warnings.join(" "), /price range is missing/i);
});

test("uses Fuerza Regida's cited stadium prior before the general US prior", () => {
  const general = {
    ...prior,
    prior_key: "fuerza-regida-2024-us",
    artist_key: "fuerza-regida",
    tickets_total: 501000,
    gross_usd_total: 67400000,
    show_count: 39,
    citation_keys: ["artist-priors-2024"],
  };
  const stadium = {
    ...general,
    prior_key: "fuerza-regida-2026-stadium-us",
    venue_type: "stadium",
    tickets_total: 330228,
    gross_usd_total: 47198246,
    show_count: 8,
    citation_keys: ["fuerza-stadium-2026"],
  };
  const selected = selectPrior([general, stadium], "fuerza-regida", "stadium");
  assert.equal(selected.prior_key, "fuerza-regida-2026-stadium-us");
  assert.deepEqual(selected.citation_keys, ["fuerza-stadium-2026"]);
  assert.equal(selectPrior([general, stadium], "fuerza-regida", "arena").prior_key, general.prior_key);
});

test("zeros canceled or postponed event forecasts", () => {
  const event = consolidateEstimationEvents([snapshot({ event_status: "postponed" })])[0] as ConsolidatedEvent;
  const estimate = calculateEstimate(event, profile, prior, new Date("2026-08-21T12:00:00Z"));
  assert.deepEqual(estimate.ticketsMoved, { low: 0, central: 0, high: 0 });
  assert.deepEqual(estimate.finalAttendance, { low: 0, central: 0, high: 0 });
  assert.match(estimate.warnings.join(" "), /canceled or postponed/i);
});

test("recalculates only after a complete shadow run", () => {
  assert.equal(shouldRecalculateTouringEstimates("complete"), true);
  assert.equal(shouldRecalculateTouringEstimates("partial"), false);
  assert.equal(shouldRecalculateTouringEstimates("failed"), false);
  assert.equal(shouldRecalculateTouringEstimates("locked"), false);
});

test("binds estimate inputs and provenance to the exact complete shadow run", async () => {
  const calls: Array<{ sql: string; params: unknown[] | undefined }> = [];
  const client = {
    async query(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      if (sql.includes("FROM ticketmaster_touring_shadow_runs")) return { rows: [{ id: 7 }] };
      return { rows: [snapshot({ id: 99, run_id: 7, event_id: "only-run-seven" })] };
    },
  };
  const rows = await loadCompleteShadowRunSnapshots(
    client as Parameters<typeof loadCompleteShadowRunSnapshots>[0],
    7,
    new Date("2026-08-21T12:00:00Z"),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].run_id, 7);
  assert.match(calls[0].sql, /status='complete'/);
  assert.match(calls[1].sql, /WHERE run_id=\$1/);
  assert.deepEqual(calls[1].params, [7, "2026-08-21"]);
});

test("rejects a non-complete shadow run before reading snapshots", async () => {
  let calls = 0;
  const client = {
    async query() {
      calls += 1;
      return { rows: [] };
    },
  };
  await assert.rejects(
    () => loadCompleteShadowRunSnapshots(
      client as Parameters<typeof loadCompleteShadowRunSnapshots>[0],
      8,
      new Date("2026-08-21T12:00:00Z"),
    ),
    /not complete/,
  );
  assert.equal(calls, 1);
});

test("keeps estimation endpoints private and accepts only header admin authentication", () => {
  const original = process.env.NEWSLETTER_ADMIN_KEY;
  process.env.NEWSLETTER_ADMIN_KEY = "estimation-test-key";
  try {
    assert.ok(ESTIMATION_LAB_ADMIN_ROUTE_PATHS.every(path => path.startsWith("/admin/")));
    assert.ok(ESTIMATION_LAB_ADMIN_ROUTE_PATHS.every(path => !PUBLIC_TOURING_ROUTE_PATHS.includes(path as never)));
    assert.equal(isShadowAdminHeaderAuthorized({ "x-admin-key": "estimation-test-key" }), true);
    assert.equal(isShadowAdminHeaderAuthorized({}), false);
    assert.equal(isShadowAdminHeaderAuthorized({ "x-admin-key": ["estimation-test-key"] }), false);
  } finally {
    if (original === undefined) delete process.env.NEWSLETTER_ADMIN_KEY;
    else process.env.NEWSLETTER_ADMIN_KEY = original;
  }
});