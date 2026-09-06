import { MonitoringDashboardHttpError } from "./monitoringAccess.mjs";

const incompleteDirectory = () =>
  new MonitoringDashboardHttpError(
    502,
    "La respuesta del directorio está incompleta. La clasificación no está confirmada.",
  );

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
    !Array.isArray(data.missingSchemaTables) ||
    data.policyVersion == null ||
    data.contractVersion == null
  )
    throw incompleteDirectory();
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
      page.contractVersion !== first.contractVersion
    ) {
      throw new Error(
        "El catálogo o su política cambió durante la exportación. Vuelve a intentarlo.",
      );
    }
    if (page.hasMore && page.artists.length === 0)
      throw new Error("El directorio no avanzó; vuelve a intentarlo.");
    artists.push(...page.artists);
    populationComplete &&= page.populationComplete;
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
    auditComplete: populationComplete && incompleteAuditCount === 0,
    incompleteAuditCount,
    missingSchemaTables: [...missingSchemaTables],
    pageAuditedAt,
    total: artists.length,
    counts,
    artists,
  };
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
      "Historial YouTube",
      `${units(sourceEvidence.youtubeHistory?.days, "días")} · ${units(sourceEvidence.youtubeHistory?.points, "observaciones")}`,
    ],
  ];
}
