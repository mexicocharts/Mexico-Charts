import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Activity,
  Album,
  Award,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Disc3,
  Download,
  FileText,
  Headphones,
  LayoutDashboard,
  MapPin,
  Music2,
  Play,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
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
import { authenticatedFetch, useMexicoAuth } from "@/auth/AuthProvider";
import { useSongstatsArtist, type SongstatsArtistData } from "@/hooks/useSongstatsArtist";
import { useKworbStats, type KworbStats } from "@/hooks/useKworbStats";
import { useYoutubeChannel, type YoutubeChannelResult } from "@/hooks/useYoutubeChannel";
import {
  LUIS_MIGUEL_ALBUMS,
  LUIS_MIGUEL_CATALOG_UPDATED,
  LUIS_MIGUEL_TRACKS,
} from "@/data/luisMiguelMonitoringCatalog";

const GREEN = "#39FF14";
type View = "resumen" | "historial" | "discografia" | "audiencia" | "alertas" | "reportes";
type CatalogSort = "daily-desc" | "daily-asc" | "total-desc" | "total-asc" | "title-asc" | "title-desc";
type AudiencePeriod = "days7" | "days30" | "days90";
type AudienceTrendMetric = "spotifyMonthlyListeners" | "instagramFollowers" | "tiktokFollowers";
type StreamArchivePeriod = "daily" | "monthly" | "yearly";

const DEMO_SONGSTATS = {
  artistKey: "luis miguel",
  name: "Luis Miguel",
  avatarUrl: "https://i.scdn.co/image/ab676161000051746481401e529e475116702a29",
  snapshot: {
    snapshotDate: "2026-08-08", spotifyFollowers: 22881615, spotifyMonthlyListeners: 21407476,
    spotifyPopularity: 84, youtubeSubscribers: 63210, youtubeChannelViews: 8397064449,
    instagramFollowers: 6482389, tiktokFollowers: 1395805, facebookFollowers: 5245249,
    twitterFollowers: 683018, soundcloudFollowers: 6640, deezerFollowers: 1928788, fetchedAt: "2026-08-08T01:21:31.957Z",
  },
  growth: {
    spotifyMonthlyListeners: { days7: { absolute: 23983, percentage: .11 }, days30: { absolute: -180707, percentage: -.84 }, days90: { absolute: -640752, percentage: -2.91 } },
    spotifyFollowers: { days7: { absolute: 38520, percentage: .17 }, days30: { absolute: 197171, percentage: .87 }, days90: { absolute: 653651, percentage: 2.94 } },
    instagramFollowers: { days7: { absolute: 19075, percentage: .3 }, days30: { absolute: 19692, percentage: .3 }, days90: { absolute: -73324, percentage: -1.12 } },
    tiktokFollowers: { days7: { absolute: 10928, percentage: .79 }, days30: { absolute: 19480, percentage: 1.42 }, days90: { absolute: 28532, percentage: 2.09 } },
    facebookFollowers: { days7: { absolute: 18237, percentage: .35 }, days30: { absolute: 13305, percentage: .25 }, days90: { absolute: -2503, percentage: -.05 } },
    deezerFollowers: { days7: { absolute: 669, percentage: .03 }, days30: { absolute: 3542, percentage: .18 }, days90: { absolute: 11434, percentage: .6 } },
  },
  trends: {},
  topMexicoCities: [
    { name: "Mexico City", region: "CDMX", countryCode: "MX", currentListeners: 2433285, peakListeners: 3658012 },
    { name: "Guadalajara", region: "Jalisco", countryCode: "MX", currentListeners: 723644, peakListeners: 1060102 },
    { name: "Puebla", region: "CMX", countryCode: "MX", currentListeners: 714298, peakListeners: 946872 },
    { name: "Zapopan", region: "Jalisco", countryCode: "MX", currentListeners: 472979, peakListeners: 529766 },
    { name: "Santiago de Querétaro", region: "Qro.", countryCode: "MX", currentListeners: 453420, peakListeners: 615779 },
  ],
} as SongstatsArtistData;

const DEMO_TRACK_COVERS: Record<string, string> = {
  "Ahora Te Puedes Marchar": "https://cdn-images.dzcdn.net/images/cover/250298e2003c1fba394d08ad77750492/1000x1000-000000-80-0-0.jpg",
  "La Incondicional": "https://cdn-images.dzcdn.net/images/cover/4a35023687613cd4e438f685aab47bf6/1000x1000-000000-80-0-0.jpg",
  "Hasta Que Me Olvides": "https://cdn-images.dzcdn.net/images/cover/a89494280c89deaf46cbd8d0b1381eb7/1000x1000-000000-80-0-0.jpg",
  "La Media Vuelta": "https://cdn-images.dzcdn.net/images/cover/426aeaebfe96e85e072c317e38782ec9/1000x1000-000000-80-0-0.jpg",
  "Culpable O No - Miénteme Como Siempre": "https://cdn-images.dzcdn.net/images/cover/4a35023687613cd4e438f685aab47bf6/1000x1000-000000-80-0-0.jpg",
  "Por Debajo De La Mesa": "https://cdn-images.dzcdn.net/images/cover/a68b22f0c0a4f2e862c1cb9dd4abceaf/1000x1000-000000-80-0-0.jpg",
  "Tengo Todo Excepto a Ti": "https://cdn-images.dzcdn.net/images/cover/0bc9eff79a5c822cc6a0d4a0f03c4923/1000x1000-000000-80-0-0.jpg",
  "No Sé Tú": "https://cdn-images.dzcdn.net/images/cover/dc937566c6e1d6a00d8c9e2ddb26ed8e/1000x1000-000000-80-0-0.jpg",
  "Entrégate": "https://cdn-images.dzcdn.net/images/cover/0bc9eff79a5c822cc6a0d4a0f03c4923/1000x1000-000000-80-0-0.jpg",
  "Sabor a Mi": "https://cdn-images.dzcdn.net/images/cover/a68b22f0c0a4f2e862c1cb9dd4abceaf/1000x1000-000000-80-0-0.jpg",
};

const DEMO_TRACKS = LUIS_MIGUEL_TRACKS.map(track => ({
  ...track,
  coverUrl: track.coverUrl ?? DEMO_TRACK_COVERS[track.title] ?? null,
  streamsFmt: compact(track.streams),
  dailyFmt: compact(track.daily),
}));

const DEMO_HISTORY = [
  ["2026-07-11",7317858],["2026-07-12",7567268],["2026-07-13",7059041],["2026-07-14",6136241],["2026-07-15",7187802],
  ["2026-07-16",7055499],["2026-07-17",7001678],["2026-07-18",7205025],["2026-07-19",7386235],["2026-07-20",7177146],
  ["2026-07-21",5454632],["2026-07-22",6848974],["2026-07-23",7111396],["2026-07-24",7305171],["2026-07-25",7346431],
  ["2026-07-26",7422384],["2026-07-27",7196633],["2026-07-28",6386817],["2026-07-29",6974193],["2026-07-30",7105141],
  ["2026-07-31",7314071],["2026-08-01",7491579],["2026-08-02",7572931],["2026-08-03",7477934],["2026-08-04",6606568],
  ["2026-08-05",7181142],["2026-08-06",7460429],["2026-08-07",7693327],["2026-08-08",7693327],["2026-08-09",7924057],
].map(([date, dailyStreams]) => ({ date: String(date), dailyStreams: Number(dailyStreams), totalStreams: null }));

const DEMO_STREAMS = {
  slug: "luis-miguel", spotifyId: null, chartPositions: null, youtube: null,
  spotify: {
    totalStreams: 17472465261, totalStreamsFmt: "17.5B", dailyStreams: 7924057, dailyStreamsFmt: "7.9M", trackCount: 313,
    topTracks: DEMO_TRACKS, history: DEMO_HISTORY,
    analytics: { streams: { average7Day: 7433826, average7DayFmt: "7.4M", average30Day: 7155364, average30DayFmt: "7.2M", average7DayChangePct: 4, average30DayChangePct: null, weeklyGrowth: 52249119, weeklyGrowthFmt: "52.2M", monthlyGrowth: null, monthlyGrowthFmt: null, biggestSpike: { date: "2026-08-09", streams: 7924057, streamsFmt: "7.9M" } }, momentum: { trend: "rising", score: 7731179, scoreFmt: "7.7M" }, availableDays: 30 },
  },
} as KworbStats;

