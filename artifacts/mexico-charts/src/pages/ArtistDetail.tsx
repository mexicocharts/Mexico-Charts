import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { useArtistsWeekly, findArtistBySlug, useArtistMetadata, lookupArtistMetadata } from "@/services/dataProvider";
import { SHEET_SOURCES } from "@/config/sheetSources";
import { ArrowLeft, TrendingUp, Music, MapPin, Globe, Play } from "lucide-react";
import ArtistCertifications from "@/components/ArtistCertifications";
import { SiSpotify, SiYoutube, SiInstagram, SiTiktok, SiSoundcloud } from "react-icons/si";
import { useArtistImages } from "@/hooks/useArtistImages";
import { useKworbStats, useRefreshStatus } from "@/hooks/useKworbStats";
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

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/* ─── ARTIST DATA ───────────────────────────────────────────── */
interface ArtistData {
  name: string;
  genre: string;
  subgenre: string;
  rank: number;
  listeners: string;
  listenersRaw: number;
  growth: string;
  countries: string;
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
    countries: "60+",
    origin: "Guadalajara, Jalisco",
    accent: "#39FF14",
    bio: "Hassan Emilio Kabande Laija, conocido como Peso Pluma, es el artista mexicano más escuchado del mundo. Con su fusión de corridos tumbados y pop urbano ha conquistado más de 60 países y se posicionó como el primer mexicano en encabezar el Global 200 de Billboard.",
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
    countries: "45+",
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
    countries: "38+",
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
    countries: "32+",
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
    countries: "28+",
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
    countries: "—",
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
    // 2. Overlay Spotify chart stats (rank, growth, genre, countries, accent)
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
        countries: sheetArtist.countriesRaw > 0 ? `${sheetArtist.countriesRaw}+` : merged.countries,
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
  const photo = artistImages[artist.name] ?? null;

  /* ── Kworb lifetime streaming stats ── */
  const { data: kworbStats } = useKworbStats(artist.name);

  /* ── Kworb refresh status (last scheduler run) ── */
  const { data: refreshStatus } = useRefreshStatus();
  const lastUpdatedLabel = fmtRelativeEs(refreshStatus?.lastRefreshedAt ?? null);

  /* ── Top tracks: only real kworb data — never show hardcoded fake tracks ── */
  const topTracks = useMemo(() => {
    if (kworbStats?.spotify?.topTracks?.length) {
      return kworbStats.spotify.topTracks.map(t => ({ title: t.title, streams: t.streamsFmt }));
    }
    return [];
  }, [kworbStats]);


