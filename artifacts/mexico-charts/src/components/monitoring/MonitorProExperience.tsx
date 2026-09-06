import { createContext, useContext, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Download,
  Disc3,
  FileText,
  Flag,
  Headphones,
  Instagram,
  LayoutDashboard,
  MapPin,
  Music2,
  Play,
  Radar,
  Search,
  Settings2,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Users,
  Video,
  Youtube,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useMexicoAuth } from "@/auth/AuthProvider";
import {
  monitorRequestState,
  requestMonitorResource,
  shouldRetryMonitorRequest,
  validateMonitorHistory,
  type MonitorHistoryResponse,
} from "@/lib/monitorRequest.mjs";
import type { YouTubeLivePreviewVideo } from "@/components/YouTubeLivePublicPreview";

// Canonical presentation recovered from MonitoringFeaturePreview.tsx at
// 57a7c4106dbf56b93ccc917611d66d43e790de3b. Artist identity and every displayed
// metric below are supplied by the authorized production dashboard payload.

const G = "#39FF14";

export type MonitorMetricKey =
  | "spotifyMonthlyListeners"
  | "spotifyFollowers"
  | "youtubeSubscribers"
  | "youtubeChannelViews"
  | "instagramFollowers"
  | "tiktokFollowers";

export type MonitorSnapshot = Record<MonitorMetricKey, number | null> & {
  date: string;
  spotifyPopularity: number | null;
  facebookFollowers: number | null;
  twitterFollowers: number | null;
  soundcloudFollowers: number | null;
  deezerFollowers: number | null;
};

export type MonitorDashboardData = {
  identityDiagnostics?: { canonicalArtistKey: string; sourceKeys: string[]; conflict: boolean; warnings: string[] };
  sectionStatus?: Record<
    string,
    "loaded" | "failed" | "timeout" | "budget_exhausted"
  >;
  subscription: {
    artistKey: string;
    artistName: string;
    artistImageUrl: string | null;
    status: string;
    activatedAt: string | null;
    accessSource: "subscription" | "internal";
  };
  current: MonitorSnapshot | null;
  history: MonitorSnapshot[];
  dailyPulse: {
    status: "ready" | "collecting";
    currentDate: string | null;
    previousDate: string | null;
    headline: string;
    summary: string;
    metricsChanged: number;
    signals: Array<{
      kind: "gain" | "decline" | "milestone" | "release";
      platform: string;
      metric: string;
      title: string;
      currentValue: number | null;
      delta: number | null;
      percentage: number | null;
      releaseDate?: string;
    }>;
  };
  growth: Partial<
    Record<
      MonitorMetricKey,
      {
        days7: { absolute: number; percentage: number | null } | null;
        days30: { absolute: number; percentage: number | null } | null;
        days90: { absolute: number; percentage: number | null } | null;
      }
    >
  >;
  availableHistory: {
    historyLabel: string;
    availableMetricCount: number;
    metrics: Array<{
      metricKey: string;
      status: "available" | "unavailable";
      earliestAvailableDate: string | null;
      latestAvailableDate: string | null;
      observationCount: number;
      spanDays: number;
      multiYear: boolean;
    }>;
  };
  topMexicoCities: Array<{
    name: string;
    region: string | null;
    countryCode: string;
    currentListeners: number;
    peakListeners: number | null;
  }>;
  catalog: {
    releaseCount: number;
    trackCount: number;
    albumCount: number;
    releasesLast90Days: number;
    medianReleaseGapDays: number | null;
    newestReleaseDate: string | null;
    releases: Array<{
      id: string;
      title: string;
      type: string;
      releaseDate: string | null;
      artworkUrl: string | null;
      platformCount: number;
    }>;
  };
  liveVideos: YouTubeLivePreviewVideo[];
  youtubeCoverage: {
    channelVideoCount: number | null;
    importedVideoCount: number;
    linkedVideoCount: number;
    observedVideoCount: number;
    importStatus: "complete" | "retryable" | "pending";
    complete: boolean;
  };
  latestReleaseImpact: null | {
    release: {
      id: string;
      title: string;
      type: string;
      releaseDate: string | null;
      artworkUrl: string | null;
      platformCount: number;
    };
    score: number | null;
    confidence: "high" | "medium" | "collecting";
    platformsMeasured: number;
    lift7: number | null;
    lift30: number | null;
    lift90: number | null;
  };
  liveVideoHistory: Array<{
    video_id: string;
    snapshot_date: string;
    view_count: string | number | null;
    daily_view_delta: string | number | null;
  }>;
  comparisonArtists: Array<{
    artistKey: string;
    artistName: string;
    artistImageUrl: string | null;
    snapshotDate: string;
    spotifyMonthlyListeners: number | null;
    spotifyGrowth30: { absolute: number; percentage: number | null } | null;
    youtubeChannelViews: number | null;
    youtubeGrowth30: { absolute: number; percentage: number | null } | null;
    instagramFollowers: number | null;
  }>;
  reportCapabilities: {
    weeklyPdf?: boolean;
    monthlyPdf: boolean;
    weeklyEmail: boolean;
    csvExport: boolean;
  };
  spotifyCatalog: {
    source: "archive" | "kworb_live_complete_catalog" | "unavailable";
    snapshotDate: string | null;
    trackCount: number;
    albumCount: number;
    trackDailyStreams: number | null;
    albumDailyStreams: number | null;
    trackTotalStreams: number | null;
    albumTotalStreams: number | null;
    history: Array<{
      date: string;
      totalStreams: number | null;
      dailyStreams: number | null;
    }>;
    items: Array<{
      type: "track" | "album";
      key: string;
      title: string;
      spotifyUrl: string | null;
      artworkUrl: string | null;
      compilation: boolean;
      totalStreams: number | null;
      dailyStreams: number | null;
    }>;
  };
};

export type InternalMonitorArtistCatalog = {
  count: number;
  artists: Array<{
    artistKey: string;
    artistName: string;
    lastSnapshotDate: string | null;
    spotifyItemCount: number;
    youtubeVideoCount: number;
  }>;
};

type MonitorProContextValue = {
  data: MonitorDashboardData;
  internalArtistCatalog?: InternalMonitorArtistCatalog;
  onArtistChange?: (artistKey: string) => void;
  onDownloadReport: (month: string) => Promise<void>;
  reportLoading: boolean;
  reportError: string;
  onReload?: () => void;
  refreshing?: boolean;
};

const MonitorProContext = createContext<MonitorProContextValue | null>(null);

function useMonitorPro() {
  const value = useContext(MonitorProContext);
  if (!value)
    throw new Error(
      "MonitorProExperience must be used with real dashboard data",
    );
  return value;
}

type View =
  | "resumen"
  | "tendencias"
  | "spotify"
  | "videos"
  | "mercados"
  | "comparar"
  | "alertas"
  | "reportes";
type TrendKey = "spotify" | "instagram" | "tiktok";

