import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Search,
  ShieldCheck,
} from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { useMexicoAuth } from "@/auth/AuthProvider";
import {
  requestMonitorResource,
  shouldRetryMonitorRequest,
} from "@/lib/monitorRequest.mjs";
import {
  loadCompleteMonitoringAudit,
  monitoringSourceSummary,
  validateMonitoringDirectory,
  type MonitoringDirectory,
} from "@/lib/monitoringFounder.mjs";
const labels = {
  A: "Elegible ahora",
  B: "Reparable con datos existentes",
  C: "Bloqueado por datos",
};

export default function MonitoringFounder() {
  const auth = useMexicoAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [exportState, setExportState] = useState<{
    scope: string;
    text: string;
    running: boolean;
  } | null>(null);
  const exportController = useRef<AbortController | null>(null);
  const authScope = `${auth.userId ?? ""}:${auth.isSignedIn}:${auth.isLoaded}`;
  const activeScope = useRef(authScope);
  activeScope.current = authScope;
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setExportState(null);
    return () => {
      exportController.current?.abort();
      exportController.current = null;
    };
  }, [authScope]);
  const enabled =
    auth.configured && auth.isLoaded && auth.isSignedIn && Boolean(auth.userId);
  const result = useQuery<MonitoringDirectory>({
    queryKey: ["monitoring-founder-directory", auth.userId, query, offset],
    enabled,
    queryFn: ({ signal }) =>
      requestMonitorResource({
        getToken: auth.getToken,
        input: `/api/monitoring/internal/directory?limit=25&offset=${offset}&search=${encodeURIComponent(query)}`,
        signal,
        readResponse: async (response) =>
          validateMonitoringDirectory(await response.json()),
      }),
    staleTime: 60_000,
    gcTime: 0,
    retry: shouldRetryMonitorRequest,
    networkMode: "always",
  });
  const data = enabled && !result.error ? result.data : undefined;
  const error = result.error as (Error & { status?: number }) | null;
  const currentExport =
    enabled && exportState?.scope === authScope ? exportState : null;
  async function exportAudit() {
    if (!enabled || !data) return;
    exportController.current?.abort();
    const controller = new AbortController();
    exportController.current = controller;
    const isCurrent = () =>
      !controller.signal.aborted &&
      exportController.current === controller &&
      activeScope.current === authScope;
    const updateProgress = (text: string, running = true) => {
      if (isCurrent()) setExportState({ scope: authScope, text, running });
    };
    updateProgress("Iniciando auditoría completa…");
    try {
      const audit = await loadCompleteMonitoringAudit(
        (next, signal) =>
          requestMonitorResource({
            getToken: auth.getToken,
            input: `/api/monitoring/internal/directory?limit=50&offset=${next}`,
            signal,
            readResponse: async (response) =>
              validateMonitoringDirectory(await response.json()),
          }),
        {
          signal: controller.signal,
          onProgress: (completed, total) =>
            updateProgress(`${completed} / ${total} artistas auditados`),
        },
      );
      if (!isCurrent()) return;
      const content = { exportedAt: new Date().toISOString(), ...audit };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(content, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `monitor-pro-founder-audit-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      updateProgress(
        `${audit.total} artistas exportados; ${audit.incompleteAuditCount} auditorías pendientes.${audit.populationComplete ? "" : " El inventario está incompleto: faltan fuentes por verificar."}`,
        false,
      );
    } catch (error) {
      updateProgress(
        error instanceof Error
          ? error.message
          : "La exportación no se completó.",
        false,
      );
    } finally {
      if (exportController.current === controller)
        exportController.current = null;
    }
  }
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PageSEO
        title="Inspección del fundador — Monitor Pro"
        description="Directorio privado de preparación de Monitor Pro."
        path="/monitoreo/founder"
        noindex
      />
      <SiteNav />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-8">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#39FF14]">
          <ShieldCheck size={16} /> Monitor Pro · Acceso privado
        </p>
        <h1 className="mt-4 text-3xl font-black sm:text-5xl">
          Directorio del fundador
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-white/55">
          Inspecciona los datos reales de cada artista. El acceso privado no
          cambia su elegibilidad pública. Los errores de consulta se muestran
          como pendientes, nunca como ausencia confirmada de datos.
        </p>
        {!auth.isLoaded ? (
          <p role="status" className="mt-8">
            Resolviendo la sesión…
          </p>
        ) : !auth.configured ? (
          <p role="alert" className="mt-8">
            La autenticación no está configurada en este entorno.
          </p>
        ) : !auth.isSignedIn || !auth.userId ? (
          <button
            className="mt-8 rounded-lg bg-[#39FF14] px-5 py-3 font-bold text-black"
            onClick={auth.openSignIn}
          >
            Iniciar sesión
          </button>
        ) : (
          <>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <label className="flex flex-1 items-center gap-3 rounded-lg border border-white/15 px-4">
                <Search size={18} />
                <input
                  aria-label="Buscar artista o ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar artista o ID canónico"
                  className="min-w-0 flex-1 bg-transparent py-3 outline-none"
                />
              </label>
              {data && (
                <button
                  onClick={exportAudit}
                  disabled={currentExport?.running}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-bold disabled:opacity-40"
                >
                  <Download size={16} />{" "}
                  {currentExport?.running
                    ? "Exportando…"
                    : "Exportar todos · JSON"}
                </button>
              )}
            </div>
            {currentExport && (
              <p role="status" className="mt-3 text-xs text-white/60">
                {currentExport.text}
              </p>
            )}
            {result.isFetching && (
              <p role="status" className="mt-6 text-sm text-white/55">
                Consultando evidencia de preparación…
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-amber-400/30 p-5"
              >
                <p>
                  {error.status === 403
                    ? "Este directorio está reservado al fundador."
                    : error.status === 401
                      ? "La sesión expiró. Inicia sesión para continuar."
                      : error.status === 504
                        ? "La consulta excedió su tiempo de respuesta."
                        : error.message}
                </p>
                <button
                  onClick={() =>
                    error.status === 401 ? auth.openSignIn() : result.refetch()
                  }
                  className="mt-3 underline"
                >
                  {error.status === 401 ? "Iniciar sesión" : "Reintentar"}
                </button>
              </div>
            )}
            {data && (
              <>
                {!data.populationComplete && (
                  <div
                    role="alert"
                    className="mt-6 rounded-xl border border-amber-400/30 p-4 text-sm text-amber-100/80"
                  >
                    <p>
                      Inventario parcial: algunas fuentes no están disponibles.
                      El número mostrado corresponde a los candidatos
                      encontrados; no confirma que sean todos.
                    </p>
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer">
                        Fuentes pendientes de verificar
                      </summary>
                      <p className="mt-2 break-words font-mono">
                        {data.missingSchemaTables.join(", ")}
                      </p>
                    </details>
                  </div>
                )}
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/60">
                  <span>{data.total} candidatos</span>
                  <span>
                    En esta página: A {data.counts.A} · B {data.counts.B} · C{" "}
                    {data.counts.C} · Sin clasificación {data.counts.incomplete}
                  </span>
                  <span>
                    Auditorías incompletas:{" "}
                    {
                      data.artists.filter(
                        (artist) => artist.auditStatus === "incomplete",
                      ).length
                    }
                  </span>
                  <span>
                    Política {data.policyVersion} · {data.auditedAt}
                  </span>
                </div>
                <div className="mt-6 space-y-4">
                  {data.artists.map((artist) => (
                    <article
                      key={artist.artistKey}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-5 sm:p-6"
                    >
                      <div className="flex flex-col justify-between gap-4 sm:flex-row">
                        <div>
                          <h2 className="text-xl font-bold">
                            {artist.artistName}
                          </h2>
                          <p className="mt-1 break-all font-mono text-xs text-white/45">
                            {artist.artistKey}
                          </p>
                          <p className="mt-3 text-sm text-[#39FF14]">
                            {artist.classification
                              ? `${artist.classification} · ${labels[artist.classification]}`
                              : "Auditoría pendiente"}
                          </p>
                        </div>
                        <Link
                          href={`/monitoreo/${encodeURIComponent(artist.artistKey)}`}
                          className="flex items-center gap-2 self-start rounded-lg border border-white/20 px-4 py-2 text-sm font-bold"
                        >
                          Ver perfil <ArrowRight size={16} />
                        </Link>
                      </div>
                      <div className="mt-4 grid gap-2 text-xs text-white/60 sm:grid-cols-3">
                        <span>
                          Públicamente elegible:{" "}
                          {artist.classification === "C"
                            ? "No"
                            : artist.auditStatus === "incomplete"
                              ? "Pendiente de confirmar"
                              : artist.publicEligible
                                ? "Sí"
                                : "No"}
                        </span>
                        <span>
                          Inspección privada: independiente de la clasificación
                        </span>
                        <span>
                          Última lectura:{" "}
                          {artist.lastSnapshotDate ??
                            (artist.auditStatus === "incomplete"
                              ? "No confirmada"
                              : "Sin lectura registrada")}
                        </span>
                      </div>
                      {artist.auditStatus === "incomplete" && (
                        <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100/80">
                          {artist.classification === "C"
                            ? "Hay un bloqueo confirmado. Otras verificaciones siguen pendientes; esta auditoría está incompleta."
                            : "La evidencia todavía está incompleta. Las verificaciones pendientes se detallan abajo."}
                        </p>
                      )}
                      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {monitoringSourceSummary(artist.sourceEvidence).map(
                          ([label, value]) => (
                            <div
                              key={label}
                              className="rounded-lg border border-white/[0.07] bg-black/20 p-3"
                            >
                              <dt className="text-[10px] uppercase tracking-wide text-white/40">
                                {label}
                              </dt>
                              <dd className="mt-1 text-xs font-bold text-white/70">
                                {value}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                      {artist.findings?.length > 0 && (
                        <ul className="mt-4 space-y-2 text-sm text-amber-100/80">
                          {artist.findings.map((finding, index) => (
                            <li key={`${finding.code}-${index}`}>
                              <span className="font-mono text-xs">
                                {finding.code}
                              </span>{" "}
                              · {finding.section} · {finding.status}
                              {typeof finding.evidence === "string" && (
                                <span className="mt-1 block text-xs text-white/60">
                                  {finding.evidence}
                                </span>
                              )}
                              {finding.action && (
                                <span className="block text-xs text-white/50">
                                  {finding.action}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <details className="mt-4 border-t border-white/10 pt-4">
                        <summary className="cursor-pointer text-xs font-bold text-white/70">
                          Cobertura, mapeos, frescura y evidencia por fuente
                        </summary>
                        {artist.identityConflict && (
                          <div className="mt-3 text-xs text-amber-100/80">
                            <p>Inspeccionar cada ID de origen por separado:</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {artist.sourceKeys.map((key) => (
                                <Link key={key} href={`/monitoreo/${encodeURIComponent(key)}`}
                                  className="break-all rounded border border-white/20 px-3 py-2 font-mono underline">
                                  {key}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-4 text-xs leading-5 text-white/55">
                          {JSON.stringify(
                            {
                              sourceKeys: artist.sourceKeys,
                              spotifyIds: artist.spotifyIds,
                              invalidSpotifyIds: artist.invalidSpotifyIds,
                              declaredAliases: artist.declaredAliases,
                              identityMappingStatus: artist.identityMappingStatus,
                              identityAliasEvidence: artist.identityAliasEvidence,
                              candidateRecords: artist.candidateRecords,
                              candidateSources: artist.candidateSources,
                              readinessReasons: artist.readinessReasons,
                              findings: artist.findings,
                              ...artist.sourceEvidence,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </article>
                  ))}
                  {data.artists.length === 0 && (
                    <p className="py-10 text-center text-white/50">
                      No se encontraron candidatos para esta búsqueda.
                    </p>
                  )}
                </div>
                <div className="mt-6 flex justify-between">
                  <button
                    disabled={offset === 0 || result.isFetching}
                    onClick={() => setOffset(Math.max(0, offset - 25))}
                    className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 disabled:opacity-30"
                  >
                    <ArrowLeft size={16} /> Anterior
                  </button>
                  <button
                    disabled={!data.hasMore || result.isFetching}
                    onClick={() => setOffset(offset + 25)}
                    className="flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 disabled:opacity-30"
                  >
                    Siguiente <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
