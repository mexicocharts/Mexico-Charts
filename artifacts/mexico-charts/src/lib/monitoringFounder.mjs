import { MonitoringDashboardHttpError } from "./monitoringAccess.mjs";

const incompleteDirectory = () =>
  new MonitoringDashboardHttpError(
    502,
    "La respuesta del directorio está incompleta. La clasificación no está confirmada.",
  );

const populationLimitationLabels = {
  external_artist_metadata_active_uninspected:
    "Cobertura actual de Artist Metadata Active sin verificar en esta consulta.",
  external_mexican_artist_master_uninspected:
    "Cobertura actual de Mexican Artist Master sin verificar en esta consulta.",
};
const populationFields = [
  "databasePopulationComplete",
  "populationScope",
  "populationLimitations",
  "bundledSourceInventory",
];
const stringList = (value) =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string" && item.trim()) &&
  new Set(value).size === value.length;

function validatePopulationScope(data) {
  // Legacy responses omit the entire scope extension. A partial extension must
  // not silently discard unknown coverage or mislabel a database scan as global.
  if (!populationFields.some((field) => data[field] !== undefined)) return;
  if (
    typeof data.databasePopulationComplete !== "boolean" ||
    data.populationScope !== "database_and_bundled_rosters" ||
    !stringList(data.populationLimitations) ||
    !data.populationLimitations.every((reason) =>
      Object.hasOwn(populationLimitationLabels, reason),
    ) ||
    !Array.isArray(data.bundledSourceInventory) ||
    data.bundledSourceInventory.some(
      (source) =>
        !source ||
        !["artist_profile_routes", "supplemental_artist_data"].includes(
          source.source,
        ) ||
        !Number.isSafeInteger(source.rowCount) ||
        source.rowCount < 0 ||
        !stringList(source.sourcePaths) ||
        source.sourcePaths.length === 0 ||
        source.freshness !== "bundled_source_revision",
    ) ||
    new Set(data.bundledSourceInventory.map((source) => source.source)).size !==
      data.bundledSourceInventory.length ||
    (data.databasePopulationComplete && data.missingSchemaTables.length > 0) ||
    (data.populationComplete &&
      (!data.databasePopulationComplete ||
        data.populationLimitations.length > 0))
  )
    throw incompleteDirectory();
}

function populationScopeIdentity(data) {
  if (data.populationScope === undefined) return null;
  return JSON.stringify({
    scope: data.populationScope,
    limitations: [...data.populationLimitations].sort(),
    sources: data.bundledSourceInventory
      .map(({ source, rowCount, sourcePaths, freshness }) => ({
        source,
        rowCount,
        sourcePaths: [...sourcePaths].sort(),
        freshness,
      }))
      .sort((a, b) => a.source.localeCompare(b.source)),
  });
}

export function validateMonitoringDirectory(data) {
  if (
    !data ||
    !Array.isArray(data.artists) ||
    !Number.isInteger(data.total) ||
    data.total < 0 ||
    !Number.isInteger(data.offset) ||
    data.offset < 0 ||
    !Number.isInteger(data.limit) ||
    data.limit < 1 ||
    typeof data.hasMore !== "boolean" ||
    !data.counts ||
    !data.auditedAt ||
    typeof data.populationComplete !== "boolean" ||
    !stringList(data.missingSchemaTables) ||
    data.policyVersion == null ||
    data.contractVersion == null
  )
    throw incompleteDirectory();
  validatePopulationScope(data);
  const counts = { A: 0, B: 0, C: 0, incomplete: 0 };
  for (const artist of data.artists) {
    if (
      !artist ||
      typeof artist.artistKey !== "string" ||
      !artist.artistKey.trim() ||
      typeof artist.artistName !== "string" ||
      !["A", "B", "C", null].includes(artist.classification) ||
      artist.publicEligible !== (artist.classification === "A") ||
      !["complete", "incomplete"].includes(artist.auditStatus) ||
      !Array.isArray(artist.findings) ||
      !Array.isArray(artist.readinessReasons) ||
      !Array.isArray(artist.sourceKeys) ||
      !artist.sourceKeys.every(
        (key) => typeof key === "string" && key.trim(),
      ) ||
      !Array.isArray(artist.candidateSources) ||
      !artist.sourceEvidence ||
      typeof artist.sourceEvidence !== "object"
    )
      throw incompleteDirectory();
    const blockedWithUnknownChecks =
      artist.classification === "C" &&
      artist.auditStatus === "incomplete" &&
      artist.findings.some((finding) => finding.status === "blocked") &&
      !artist.identityConflict &&
      !artist.readinessReasons.some((reason) =>
        ["source_schema_unavailable", "conflicting_provider_identity"].includes(
          reason,
        ),
      );
    if (
      artist.classification == null
        ? artist.auditStatus !== "incomplete"
        : artist.auditStatus !== "complete" && !blockedWithUnknownChecks
    )
      throw incompleteDirectory();
    counts[artist.classification ?? "incomplete"]++;
  }
  if (
    Object.keys(counts).some((key) => counts[key] !== data.counts[key]) ||
    new Set(data.artists.map((artist) => artist.artistKey)).size !==
      data.artists.length ||
    data.artists.length > data.limit ||
    data.offset + data.artists.length > data.total ||
    data.hasMore !== data.offset + data.artists.length < data.total
  )
    throw incompleteDirectory();
  return data;
}

