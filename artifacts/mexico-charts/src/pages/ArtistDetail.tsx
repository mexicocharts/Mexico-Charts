import { type ReactNode, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { useArtistsWeekly, findArtistBySlug, useArtistMetadata, lookupArtistMetadata } from "@/services/dataProvider";
import { SHEET_SOURCES } from "@/config/sheetSources";
import { ArrowLeft, TrendingUp, Music, MapPin, Globe, Play, BadgeCheck, Database, ExternalLink } from "lucide-react";
import ArtistCertifications from "@/components/ArtistCertifications";
import PageSEO from "@/components/PageSEO";
import { SiSpotify, SiYoutube, SiInstagram, SiTiktok, SiSoundcloud } from "react-icons/si";
import { useArtistImages } from "@/hooks/useArtistImages";
import { useKworbStats, useRefreshStatus } from "@/hooks/useKworbStats";
import { useItunesArtist } from "@/hooks/useItunesArtist";
import { useWikiBio } from "@/hooks/useWikiBio";
import { useYoutubeChannel } from "@/hooks/useYoutubeChannel";
import { useArtistTouring } from "@/hooks/useTouring";
import { useArtistEnrichment } from "@/hooks/useArtistEnrichment";
import { slugify } from "@/lib/utils";

export { slugify };

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

/* ─── RELATIVE TIME IN SPANISH ───────────────────────────────── */
function fmtRelativeEs(ts: number | null): string {
  if (!ts) return "";
  const now = Date.now();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);

  const tsDate = new Date(ts);
  const todayDate = new Date();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(todayDate.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();

  if (diffMin < 2)                       return "hace un momento";
  if (diffMin < 60)                      return `hace ${diffMin} min`;
  if (diffHrs < 2)                       return "hace 1 hora";
  if (isSameDay(tsDate, todayDate))      return `hoy · hace ${diffHrs} horas`;
  if (isSameDay(tsDate, yesterdayDate))  return "ayer";
  return `hace ${Math.floor(diffMs / 86_400_000)} días`;
}

function formatTourDate(iso: string): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${day} ${months[Number(month) - 1]} ${year}`;
}

function formatShortDateEs(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function YoutubeDailySparkline({
  points,
  color,
  gradientId,
  ariaLabel = "Tendencia diaria de vistas del canal de YouTube",
}: {
  points: Array<{ date: string; dailyViews?: number | null; dailyStreams?: number | null }>;
  color: string;
  gradientId?: string;
  ariaLabel?: string;
}) {
  const values = points.map(point => point.dailyViews ?? point.dailyStreams ?? 0);
  const max = Math.max(...values, 1);
  const width = 300;
  const height = 72;
  const fillId = gradientId ?? `trendFill-${color.replace(/[^a-z0-9]/gi, "")}`;
  const path = values.map((value, index) => {
    const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
    const y = height - (value / max) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full overflow-visible" role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${height} ${path} ${width},${height}`}
        fill={`url(#${fillId})`}
        stroke="none"
      />
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function metricTone(value: number | null | undefined) {
  if (value == null || value === 0) return "text-zinc-500";
  return value > 0 ? "text-[#39FF14]" : "text-red-300";
}