const compact = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("es-MX", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
const exact = (value: number | null | undefined) =>
  value == null ? "—" : new Intl.NumberFormat("es-MX").format(value);
const signed = (value: number | null | undefined) =>
  value == null ? "—" : `${value >= 0 ? "+" : "−"}${exact(Math.abs(value))}`;
const dateLabel = (value: string | null | undefined) =>
  !value
    ? "fecha pendiente"
    : new Intl.DateTimeFormat("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const nextMilestone = (value: number) => {
  const step =
    value < 100_000
      ? 10_000
      : value < 1_000_000
        ? 100_000
        : value < 10_000_000
          ? 1_000_000
          : value < 100_000_000
            ? 10_000_000
            : 100_000_000;
  return Math.ceil((value + 1) / step) * step;
};
const intervalLabel = (seconds: number) => {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;
  const hours = seconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
};

function SpotifyArtwork({
  src,
  title,
  className = "",
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(30,215,96,.32),transparent_52%),linear-gradient(145deg,#171717,#050505)] ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={`Portada de ${title}`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <Disc3 className="h-8 w-8 text-[#1ed760]/70" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-black uppercase tracking-[.2em] text-[#39FF14]">
      {children}
    </p>
  );
}
function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-3xl border border-white/[.08] bg-white/[.025] ${className}`}
    >
      {children}
    </article>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  change,
  color = G,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  change: string;
  color?: string;
}) {
  const down = change.startsWith("−");
  return (
    <Panel className="relative overflow-hidden p-5">
      <div
        className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10 blur-3xl"
        style={{ background: color }}
      />
      <Icon className="h-5 w-5" style={{ color }} />
      <p className="mt-5 text-[8px] font-black uppercase tracking-[.16em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-[-.045em]">{value}</p>
      <p
        className={`mt-2 flex items-center gap-1 text-[10px] font-black ${down ? "text-red-400" : "text-[#39FF14]"}`}
      >
        {down ? (
          <TrendingDown className="h-3 w-3" />
        ) : (
          <TrendingUp className="h-3 w-3" />
        )}
        {change}
      </p>
    </Panel>
  );
}

function TrendChart({
  metric,
  setMetric,
}: {
  metric: TrendKey;
  setMetric: (metric: TrendKey) => void;
}) {
  const { data } = useMonitorPro();
  const [range, setRange] = useState<
    "7d" | "30d" | "90d" | "6m" | "1y" | "all"
  >("all");
  const requestedRangeDays = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "6m": 182,
    "1y": 365,
    all: null,
  }[range];
  const metricKey = {
    spotify: "spotifyMonthlyListeners",
    instagram: "instagramFollowers",
    tiktok: "tiktokFollowers",
  }[metric] as MonitorMetricKey;
  const auth = useMexicoAuth();
  const metricHistory = useQuery<MonitorHistoryResponse>({
    queryKey: [
      "monitor-history",
      auth.userId,
      data.subscription.artistKey,
      metricKey,
    ],
    enabled:
      auth.configured &&
      auth.isLoaded &&
      auth.isSignedIn &&
      Boolean(auth.userId),
    staleTime: 5 * 60 * 1000,
    networkMode: "always",
    retry: shouldRetryMonitorRequest,
    queryFn: ({ signal }) =>
      requestMonitorResource<MonitorHistoryResponse>({
        getToken: auth.getToken,
        input: `/api/monitoring/history/${encodeURIComponent(data.subscription.artistKey)}/${metricKey}?range=all&resolution=auto`,
        signal,
        readResponse: async (response) =>
          validateMonitorHistory(await response.json()),
      }),
  });
  const allAvailable = useMemo(() => {
    const base = data.history.flatMap((point) =>
      point[metricKey] == null
        ? []
        : [{ date: point.date, value: point[metricKey] as number }],
    );
    const merged = new Map(base.map((point) => [point.date, point]));
    for (const [date, value] of metricHistory.data?.points ?? [])
      merged.set(date, { date, value });
    return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data.history, metricKey, metricHistory.data]);
  const availableSpanDays = useMemo(() => {
    const earliest = allAvailable[0]?.date;
    const latest = allAvailable.at(-1)?.date;
    if (!earliest || !latest) return 0;
    return (
      Math.floor(
        (Date.parse(`${latest}T12:00:00Z`) -
          Date.parse(`${earliest}T12:00:00Z`)) /
          86_400_000,
      ) + 1
    );
  }, [allAvailable]);
  const rangeOptions = (
    [
      ["7d", 7],
      ["30d", 30],
      ["90d", 90],
      ["6m", 182],
      ["1y", 365],
    ] as const
  )
    .filter(([, days]) => availableSpanDays >= days)
    .map(([option]) => option);
  const rangeDays =
    requestedRangeDays != null && availableSpanDays >= requestedRangeDays
      ? requestedRangeDays
      : null;
  const effectiveRange = rangeDays == null ? "all" : range;
  const chart = useMemo(() => {
    const latest = allAvailable.at(-1)?.date;
    if (!latest || rangeDays == null) return allAvailable;
    const cutoff = new Date(`${latest}T12:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - rangeDays + 1);
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    return allAvailable.filter((point) => point.date >= cutoffDate);
  }, [allAvailable, rangeDays]);
  const historyAvailability = data.availableHistory.metrics.find(
    (candidate) => candidate.metricKey === metricKey,
  );
  const growth30 = data.growth[metricKey]?.days30 ?? null;
  const meta = {
    spotify: {
      label: "Oyentes mensuales Spotify",
      color: "#1ed760",
    },
    instagram: {
      label: "Seguidores Instagram",
      color: "#f05aa6",
    },
    tiktok: {
      label: "Seguidores TikTok",
      color: "#ffffff",
    },
  }[metric];
  const values = chart.map((point) => point.value);
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const padding = Math.max(1, spread * 0.18);
  const domain: [number, number] = [
    (values.length ? Math.min(...values) : 0) - padding,
    (values.length ? Math.max(...values) : 1) + padding,
  ];
  // Daily points can describe the selected chart window exactly. A min/max
  // transport series is sampled, so only server coverage can establish gaps.
  const visibleMissingDays =
    rangeDays != null && metricHistory.data?.resolution?.returned === "daily"
      ? Math.max(0, rangeDays - chart.length)
      : (metricHistory.data?.rangeCoverage?.missingDateCount ?? 0);
  const partialHistory = allAvailable.length === 1 || visibleMissingDays > 0;
  const historyState = monitorRequestState({
    isFetching: metricHistory.isFetching,
    error: metricHistory.error,
    succeeded: metricHistory.isSuccess,
    observationCount: chart.length,
    partial: partialHistory,
  });
  const historyStatusText = {
    loading: "Cargando historial: la consulta está en curso.",
    loaded: "Historial cargado con observaciones reales.",
    empty:
      "Consulta completada: no hay observaciones para esta métrica en el rango solicitado.",
    authorization_failure:
      "La sesión no autoriza consultar este historial. Revisa tu cuenta antes de reintentar.",
    backend_failure:
      "No se pudo consultar el historial. El error no confirma ausencia de datos.",
    timeout:
      "La consulta del historial agotó su tiempo de respuesta. Puedes reintentar.",
    partial:
      "Historial parcial: las observaciones recibidas no cubren todos los días de esta ventana.",
  }[historyState];
  const historyFailed = [
    "authorization_failure",
    "backend_failure",
    "timeout",
  ].includes(historyState);
  const canShowHistory = historyState !== "authorization_failure";
  return (
    <Panel className="p-5 sm:p-7">
      <div
        role={historyFailed ? "alert" : "status"}
        data-history-state={historyState}
        className={`mb-4 text-xs ${historyFailed || historyState === "partial" ? "text-amber-300" : "text-white/45"}`}
      >
        <p>{historyStatusText}</p>
        {historyFailed && canShowHistory && allAvailable.length > 0 && (
          <p className="mt-2">
            La gráfica conserva las lecturas ya recibidas; no confirma ausencia
            de historia anterior.
          </p>
        )}
        {historyState === "partial" && visibleMissingDays > 0 && (
          <p className="mt-2">
            {visibleMissingDays} días sin observación en la ventana consultada.
          </p>
        )}
        {data.subscription.accessSource === "internal" && historyFailed && (
          <p className="mt-2 text-[10px]">
            {metricHistory.error?.message} · {data.subscription.artistKey} ·{" "}
            {metricKey}
          </p>
        )}
        {historyFailed && (
          <button
            type="button"
            onClick={() => void metricHistory.refetch()}
            className="mt-3 rounded-full border border-white/15 px-4 py-2 text-[9px] font-black uppercase tracking-[.13em] text-white"
          >
            Reintentar historial
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Kicker>
            Historial premium ·{" "}
            {effectiveRange === "all"
              ? `${availableSpanDays} días disponibles`
              : effectiveRange}
          </Kicker>
          <h2 className="mt-2 text-2xl font-black">{meta.label}</h2>
          <p
            className={`mt-2 text-xs font-black ${(growth30?.absolute ?? 0) < 0 ? "text-red-400" : "text-[#39FF14]"}`}
          >
            {growth30
              ? `${signed(growth30.absolute)} · ${growth30.percentage == null ? "—" : `${growth30.percentage >= 0 ? "+" : ""}${growth30.percentage.toFixed(2)}%`} en 30 días`
              : "Ventana de 30 días no disponible en esta respuesta"}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {[...rangeOptions, "all" as const].map((option) => (
            <button
              key={option}
              onClick={() => setRange(option)}
              className={`rounded-full px-3 py-2 text-[8px] font-black uppercase tracking-[.13em] ${effectiveRange === option ? "bg-[#39FF14] text-black" : "border border-white/10 text-white/35 hover:text-white"}`}
            >
              {option === "all" ? `Todo · ${availableSpanDays}d` : option}
            </button>
          ))}
          {(["spotify", "instagram", "tiktok"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`rounded-full px-4 py-2 text-[8px] font-black uppercase tracking-[.13em] ${metric === key ? "bg-white text-black" : "border border-white/10 text-white/35 hover:text-white"}`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 text-[9px] leading-5 text-white/35">
        {canShowHistory && allAvailable.length
          ? `${allAvailable.length} observaciones realmente entregadas · ${dateLabel(allAvailable[0]?.date)}–${dateLabel(allAvailable.at(-1)?.date)}`
          : historyState === "empty"
            ? "No se entregó historial para esta métrica."
            : "La disponibilidad del historial no está confirmada."}
        {historyAvailability?.status !== "available" &&
          " El historial licenciado anterior todavía no está integrado a esta respuesta."}
        {metricHistory.data?.resolution?.returned === "minmax" &&
          ` Representación reducida de ${metricHistory.data.resolution.exactSourcePoints} observaciones reales; los datos de origen se conservan.`}
      </p>
      <div className="mt-6 h-72">
        {canShowHistory && chart.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chart}>
              <defs>
                <linearGradient
                  id={`monitor-${metric}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={meta.color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }}
                tickFormatter={compact}
                width={50}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#111",
                  border: "1px solid rgba(255,255,255,.12)",
                  borderRadius: 12,
                }}
                formatter={(v) => exact(Number(v))}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={meta.color}
                strokeWidth={3}
                fill={`url(#monitor-${metric})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-2xl border border-white/[.06] text-xs font-bold text-white/25">
            {historyState === "loading"
              ? "Cargando historial…"
              : historyState === "partial"
                ? "Una observación disponible; se necesitan al menos dos para dibujar la tendencia."
                : historyStatusText}
          </div>
        )}
      </div>
    </Panel>
  );
}

function SummaryView({ open }: { open: (view: View) => void }) {
  const { data } = useMonitorPro();
  const current = data.current;
  const growth = (key: MonitorMetricKey) => data.growth[key]?.days30 ?? null;
  const changeLabel = (key: MonitorMetricKey) => {
    const value = growth(key);
    return value
      ? `${signed(value.absolute)} · 30d`
      : "Sin ventana de 30d en la respuesta";
  };
  const strongestSignals = data.dailyPulse.signals
    .filter((signal) => signal.delta != null)
    .slice(0, 3);
  const featuredVideo =
    [...data.liveVideos]
      .filter((video) => video.view_count != null)
      .sort((a, b) => Number(b.view_count) - Number(a.view_count))[0] ?? null;
  const featuredViews = Number(featuredVideo?.view_count ?? 0);
  const milestone = featuredViews > 0 ? nextMilestone(featuredViews) : null;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Headphones}
          label="Oyentes Spotify"
          value={compact(current?.spotifyMonthlyListeners)}
          change={changeLabel("spotifyMonthlyListeners")}
          color="#1ed760"
        />
        <Metric
          icon={Users}
          label="Seguidores Spotify"
          value={compact(current?.spotifyFollowers)}
          change={changeLabel("spotifyFollowers")}
          color="#1ed760"
        />
        <Metric
          icon={Youtube}
          label="Vistas YouTube"
          value={compact(current?.youtubeChannelViews)}
          change={changeLabel("youtubeChannelViews")}
          color="#ff3b30"
        />
        <Metric
          icon={Instagram}
          label="Seguidores Instagram"
          value={compact(current?.instagramFollowers)}
          change={changeLabel("instagramFollowers")}
          color="#f05aa6"
        />
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.45fr_.8fr]">
        <Panel className="overflow-hidden border-[#39FF14]/20 bg-[radial-gradient(circle_at_top_right,rgba(57,255,20,.1),transparent_45%)] p-6 sm:p-8">
          <Kicker>Actividad reciente</Kicker>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-.04em]">
            {data.dailyPulse.headline}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
            {data.dailyPulse.summary}
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {[
              ["Cambios detectados", String(data.dailyPulse.metricsChanged)],
              ["Última lectura", dateLabel(data.dailyPulse.currentDate)],
              [
                "Mercado principal",
                data.topMexicoCities[0]
                  ? `${data.topMexicoCities[0].name} · ${compact(data.topMexicoCities[0].currentListeners)}`
                  : "Datos no disponibles",
              ],
            ].map(([a, b]) => (
              <div
                key={a}
                className="rounded-xl border border-white/[.07] bg-black/25 p-4"
              >
                <p className="text-[8px] font-black uppercase tracking-[.14em] text-white/25">
                  {a}
                </p>
                <p className="mt-2 text-sm font-black">{b}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-6">
          <Kicker>Rendimiento digital</Kicker>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-4xl font-black tracking-[-.06em]">
                En análisis
              </p>
              <p className="text-[9px] font-black uppercase tracking-[.15em] text-[#39FF14]">
                Sin puntuación fabricada
              </p>
            </div>
            <div className="grid h-20 w-20 place-items-center rounded-full border-[7px] border-[#39FF14]/25 text-center text-[9px] font-black text-white/45">
              Datos
              <br />
              reales
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {[
              ["Historial", data.history.length],
              ["Spotify", data.spotifyCatalog.items.length],
              ["YouTube", data.youtubeCoverage.observedVideoCount],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="flex justify-between text-[9px] font-black">
                  <span>{label}</span>
                  <span className="text-white/30">{value} registros</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[.07]">
                  <div
                    className="h-full rounded-full bg-[#39FF14]"
                    style={{
                      width: `${Math.min(100, Math.max(8, Number(value)))}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <Panel className="p-6">
          <Kicker>Spotify · canciones</Kicker>
          <p className="mt-3 text-3xl font-black">
            {compact(data.spotifyCatalog.trackDailyStreams)}
          </p>
          <p className="mt-1 text-[9px] text-white/30">
            streams diarios · {data.spotifyCatalog.trackCount} canciones
          </p>
        </Panel>
        <Panel className="p-6">
          <Kicker>Spotify · álbumes</Kicker>
          <p className="mt-3 text-3xl font-black">
            {compact(data.spotifyCatalog.albumDailyStreams)}
          </p>
          <p className="mt-1 text-[9px] text-white/30">
            streams diarios · {data.spotifyCatalog.albumCount} álbumes
          </p>
        </Panel>
        <button
          onClick={() => open("spotify")}
          className="flex min-h-32 items-center justify-center gap-2 rounded-3xl border border-[#1ed760]/20 bg-[#1ed760]/[.06] px-7 text-[9px] font-black uppercase tracking-[.15em] text-[#39FF14]"
        >
          Abrir Spotify <ChevronRight className="h-4 w-4" />
        </button>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-6">
          <Kicker>Cambios</Kicker>
          <div className="mt-5 space-y-4">
            {(strongestSignals.length
              ? strongestSignals.map((signal) => [
                  signal.platform,
                  signed(signal.delta),
                  signal.title,
                ])
              : [["Lecturas", "—", "Recopilando cambios entre observaciones"]]
            ).map(([a, b, c]) => (
              <div
                key={a}
                className="border-b border-white/[.07] pb-4 last:border-0 last:pb-0"
              >
                <div className="flex justify-between">
                  <p className="text-xs font-black">{a}</p>
                  <p
                    className={
                      String(b).startsWith("+")
                        ? "text-xs font-black text-[#39FF14]"
                        : "text-xs font-black text-red-400"
                    }
                  >
                    {b}
                  </p>
                </div>
                <p className="mt-1 text-[9px] text-white/30">{c}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-6">
          <Kicker>Análisis</Kicker>
          <p className="mt-4 text-lg font-black">{data.dailyPulse.headline}</p>
          <p className="mt-3 text-xs leading-6 text-white/40">
            {data.dailyPulse.summary}
          </p>
          <button
            onClick={() => open("tendencias")}
            className="mt-5 flex items-center gap-2 text-[9px] font-black uppercase tracking-[.15em] text-[#39FF14]"
          >
            Ver tendencias <ChevronRight className="h-3 w-3" />
          </button>
        </Panel>
        <Panel className="border-[#39FF14]/20 bg-[#39FF14]/[.035] p-6">
          <Kicker>Oportunidad</Kicker>
          <p className="mt-4 text-lg font-black">
            {featuredVideo
              ? `${featuredVideo.title} se acerca a un nuevo hito`
              : "Esperando videos verificados"}
          </p>
          <p className="mt-3 text-xs leading-6 text-white/40">
            {featuredVideo && milestone
              ? `${exact(featuredViews)} vistas observadas; próximo hito ${compact(milestone)}.`
              : "Esta sección se completará cuando exista cobertura real de YouTube."}
          </p>
          <button
            onClick={() => open("videos")}
            className="mt-5 rounded-xl bg-[#39FF14] px-4 py-3 text-[9px] font-black uppercase tracking-[.15em] text-black"
          >
            Abrir YouTube
          </button>
        </Panel>
      </section>
    </div>
  );
}

function TrendsView({
  metric,
  setMetric,
}: {
  metric: TrendKey;
  setMetric: (metric: TrendKey) => void;
}) {
  const { data } = useMonitorPro();
  const trendSummary = (key: MonitorMetricKey, label: string) => {
    const value = data.growth[key]?.days30;
    if (!value)
      return [
        label,
        "Ventana no disponible",
        "La respuesta no incluye una ventana válida de 30 días para calcular esta tendencia.",
      ];
    const direction = value.absolute >= 0 ? "crecimiento" : "descenso";
    return [
      label,
      `${label} en ${direction}`,
      `${signed(value.absolute)} en 30 días${value.percentage == null ? "" : ` · ${value.percentage >= 0 ? "+" : ""}${value.percentage.toFixed(2)}%`}`,
    ];
  };
  return (
    <div className="space-y-4">
      <TrendChart metric={metric} setMetric={setMetric} />
      <section className="grid gap-4 lg:grid-cols-3">
        {[
          trendSummary("spotifyMonthlyListeners", "Oyentes"),
          trendSummary("spotifyFollowers", "Seguidores"),
          trendSummary("youtubeChannelViews", "YouTube"),
        ].map(([k, title, body]) => (
          <Panel key={k} className="p-6">
            <Kicker>{k}</Kicker>
            <h3 className="mt-3 text-xl font-black">{title}</h3>
            <p className="mt-3 text-xs leading-6 text-white/40">{body}</p>
          </Panel>
        ))}
      </section>
      <Panel className="p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Kicker>Historial</Kicker>
            <h3 className="mt-2 text-xl font-black">
              {data.history.length} lecturas guardadas en la ventana realmente
              entregada
            </h3>
          </div>
          <span className="w-fit rounded-full border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[.14em] text-[#39FF14]">
            Incluido en $6
          </span>
        </div>
      </Panel>
    </div>
  );
}

function SpotifyView() {
  const { data } = useMonitorPro();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"daily" | "total">("daily");
  const spotifyTracks = data.spotifyCatalog.items
    .filter((item) => item.type === "track")
    .map((item) => ({
      id: item.key,
      title: item.title,
      spotifyUrl: item.spotifyUrl,
      artworkUrl: item.artworkUrl,
      daily: item.dailyStreams ?? 0,
      total: item.totalStreams ?? 0,
    }));
  const spotifyAlbums = data.spotifyCatalog.items
    .filter((item) => item.type === "album")
    .map((item) => ({
      id: item.key,
      title: item.title,
      spotifyUrl: item.spotifyUrl,
      artworkUrl: item.artworkUrl,
      daily: item.dailyStreams ?? 0,
      total: item.totalStreams ?? 0,
    }));
  const spotifyCatalog = {
    trackCount: data.spotifyCatalog.trackCount,
    albumCount: data.spotifyCatalog.albumCount,
    trackDaily: data.spotifyCatalog.trackDailyStreams,
    albumDaily: data.spotifyCatalog.albumDailyStreams,
    trackTotal: data.spotifyCatalog.trackTotalStreams,
    albumTotal: data.spotifyCatalog.albumTotalStreams,
  };
  const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
  const visibleTracks = spotifyTracks
    .filter((item) =>
      normalizedQuery
        ? item.title.toLocaleLowerCase("es-MX").includes(normalizedQuery)
        : true,
    )
    .sort((a, b) => b[sortBy] - a[sortBy]);
  const heroAlbums = spotifyAlbums.slice(0, 4);
  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden border-[#1ed760]/25 bg-[radial-gradient(circle_at_82%_18%,rgba(30,215,96,.2),transparent_35%),radial-gradient(circle_at_12%_0%,rgba(57,255,20,.08),transparent_32%)]">
        <div className="grid lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative z-10 p-6 sm:p-9">
            <div className="flex items-center gap-4">
              {data.subscription.artistImageUrl ? (
                <img
                  src={data.subscription.artistImageUrl}
                  alt={data.subscription.artistName}
                  className="h-16 w-16 rounded-2xl border border-white/15 object-cover shadow-2xl"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-[#1ed760]/10">
                  <Disc3 className="h-7 w-7 text-[#1ed760]" />
                </span>
              )}
              <div>
                <Kicker>Spotify completo</Kicker>
                <p className="mt-1 text-sm font-black text-white/55">
                  {data.subscription.artistName}
                </p>
              </div>
            </div>
            <h2 className="mt-8 max-w-xl text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">
              Todas las canciones y todos los álbumes
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/42">
              Streams diarios y acumulados de cada lanzamiento registrado en
              Spotify
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#1ed760]/25 bg-[#1ed760]/10 px-4 py-2 text-[9px] font-black uppercase tracking-[.14em] text-[#39FF14]">
                {spotifyCatalog.trackCount} canciones
              </span>
              <span className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-[9px] font-black uppercase tracking-[.14em] text-white/55">
                {spotifyCatalog.albumCount} álbumes
              </span>
              <span className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-[9px] font-black uppercase tracking-[.14em] text-white/55">
                Corte {dateLabel(data.spotifyCatalog.snapshotDate)}
              </span>
            </div>
          </div>
          <div className="grid min-h-[330px] grid-cols-2 gap-2 p-4 lg:rotate-2 lg:scale-105 lg:p-7">
            {heroAlbums.map((album, index) => (
              <div
                key={album.id}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl ${index % 2 ? "translate-y-5" : "-translate-y-1"}`}
              >
                <SpotifyArtwork
                  src={album.artworkUrl}
                  title={album.title}
                  className="h-full min-h-36"
                />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="truncate text-xs font-black">{album.title}</p>
                  <p className="mt-1 text-[9px] font-black text-[#39FF14]">
                    +{compact(album.daily)} diarios
                  </p>
                </div>
              </div>
            ))}
            {!heroAlbums.length && (
              <div className="col-span-2 grid min-h-[300px] place-items-center rounded-2xl border border-white/[.07] text-center text-sm text-white/35">
                Portadas de álbumes todavía no disponibles.
              </div>
            )}
          </div>
        </div>
        <div className="grid border-t border-white/[.07] sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Canciones · diario",
              compact(spotifyCatalog.trackDaily),
              `${spotifyCatalog.trackCount} canciones`,
            ],
            [
              "Canciones · acumulado",
              compact(spotifyCatalog.trackTotal),
              "catálogo registrado",
            ],
            [
              "Álbumes · diario",
              compact(spotifyCatalog.albumDaily),
              `${spotifyCatalog.albumCount} álbumes`,
            ],
            [
              "Álbumes · acumulado",
              compact(spotifyCatalog.albumTotal),
              "álbumes registrados",
            ],
          ].map(([label, value, detail]) => (
            <div
              key={label}
              className="border-b border-white/[.07] bg-black/25 p-5 last:border-b-0 sm:border-r xl:border-b-0 xl:last:border-r-0"
            >
              <p className="text-[8px] font-black uppercase tracking-[.15em] text-white/30">
                {label}
              </p>
              <p className="mt-3 text-3xl font-black">{value}</p>
              <p className="mt-1 text-[9px] text-white/25">{detail}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="p-6 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Kicker>Historial diario de Kworb</Kicker>
            <h3 className="mt-2 text-2xl font-black">
              Streams diarios de Spotify
            </h3>
          </div>
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/25">
            {data.spotifyCatalog.history.length} lecturas reales
          </p>
        </div>
        <div className="mt-6 h-64">
          {data.spotifyCatalog.history.filter(
            (point) => point.dailyStreams != null,
          ).length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.spotifyCatalog.history.filter(
                  (point) => point.dailyStreams != null,
                )}
              >
                <defs>
                  <linearGradient
                    id="monitor-spotify-daily"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#1ed760" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#1ed760" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(255,255,255,.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }}
                  tickFormatter={compact}
                  width={54}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 12,
                  }}
                  formatter={(value) => exact(Number(value))}
                />
                <Area
                  type="monotone"
                  dataKey="dailyStreams"
                  stroke="#1ed760"
                  strokeWidth={3}
                  fill="url(#monitor-spotify-daily)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center rounded-2xl border border-white/[.06] text-xs font-bold text-white/25">
              El historial diario todavía no está disponible para este artista.
            </div>
          )}
        </div>
      </Panel>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-white/[.07] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <Kicker>Discografía</Kicker>
            <h3 className="mt-2 text-2xl font-black">
              Los {spotifyAlbums.length} álbumes
            </h3>
          </div>
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/25">
            Todos los registros disponibles
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 2xl:grid-cols-4">
          {spotifyAlbums.map((album, index) => (
            <a
              key={album.id}
              href={album.spotifyUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.025] transition hover:-translate-y-1 hover:border-[#1ed760]/30 hover:bg-[#1ed760]/[.04]"
            >
              <SpotifyArtwork
                src={album.artworkUrl}
                title={album.title}
                className="aspect-square"
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-[#39FF14]">
                      #{index + 1}
                    </p>
                    <p className="mt-1 truncate text-sm font-black">
                      {album.title}
                    </p>
                  </div>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1ed760] text-black opacity-0 transition group-hover:opacity-100">
                    <Play className="h-3.5 w-3.5 fill-current" />
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[.06] pt-3">
                  <div>
                    <p className="text-[8px] uppercase tracking-[.1em] text-white/25">
                      Diarios
                    </p>
                    <p className="mt-1 text-sm font-black text-[#39FF14]">
                      +{compact(album.daily)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-[.1em] text-white/25">
                      Total
                    </p>
                    <p className="mt-1 text-sm font-black">
                      {compact(album.total)}
                    </p>
                  </div>
                </div>
              </div>
            </a>
          ))}
          {!spotifyAlbums.length && (
            <div className="col-span-full rounded-2xl border border-white/[.07] p-10 text-center text-sm text-white/35">
              Todavía no hay álbumes con streams guardados para este artista.
            </div>
          )}
        </div>
      </Panel>
      <Panel className="overflow-hidden">
        <div className="border-b border-white/[.07] p-6 sm:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Kicker>Catálogo completo</Kicker>
              <h3 className="mt-2 text-2xl font-black">
                {visibleTracks.length} de {spotifyTracks.length} canciones
              </h3>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex min-w-72 items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-4 py-3">
                <Search className="h-4 w-4 text-white/30" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar una canción"
                  className="w-full bg-transparent text-xs font-bold text-white outline-none placeholder:text-white/20"
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-4 py-3">
                <SlidersHorizontal className="h-4 w-4 text-white/30" />
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as "daily" | "total")
                  }
                  className="bg-transparent text-xs font-bold text-white outline-none"
                >
                  <option value="daily">Streams diarios</option>
                  <option value="total">Streams acumulados</option>
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="grid lg:grid-cols-2">
          {visibleTracks.map((track, index) => (
            <a
              key={track.id}
              href={track.spotifyUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="group grid grid-cols-[34px_58px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[.055] px-4 py-3 transition hover:bg-[#1ed760]/[.045] lg:odd:border-r"
            >
              <span className="text-center text-[9px] font-black text-white/22">
                {String(index + 1).padStart(3, "0")}
              </span>
              <SpotifyArtwork
                src={track.artworkUrl}
                title={track.title}
                className="aspect-square rounded-xl border border-white/[.08]"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-black transition group-hover:text-[#39FF14]">
                  {track.title}
                </p>
                <p className="mt-1 text-[9px] text-white/25">
                  {compact(track.total)} streams acumulados
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-[#39FF14]">
                  +{compact(track.daily)}
                </p>
                <p className="text-[8px] uppercase tracking-[.1em] text-white/22">
                  diarios
                </p>
              </div>
            </a>
          ))}
          {!visibleTracks.length && (
            <div className="p-10 text-center text-sm text-white/35 lg:col-span-2">
              Todavía no hay canciones con streams guardados para este artista.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function VideosView() {
  const { data } = useMonitorPro();
  const videos = data.liveVideos
    .map((video) => {
      const views = Number(video.view_count ?? 0);
      const milestone = nextMilestone(views);
      return {
        id: video.video_id,
        title: video.title,
        image: video.thumbnail_url,
        url: video.canonical_url,
        views,
        delta: Number(video.view_delta ?? 0),
        secondsSincePrevious: Number(video.seconds_since_previous ?? 0),
        observedAt: video.observed_at,
        milestone,
        progress: milestone
          ? Math.min(100, Number(((views / milestone) * 100).toFixed(1)))
          : 0,
      };
    })
    .sort((a, b) => b.views - a.views);
  const totalTrackedViews = videos.reduce(
    (total, video) => total + video.views,
    0,
  );
  const totalLatestGain = videos.reduce(
    (total, video) => total + video.delta,
    0,
  );
  const channelVideoCount = data.youtubeCoverage.channelVideoCount;
  if (!videos.length)
    return (
      <div className="space-y-5">
        <Panel className="relative overflow-hidden border-red-500/20 bg-[radial-gradient(circle_at_84%_10%,rgba(255,35,35,.22),transparent_33%),radial-gradient(circle_at_10%_0%,rgba(57,255,20,.08),transparent_30%)] p-6 sm:p-9">
          <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.2em] text-red-300">
            <span className="h-2 w-2 rounded-full bg-red-500/40" />
            YouTube en vivo
          </p>
          <h2 className="mt-8 max-w-xl text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">
            YouTube en vivo, video por video
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/42">
            Todavía no hay videos verificados con contador para{" "}
            {data.subscription.artistName}. La estructura del Monitor está lista
            y mostrará únicamente observaciones reales.
          </p>
        </Panel>
        <Panel className="p-10 text-center text-sm text-white/35">
          Cobertura observada: {data.youtubeCoverage.observedVideoCount}
          {channelVideoCount == null ? "" : ` de ${channelVideoCount}`} videos.
        </Panel>
      </div>
    );
  return (
    <div className="space-y-5">
      <Panel className="relative overflow-hidden border-red-500/20 bg-[radial-gradient(circle_at_84%_10%,rgba(255,35,35,.22),transparent_33%),radial-gradient(circle_at_10%_0%,rgba(57,255,20,.08),transparent_30%)]">
        <div className="grid lg:grid-cols-[1.05fr_.95fr]">
          <div className="relative z-10 p-6 sm:p-9">
            <div className="flex items-center gap-4">
              {data.subscription.artistImageUrl ? (
                <img
                  src={data.subscription.artistImageUrl}
                  alt={data.subscription.artistName}
                  className="h-16 w-16 rounded-2xl border border-white/15 object-cover shadow-2xl"
                />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-red-500/10">
                  <Youtube className="h-7 w-7 text-red-300" />
                </span>
              )}
              <div>
                <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.2em] text-red-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  YouTube en vivo
                </p>
                <p className="mt-1 text-sm font-black text-white/55">
                  {data.subscription.artistName}
                </p>
              </div>
            </div>
            <h2 className="mt-8 max-w-xl text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">
              YouTube en vivo, video por video
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/42">
              {videos.length} videos únicos tienen conteos exactos guardados
              {channelVideoCount == null
                ? ""
                : ` de los ${channelVideoCount} videos registrados en el canal`}
            </p>
            <div className="mt-7 grid max-w-xl grid-cols-3 gap-2">
              {[
                [
                  compact(totalTrackedViews),
                  "vistas monitoreadas · Fuente: YouTube Data API",
                ],
                [
                  `+${compact(totalLatestGain)}`,
                  "últimas lecturas · Cálculo de Mexico Charts",
                ],
                [
                  channelVideoCount == null
                    ? `${videos.length}/—`
                    : `${videos.length}/${channelVideoCount}`,
                  "cobertura en vivo",
                ],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-black/35 p-4"
                >
                  <p className="text-xl font-black sm:text-2xl">{value}</p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-[.11em] text-white/27">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-h-[340px] overflow-hidden border-t border-white/[.07] lg:border-l lg:border-t-0">
            <img
              src={videos[0].image ?? undefined}
              alt={`Miniatura de ${videos[0].title}`}
              className="absolute inset-0 h-full w-full scale-105 object-cover blur-[1px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-2xl shadow-red-950/50">
                <Play className="ml-1 h-5 w-5 fill-current" />
              </span>
              <p className="mt-5 text-[9px] font-black uppercase tracking-[.16em] text-red-300">
                Video con más vistas
              </p>
              <p className="mt-2 line-clamp-2 text-2xl font-black">
                {videos[0].title}
              </p>
              <p className="mt-2 text-3xl font-black tracking-[-.04em]">
                {exact(videos[0].views)}
              </p>
            </div>
          </div>
        </div>
      </Panel>
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/[.07] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-7">
          <div>
            <Kicker>YouTube con contador activo</Kicker>
            <h3 className="mt-2 text-2xl font-black">
              Los {videos.length} videos conectados
            </h3>
          </div>
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-white/25">
            Todos los disponibles · sin duplicados
          </p>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6 xl:grid-cols-3">
          {videos.map((video, index) => (
            <a
              key={video.id}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.025] transition hover:-translate-y-1 hover:border-red-400/30 hover:bg-red-500/[.035]"
            >
              <div className="relative overflow-hidden">
                <img
                  src={video.image ?? undefined}
                  alt={`Miniatura de ${video.title}`}
                  loading="lazy"
                  className="aspect-video w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/75 px-3 py-1.5 text-[8px] font-black backdrop-blur">
                  #{String(index + 1).padStart(2, "0")}
                </span>
                <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-red-500 text-white shadow-lg">
                  <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                </span>
              </div>
              <div className="p-5">
                <p className="line-clamp-2 min-h-10 text-sm font-black leading-5 transition group-hover:text-red-200">
                  {video.title}
                </p>
                <p className="mt-4 text-2xl font-black tracking-[-.035em]">
                  {exact(video.views)}
                </p>
                <p className="text-[8px] font-black uppercase tracking-[.11em] text-white/25">
                  vistas totales · Fuente: YouTube Data API
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[.06] pt-4">
                  <div>
                    <p className="text-[8px] uppercase tracking-[.1em] text-white/25">
                      Última lectura
                    </p>
                    <p className="mt-1 text-sm font-black text-[#39FF14]">
                      +{exact(video.delta)}
                    </p>
                    <p className="text-[8px] text-white/20">
                      en {intervalLabel(video.secondsSincePrevious)} · Cálculo
                      de Mexico Charts
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] uppercase tracking-[.1em] text-white/25">
                      Próximo hito
                    </p>
                    <p className="mt-1 text-sm font-black">
                      {compact(video.milestone)}
                    </p>
                    <p className="text-[8px] text-white/20">
                      {video.progress}% completado
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[8px] text-white/20">
                  Lectura{" "}
                  {video.observedAt
                    ? new Date(video.observedAt).toLocaleString("es-MX")
                    : "sin hora disponible"}
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[.07]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-600 to-[#39FF14]"
                    style={{ width: `${video.progress}%` }}
                  />
                </div>
              </div>
            </a>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function MarketsView() {
  const { data } = useMonitorPro();
  const cities = data.topMexicoCities;
  const closestToPeak =
    cities
      .filter((city) => city.peakListeners && city.peakListeners > 0)
      .sort(
        (a, b) =>
          (a.peakListeners! - a.currentListeners) / a.peakListeners! -
          (b.peakListeners! - b.currentListeners) / b.peakListeners!,
      )[0] ?? null;
  const combined = cities.reduce((sum, city) => sum + city.currentListeners, 0);
  const concentration =
    combined > 0 && cities[0]
      ? (cities[0].currentListeners / combined) * 100
      : null;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <Panel className="p-6 sm:p-7">
        <Kicker>Audiencia de Spotify en México</Kicker>
        <h2 className="mt-2 text-3xl font-black">Mercados principales</h2>
        <div className="mt-7 space-y-5">
          {cities.map((market, index) => {
            const {
              name: city,
              region,
              currentListeners: current,
              peakListeners: peak,
            } = market;
            const gap =
              peak && peak > 0 ? Math.round((1 - current / peak) * 100) : null;
            return (
              <div key={city}>
                <div className="flex items-end justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-black text-[#39FF14]">
                      0{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-black">{city}</p>
                      <p className="text-[8px] uppercase tracking-[.12em] text-white/25">
                        {region ?? market.countryCode}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black">{exact(current)}</p>
                    <p className="text-[8px] text-red-400">
                      {gap == null
                        ? "pico no disponible"
                        : `${gap}% bajo su pico`}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.06]">
                  <div
                    className="h-full rounded-full bg-[#39FF14]"
                    style={{
                      width: `${Math.max(12, (current / Math.max(1, cities[0]?.currentListeners ?? 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
          {!cities.length && (
            <div className="rounded-2xl border border-white/[.07] p-10 text-center text-sm text-white/35">
              Los mercados todavía no están disponibles para este artista.
            </div>
          )}
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel className="p-6">
          <Kicker>Mercado más cerca de su pico</Kicker>
          <h3 className="mt-3 text-2xl font-black">
            {closestToPeak?.name ?? "Datos en recopilación"}
          </h3>
          <p className="mt-3 text-xs leading-6 text-white/40">
            {closestToPeak?.peakListeners
              ? `Registra ${compact(closestToPeak.currentListeners)} oyentes y está ${Math.round((1 - closestToPeak.currentListeners / closestToPeak.peakListeners) * 100)}% por debajo de su máximo observado.`
              : "No existe un pico histórico real suficiente para calcular esta comparación."}
          </p>
        </Panel>
        <Panel className="p-6">
          <Kicker>Top 5 México</Kicker>
          <p className="mt-4 text-5xl font-black">{compact(combined)}</p>
          <p className="mt-2 text-xs text-white/35">
            oyentes mensuales combinados
          </p>
          <div className="mt-5 rounded-xl border border-white/[.07] p-4">
            <p className="text-[8px] uppercase tracking-[.14em] text-white/25">
              Concentración
            </p>
            <p className="mt-2 text-sm font-black">
              {concentration == null || !cities[0]
                ? "Datos no disponibles"
                : `${cities[0].name} representa ${concentration.toFixed(1)}% del Top ${cities.length}`}
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function CompareView() {
  const { data } = useMonitorPro();
  const current = data.current;
  const spotify30 =
    data.growth.spotifyMonthlyListeners?.days30?.absolute ?? null;
  const youtube30 = data.growth.youtubeChannelViews?.days30?.absolute ?? null;
  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden">
        <div className="p-6 sm:p-7">
          <Kicker>Comparación de artistas</Kicker>
          <h2 className="mt-2 text-3xl font-black">
            {data.subscription.artistName} vs referentes de Mexico Charts
          </h2>
          <p className="mt-2 text-xs text-white/35">
            Datos de {dateLabel(current?.date)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-y border-white/[.07] text-[8px] font-black uppercase tracking-[.14em] text-white/25">
              <tr>
                <th className="px-6 py-3">Artista</th>
                <th className="px-4 py-3">Oyentes</th>
                <th className="px-4 py-3">Spotify 30d</th>
                <th className="px-4 py-3">YouTube 30d</th>
                <th className="px-4 py-3">Instagram</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  name: data.subscription.artistName,
                  image: data.subscription.artistImageUrl,
                  listeners: current?.spotifyMonthlyListeners ?? null,
                  spotify30,
                  youtube30,
                  instagram: current?.instagramFollowers ?? null,
                },
                ...data.comparisonArtists.map((artist) => ({
                  name: artist.artistName,
                  image: artist.artistImageUrl,
                  listeners: artist.spotifyMonthlyListeners,
                  spotify30: artist.spotifyGrowth30?.absolute ?? null,
                  youtube30: artist.youtubeGrowth30?.absolute ?? null,
                  instagram: artist.instagramFollowers,
                })),
              ].map((row, index) => (
                <tr
                  key={row.name}
                  className="border-b border-white/[.06] last:border-0"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      {row.image ? (
                        <img
                          src={row.image}
                          alt={row.name}
                          className="h-11 w-11 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10">
                          <Users className="h-4 w-4 text-white/30" />
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-black">{row.name}</p>
                        <p className="text-[8px] text-white/25">
                          {index === 0
                            ? "Artista monitoreado"
                            : `#${index + 1} por oyentes`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-sm font-black">
                    {compact(row.listeners)}
                  </td>
                  <td
                    className={`px-4 py-5 text-sm font-black ${(row.spotify30 ?? 0) >= 0 ? "text-[#39FF14]" : "text-red-400"}`}
                  >
                    {signed(row.spotify30)}
                  </td>
                  <td className="px-4 py-5 text-sm font-black text-[#39FF14]">
                    {signed(row.youtube30)}
                  </td>
                  <td className="px-4 py-5 text-sm font-black">
                    {compact(row.instagram)}
                  </td>
                </tr>
              ))}
              {!data.comparisonArtists.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-white/35"
                  >
                    Todavía no existen referentes con métricas reales
                    comparables. No se muestran cifras de demostración.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <section className="grid gap-4 lg:grid-cols-3">
        {[
          [
            "Oyentes",
            compact(current?.spotifyMonthlyListeners),
            "Valor actual del artista monitoreado",
          ],
          [
            "YouTube 30d",
            signed(youtube30),
            youtube30 == null
              ? "Ventana de 30 días todavía no disponible"
              : "Cambio real durante la ventana guardada",
          ],
          [
            "Spotify 30d",
            signed(spotify30),
            spotify30 == null
              ? "Ventana de 30 días todavía no disponible"
              : "Cambio real durante la ventana guardada",
          ],
        ].map(([label, value, body]) => (
          <Panel key={label} className="p-6">
            <Kicker>{label}</Kicker>
            <p className="mt-3 text-4xl font-black">{value}</p>
            <p className="mt-3 text-xs leading-6 text-white/40">{body}</p>
          </Panel>
        ))}
      </section>
    </div>
  );
}

function AlertsView() {
  const { data } = useMonitorPro();
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Panel className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <Kicker>Reglas del artista</Kicker>
            <h2 className="mt-2 text-3xl font-black">Alertas configurables</h2>
          </div>
          <Settings2 className="h-5 w-5 text-white/25" />
        </div>
        <div className="mt-6 space-y-3">
          {[
            [
              "YouTube alcanza un cambio definido",
              "Configuración pendiente",
              false,
            ],
            [
              "Oyentes Spotify cruzan un umbral",
              "Configuración pendiente",
              false,
            ],
            [
              "Instagram cambia ±1% en 7 días",
              "Configuración pendiente",
              false,
            ],
            [
              "Un video de YouTube alcanza un nuevo hito",
              "Configuración pendiente",
              false,
            ],
          ].map(([label, status, on]) => (
            <div
              key={String(label)}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[.07] bg-black/20 p-4"
            >
              <div>
                <p className="text-xs font-black">{label}</p>
                <p
                  className={`mt-1 text-[8px] font-black uppercase tracking-[.12em] ${on ? "text-[#39FF14]" : "text-white/25"}`}
                >
                  {status}
                </p>
              </div>
              <BellRing
                className={`h-4 w-4 ${on ? "text-[#39FF14]" : "text-white/20"}`}
              />
            </div>
          ))}
        </div>
        <button
          disabled
          className="mt-5 rounded-xl border border-white/10 px-4 py-3 text-[9px] font-black uppercase tracking-[.15em] text-white/25"
        >
          Configuración persistente aún no disponible
        </button>
      </Panel>
      <div className="space-y-4">
        <Panel className="p-6">
          <Kicker>Notificaciones</Kicker>
          {[
            ["Alertas por email", false],
            ["Reporte semanal", false],
          ].map(([label, on]) => (
            <button
              key={String(label)}
              disabled
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/[.07] p-4 text-left opacity-55"
            >
              <span className="text-xs font-black">{String(label)}</span>
              <span
                className={`h-5 w-9 rounded-full p-0.5 ${on ? "bg-[#39FF14]" : "bg-white/10"}`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-black transition ${on ? "translate-x-4" : ""}`}
                />
              </span>
            </button>
          ))}
        </Panel>
        <Panel className="p-6">
          <Kicker>Actividad reciente</Kicker>
          <div className="mt-4 space-y-4">
            {(data.dailyPulse.signals.length
              ? data.dailyPulse.signals.map((signal) => [
                  dateLabel(data.dailyPulse.currentDate),
                  signal.title,
                ])
              : [
                  [
                    dateLabel(data.dailyPulse.currentDate),
                    "Sin cambios materiales en la lectura más reciente",
                  ],
                ]
            ).map(([time, event]) => (
              <div key={event} className="border-l border-[#39FF14]/30 pl-4">
                <p className="text-[8px] text-white/25">{time}</p>
                <p className="mt-1 text-xs font-black">{event}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

const viewReadStages: Record<View, string[]> = {
  resumen: [
    "priority_daily_snapshots",
    "priority_artist_identity",
    "extended_artist_data",
  ],
  tendencias: [
    "priority_daily_snapshots",
    "extended_artist_data",
    "compact_history_overview",
  ],
  spotify: [
    "priority_stream_items",
    "complete_kworb_catalog",
    "priority_stored_track_artwork",
  ],
  videos: [
    "priority_youtube_live_videos",
    "youtube_coverage",
    "youtube_live_history",
  ],
  mercados: ["extended_artist_data"],
  comparar: ["priority_comparisons", "extended_artist_data"],
  alertas: ["priority_daily_snapshots", "extended_artist_data"],
  reportes: [],
};

function hasReadFailure(view: View, data: MonitorDashboardData) {
  const stages = viewReadStages[view];
  return stages.some(
    (stage) =>
      data.sectionStatus?.[stage] && data.sectionStatus[stage] !== "loaded",
  );
}

function ReadFailureNotice({
  view,
  data,
}: {
  view: View;
  data: MonitorDashboardData;
}) {
  const { onReload, refreshing } = useMonitorPro();
  if (!hasReadFailure(view, data)) return null;
  return (
    <Panel className="p-6">
      <div role="alert">
        <h2 className="text-xl font-black">
          No se pudo cargar esta sección completa
        </h2>
        <p className="mt-3 text-sm text-white/60">
          La consulta no terminó correctamente. Esto no significa que el artista
          no tenga datos.
        </p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-[#39FF14] px-4 py-3 text-sm font-black text-black"
          disabled={refreshing}
          onClick={onReload}
        >
          {refreshing ? "Consultando…" : "Volver a cargar"}
        </button>
      </div>
    </Panel>
  );
}

function ReportsView() {
  const { data, onDownloadReport, reportLoading, reportError } =
    useMonitorPro();
  // Only the latest complete payload is available for report generation.
  // Older audience points alone do not establish historical catalog/market cuts.
  const availableMonths = data.history.at(-1)?.date
    ? [data.history.at(-1)!.date]
    : [];
  const [month, setMonth] = useState(availableMonths[0] ?? "");
  const changes =
    data.dailyPulse.signals
      .slice(0, 2)
      .map((signal) => signal.title)
      .join(" · ") || "Sin cambios materiales en la lectura más reciente";
  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden border-[#39FF14]/20 bg-[radial-gradient(circle_at_80%_20%,rgba(57,255,20,.13),transparent_36%)] p-6 sm:p-9">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Kicker>
              Reporte semanal · corte {month || "historial no disponible"}
            </Kicker>
            <h2 className="mt-3 max-w-2xl text-4xl font-black tracking-[-.045em]">
              Reporte semanal de rendimiento
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">
              Resumen ejecutivo, historial disponible, catálogo completo de
              Spotify, YouTube y mercados observados
            </p>
            <p className="mt-3 text-[9px] font-bold leading-5 text-white/30">
              PDF semanal de ocho páginas · envío por correo y exportación CSV
              pendientes de implementación
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!month || reportLoading}
                onClick={() => void onDownloadReport(month)}
                className="flex items-center gap-2 rounded-xl bg-[#39FF14] px-5 py-3.5 text-[9px] font-black uppercase tracking-[.15em] text-black"
              >
                <FileText className="h-4 w-4" />
                {reportLoading ? "Generando…" : "Descargar PDF"}
              </button>
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="rounded-xl border border-white/10 bg-black/40 px-5 py-3.5 text-[9px] font-black uppercase tracking-[.12em] text-white/65"
              >
                {availableMonths.length ? (
                  availableMonths.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))
                ) : (
                  <option value="">Sin cortes disponibles</option>
                )}
              </select>
            </div>
            {reportError && (
              <p className="mt-3 text-xs font-bold text-red-400">
                {reportError}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              [String(data.history.length), "lecturas"],
              [String(data.spotifyCatalog.items.length), "Spotify"],
              [String(data.liveVideos.length), "videos"],
              [String(data.topMexicoCities.length), "mercados"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="min-w-28 rounded-xl border border-white/[.07] bg-black/30 p-4"
              >
                <p className="text-2xl font-black">{value}</p>
                <p className="text-[8px] uppercase tracking-[.12em] text-white/25">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <section className="grid gap-4 lg:grid-cols-3">
        {[
          ["Cambios", changes],
          ["Análisis", data.dailyPulse.summary],
          [
            "Recomendaciones",
            data.latestReleaseImpact
              ? `Revisar el impacto real de ${data.latestReleaseImpact.release.title}`
              : "La recomendación se generará cuando exista evidencia suficiente",
          ],
        ].map(([title, body], index) => (
          <Panel key={title} className="p-6">
            <span className="text-[9px] font-black text-[#39FF14]">
              0{index + 1}
            </span>
            <h3 className="mt-3 text-xl font-black">{title}</h3>
            <p className="mt-3 text-xs leading-6 text-white/40">{body}</p>
          </Panel>
        ))}
      </section>
      <Panel className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <Kicker>Reportes anteriores</Kicker>
            <h3 className="mt-2 text-2xl font-black">Cortes semanales</h3>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[.13em] text-white/30">
            {availableMonths.length} disponibles
          </span>
        </div>
        <div className="mt-6 overflow-hidden rounded-xl border border-white/[.07]">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#39FF14]/10">
                <FileText className="h-5 w-5 text-[#39FF14]" />
              </span>
              <div>
                <p className="text-sm font-black">
                  {month ? `Reporte de ${month}` : "Historial en recopilación"}
                </p>
                <p className="mt-1 text-[9px] text-white/30">
                  PDF semanal con datos reales. Los cortes anteriores requieren
                  catálogos y mercados históricos completos.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!month || reportLoading}
              onClick={() => void onDownloadReport(month)}
              className="text-[9px] font-black uppercase tracking-[.15em] text-[#39FF14]"
            >
              Descargar <ChevronRight className="ml-1 inline h-3 w-3" />
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default function MonitorProExperience(props: MonitorProContextValue) {
  const { data, internalArtistCatalog, onArtistChange } = props;
  const [view, setView] = useState<View>("resumen");
  const [metric, setMetric] = useState<TrendKey>("spotify");
  const navItems: Array<{
    key: View;
    label: string;
    icon: typeof Activity;
    note?: string;
  }> = [
    { key: "resumen", label: "Panel", icon: LayoutDashboard },
    { key: "tendencias", label: "Tendencias", icon: BarChart3 },
    {
      key: "spotify",
      label: "Spotify",
      icon: Music2,
      note: String(data.spotifyCatalog.items.length),
    },
    {
      key: "videos",
      label: "YouTube",
      icon: Video,
      note: String(data.liveVideos.length),
    },
    { key: "mercados", label: "Mercados", icon: MapPin },
    { key: "comparar", label: "Comparar", icon: Radar },
    {
      key: "alertas",
      label: "Alertas",
      icon: BellRing,
      note: String(data.dailyPulse.signals.length),
    },
    {
      key: "reportes",
      label: "Reportes",
      icon: FileText,
      note: data.history.length ? "Nuevo" : undefined,
    },
  ];
  const label = navItems.find((item) => item.key === view)?.label ?? "Panel";
  return (
    <MonitorProContext.Provider value={props}>
      <div className="min-h-screen bg-[#050505] text-white">
        <PageSEO
          title={`Monitor Pro de ${data.subscription.artistName} — Mexico Charts`}
          description={`Monitor Pro privado de ${data.subscription.artistName}.`}
          path={`/monitoreo/${encodeURIComponent(data.subscription.artistKey)}`}
          noindex
        />
        <SiteNav />
        {data.subscription.accessSource === "internal" && data.identityDiagnostics?.conflict && (
          <div role="alert" className="mx-auto max-w-[1500px] border border-amber-400/30 bg-amber-400/5 px-5 py-4 text-sm text-amber-100">
            Conflicto de identidad: este perfil muestra únicamente datos bajo su ID exacto. Revisa los identificadores en el directorio antes de combinar fuentes o habilitar el acceso público.
          </div>
        )}
        <div className="border-b border-white/[.07] bg-[#080808]">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#39FF14] px-2.5 py-1 text-[8px] font-black uppercase tracking-[.14em] text-black">
                Monitor Pro
              </span>
              <span className="hidden text-[9px] font-bold text-white/30 sm:inline">
                Producto privado · datos reales
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[8px] font-black uppercase tracking-[.14em] text-white/25">
                {data.subscription.accessSource === "internal"
                  ? "Acceso interno autorizado"
                  : "Monitoreo activo"}
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-[9px] font-black">
                {data.subscription.artistName
                  .split(/\s+/)
                  .map((word) => word[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        <div className="mx-auto grid min-w-0 max-w-[1500px] lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="min-w-0 border-r border-white/[.07] bg-[#070707] p-4 lg:min-h-[calc(100vh-112px)] lg:p-5">
            <div className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3">
              {data.subscription.artistImageUrl ? (
                <img
                  src={data.subscription.artistImageUrl}
                  alt={data.subscription.artistName}
                  className="h-11 w-11 rounded-xl object-cover"
                />
              ) : (
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#39FF14]/10">
                  <Music2 className="h-5 w-5 text-[#39FF14]" />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black">
                  {data.subscription.artistName}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-[.12em] text-[#39FF14]">
                  <CheckCircle2 className="h-3 w-3" />
                  Monitor activo
                </p>
              </div>
            </div>
            {data.subscription.accessSource === "internal" && (
              <Link
                href="/monitoreo/founder"
                className="mt-3 flex items-center gap-2 rounded-xl border border-[#39FF14]/20 px-3 py-3 text-[9px] font-black uppercase tracking-[.12em] text-[#39FF14]"
              >
                <Users className="h-4 w-4" /> Directorio del fundador
              </Link>
            )}
            {data.subscription.accessSource === "internal" &&
            internalArtistCatalog?.artists.length ? (
              <label className="mt-3 block rounded-xl border border-white/[.07] bg-black/30 p-3">
                <span className="block text-[8px] font-black uppercase tracking-[.14em] text-[#39FF14]">
                  Cambiar artista
                </span>
                <select
                  value={data.subscription.artistKey}
                  onChange={(event) => onArtistChange?.(event.target.value)}
                  className="mt-2 w-full bg-transparent text-xs font-black text-white outline-none"
                >
                  {internalArtistCatalog.artists.map((artist) => (
                    <option key={artist.artistKey} value={artist.artistKey}>
                      {artist.artistName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <nav className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1 lg:overflow-visible">
              {navItems.map(({ key, label: navLabel, icon: Icon, note }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-[10px] font-black transition lg:w-full ${view === key ? "bg-[#39FF14] text-black" : "text-white/35 hover:bg-white/[.04] hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{navLabel}</span>
                  {note && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[7px] ${view === key ? "bg-black/15" : "bg-white/[.06] text-white/30"}`}
                    >
                      {note}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="mt-5 hidden rounded-2xl border border-white/[.07] bg-black/30 p-4 lg:block">
              <p className="text-[8px] font-black uppercase tracking-[.14em] text-white/25">
                Reportes disponibles
              </p>
              <p className="mt-2 text-xs font-black">
                {
                  new Set(data.history.map((point) => point.date.slice(0, 7)))
                    .size
                }
              </p>
              <p className="mt-1 text-[8px] text-white/25">
                meses con lecturas
              </p>
            </div>
          </aside>
          <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
            <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[.18em] text-white/25">
                  {data.subscription.artistName} / {label}
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-.045em] sm:text-4xl">
                  {label}
                </h1>
                <p className="mt-2 text-xs text-white/30">
                  Datos guardados · {dateLabel(data.current?.date)} · fuentes
                  directas y cálculos etiquetados
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#39FF14]/20 bg-[#39FF14]/[.06] px-3 py-2 text-[8px] font-black uppercase tracking-[.13em] text-[#39FF14]">
                  {data.history.length} lecturas guardadas
                </span>
                {view !== "reportes" && (
                  <button
                    onClick={() => setView("reportes")}
                    className="rounded-full border border-white/10 px-3 py-2 text-[8px] font-black uppercase tracking-[.13em] text-white/45 hover:text-white"
                  >
                    Ver reporte
                  </button>
                )}
              </div>
            </header>
            {props.refreshing && (
              <p role="status" className="mb-4 text-xs text-white/45">
                Actualizando los datos del Monitor…
              </p>
            )}
            <ReadFailureNotice view={view} data={data} />
            {
              <>
                {view === "resumen" && <SummaryView open={setView} />}{" "}
                {view === "tendencias" && (
                  <TrendsView metric={metric} setMetric={setMetric} />
                )}{" "}
                {view === "spotify" && <SpotifyView />}{" "}
                {view === "videos" && <VideosView />}{" "}
                {view === "mercados" && <MarketsView />}{" "}
                {view === "comparar" && <CompareView />}{" "}
                {view === "alertas" && <AlertsView />}{" "}
                {view === "reportes" && <ReportsView />}
              </>
            }
            <footer className="mt-6 flex flex-col gap-2 border-t border-white/[.07] pt-5 text-[8px] leading-5 text-white/25 sm:flex-row sm:justify-between">
              <span>
                Datos de Songstats y YouTube · {dateLabel(data.current?.date)}
              </span>
              <span>Análisis y comparaciones de Mexico Charts</span>
            </footer>
          </main>
        </div>
      </div>
    </MonitorProContext.Provider>
  );
}