function assertActive(signal) {
  if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
}

/** Page the authorized audit without turning failed reads into classifications. */
export async function loadCompleteMonitoringAudit(
  loadPage,
  { signal, onProgress = () => {} } = {},
) {
  const artists = [];
  const pageAuditedAt = [];
  const missingSchemaTables = new Set();
  let populationComplete = true;
  let databasePopulationComplete = true;
  let first;
  let next = 0;
  while (true) {
    assertActive(signal);
    const page = validateMonitoringDirectory(await loadPage(next, signal));
    assertActive(signal);
    first ??= page;
    if (
      page.offset !== next ||
      page.total !== first.total ||
      page.policyVersion !== first.policyVersion ||
      page.contractVersion !== first.contractVersion ||
      populationScopeIdentity(page) !== populationScopeIdentity(first)
    ) {
      throw new Error(
        "El catálogo o su política cambió durante la exportación. Vuelve a intentarlo.",
      );
    }
    if (page.hasMore && page.artists.length === 0)
      throw new Error("El directorio no avanzó; vuelve a intentarlo.");
    artists.push(...page.artists);
    populationComplete &&= page.populationComplete;
    databasePopulationComplete &&= page.databasePopulationComplete === true;
    page.missingSchemaTables.forEach((table) => missingSchemaTables.add(table));
    pageAuditedAt.push(page.auditedAt);
    next += page.artists.length;
    onProgress(next, page.total);
    if (!page.hasMore) break;
  }
  assertActive(signal);
  if (new Set(artists.map((artist) => artist.artistKey)).size !== first.total) {
    throw new Error(
      "El catálogo cambió durante la exportación. Vuelve a intentarlo.",
    );
  }
  const counts = { A: 0, B: 0, C: 0, incomplete: 0 };
  artists.forEach((artist) => {
    counts[artist.classification ?? "incomplete"]++;
  });
  const incompleteAuditCount = artists.filter(
    (artist) => artist.auditStatus !== "complete",
  ).length;
  return {
    policyVersion: first.policyVersion,
    contractVersion: first.contractVersion,
    contract: first.contract,
    auditScope: populationComplete
      ? "all_candidates"
      : "all_discovered_candidates",
    populationComplete,
    ...(first.populationScope === undefined
      ? {}
      : {
          databasePopulationComplete,
          populationScope: first.populationScope,
          populationLimitations: [...first.populationLimitations],
          bundledSourceInventory: first.bundledSourceInventory,
        }),
    auditComplete: populationComplete && incompleteAuditCount === 0,
    incompleteAuditCount,
    missingSchemaTables: [...missingSchemaTables],
    pageAuditedAt,
    total: artists.length,
    counts,
    artists,
  };
}

export function monitoringPopulationSummary(data) {
  if (data.populationComplete)
    return "Inventario completo para las fuentes verificadas.";
  if (data.databasePopulationComplete === true)
    return "Fuentes de la base de datos consultadas y catálogos de esta versión incluidos. La cobertura actual de las hojas externas sigue sin verificarse en esta consulta.";
  if (data.databasePopulationComplete === false)
    return "Inventario parcial: faltan fuentes de la base de datos por verificar. Los candidatos encontrados no confirman la población completa.";
  return "Inventario parcial: faltan fuentes por verificar. Los candidatos encontrados no confirman la población completa.";
}

export function monitoringPopulationLimitations(data) {
  return (data.populationLimitations ?? []).map(
    (reason) => populationLimitationLabels[reason],
  );
}