function pctLabel(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function formatSignedMetric(value: number | null | undefined, formatted: string | null | undefined) {
  if (value == null || !formatted) return "—";
  return value > 0 ? `+${formatted}` : formatted;
}

function momentumLabel(trend: "rising" | "steady" | "cooling" | "new" | null | undefined) {
  if (trend === "rising") return "Subiendo";
  if (trend === "cooling") return "Bajando";
  if (trend === "new") return "Nueva señal";
  if (trend === "steady") return "Estable";
  return "Sin tendencia";
}

function normalizeSongMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(video oficial|official video|lyric video|lyrics|audio oficial|official audio|visualizer)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const CHART_POSITION_PLATFORMS = [
  { key: "spotifyMx", label: "Spotify", short: "SP", color: "#1DB954" },
  { key: "appleMusicMx", label: "Apple Music", short: "AM", color: "#fc3c44" },
  { key: "youtubeMx", label: "YouTube", short: "YT", color: "#ef4444" },
  { key: "itunesMx", label: "iTunes", short: "IT", color: "#39FF14" },
  { key: "deezerMx", label: "Deezer", short: "DZ", color: "#A238FF" },
] as const;

const TOURING_PROFILE_SLUGS: Record<string, string> = {
  "peso-pluma": "peso-pluma",
  "junior-h": "junior-h",
  "luis-miguel": "luis-miguel",
};

type ChartPositionPlatformKey = typeof CHART_POSITION_PLATFORMS[number]["key"];
type ChartPositionFilter = "all" | ChartPositionPlatformKey;

/* ─── ARTIST DATA ───────────────────────────────────────────── */
interface ArtistData {
  name: string;
  genre: string;
  subgenre: string;
  rank: number;
  listeners: string;
  listenersRaw: number;
  growth: string;
  origin: string;
  accent: string;
  bio: string;
  platformStreams: { platform: string; streams: string; streamsNum: number; color: string; icon: "spotify" | "youtube" | "apple" | "deezer" | "tiktok" | "instagram" | "soundcloud" }[];
  genreBreakdown: { genre: string; pct: number }[];
  tours: { name: string; dates: string; gross: string; cities: number }[];
  topSongs: { title: string; streams: string }[];
  // Metadata-sourced social/platform stats (populated when metadata sheet matches)
  spotifyFollowers?: string;
  youtubeSubscribers?: string;
  tiktokFollowers?: string;
  instagramFollowers?: string;
  deezerFans?: string;
  soundcloudFollowers?: string;
}

const ARTISTS: Record<string, ArtistData> = {
  "peso-pluma": {
    name: "Peso Pluma",
    genre: "Corridos Tumbados",
    subgenre: "Regional Mexicano",
    rank: 1,
    listeners: "32.4M",
    listenersRaw: 32.4,
    growth: "+18%",
    origin: "Guadalajara, Jalisco",
    accent: "#39FF14",
    bio: "Hassan Emilio Kabande Laija, conocido como Peso Pluma, es el artista mexicano más escuchado del mundo. Con su fusión de corridos tumbados y pop urbano se posicionó como el primer mexicano en encabezar el Global 200 de Billboard.",
    platformStreams: [
      { platform: "Spotify", streams: "18.4M", streamsNum: 18.4, color: "#1DB954", icon: "spotify" },
      { platform: "YouTube", streams: "8.2M",  streamsNum: 8.2,  color: "#FF0000", icon: "youtube" },
      { platform: "Apple Music", streams: "4.1M", streamsNum: 4.1, color: "#FF2D55", icon: "apple" },
      { platform: "Deezer", streams: "1.7M",   streamsNum: 1.7,  color: "#A238FF", icon: "deezer" },
    ],
    genreBreakdown: [
      { genre: "Corridos Tumbados", pct: 58 },
      { genre: "Regional Mexicano",  pct: 24 },
      { genre: "Pop Urbano",         pct: 12 },
      { genre: "Trap Latino",        pct: 6  },
    ],
    tours: [],
    topSongs: [
      { title: "Ella Baila Sola", streams: "4.2B" },
      { title: "Bzrp Music Sessions #55", streams: "3.8B" },
      { title: "La Bebe (Remix)", streams: "2.9B" },
      { title: "Paso", streams: "1.7B" },
      { title: "Teka", streams: "1.4B" },
    ],
  },
  "fuerza-regida": {
    name: "Fuerza Regida",
    genre: "Corridos Tumbados",
    subgenre: "Regional Mexicano",
    rank: 2,
    listeners: "12.4M",
    listenersRaw: 12.4,
    growth: "+31%",
    origin: "San Bernardino, California",
    accent: "rgba(57,255,20,0.85)",
    bio: "Fuerza Regida es el grupo que más rápido ha crecido en el género de corridos tumbados. Con su sonido crudo y letras directas, han conquistado ambos lados de la frontera y se han convertido en referente del movimiento.",
    platformStreams: [
      { platform: "Spotify", streams: "6.2M",  streamsNum: 6.2,  color: "#1DB954", icon: "spotify" },
      { platform: "YouTube", streams: "3.8M",  streamsNum: 3.8,  color: "#FF0000", icon: "youtube" },
      { platform: "Apple Music", streams: "1.6M", streamsNum: 1.6, color: "#FF2D55", icon: "apple" },
      { platform: "Deezer", streams: "0.8M",   streamsNum: 0.8,  color: "#A238FF", icon: "deezer" },
    ],
    genreBreakdown: [
      { genre: "Corridos Tumbados", pct: 65 },
      { genre: "Regional Mexicano",  pct: 22 },
      { genre: "Pop Urbano",         pct: 9  },
      { genre: "Banda",              pct: 4  },
    ],
    tours: [],
    topSongs: [
      { title: "Harley Quinn", streams: "1.1B" },
      { title: "PRC",          streams: "980M" },
      { title: "Bebe Dame",    streams: "820M" },
      { title: "Raíz",         streams: "640M" },
      { title: "Ch y la Pizza", streams: "590M" },
    ],
  },
  "natanael-cano": {
    name: "Natanael Cano",
    genre: "Corridos Tumbados",
    subgenre: "Regional Mexicano",
    rank: 3,
    listeners: "11.7M",
    listenersRaw: 11.7,
    growth: "+22%",
    origin: "Hermosillo, Sonora",
    accent: "rgba(57,255,20,0.72)",
    bio: "Natanael Cano es considerado el pionero del corrido tumbado moderno. Desde Hermosillo, Sonora, fusionó las tradiciones del corrido norteño con el trap y el urbano para crear un sonido que definió una generación entera.",
    platformStreams: [
      { platform: "Spotify", streams: "5.8M",  streamsNum: 5.8,  color: "#1DB954", icon: "spotify" },
      { platform: "YouTube", streams: "3.4M",  streamsNum: 3.4,  color: "#FF0000", icon: "youtube" },
      { platform: "Apple Music", streams: "1.7M", streamsNum: 1.7, color: "#FF2D55", icon: "apple" },
      { platform: "Deezer", streams: "0.8M",   streamsNum: 0.8,  color: "#A238FF", icon: "deezer" },
    ],
    genreBreakdown: [
      { genre: "Corridos Tumbados", pct: 72 },
      { genre: "Trap Latino",        pct: 16 },
      { genre: "Regional Mexicano",  pct: 8  },
      { genre: "Pop Urbano",         pct: 4  },
    ],
    tours: [],
    topSongs: [
      { title: "Amor Tumbado",   streams: "1.8B" },
      { title: "El Drip",        streams: "1.2B" },
      { title: "Soy El Diablo",  streams: "960M" },
      { title: "21 Savage",      streams: "740M" },
      { title: "CTs Plana",      streams: "620M" },
    ],
  },
  "junior-h": {
    name: "Junior H",
    genre: "Regional Mexicano",
    subgenre: "Corridos Tumbados",
    rank: 4,
    listeners: "9.8M",
    listenersRaw: 9.8,
    growth: "+15%",
    origin: "Guanajuato, México",
    accent: "rgba(255,255,255,0.7)",
    bio: "Junior H es uno de los artistas más versátiles del movimiento regional mexicano. Su habilidad para mezclar emociones crudas con beats modernos lo han convertido en favorito de millones de fans en México y Estados Unidos.",
    platformStreams: [
      { platform: "Spotify", streams: "4.8M",  streamsNum: 4.8,  color: "#1DB954", icon: "spotify" },
      { platform: "YouTube", streams: "2.9M",  streamsNum: 2.9,  color: "#FF0000", icon: "youtube" },
      { platform: "Apple Music", streams: "1.4M", streamsNum: 1.4, color: "#FF2D55", icon: "apple" },
      { platform: "Deezer", streams: "0.7M",   streamsNum: 0.7,  color: "#A238FF", icon: "deezer" },
    ],
    genreBreakdown: [
      { genre: "Regional Mexicano",  pct: 48 },
      { genre: "Corridos Tumbados", pct: 36 },
      { genre: "Banda",              pct: 10 },
      { genre: "Pop Urbano",         pct: 6  },
    ],
    tours: [],
    topSongs: [
      { title: "Mente en Blanco", streams: "980M" },
      { title: "Chuy",            streams: "760M" },
      { title: "Borrado de tu Mente", streams: "640M" },
      { title: "Mi Vecina",       streams: "520M" },
      { title: "Siempre Pendiente", streams: "440M" },
    ],
  },
  "carin-leon": {
    name: "Carin León",
    genre: "Regional Mexicano",
    subgenre: "Norteño / Banda",
    rank: 5,
    listeners: "7.1M",
    listenersRaw: 7.1,
    growth: "+28%",
    origin: "Hermosillo, Sonora",
    accent: "rgba(255,255,255,0.55)",
    bio: "Carin León ha redefinido lo que significa ser un artista regional mexicano global. Con una voz inconfundible y una presencia escénica poderosa, ha llevado la música de Sonora a los escenarios más grandes del mundo.",
    platformStreams: [
      { platform: "Spotify", streams: "3.4M",  streamsNum: 3.4,  color: "#1DB954", icon: "spotify" },
      { platform: "YouTube", streams: "2.1M",  streamsNum: 2.1,  color: "#FF0000", icon: "youtube" },
      { platform: "Apple Music", streams: "1.0M", streamsNum: 1.0, color: "#FF2D55", icon: "apple" },
      { platform: "Deezer", streams: "0.6M",   streamsNum: 0.6,  color: "#A238FF", icon: "deezer" },
    ],
    genreBreakdown: [
      { genre: "Regional Mexicano",  pct: 42 },
      { genre: "Norteño",            pct: 30 },
      { genre: "Banda",              pct: 20 },
      { genre: "Pop Urbano",         pct: 8  },
    ],
    tours: [],
    topSongs: [
      { title: "Que Vuelvas",          streams: "820M" },
      { title: "Primera Cita",         streams: "640M" },
      { title: "Según Quién",          streams: "590M" },
      { title: "Playa Grande",         streams: "480M" },
      { title: "Como Lo Hice Yo",      streams: "360M" },
    ],
  },
};

/* ─── FALLBACK DATA ──────────────────────────────────────────── */
function buildFallback(name: string): ArtistData {
  return {
    name,
    genre: "Regional Mexicano",
    subgenre: "México",
    rank: 0,
    listeners: "—",
    listenersRaw: 0,
    growth: "—",
    origin: "México",
    accent: "#39FF14",
    bio: `${name} es un artista del movimiento musical mexicano que ha ganado reconocimiento internacional con su sonido único.`,
    platformStreams: [
      { platform: "Spotify",     streams: "2.1M", streamsNum: 2.1, color: "#1DB954", icon: "spotify"   },
      { platform: "YouTube",     streams: "1.2M", streamsNum: 1.2, color: "#FF0000", icon: "youtube"   },
      { platform: "Apple Music", streams: "0.5M", streamsNum: 0.5, color: "#FF2D55", icon: "apple"     },
      { platform: "Deezer",      streams: "0.2M", streamsNum: 0.2, color: "#A238FF", icon: "deezer"    },
    ] as ArtistData["platformStreams"],
    genreBreakdown: [
      { genre: "Regional Mexicano",  pct: 55 },
      { genre: "Corridos Tumbados", pct: 30 },
      { genre: "Banda",              pct: 15 },
    ],
    tours: [],
    topSongs: [],
  };
}


/* ─── PAGE ───────────────────────────────────────────────────── */
export default function ArtistDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const reduced = useReducedMotion();
  const [showVerificationInfo, setShowVerificationInfo] = useState(false);
  const [chartPositionFilter, setChartPositionFilter] = useState<ChartPositionFilter>("all");

  /* ── Sheet data overlay ── */
  const { data: weeklyArtists, isEmpty: sheetsEmpty, isError: sheetsError, isLoading: sheetsLoading } = useArtistsWeekly();
  const { byKey: metaByKey, byName: metaByName } = useArtistMetadata();
  const showLoadingState = !!SHEET_SOURCES.artistsWeekly && sheetsLoading;
  const showErrorState   = !!SHEET_SOURCES.artistsWeekly && sheetsError && !sheetsLoading;
  const sheetArtist = useMemo(
    () => (!sheetsEmpty ? findArtistBySlug(weeklyArtists, slug) : undefined),
    [weeklyArtists, sheetsEmpty, slug]
  );

  /* ── Base artist data (hardcoded profile + rich detail) ── */
  const displayName = sheetArtist?.name ?? (
    ARTISTS[slug]?.name ??
    slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  );
  const baseArtist = ARTISTS[slug] ?? buildFallback(displayName);

  /* ── Metadata lookup — try slug-derived key first, then normalized name ── */
  // The artist_key in the sheet uses space-separated lowercase (e.g. "fuerza regida"),
  // which matches the slug with hyphens replaced by spaces.
  const slugAsKey = slug.replace(/-/g, " ");
  const metaArtist = useMemo(
    () => lookupArtistMetadata(slugAsKey, displayName, metaByKey, metaByName),
    [slugAsKey, displayName, metaByKey, metaByName]
  );

  /* ── Merge: base → chart sheet → metadata (priority order, highest last) ── */
  const artist: ArtistData = useMemo(() => {
    // 1. Start from base
    let merged: ArtistData = baseArtist;
    // 2. Overlay Spotify chart stats (rank, growth, genre, accent)
    if (sheetArtist) {
      merged = {
        ...merged,
        name: sheetArtist.name,
        rank: sheetArtist.mexicoRank,
        listeners: sheetArtist.listeners,
        listenersRaw: sheetArtist.listenersRaw / 1_000_000,
        growth: sheetArtist.growth,
        genre: sheetArtist.genre || merged.genre,
        subgenre: sheetArtist.subgenre || merged.subgenre,
        accent: sheetArtist.accent,
      };
    }
    // 3. Overlay all available metadata stats onto the profile object
    if (metaArtist) {
      merged = {
        ...merged,
        // Spotify
        ...(metaArtist.spotifyListeners > 0   && { listeners: metaArtist.spotifyListenersFmt, listenersRaw: metaArtist.spotifyListeners / 1_000_000 }),
        ...(metaArtist.spotifyFollowers > 0   && { spotifyFollowers: metaArtist.spotifyFollowersFmt }),
        // Social/platform stats
        ...(metaArtist.youtubeSubscribers > 0 && { youtubeSubscribers: metaArtist.youtubeSubscribersFmt }),
        ...(metaArtist.tiktokFollowers > 0    && { tiktokFollowers: metaArtist.tiktokFollowersFmt }),
        ...(metaArtist.instagramFollowers > 0 && { instagramFollowers: metaArtist.instagramFollowersFmt }),
        ...(metaArtist.deezerFans > 0         && { deezerFans: metaArtist.deezerFansFmt }),
        ...(metaArtist.soundcloudFollowers > 0 && { soundcloudFollowers: metaArtist.soundcloudFollowersFmt }),
      };
    }
    return merged;
  }, [sheetArtist, baseArtist, metaArtist]);


  const names = useMemo(() => [artist.name], [artist.name]);
  const artistImages = useArtistImages(names);
  const itunesData = useItunesArtist(artist.name);
  const wikiBio      = useWikiBio(artist.name);
  const ytChannel    = useYoutubeChannel(artist.name.toLowerCase());
  const enrichment   = useArtistEnrichment(slugAsKey);
  const isVerifiedArtist = Boolean(enrichment?.spotify || enrichment?.youtube || enrichment?.musicbrainz);
  const officialSourceCount = [enrichment?.spotify, enrichment?.youtube, enrichment?.musicbrainz].filter(Boolean).length;
  const spotifyUpdatedLabel = formatShortDateEs(enrichment?.spotify?.lastUpdated);
  const youtubeUpdatedLabel = formatShortDateEs(enrichment?.youtube?.cachedAt);
  const musicbrainzUpdatedLabel = formatShortDateEs(enrichment?.musicbrainz?.lastUpdated);
  const youtubeDailyTrend = useMemo(
    () => (ytChannel?.history ?? []).filter(point => point.dailyViews != null),
    [ytChannel?.history],
  );
  const youtubeAnalytics = ytChannel?.analytics;
  const youtubeSnapshotLabel = formatShortDateEs(ytChannel?.snapshotDate);
  const { data: artistTouring } = useArtistTouring(slug);
  const photo = artistImages[artist.name] ?? itunesData?.artworkUrlHd ?? null;
  const hasAudienceStats = Boolean(metaArtist && (
    metaArtist.spotifyListeners > 0 ||
    metaArtist.spotifyFollowers > 0 ||
    metaArtist.instagramFollowers > 0 ||
    metaArtist.tiktokFollowers > 0 ||
    metaArtist.youtubeSubscribers > 0 ||
    metaArtist.deezerFans > 0 ||
    ytChannel?.subscribersFmt ||
    ytChannel?.viewsFmt ||
    ytChannel?.videoCount != null
  ));

  const nextTourEvent = useMemo(() => {
    return artistTouring?.events?.[0] ?? null;
  }, [artistTouring]);
  const touringProfileSlug = TOURING_PROFILE_SLUGS[slug];

  /* ── Kworb lifetime streaming stats ── */
  const { data: kworbStats } = useKworbStats(artist.name);
  const spotifyKworbDailyTrend = useMemo(
    () => (kworbStats?.spotify?.history ?? []).filter(point => point.dailyStreams != null),
    [kworbStats?.spotify?.history],
  );
  const spotifyKworbAnalytics = kworbStats?.spotify?.analytics;
  const momentumSources = useMemo(() => {
    const sources: Array<{
      key: "youtube" | "spotify";
      label: string;
      kicker: string;
      color: string;
      icon: ReactNode;
      todayValue: string | null;
      totalValue: string | null;
      totalLabel: string;
      points: Array<{ date: string; dailyViews?: number | null; dailyStreams?: number | null }>;
      availableDays: number;
      snapshotLabel: string;
      average7: string | null;
      average30: string | null;
      average7Pct: number | null;
      average30Pct: number | null;
      weeklyGrowth: number | null;
      weeklyGrowthFmt: string | null;
      monthlyGrowth: number | null;
      monthlyGrowthFmt: string | null;
      biggestSpikeValue: string | null;
      biggestSpikeDate: string | null;
      trend: "rising" | "steady" | "cooling" | "new" | null | undefined;
      scoreFmt: string | null | undefined;
    }> = [];

    if (ytChannel) {
      sources.push({
        key: "youtube",
        label: "YouTube",
        kicker: "YouTube oficial",
        color: "#ef4444",
        icon: <SiYoutube className="h-5 w-5" />,
        todayValue: ytChannel.dailyViewsFmt,
        totalValue: ytChannel.viewsFmt,
        totalLabel: "vistas totales",
        points: youtubeDailyTrend,
        availableDays: youtubeAnalytics?.availableDays ?? youtubeDailyTrend.length,
        snapshotLabel: youtubeSnapshotLabel,
        average7: youtubeAnalytics?.views.average7DayFmt ?? null,
        average30: youtubeAnalytics?.views.average30DayFmt ?? null,
        average7Pct: youtubeAnalytics?.views.average7DayChangePct ?? null,
        average30Pct: youtubeAnalytics?.views.average30DayChangePct ?? null,
        weeklyGrowth: youtubeAnalytics?.views.weeklyGrowth ?? null,
        weeklyGrowthFmt: youtubeAnalytics?.views.weeklyGrowthFmt ?? null,
        monthlyGrowth: youtubeAnalytics?.views.monthlyGrowth ?? null,
        monthlyGrowthFmt: youtubeAnalytics?.views.monthlyGrowthFmt ?? null,
        biggestSpikeValue: youtubeAnalytics?.views.biggestSpike?.viewsFmt ?? null,
        biggestSpikeDate: youtubeAnalytics?.views.biggestSpike?.date ?? null,
        trend: youtubeAnalytics?.momentum.trend,
        scoreFmt: youtubeAnalytics?.momentum.scoreFmt,
      });
    }

    if (kworbStats?.spotify) {
      sources.push({
        key: "spotify",
        label: "Spotify",
        kicker: "Spotify",
        color: "#1DB954",
        icon: <SiSpotify className="h-5 w-5" />,
        todayValue: kworbStats.spotify.dailyStreamsFmt,
        totalValue: kworbStats.spotify.totalStreamsFmt,
        totalLabel: "streams totales",
        points: spotifyKworbDailyTrend,
        availableDays: spotifyKworbAnalytics?.availableDays ?? spotifyKworbDailyTrend.length,
        snapshotLabel: formatShortDateEs(spotifyKworbDailyTrend.at(-1)?.date),
        average7: spotifyKworbAnalytics?.streams.average7DayFmt ?? null,
        average30: spotifyKworbAnalytics?.streams.average30DayFmt ?? null,
        average7Pct: spotifyKworbAnalytics?.streams.average7DayChangePct ?? null,
        average30Pct: spotifyKworbAnalytics?.streams.average30DayChangePct ?? null,
        weeklyGrowth: spotifyKworbAnalytics?.streams.weeklyGrowth ?? null,
        weeklyGrowthFmt: spotifyKworbAnalytics?.streams.weeklyGrowthFmt ?? null,
        monthlyGrowth: spotifyKworbAnalytics?.streams.monthlyGrowth ?? null,
        monthlyGrowthFmt: spotifyKworbAnalytics?.streams.monthlyGrowthFmt ?? null,
        biggestSpikeValue: spotifyKworbAnalytics?.streams.biggestSpike?.streamsFmt ?? null,
        biggestSpikeDate: spotifyKworbAnalytics?.streams.biggestSpike?.date ?? null,
        trend: spotifyKworbAnalytics?.momentum.trend,
        scoreFmt: spotifyKworbAnalytics?.momentum.scoreFmt,
      });
    }

    return sources;
  }, [
    kworbStats?.spotify,
    spotifyKworbAnalytics,
    spotifyKworbDailyTrend,
    ytChannel,
    youtubeAnalytics,
    youtubeDailyTrend,
    youtubeSnapshotLabel,
  ]);

  /* ── Kworb refresh status (last scheduler run) ── */
  const { data: refreshStatus } = useRefreshStatus();
  const lastUpdatedLabel = fmtRelativeEs(refreshStatus?.lastRefreshedAt ?? null);

  /* ── Top tracks: only real kworb data — never show hardcoded fake tracks ── */
  const topTracks = useMemo(() => {
    if (kworbStats?.spotify?.topTracks?.length) {
      return kworbStats.spotify.topTracks.map(t => ({
        title: t.title,
        streams: t.streamsFmt,
        coverUrl: t.coverUrl ?? null,
      }));
    }
    return [];
  }, [kworbStats]);

  const chartPositions = useMemo(() => {
    const positions = kworbStats?.chartPositions ?? [];
    if (chartPositionFilter === "all") return positions;
    return positions.filter(position => position[chartPositionFilter] !== undefined);
  }, [kworbStats, chartPositionFilter]);

  const chartPositionCounts = useMemo(() => {
    const positions = kworbStats?.chartPositions ?? [];
    return CHART_POSITION_PLATFORMS.reduce((counts, platform) => {
      counts[platform.key] = positions.filter(position => position[platform.key] !== undefined).length;
      return counts;
    }, {} as Record<ChartPositionPlatformKey, number>);
  }, [kworbStats]);

  const chartVideoMatches = useMemo(
    () =>
      (kworbStats?.youtube?.topVideos ?? [])
        .filter(video => video.thumbnailUrl)
        .map(video => ({
          key: normalizeSongMatch(video.title),
          thumbnailUrl: video.thumbnailUrl,
        })),
    [kworbStats?.youtube?.topVideos],
  );

  const selectedChartPlatform = chartPositionFilter === "all"
    ? null
    : CHART_POSITION_PLATFORMS.find(platform => platform.key === chartPositionFilter) ?? null;

  const chartPositionTotal = kworbStats?.chartPositions?.length ?? 0;


  return (
    <div
      className="min-h-[100dvh] text-zinc-300 overflow-x-hidden selection:bg-[#39FF14] selection:text-black"
      style={{ background: "radial-gradient(ellipse 100% 50% at 50% 0%, rgba(57,255,20,0.022) 0%, transparent 55%), #050505" }}
      data-testid="page-artist-detail"
    >
      <PageSEO
        title={`${artist.name} — Perfil de artista | Mexico Charts`}
        description={`${artist.name}: perfil de artista con género, estadísticas de streaming, audiencia, redes sociales, certificaciones y datos de listas en México Charts.`}
        path={`/artist/${slug}`}
      />
      {/* ── ERROR BANNER — only when a sheet URL is configured but fetch failed ── */}
      {showErrorState && (
        <div
          className="px-6 py-2.5 flex items-center gap-3"
          style={{ background: "rgba(255,40,40,0.06)", borderBottom: "1px solid rgba(255,40,40,0.18)" }}
          data-testid="artist-error-banner"
        >
          <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,80,80,0.9)" }}>
            Fuente temporalmente no disponible
          </span>
          <span className="text-[10px] text-zinc-600 font-medium">
            · Mostrando datos de referencia mientras vuelve la conexión.
          </span>
        </div>
      )}

      {/* ── LOADING BANNER — when sheet URL is configured and data is loading ── */}
      {showLoadingState && (
        <div
          className="px-6 py-2 flex items-center gap-2"
          style={{ background: "rgba(57,255,20,0.04)", borderBottom: "1px solid rgba(57,255,20,0.1)" }}
          data-testid="artist-loading-banner"
        >
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#39FF14" }} />
          <span className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(57,255,20,0.7)" }}>
            Cargando datos en vivo…
          </span>
        </div>
      )}

      {/* ── NAV ── */}
      <nav
        className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{ background: "rgba(5,5,5,0.92)", backdropFilter: "blur(20px) saturate(180%)" }}
      >
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
          <Link href="/" className="flex-shrink-0" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90 hover:opacity-100 transition-opacity" />
          </Link>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Volver a la página anterior"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors duration-200 text-[11px] font-bold uppercase tracking-widest"
            data-testid="link-back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </button>
          <span className="min-w-0 truncate text-[10px] uppercase tracking-widest text-zinc-700 sm:text-[11px]">/ {artist.name}</span>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: "min(680px, calc(100svh - 56px))" }} data-testid="artist-hero">
        <div className="absolute inset-0" style={{ background: "#050505" }} />

        {!reduced && (
          <motion.div
            className="absolute pointer-events-none"
            style={{ width: 600, height: 600, left: "-8%", top: "-20%", borderRadius: "50%", background: `radial-gradient(circle, ${artist.accent}18 0%, transparent 65%)`, filter: "blur(80px)" }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Photo */}
        {photo && (
          <div
            className="pointer-events-none absolute bottom-0 right-[-18%] top-0 w-[92%] opacity-34 sm:right-0 sm:w-1/2 sm:opacity-100 md:w-2/5"
            style={{
              backgroundImage: `url(${photo})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              maskImage: "linear-gradient(to right, transparent 0%, black 48%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 48%)",
              filter: "saturate(0.55) contrast(1.1) brightness(0.78)",
            }}
          />
        )}

        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(5,5,5,0.98) 0%, rgba(5,5,5,0.78) 42%, rgba(5,5,5,0.38) 72%, transparent 92%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.58) 0%, rgba(5,5,5,0.1) 32%, rgba(5,5,5,0.68) 74%, #050505 100%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: NOISE_SVG, backgroundSize: "128px" }} />

        {/* Rank watermark */}
        {artist.rank > 0 && (
          <div className="absolute right-4 md:right-10 bottom-0 font-black leading-none select-none pointer-events-none" style={{ fontSize: "clamp(6rem,18vw,14rem)", color: "rgba(255,255,255,0.05)", lineHeight: 0.85 }}>
            {String(artist.rank).padStart(2, "0")}
          </div>
        )}

        <div className="relative mx-auto max-w-[1200px] px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-3 flex max-w-[min(100%,42rem)] flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black uppercase tracking-[0.24em] sm:text-[10px] sm:tracking-[0.32em]" style={{ color: artist.accent }}>
              {artist.rank > 0 ? `#${artist.rank} En México` : "Artista"}
              <span className="opacity-40">·</span>
              {artist.genre}
            </div>
            <h1
              className="mb-3 max-w-[11ch] break-words font-black uppercase leading-[0.88] tracking-tight text-white sm:max-w-[12ch]"
              style={{ fontSize: "clamp(2.25rem, 17vw, 6rem)", textShadow: "0 2px 60px rgba(0,0,0,0.98)" }}
            >
              {artist.name}
            </h1>
            {isVerifiedArtist && (
              <div className="relative mb-4 inline-block">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[#39FF14]/35"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035))",
                    border: "1px solid rgba(255,255,255,0.14)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.12)",
                    backdropFilter: "blur(18px) saturate(160%)",
                  }}
                  aria-label="Ver información de verificación de Mexico Charts"
                  aria-expanded={showVerificationInfo}
                  aria-controls="artist-verification-info"
                  onClick={() => setShowVerificationInfo(v => !v)}
                  onBlur={() => window.setTimeout(() => setShowVerificationInfo(false), 120)}
                  data-testid="artist-verified-badge"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${artist.accent}, rgba(57,255,20,0.68))`,
                      boxShadow: `0 0 18px ${artist.accent}55`,
                      color: "#050505",
                    }}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                    Verificado
                  </span>
                  <span className="hidden h-3 w-px bg-white/15 sm:block" />
                  <span className="hidden text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500 sm:inline">
                    Mexico Charts
                  </span>
                </button>
                {showVerificationInfo && (
                  <div
                    id="artist-verification-info"
                    role="status"
                    className="absolute left-0 top-[calc(100%+0.6rem)] z-30 w-[min(18rem,calc(100vw-3rem))] rounded-xl p-4 text-left"
                    style={{
                      background: "rgba(8,8,8,0.96)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      boxShadow: "0 18px 55px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
                      backdropFilter: "blur(18px) saturate(160%)",
                    }}
                    data-testid="artist-verification-info"
                  >
                    <div className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: artist.accent }}>
                      <BadgeCheck className="h-3.5 w-3.5" strokeWidth={3} />
                      Verificación Mexico Charts
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-zinc-400">
                      Este perfil fue enlazado con fuentes oficiales del artista, como Spotify, YouTube o MusicBrainz.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="mb-5 flex max-w-3xl flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
                <Globe className="h-3.5 w-3.5" style={{ color: artist.accent }} />
                {artist.origin}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
                {artist.listeners} oyentes
              </span>
              {artist.spotifyFollowers && (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
                  {artist.spotifyFollowers} seguidores
                </span>
              )}
              {artist.growth && artist.growth !== "—" && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]" style={{ background: `${artist.accent}12`, border: `1px solid ${artist.accent}24`, color: artist.accent }}>
                  <TrendingUp className="h-3.5 w-3.5" />
                  {artist.growth} esta semana
                </span>
              )}
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
              {wikiBio?.bio ?? artist.bio}
            </p>
            {wikiBio?.pageUrl && (
              <a
                href={wikiBio.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-700 hover:text-zinc-500 transition-colors duration-150"
              >
                Fuente: Wikipedia
              </a>
            )}

            {momentumSources.length > 0 && (
              <div
                className="mt-6 grid max-w-3xl gap-2 sm:grid-cols-2"
                data-testid="artist-hero-momentum"
              >
                {momentumSources.slice(0, 2).map(source => {
                  const hasDailyValue = source.todayValue != null;
                  const primaryValue = hasDailyValue ? source.todayValue : source.totalValue;
                  const primaryLabel = hasDailyValue ? "hoy" : source.totalLabel;
                  return (
                    <div
                      key={source.key}
                      className="relative overflow-hidden rounded-xl p-3.5 sm:p-4"
                      style={{
                        background: `linear-gradient(135deg, ${source.color}16, rgba(255,255,255,0.035))`,
                        border: `1px solid ${source.color}24`,
                        boxShadow: "0 16px 48px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
                        backdropFilter: "blur(16px) saturate(150%)",
                      }}
                    >
                      <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full blur-3xl" style={{ background: `${source.color}18` }} />
                      <div className="relative flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: source.color }}>
                            {source.icon}
                            {source.label}
                          </div>
                          <div className="mt-2 break-words text-[clamp(1.25rem,8vw,1.5rem)] font-black leading-none text-white">
                            {primaryValue ?? "—"}
                          </div>
                          <div className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
                            {primaryLabel}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={`text-sm font-black ${metricTone(source.weeklyGrowth)}`}>
                            {formatSignedMetric(source.weeklyGrowth, source.weeklyGrowthFmt)}
                          </div>
                          <div className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-700">
                            7 días
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {nextTourEvent && (
              <a
                href={nextTourEvent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex w-full max-w-xl items-center gap-3 rounded-xl p-3.5 transition-all duration-200 sm:p-4"
                style={{
                  background: "linear-gradient(135deg, rgba(57,255,20,0.08), rgba(255,255,255,0.025))",
                  border: "1px solid rgba(57,255,20,0.22)",
                }}
                data-testid="link-next-tour-event"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "rgba(57,255,20,0.10)", color: artist.accent }}
                >
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: artist.accent }}>
                    Próximo show
                  </div>
                  <div className="mt-1 text-sm font-black uppercase tracking-[0.06em] text-white sm:truncate">
                    {formatTourDate(nextTourEvent.date)} · {nextTourEvent.city}{nextTourEvent.state ? `, ${nextTourEvent.state}` : ""}
                  </div>
                  <div className="mt-0.5 truncate text-xs font-medium text-zinc-500">
                    {nextTourEvent.venue || nextTourEvent.name}
                  </div>
                </div>
                <span className="hidden text-[10px] font-black uppercase tracking-[0.18em] sm:block" style={{ color: artist.accent }}>
                  Boletos →
                </span>
              </a>
            )}

            {touringProfileSlug && (
              <Link href={`/touring/${touringProfileSlug}`}>
                <span
                  className="mt-3 flex w-full max-w-xl items-center gap-3 rounded-xl p-3.5 transition-all duration-200 hover:border-white/20 sm:p-4"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.055), rgba(57,255,20,0.035))",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                  data-testid="link-touring-profile"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "rgba(255,255,255,0.06)", color: artist.accent }}
                  >
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: artist.accent }}>
                      Perfil de touring
                    </div>
                    <div className="mt-1 text-sm font-black uppercase tracking-[0.06em] text-white">
                      Ver taquilla, boletos y timeline
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-zinc-500">
                      Reporte editorial de giras en Mexico Charts
                    </div>
                  </div>
                  <span className="hidden text-[10px] font-black uppercase tracking-[0.18em] sm:block" style={{ color: artist.accent }}>
                    Abrir →
                  </span>
                </span>
              </Link>
            )}

            {(enrichment?.spotify?.url || itunesData?.appleUrl) && (
                <div className="mt-5 grid max-w-xl grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                {enrichment?.spotify?.url && (
                  <a
                    href={enrichment.spotify.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition-all duration-200"
                    style={{
                      background: "rgba(29,185,84,0.08)",
                      border: "1px solid rgba(29,185,84,0.28)",
                      color: "#1DB954",
                    }}
                    data-testid="link-spotify-artist"
                  >
                    <SiSpotify className="w-3.5 h-3.5" />
                    Spotify oficial
                  </a>
                )}
                {itunesData?.appleUrl && (
                  <a
                    href={itunesData.appleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition-all duration-200"
                    style={{
                      background: "rgba(57,255,20,0.08)",
                      border: "1px solid rgba(57,255,20,0.28)",
                      color: "#39FF14",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "rgba(57,255,20,0.16)";
                      (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(57,255,20,0.55)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "rgba(57,255,20,0.08)";
                      (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(57,255,20,0.28)";
                    }}
                    data-testid="link-apple-music"
                  >
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                      <path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.948.043 4.647.073 4.35.158 2.95.517 1.99 1.39 1.36 2.65c-.332.67-.46 1.39-.513 2.12-.013.183-.02.367-.026.55v13.36c.006.182.013.366.026.55.053.73.181 1.45.513 2.12.63 1.26 1.59 2.13 2.99 2.49.297.085.598.115.98.143.152.01.303.017.455.026H18.01c.04-.003.083-.01.124-.013.52-.04 1.04-.095 1.535-.207C21.2 23.47 22.5 21.86 22.87 20.2c.12-.48.16-1.01.17-1.5.013-.54.013-1.08 0-1.62V7.614a10.496 10.496 0 00-.047-1.49zM8 17.5c0 .553-.447 1-1 1s-1-.447-1-1v-7c0-.553.447-1 1-1s1 .447 1 1v7zm9 0c0 .553-.447 1-1 1s-1-.447-1-1v-4c0-.553.447-1 1-1s1 .447 1 1v4zm-4 0c0 .553-.447 1-1 1s-1-.447-1-1v-2c0-.553.447-1 1-1s1 .447 1 1v2z" />
                    </svg>
                    Escuchar en Apple Music
                  </a>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${artist.accent}30, transparent)` }} />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-6 py-8 sm:py-10 flex flex-col gap-8 sm:gap-10">

        {/* ══════════════════════════════════════════════════════════
            SOCIAL & PLATFORM STATS — from metadata sheet
        ══════════════════════════════════════════════════════════ */}
        {hasAudienceStats && metaArtist && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-social-stats"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-4 sm:p-6"
              style={{ background: "linear-gradient(160deg,#0d0d0d 0%,#090909 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500 sm:mb-5 sm:text-xs sm:tracking-[0.25em]">Audiencia y alcance</h2>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
                  {metaArtist.spotifyListeners > 0 && (
                    <div className="flex min-h-[6.25rem] flex-col gap-1.5 rounded-xl p-3 sm:p-4" style={{ background: "rgba(29,185,84,0.06)", border: "1px solid rgba(29,185,84,0.15)" }}>
                      <SiSpotify className="w-4 h-4" style={{ color: "#1DB954" }} />
                      <div className="break-words text-lg font-black leading-none text-white sm:text-xl">{metaArtist.spotifyListenersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Oyentes mensuales</div>
                    </div>
                  )}
                  {metaArtist.spotifyFollowers > 0 && (
                    <div className="flex min-h-[6.25rem] flex-col gap-1.5 rounded-xl p-3 sm:p-4" style={{ background: "rgba(29,185,84,0.04)", border: "1px solid rgba(29,185,84,0.10)" }}>
                      <SiSpotify className="w-4 h-4" style={{ color: "#1DB954" }} />
                      <div className="break-words text-lg font-black leading-none text-white sm:text-xl">{metaArtist.spotifyFollowersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Seguidores Spotify</div>
                    </div>
                  )}
                  {metaArtist.instagramFollowers > 0 && (
                    <div className="flex min-h-[6.25rem] flex-col gap-1.5 rounded-xl p-3 sm:p-4" style={{ background: "rgba(225,48,108,0.06)", border: "1px solid rgba(225,48,108,0.15)" }}>
                      <SiInstagram className="w-4 h-4 text-pink-500" />
                      <div className="break-words text-lg font-black leading-none text-white sm:text-xl">{metaArtist.instagramFollowersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Seguidores Instagram</div>
                    </div>
                  )}
                  {metaArtist.tiktokFollowers > 0 && (
                    <div className="flex min-h-[6.25rem] flex-col gap-1.5 rounded-xl p-3 sm:p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }}>
                      <SiTiktok className="w-4 h-4 text-zinc-300" />
                      <div className="break-words text-lg font-black leading-none text-white sm:text-xl">{metaArtist.tiktokFollowersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Seguidores TikTok</div>
                    </div>
                  )}
                  {ytChannel?.subscribersFmt ? (
                    <div className="flex min-h-[6.25rem] flex-col gap-1.5 rounded-xl p-3 sm:p-4" style={{ background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.15)" }}>
                      <SiYoutube className="w-4 h-4 text-red-500" />
                      <div className="break-words text-lg font-black leading-none text-white sm:text-xl">{ytChannel.subscribersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Suscriptores YouTube</div>
                    </div>
                  ) : metaArtist.youtubeSubscribers > 0 ? (
                    <div className="flex min-h-[6.25rem] flex-col gap-1.5 rounded-xl p-3 sm:p-4" style={{ background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.15)" }}>
                      <SiYoutube className="w-4 h-4 text-red-500" />
                      <div className="break-words text-lg font-black leading-none text-white sm:text-xl">{metaArtist.youtubeSubscribersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Suscriptores YouTube</div>
                    </div>
                  ) : null}
                  {ytChannel?.viewsFmt && (
                    <div className="flex min-h-[6.25rem] flex-col gap-1.5 rounded-xl p-3 sm:p-4" style={{ background: "rgba(255,0,0,0.04)", border: "1px solid rgba(255,0,0,0.10)" }}>
                      <SiYoutube className="w-4 h-4 text-red-400" />
                      <div className="break-words text-lg font-black leading-none text-white sm:text-xl">{ytChannel.viewsFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Vistas totales YouTube</div>
                    </div>
                  )}
                  {ytChannel?.videoCount != null && (
                    <div className="flex min-h-[6.25rem] flex-col gap-1.5 rounded-xl p-3 sm:p-4" style={{ background: "rgba(255,0,0,0.03)", border: "1px solid rgba(255,0,0,0.08)" }}>
                      <SiYoutube className="w-4 h-4 text-red-400" />
                      <div className="break-words text-lg font-black leading-none text-white sm:text-xl">{ytChannel.videoCount.toLocaleString("es-MX")}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Videos en canal</div>
                    </div>
                  )}
                  {metaArtist.deezerFans > 0 && (
                    <div className="flex min-h-[6.25rem] flex-col gap-1.5 rounded-xl p-3 sm:p-4" style={{ background: "rgba(162,56,255,0.06)", border: "1px solid rgba(162,56,255,0.15)" }}>
                      <Music className="w-4 h-4" style={{ color: "#A238FF" }} />
                      <div className="break-words text-lg font-black leading-none text-white sm:text-xl">{metaArtist.deezerFansFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Fans Deezer</div>
                    </div>
                  )}
                </div>
                {metaArtist.label && (
                  <div className="mt-4 flex flex-col gap-1 border-t border-white/[0.05] pt-4 text-[11px] text-zinc-600 sm:flex-row sm:flex-wrap sm:gap-x-6">
                    <span><span className="text-zinc-500 font-bold">Sello: </span>{metaArtist.label}</span>
                    {metaArtist.country && <span><span className="text-zinc-500 font-bold">País: </span>{metaArtist.country}</span>}
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {momentumSources.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-artist-momentum"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-4 sm:p-6"
              style={{
                background: "linear-gradient(160deg,#101010 0%,#090909 58%,#050505 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 48px rgba(0,0,0,0.68), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <div className="mb-5 flex flex-col gap-3 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" style={{ color: artist.accent }} />
                      <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Momentum</h2>
                    </div>
                    <div className="max-w-2xl text-xs font-bold leading-relaxed text-zinc-500 sm:text-sm">
                      Medición diaria de crecimiento en {momentumSources.map(source => source.label).join(" y ")}.
                    </div>
                  </div>
                  <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 sm:tracking-[0.16em]">
                    {momentumSources.map(source => source.label).join(" + ")}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {momentumSources.map(source => {
                    const hasTrend = source.points.length >= 2;
                    const hasDailyValue = source.todayValue != null;
                    const primaryLabel = hasDailyValue
                      ? source.key === "youtube" ? "Vistas hoy" : "Streams hoy"
                      : source.key === "youtube" ? "Vistas totales" : "Streams totales";
                    const primaryValue = hasDailyValue ? source.todayValue : source.totalValue;
                    const latestPoints = source.points.slice(-8);
                    return (
                      <article
                        key={source.key}
	                        className="overflow-hidden rounded-2xl border bg-black/20"
                        style={{ borderColor: `${source.color}28` }}
                        data-testid={`momentum-${source.key}`}
                      >
	                        <div className="p-3.5 sm:p-5">
	                          <div className="mb-5 grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:flex sm:items-start">
	                            <div
	                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
	                              style={{ background: `${source.color}12`, color: source.color, border: `1px solid ${source.color}24` }}
                            >
                              {source.icon}
                            </div>
	                            <div className="min-w-0">
	                              <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: source.color }}>
	                                {source.kicker}
	                              </div>
	                              <h3 className="mt-1 text-xl font-black uppercase tracking-tight text-white">{source.label}</h3>
	                            </div>
	                            <div className="col-span-2 rounded-xl border border-white/[0.055] bg-white/[0.018] px-3 py-2 text-left sm:col-span-1 sm:ml-auto sm:border-0 sm:bg-transparent sm:p-0 sm:text-right">
	                              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-700">Última medición</div>
	                              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">{source.snapshotLabel || "—"}</div>
	                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-700">
                                {primaryLabel}
                              </div>
	                              <div className="mt-2 break-words text-[clamp(2rem,12vw,3rem)] font-black leading-none tracking-tight text-white sm:text-5xl">
	                                {primaryValue ?? "—"}
	                              </div>
	                              <div className="mt-3 flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] sm:text-[10px] sm:tracking-[0.14em]">
                                {hasDailyValue ? (
                                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-zinc-500">
                                    {source.totalValue ?? "—"} {source.totalLabel}
                                  </span>
                                ) : (
                                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-zinc-500">
                                    Esperando próxima medición
                                  </span>
                                )}
                                <span
                                  className="rounded-full px-2.5 py-1"
                                  style={{ background: `${source.color}12`, border: `1px solid ${source.color}24`, color: source.color }}
                                >
                                  {momentumLabel(source.trend)}
                                </span>
                              </div>
                            </div>

	                            <div className="grid grid-cols-2 gap-2">
	                              <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 sm:p-3">
	                                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-700">Prom. 7 días</div>
	                                <div className="mt-1 break-words text-sm font-black text-white">{source.average7 ?? "—"}</div>
	                                <div className={`mt-1 text-[10px] font-bold ${metricTone(source.average7Pct)}`}>{pctLabel(source.average7Pct)}</div>
	                              </div>
	                              <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 sm:p-3">
	                                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-700">Prom. 30 días</div>
	                                <div className="mt-1 break-words text-sm font-black text-white">{source.average30 ?? "—"}</div>
	                                <div className={`mt-1 text-[10px] font-bold ${metricTone(source.average30Pct)}`}>{pctLabel(source.average30Pct)}</div>
	                              </div>
	                              <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 sm:p-3">
	                                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-700">Semana</div>
	                                <div className={`mt-1 break-words text-sm font-black ${metricTone(source.weeklyGrowth)}`}>
	                                  {formatSignedMetric(source.weeklyGrowth, source.weeklyGrowthFmt)}
	                                </div>
	                              </div>
	                              <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 sm:p-3">
	                                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-700">Mes</div>
	                                <div className={`mt-1 break-words text-sm font-black ${metricTone(source.monthlyGrowth)}`}>
	                                  {formatSignedMetric(source.monthlyGrowth, source.monthlyGrowthFmt)}
	                                </div>
	                              </div>
                            </div>
                          </div>
                        </div>

	                        <div className="border-t border-white/[0.06] bg-white/[0.018] px-3.5 pb-4 pt-3 sm:px-5 sm:pb-5">
                          {hasTrend ? (
                            <>
	                              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
	                                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-700">
	                                  Últimos {source.points.length} días
	                                </div>
	                                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600 sm:text-right">
	                                  Pico: <span className="text-zinc-300">{source.biggestSpikeValue ?? "—"}</span>
	                                  {source.biggestSpikeDate ? ` · ${formatShortDateEs(source.biggestSpikeDate)}` : ""}
	                                </div>
                              </div>
                              <YoutubeDailySparkline
                                points={source.points}
                                color={source.color}
                                gradientId={`momentum-${source.key}-fill`}
                                ariaLabel={`Tendencia diaria de ${source.label}`}
                              />
                              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {latestPoints.slice(-4).map(point => {
                                  const value = source.key === "youtube" ? point.dailyViews : point.dailyStreams;
                                  return (
	                                    <div key={`${source.key}-${point.date}`} className="min-w-0 rounded-lg border border-white/[0.055] bg-black/20 px-2.5 py-2">
	                                      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700">{formatShortDateEs(point.date)}</div>
	                                      <div className="mt-1 break-words text-xs font-black text-zinc-300">{(value ?? 0).toLocaleString("es-MX")}</div>
	                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <div className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-5">
                              <div className="text-sm font-black uppercase tracking-[0.08em] text-white">Medición inicial</div>
                              <div className="mt-2 text-xs font-bold leading-relaxed text-zinc-500">
                                Ya tenemos el total actual. La tendencia empieza con la próxima medición diaria.
                              </div>
                              <div className="mt-3 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: source.color }}>
                                {source.availableDays} {source.availableDays === 1 ? "día medido" : "días medidos"}
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ══════════════════════════════════════════════════════════
            VERIFIED API LINKS — Spotify / YouTube / MusicBrainz
        ══════════════════════════════════════════════════════════ */}
        {enrichment && (enrichment.spotify || enrichment.youtube || enrichment.musicbrainz) && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-verified-links"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-4 sm:p-6"
              style={{ background: "linear-gradient(160deg,#101010 0%,#080808 58%,#050505 100%)", border: "1px solid rgba(57,255,20,0.14)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4" style={{ color: artist.accent }} />
                      <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Fuentes oficiales</h2>
                    </div>
                    <p className="max-w-xl text-xs font-bold leading-relaxed text-zinc-600">
                      Enlaces verificados para confirmar la identidad del perfil y consultar la fuente original.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#39FF14]/20 bg-[#39FF14]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14]">
                      {officialSourceCount} {officialSourceCount === 1 ? "fuente" : "fuentes"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                      Identidad enlazada
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {enrichment.spotify && (
                    <a
                      href={enrichment.spotify.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-xl p-4 transition-colors duration-200 hover:border-[#1DB954]/35"
                      style={{ background: "linear-gradient(180deg,rgba(29,185,84,0.085),rgba(255,255,255,0.025))", border: "1px solid rgba(29,185,84,0.16)" }}
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-[#1DB954]" />
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1DB954]/10">
                          <SiSpotify className="h-4 w-4" style={{ color: "#1DB954" }} />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Spotify</span>
                        {enrichment.spotify.url && (
                          <ExternalLink className="ml-auto h-3.5 w-3.5 text-zinc-700 transition-colors group-hover:text-[#1DB954]" />
                        )}
                      </div>
                      <div className="truncate text-lg font-black text-white">{enrichment.spotify.name ?? artist.name}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                        Perfil enlazado
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {enrichment.spotify.followersFmt && (
                          <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                            {enrichment.spotify.followersFmt} seguidores
                          </span>
                        )}
                        {spotifyUpdatedLabel && (
                          <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                            Actualizado {spotifyUpdatedLabel}
                          </span>
                        )}
                      </div>
                    </a>
                  )}

                  {enrichment.youtube && (
                    <a
                      href={enrichment.youtube.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-xl p-4 transition-colors duration-200 hover:border-red-500/35"
                      style={{ background: "linear-gradient(180deg,rgba(255,0,0,0.08),rgba(255,255,255,0.025))", border: "1px solid rgba(255,0,0,0.15)" }}
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-red-500" />
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                          <SiYoutube className="h-4 w-4 text-red-500" />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">YouTube</span>
                        <ExternalLink className="ml-auto h-3.5 w-3.5 text-zinc-700 transition-colors group-hover:text-red-400" />
                      </div>
                      <div className="truncate text-lg font-black text-white">{enrichment.youtube.title ?? "YouTube oficial"}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                        Canal enlazado
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {enrichment.youtube.subscribersFmt && (
                          <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                            {enrichment.youtube.subscribersFmt} suscriptores
                          </span>
                        )}
                        {enrichment.youtube.viewsFmt && (
                          <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                            {enrichment.youtube.viewsFmt} vistas
                          </span>
                        )}
                        {youtubeUpdatedLabel && (
                          <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                            Actualizado {youtubeUpdatedLabel}
                          </span>
                        )}
                      </div>
                    </a>
                  )}

                  {enrichment.musicbrainz && (
                    <a
                      href={enrichment.musicbrainz.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative overflow-hidden rounded-xl p-4 transition-colors duration-200 hover:border-amber-400/35"
                      style={{ background: "linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.025))", border: "1px solid rgba(245,158,11,0.15)" }}
                    >
                      <div className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10">
                          <Database className="h-4 w-4 text-amber-400" />
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">MusicBrainz</span>
                        <ExternalLink className="ml-auto h-3.5 w-3.5 text-zinc-700 transition-colors group-hover:text-amber-300" />
                      </div>
                      <div className="truncate text-lg font-black text-white">{enrichment.musicbrainz.name ?? artist.name}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
                        {enrichment.musicbrainz.areaName ?? enrichment.musicbrainz.country ?? "Catálogo musical"}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {musicbrainzUpdatedLabel && (
                          <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                            Actualizado {musicbrainzUpdatedLabel}
                          </span>
                        )}
                      </div>
                      {(enrichment.musicbrainz.tags ?? []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(enrichment.musicbrainz.tags ?? []).slice(0, 3).map(tag => (
                            <span key={tag} className="rounded border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ══════════════════════════════════════════════════════════
            TOP TRACKS — standalone full-width card
        ══════════════════════════════════════════════════════════ */}
        {topTracks.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-top-tracks"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
              style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span style={{ color: artist.accent }}><Music className="w-4 h-4" /></span>
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Activos principales en Spotify</h2>
                  </div>
                  {kworbStats?.spotify && (
                    <div className="hidden text-[9px] uppercase tracking-widest text-zinc-700 font-bold sm:block">
                      Spotify · Kworb
                    </div>
                  )}
                </div>

                {topTracks[0] && (
                  <div
                    className="mb-3 grid gap-3 rounded-xl p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                    style={{ background: `${artist.accent}0f`, border: `1px solid ${artist.accent}26` }}
                  >
                    <div
                      className="relative h-16 w-16 overflow-hidden rounded-xl sm:h-20 sm:w-20"
                      style={{ background: `${artist.accent}16`, border: `1px solid ${artist.accent}35` }}
                    >
                      {topTracks[0].coverUrl ? (
                        <img src={topTracks[0].coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-black" style={{ color: artist.accent }}>
                          #1
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                      <div className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-black" style={{ background: `${artist.accent}dd`, color: "#050505" }}>
                        #1
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: artist.accent }}>
                        Canción líder
                      </div>
                      <div className="mt-1 truncate text-lg font-black text-white">{topTracks[0].title}</div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-2xl font-black leading-none" style={{ color: artist.accent }}>
                        {topTracks[0].streams}
                      </div>
                      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-700">streams</div>
                    </div>
                  </div>
                )}

                <div className="grid gap-2 md:grid-cols-2">
                  {topTracks.slice(1).map((s, i) => (
                    <div
                      key={`${s.title}-${i}`}
                      className="flex items-center gap-3 rounded-xl px-3 py-3"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.055)" }}
                    >
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg text-[11px] font-black text-zinc-600" style={{ background: "rgba(255,255,255,0.035)" }}>
                        {s.coverUrl ? (
                          <img src={s.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">{i + 2}</span>
                        )}
                        <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[9px] font-black text-white">
                          {i + 2}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-300">{s.title}</span>
                      <span className="shrink-0 text-sm font-black" style={{ color: artist.accent }}>{s.streams}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ══════════════════════════════════════════════════════════
            KWORB — CATALOG STRENGTH
        ══════════════════════════════════════════════════════════ */}
        {(kworbStats?.spotify || kworbStats?.youtube) && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-kworb-streams"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
              style={{ background: "linear-gradient(160deg,#0a0f0a 0%,#090909 100%)", border: `1px solid ${artist.accent}18`, boxShadow: `0 8px 48px rgba(0,0,0,0.65), 0 0 0 1px ${artist.accent}08, inset 0 1px 0 rgba(255,255,255,0.04)` }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${artist.accent}40, transparent)` }} />
              <div className="relative z-10">
                <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start">
                  <div className="flex items-start gap-3">
                    <Play className="mt-0.5 h-4 w-4 shrink-0" style={{ color: artist.accent }} />
                    <div className="min-w-0">
                      <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400 sm:text-xs sm:tracking-[0.25em]">Fuerza de catálogo</h2>
                      <p className="mt-1 max-w-xl text-[10px] font-bold uppercase leading-relaxed tracking-[0.1em] text-zinc-700 sm:text-[11px] sm:tracking-[0.12em]">
                        Escala acumulada del repertorio. El movimiento diario vive en Momentum.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 sm:ml-auto sm:items-end sm:border-0 sm:bg-transparent sm:p-0">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-700">Spotify · YouTube</span>
                    {lastUpdatedLabel && (
                      <span className="text-[9px] font-medium text-zinc-600" data-testid="kworb-last-updated">
                        Actualizado {lastUpdatedLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {kworbStats.spotify && (
                    <div
	                      className="relative min-w-0 overflow-hidden rounded-xl p-3.5 sm:p-5"
                      style={{
                        background: "linear-gradient(145deg, rgba(29,185,84,0.10), rgba(255,255,255,0.025))",
                        border: "1px solid rgba(29,185,84,0.18)",
                      }}
                    >
                      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#1DB954]/10 blur-3xl" />
                      <div className="relative">
                        <div className="mb-5 flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1DB954]/10 text-[#1DB954]">
                            <SiSpotify className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Spotify</div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700">streams acumulados</div>
                          </div>
                        </div>
	                        <div
	                          className="break-words text-[clamp(2rem,12vw,3rem)] font-black leading-none tracking-tight sm:text-5xl"
                          style={{ color: artist.accent, textShadow: `0 0 40px ${artist.accent}30` }}
                        >
                          {kworbStats.spotify.totalStreamsFmt}
                        </div>
                        <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-600">streams acumulados</div>
                        <div className="mt-5 grid grid-cols-2 gap-2">
	                          <div className="min-w-0 rounded-lg border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
	                            <div className="text-[9px] uppercase tracking-wider text-zinc-700 font-bold">Canciones</div>
	                            <div className="mt-1 break-words text-sm font-black text-zinc-300">{kworbStats.spotify.trackCount}</div>
	                          </div>
	                          <div className="min-w-0 rounded-lg border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
	                            <div className="text-[9px] uppercase tracking-wider text-zinc-700 font-bold">Canción líder</div>
	                            <div className="mt-1 truncate text-sm font-black text-zinc-300">{topTracks[0]?.streams ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {kworbStats.youtube && (
                    <div
	                      className="relative min-w-0 overflow-hidden rounded-xl p-3.5 sm:p-5"
                      style={{
                        background: "linear-gradient(145deg, rgba(239,68,68,0.10), rgba(255,255,255,0.025))",
                        border: "1px solid rgba(239,68,68,0.18)",
                      }}
                    >
                      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-red-500/10 blur-3xl" />
                      <div className="relative">
                        <div className="mb-5 flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                            <SiYoutube className="h-4 w-4" />
                          </span>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">YouTube</div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700">vistas acumuladas</div>
                          </div>
                        </div>
	                        <div className="break-words text-[clamp(2rem,12vw,3rem)] font-black leading-none tracking-tight text-red-400 sm:text-5xl">
	                          {kworbStats.youtube.totalViewsFmt}
	                        </div>
                        <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-600">vistas totales</div>
                        <div className="mt-5 grid grid-cols-2 gap-2">
	                          <div className="min-w-0 rounded-lg border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
	                            <div className="text-[9px] uppercase tracking-wider text-zinc-700 font-bold">Videos</div>
	                            <div className="mt-1 break-words text-sm font-black text-zinc-300">{kworbStats.youtube.topVideos.length}</div>
	                          </div>
	                          <div className="min-w-0 rounded-lg border border-white/[0.06] bg-black/20 p-2.5 sm:p-3">
                            <div className="text-[9px] uppercase tracking-wider text-zinc-700 font-bold">Video líder</div>
                            <div className="mt-1 truncate text-sm font-black text-zinc-300">{kworbStats.youtube.topVideos[0]?.viewsFmt ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ══════════════════════════════════════════════════════════
            KWORB — MEXICO CHART POSITIONS
        ══════════════════════════════════════════════════════════ */}
        {kworbStats?.chartPositions && kworbStats.chartPositions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-chart-positions"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
              style={{ background: "linear-gradient(160deg,#0d0d0d 0%,#090909 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <Music className="h-4 w-4 shrink-0" style={{ color: artist.accent }} />
                    <div className="min-w-0">
                      <h2 className="text-xs font-black uppercase tracking-[0.22em] text-zinc-400">Posiciones en México</h2>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                        {chartPositions.length} de {chartPositionTotal} canciones actuales
                      </div>
                    </div>
                  </div>
                  <div
                    className="sm:ml-auto inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em]"
                    style={{
                      background: selectedChartPlatform ? `${selectedChartPlatform.color}12` : `${artist.accent}12`,
                      border: selectedChartPlatform ? `1px solid ${selectedChartPlatform.color}30` : `1px solid ${artist.accent}30`,
                      color: selectedChartPlatform?.color ?? artist.accent,
                    }}
                  >
                    {selectedChartPlatform ? `${selectedChartPlatform.label} MX` : "Todas las plataformas"}
                  </div>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <button
                    type="button"
                    onClick={() => setChartPositionFilter("all")}
                    className="inline-flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors"
                    style={{
                      background: chartPositionFilter === "all" ? `${artist.accent}16` : "rgba(255,255,255,0.028)",
                      border: chartPositionFilter === "all" ? `1px solid ${artist.accent}44` : "1px solid rgba(255,255,255,0.07)",
                      color: chartPositionFilter === "all" ? artist.accent : "rgba(255,255,255,0.42)",
                    }}
                  >
                    <span>Todas</span>
                    <span className="text-[9px] text-zinc-600">{chartPositionTotal}</span>
                  </button>
                  {CHART_POSITION_PLATFORMS.map(platform => (
                    <button
                      key={platform.key}
                      type="button"
                      onClick={() => setChartPositionFilter(platform.key)}
                      className="inline-flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors"
                      style={{
                        background: chartPositionFilter === platform.key ? `${platform.color}16` : "rgba(255,255,255,0.028)",
                        border: chartPositionFilter === platform.key ? `1px solid ${platform.color}44` : "1px solid rgba(255,255,255,0.07)",
                        color: chartPositionFilter === platform.key ? platform.color : "rgba(255,255,255,0.42)",
                      }}
                    >
                      <span>{platform.short}</span>
                      <span className="text-[9px] text-zinc-600">{chartPositionCounts[platform.key] ?? 0}</span>
                    </button>
                  ))}
                </div>

                {chartPositions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                    {chartPositions.map((cp, i) => {
                      const ranks = CHART_POSITION_PLATFORMS
                        .map(platform => cp[platform.key])
                        .filter((rank): rank is number => rank !== undefined);
                      const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
                      const isBestTop3 = bestRank !== null && bestRank <= 3;
                      const featuredRank = selectedChartPlatform ? cp[selectedChartPlatform.key] ?? null : bestRank;
                      const songKey = normalizeSongMatch(cp.song);
                      const videoMatch = chartVideoMatches.find(match =>
                        match.key === songKey || match.key.includes(songKey) || songKey.includes(match.key)
                      );
                      const thumbnailUrl = cp.coverUrl ?? videoMatch?.thumbnailUrl ?? photo;
                      return (
                        <div
                          key={`${cp.song}-${i}`}
                          className="flex items-center gap-3 rounded-xl p-2.5 sm:gap-3"
                          style={{
                            background: "rgba(255,255,255,0.025)",
                            border: "1px solid rgba(255,255,255,0.055)",
                          }}
                        >
                          <div
                            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg sm:h-16 sm:w-16"
                            style={{
                              border: isBestTop3 ? `1px solid ${artist.accent}30` : "1px solid rgba(255,255,255,0.06)",
                              background: isBestTop3 ? `${artist.accent}10` : "rgba(255,255,255,0.035)",
                            }}
                          >
                            {thumbnailUrl ? (
                              <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-zinc-700">
                                <Music className="h-5 w-5" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                            <div
                              className="absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-black"
                              style={{
                                background: isBestTop3 ? `${artist.accent}dd` : "rgba(0,0,0,0.72)",
                                color: isBestTop3 ? "#050505" : "rgba(255,255,255,0.88)",
                              }}
                            >
                              {featuredRank ? `#${featuredRank}` : "—"}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-black text-zinc-200">{cp.song}</div>
                            {selectedChartPlatform ? (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: selectedChartPlatform.color }}>
                                  {selectedChartPlatform.label} México
                                </span>
                                {ranks.length > 1 && (
                                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700">
                                    +{ranks.length - 1} listas
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {CHART_POSITION_PLATFORMS.map(platform => {
                                  const rank = cp[platform.key];
                                  if (rank === undefined) return null;
                                  const isTop3 = rank <= 3;
                                  return (
                                    <span
                                      key={platform.key}
                                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em]"
                                      style={{
                                        background: `${platform.color}${isTop3 ? "1c" : "10"}`,
                                        border: `1px solid ${platform.color}${isTop3 ? "44" : "24"}`,
                                        color: isTop3 ? platform.color : "rgba(255,255,255,0.48)",
                                      }}
                                    >
                                      {platform.short}
                                      <span>#{rank}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {selectedChartPlatform && (
                            <div className="shrink-0 text-right">
                              <div className="text-lg font-black leading-none" style={{ color: selectedChartPlatform.color }}>
                                #{cp[selectedChartPlatform.key]}
                              </div>
                              <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700">
                                México
                              </div>
                            </div>
                          )}
                          {!selectedChartPlatform && ranks.length > 1 && (
                            <div className="hidden shrink-0 text-right sm:block">
                              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">
                                {ranks.length}
                              </div>
                              <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700">
                                listas
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="rounded-xl px-4 py-6 text-center text-xs font-bold text-zinc-600"
                    style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.055)" }}
                  >
                    No hay posiciones actuales en {selectedChartPlatform?.label ?? "esta plataforma"}.
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-[9px] text-zinc-700 font-bold uppercase tracking-wider">
                  {CHART_POSITION_PLATFORMS.map(platform => (
                    <span key={platform.key} className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: platform.color }} />
                      {platform.short}={platform.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ══════════════════════════════════════════════════════════
            KWORB — TOP YOUTUBE VIDEOS
        ══════════════════════════════════════════════════════════ */}
        {kworbStats?.youtube && kworbStats.youtube.topVideos.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-youtube-videos"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-5 sm:p-6"
              style={{ background: "linear-gradient(160deg,#100909 0%,#090909 100%)", border: "1px solid rgba(239,68,68,0.12)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-red-500/10 blur-3xl" />
              <div className="relative z-10">
                <div className="mb-5 flex items-center gap-3">
                  <SiYoutube className="w-4 h-4 text-red-500" />
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Activos principales en YouTube</h2>
                  <div className="ml-auto hidden text-[9px] font-bold uppercase tracking-widest text-zinc-700 sm:block">Catálogo</div>
                </div>

                {kworbStats.youtube.topVideos[0] && (
                  <a
                    href={kworbStats.youtube.topVideos[0].videoUrl ?? undefined}
                    target={kworbStats.youtube.topVideos[0].videoUrl ? "_blank" : undefined}
                    rel={kworbStats.youtube.topVideos[0].videoUrl ? "noopener noreferrer" : undefined}
                    className="mb-3 grid gap-4 rounded-xl p-4 sm:grid-cols-[auto_1fr_auto]"
                    style={{
                      background: "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(255,255,255,0.025))",
                      border: "1px solid rgba(239,68,68,0.18)",
                    }}
                  >
                    <div
                      className="relative h-20 overflow-hidden rounded-xl sm:h-16 sm:w-28"
                      style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.18)" }}
                    >
                      {kworbStats.youtube.topVideos[0].thumbnailUrl ? (
                        <img
                          src={kworbStats.youtube.topVideos[0].thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-red-400">
                          <SiYoutube className="h-6 w-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-white">
                        #1
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                        <SiYoutube className="h-3.5 w-3.5" />
                        Video principal
                      </div>
                      <div className="text-base font-black leading-snug text-white">{kworbStats.youtube.topVideos[0].title}</div>
                      {kworbStats.youtube.topVideos[0].published && (
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700">{kworbStats.youtube.topVideos[0].published}</div>
                      )}
                    </div>
                    <div className="flex items-end justify-between gap-5 sm:flex-col sm:justify-center sm:text-right">
                      <div>
                        <div className="text-xl font-black leading-none text-red-400">{kworbStats.youtube.topVideos[0].viewsFmt}</div>
                        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700">vistas</div>
                      </div>
                    </div>
                  </a>
                )}

                <div className="grid min-w-0 gap-2 md:grid-cols-2">
                  {kworbStats.youtube.topVideos.slice(1, 8).map((v, i) => (
                    <motion.a
                      key={i}
                      href={v.videoUrl ?? undefined}
                      target={v.videoUrl ? "_blank" : undefined}
                      rel={v.videoUrl ? "noopener noreferrer" : undefined}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: i * 0.035, ease: [0.16, 1, 0.3, 1] }}
                      className="grid min-w-0 grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl px-3 py-3 sm:flex sm:items-center"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.055)" }}
                    >
                      <div
                        className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.12)" }}
                      >
                        {v.thumbnailUrl ? (
                          <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-red-400">
                            <SiYoutube className="h-4 w-4" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/20" />
                        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1 py-0.5 text-[9px] font-black text-white">
                          {i + 2}
                        </span>
                      </div>
                      <div className="min-w-0 sm:flex-1">
                        <div className="truncate text-sm font-bold text-zinc-300">{v.title}</div>
                        {v.published && (
                          <div className="mt-0.5 text-[10px] text-zinc-700">{v.published}</div>
                        )}
                      </div>
                      <div className="col-start-2 min-w-0 text-left sm:col-start-auto sm:shrink-0 sm:text-right">
                        <div className="text-sm font-black text-red-400">{v.viewsFmt}</div>
                        <div className="text-[10px] text-zinc-700">vistas</div>
                      </div>
                    </motion.a>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ══════════════════════════════════════════════════════════
            TOUR DATES
        ══════════════════════════════════════════════════════════ */}
        {artist.tours.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-tours"
          >
            <div className="mb-4 flex items-center gap-3">
              <MapPin className="h-4 w-4 shrink-0" style={{ color: artist.accent }} />
              <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-400 sm:text-xs sm:tracking-[0.25em]">Giras & Touring</h2>
              <div className="flex-1 h-px ml-2" style={{ background: "rgba(255,255,255,0.07)" }} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {artist.tours.map((t, i) => (
                <motion.div
                  key={i}
                  whileHover={reduced ? {} : { scale: 1.02, y: -2, transition: { duration: 0.22 } }}
                  className="relative cursor-pointer overflow-hidden rounded-xl p-4 sm:p-5"
                  style={{
                    background: "linear-gradient(160deg, #0d0d0d 0%, #090909 100%)",
                    border: `1px solid ${artist.accent}1e`,
                    boxShadow: "0 6px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
                  <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full" style={{ background: artist.accent, boxShadow: `0 0 8px ${artist.accent}` }} />
	                  <div className="relative z-10 pl-3">
	                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.4)" }}>{t.dates}</div>
	                    <div className="text-base font-black uppercase leading-tight text-white sm:text-lg">{t.name}</div>
	                    <div className="mt-3 grid grid-cols-2 gap-3">
	                      <div className="min-w-0">
	                        <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold">Recaudación est.</div>
	                        <div className="break-words text-sm font-black" style={{ color: artist.accent }}>{t.gross}</div>
	                      </div>
	                      <div className="min-w-0">
	                        <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold">Ciudades</div>
	                        <div className="break-words text-sm font-black text-white">{t.cities}</div>
	                      </div>
	                    </div>
	                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ══════════════════════════════════════════════════════════
            AMPROFON CERTIFICATIONS
        ══════════════════════════════════════════════════════════ */}
        <ArtistCertifications artistName={artist.name} accent={artist.accent} />

        {/* ── BACK LINK ── */}
        <div className="pb-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            aria-label="Volver a la página anterior"
            className="inline-flex items-center gap-2 text-zinc-600 hover:text-[#39FF14] transition-colors duration-200 text-xs font-black uppercase tracking-widest"
            data-testid="link-back-bottom"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </button>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t py-6 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <img src={logoUrl} alt="Mexico Charts" className="h-6 object-contain opacity-60" />
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">© 2026 Mexico Charts. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
