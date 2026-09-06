import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCompleteMonitoringAudit,
  monitoringPopulationSummary,
  monitoringPopulationLimitations,
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

function scopedPage(artists, offset, total, overrides = {}) {
  return page(artists, offset, total, {
    populationComplete: false,
    databasePopulationComplete: true,
    populationScope: "database_and_bundled_rosters",
    populationLimitations: [
      "external_artist_metadata_active_uninspected",
      "external_mexican_artist_master_uninspected",
    ],
    bundledSourceInventory: [
      {
        source: "artist_profile_routes",
        rowCount: 563,
        sourcePaths: ["scripts/artist-profile-routes.mjs"],
        freshness: "bundled_source_revision",
      },
      {
        source: "supplemental_artist_data",
        rowCount: 39,
        sourcePaths: ["src/lib/supplemental-artist-data.ts"],
        freshness: "bundled_source_revision",
      },
    ],
    ...overrides,
  });
}

test("a complete database scan preserves global unknown roster scope without changing artist decisions", async () => {
  const first = scopedPage([candidate("a")], 0, 2);
  const second = scopedPage([candidate("b", "B")], 1, 2);
  // Source ordering and object-key insertion order are not semantic changes.
  second.populationLimitations.reverse();
  second.bundledSourceInventory = second.bundledSourceInventory
    .reverse()
    .map((source) => ({
      freshness: source.freshness,
      sourcePaths: source.sourcePaths,
      rowCount: source.rowCount,
      source: source.source,
    }));
  const audit = await loadCompleteMonitoringAudit(async (offset) =>
    offset === 0 ? first : second,
  );
  assert.equal(audit.databasePopulationComplete, true);
  assert.equal(audit.populationComplete, false);
  assert.equal(audit.auditComplete, false);
  assert.equal(audit.incompleteAuditCount, 0);
  assert.equal(audit.auditScope, "all_discovered_candidates");
  assert.deepEqual(
    audit.artists.map((artist) => [artist.classification, artist.auditStatus]),
    [
      ["A", "complete"],
      ["B", "complete"],
    ],
  );
  assert.deepEqual(audit.populationLimitations, first.populationLimitations);
  assert.deepEqual(audit.bundledSourceInventory, first.bundledSourceInventory);
  assert.equal(audit.populationScope, first.populationScope);
  assert.match(monitoringPopulationSummary(first), /base de datos consultadas/);
  assert.match(
    monitoringPopulationSummary(first),
    /hojas externas sigue sin verificarse/,
  );
  assert.equal(monitoringPopulationLimitations(first).length, 2);
  assert.ok(
    monitoringPopulationLimitations(first).every((text) =>
      text.includes("en esta consulta"),
    ),
  );
});

test("malformed or contradictory population scope cannot claim complete coverage", () => {
  const valid = scopedPage([candidate("a")], 0, 1);
  for (const overrides of [
    { databasePopulationComplete: "true" },
    { databasePopulationComplete: undefined },
    { populationScope: undefined },
    { populationScope: "all_sources" },
    { populationLimitations: undefined },
    { populationLimitations: ["unrecognized_source"] },
    {
      populationLimitations: [
        valid.populationLimitations[0],
        valid.populationLimitations[0],
      ],
    },
    { bundledSourceInventory: undefined },
    { bundledSourceInventory: [null] },
    {
      bundledSourceInventory: [
        valid.bundledSourceInventory[0],
        valid.bundledSourceInventory[0],
      ],
    },
    {
      bundledSourceInventory: [
        { ...valid.bundledSourceInventory[0], rowCount: -1 },
      ],
    },
    {
      bundledSourceInventory: [
        { ...valid.bundledSourceInventory[0], rowCount: "563" },
      ],
    },
    {
      bundledSourceInventory: [
        { ...valid.bundledSourceInventory[0], sourcePaths: [] },
      ],
    },
    {
      bundledSourceInventory: [
        { ...valid.bundledSourceInventory[0], freshness: "live" },
      ],
    },
    { missingSchemaTables: ["missing_source"] },
    { populationComplete: true },
    {
      populationComplete: true,
      databasePopulationComplete: false,
      populationLimitations: [],
    },
  ]) {
    assert.throws(
      () => validateMonitoringDirectory({ ...valid, ...overrides }),
      (error) => error.status === 502,
    );
  }
  const legacy = page([candidate("a")], 0, 1);
  assert.equal(validateMonitoringDirectory(legacy), legacy);
});