function nativeYoutubeHistorySummary(inspection) {
  const label = "Archivo nativo YouTube · acumulativo";
  const statuses = {
    uninspected: "Sin inspeccionar",
    unavailable: "Inspección no disponible",
    invalid: "Evidencia de inspección inválida",
  };
  if (!inspection)
    return [
      [label, "Sin verificar en esta auditoría; no se infiere ausencia."],
    ];
  if (Object.hasOwn(statuses, inspection.status))
    return [
      [
        label,
        `${statuses[inspection.status]}${typeof inspection.reason === "string" && inspection.reason ? ` · ${inspection.reason}` : ""}. No se infiere ausencia.`,
      ],
    ];
  const proof = inspection.proof;
  const count = (value) => Number.isSafeInteger(value) && value >= 0;
  const counts = [
    "eligibleVideos",
    "videosWithAnySamples",
    "videosWithTrustedSamples",
    "videosWithoutTrustedSamples",
    "videosWithOneDate",
    "videosWithMultipleDates",
    "videosWithAllRequestedDates",
    "renderableVideosWithMultipleDates",
    "unrenderableVideos",
    "rawObservationCount",
    "selectedPointCount",
    "missingVideoDates",
    "invalidSelectedPointCount",
    "missingTrackedVideos",
    "invalidVideoIds",
  ];
  const date = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  const timestamp = (value) =>
    typeof value === "string" &&
    date(value.slice(0, 10)) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value) &&
    Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 &&
    Number(value.slice(17, 19)) < 60 &&
    Number.isFinite(Date.parse(value));
  const buckets = proof?.buckets;
  const validBuckets =
    Array.isArray(buckets) &&
    buckets.length === 2 &&
    new Set(buckets.map((bucket) => bucket?.scope)).size === 2 &&
    buckets.every(
      (bucket) =>
        bucket &&
        ["approved", "candidate_only"].includes(bucket.scope) &&
        counts.every((key) => count(bucket[key])) &&
        bucket.videosWithAnySamples <= bucket.eligibleVideos &&
        bucket.videosWithTrustedSamples <= bucket.videosWithAnySamples &&
        bucket.videosWithTrustedSamples + bucket.videosWithoutTrustedSamples ===
          bucket.eligibleVideos &&
        bucket.videosWithOneDate + bucket.videosWithMultipleDates ===
          bucket.videosWithTrustedSamples &&
        bucket.renderableVideosWithMultipleDates <=
          bucket.videosWithMultipleDates &&
        bucket.videosWithAllRequestedDates <= bucket.videosWithMultipleDates &&
        bucket.unrenderableVideos <= bucket.videosWithTrustedSamples &&
        bucket.missingTrackedVideos <= bucket.eligibleVideos &&
        bucket.invalidVideoIds <= bucket.eligibleVideos &&
        bucket.rawObservationCount >= bucket.selectedPointCount &&
        bucket.selectedPointCount >= bucket.videosWithTrustedSamples &&
        bucket.invalidSelectedPointCount <= bucket.selectedPointCount &&
        bucket.missingVideoDates ===
          bucket.eligibleVideos * 90 - bucket.selectedPointCount &&
        (bucket.eligibleVideos === 0
          ? bucket.minimumObservedDates === null &&
            bucket.maximumObservedDates === null
          : count(bucket.minimumObservedDates) &&
            count(bucket.maximumObservedDates) &&
            bucket.minimumObservedDates <= bucket.maximumObservedDates &&
            bucket.maximumObservedDates <= 90) &&
        (bucket.videosWithTrustedSamples === 0
          ? bucket.firstObservedAt === null && bucket.lastObservedAt === null
          : timestamp(bucket.firstObservedAt) &&
            timestamp(bucket.lastObservedAt)),
    );
  if (
    inspection.status !== "complete" ||
    ![
      "no_approved_relationships",
      "absent_in_range",
      "present_one_date_only",
      "present_partial",
      "present_all_requested_dates",
      "present_unrenderable",
    ].includes(inspection.approvedOutcome) ||
    !proof ||
    proof.inspected !== true ||
    proof.inspectionVersion !==
      "monitoring_youtube_native_history_inspection_v2" ||
    proof.servingContractVersion !== "monitoring_youtube_native_history_v1" ||
    proof.allTimeCoverageInspected !== false ||
    proof.kind !== "native_intraday_cumulative" ||
    proof.sourceTable !== "youtube_video_intraday_shadow_snapshots" ||
    proof.trustedSourceType !== "youtube_api_shadow" ||
    proof.selection !== "last_observation_per_et_date" ||
    proof.substitutesForApprovedDailySnapshots !== false ||
    proof.rangeDays !== 90 ||
    proof.timeZone !== "America/New_York" ||
    !date(proof.startDate) ||
    !date(proof.endDate) ||
    !timestamp(proof.startsAt) ||
    !timestamp(proof.captureClock) ||
    !stringList(proof.sourceKeys) ||
    proof.sourceKeys.length === 0 ||
    !validBuckets
  )
    return [
      [
        label,
        "Evidencia de inspección inválida; cobertura sin verificar. No se infiere ausencia.",
      ],
    ];
  const describe = (bucket) =>
    bucket.eligibleVideos === 0
      ? "Sin relaciones seleccionadas en este grupo; no demuestra ausencia fuera de estas relaciones."
      : `${bucket.videosWithMultipleDates} / ${bucket.eligibleVideos} videos con al menos 2 fechas; ${bucket.renderableVideosWithMultipleDates} series con valores válidos; ${bucket.videosWithAllRequestedDates} con las 90 fechas. ${bucket.videosWithOneDate} con una fecha; ${bucket.videosWithoutTrustedSamples} sin lecturas confiables en el rango. ${bucket.unrenderableVideos} con lecturas inválidas (${bucket.invalidSelectedPointCount} puntos); ${bucket.invalidVideoIds} con identificador no válido para consultar el historial; ${bucket.missingTrackedVideos} sin registro en el catálogo rastreado. ${bucket.selectedPointCount} puntos seleccionados de ${bucket.rawObservationCount} lecturas; ${bucket.missingVideoDates} fechas por video sin muestra. Primera / última lectura UTC: ${bucket.firstObservedAt ?? "sin lecturas confiables"} / ${bucket.lastObservedAt ?? "sin lecturas confiables"}.`;
  return [
    [
      label,
      "Consulta del archivo completada. Observaciones acumulativas; no sustituyen snapshots diarios ni demuestran elegibilidad.",
    ],
    [
      "Archivo acumulativo · aprobados",
      describe(buckets.find((bucket) => bucket.scope === "approved")),
    ],
    [
      "Archivo acumulativo · candidatos",
      `${describe(buckets.find((bucket) => bucket.scope === "candidate_only"))} Solo inspección interna; no aprobación.`,
    ],
    [
      "Archivo acumulativo · procedencia",
      `${proof.sourceTable} · ${proof.trustedSourceType}. Última observación real por fecha de America/New_York. ${proof.startDate} a ${proof.endDate} (${proof.rangeDays} días solicitados); inicio UTC ${proof.startsAt}; captura UTC ${proof.captureClock}. Claves: ${proof.sourceKeys.join(", ")}. Contrato de consulta: ${proof.servingContractVersion}. No es cobertura de todo el historial.`,
    ],
  ];
}

