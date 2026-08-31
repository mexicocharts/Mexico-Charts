import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Disc3,
  Download,
  Headphones,
  Instagram,
  LayoutDashboard,
  MapPin,
  Music2,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
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
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { EditorialFooter } from "@/components/EditorialLayout";
import { authenticatedFetch, useMexicoAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import YouTubeLivePublicPreview, {
  type YouTubeLivePreviewVideo,
} from "@/components/YouTubeLivePublicPreview";

const G = "#39FF14";
type MetricKey =
  | "spotifyMonthlyListeners"
  | "spotifyFollowers"
  | "youtubeSubscribers"
  | "youtubeChannelViews"
  | "instagramFollowers"
  | "tiktokFollowers";
type Snapshot = Record<MetricKey, number | null> & {
  date: string;
  spotifyPopularity: number | null;
  facebookFollowers: number | null;
  twitterFollowers: number | null;
  soundcloudFollowers: number | null;
  deezerFollowers: number | null;
};
type DashboardPayload = {
  subscription: {
    artistKey: string;
    artistName: string;
    status: string;
    activatedAt: string;
  };
  current: Snapshot | null;
  history: Snapshot[];
  historySeries: Partial<
    Record<
      MetricKey,
      {
        metricKey: string;
        earliestAvailableDate: string | null;
        latestAvailableDate: string | null;
        points: Array<{
          date: string;
          value: number;
          provenance: {
            provider: string;
            source: string;
            granularity: "daily" | "intraday";
            acquisitionMode:
              | "songstats_historical"
              | "scheduled_current_snapshot"
              | "mexico_charts_direct";
            providerObservationDate: string;
            providerObservationAt: string | null;
            fetchedAt: string;
            identityValidationStatus: "verified" | "review" | "rejected";
          };
          alternatives: Array<unknown>;
        }>;
      }
    >
  >;
  historyCoverage: Partial<
    Record<
      MetricKey,
      {
        earliestAvailableDate: string | null;
        latestAvailableDate: string | null;
        observationCount: number;
        missingDateCount: number;
        missingIntervals: Array<{
          startDate: string;
          endDate: string;
          days: number;
        }>;
        multiYear: null | {
          spanDays: number;
          calendarYearsRepresented: number[];
        };
      }
    >
  >;
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
      MetricKey,
      {
        days7: { absolute: number; percentage: number | null } | null;
        days30: { absolute: number; percentage: number | null } | null;
        days90: { absolute: number; percentage: number | null } | null;
        months6: { absolute: number; percentage: number | null } | null;
        year1: { absolute: number; percentage: number | null } | null;
        yearOverYear: { absolute: number; percentage: number | null } | null;
      }
    >
  >;
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
  spotifyCatalog: {
    snapshotDate: string | null;
    trackCount: number;
    albumCount: number;
    trackDailyStreams: number | null;
    albumDailyStreams: number | null;
    trackTotalStreams: number | null;
    albumTotalStreams: number | null;
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
type View =
  | "resumen"
  | "spotify"
  | "videos"
  | "historial"
  | "catalogo"
  | "audiencia"
  | "reportes";
type HistoryRange = "30d" | "90d" | "all";

function exact(value: number | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat("es-MX").format(value);
}
function compact(value: number | null | undefined) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("es-MX", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
}
function signed(value: number | null | undefined) {
  return value == null ? "—" : `${value >= 0 ? "+" : ""}${compact(value)}`;
}
function dateLabel(value: string | null | undefined) {
  return !value
    ? "—"
    : new Intl.DateTimeFormat("es-MX", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = G,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: typeof Activity;
  accent?: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div
        className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-10 blur-3xl"
        style={{ background: accent }}
      />
      <Icon className="relative h-5 w-5" style={{ color: accent }} />
      <p className="relative mt-6 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <p className="relative mt-2 text-3xl font-black tracking-[-0.04em]">
        {value}
      </p>
      {detail && (
        <p className="relative mt-1 text-[10px] font-semibold text-white/30">
          {detail}
        </p>
      )}
    </article>
  );
}

function HistoryChart({
  data,
}: {
  data: Array<{ date: string; value: number }>;
}) {
  return data.length > 1 ? (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="monitor-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={G} stopOpacity={0.32} />
            <stop offset="100%" stopColor={G} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
          tickFormatter={(value) => String(value).slice(5)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }}
          tickFormatter={compact}
          axisLine={false}
          tickLine={false}
          width={48}
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
          dataKey="value"
          stroke={G}
          strokeWidth={2.5}
          fill="url(#monitor-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  ) : (
    <div className="grid h-full place-items-center text-xs font-bold text-white/25">
      Recopilando la segunda lectura…
    </div>
  );
}

function DailyPulse({ pulse }: { pulse: DashboardPayload["dailyPulse"] }) {
  if (pulse.status === "collecting")
    return (
      <article className="mt-4 overflow-hidden rounded-3xl border border-[#39FF14]/20 bg-[radial-gradient(circle_at_top_right,rgba(57,255,20,.11),transparent_46%)] p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-[#39FF14]/25 bg-[#39FF14]/10">
            <Activity className="h-5 w-5 text-[#39FF14]" />
          </span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#39FF14]">
              Actividad reciente
            </p>
            <h2 className="mt-1 text-2xl font-black">{pulse.headline}</h2>
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-white/45">
          {pulse.summary}
        </p>
      </article>
    );
  return (
    <article className="mt-4 overflow-hidden rounded-3xl border border-[#39FF14]/20 bg-[radial-gradient(circle_at_top_right,rgba(57,255,20,.12),transparent_42%)]">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#39FF14]">
            <Sparkles className="h-4 w-4" />
            Actividad reciente
          </div>
          <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            {pulse.headline}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
            {pulse.summary}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-5 py-4">
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/30">
            Cambios detectados
          </p>
          <p className="mt-1 text-3xl font-black text-[#39FF14]">
            {pulse.metricsChanged}
          </p>
          <p className="mt-1 text-[9px] font-bold text-white/25">
            {dateLabel(pulse.previousDate)} → {dateLabel(pulse.currentDate)}
          </p>
        </div>
      </div>
      <div className="grid border-t border-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
        {pulse.signals.length ? (
          pulse.signals.map((signal, index) => (
            <div
              key={`${signal.kind}-${signal.platform}-${index}`}
              className="border-b border-white/[0.06] p-5 last:border-b-0 sm:border-r lg:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.14em] ${signal.kind === "decline" ? "bg-red-500/10 text-red-400" : signal.kind === "release" ? "bg-violet-500/10 text-violet-300" : "bg-[#39FF14]/10 text-[#39FF14]"}`}
                >
                  {signal.kind === "gain"
                    ? "Ganancia"
                    : signal.kind === "decline"
                      ? "Descenso"
                      : signal.kind === "milestone"
                        ? "Hito"
                        : "Lanzamiento"}
                </span>
                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/25">
                  {signal.platform}
                </span>
              </div>
              <p className="mt-4 text-sm font-black leading-5">
                {signal.title}
              </p>
              {signal.delta != null && (
                <div className="mt-4 flex items-baseline gap-2">
                  <span
                    className={`text-xl font-black ${signal.delta >= 0 ? "text-[#39FF14]" : "text-red-400"}`}
                  >
                    {signed(signal.delta)}
                  </span>
                  {signal.percentage != null && (
                    <span className="text-[9px] font-bold text-white/30">
                      {signal.percentage >= 0 ? "+" : ""}
                      {signal.percentage.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="p-6 text-sm font-bold text-white/30">
            Sin cambios materiales en la lectura más reciente.
          </p>
        )}
      </div>
    </article>
  );
}

function SpotifyCatalog({
  catalog,
}: {
  catalog: DashboardPayload["spotifyCatalog"];
}) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"dailyStreams" | "totalStreams">(
    "dailyStreams",
  );
  const albums = catalog.items
    .filter((item) => item.type === "album")
    .sort(
      (a, b) =>
        Number(b.dailyStreams ?? 0) - Number(a.dailyStreams ?? 0),
    );
  const normalizedQuery = query.trim().toLocaleLowerCase("es-MX");
  const tracks = catalog.items
    .filter(
      (item) =>
        item.type === "track" &&
        (!normalizedQuery ||
          item.title.toLocaleLowerCase("es-MX").includes(normalizedQuery)),
    )
    .sort(
      (a, b) => Number(b[sortBy] ?? 0) - Number(a[sortBy] ?? 0),
    );
  const Artwork = ({
    item,
    className = "",
  }: {
    item: DashboardPayload["spotifyCatalog"]["items"][number];
    className?: string;
  }) => (
    <div
      className={`relative overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(30,215,96,.3),transparent_52%),linear-gradient(145deg,#171717,#050505)] ${className}`}
    >
      {item.artworkUrl ? (
        <img
          src={item.artworkUrl}
          alt={`Portada de ${item.title}`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="grid h-full w-full place-items-center">
          <Disc3 className="h-7 w-7 text-[#1ed760]/70" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
    </div>
  );
  return (
    <section className="mt-7 space-y-5">
      <article className="overflow-hidden rounded-3xl border border-[#1ed760]/25 bg-[radial-gradient(circle_at_82%_10%,rgba(30,215,96,.19),transparent_36%)]">
        <div className="p-6 sm:p-8">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">
          Spotify completo
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
          Todas las canciones y todos los álbumes
        </h2>
        <p className="mt-2 text-xs text-white/35">
          Streams acumulados y diarios · {dateLabel(catalog.snapshotDate)}
        </p>
        </div>
        <div className="grid border-t border-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Canciones · diario",
              compact(catalog.trackDailyStreams),
              `${catalog.trackCount} canciones`,
            ],
            [
              "Canciones · acumulado",
              compact(catalog.trackTotalStreams),
              "catálogo registrado",
            ],
            [
              "Álbumes · diario",
              compact(catalog.albumDailyStreams),
              `${catalog.albumCount} álbumes`,
            ],
            [
              "Álbumes · acumulado",
              compact(catalog.albumTotalStreams),
              "álbumes registrados",
            ],
          ].map(([label, value, detail]) => (
            <div
              key={label}
              className="border-b border-white/[0.07] bg-black/25 p-5 last:border-b-0 sm:border-r lg:border-b-0 lg:last:border-r-0"
            >
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/30">
                {label}
              </p>
              <p className="mt-3 text-3xl font-black">{value}</p>
              <p className="mt-1 text-[9px] text-white/25">{detail}</p>
            </div>
          ))}
        </div>
      </article>
      <article className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-end justify-between border-b border-white/[0.07] p-5 sm:p-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#39FF14]">Discografía</p>
            <h3 className="mt-2 text-2xl font-black">Los {albums.length} álbumes</h3>
          </div>
          <Disc3 className="h-6 w-6 text-[#1ed760]" />
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
          {albums.map((item, index) => (
            <a
              key={item.key}
              href={item.spotifyUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 transition hover:-translate-y-1 hover:border-[#1ed760]/30"
            >
              <Artwork item={item} className="aspect-square" />
              <div className="p-4">
                <p className="text-[8px] font-black text-[#39FF14]">#{index + 1}</p>
                <p className="mt-1 truncate text-sm font-black">{item.title}</p>
                <div className="mt-3 flex items-end justify-between border-t border-white/[0.06] pt-3">
                  <div>
                    <p className="text-[8px] text-white/25">DIARIOS</p>
                    <p className="mt-1 text-sm font-black text-[#39FF14]">{signed(item.dailyStreams)}</p>
                  </div>
                  <p className="text-sm font-black">{compact(item.totalStreams)}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </article>
      <article className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:p-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#39FF14]">Catálogo completo</p>
            <h3 className="mt-2 text-2xl font-black">{tracks.length} canciones</h3>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex min-w-64 items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-4 py-3">
              <Search className="h-4 w-4 text-white/30" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar una canción" className="w-full bg-transparent text-xs font-bold text-white outline-none placeholder:text-white/20" />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-4 py-3">
              <SlidersHorizontal className="h-4 w-4 text-white/30" />
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "dailyStreams" | "totalStreams")} className="bg-transparent text-xs font-bold text-white outline-none">
                <option value="dailyStreams">Streams diarios</option>
                <option value="totalStreams">Streams acumulados</option>
              </select>
            </label>
          </div>
        </div>
        <div className="grid lg:grid-cols-2">
          {tracks.map((item, index) => (
            <a
              key={item.key}
              href={item.spotifyUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="group grid grid-cols-[34px_56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.055] px-4 py-3 transition hover:bg-[#1ed760]/[0.045] lg:odd:border-r"
            >
              <span className="text-center text-[9px] font-black text-white/22">{String(index + 1).padStart(3, "0")}</span>
              <Artwork item={item} className="aspect-square rounded-xl border border-white/[0.08]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-black group-hover:text-[#39FF14]">{item.title}</p>
                <p className="mt-1 text-[9px] text-white/25">{compact(item.totalStreams)} acumulados</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-[#39FF14]">{signed(item.dailyStreams)}</p>
                <p className="text-[8px] text-white/25">diarios</p>
              </div>
            </a>
          ))}
        </div>
      </article>
    </section>
  );
}

export default function MonitoringDashboard() {
  const [, params] = useRoute("/monitoreo/:artistKey");
  const artistKey = decodeURIComponent(params?.artistKey ?? "");
  const auth = useMexicoAuth();
  const { pick } = useLanguage();
  const [view, setView] = useState<View>("resumen");
  const [metric, setMetric] = useState<MetricKey>("spotifyMonthlyListeners");
  const [historyRange, setHistoryRange] = useState<HistoryRange>("30d");
  const [reportMonth, setReportMonth] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const { data, isLoading, error } = useQuery<DashboardPayload>({
    queryKey: ["monitoring-dashboard", auth.userId, artistKey],
    enabled: auth.configured && auth.isSignedIn && Boolean(artistKey),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const response = await authenticatedFetch(
        auth.getToken,
        `/api/monitoring/dashboard/${encodeURIComponent(artistKey)}`,
      );
      const payload = (await response.json()) as DashboardPayload & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || "Unable to load monitoring dashboard");
      return payload;
    },
  });
  const availableMonths = useMemo(
    () =>
      [
        ...new Set(
          (data?.history ?? []).map((point) => point.date.slice(0, 7)),
        ),
      ].reverse(),
    [data?.history],
  );
  const selectedMonth =
    reportMonth || availableMonths[0] || new Date().toISOString().slice(0, 7);
  const selectedHistorySeries = useMemo(
    () =>
      data?.historySeries?.[metric]?.points ??
      (data?.history ?? []).flatMap((point) =>
        point[metric] == null
          ? []
          : [{ date: point.date, value: point[metric]!, provenance: null, alternatives: [] }],
      ),
    [data?.history, data?.historySeries, metric],
  );
  const rangedHistory = useMemo(() => {
    if (historyRange === "all" || !selectedHistorySeries.length) return selectedHistorySeries;
    const cutoff = new Date(`${selectedHistorySeries.at(-1)!.date}T12:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - (historyRange === "30d" ? 29 : 89));
    const cutoffDate = cutoff.toISOString().slice(0, 10);
    return selectedHistorySeries.filter((point) => point.date >= cutoffDate);
  }, [historyRange, selectedHistorySeries]);
  const chartData = useMemo(
    () => rangedHistory.map((point) => ({ date: point.date, value: point.value })),
    [rangedHistory],
  );
  const selectedHistoryCoverage = data?.historyCoverage?.[metric];
  const current = data?.current;
  const growth30 = data?.growth?.spotifyMonthlyListeners?.days30;
  const activeVideoId = selectedVideoId || data?.liveVideos[0]?.video_id || "";
  const activeVideo =
    data?.liveVideos.find((video) => video.video_id === activeVideoId) ?? null;
  const videoHistory = useMemo(
    () =>
      (data?.liveVideoHistory ?? [])
        .filter(
          (point) =>
            point.video_id === activeVideoId && point.daily_view_delta != null,
        )
        .map((point) => ({
          date: point.snapshot_date,
          value: Number(point.daily_view_delta),
        })),
    [activeVideoId, data?.liveVideoHistory],
  );
  const videoPulse = useMemo(() => {
    const videos = data?.liveVideos ?? [];
    const totalToday = videos.reduce(
      (sum, video) =>
        sum + (video.views_today_et == null ? 0 : Number(video.views_today_et)),
      0,
    );
    const totalLastDay = videos.reduce(
      (sum, video) =>
        sum + (video.views_24h == null ? 0 : Number(video.views_24h)),
      0,
    );
    const leader =
      [...videos].sort(
        (a, b) =>
          Number(b.views_today_et ?? -1) - Number(a.views_today_et ?? -1),
      )[0] ?? null;
    return { totalToday, totalLastDay, leader };
  }, [data?.liveVideos]);

  async function downloadReport() {
    setReportLoading(true);
    setReportError("");
    try {
      const response = await authenticatedFetch(
        auth.getToken,
        `/api/monitoring/report/${encodeURIComponent(artistKey)}?month=${encodeURIComponent(selectedMonth)}`,
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
        `mexico-charts-${artistKey}-${selectedMonth}.csv`;
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
  const tabs: Array<{ id: View; label: string }> = [
    { id: "resumen", label: pick("Panel", "Dashboard") },
    { id: "spotify", label: "Spotify" },
    { id: "videos", label: pick("YouTube en vivo", "Live YouTube") },
    { id: "historial", label: pick("Historial", "History") },
    { id: "catalogo", label: pick("Catálogo", "Catalog") },
    { id: "audiencia", label: pick("Audiencia", "Audience") },
    { id: "reportes", label: pick("Reportes", "Reports") },
  ];

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <PageSEO
        title={`${data?.subscription.artistName ?? pick("Monitor", "Monitor")} — Mexico Charts`}
        description={pick(
          "Panel privado de monitoreo de artistas",
          "Private artist monitoring dashboard",
        )}
        path={`/monitoreo/${encodeURIComponent(artistKey)}`}
        noindex
      />
      <SiteNav />
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-7 lg:px-10 lg:py-14">
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
        ) : isLoading ? (
          <div className="py-28 text-center text-sm font-bold text-white/35">
            {pick("Cargando tu historial…", "Loading your history…")}
          </div>
        ) : error || !data ? (
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
                    "Necesitas una suscripción activa para este artista.",
                    "You need an active subscription for this artist.",
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
          <>
            <Link
              href="/cuenta"
              className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-white/35 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {pick("Mi cuenta", "My account")}
            </Link>
            <header className="mt-6 flex flex-col gap-6 border-b border-white/[0.07] pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.16em] text-[#39FF14]">
                    {pick("Monitoreo activo", "Active monitoring")}
                  </span>
                  <span className="text-[9px] font-bold text-white/30">
                    {pick("Desde", "Since")}{" "}
                    {dateLabel(data.subscription.activatedAt)}
                  </span>
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-6xl">
                  {data.subscription.artistName}
                </h1>
                <p className="mt-3 text-sm text-white/40">
                  {pick(
                    "Historial privado de métricas licenciadas y normalizadas",
                    "Private history of licensed, normalized metrics",
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/35">
                <CheckCircle2 className="h-4 w-4 text-[#39FF14]" />
                {data.history.length}{" "}
                {pick("lecturas guardadas", "saved readings")}
              </div>
            </header>
            <nav className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setView(tab.id)}
                  className={`shrink-0 rounded-full px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] ${view === tab.id ? "bg-[#39FF14] text-black" : "border border-white/[0.08] text-white/40"}`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            {(view === "resumen" || view === "historial") && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/25">
                  Ventana privada
                </span>
                {(
                  [
                    ["30d", "30 días"],
                    ["90d", "90 días"],
                    ["all", pick("Historial disponible", "Available history")],
                  ] as const
                ).map(([range, label]) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setHistoryRange(range)}
                    className={`rounded-full px-3.5 py-2 text-[8px] font-black uppercase tracking-[0.13em] ${historyRange === range ? "bg-white text-black" : "border border-white/[0.08] text-white/35"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {view === "resumen" && (
              <section className="mt-7">
                <DailyPulse pulse={data.dailyPulse} />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    label={pick("Oyentes Spotify", "Spotify listeners")}
                    value={compact(current?.spotifyMonthlyListeners)}
                    detail={exact(current?.spotifyMonthlyListeners)}
                    icon={Headphones}
                    accent="#1ed760"
                  />
                  <MetricCard
                    label={pick("Seguidores Spotify", "Spotify followers")}
                    value={compact(current?.spotifyFollowers)}
                    detail={exact(current?.spotifyFollowers)}
                    icon={Users}
                    accent="#1ed760"
                  />
                  <MetricCard
                    label={pick("Suscriptores YouTube", "YouTube subscribers")}
                    value={compact(current?.youtubeSubscribers)}
                    detail={exact(current?.youtubeSubscribers)}
                    icon={Youtube}
                    accent="#ff3b30"
                  />
                  <MetricCard
                    label={pick("Seguidores Instagram", "Instagram followers")}
                    value={compact(current?.instagramFollowers)}
                    detail={exact(current?.instagramFollowers)}
                    icon={Instagram}
                    accent="#f05aa6"
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <MetricCard
                    label={pick(
                      "Spotify · canciones diarias",
                      "Spotify · daily track streams",
                    )}
                    value={compact(data.spotifyCatalog.trackDailyStreams)}
                    detail={`${data.spotifyCatalog.trackCount} ${pick("canciones", "tracks")}`}
                    icon={Music2}
                    accent="#1ed760"
                  />
                  <MetricCard
                    label={pick(
                      "Spotify · álbumes diarios",
                      "Spotify · daily album streams",
                    )}
                    value={compact(data.spotifyCatalog.albumDailyStreams)}
                    detail={`${data.spotifyCatalog.albumCount} ${pick("álbumes", "albums")}`}
                    icon={Disc3}
                    accent="#1ed760"
                  />
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                  <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">
                          {pick(
                            "Historial diario disponible",
                            "Available daily history",
                          )}
                        </p>
                        <h2 className="mt-2 text-xl font-black">
                          {pick(
                            "Oyentes mensuales de Spotify",
                            "Spotify monthly listeners",
                          )}
                        </h2>
                      </div>
                      <span className="text-sm font-black text-[#39FF14]">
                        {signed(growth30?.absolute)} · 30d
                      </span>
                    </div>
                    <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                      {selectedHistoryCoverage?.earliestAvailableDate
                        ? `${pick("Disponible desde", "Available since")} ${dateLabel(selectedHistoryCoverage.earliestAvailableDate)}`
                        : pick("Fecha inicial aún no disponible", "Earliest date not yet available")}
                    </p>
                    <div className="mt-6 h-64">
                      <HistoryChart data={chartData} />
                    </div>
                  </article>
                  <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <MapPin className="h-5 w-5 text-[#39FF14]" />
                    <p className="mt-5 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                      {pick(
                        "Mercado principal en México",
                        "Top market in Mexico",
                      )}
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {data.topMexicoCities[0]?.name ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-white/35">
                      {exact(data.topMexicoCities[0]?.currentListeners)}{" "}
                      {pick("oyentes", "listeners")}
                    </p>
                    <div className="mt-7 border-t border-white/[0.07] pt-5">
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/30">
                        {pick("Catálogo observado", "Observed catalog")}
                      </p>
                      <p className="mt-2 text-3xl font-black">
                        {data.catalog.releaseCount}
                      </p>
                      <p className="text-xs text-white/35">
                        {pick(
                          "lanzamientos normalizados",
                          "normalized releases",
                        )}
                      </p>
                    </div>
                  </article>
                </div>
              </section>
            )}
            {view === "spotify" && (
              <SpotifyCatalog catalog={data.spotifyCatalog} />
            )}
            {view === "historial" && (
              <section className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">
                      {pick("Archivo privado", "Private archive")}
                    </p>
                    <h2 className="mt-2 text-2xl font-black">
                      {pick(
                        "Evolución diaria guardada",
                        "Saved daily evolution",
                      )}
                    </h2>
                    <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">
                      {selectedHistoryCoverage?.earliestAvailableDate
                        ? `${pick("Historia diaria disponible desde", "Daily history available since")} ${dateLabel(selectedHistoryCoverage.earliestAvailableDate)}`
                        : pick("Recopilando fecha inicial", "Collecting earliest date")}
                    </p>
                  </div>
                  <select
                    value={metric}
                    onChange={(event) =>
                      setMetric(event.target.value as MetricKey)
                    }
                    className="rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-xs font-bold text-white"
                  >
                    <option value="spotifyMonthlyListeners">
                      Spotify listeners
                    </option>
                    <option value="spotifyFollowers">Spotify followers</option>
                    <option value="youtubeSubscribers">
                      YouTube subscribers
                    </option>
                    <option value="youtubeChannelViews">YouTube views</option>
                    <option value="instagramFollowers">
                      Instagram followers
                    </option>
                    <option value="tiktokFollowers">TikTok followers</option>
                  </select>
                </div>
                <div className="mt-7 h-80">
                  <HistoryChart data={chartData} />
                </div>
              </section>
            )}
            {view === "videos" && (
              <section className="mt-7">
                {data.liveVideos.length ? (
                  <>
                    <div className="mb-4 overflow-hidden rounded-3xl border border-red-500/15 bg-[radial-gradient(circle_at_top_right,rgba(255,40,40,.10),transparent_46%)]">
                      <div className="border-b border-white/[0.07] px-5 py-5 sm:px-7">
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-400">
                          YouTube en vivo
                        </p>
                        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
                          Videos de YouTube con mayor actividad
                        </h2>
                      </div>
                      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                        <div className="border-b border-white/[0.07] p-5 sm:border-b-0 sm:border-r sm:p-6">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/30">
                            Ganancia combinada hoy · ET
                          </p>
                          <p className="mt-2 text-3xl font-black text-[#39FF14]">
                            +{exact(videoPulse.totalToday)}
                          </p>
                        </div>
                        <div className="border-b border-white/[0.07] p-5 sm:border-b-0 sm:border-r sm:p-6">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/30">
                            Último día completo
                          </p>
                          <p className="mt-2 text-3xl font-black">
                            +{exact(videoPulse.totalLastDay)}
                          </p>
                        </div>
                        <div className="p-5 sm:p-6">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/30">
                            YouTube líder hoy
                          </p>
                          <p className="mt-2 line-clamp-2 text-sm font-black leading-5">
                            {videoPulse.leader?.title ?? "Recopilando"}
                          </p>
                          <p className="mt-1 text-xs font-black text-[#39FF14]">
                            {videoPulse.leader?.views_today_et == null
                              ? "—"
                              : `+${exact(Number(videoPulse.leader.views_today_et))}`}
                          </p>
                        </div>
                        <div className="border-t border-white/[0.07] p-5 sm:p-6 xl:border-l xl:border-t-0">
                          <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/30">
                            Cobertura exacta
                          </p>
                          <p className="mt-2 text-3xl font-black">
                            {exact(data.youtubeCoverage.observedVideoCount)}
                            <span className="text-base text-white/25">
                              /{data.youtubeCoverage.channelVideoCount == null
                                ? "—"
                                : exact(data.youtubeCoverage.channelVideoCount)}
                            </span>
                          </p>
                          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.11em] text-white/28">
                            {data.youtubeCoverage.complete
                              ? "Canal importado completo"
                              : `${exact(data.youtubeCoverage.importedVideoCount)} importados`}
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-white/[0.07] p-5 sm:p-7">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/30">
                              Historia diaria · últimos 30 días
                            </p>
                            <p className="mt-1 max-w-xl truncate text-sm font-black">
                              {activeVideo?.title ?? "Selecciona un video de YouTube"}
                            </p>
                          </div>
                          <select
                            value={activeVideoId}
                            onChange={(event) =>
                              setSelectedVideoId(event.target.value)
                            }
                            className="max-w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-xs font-bold text-white sm:max-w-sm"
                          >
                            {data.liveVideos.map((video) => (
                              <option
                                key={video.video_id}
                                value={video.video_id}
                              >
                                {video.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-5 h-64">
                          <HistoryChart data={videoHistory} />
                        </div>
                        <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.12em] text-white/25">
                          Vistas ganadas por día · lecturas guardadas, sin
                          interpolación
                        </p>
                      </div>
                    </div>
                    <YouTubeLivePublicPreview
                      artistName={data.subscription.artistName}
                      videos={data.liveVideos}
                    />
                  </>
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] p-10 text-center text-sm text-white/35">
                    Todavía no hay videos verificados con contador para este
                    artista.
                  </div>
                )}
              </section>
            )}
            {view === "catalogo" && (
              <section className="mt-7">
                {data.latestReleaseImpact && (
                  <article className="mb-4 overflow-hidden rounded-3xl border border-violet-400/20 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,.13),transparent_45%)] p-6 sm:p-8">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-300">
                      Release Impact · análisis privado
                    </p>
                    <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                      <div>
                        <h2 className="text-2xl font-black">
                          {data.latestReleaseImpact.release.title}
                        </h2>
                        <p className="mt-2 text-sm text-white/40">
                          Impacto observado después del lanzamiento · confianza{" "}
                          {data.latestReleaseImpact.confidence} ·{" "}
                          {data.latestReleaseImpact.platformsMeasured}{" "}
                          plataformas medidas
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ["7 días", data.latestReleaseImpact.lift7],
                            ["30 días", data.latestReleaseImpact.lift30],
                            ["90 días", data.latestReleaseImpact.lift90],
                          ] as const
                        ).map(([label, value]) => (
                          <div
                            key={label}
                            className="min-w-24 rounded-xl border border-white/[0.08] bg-black/20 p-3 text-center"
                          >
                            <p className="text-[8px] font-black uppercase text-white/30">
                              {label}
                            </p>
                            <p
                              className={`mt-1 text-lg font-black ${(value ?? 0) >= 0 ? "text-[#39FF14]" : "text-red-400"}`}
                            >
                              {value == null
                                ? "—"
                                : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label={pick("Lanzamientos", "Releases")}
                    value={exact(data.catalog.releaseCount)}
                    icon={Disc3}
                  />
                  <MetricCard
                    label={pick("Canciones", "Tracks")}
                    value={exact(data.catalog.trackCount)}
                    icon={Music2}
                  />
                  <MetricCard
                    label={pick("Últimos 90 días", "Last 90 days")}
                    value={exact(data.catalog.releasesLast90Days)}
                    icon={CalendarDays}
                  />
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08]">
                  {data.catalog.releases.length ? (
                    data.catalog.releases.map((release) => (
                      <article
                        key={release.id}
                        className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {release.title}
                          </p>
                          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.13em] text-white/30">
                            {release.type} · {dateLabel(release.releaseDate)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/20" />
                      </article>
                    ))
                  ) : (
                    <p className="p-8 text-center text-sm text-white/30">
                      {pick(
                        "El catálogo licenciado aún no tiene lanzamientos normalizados.",
                        "The licensed catalog does not yet have normalized releases.",
                      )}
                    </p>
                  )}
                </div>
              </section>
            )}
            {view === "audiencia" && (
              <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.topMexicoCities.map((city, index) => (
                  <article
                    key={`${city.name}-${index}`}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6"
                  >
                    <div className="flex items-center justify-between">
                      <MapPin className="h-5 w-5 text-[#39FF14]" />
                      <span className="text-[9px] font-black text-[#39FF14]">
                        #{index + 1}
                      </span>
                    </div>
                    <h2 className="mt-6 text-xl font-black">{city.name}</h2>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-[0.15em] text-white/30">
                      {city.region ?? city.countryCode}
                    </p>
                    <p className="mt-5 text-3xl font-black">
                      {compact(city.currentListeners)}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/30">
                      {pick("oyentes mensuales", "monthly listeners")}
                    </p>
                  </article>
                ))}
              </section>
            )}
            {view === "reportes" && (
              <section className="mt-7 rounded-3xl border border-[#39FF14]/20 bg-[radial-gradient(circle_at_top_right,rgba(57,255,20,.09),transparent_45%)] p-7 sm:p-10">
                <Download className="h-7 w-7 text-[#39FF14]" />
                <p className="mt-6 text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">
                  {pick("Reporte mensual", "Monthly report")}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                  {pick(
                    "Descarga tus lecturas normalizadas",
                    "Download your normalized readings",
                  )}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
                  {pick(
                    "El CSV incluye una fila por lectura guardada durante el mes y las métricas disponibles. No incluye respuestas sin procesar de proveedores.",
                    "The CSV includes one row per saved reading during the month and available metrics. It does not include raw provider responses.",
                  )}
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={selectedMonth}
                    onChange={(event) => setReportMonth(event.target.value)}
                    className="rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm font-bold text-white"
                  >
                    {availableMonths.length ? (
                      availableMonths.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))
                    ) : (
                      <option value={selectedMonth}>{selectedMonth}</option>
                    )}
                  </select>
                  <button
                    type="button"
                    disabled={reportLoading || !availableMonths.length}
                    onClick={() => void downloadReport()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] px-6 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-black disabled:opacity-35"
                  >
                    <Download className="h-4 w-4" />
                    {reportLoading
                      ? pick("Generando…", "Generating…")
                      : pick("Descargar CSV", "Download CSV")}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-6 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-white/65"
                  >
                    <LayoutDashboard className="h-4 w-4" />{" "}
                    {pick(
                      "Imprimir reporte ejecutivo",
                      "Print executive summary",
                    )}
                  </button>
                </div>
                {reportError && (
                  <p className="mt-3 text-xs font-bold text-red-400">
                    {reportError}
                  </p>
                )}
                <p className="mt-5 flex items-center gap-2 text-[9px] font-bold text-white/25">
                  <LayoutDashboard className="h-4 w-4" />
                  {pick(
                    "Los reportes incluyen los meses con observaciones guardadas disponibles.",
                    "Reports include available months with saved observations.",
                  )}
                </p>
              </section>
            )}
          </>
        )}
      </main>
      <EditorialFooter />
    </div>
  );
}