test("export rejects changing roster scope but retains an observed database coverage failure", async () => {
  const first = scopedPage([candidate("a")], 0, 2);
  for (const second of [
    page([candidate("b")], 1, 2),
    scopedPage([candidate("b")], 1, 2, { populationLimitations: [] }),
    scopedPage([candidate("b")], 1, 2, {
      bundledSourceInventory: [
        { ...first.bundledSourceInventory[0], rowCount: 564 },
        first.bundledSourceInventory[1],
      ],
    }),
    scopedPage([candidate("b")], 1, 2, {
      bundledSourceInventory: [
        { ...first.bundledSourceInventory[0], sourcePaths: ["new-roster.mjs"] },
        first.bundledSourceInventory[1],
      ],
    }),
  ]) {
    await assert.rejects(
      loadCompleteMonitoringAudit(async (offset) =>
        offset === 0 ? first : second,
      ),
      /cambió durante la exportación/,
    );
  }
  const unavailable = scopedPage([candidate("b", null)], 1, 2, {
    databasePopulationComplete: false,
    missingSchemaTables: ["history_source"],
  });
  const audit = await loadCompleteMonitoringAudit(async (offset) =>
    offset === 0 ? first : unavailable,
  );
  assert.equal(audit.databasePopulationComplete, false);
  assert.equal(audit.auditComplete, false);
  assert.deepEqual(audit.missingSchemaTables, ["history_source"]);
  assert.match(
    monitoringPopulationSummary(unavailable),
    /faltan fuentes de la base de datos/,
  );
});

function nativeInspection() {
  const approved = {
    scope: "approved",
    eligibleVideos: 3,
    videosWithAnySamples: 3,
    videosWithTrustedSamples: 2,
    videosWithoutTrustedSamples: 1,
    videosWithOneDate: 1,
    videosWithMultipleDates: 1,
    videosWithAllRequestedDates: 0,
    renderableVideosWithMultipleDates: 1,
    unrenderableVideos: 0,
    rawObservationCount: 6,
    selectedPointCount: 3,
    missingVideoDates: 267,
    invalidSelectedPointCount: 0,
    missingTrackedVideos: 1,
    minimumObservedDates: 0,
    maximumObservedDates: 2,
    firstObservedAt: "2026-09-01T08:00:00.123456Z",
    lastObservedAt: "2026-09-02T08:00:00.654321Z",
  };
  return {
    status: "complete",
    reason: "native_archive_inspection_complete",
    approvedOutcome: "present_partial",
    proof: {
      inspected: true,
      inspectionVersion: "monitoring_youtube_native_history_inspection_v1",
      allTimeCoverageInspected: false,
      captureClock: "2026-09-06T08:51:36.871908Z",
      startDate: "2026-06-09",
      endDate: "2026-09-06",
      startsAt: "2026-06-09T04:00:00.000000Z",
      rangeDays: 90,
      timeZone: "America/New_York",
      sourceTable: "youtube_video_intraday_shadow_snapshots",
      trustedSourceType: "youtube_api_shadow",
      kind: "native_intraday_cumulative",
      selection: "last_observation_per_et_date",
      substitutesForApprovedDailySnapshots: false,
      sourceKeys: ["synthetic-key", "Synthetic Key"],
      buckets: [
        approved,
        {
          ...approved,
          scope: "candidate_only",
          eligibleVideos: 2,
          videosWithAnySamples: 1,
          videosWithTrustedSamples: 1,
          videosWithOneDate: 0,
          renderableVideosWithMultipleDates: 0,
          unrenderableVideos: 1,
          rawObservationCount: 2,
          selectedPointCount: 2,
          missingVideoDates: 178,
          invalidSelectedPointCount: 1,
        },
      ],
    },
  };
}

test("validated native archive remains separate from approved daily coverage and preserves scoped provenance", async () => {
  const inspection = nativeInspection();
  const evidence = {
    youtubeHistory: { days: 0, points: 0 },
    youtubeNativeHistoryInspection: inspection,
  };
  const summary = new Map(monitoringSourceSummary(evidence));
  assert.equal(
    summary.get("Historial YouTube aprobado · diario"),
    "0 días · 0 observaciones",
  );
  assert.match(
    summary.get("Archivo nativo YouTube · acumulativo"),
    /no sustituyen snapshots diarios ni demuestran elegibilidad/,
  );
  const approved = summary.get("Archivo acumulativo · aprobados");
  assert.match(approved, /1 \/ 3 videos con al menos 2 fechas; 1 graficables/);
  assert.match(
    approved,
    /1 con una fecha; 1 sin lecturas confiables en el rango/,
  );
  assert.match(approved, /1 sin registro en el catálogo rastreado/);
  assert.match(
    approved,
    /3 puntos seleccionados de 6 lecturas; 267 fechas por video sin muestra/,
  );
  assert.match(approved, /2026-09-01T08:00:00.123456Z/);
  const candidateSummary = summary.get("Archivo acumulativo · candidatos");
  assert.match(
    candidateSummary,
    /1 \/ 2 videos con al menos 2 fechas; 0 graficables/,
  );
  assert.match(candidateSummary, /1 con lecturas inválidas \(1 puntos\)/);
  assert.match(candidateSummary, /Solo inspección interna; no aprobación/);
  const provenance = summary.get("Archivo acumulativo · procedencia");
  for (const exact of [
    "youtube_video_intraday_shadow_snapshots",
    "youtube_api_shadow",
    "America/New_York",
    "2026-06-09",
    "2026-09-06T08:51:36.871908Z",
    "synthetic-key, Synthetic Key",
  ])
    assert.ok(provenance.includes(exact));
  assert.match(provenance, /No es cobertura de todo el historial/);
  // Summarizing validated inspection evidence cannot promote an artist's decision.
  const artist = { ...candidate("a", null), sourceEvidence: evidence };
  const audit = await loadCompleteMonitoringAudit(async () =>
    page([artist], 0, 1),
  );
  assert.equal(audit.artists[0].classification, null);
  assert.equal(audit.artists[0].publicEligible, false);
  assert.deepEqual(audit.artists[0].sourceEvidence, evidence);
});