export function monitoringSourceSummary(sourceEvidence) {
  const count = (value) =>
    Number.isFinite(Number(value)) && value != null
      ? String(value)
      : "Sin verificar";
  const units = (value, unit) =>
    value == null || !Number.isFinite(Number(value))
      ? "Sin verificar"
      : `${value} ${unit}`;
  return [
    ["Audiencia diaria", units(sourceEvidence.currentHistory?.days, "días")],
    [
      "Historial licenciado",
      units(sourceEvidence.compactHistory?.points, "observaciones"),
    ],
    [
      "Catálogo Spotify",
      `${count(sourceEvidence.catalog?.tracks)} canciones · ${count(sourceEvidence.catalog?.albums)} álbumes`,
    ],
    [
      "Historial de streams",
      `${units(sourceEvidence.streamHistory?.days, "días de catálogo")} · ${units(sourceEvidence.spotifyHistory?.days, "días de Kworb")}`,
    ],
    [
      "YouTube",
      `${count(sourceEvidence.youtube?.observedVideos)} videos observados de ${count(sourceEvidence.youtube?.approvedVideos)} vinculados`,
    ],
    [
      "Historial YouTube aprobado · diario",
      `${units(sourceEvidence.youtubeHistory?.days, "días")} · ${units(sourceEvidence.youtubeHistory?.points, "observaciones")}`,
    ],
    ...nativeYoutubeHistorySummary(
      sourceEvidence.youtubeNativeHistoryInspection,
    ),
  ];
}