  return (
    <div
      className="min-h-[100dvh] text-zinc-300 overflow-x-hidden selection:bg-[#39FF14] selection:text-black"
      style={{ background: "radial-gradient(ellipse 100% 50% at 50% 0%, rgba(57,255,20,0.022) 0%, transparent 55%), #050505" }}
      data-testid="page-artist-detail"
    >
      {/* ── ERROR BANNER — only when a sheet URL is configured but fetch failed ── */}
      {showErrorState && (
        <div
          className="px-6 py-2.5 flex items-center gap-3"
          style={{ background: "rgba(255,40,40,0.06)", borderBottom: "1px solid rgba(255,40,40,0.18)" }}
          data-testid="artist-error-banner"
        >
          <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,80,80,0.9)" }}>
            Error al cargar datos del artista
          </span>
          <span className="text-[10px] text-zinc-600 font-medium">
            · Mostrando datos de referencia.
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
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="flex-shrink-0" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90 hover:opacity-100 transition-opacity" />
          </Link>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors duration-200 text-[11px] font-bold uppercase tracking-widest"
            data-testid="link-back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </button>
          <span className="text-zinc-700 text-[11px] uppercase tracking-widest">/ {artist.name}</span>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: 340 }} data-testid="artist-hero">
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
            className="absolute right-0 top-0 bottom-0 w-1/2 md:w-2/5 pointer-events-none"
            style={{
              backgroundImage: `url(${photo})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              maskImage: "linear-gradient(to right, transparent 0%, black 40%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 40%)",
              filter: "saturate(0.55) contrast(1.1) brightness(0.78)",
            }}
          />
        )}

        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(5,5,5,0.95) 0%, rgba(5,5,5,0.6) 45%, rgba(5,5,5,0.2) 72%, transparent 88%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0.4) 0%, transparent 30%, rgba(5,5,5,0.5) 70%, #050505 100%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: NOISE_SVG, backgroundSize: "128px" }} />

        {/* Rank watermark */}
        {artist.rank > 0 && (
          <div className="absolute right-4 md:right-10 bottom-0 font-black leading-none select-none pointer-events-none" style={{ fontSize: "clamp(6rem,18vw,14rem)", color: "rgba(255,255,255,0.05)", lineHeight: 0.85 }}>
            {String(artist.rank).padStart(2, "0")}
          </div>
        )}

        <div className="relative max-w-[1200px] mx-auto px-6 pt-14 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.32em] mb-3" style={{ color: artist.accent }}>
              {artist.rank > 0 ? `#${artist.rank} En México` : "Artista"}
              <span className="mx-3 opacity-40">·</span>
              {artist.genre}
            </div>
            <h1
              className="font-black uppercase leading-[0.88] tracking-tight text-white mb-4"
              style={{ fontSize: "clamp(2.4rem, 8vw, 6rem)", textShadow: "0 2px 60px rgba(0,0,0,0.98)" }}
            >
              {artist.name}
            </h1>
            <p className="text-sm text-white/50 uppercase tracking-[0.18em] mb-4 font-medium flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" style={{ color: artist.accent }} />{artist.origin}</span>
              <span>{artist.listeners} OYENTES</span>
              {artist.spotifyFollowers && <span>{artist.spotifyFollowers} SEGUIDORES</span>}
              <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" style={{ color: artist.accent }} /><span style={{ color: artist.accent }}>{artist.growth} esta semana</span></span>
              <span>{artist.countries} PAÍSES</span>
            </p>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-xl">{artist.bio}</p>
          </motion.div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${artist.accent}30, transparent)` }} />

      <div className="max-w-[1200px] mx-auto px-6 py-10 flex flex-col gap-10">

        {/* ══════════════════════════════════════════════════════════
            SOCIAL & PLATFORM STATS — from metadata sheet
        ══════════════════════════════════════════════════════════ */}
        {metaArtist && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-social-stats"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-6"
              style={{ background: "linear-gradient(160deg,#0d0d0d 0%,#090909 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500 mb-5">Audiencia & Seguidores</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {metaArtist.spotifyListeners > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-xl p-4" style={{ background: "rgba(29,185,84,0.06)", border: "1px solid rgba(29,185,84,0.15)" }}>
                      <SiSpotify className="w-4 h-4" style={{ color: "#1DB954" }} />
                      <div className="text-xl font-black text-white leading-none">{metaArtist.spotifyListenersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Oyentes mensuales</div>
                    </div>
                  )}
                  {metaArtist.spotifyFollowers > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-xl p-4" style={{ background: "rgba(29,185,84,0.04)", border: "1px solid rgba(29,185,84,0.10)" }}>
                      <SiSpotify className="w-4 h-4" style={{ color: "#1DB954" }} />
                      <div className="text-xl font-black text-white leading-none">{metaArtist.spotifyFollowersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Seguidores Spotify</div>
                    </div>
                  )}
                  {metaArtist.instagramFollowers > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-xl p-4" style={{ background: "rgba(225,48,108,0.06)", border: "1px solid rgba(225,48,108,0.15)" }}>
                      <SiInstagram className="w-4 h-4 text-pink-500" />
                      <div className="text-xl font-black text-white leading-none">{metaArtist.instagramFollowersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Seguidores Instagram</div>
                    </div>
                  )}
                  {metaArtist.tiktokFollowers > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)" }}>
                      <SiTiktok className="w-4 h-4 text-zinc-300" />
                      <div className="text-xl font-black text-white leading-none">{metaArtist.tiktokFollowersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Seguidores TikTok</div>
                    </div>
                  )}
                  {metaArtist.youtubeSubscribers > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-xl p-4" style={{ background: "rgba(255,0,0,0.06)", border: "1px solid rgba(255,0,0,0.15)" }}>
                      <SiYoutube className="w-4 h-4 text-red-500" />
                      <div className="text-xl font-black text-white leading-none">{metaArtist.youtubeSubscribersFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Suscriptores YouTube</div>
                    </div>
                  )}
                  {metaArtist.deezerFans > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-xl p-4" style={{ background: "rgba(162,56,255,0.06)", border: "1px solid rgba(162,56,255,0.15)" }}>
                      <Music className="w-4 h-4" style={{ color: "#A238FF" }} />
                      <div className="text-xl font-black text-white leading-none">{metaArtist.deezerFansFmt}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">Fans Deezer</div>
                    </div>
                  )}
                </div>
                {metaArtist.label && (
                  <div className="mt-4 pt-4 border-t border-white/[0.05] flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-zinc-600">
                    <span><span className="text-zinc-500 font-bold">Sello: </span>{metaArtist.label}</span>
                    {metaArtist.country && <span><span className="text-zinc-500 font-bold">País: </span>{metaArtist.country}</span>}
                  </div>
                )}
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
              className="relative overflow-hidden rounded-2xl p-6"
              style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <span style={{ color: artist.accent }}><Music className="w-4 h-4" /></span>
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Canciones más escuchadas</h2>
                  </div>
                  {kworbStats?.spotify && (
                    <div className="text-[9px] uppercase tracking-widest text-zinc-700 font-bold">Spotify</div>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {topTracks.map((s, i) => (
                    <div key={i} className="flex items-center gap-4 py-1 border-b border-white/[0.04] last:border-0">
                      <span className="text-zinc-700 font-black text-sm w-5 shrink-0">{i + 1}</span>
                      <span className="flex-1 text-zinc-200 text-sm font-medium truncate">{s.title}</span>
                      <span className="text-sm font-black shrink-0" style={{ color: artist.accent }}>{s.streams}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* ══════════════════════════════════════════════════════════
            KWORB — LIFETIME STREAMS HERO
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
              className="relative overflow-hidden rounded-2xl p-6"
              style={{ background: "linear-gradient(160deg,#0a0f0a 0%,#090909 100%)", border: `1px solid ${artist.accent}18`, boxShadow: `0 8px 48px rgba(0,0,0,0.65), 0 0 0 1px ${artist.accent}08, inset 0 1px 0 rgba(255,255,255,0.04)` }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${artist.accent}40, transparent)` }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Play className="w-4 h-4" style={{ color: artist.accent }} />
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Streams Totales de por Vida</h2>
                  <div className="ml-auto flex flex-col items-end gap-0.5">
                    <span className="text-[9px] uppercase tracking-widest text-zinc-700 font-bold">Spotify · YouTube</span>
                    {lastUpdatedLabel && (
                      <span className="text-[9px] text-zinc-600 font-medium" data-testid="kworb-last-updated">
                        Actualizado {lastUpdatedLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {kworbStats.spotify && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 mb-1">
                        <SiSpotify className="w-4 h-4" style={{ color: "#1DB954" }} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Spotify</span>
                      </div>
                      <div
                        className="text-4xl font-black leading-none tracking-tight"
                        style={{ color: artist.accent, textShadow: `0 0 40px ${artist.accent}30` }}
                      >
                        {kworbStats.spotify.totalStreamsFmt}
                      </div>
                      <div className="text-[11px] text-zinc-600 mt-1">streams de por vida</div>
                      <div className="flex items-center gap-4 mt-2">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-zinc-700 font-bold">Diario</div>
                          <div className="text-xs font-black text-zinc-400">{kworbStats.spotify.dailyStreamsFmt}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-zinc-700 font-bold">Canciones</div>
                          <div className="text-xs font-black text-zinc-400">{kworbStats.spotify.trackCount}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {kworbStats.youtube && (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 mb-1">
                        <SiYoutube className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">YouTube</span>
                      </div>
                      <div className="text-4xl font-black leading-none tracking-tight text-red-400">
                        {kworbStats.youtube.totalViewsFmt}
                      </div>
                      <div className="text-[11px] text-zinc-600 mt-1">vistas totales</div>
                      <div className="flex items-center gap-4 mt-2">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-zinc-700 font-bold">Promedio diario</div>
                          <div className="text-xs font-black text-zinc-400">{kworbStats.youtube.dailyAvgFmt}</div>
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
              className="relative overflow-hidden rounded-2xl p-6"
              style={{ background: "linear-gradient(160deg,#0d0d0d 0%,#090909 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <Music className="w-4 h-4" style={{ color: artist.accent }} />
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Posiciones en México · Canciones Actuales</h2>
                  <div className="ml-auto text-[9px] uppercase tracking-widest text-zinc-700 font-bold">iTunes · Apple Music</div>
                </div>
                {/* Header row */}
                <div className="grid gap-x-3 mb-2 text-[9px] font-black uppercase tracking-widest text-zinc-700" style={{ gridTemplateColumns: "1fr 40px 40px 40px 40px 40px" }}>
                  <span>Canción</span>
                  <span className="text-center">SP</span>
                  <span className="text-center">AM</span>
                  <span className="text-center">YT</span>
                  <span className="text-center">IT</span>
                  <span className="text-center">DZ</span>
                </div>
                <div className="flex flex-col gap-0">
                  {kworbStats.chartPositions.map((cp, i) => (
                    <div
                      key={i}
                      className="grid gap-x-3 py-2 items-center"
                      style={{
                        gridTemplateColumns: "1fr 40px 40px 40px 40px 40px",
                        borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                      }}
                    >
                      <span className="text-sm text-zinc-300 font-medium truncate pr-2">{cp.song}</span>
                      {(["spotifyMx", "appleMusicMx", "youtubeMx", "itunesMx", "deezerMx"] as const).map((key) => {
                        const val = cp[key];
                        const isTop3 = val !== undefined && val <= 3;
                        return (
                          <span
                            key={key}
                            className="text-center text-xs font-black"
                            style={{ color: val === undefined ? "rgba(255,255,255,0.08)" : isTop3 ? artist.accent : "rgba(255,255,255,0.45)" }}
                          >
                            {val === undefined ? "—" : `#${val}`}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-4 text-[9px] text-zinc-700 font-bold uppercase tracking-wider">
                  <span>SP=Spotify</span><span>AM=Apple Music</span><span>YT=YouTube</span><span>IT=iTunes</span><span>DZ=Deezer</span>
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
            <div className="flex items-center gap-3 mb-4">
              <SiYoutube className="w-4 h-4 text-red-500" />
              <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Top Videos en YouTube</h2>
              <div className="flex-1 h-px ml-2" style={{ background: "rgba(255,255,255,0.07)" }} />
              <div className="text-[9px] uppercase tracking-widest text-zinc-700 font-bold">YouTube</div>
            </div>
            <div className="flex flex-col gap-2">
              {kworbStats.youtube.topVideos.slice(0, 8).map((v, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-4 rounded-xl px-4 py-3"
                  style={{ background: "linear-gradient(160deg,#0d0d0d,#090909)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <span className="text-zinc-700 font-black text-sm w-5 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-300 font-medium truncate">{v.title}</div>
                    {v.published && (
                      <div className="text-[10px] text-zinc-700 mt-0.5">{v.published}</div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-black text-red-400">{v.viewsFmt}</div>
                    <div className="text-[10px] text-zinc-700">{v.dailyFmt}/día</div>
                  </div>
                </motion.div>
              ))}
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
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-4 h-4" style={{ color: artist.accent }} />
              <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Giras & Touring</h2>
              <div className="flex-1 h-px ml-2" style={{ background: "rgba(255,255,255,0.07)" }} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {artist.tours.map((t, i) => (
                <motion.div
                  key={i}
                  whileHover={reduced ? {} : { scale: 1.02, y: -2, transition: { duration: 0.22 } }}
                  className="relative overflow-hidden rounded-xl p-5 cursor-pointer"
                  style={{
                    background: "linear-gradient(160deg, #0d0d0d 0%, #090909 100%)",
                    border: `1px solid ${artist.accent}1e`,
                    boxShadow: "0 6px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
                  <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full" style={{ background: artist.accent, boxShadow: `0 0 8px ${artist.accent}` }} />
                  <div className="relative z-10 pl-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{t.dates}</div>
                    <div className="font-black text-lg uppercase text-white leading-tight">{t.name}</div>
                    <div className="flex items-center gap-4 mt-3">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold">Recaudación est.</div>
                        <div className="text-sm font-black" style={{ color: artist.accent }}>{t.gross}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold">Ciudades</div>
                        <div className="text-sm font-black text-white">{t.cities}</div>
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
            onClick={() => window.history.back()}
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