test("completed native zero observations and no selected relationships do not become all-time absence", () => {
  const inspection = nativeInspection();
  inspection.approvedOutcome = "absent_in_range";
  const empty = inspection.proof.buckets[0];
  for (const key of Object.keys(empty))
    if (typeof empty[key] === "number") empty[key] = 0;
  Object.assign(empty, {
    eligibleVideos: 2,
    videosWithoutTrustedSamples: 2,
    missingVideoDates: 180,
    firstObservedAt: null,
    lastObservedAt: null,
  });
  const summary = new Map(
    monitoringSourceSummary({ youtubeNativeHistoryInspection: inspection }),
  );
  assert.match(summary.get("Archivo acumulativo · aprobados"), /0 \/ 2 videos/);
  assert.match(
    summary.get("Archivo acumulativo · aprobados"),
    /2 sin lecturas confiables en el rango/,
  );
  assert.match(
    summary.get("Archivo acumulativo · aprobados"),
    /0 puntos seleccionados de 0 lecturas/,
  );
  const noRelations = structuredClone(inspection);
  noRelations.approvedOutcome = "no_approved_relationships";
  Object.assign(noRelations.proof.buckets[0], {
    eligibleVideos: 0,
    videosWithoutTrustedSamples: 0,
    missingVideoDates: 0,
    minimumObservedDates: null,
    maximumObservedDates: null,
  });
  assert.match(
    new Map(
      monitoringSourceSummary({ youtubeNativeHistoryInspection: noRelations }),
    ).get("Archivo acumulativo · aprobados"),
    /Sin relaciones seleccionadas.*no demuestra ausencia fuera/,
  );
});

test("uninspected, unavailable, invalid or inconsistent archive proof never appears as measured zero", () => {
  for (const status of ["uninspected", "unavailable", "invalid"]) {
    const summary = new Map(
      monitoringSourceSummary({
        youtubeNativeHistoryInspection: {
          ...nativeInspection(),
          status,
          reason: "retained_reason",
        },
      }),
    );
    assert.equal(summary.has("Archivo acumulativo · aprobados"), false);
    assert.match(
      summary.get("Archivo nativo YouTube · acumulativo"),
      /retained_reason/,
    );
    assert.match(
      summary.get("Archivo nativo YouTube · acumulativo"),
      /No se infiere ausencia/,
    );
  }
  const rawOnly = new Map(
    monitoringSourceSummary({
      youtubeServing: { nativeIntradayHistory: nativeInspection().proof },
    }),
  );
  assert.match(
    rawOnly.get("Archivo nativo YouTube · acumulativo"),
    /Sin verificar/,
  );
  for (const change of [
    (i) => (i.proof.buckets[0].eligibleVideos = "3"),
    (i) => (i.proof.buckets[0].videosWithoutTrustedSamples = 0),
    (i) => (i.proof.buckets[0].missingVideoDates = 0),
    (i) => (i.proof.buckets[0].invalidSelectedPointCount = NaN),
    (i) => (i.proof.buckets[0].firstObservedAt = "2026-02-31T00:00:00Z"),
    (i) => (i.proof.buckets[1].scope = "approved"),
    (i) => (i.proof.trustedSourceType = "unapproved_source"),
    (i) => (i.proof.allTimeCoverageInspected = true),
    (i) => (i.proof.substitutesForApprovedDailySnapshots = true),
    (i) => (i.proof.inspected = false),
    (i) => (i.proof.sourceKeys = []),
  ]) {
    const malformed = nativeInspection();
    change(malformed);
    const summary = new Map(
      monitoringSourceSummary({ youtubeNativeHistoryInspection: malformed }),
    );
    assert.equal(summary.has("Archivo acumulativo · aprobados"), false);
    assert.match(
      summary.get("Archivo nativo YouTube · acumulativo"),
      /Evidencia de inspección inválida/,
    );
  }
});
