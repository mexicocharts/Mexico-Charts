import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.TOURING_API_BASE_URL ?? "http://127.0.0.1:80";
const adminKey = process.env.NEWSLETTER_ADMIN_KEY;
const seedEventId = "140064E7A6C847E4";

type JsonRecord = Record<string, any>;

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json() as JsonRecord;
  return { response, body };
}

function adminHeaders() {
  return {
    "X-Admin-Key": adminKey ?? "",
    "Content-Type": "application/json",
  };
}

test("admin Touring Lab history, evidence actions, alerts, audit, and auth boundaries", {
  skip: !adminKey ? "NEWSLETTER_ADMIN_KEY is required for the authenticated API integration test" : false,
}, async () => {
  const unauthenticatedPaths = [
    "/api/admin/touring/estimates",
    "/api/admin/touring/estimates/alerts",
    `/api/admin/touring/estimates/${seedEventId}/history`,
    `/api/admin/touring/estimates/${seedEventId}/evidence`,
    "/api/admin/touring/estimates/recalculate",
  ];
  for (const path of unauthenticatedPaths) {
    const { response } = await request(path, { method: path.endsWith("/evidence") ? "PUT" : path.endsWith("recalculate") ? "POST" : "GET" });
    assert.equal(response.status, 403, `unauthenticated ${path} must remain forbidden`);
  }

  const reportResult = await request("/api/admin/touring/estimates", { headers: adminHeaders() });
  assert.equal(reportResult.response.status, 200);
  const event = reportResult.body.events.find((row: JsonRecord) => row.event_id === seedEventId);
  assert.ok(event, "the approved Natanael seed must be available to the admin report");

  const historyBeforeResult = await request(`/api/admin/touring/estimates/${seedEventId}/history`, { headers: adminHeaders() });
  assert.equal(historyBeforeResult.response.status, 200);
  assert.ok(historyBeforeResult.body.history.length > 0, "authorized history read must return versioned estimates");
  const auditBefore = historyBeforeResult.body.audit.length;

  const alertsBeforeResult = await request("/api/admin/touring/estimates/alerts", { headers: adminHeaders() });
  assert.equal(alertsBeforeResult.response.status, 200);
  const alertsBefore = alertsBeforeResult.body.alerts.length;

  const evidence = JSON.parse(event.calculation_fingerprint).evidence as JsonRecord;
  const original = {
    tickets: Number(event.estimated_tickets_sold),
    gross: Number(event.estimated_gross_usd),
    average: Number(event.estimated_average_ticket_usd),
    confidence: Number(event.confidence_percent),
    notes: evidence.notes ?? null,
  };
  const evidencePayload = {
    eventId: seedEventId,
    artistId: evidence.artist_id,
    artistName: evidence.artist_name,
    tourName: evidence.tour_name,
    eventDate: evidence.event_date,
    venueName: evidence.venue_name,
    venueCity: evidence.venue_city,
    configuredCapacity: evidence.configured_capacity,
    capacitySource: evidence.capacity_source,
    standardPriceMin: evidence.standard_price_min,
    standardPriceMax: evidence.standard_price_max,
    standardPriceCurrency: evidence.standard_price_currency,
    fxRateMxnPerUsd: evidence.fx_rate_mxn_per_usd,
    fxRateDate: evidence.fx_rate_date,
    offerBreakdown: evidence.offer_breakdown,
    demandSignal: evidence.demand_signal,
    comparableKey: evidence.comparable_key,
    sourceQuality: evidence.source_quality,
    evidenceTimestamp: evidence.evidence_timestamp,
    updatedBy: "touring-lab-integration-test",
    overrideTicketsSold: original.tickets,
    overrideGrossUsd: original.gross,
    overrideAverageTicketUsd: original.average,
    overrideConfidencePercent: original.confidence,
    notes: `${original.notes ?? ""} Integration audit coverage.`,
  };

  const auditUpdate = await request(`/api/admin/touring/estimates/${seedEventId}/evidence`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify(evidencePayload),
  });
  assert.equal(auditUpdate.response.status, 200);
  assert.equal(auditUpdate.body.audit.action, "update");

  const changedEvidence = { ...evidencePayload, overrideTicketsSold: original.tickets + 1500, overrideGrossUsd: original.gross + 50000 };
  const changedUpdate = await request(`/api/admin/touring/estimates/${seedEventId}/evidence`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify(changedEvidence),
  });
  assert.equal(changedUpdate.response.status, 200);

  const recalculate = async () => request("/api/admin/touring/estimates/recalculate", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({}),
  });
  assert.equal((await recalculate()).response.status, 200, "authorized recalculation action must succeed");

  const alertsAfterChangeResult = await request("/api/admin/touring/estimates/alerts", { headers: adminHeaders() });
  assert.equal(alertsAfterChangeResult.response.status, 200);
  assert.ok(alertsAfterChangeResult.body.alerts.length > alertsBefore, "a material estimate change must create an alert");
  const alertsAfterFirstChange = alertsAfterChangeResult.body.alerts.length;

  assert.equal((await recalculate()).response.status, 200, "repeating the same authorized action must remain safe");
  const alertsAfterRepeatResult = await request("/api/admin/touring/estimates/alerts", { headers: adminHeaders() });
  assert.equal(alertsAfterRepeatResult.body.alerts.length, alertsAfterFirstChange, "repeating an unchanged estimate must not duplicate its alert");

  const restore = await request(`/api/admin/touring/estimates/${seedEventId}/evidence`, {
    method: "PUT",
    headers: adminHeaders(),
    body: JSON.stringify({ ...evidencePayload, overrideTicketsSold: original.tickets, overrideGrossUsd: original.gross, notes: original.notes }),
  });
  assert.equal(restore.response.status, 200);
  assert.equal((await recalculate()).response.status, 200, "restoring the approved estimate must succeed");

  const finalReport = await request("/api/admin/touring/estimates", { headers: adminHeaders() });
  const finalEvent = finalReport.body.events.find((row: JsonRecord) => row.event_id === seedEventId);
  assert.equal(Number(finalEvent.estimated_tickets_sold), original.tickets);
  assert.equal(Number(finalEvent.estimated_gross_usd), original.gross);
  assert.equal(Number(finalEvent.estimated_average_ticket_usd), original.average);
  assert.equal(Number(finalEvent.confidence_percent), original.confidence);

  const finalHistory = await request(`/api/admin/touring/estimates/${seedEventId}/history`, { headers: adminHeaders() });
  assert.ok(finalHistory.body.history.length > historyBeforeResult.body.history.length, "authorized actions must persist estimate history");
  assert.ok(finalHistory.body.audit.length >= auditBefore + 3, "authorized evidence changes must persist audit records");
});