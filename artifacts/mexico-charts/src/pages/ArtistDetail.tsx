import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { useArtistsWeekly, findArtistBySlug, useArtistMetadata, lookupArtistMetadata } from "@/services/dataProvider";
import { SHEET_SOURCES } from "@/config/sheetSources";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import { ArrowLeft, TrendingUp, Music, MapPin, Globe } from "lucide-react";
import { SiSpotify, SiYoutube, SiApple, SiInstagram, SiTiktok, SiSoundcloud } from "react-icons/si";
import { useArtistImages } from "@/hooks/useArtistImages";
import { slugify } from "@/lib/utils";

export { slugify };

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

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
  listenerHistory: { month: string; listeners: number }[];
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
    listenerHistory: [
      { month: "Ene", listeners: 18.2 },
      { month: "Feb", listeners: 20.8 },
      { month: "Mar", listeners: 24.1 },
      { month: "Abr", listeners: 27.3 },
      { month: "May", listeners: 29.6 },
      { month: "Jun", listeners: 30.2 },
      { month: "Jul", listeners: 31.8 },
      { month: "Ago", listeners: 30.5 },
      { month: "Sep", listeners: 31.2 },
      { month: "Oct", listeners: 32.0 },
      { month: "Nov", listeners: 32.1 },
      { month: "Dic", listeners: 32.4 },
    ],
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
    tours: [
      { name: "Éxodo Tour",       dates: "Jun – Dic 2024", gross: "$60M+", cities: 42 },
      { name: "Double P Tour",    dates: "Ene – Mar 2025", gross: "$38M",  cities: 28 },
    ],
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
    listenerHistory: [
      { month: "Ene", listeners: 6.2 },
      { month: "Feb", listeners: 7.1 },
      { month: "Mar", listeners: 8.4 },
      { month: "Abr", listeners: 9.2 },
      { month: "May", listeners: 9.8 },
      { month: "Jun", listeners: 10.6 },
      { month: "Jul", listeners: 11.2 },
      { month: "Ago", listeners: 11.0 },
      { month: "Sep", listeners: 11.5 },
      { month: "Oct", listeners: 12.0 },
      { month: "Nov", listeners: 12.2 },
      { month: "Dic", listeners: 12.4 },
    ],
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
    tours: [
      { name: "Raíz Tour",         dates: "Jul – Nov 2024", gross: "$24M",  cities: 30 },
      { name: "Pa Las Baby's Tour", dates: "Feb – May 2025", gross: "$18M", cities: 22 },
    ],
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
    listenerHistory: [
      { month: "Ene", listeners: 7.8 },
      { month: "Feb", listeners: 8.4 },
      { month: "Mar", listeners: 9.0 },
      { month: "Abr", listeners: 9.6 },
      { month: "May", listeners: 10.1 },
      { month: "Jun", listeners: 10.4 },
      { month: "Jul", listeners: 10.8 },
      { month: "Ago", listeners: 11.0 },
      { month: "Sep", listeners: 11.2 },
      { month: "Oct", listeners: 11.4 },
      { month: "Nov", listeners: 11.6 },
      { month: "Dic", listeners: 11.7 },
    ],
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
    tours: [
      { name: "CT Tour 2024", dates: "Sep – Dic 2024", gross: "$12M", cities: 18 },
    ],
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
    listenerHistory: [
      { month: "Ene", listeners: 6.4 },
      { month: "Feb", listeners: 6.9 },
      { month: "Mar", listeners: 7.4 },
      { month: "Abr", listeners: 7.8 },
      { month: "May", listeners: 8.2 },
      { month: "Jun", listeners: 8.6 },
      { month: "Jul", listeners: 8.9 },
      { month: "Ago", listeners: 9.0 },
      { month: "Sep", listeners: 9.2 },
      { month: "Oct", listeners: 9.5 },
      { month: "Nov", listeners: 9.7 },
      { month: "Dic", listeners: 9.8 },
    ],
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
    tours: [
      { name: "Hielo Tour", dates: "Oct – Dic 2024", gross: "$9M", cities: 14 },
    ],
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
    listenerHistory: [
      { month: "Ene", listeners: 3.8 },
      { month: "Feb", listeners: 4.2 },
      { month: "Mar", listeners: 4.8 },
      { month: "Abr", listeners: 5.2 },
      { month: "May", listeners: 5.6 },
      { month: "Jun", listeners: 5.9 },
      { month: "Jul", listeners: 6.2 },
      { month: "Ago", listeners: 6.4 },
      { month: "Sep", listeners: 6.6 },
      { month: "Oct", listeners: 6.8 },
      { month: "Nov", listeners: 7.0 },
      { month: "Dic", listeners: 7.1 },
    ],
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
    tours: [
      { name: "Latinoamérica 24", dates: "Ago – Oct 2024", gross: "$19M", cities: 24 },
    ],
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
    listenerHistory: [
      { month: "Ene", listeners: 1.2 }, { month: "Feb", listeners: 1.5 },
      { month: "Mar", listeners: 1.8 }, { month: "Abr", listeners: 2.1 },
      { month: "May", listeners: 2.4 }, { month: "Jun", listeners: 2.6 },
      { month: "Jul", listeners: 2.9 }, { month: "Ago", listeners: 3.1 },
      { month: "Sep", listeners: 3.4 }, { month: "Oct", listeners: 3.6 },
      { month: "Nov", listeners: 3.8 }, { month: "Dic", listeners: 4.0 },
    ],
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

