import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { EditorialFooter } from "@/components/EditorialLayout";
import { useMexicoAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import MonitorProExperience, {
  type InternalMonitorArtistCatalog,
  type MonitorDashboardData,
} from "@/components/monitoring/MonitorProExperience";
import {
  monitorRequestState,
  canDisplayMonitorData,
  requestMonitorResource,
  shouldRetryMonitorRequest,
  validateMonitorDashboard,
} from "@/lib/monitorRequest.mjs";

export default function MonitoringDashboard() {
  const [, params] = useRoute("/monitoreo/:artistKey");
  const [, setLocation] = useLocation();
  const artistKey = decodeURIComponent(params?.artistKey ?? "");
  const auth = useMexicoAuth();
  const { pick } = useLanguage();
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const reportRequest = useRef<AbortController | null>(null);
  const canRequest =
    auth.configured && auth.isLoaded && auth.isSignedIn && Boolean(auth.userId);
  useEffect(() => {
    setReportLoading(false);
    setReportError("");
    return () => {
      reportRequest.current?.abort();
      reportRequest.current = null;
    };
  }, [artistKey, auth.userId, auth.isSignedIn]);

  const { data, isFetching, isSuccess, error, refetch } =
    useQuery<MonitorDashboardData>({
      queryKey: ["monitoring-dashboard", auth.userId, artistKey],
      enabled: canRequest && Boolean(artistKey),
      staleTime: 5 * 60 * 1000,
      networkMode: "always",
      retry: shouldRetryMonitorRequest,
      queryFn: ({ signal }) =>
        requestMonitorResource<MonitorDashboardData>({
          getToken: auth.getToken,
          input: `/api/monitoring/dashboard/${encodeURIComponent(artistKey)}`,
          signal,
          readResponse: async (response) =>
            validateMonitorDashboard(
              (await response.json()) as MonitorDashboardData,
            ),
        }),
    });

  const { data: internalArtistCatalog } =
    useQuery<InternalMonitorArtistCatalog>({
      queryKey: ["internal-monitoring-artists", auth.userId],
      enabled:
        canRequest && !error && data?.subscription.accessSource === "internal",
      staleTime: 5 * 60 * 1000,
      retry: false,
      networkMode: "always",
      queryFn: ({ signal }) =>
        requestMonitorResource<InternalMonitorArtistCatalog>({
          getToken: auth.getToken,
          input: "/api/monitoring/internal/artists",
          signal,
        }),
    });

  const viewState = monitorRequestState({
    isFetching,
    error,
    succeeded: isSuccess,
    observationCount: data?.history.length ?? 0,
    partial: Object.values(data?.sectionStatus ?? {}).some(
      (status) => status !== "loaded",
    ),
  });

  async function downloadReport(month: string) {
    reportRequest.current?.abort();
    const controller = new AbortController();
    reportRequest.current = controller;
    setReportLoading(true);
    setReportError("");
    try {
      const { blob, filename } = await requestMonitorResource({
        getToken: auth.getToken,
        input: `/api/monitoring/report/${encodeURIComponent(artistKey)}?weekEnd=${encodeURIComponent(month)}`,
        signal: controller.signal,
        readResponse: async (response) => ({
          blob: await response.blob(),
          filename:
            response.headers
              .get("content-disposition")
              ?.match(/filename="([^"]+)"/)?.[1] ??
            `mexico-charts-monitor-pro-${artistKey}-${month}.pdf`,
        }),
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      if (controller.signal.aborted || reportRequest.current !== controller)
        return;
      setReportError(
        downloadError instanceof Error
          ? downloadError.message
          : pick(
              "No se pudo generar el reporte",
              "The report could not be generated",
            ),
      );
    } finally {
      if (reportRequest.current === controller) {
        reportRequest.current = null;
        setReportLoading(false);
      }
    }
  }

  // Cached private data must never take priority over a changed session or a
  // terminal authorization failure from the current server request.
  if (data && canDisplayMonitorData({ ...auth, data, error })) {
    return (
      <MonitorProExperience
        key={data.subscription.artistKey}
        data={data}
        internalArtistCatalog={internalArtistCatalog}
        onArtistChange={(nextArtistKey) =>
          setLocation(`/monitoreo/${encodeURIComponent(nextArtistKey)}`)
        }
        onDownloadReport={downloadReport}
        reportLoading={reportLoading}
        reportError={reportError}
        onReload={() => void refetch()}
        refreshing={isFetching}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PageSEO
        title={`${pick("Monitor Pro", "Pro Monitor")} — Mexico Charts`}
        description={pick(
          "Panel privado de monitoreo de artistas",
          "Private artist monitoring dashboard",
        )}
        path={`/monitoreo/${encodeURIComponent(artistKey)}`}
        noindex
      />
      <SiteNav />
      <main className="mx-auto max-w-[1500px] px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        {!auth.configured ? (
          <div className="rounded-3xl border border-white/10 p-10 text-center text-white/50">
            {pick(
              "El acceso seguro aún no está configurado.",
              "Secure access is not configured yet.",
            )}
          </div>
        ) : !auth.isLoaded ? (
          <p role="status" className="py-28 text-center text-sm text-white/45">
            {pick("Verificando tu sesión…", "Checking your session…")}
          </p>
        ) : !auth.isSignedIn || !auth.userId ? (
          <div className="rounded-3xl border border-[#39FF14]/20 bg-[#39FF14]/[0.04] p-10 text-center">
            <Sparkles className="mx-auto h-9 w-9 text-[#39FF14]" />
            <h1 className="mt-5 text-3xl font-black">
              {pick(
                "Ingresa para abrir tu Monitor",
                "Sign in to open your Monitor",
              )}
            </h1>
            <button
              type="button"
              onClick={auth.openSignIn}
              className="mt-6 rounded-full bg-[#39FF14] px-6 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-black"
            >
              {pick("Ingresar", "Sign in")}
            </button>
          </div>
        ) : viewState !== "loading" ? (
          <div
            role="alert"
            data-monitor-state={viewState}
            className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-10 text-center"
          >
            <h1 className="text-2xl font-black">
              {pick(
                viewState === "authorization_failure"
                  ? "Tu sesión no autoriza este Monitor"
                  : viewState === "timeout"
                    ? "El Monitor agotó su tiempo de respuesta"
                    : "No se pudo abrir este Monitor",
                viewState === "authorization_failure"
                  ? "Your session does not authorize this Monitor"
                  : viewState === "timeout"
                    ? "The Monitor request timed out"
                    : "This Monitor could not be opened",
              )}
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/45">
              {error instanceof Error
                ? error.message
                : pick(
                    "La consulta no se completó. Esto no confirma ausencia de datos.",
                    "The request did not complete. This does not confirm missing data.",
                  )}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-6 mr-3 rounded-full bg-[#39FF14] px-5 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-black"
            >
              {pick("Reintentar consulta", "Retry request")}
            </button>
            <Link
              href="/cuenta"
              className="mt-6 inline-flex rounded-full border border-white/10 px-5 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-white/65"
            >
              {pick("Volver a mi cuenta", "Back to my account")}
            </Link>
          </div>
        ) : (
          <div
            role="status"
            data-monitor-state="loading"
            className="py-28 text-center text-sm font-bold text-white/35"
          >
            {pick("Cargando tu historial…", "Loading your history…")}
          </div>
        )}
      </main>
      <EditorialFooter />
    </div>
  );
}