const DEMO_YOUTUBE = {
  subscriberCount: 2970000, viewCount: 4435245729, snapshotDate: "2026-08-09",
  analytics: { subscribers: { dailyChange: 0, dailyChangeFmt: "0", weeklyGrowth: 10000, weeklyGrowthFmt: "10K", monthlyGrowth: 20000, monthlyGrowthFmt: "20K" }, views: { average7Day: 0, average7DayFmt: "0", average30Day: 1477392, average30DayFmt: "1.5M", weeklyGrowth: -11628121, weeklyGrowthFmt: "-11.6M", monthlyGrowth: 32693637, monthlyGrowthFmt: "32.7M", average7DayChangePct: -100, average30DayChangePct: null, biggestSpike: { date: "2026-07-27", views: 44321758, viewsFmt: "44.3M" } }, momentum: { trend: "cooling", score: 0, scoreFmt: "0" }, availableDays: 30 },
} as YoutubeChannelResult;

const DEMO_CERTIFICATIONS = [
  { title: "México Por Siempre", level: "3× Platino", format: "Álbum", date: "2018-10-25" },
  { title: "La Incondicional", level: "Oro", format: "Sencillo", date: "2015-09-04" },
  { title: "Luis Miguel", level: "4× Platino", format: "Álbum", date: "2010-09-21" },
];

function exact(value: number | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat("es-MX").format(value);
}

function signedExact(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${exact(value)}`;
}

function compact(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function percentage(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function sortCatalog<T extends { title: string; daily: number; streams: number }>(items: T[], sort: CatalogSort) {
  return [...items].sort((a, b) => {
    if (sort === "daily-desc") return b.daily - a.daily;
    if (sort === "daily-asc") return a.daily - b.daily;
    if (sort === "total-desc") return b.streams - a.streams;
    if (sort === "total-asc") return a.streams - b.streams;
    if (sort === "title-desc") return b.title.localeCompare(a.title, "es", { sensitivity: "base" });
    return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
  });
}

function aggregateStreamHistory(
  history: Array<{ date: string; streams: number }>,
  period: StreamArchivePeriod,
) {
  const buckets = new Map<string, { period: string; streams: number; observedDays: number }>();
  for (const point of history) {
    const key = period === "daily" ? point.date : period === "monthly" ? point.date.slice(0, 7) : point.date.slice(0, 4);
    const current = buckets.get(key) ?? { period: key, streams: 0, observedDays: 0 };
    current.streams += point.streams;
    current.observedDays += 1;
    buckets.set(key, current);
  }
  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)).map(bucket => ({
    ...bucket,
    label: period === "daily"
      ? bucket.period.slice(5)
      : period === "monthly"
        ? new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${bucket.period}-01T12:00:00Z`))
        : bucket.period,
  }));
}

function GrowthBadge({ value }: { value: number | null | undefined }) {
  const positive = value != null && value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${positive ? "bg-[#39FF14]/10 text-[#39FF14]" : "bg-red-500/10 text-red-400"}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {percentage(value)}
    </span>
  );
}

function MetricCard({ label, value, exactValue, growth, icon: Icon, accent = GREEN }: {
  label: string;
  value: string;
  exactValue?: string;
  growth?: number | null;
  icon: typeof Activity;
  accent?: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111] p-5 transition hover:border-white/[0.14]">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10 blur-3xl" style={{ background: accent }} />
      <div className="relative flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035]" style={{ color: accent }}><Icon className="h-5 w-5" /></span>
        {growth != null && <GrowthBadge value={growth} />}
      </div>
      <p className="relative mt-7 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="relative mt-2 text-3xl font-black tracking-[-0.045em] text-white">{value}</p>
      {exactValue && <p className="relative mt-1 text-[10px] font-semibold text-white/30">{exactValue}</p>}
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <Album className="mx-auto h-8 w-8 text-white/20" />
      <h3 className="mt-4 text-sm font-black uppercase tracking-[0.1em]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-xs font-medium leading-5 text-white/35">{body}</p>
    </div>
  );
}

