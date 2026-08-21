import assert from "node:assert/strict";
import test from "node:test";
import {
  cadenceHoursForDaysUntil,
  classifyTicketmasterEvent,
  inventorySafetyFields,
  isWithinTicketmasterTourScope,
  normalizeTicketmasterEvent,
} from "./ticketmaster-touring-shadow-scheduler";

test("classifies Ticketmaster add-ons without treating them as concerts", () => {
  assert.equal(classifyTicketmasterEvent("Fuerza Regida - This Is Our Dream", "Arena"), "concert");
  assert.equal(classifyTicketmasterEvent("This Is Our Dream Parking Pass", "Arena"), "add_on");
  assert.equal(classifyTicketmasterEvent("VIP Lounge Access", "Arena"), "add_on");
  assert.equal(classifyTicketmasterEvent("Fast Lane", "Stadium"), "add_on");
  assert.equal(classifyTicketmasterEvent("Suite 204", "Arena"), "add_on");
});

test("uses 2, 6, and 24 hour proximity tiers at the requested boundaries", () => {
  assert.equal(cadenceHoursForDaysUntil(0), 2);
  assert.equal(cadenceHoursForDaysUntil(7), 2);
  assert.equal(cadenceHoursForDaysUntil(8), 6);
  assert.equal(cadenceHoursForDaysUntil(30), 6);
  assert.equal(cadenceHoursForDaysUntil(31), 24);
  assert.equal(cadenceHoursForDaysUntil(null), 24);
});

test("limits the tracked catalog to the requested 2026 scopes", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");
  assert.equal(
    isWithinTicketmasterTourScope(
      "fuerza-regida",
      "Fuerza Regida - This Is Our Dream Tour",
      "2026-09-20",
      now,
    ),
    true,
  );
  assert.equal(
    isWithinTicketmasterTourScope(
      "fuerza-regida",
      "Fuerza Regida Festival Appearance",
      "2026-09-20",
      now,
    ),
    false,
  );
  assert.equal(
    isWithinTicketmasterTourScope("carin-leon", "Carín León", "2026-09-20", now),
    true,
  );
  assert.equal(
    isWithinTicketmasterTourScope("carin-leon", "Carín León", "2025-09-20", now),
    false,
  );
});

test("normalizes public fields and keeps all inventory estimates null", () => {
  const event = normalizeTicketmasterEvent({
    id: "tm-1",
    name: "Carín León",
    url: "https://www.ticketmaster.com/event/tm-1",
    dates: {
      start: { localDate: "2026-09-20", localTime: "20:00:00" },
      status: { code: "onsale" },
    },
    sales: {
      public: {
        startDateTime: "2026-08-01T16:00:00Z",
        endDateTime: "2026-09-20T20:00:00Z",
      },
    },
    priceRanges: [{ min: 50, max: 125, currency: "USD" }],
    seatmap: { staticUrl: "https://www.ticketmaster.com/seatmap/tm-1" },
    ticketLimit: { info: "8 tickets per household" },
    promoter: { id: "promoter-1", name: "Promoter" },
    _embedded: {
      venues: [{
        name: "Arena",
        city: { name: "Austin" },
        country: { countryCode: "US" },
      }],
    },
  });

  assert.equal(event?.eventClassification, "concert");
  assert.equal(event?.priceMin, 50);
  assert.equal(event?.ticketLimit, "8 tickets per household");
  assert.deepEqual(inventorySafetyFields(), {
    ticketsSold: null,
    remainingInventory: null,
    sellThroughPercent: null,
    capacity: null,
    grossAmount: null,
    inventoryDataConfidence: "insufficient-inventory-data",
  });
});