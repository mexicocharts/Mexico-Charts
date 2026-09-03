import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { EditorialFooter } from "@/components/EditorialLayout";
import { authenticatedFetch, useMexicoAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import MonitorProExperience, {
  type InternalMonitorArtistCatalog,
  type MonitorDashboardData,
} from "@/components/monitoring/MonitorProExperience";
import {
  MonitoringDashboardHttpError,
  monitoringDashboardViewState,
  shouldRetryMonitoringDashboard,
} from "@/lib/monitoringAccess.mjs";

export default function MonitoringDashboard() {
  const [, params] = useRoute("/monitoreo/:artistKey");
  const [, setLocation] = useLocation();
  const artistKey = decodeURIComponent(params?.artistKey ?? "");
  const auth = useMexicoAuth();
  const { pick } = useLanguage();
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  const { data, isLoading, error } = useQuery<MonitorDashboardData>({
    queryKey: ["monitoring-dashboard", auth.userId, artistKey],
    enabled: auth.configured && auth.isSignedIn && Boolean(artistKey),
    staleTime: 5 * 60 * 1000,
    retry: shouldRetryMonitoringDashboard,
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15_000);
      const cancelForQuery = () => controller.abort();
      signal.addEventListener("abort", cancelForQuery, { once: true });
      try {
        const response = await authenticatedFetch(
          auth.getToken,
          `/api/monitoring/dashboard/${encodeURIComponent(artistKey)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as MonitorDashboardData & {
          error?: string;
        };
        if (!response.ok)
          throw new MonitoringDashboardHttpError(
            response.status,
            payload.error || "Unable to load monitoring dashboard",
          );
        return payload;
      } catch (requestError) {
        if (controller.signal.aborted && !signal.aborted) {
          throw new MonitoringDashboardHttpError(
            504,
            pick(
              "El Monitor tardó demasiado en responder. Intenta recargar la página.",
              "The Monitor took too long to respond. Please reload the page.",
            ),
          );
        }
        throw requestError;
      } finally {
        window.clearTimeout(timeout);
        signal.removeEventListener("abort", cancelForQuery);
      }
    },
  });

  const { data: internalArtistCatalog } =
    useQuery<InternalMonitorArtistCatalog>({
      queryKey: ["internal-monitoring-artists", auth.userId],
      enabled: data?.subscription.accessSource === "internal",
      staleTime: 5 * 60 * 1000,
      retry: false,
      queryFn: async () => {
        const response = await authenticatedFetch(
          auth.getToken,
          "/api/monitoring/internal/artists",
        );
        if (!response.ok)
          throw new Error("Internal monitoring artist list unavailable");
        return response.json() as Promise<InternalMonitorArtistCatalog>;
      },
    });

  const viewState = monitoringDashboardViewState({
    isLoading,
    error,
    hasData: Boolean(data),
  });

  async function downloadReport(month: string) {
    setReportLoading(true);
    setReportError("");
    try {
      const response = await authenticatedFetch(
        auth.getToken,
        `/api/monitoring/report/${encodeURIComponent(artistKey)}?month=${encodeURIComponent(month)}`,
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Unable to generate report");
      }
      const blob = await response.blob();
      const filename =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ??
        `mexico-charts-monitor-pro-${artistKey}-${month}.pdf`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setReportError(
        downloadError instanceof Error
          ? downloadError.message
          : pick(
              "No se pudo generar el reporte",
              "The report could not be generated",
            ),
      );
    } finally {
      setReportLoading(false);
    }
  }

  if (data) {
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
        ) : !auth.isSignedIn ? (
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
        ) : viewState === "error" ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-10 text-center">
            <h1 className="text-2xl font-black">
              {pick(
                "No se pudo abrir este Monitor",
                "This Monitor could not be opened",
              )}
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/45">
              {error instanceof Error
                ? error.message
                : pick(
                    "Necesitas una suscripción activa o acceso interno autorizado para este artista.",
                    "You need an active subscription or authorized internal access for this artist.",
                  )}
            </p>
            <Link
              href="/cuenta"
              className="mt-6 inline-flex rounded-full border border-white/10 px-5 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-white/65"
            >
              {pick("Volver a mi cuenta", "Back to my account")}
            </Link>
          </div>
        ) : (
          <div className="py-28 text-center text-sm font-bold text-white/35">
            {pick("Cargando tu historial…", "Loading your history…")}
          </div>
        )}
      </main>
      <EditorialFooter />
    </div>
  );
}
