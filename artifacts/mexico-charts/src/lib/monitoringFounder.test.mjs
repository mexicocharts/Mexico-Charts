import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCompleteMonitoringAudit,
  monitoringSourceSummary,
  validateMonitoringDirectory,
} from "./monitoringFounder.mjs";
import { MonitoringDashboardHttpError } from "./monitoringAccess.mjs";

function candidate(artistKey, classification = "A") {
  return {
    artistKey,
    artistName: artistKey,
    classification,
    publicEligible: classification === "A",
    auditStatus: classification == null ? "incomplete" : "complete",
    findings: [],
    readinessReasons: [],
    sourceKeys: [artistKey],
    candidateSources: ["kworb_coverage"],
    sourceEvidence: {},
  };
}
function page(artists, offset, total, overrides = {}) {
  const counts = { A: 0, B: 0, C: 0, incomplete: 0 };
  artists.forEach((artist) => counts[artist.classification ?? "incomplete"]++);
  return {
    artists,
    total,
    offset,
    limit: 2,
    hasMore: offset + artists.length < total,
    counts,
    policyVersion: 2,
    contractVersion: "complete_v1",
    auditedAt: "2026-09-05T00:00:00Z",
    populationComplete: true,
    missingSchemaTables: [],
    ...overrides,
  };
}

test("export keeps every server classification, including incomplete audits, across pages", async () => {
  const pages = [
    page([candidate("a", "A"), candidate("b", "B")], 0, 4),
    page([candidate("c", "C"), candidate("d", null)], 2, 4),
  ];
  const requested = [];
  const progress = [];
  const audit = await loadCompleteMonitoringAudit(
    async (offset) => {
      requested.push(offset);
      return pages[offset / 2];
    },
    { onProgress: (...values) => progress.push(values) },
  );
  assert.deepEqual(requested, [0, 2]);
  assert.deepEqual(progress, [
    [2, 4],
    [4, 4],
  ]);
  assert.deepEqual(audit.counts, { A: 1, B: 1, C: 1, incomplete: 1 });
  assert.equal(audit.artists[3].classification, null);
  assert.equal(audit.auditScope, "all_candidates");
  assert.equal(audit.auditComplete, false);
  assert.equal(audit.incompleteAuditCount, 1);
});

test("a conclusive C preserves incomplete checks without declaring the export complete", async () => {
  const blocked = {
    ...candidate("blocked", "C"),
    auditStatus: "incomplete",
    readinessReasons: [
      "missing_licensed_history",
      "full_stream_catalog_unverified",
    ],
    findings: [
      { code: "missing_licensed_history", status: "blocked" },
      {
        code: "full_stream_catalog_unverified",
        status: "investigation_required",
      },
    ],
  };
  const audit = await loadCompleteMonitoringAudit(async () =>
    page([blocked], 0, 1),
  );
  assert.equal(audit.artists[0].classification, "C");
  assert.equal(audit.artists[0].auditStatus, "incomplete");
  assert.deepEqual(audit.counts, { A: 0, B: 0, C: 1, incomplete: 0 });
  assert.equal(audit.auditComplete, false);
  assert.equal(audit.incompleteAuditCount, 1);

  for (const bad of [
    { ...candidate("a", "A"), auditStatus: "incomplete" },
    { ...candidate("b", "B"), auditStatus: "incomplete" },
    { ...blocked, findings: [] },
    { ...blocked, identityConflict: true },
    { ...blocked, readinessReasons: ["source_schema_unavailable"] },
    { ...blocked, readinessReasons: ["conflicting_provider_identity"] },
  ]) {
    assert.throws(
      () => validateMonitoringDirectory(page([bad], 0, 1)),
      (error) => error.status === 502,
    );
  }
});

test("an unavailable population source stays explicit in the exported audit", async () => {
  const audit = await loadCompleteMonitoringAudit(async () =>
    page([candidate("a", null)], 0, 1, {
      populationComplete: false,
      missingSchemaTables: ["history_source"],
    }),
  );
  assert.equal(audit.populationComplete, false);
  assert.equal(audit.auditScope, "all_discovered_candidates");
  assert.deepEqual(audit.missingSchemaTables, ["history_source"]);
  assert.equal(audit.counts.C, 0);
  assert.equal(audit.counts.incomplete, 1);
  assert.equal(audit.auditComplete, false);
});

test("a failed page rejects the export instead of classifying unseen artists", async () => {
  let calls = 0;
  await assert.rejects(
    loadCompleteMonitoringAudit(async () => {
      if (calls++ === 0) return page([candidate("a")], 0, 2);
      throw new MonitoringDashboardHttpError(503, "Unavailable");
    }),
    (error) => error.status === 503,
  );
  assert.equal(calls, 2);
});

test("identity cancellation after a page response prevents progress and further private reads", async () => {
  const controller = new AbortController();
  let calls = 0;
  const progress = [];
  await assert.rejects(
    loadCompleteMonitoringAudit(
      async () => {
        calls++;
        controller.abort();
        return page([candidate("a")], 0, 2);
      },
      {
        signal: controller.signal,
        onProgress: (value) => progress.push(value),
      },
    ),
    (error) => error.name === "AbortError",
  );
  assert.equal(calls, 1);
  assert.deepEqual(progress, []);
});

test("changing policy, total, or page identity cannot produce a complete export", async () => {
  for (const second of [
    page([candidate("b")], 1, 2, { contractVersion: "new_contract" }),
    page([candidate("b")], 1, 3),
    page([candidate("a")], 1, 2),
    page([candidate("b")], 0, 2),
  ]) {
    let calls = 0;
    await assert.rejects(
      loadCompleteMonitoringAudit(async () =>
        calls++ === 0 ? page([candidate("a")], 0, 2) : second,
      ),
    );
  }
});

test("malformed counts or classification are errors, never an inferred C", () => {
  const valid = page([candidate("a", null)], 0, 1);
  assert.equal(
    validateMonitoringDirectory(valid).artists[0].classification,
    null,
  );
  for (const bad of [
    {},
    { ...valid, counts: { A: 0, B: 0, C: 1, incomplete: 0 } },
    { ...valid, artists: [{ ...valid.artists[0], classification: "unknown" }] },
    { ...valid, artists: [{ ...valid.artists[0], publicEligible: true }] },
  ]) {
    assert.throws(
      () => validateMonitoringDirectory(bad),
      (error) => error.status === 502,
    );
  }
});

test("source coverage distinguishes unverified evidence from a measured zero", () => {
  const missing = monitoringSourceSummary({});
  assert.equal(missing[0][1], "Sin verificar");
  const measured = monitoringSourceSummary({
    currentHistory: { days: 0 },
    compactHistory: { points: 22 },
  });
  assert.equal(measured[0][1], "0 días");
  assert.equal(measured[1][1], "22 observaciones");
});