/* ─── PLATFORM ICON ──────────────────────────────────────────── */
function PlatformIcon({ icon, color }: { icon: ArtistData["platformStreams"][0]["icon"]; color: string }) {
  if (icon === "spotify")   return <SiSpotify   className="w-5 h-5" style={{ color }} />;
  if (icon === "youtube")   return <SiYoutube   className="w-5 h-5" style={{ color }} />;
  if (icon === "apple")     return <SiApple     className="w-5 h-5" style={{ color }} />;
  if (icon === "tiktok")     return <SiTiktok     className="w-5 h-5" style={{ color }} />;
  if (icon === "instagram")  return <SiInstagram  className="w-5 h-5" style={{ color }} />;
  if (icon === "soundcloud") return <SiSoundcloud className="w-5 h-5" style={{ color }} />;
  return <Music className="w-5 h-5" style={{ color }} />;
}

/* ─── CUSTOM TOOLTIP ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid rgba(57,255,20,0.25)", borderRadius: 8, padding: "8px 14px" }}>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em" }}>{label}</p>
      <p style={{ color: "#39FF14", fontWeight: 900, fontSize: 14 }}>{payload[0].value.toFixed(1)}M oyentes</p>
    </div>
  );
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

  /* ── Live platform/social stats — built from the unified artist profile ── */
  const livePlatforms: ArtistData["platformStreams"] = useMemo(() => {
    // artist now carries all metadata fields; use them to build a rich platform bar
    const m = metaArtist;
    if (!m) return artist.platformStreams;
    const rows: ArtistData["platformStreams"] = [];
    if (m.spotifyListeners > 0)
      rows.push({ platform: "Spotify",    streams: m.spotifyListenersFmt,     streamsNum: m.spotifyListeners / 1_000_000,    color: "#1DB954", icon: "spotify"    });
    if (m.youtubeSubscribers > 0)
      rows.push({ platform: "YouTube",    streams: m.youtubeSubscribersFmt,   streamsNum: m.youtubeSubscribers / 1_000_000,  color: "#FF0000", icon: "youtube"    });
    if (m.tiktokFollowers > 0)
      rows.push({ platform: "TikTok",     streams: m.tiktokFollowersFmt,      streamsNum: m.tiktokFollowers / 1_000_000,     color: "#69C9D0", icon: "tiktok"     });
    if (m.instagramFollowers > 0)
      rows.push({ platform: "Instagram",  streams: m.instagramFollowersFmt,   streamsNum: m.instagramFollowers / 1_000_000,  color: "#E1306C", icon: "instagram"  });
    if (m.deezerFans > 0)
      rows.push({ platform: "Deezer",     streams: m.deezerFansFmt,           streamsNum: m.deezerFans / 1_000_000,          color: "#A238FF", icon: "deezer"     });
    if (m.soundcloudFollowers > 0)
      rows.push({ platform: "SoundCloud", streams: m.soundcloudFollowersFmt,  streamsNum: m.soundcloudFollowers / 1_000_000, color: "#FF5500", icon: "soundcloud" });
    return rows.length > 0 ? rows : artist.platformStreams;
  }, [metaArtist, artist.platformStreams]);

  const names = useMemo(() => [artist.name], [artist.name]);
  const artistImages = useArtistImages(names);
  const photo = artistImages[artist.name] ?? null;

  const maxPlatform = Math.max(...livePlatforms.map(p => p.streamsNum));

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
          <Link
            href="/"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors duration-200 text-[11px] font-bold uppercase tracking-widest"
            data-testid="link-back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Charts
          </Link>
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
            LISTENER CHART
        ══════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          data-testid="section-listener-chart"
        >
          <div
            className="relative overflow-hidden rounded-2xl p-6"
            style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }}
          >
            <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-4 h-4" style={{ color: artist.accent }} />
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Oyentes Mensuales · 2024</h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={artist.listenerHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}M`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="listeners"
                    stroke={artist.accent}
                    strokeWidth={2.5}
                    dot={{ fill: artist.accent, strokeWidth: 0, r: 3 }}
                    activeDot={{ fill: artist.accent, stroke: "#050505", strokeWidth: 2, r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════
            PLATFORM + GENRE — 2 COL
        ══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* STREAMING BY PLATFORM */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-platforms"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-6 h-full"
              style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <Music className="w-4 h-4" style={{ color: artist.accent }} />
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Audiencia por Plataforma</h2>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(160, livePlatforms.length * 36)}>
                  <BarChart data={livePlatforms} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="platform" type="category" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip
                      formatter={(v: number) => [v >= 1 ? `${v.toFixed(1)}M` : `${Math.round(v * 1000)}K`, "Audiencia"]}
                      contentStyle={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                    />
                    <Bar dataKey="streamsNum" radius={4} maxBarSize={18}>
                      {livePlatforms.map((p) => (
                        <Cell key={p.platform} fill={p.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 mt-4">
                  {livePlatforms.map(p => (
                    <div key={p.platform} className="flex items-center gap-3">
                      <PlatformIcon icon={p.icon} color={p.color} />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-400 font-bold">{p.platform}</span>
                          <span className="font-black text-white">{p.streams}</span>
                        </div>
                        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${(p.streamsNum / maxPlatform) * 100}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full"
                            style={{ background: p.color }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/* GENRE BREAKDOWN */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            data-testid="section-genre-breakdown"
          >
            <div
              className="relative overflow-hidden rounded-2xl p-6 h-full"
              style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-2xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <span style={{ color: artist.accent }}><Music className="w-4 h-4" /></span>
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Distribución de Género</h2>
                </div>
                <div className="flex flex-col gap-4">
                  {artist.genreBreakdown.map((g, idx) => {
                    const opacity = 1 - idx * 0.18;
                    const color = artist.accent === "#39FF14" ? `rgba(57,255,20,${opacity})` : artist.accent;
                    return (
                      <div key={g.genre}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-sm font-bold text-zinc-300">{g.genre}</span>
                          <span className="text-sm font-black" style={{ color }}>{g.pct}%</span>
                        </div>
                        <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${g.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.2, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${color}, ${color}70)`, boxShadow: `0 0 8px ${color}50` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Top Songs */}
                {artist.topSongs.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-white/[0.06]">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-3">Canciones más escuchadas</div>
                    <div className="flex flex-col gap-2.5">
                      {artist.topSongs.map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-zinc-700 font-black text-xs w-4">{i + 1}</span>
                          <span className="flex-1 text-zinc-300 text-sm font-medium truncate">{s.title}</span>
                          <span className="text-xs font-black" style={{ color: artist.accent }}>{s.streams}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        </div>

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

        {/* ── BACK LINK ── */}
        <div className="pb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-zinc-600 hover:text-[#39FF14] transition-colors duration-200 text-xs font-black uppercase tracking-widest"
            data-testid="link-back-bottom"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a Charts
          </Link>
        </div>

      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t py-6 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <img src={logoUrl} alt="Mexico Charts" className="h-6 object-contain opacity-60" />
          <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold">© 2024 Mexico Charts. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