function MonitoringDashboardContent() {
  const [view, setView] = useState<View>("resumen");
  const [catalogView, setCatalogView] = useState<"canciones" | "albumes">("canciones");
  const [trackQuery, setTrackQuery] = useState("");
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("total-desc");
  const [streamArchivePeriod, setStreamArchivePeriod] = useState<StreamArchivePeriod>("daily");
  const [audiencePeriod, setAudiencePeriod] = useState<AudiencePeriod>("days30");
  const [audienceTrendMetric, setAudienceTrendMetric] = useState<AudienceTrendMetric>("spotifyMonthlyListeners");
  const [visibleTrackCount, setVisibleTrackCount] = useState(50);
  const { data: songstats, isLoading: songstatsLoading } = useSongstatsArtist("luis miguel");
  const { data: streamData, isLoading: streamsLoading } = useKworbStats("Luis Miguel");
  const youtube = useYoutubeChannel("luis miguel");

  const resolvedSongstats = songstats ?? DEMO_SONGSTATS;
  const resolvedStreams = streamData ?? DEMO_STREAMS;
  const resolvedYoutube = youtube ?? DEMO_YOUTUBE;
  const snapshot = resolvedSongstats.snapshot;
  const growth = resolvedSongstats.growth;
  const tracks = useMemo(() => {
    const query = trackQuery.trim().toLocaleLowerCase();
    const matches = query ? DEMO_TRACKS.filter(track => track.title.toLocaleLowerCase().includes(query)) : DEMO_TRACKS;
    return sortCatalog(matches, catalogSort);
  }, [trackQuery, catalogSort]);
  const albums = useMemo(() => {
    const query = trackQuery.trim().toLocaleLowerCase();
    const matches = query ? LUIS_MIGUEL_ALBUMS.filter(album => album.title.toLocaleLowerCase().includes(query)) : LUIS_MIGUEL_ALBUMS;
    return sortCatalog(matches, catalogSort);
  }, [trackQuery, catalogSort]);
  const visibleTracks = tracks.slice(0, visibleTrackCount);
  const rawStreamHistory = useMemo(() => (resolvedStreams.spotify?.history ?? [])
    .filter(point => point.dailyStreams != null)
    .map(point => ({ date: point.date, streams: point.dailyStreams as number })), [resolvedStreams]);
  const history = useMemo(() => rawStreamHistory.slice(-45).map(point => ({ ...point, date: point.date.slice(5) })), [rawStreamHistory]);
  const archivedStreamHistory = useMemo(() => aggregateStreamHistory(rawStreamHistory, streamArchivePeriod), [rawStreamHistory, streamArchivePeriod]);
  const archivedStreamTotal = archivedStreamHistory.reduce((sum, point) => sum + point.streams, 0);
  const archiveObservedDays = rawStreamHistory.length;
  const archiveStartDate = rawStreamHistory[0]?.date;
  const archiveEndDate = rawStreamHistory.at(-1)?.date;
  const spotify30 = growth?.spotifyMonthlyListeners?.days30?.percentage;
  const streamAnalytics = resolvedStreams.spotify?.analytics?.streams;
  const dailyStreams = resolvedStreams.spotify?.dailyStreams;
  const isLoading = (songstatsLoading || streamsLoading) && !resolvedSongstats && !resolvedStreams;
  const youtubeAudienceGrowth = {
    days7: {
      absolute: resolvedYoutube.analytics.subscribers.weeklyGrowth,
      percentage: resolvedYoutube.analytics.subscribers.weeklyGrowth == null ? null : resolvedYoutube.analytics.subscribers.weeklyGrowth / Math.max((resolvedYoutube.subscriberCount ?? 1) - resolvedYoutube.analytics.subscribers.weeklyGrowth, 1) * 100,
    },
    days30: {
      absolute: resolvedYoutube.analytics.subscribers.monthlyGrowth,
      percentage: resolvedYoutube.analytics.subscribers.monthlyGrowth == null ? null : resolvedYoutube.analytics.subscribers.monthlyGrowth / Math.max((resolvedYoutube.subscriberCount ?? 1) - resolvedYoutube.analytics.subscribers.monthlyGrowth, 1) * 100,
    },
    days90: { absolute: null, percentage: null },
  };
  const audiencePlatforms = [
    { label: "Spotify", metric: "Seguidores", current: snapshot?.spotifyFollowers, periods: growth?.spotifyFollowers, color: "#1DB954" },
    { label: "Instagram", metric: "Seguidores", current: snapshot?.instagramFollowers, periods: growth?.instagramFollowers, color: "#D946A1" },
    { label: "TikTok", metric: "Seguidores", current: snapshot?.tiktokFollowers, periods: growth?.tiktokFollowers, color: "#FFFFFF" },
    { label: "Facebook", metric: "Seguidores", current: snapshot?.facebookFollowers, periods: growth?.facebookFollowers, color: "#4B7BEC" },
    { label: "Deezer", metric: "Seguidores", current: snapshot?.deezerFollowers, periods: growth?.deezerFollowers, color: "#A855F7" },
    { label: "X", metric: "Seguidores", current: snapshot?.twitterFollowers, periods: growth?.twitterFollowers, color: "#D4D4D4" },
    { label: "SoundCloud", metric: "Seguidores", current: snapshot?.soundcloudFollowers, periods: growth?.soundcloudFollowers, color: "#FF6A00" },
    { label: "YouTube", metric: "Suscriptores", current: resolvedYoutube.subscriberCount, periods: youtubeAudienceGrowth, color: "#FF4343" },
  ];
  const audiencePeriodChanges = audiencePlatforms
    .map(platform => ({ ...platform, change: platform.periods?.[audiencePeriod] }))
    .filter(platform => platform.change?.absolute != null || platform.change?.percentage != null);
  const strongestAudienceGrowth = [...audiencePeriodChanges].sort((a, b) => (b.change?.percentage ?? -Infinity) - (a.change?.percentage ?? -Infinity))[0];
  const largestAudienceGain = [...audiencePeriodChanges].sort((a, b) => (b.change?.absolute ?? -Infinity) - (a.change?.absolute ?? -Infinity))[0];
  const largestAudienceDecline = [...audiencePeriodChanges].filter(platform => (platform.change?.percentage ?? 0) < 0).sort((a, b) => (a.change?.percentage ?? 0) - (b.change?.percentage ?? 0))[0];
  const monthlyListenersCurrent = snapshot?.spotifyMonthlyListeners;
  const audienceTrendOptions: Array<{
    id: AudienceTrendMetric;
    label: string;
    valueLabel: string;
    current: number | null | undefined;
    color: string;
  }> = [
    { id: "spotifyMonthlyListeners", label: "Spotify", valueLabel: "Oyentes mensuales", current: snapshot?.spotifyMonthlyListeners, color: "#39FF14" },
    { id: "instagramFollowers", label: "Instagram", valueLabel: "Seguidores", current: snapshot?.instagramFollowers, color: "#D946A1" },
    { id: "tiktokFollowers", label: "TikTok", valueLabel: "Seguidores", current: snapshot?.tiktokFollowers, color: "#FFFFFF" },
  ];
  const selectedAudienceTrend = audienceTrendOptions.find(option => option.id === audienceTrendMetric) ?? audienceTrendOptions[0];
  const continuousAudienceTrend = (resolvedSongstats.trends?.[audienceTrendMetric] ?? [])
    .filter(point => Number.isFinite(point.value))
    .map(point => ({ label: point.date.slice(5), fullDate: point.date, value: point.value }));
  const selectedGrowth = growth?.[audienceTrendMetric];
  const comparisonAudienceTrend = selectedAudienceTrend.current == null ? [] : [
    { label: "90 días", fullDate: "Hace 90 días", value: selectedGrowth?.days90?.absolute == null ? null : selectedAudienceTrend.current - selectedGrowth.days90.absolute },
    { label: "30 días", fullDate: "Hace 30 días", value: selectedGrowth?.days30?.absolute == null ? null : selectedAudienceTrend.current - selectedGrowth.days30.absolute },
    { label: "7 días", fullDate: "Hace 7 días", value: selectedGrowth?.days7?.absolute == null ? null : selectedAudienceTrend.current - selectedGrowth.days7.absolute },
    { label: "Hoy", fullDate: snapshot?.snapshotDate ?? "Hoy", value: selectedAudienceTrend.current },
  ].filter((point): point is { label: string; fullDate: string; value: number } => point.value != null);
  const audienceTrendData = continuousAudienceTrend.length > 1 ? continuousAudienceTrend : comparisonAudienceTrend;
  const hasContinuousAudienceTrend = continuousAudienceTrend.length > 1;
  const topMexicoCityListeners = resolvedSongstats.topMexicoCities.reduce((sum, city) => sum + city.currentListeners, 0);
  const audienceVelocity = audiencePlatforms.map(platform => {
    const days7 = platform.periods?.days7?.absolute;
    const days30 = platform.periods?.days30?.absolute;
    if (days7 == null || days30 == null) return null;
    const recentDaily = days7 / 7;
    const monthlyDaily = days30 / 30;
    const acceleration = recentDaily - monthlyDaily;
    const recovering = recentDaily >= 0 && monthlyDaily < 0;
    const reversing = recentDaily < 0 && monthlyDaily >= 0;
    const signal = recovering ? "Recuperando" : reversing ? "Revirtiendo" : acceleration > 0 ? "Acelerando" : "Perdiendo ritmo";
    return { ...platform, recentDaily, monthlyDaily, acceleration, signal, positiveSignal: recovering || acceleration > 0 };
  }).filter((platform): platform is NonNullable<typeof platform> => platform != null);
  const fastestAudienceAcceleration = [...audienceVelocity].sort((a, b) => b.acceleration - a.acceleration)[0];
  const spotifyAudienceRatio = monthlyListenersCurrent != null && snapshot?.spotifyFollowers
    ? monthlyListenersCurrent / snapshot.spotifyFollowers * 100
    : null;
  const largestCityRecoveryGap = [...resolvedSongstats.topMexicoCities]
    .map(city => ({ ...city, gap: Math.max((city.peakListeners ?? city.currentListeners) - city.currentListeners, 0) }))
    .sort((a, b) => b.gap - a.gap)[0];

  const nav: Array<{ id: View; label: string; icon: typeof Activity }> = [
    { id: "resumen", label: "Resumen", icon: LayoutDashboard },
    { id: "historial", label: "Historial", icon: CalendarDays },
    { id: "discografia", label: "Discografía", icon: Disc3 },
    { id: "audiencia", label: "Audiencia", icon: Headphones },
    { id: "alertas", label: "Alertas", icon: Bell },
    { id: "reportes", label: "Reportes", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <PageSEO title="Luis Miguel Monitor — Mexico Charts" description="Vista previa privada del panel de monitoreo de Luis Miguel." path="/internal/monitoring/dashboard" noindex />

      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#080808]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/internal/monitoring" className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}mexico-charts-logo.png`} alt="Mexico Charts" className="h-9 w-9 object-contain" />
            <div className="hidden sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.16em]">Mexico Charts</p>
              <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Monitor</p>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setView("alertas")} className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/50" aria-label="Notificaciones">
              <Bell className="h-4 w-4" />
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#39FF14] ring-2 ring-[#080808]" />
            </button>
            <button type="button" className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 text-[9px] font-black uppercase tracking-[0.1em] text-white/65"><CircleUserRound className="h-4 w-4" /><span className="hidden sm:inline">Mi cuenta</span></button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-b border-white/[0.07] bg-[#090909] lg:min-h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r">
          <div className="flex gap-2 overflow-x-auto px-4 py-3 lg:block lg:px-4 lg:py-6">
            <Link href="/internal/monitoring" className="mb-5 hidden items-center gap-2 px-3 text-[9px] font-black uppercase tracking-[0.14em] text-white/30 hover:text-white lg:flex"><ArrowLeft className="h-3.5 w-3.5" /> Volver</Link>
            {nav.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setView(id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition lg:mb-1 lg:w-full ${view === id ? "bg-[#39FF14] text-black" : "text-white/40 hover:bg-white/[0.04] hover:text-white"}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <div className="mx-4 mt-4 hidden rounded-2xl border border-[#39FF14]/15 bg-[#39FF14]/[0.04] p-4 lg:block">
            <Sparkles className="h-4 w-4 text-[#39FF14]" />
            <p className="mt-3 text-[9px] font-black uppercase tracking-[0.13em]">Plan activo</p>
            <p className="mt-1 text-xs font-bold text-white/40">Luis Miguel · $6/mes</p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[72%] rounded-full bg-[#39FF14]" /></div>
            <p className="mt-2 text-[8px] font-bold uppercase tracking-[0.1em] text-white/25">Próximo reporte · 1 sep</p>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-9 xl:px-12">
          <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#101010] p-5 sm:p-7">
            <div className="absolute right-[-5%] top-[-70%] h-80 w-80 rounded-full bg-[#39FF14]/10 blur-[90px]" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:h-24 sm:w-24">
                {resolvedSongstats.avatarUrl ? <img src={resolvedSongstats.avatarUrl} alt="Luis Miguel" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Music2 className="h-8 w-8 text-white/20" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#39FF14]/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-[#39FF14]">Monitoreo activo</span>
                  <span className="text-[9px] font-bold text-white/25">Actualizado {dateLabel(snapshot?.snapshotDate)}</span>
                </div>
                <h1 className="mt-3 break-words text-3xl font-black tracking-[-0.04em] sm:text-5xl">Luis Miguel</h1>
                <p className="mt-2 text-xs font-semibold text-white/35">Audiencia, streaming y rendimiento de catálogo en un solo lugar.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-[9px] font-black uppercase tracking-[0.12em] text-white/55"><Share2 className="h-4 w-4" /> Compartir</button>
                <button type="button" onClick={() => setView("reportes")} className="flex h-10 items-center gap-2 rounded-full bg-[#39FF14] px-4 text-[9px] font-black uppercase tracking-[0.12em] text-black"><Download className="h-4 w-4" /> Reporte</button>
              </div>
            </div>
          </section>

          {isLoading && <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-xs font-bold text-white/30">Preparando el monitor…</div>}

          {!isLoading && view === "resumen" && (
            <div className="mt-6 space-y-6">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Streams hoy" value={compact(dailyStreams)} exactValue={exact(dailyStreams)} growth={streamAnalytics?.average7DayChangePct} icon={Play} />
                <MetricCard label="Oyentes mensuales" value={compact(snapshot?.spotifyMonthlyListeners)} exactValue={exact(snapshot?.spotifyMonthlyListeners)} growth={spotify30} icon={Headphones} accent="#1DB954" />
                <MetricCard label="Suscriptores YouTube" value={compact(resolvedYoutube.subscriberCount)} exactValue={exact(resolvedYoutube.subscriberCount)} growth={resolvedYoutube.analytics.subscribers.monthlyGrowth == null ? null : (resolvedYoutube.analytics.subscribers.monthlyGrowth / Math.max((resolvedYoutube.subscriberCount ?? 1) - resolvedYoutube.analytics.subscribers.monthlyGrowth, 1)) * 100} icon={Youtube} accent="#FF4343" />
                <MetricCard label="Streams acumulados" value={compact(resolvedStreams.spotify?.totalStreams)} exactValue={exact(resolvedStreams.spotify?.totalStreams)} icon={Disc3} />
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,.75fr)]">
                <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Streaming diario</p><h2 className="mt-2 text-xl font-black tracking-[-0.025em]">Rendimiento de los últimos 45 días</h2></div>
                    <div className="flex gap-2"><span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] text-white/35">Spotify</span><span className="rounded-full bg-[#39FF14]/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] text-[#39FF14]">Diario</span></div>
                  </div>
                  <div className="mt-6 h-72 w-full">
                    {history.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={history}><defs><linearGradient id="monitorGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity={0.35} /><stop offset="100%" stopColor={GREEN} stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={28} /><YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 9 }} tickFormatter={value => compact(value)} tickLine={false} axisLine={false} width={42} /><Tooltip contentStyle={{ background: "#0b0b0b", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 11 }} formatter={(value: number) => [exact(value), "Streams"]} /><Area type="monotone" dataKey="streams" stroke={GREEN} fill="url(#monitorGreen)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs font-bold text-white/25">Historial diario en preparación</div>}
                  </div>
                </article>

                <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Lectura rápida</p>
                  <h2 className="mt-2 text-xl font-black">Qué está pasando</h2>
                  <div className="mt-6 space-y-3">
                    {[
                      { label: "Promedio diario · 7 días", value: streamAnalytics?.average7DayFmt ?? "—", icon: Activity },
                      { label: "Crecimiento · 30 días", value: streamAnalytics?.monthlyGrowthFmt ?? "—", icon: TrendingUp },
                      { label: "Mayor pico", value: streamAnalytics?.biggestSpike?.streamsFmt ?? "—", icon: Sparkles },
                    ].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/30">{label}</p><p className="mt-1 truncate text-sm font-black">{value}</p></div></div>)}
                  </div>
                  <button type="button" onClick={() => setView("discografia")} className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/[0.07] px-4 py-3 text-[9px] font-black uppercase tracking-[0.12em] text-white/55">Ver toda la discografía <ChevronRight className="h-4 w-4" /></button>
                </article>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6">
                <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Catálogo</p><h2 className="mt-2 text-xl font-black">Canciones con más movimiento</h2></div><button type="button" onClick={() => setView("discografia")} className="text-[9px] font-black uppercase tracking-[0.12em] text-white/35">Ver todas</button></div>
                <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-white/[0.07] text-[8px] font-black uppercase tracking-[0.15em] text-white/25"><th className="pb-3">Canción</th><th className="pb-3 text-right">Streams hoy</th><th className="pb-3 text-right">Streams totales</th><th className="pb-3 text-right">% del día</th></tr></thead><tbody>{tracks.slice(0, 5).map((track, index) => <tr key={`${track.title}-${index}`} className="border-b border-white/[0.045] last:border-0"><td className="py-3.5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white/[0.04] text-[10px] font-black text-white/25">{track.coverUrl ? <img src={track.coverUrl} alt="" className="h-full w-full object-cover" /> : index + 1}</span><span className="max-w-[300px] truncate text-sm font-bold">{track.title}</span></div></td><td className="py-3.5 text-right text-sm font-black text-[#39FF14]">{exact(track.daily)}</td><td className="py-3.5 text-right text-sm font-bold text-white/55">{exact(track.streams)}</td><td className="py-3.5 text-right text-sm font-black text-white/45">{dailyStreams ? `${(track.daily / dailyStreams * 100).toFixed(1)}%` : "—"}</td></tr>)}</tbody></table></div>
              </section>
            </div>
          )}

          {!isLoading && view === "discografia" && (
            <section className="mt-6 rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Catálogo completo</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">Discografía de Luis Miguel</h2>
                  <p className="mt-2 text-xs font-medium text-white/35">313 canciones y 45 álbumes con streams diarios y acumulados.</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                  <input
                    value={trackQuery}
                    onChange={event => { setTrackQuery(event.target.value); setVisibleTrackCount(50); }}
                    placeholder={catalogView === "canciones" ? "Buscar entre 313 canciones…" : "Buscar entre 45 álbumes…"}
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-3 text-xs font-bold outline-none focus:border-[#39FF14]/40"
                  />
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setCatalogView("canciones"); setTrackQuery(""); setVisibleTrackCount(50); }} className={`rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-[0.12em] ${catalogView === "canciones" ? "bg-[#39FF14] text-black" : "bg-white/[0.04] text-white/35"}`}>Canciones · 313</button>
                  <button type="button" onClick={() => { setCatalogView("albumes"); setTrackQuery(""); }} className={`rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-[0.12em] ${catalogView === "albumes" ? "bg-[#39FF14] text-black" : "bg-white/[0.04] text-white/35"}`}>Álbumes · 45</button>
                </div>
                <label className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.14em] text-white/25">
                  Ordenar
                  <select
                    value={catalogSort}
                    onChange={event => { setCatalogSort(event.target.value as CatalogSort); setVisibleTrackCount(50); }}
                    className="h-9 min-w-52 rounded-full border border-white/10 bg-[#0b0b0b] px-4 text-[9px] font-black uppercase tracking-[0.08em] text-white/65 outline-none transition hover:border-white/20 focus:border-[#39FF14]/40"
                    aria-label={`Ordenar ${catalogView === "canciones" ? "canciones" : "álbumes"}`}
                  >
                    <option value="daily-desc">Más reproducciones hoy</option>
                    <option value="daily-asc">Menos reproducciones hoy</option>
                    <option value="total-desc">Más reproducciones acumuladas</option>
                    <option value="total-asc">Menos reproducciones acumuladas</option>
                    <option value="title-asc">Nombre A–Z</option>
                    <option value="title-desc">Nombre Z–A</option>
                  </select>
                </label>
              </div>
              {catalogView === "canciones" ? (
                <>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left">
                      <thead><tr className="text-[8px] font-black uppercase tracking-[0.15em] text-white/25"><th className="py-4">#</th><th className="py-4">Canción</th><th className="py-4 text-right">Streams hoy</th><th className="py-4 text-right">% del día</th><th className="py-4 text-right">Streams totales</th></tr></thead>
                      <tbody>{visibleTracks.map((track, index) => <tr key={track.id ?? `${track.title}-${index}`} className="border-t border-white/[0.055]"><td className="py-4 text-xs font-black text-white/20">{String(index + 1).padStart(3, "0")}</td><td className="py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/[0.04] text-white/20">{track.coverUrl ? <img src={track.coverUrl} alt="" className="h-full w-full object-cover" /> : <Music2 className="h-4 w-4" />}</span><div className="min-w-0"><p className="max-w-[330px] truncate text-sm font-black">{track.title}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/25">Luis Miguel</p></div></div></td><td className="py-4 text-right text-sm font-black text-[#39FF14]">{exact(track.daily)}</td><td className="py-4 text-right text-sm font-bold text-white/45">{dailyStreams ? `${(track.daily / dailyStreams * 100).toFixed(2)}%` : "—"}</td><td className="py-4 text-right text-sm font-black">{exact(track.streams)}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <div className="mt-5 flex flex-col items-center gap-3 border-t border-white/[0.06] pt-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/25">Mostrando {Math.min(visibleTracks.length, tracks.length)} de {tracks.length} canciones</p>
                    {visibleTracks.length < tracks.length && <button type="button" onClick={() => setVisibleTrackCount(count => count + 50)} className="rounded-full border border-white/10 bg-white/[0.035] px-5 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/60 hover:border-[#39FF14]/30 hover:text-white">Mostrar 50 más</button>}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-5 text-[10px] font-medium leading-5 text-white/30">Cada cifra corresponde a ese lanzamiento de Spotify. Reediciones y recopilaciones pueden compartir canciones.</p>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left">
                      <thead><tr className="text-[8px] font-black uppercase tracking-[0.15em] text-white/25"><th className="py-4">#</th><th className="py-4">Álbum</th><th className="py-4 text-right">Streams hoy</th><th className="py-4 text-right">Streams totales</th><th className="py-4 text-right">Abrir</th></tr></thead>
                      <tbody>{albums.map((album, index) => <tr key={album.id ?? `${album.title}-${index}`} className="border-t border-white/[0.055]"><td className="py-4 text-xs font-black text-white/20">{String(index + 1).padStart(2, "0")}</td><td className="py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#39FF14]/10 text-[#39FF14]">{album.coverUrl ? <img src={album.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Disc3 className="h-4 w-4" />}</span><div className="min-w-0"><p className="max-w-[360px] truncate text-sm font-black">{album.title}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/25">Luis Miguel · Álbum</p></div></div></td><td className="py-4 text-right text-sm font-black text-[#39FF14]">{exact(album.daily)}</td><td className="py-4 text-right text-sm font-black">{exact(album.streams)}</td><td className="py-4 text-right">{album.spotifyUrl ? <a href={album.spotifyUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/35 hover:border-[#39FF14]/30 hover:text-[#39FF14]" aria-label={`Abrir ${album.title} en Spotify`}><ArrowUpRight className="h-3.5 w-3.5" /></a> : "—"}</td></tr>)}</tbody>
                    </table>
                  </div>
                  <p className="mt-5 border-t border-white/[0.06] pt-5 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-white/25">45 álbumes · Datos al {dateLabel(LUIS_MIGUEL_CATALOG_UPDATED)}</p>
                </>
              )}
            </section>
          )}

          {!isLoading && view === "historial" && (
            <div className="mt-6 space-y-6">
              <section className="overflow-hidden rounded-2xl border border-[#39FF14]/15 bg-[#39FF14]/[0.035] p-5 sm:p-7">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Archivo permanente</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">Streams por día, mes y año</h2>
                    <p className="mt-3 text-xs font-medium leading-5 text-white/45">Cada captura diaria queda guardada. Los totales mensuales y anuales se calculan con esas capturas y siempre indican cuántos días están cubiertos.</p>
                  </div>
                  <div className="flex shrink-0 gap-1 rounded-full border border-white/[0.08] bg-black/25 p-1" aria-label="Periodo del historial de streams">
                    {(["daily", "monthly", "yearly"] as StreamArchivePeriod[]).map(period => (
                      <button key={period} type="button" onClick={() => setStreamArchivePeriod(period)} className={`rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-[0.1em] ${streamArchivePeriod === period ? "bg-[#39FF14] text-black" : "text-white/35"}`}>
                        {period === "daily" ? "Día" : period === "monthly" ? "Mes" : "Año"}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Días guardados" value={exact(archiveObservedDays)} exactValue={archiveStartDate && archiveEndDate ? `${dateLabel(archiveStartDate)} — ${dateLabel(archiveEndDate)}` : undefined} icon={CalendarDays} />
                <MetricCard label="Streams de la última captura" value={compact(dailyStreams)} exactValue={exact(dailyStreams)} icon={Play} />
                <MetricCard label={`Streams en el ${streamArchivePeriod === "daily" ? "historial visible" : streamArchivePeriod === "monthly" ? "periodo mensual" : "periodo anual"}`} value={compact(archivedStreamTotal)} exactValue={exact(archivedStreamTotal)} icon={BarChart3} />
                <MetricCard label="Piezas monitoreadas" value={exact(DEMO_TRACKS.length + LUIS_MIGUEL_ALBUMS.length)} exactValue={`${DEMO_TRACKS.length} canciones · ${LUIS_MIGUEL_ALBUMS.length} álbumes`} icon={Disc3} />
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Total del artista</p>
                    <h2 className="mt-2 text-xl font-black">Reproducciones {streamArchivePeriod === "daily" ? "diarias" : streamArchivePeriod === "monthly" ? "por mes" : "por año"}</h2>
                  </div>
                  <p className="text-[9px] font-bold text-white/30">{archiveObservedDays} días observados · las fechas sin captura no se estiman</p>
                </div>
                <div className="mt-6 h-72 w-full">
                  {archivedStreamHistory.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={archivedStreamHistory}>
                        <defs><linearGradient id="archiveGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity={0.35} /><stop offset="100%" stopColor={GREEN} stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} minTickGap={24} />
                        <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 9 }} tickFormatter={value => compact(value)} tickLine={false} axisLine={false} width={48} />
                        <Tooltip contentStyle={{ background: "#0b0b0b", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 11 }} formatter={(value: number) => [exact(value), "Streams guardados"]} labelFormatter={(_label, payload) => payload?.[0]?.payload ? `${payload[0].payload.period} · ${payload[0].payload.observedDays} día${payload[0].payload.observedDays === 1 ? "" : "s"}` : ""} />
                        <Area type="monotone" dataKey="streams" stroke={GREEN} fill="url(#archiveGreen)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-xs font-bold text-white/25">El archivo comenzará con la primera captura</div>}
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                {[
                  { title: "Canciones con más streams hoy", items: sortCatalog(DEMO_TRACKS, "daily-desc").slice(0, 10), icon: Music2 },
                  { title: "Álbumes con más streams hoy", items: sortCatalog(LUIS_MIGUEL_ALBUMS, "daily-desc").slice(0, 10), icon: Album },
                ].map(({ title, items, icon: Icon }) => (
                  <article key={title} className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Última captura guardada</p><h3 className="mt-2 text-lg font-black">{title}</h3></div>
                      <Icon className="h-5 w-5 text-[#39FF14]" />
                    </div>
                    <div className="mt-5 space-y-1">
                      {items.map((item, index) => (
                        <div key={item.id ?? `${item.title}-${index}`} className="flex items-center gap-3 border-t border-white/[0.055] py-3 first:border-0">
                          <span className="w-6 text-[9px] font-black text-white/20">{String(index + 1).padStart(2, "0")}</span>
                          <span className="min-w-0 flex-1 truncate text-xs font-bold">{item.title}</span>
                          <span className="text-xs font-black text-[#39FF14]">{exact(item.daily)}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </section>

              <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#39FF14]/10 text-[#39FF14]"><CheckCircle2 className="h-5 w-5" /></span>
                  <div><h3 className="text-sm font-black">Historial de cada canción y álbum</h3><p className="mt-1 max-w-3xl text-xs font-medium leading-5 text-white/40">Desde la activación del monitor, cada pieza recibe una captura diaria propia. Al acumularse las fechas, esta misma vista permitirá abrir cualquier canción o álbum y comparar sus streams por día, mes o año sin perder los datos anteriores.</p></div>
                </div>
                <button type="button" onClick={() => setView("discografia")} className="shrink-0 rounded-full border border-white/10 px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/60">Ver las 358 piezas</button>
              </section>
            </div>
          )}

          {!isLoading && view === "audiencia" && (
            <div className="mt-6 space-y-6">
              <section className="flex flex-col gap-5 rounded-2xl border border-[#39FF14]/15 bg-[#39FF14]/[0.035] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Evolución, no solo una foto</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Cómo está cambiando la audiencia</h2>
                  <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-white/40">El perfil público muestra las cifras actuales. El monitor compara periodos, cuantifica los cambios y conserva el contexto histórico.</p>
                </div>
                <div className="flex shrink-0 gap-1 rounded-full border border-white/[0.08] bg-black/25 p-1" aria-label="Periodo de audiencia">
                  {(["days7", "days30", "days90"] as AudiencePeriod[]).map(period => (
                    <button key={period} type="button" onClick={() => setAudiencePeriod(period)} className={`rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-[0.1em] ${audiencePeriod === period ? "bg-[#39FF14] text-black" : "text-white/35"}`}>
                      {period === "days7" ? "7 días" : period === "days30" ? "30 días" : "90 días"}
                    </button>
                  ))}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
                  <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/25">Mejor impulso porcentual</p>
                  <p className="mt-4 text-lg font-black">{strongestAudienceGrowth?.label ?? "Sin datos"}</p>
                  <p className="mt-1 text-2xl font-black text-[#39FF14]">{strongestAudienceGrowth?.change?.percentage == null ? "—" : percentage(strongestAudienceGrowth.change.percentage)}</p>
                </article>
                <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
                  <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/25">Mayor ganancia absoluta</p>
                  <p className="mt-4 text-lg font-black">{largestAudienceGain?.label ?? "Sin datos"}</p>
                  <p className="mt-1 text-2xl font-black text-[#39FF14]">{signedExact(largestAudienceGain?.change?.absolute)}</p>
                </article>
                <article className="rounded-2xl border border-white/[0.07] bg-[#111] p-5">
                  <p className="text-[8px] font-black uppercase tracking-[0.15em] text-white/25">Mayor retroceso</p>
                  <p className="mt-4 text-lg font-black">{largestAudienceDecline?.label ?? "Ninguno"}</p>
                  <p className={`mt-1 text-2xl font-black ${largestAudienceDecline ? "text-amber-300" : "text-white/30"}`}>{largestAudienceDecline?.change?.percentage == null ? "—" : percentage(largestAudienceDecline.change.percentage)}</p>
                </article>
              </section>

              <section>
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Cobertura adicional</p>
                    <h2 className="mt-2 text-2xl font-black">Más señales del artista</h2>
                  </div>
                  <p className="text-[9px] font-bold text-white/25">Última captura · {dateLabel(snapshot?.snapshotDate)}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Seguidores en X" value={compact(snapshot?.twitterFollowers)} exactValue={exact(snapshot?.twitterFollowers)} growth={growth?.twitterFollowers?.days30?.percentage} icon={CircleUserRound} accent="#D4D4D4" />
                  <MetricCard label="Seguidores en SoundCloud" value={compact(snapshot?.soundcloudFollowers)} exactValue={exact(snapshot?.soundcloudFollowers)} growth={growth?.soundcloudFollowers?.days30?.percentage} icon={Headphones} accent="#FF6A00" />
                  <MetricCard label="Vistas del canal de YouTube" value={compact(resolvedYoutube.viewCount)} exactValue={exact(resolvedYoutube.viewCount)} growth={resolvedYoutube.analytics.views.average30DayChangePct} icon={Youtube} accent="#FF4343" />
                  <MetricCard label="Popularidad en Spotify" value={snapshot?.spotifyPopularity == null ? "—" : `${snapshot.spotifyPopularity}/100`} exactValue="Índice relativo de Spotify" icon={TrendingUp} accent="#1DB954" />
                </div>
              </section>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(330px,.75fr)]">
                <section className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-7">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Crecimiento por plataforma</p>
                  <h2 className="mt-2 text-2xl font-black">Cambios del periodo</h2>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {audiencePlatforms.map(platform => {
                      const change = platform.periods?.[audiencePeriod];
                      return (
                        <article key={platform.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[9px] font-black uppercase tracking-[0.13em]" style={{ color: platform.color }}>{platform.label}</span>
                            {change?.percentage != null && <GrowthBadge value={change.percentage} />}
                          </div>
                          <p className="mt-5 text-2xl font-black">{signedExact(change?.absolute)}</p>
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/25">Cambio en {audiencePeriod === "days7" ? "7 días" : audiencePeriod === "days30" ? "30 días" : "90 días"}</p>
                          <div className="mt-4 border-t border-white/[0.055] pt-3">
                            <p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/20">{platform.metric} actuales</p>
                            <p className="mt-1 text-xs font-bold text-white/55">{exact(platform.current)}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-7">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">México · contexto histórico</p>
                  <h2 className="mt-2 text-2xl font-black">Ciudades frente a su pico</h2>
                  <p className="mt-2 text-xs font-medium leading-5 text-white/35">Compara la audiencia actual con el máximo disponible de cada ciudad.</p>
                  <div className="mt-7 space-y-5">
                    {resolvedSongstats.topMexicoCities.map((city, index) => {
                      const distanceFromPeak = city.peakListeners ? (city.currentListeners / city.peakListeners - 1) * 100 : null;
                      return (
                        <div key={city.name} className="flex items-start gap-3">
                          <span className="mt-0.5 text-[9px] font-black text-white/20">{String(index + 1).padStart(2, "0")}</span>
                          <MapPin className="mt-0.5 h-3.5 w-3.5 text-[#39FF14]" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-bold">{city.name === "Mexico City" ? "Ciudad de México" : city.name}</span><span className="text-xs font-black">{exact(city.currentListeners)}</span></div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[#39FF14]" style={{ width: `${Math.max(4, city.peakListeners ? city.currentListeners / city.peakListeners * 100 : 0)}%` }} /></div>
                            <div className="mt-2 flex justify-between text-[8px] font-bold uppercase tracking-[0.08em] text-white/20"><span>{topMexicoCityListeners ? `${(city.currentListeners / topMexicoCityListeners * 100).toFixed(1)}% del Top 5` : "—"}</span><span>Pico {exact(city.peakListeners)}</span></div>
                            <p className={`mt-1 text-right text-[8px] font-black uppercase tracking-[0.08em] ${distanceFromPeak != null && distanceFromPeak < 0 ? "text-amber-300/70" : "text-[#39FF14]"}`}>{distanceFromPeak == null ? "—" : `${distanceFromPeak.toFixed(1)}% vs. pico`}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
                <section className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-7">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Velocidad de crecimiento</p>
                  <h2 className="mt-2 text-2xl font-black">¿La audiencia está acelerando?</h2>
                  <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-white/35">Compara la ganancia diaria promedio de los últimos 7 días con el ritmo promedio de los últimos 30.</p>
                  <div className="mt-6 space-y-3 sm:hidden">
                    {audienceVelocity.map(platform => (
                      <article key={platform.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                        <div className="flex items-center justify-between gap-3"><p className="text-xs font-black" style={{ color: platform.color }}>{platform.label}</p><p className={`text-[8px] font-black uppercase tracking-[0.08em] ${platform.positiveSignal ? "text-[#39FF14]" : "text-amber-300"}`}>{platform.signal}</p></div>
                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.055] pt-4">
                          <div><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/20">Promedio 7 días</p><p className="mt-1 text-sm font-black">{signedExact(Math.round(platform.recentDaily))}<span className="ml-1 text-[8px] text-white/20">/día</span></p></div>
                          <div><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/20">Promedio 30 días</p><p className="mt-1 text-sm font-black text-white/45">{signedExact(Math.round(platform.monthlyDaily))}<span className="ml-1 text-[8px] text-white/20">/día</span></p></div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="mt-6 hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[610px] text-left">
                      <thead><tr className="border-b border-white/[0.07] text-[8px] font-black uppercase tracking-[0.14em] text-white/25"><th className="pb-4">Plataforma</th><th className="pb-4 text-right">Promedio 7d</th><th className="pb-4 text-right">Promedio 30d</th><th className="pb-4 text-right">Señal</th></tr></thead>
                      <tbody>
                        {audienceVelocity.map(platform => {
                          return <tr key={platform.label} className="border-b border-white/[0.055] last:border-0"><td className="py-4 text-xs font-black" style={{ color: platform.color }}>{platform.label}</td><td className="py-4 text-right text-xs font-black text-white/70">{signedExact(Math.round(platform.recentDaily))}<span className="ml-1 text-[8px] text-white/20">/día</span></td><td className="py-4 text-right text-xs font-bold text-white/35">{signedExact(Math.round(platform.monthlyDaily))}<span className="ml-1 text-[8px] text-white/20">/día</span></td><td className={`py-4 text-right text-[9px] font-black uppercase tracking-[0.08em] ${platform.positiveSignal ? "text-[#39FF14]" : "text-amber-300"}`}>{platform.signal}</td></tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="min-w-0 rounded-2xl border border-[#39FF14]/15 bg-[#39FF14]/[0.025] p-5 sm:p-7">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Lectura de Mexico Charts</p>
                  <h2 className="mt-2 text-2xl font-black">Señales que no muestra el perfil público</h2>
                  <div className="mt-6 space-y-3">
                    <article className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                      <p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/25">Profundidad de Spotify</p>
                      <p className="mt-3 text-2xl font-black text-[#39FF14]">{spotifyAudienceRatio == null ? "—" : spotifyAudienceRatio.toFixed(1)}</p>
                      <p className="mt-1 text-[9px] font-bold leading-4 text-white/35">oyentes mensuales por cada 100 seguidores</p>
                    </article>
                    <article className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                      <p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/25">Mayor aceleración reciente</p>
                      <div className="mt-3 flex items-end justify-between gap-3"><p className="text-lg font-black">{fastestAudienceAcceleration?.label ?? "—"}</p><p className="text-sm font-black text-[#39FF14]">{fastestAudienceAcceleration ? `${signedExact(Math.round(fastestAudienceAcceleration.acceleration))}/día` : "—"}</p></div>
                      <p className="mt-2 text-[9px] font-bold leading-4 text-white/30">Diferencia entre el ritmo diario de 7 días y el promedio diario de 30 días.</p>
                    </article>
                    <article className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                      <p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/25">Mayor oportunidad de recuperación</p>
                      <div className="mt-3 flex items-end justify-between gap-3"><p className="text-lg font-black">{largestCityRecoveryGap?.name === "Mexico City" ? "Ciudad de México" : largestCityRecoveryGap?.name ?? "—"}</p><p className="text-sm font-black text-amber-300">{largestCityRecoveryGap ? exact(largestCityRecoveryGap.gap) : "—"}</p></div>
                      <p className="mt-2 text-[9px] font-bold leading-4 text-white/30">Oyentes por debajo de su máximo histórico disponible.</p>
                    </article>
                  </div>
                  <p className="mt-5 border-t border-white/[0.06] pt-4 text-[8px] font-medium leading-4 text-white/20">La relación de Spotify compara dos métricas distintas; ayuda a contextualizar el alcance, pero no representa una tasa de conversión.</p>
                </section>
              </div>

              <section className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Historial de audiencia</p>
                    <h2 className="mt-2 text-2xl font-black">Evolución por plataforma</h2>
                    <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-white/35">{hasContinuousAudienceTrend ? "Serie histórica guardada a partir de las capturas disponibles." : "Comparación reconstruida con los cambios disponibles de 7, 30 y 90 días."}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 sm:text-right">
                    <p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/25">Valor actual</p>
                    <p className="mt-1 text-xl font-black" style={{ color: selectedAudienceTrend.color }}>{exact(selectedAudienceTrend.current)}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2" aria-label="Métrica histórica">
                  {audienceTrendOptions.map(option => (
                    <button key={option.id} type="button" onClick={() => setAudienceTrendMetric(option.id)} className={`rounded-full border px-4 py-2 text-[9px] font-black uppercase tracking-[0.1em] transition ${audienceTrendMetric === option.id ? "border-[#39FF14]/35 bg-[#39FF14]/10 text-[#39FF14]" : "border-white/[0.07] bg-white/[0.025] text-white/30 hover:text-white/60"}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
                {audienceTrendData.length > 1 ? (
                  <div className="mt-7 h-64 w-full sm:h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={audienceTrendData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="audienceListenerFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={selectedAudienceTrend.color} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={selectedAudienceTrend.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={28} tick={{ fill: "rgba(255,255,255,.3)", fontSize: 10, fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} width={54} tickFormatter={value => compact(Number(value))} tick={{ fill: "rgba(255,255,255,.25)", fontSize: 9, fontWeight: 700 }} domain={["dataMin - 250000", "dataMax + 250000"]} />
                        <Tooltip
                          cursor={{ stroke: selectedAudienceTrend.color, strokeOpacity: .3, strokeWidth: 1 }}
                          contentStyle={{ background: "#090909", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, fontSize: 11 }}
                          formatter={(value: number) => [exact(value), selectedAudienceTrend.valueLabel]}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ""}
                          labelStyle={{ color: "rgba(255,255,255,.45)", fontWeight: 800, marginBottom: 4 }}
                        />
                        <Area type="monotone" dataKey="value" stroke={selectedAudienceTrend.color} strokeWidth={2.5} fill="url(#audienceListenerFill)" dot={hasContinuousAudienceTrend ? false : { r: 4, fill: "#070707", stroke: selectedAudienceTrend.color, strokeWidth: 2 }} activeDot={{ r: 5, fill: selectedAudienceTrend.color, stroke: "#070707", strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : <EmptyState title="Historial no disponible" body="Aún no hay suficientes puntos comparables para construir esta vista." />}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-[#111] p-5 sm:p-7">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Comparación completa</p>
                <h2 className="mt-2 text-2xl font-black">Matriz de crecimiento multiplataforma</h2>
                <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-white/35">Compara el porcentaje de cambio por plataforma sin sumar seguidores ni suscriptores de redes distintas.</p>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left">
                    <thead>
                      <tr className="border-b border-white/[0.07] text-[8px] font-black uppercase tracking-[0.15em] text-white/25">
                        <th className="pb-4">Plataforma</th>
                        <th className="pb-4 text-right">Actual</th>
                        <th className="pb-4 text-right">7 días</th>
                        <th className="pb-4 text-right">30 días</th>
                        <th className="pb-4 text-right">90 días</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audiencePlatforms.map(platform => (
                        <tr key={platform.label} className="border-b border-white/[0.055] last:border-0">
                          <td className="py-4">
                            <p className="text-xs font-black" style={{ color: platform.color }}>{platform.label}</p>
                            <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.1em] text-white/20">{platform.metric}</p>
                          </td>
                          <td className="py-4 text-right text-xs font-black text-white/70">{exact(platform.current)}</td>
                          {(["days7", "days30", "days90"] as AudiencePeriod[]).map(period => {
                            const change = platform.periods?.[period];
                            const value = change?.percentage;
                            return (
                              <td key={period} className={`py-4 text-right text-xs font-black ${value == null ? "text-white/20" : value >= 0 ? "text-[#39FF14]" : "text-amber-300"}`}>
                                <span>{percentage(value)}</span>
                                {change?.absolute != null && <span className="mt-1 block text-[8px] font-bold text-white/20">{signedExact(change.absolute)}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {!isLoading && view === "alertas" && (
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
              <section className="relative overflow-hidden rounded-2xl border border-[#39FF14]/25 bg-[#111] p-6 sm:p-8">
                <div className="absolute right-[-8%] top-[-35%] h-72 w-72 rounded-full bg-[#39FF14]/10 blur-3xl" />
                <div className="relative">
                  <div className="flex flex-wrap items-center justify-between gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#39FF14] text-black"><Award className="h-6 w-6" /></span><span className="rounded-full border border-[#39FF14]/20 bg-[#39FF14]/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.13em] text-[#39FF14]">Vista previa de alerta</span></div>
                  <p className="mt-8 text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Nueva certificación detectada</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">México Por Siempre</h2>
                  <p className="mt-2 text-lg font-black text-white/70">3× Platino · Álbum</p>
                  <div className="mt-6 flex flex-wrap gap-2"><span className="rounded-full bg-white/[0.045] px-3 py-2 text-[9px] font-bold text-white/45">Luis Miguel</span><span className="rounded-full bg-white/[0.045] px-3 py-2 text-[9px] font-bold text-white/45">Registro fechado 25 oct 2018</span><span className="rounded-full bg-white/[0.045] px-3 py-2 text-[9px] font-bold text-white/45">Fuente: AMPROFON</span></div>
                  <p className="mt-6 max-w-2xl border-t border-white/[0.07] pt-5 text-xs font-medium leading-5 text-white/30">Este ejemplo utiliza un registro real del historial de Luis Miguel para mostrar cómo aparecerá una futura alerta. No representa una certificación nueva de 2026.</p>
                </div>
              </section>
              <section className="rounded-2xl border border-white/[0.07] bg-[#111] p-6">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Configuración</p><h2 className="mt-2 text-xl font-black">Alertas activadas</h2>
                <div className="mt-6 space-y-3">{[["Certificaciones nuevas", "Aviso inmediato"], ["Resumen mensual", "Incluido en el reporte"], ["Cambios importantes", "Audiencia y catálogo"]].map(([title, detail]) => <div key={title} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-[#39FF14]" /><div><p className="text-xs font-black">{title}</p><p className="mt-1 text-[9px] font-bold text-white/25">{detail}</p></div></div>)}</div>
              </section>
              <section className="rounded-2xl border border-white/[0.07] bg-[#111] p-6 sm:p-7 xl:col-span-2">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Historial verificado</p><h2 className="mt-2 text-2xl font-black">Certificaciones de Luis Miguel</h2>
                <div className="mt-6 grid gap-3 md:grid-cols-3">{DEMO_CERTIFICATIONS.map(certification => <article key={`${certification.title}-${certification.date}`} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-5"><div className="flex items-center justify-between gap-3"><Award className="h-5 w-5 text-[#39FF14]" /><span className="text-[8px] font-black uppercase tracking-[0.12em] text-white/25">{certification.format}</span></div><h3 className="mt-5 text-base font-black">{certification.title}</h3><p className="mt-2 text-sm font-black text-[#39FF14]">{certification.level}</p><p className="mt-4 text-[9px] font-bold text-white/25">Fecha del registro · {dateLabel(certification.date)}</p></article>)}</div>
              </section>
            </div>
          )}

          {!isLoading && view === "reportes" && (
            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_.8fr]">
              <section className="relative overflow-hidden rounded-2xl border border-[#39FF14]/20 bg-[#111] p-6 sm:p-8"><div className="absolute right-[-10%] top-[-30%] h-72 w-72 rounded-full bg-[#39FF14]/10 blur-3xl" /><div className="relative"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#39FF14] text-black"><FileText className="h-6 w-6" /></span><p className="mt-8 text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Reporte más reciente</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em]">Luis Miguel · Agosto 2026</h2><p className="mt-3 max-w-lg text-sm font-medium leading-6 text-white/40">Cuatro páginas con audiencia, crecimiento, tendencias, ciudades principales y lectura mensual.</p><button type="button" className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[9px] font-black uppercase tracking-[0.13em] text-black"><Download className="h-4 w-4" /> Descargar PDF</button></div></section>
              <section className="rounded-2xl border border-white/[0.07] bg-[#111] p-6"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#39FF14]">Archivo</p><h2 className="mt-2 text-xl font-black">Historial de reportes</h2><div className="mt-6 space-y-3">{["Agosto 2026", "Julio 2026", "Junio 2026"].map((month, index) => <div key={month} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5"><CalendarDays className="h-4 w-4 text-white/25" /><div className="flex-1"><p className="text-xs font-black">{month}</p><p className="mt-1 text-[9px] font-bold text-white/25">{index === 0 ? "Disponible ahora" : "Archivo del monitor"}</p></div><Download className="h-4 w-4 text-white/25" /></div>)}</div></section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

type ArtistProAccess = {
  allowed: true;
  source: "subscription" | "internal";
};

export default function MonitoringDashboard() {
  const auth = useMexicoAuth();
  const { data, error, isLoading } = useQuery<ArtistProAccess>({
    queryKey: ["artist-pro-access", auth.userId, "luis miguel"],
    enabled: auth.configured && auth.isSignedIn,
    retry: false,
    queryFn: async () => {
      const response = await authenticatedFetch(
        auth.getToken,
        "/api/monitoring/access/luis%20miguel",
      );
      const payload = await response.json().catch(() => ({})) as ArtistProAccess & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Artist Pro access is required");
      return payload;
    },
  });

  if (!auth.isLoaded || isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#070707] text-sm font-bold text-white/40">Verificando acceso Artist Pro…</main>;
  }

  if (!auth.configured || !auth.isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070707] px-6 text-white">
        <section className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.025] p-10 text-center">
          <h1 className="text-2xl font-black">Inicia sesión para abrir Artist Pro</h1>
          <p className="mt-3 text-sm leading-6 text-white/45">El panel requiere una cuenta autenticada con una suscripción activa o acceso interno autorizado.</p>
          {auth.configured && <button type="button" onClick={auth.openSignIn} className="mt-6 rounded-full bg-[#39FF14] px-5 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-black">Iniciar sesión</button>}
        </section>
      </main>
    );
  }

  if (error || !data?.allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070707] px-6 text-white">
        <section className="max-w-lg rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-10 text-center">
          <h1 className="text-2xl font-black">Se requiere Artist Pro</h1>
          <p className="mt-3 text-sm leading-6 text-white/45">{error instanceof Error ? error.message : "No se pudo verificar el acceso."}</p>
          <Link href="/cuenta" className="mt-6 inline-flex rounded-full border border-white/10 px-5 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-white/65">Volver a mi cuenta</Link>
        </section>
      </main>
    );
  }

  return <MonitoringDashboardContent />;
}
