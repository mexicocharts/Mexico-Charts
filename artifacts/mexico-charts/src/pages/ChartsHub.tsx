import { useState, useMemo, useCallback, useEffect } from "react";
import PageSEO from "@/components/PageSEO";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { SiSpotify, SiYoutube, SiApplemusic } from "react-icons/si";
import { MdMusicNote } from "react-icons/md";
import SiteNav from "@/components/SiteNav";

/* ── Brand ───────────────────────────────────────────────────────────────── */
const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/* ── Platform config ─────────────────────────────────────────────────────── */
const PLATFORMS = [
  {
    id: "YouTube",
    label: "YouTube",
    Icon: SiYoutube,
    color: "#FF0000",
    source: "YouTube Charts",
    sourceUrl: "https://charts.youtube.com/charts",
    meta: "YouTube · México · Semanal",
    charts: [
      { id: "YT_Songs_Weekly",   label: "Canciones", period: "Semanal" },
      { id: "YT_Videos_Daily",   label: "Videos",    period: "Diario"  },
      { id: "YT_Artists_Weekly", label: "Artistas",  period: "Semanal" },
      { id: "YT_Shorts_Daily",   label: "Shorts",    period: "Diario"  },
    ],
  },
  {
    id: "Spotify",
    label: "Spotify",
    Icon: SiSpotify,
    color: "#1DB954",
    source: "Spotify Charts",
    sourceUrl: "https://charts.spotify.com",
    meta: "Spotify · México · Diario y semanal",
    charts: [
      { id: "Spotify_Artists_Daily",   label: "Artistas",     period: "Diario"  },
      { id: "Spotify_Artists_Weekly",  label: "Artistas",     period: "Semanal" },
      { id: "Spotify_Regional_Daily",  label: "Regional",     period: "Diario"  },
      { id: "Spotify_Regional_Weekly", label: "Regional",     period: "Semanal" },
      { id: "Spotify_Viral_Daily",     label: "Viral",        period: "Diario"  },
    ],
  },
  {
    id: "Apple Music",
    label: "Apple Music",
    Icon: SiApplemusic,
    color: "#fc3c44",
    source: "Apple Music",
    sourceUrl: "https://music.apple.com/mx/room/1108041827",
    meta: "Apple Music · México · Diario",
    charts: [
      { id: "Apple_Songs",  label: "Canciones", period: "Diario" },
      { id: "Apple_Albums", label: "Álbumes",   period: "Diario" },
    ],
  },
  {
    id: "Deezer",
    label: "Deezer",
    Icon: MdMusicNote,
    color: "#A238FF",
    source: "Deezer",
    sourceUrl: "https://link.deezer.com/s/33eGo3PgAInikdTPxA2xN",
    meta: "Deezer · México · Diario",
    charts: [
      { id: "Deezer_Top_Mexico", label: "México", period: "Diario" },
    ],
  },
] as const;

type PlatformId = typeof PLATFORMS[number]["id"];

const MEXICO_CHARTS = [
  {
    title: "Mexico Charts Top 100",
    kicker: "MX100",
    body: "Los artistas más exitosos de la semana",
    href: "/mx100",
    status: "Activo",
  },
  {
    title: "Touring Power",
    kicker: "Giras",
    body: "Demanda en vivo y fechas activas",
    href: "/touring",
    status: "Base activa",
  },
  {
    title: "Radar Nuevos",
    kicker: "Nuevos",
    body: "Artistas emergentes con señal temprana",
    href: "/charts",
    status: "Próximo",
  },
  {
    title: "Social Power",
    kicker: "Fanbase",
    body: "Audiencia social y crecimiento digital",
    href: "/charts",
    status: "Próximo",
  },
  {
    title: "Legacy Acts",
    kicker: "Catálogo",
    body: "Carreras históricas con consumo vigente",
    href: "/charts",
    status: "Próximo",
  },
  {
    title: "Breakout Songs",
    kicker: "Canciones",
    body: "Tracks con mayor impulso reciente",
    href: "/charts",
    status: "Próximo",
  },
] as const;

const GENRE_LANES = [
  "Corridos Tumbados",
  "Regional Mexicano",
  "Banda",
  "Norteño",
  "Pop Mexicano",
  "Urbano Latino",
] as const;

/* ── Column definitions per sheet ────────────────────────────────────────── */
type ColDef = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  mobile?: boolean;
  isArtist?: boolean;
  isLink?: boolean;
  isMetric?: boolean;
  isMovement?: boolean;
};

const COLS: Record<string, ColDef[]> = {
  Spotify_Artists_Daily: [
    { key: "Artist",     label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Peak",       label: "Pico",     align: "right", mobile: false },
    { key: "Previous",   label: "Anterior", align: "right", mobile: false },
    { key: "Streak",     label: "Racha",    align: "right", mobile: false },
    { key: "Chart Date", label: "Fecha",    align: "right", mobile: false },
  ],
  Spotify_Artists_Weekly: [
    { key: "Artist",     label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Peak",       label: "Pico",     align: "right", mobile: false },
    { key: "Previous",   label: "Anterior", align: "right", mobile: false },
    { key: "Streak",     label: "Semanas",  align: "right", mobile: false },
    { key: "Chart Date", label: "Semana",   align: "right", mobile: false },
  ],
  YT_Artists_Weekly: [
    { key: "Artist Name",      label: "Artista",     align: "left",  mobile: true,  isArtist: true },
    { key: "Views",            label: "Vistas",      align: "right", mobile: false, isMetric: true },
    { key: "Growth",           label: "Crec.",       align: "right", mobile: false },
    { key: "Periods on Chart", label: "Semanas",     align: "right", mobile: false },
  ],
  YT_Songs_Weekly: [
    { key: "Artist Names", label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Track Name",   label: "Canción",  align: "left",  mobile: true  },
    { key: "Views",        label: "Vistas",   align: "right", mobile: false, isMetric: true },
    { key: "Growth",       label: "Crec.",    align: "right", mobile: false },
    { key: "YouTube URL",  label: "Ver",      align: "center",mobile: false, isLink: true },
  ],
  YT_Videos_Daily: [
    { key: "Artist Names", label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Video Title",  label: "Video",    align: "left",  mobile: true  },
    { key: "Periods on Chart", label: "Días", align: "right", mobile: false },
    { key: "YouTube URL",  label: "Ver",      align: "center",mobile: false, isLink: true },
  ],
  YT_Shorts_Daily: [
    { key: "Artist Names", label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Track Name",   label: "Short",    align: "left",  mobile: true  },
    { key: "YouTube URL",  label: "Ver",      align: "center",mobile: false, isLink: true },
  ],
  Spotify_Regional_Daily: [
    { key: "artist_names", label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "track_name",   label: "Canción",  align: "left",  mobile: true  },
    { key: "streams",      label: "Reprod.",  align: "right", mobile: false, isMetric: true },
    { key: "peak_rank",    label: "Pico",     align: "right", mobile: false },
    { key: "days_on_chart",label: "Días",     align: "right", mobile: false },
  ],
  Spotify_Regional_Weekly: [
    { key: "artist_names",  label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "track_name",    label: "Canción",  align: "left",  mobile: true  },
    { key: "streams",       label: "Reprod.",  align: "right", mobile: false, isMetric: true },
    { key: "peak_rank",     label: "Pico",     align: "right", mobile: false },
    { key: "weeks_on_chart",label: "Semanas",  align: "right", mobile: false },
  ],
  Spotify_Viral_Daily: [
    { key: "artist_names", label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "track_name",   label: "Canción",  align: "left",  mobile: true  },
    { key: "peak_rank",    label: "Pico",     align: "right", mobile: false },
    { key: "days_on_chart",label: "Días",     align: "right", mobile: false },
  ],
  Apple_Songs: [
    { key: "Artist Names", label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Title",        label: "Canción",  align: "left",  mobile: true  },
  ],
  Apple_Albums: [
    { key: "Artist Names", label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Title",        label: "Álbum",    align: "left",  mobile: true  },
  ],
  Deezer_Top_Mexico: [
    { key: "Artist",      label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Title",       label: "Canción",  align: "left",  mobile: true  },
    { key: "Album",       label: "Álbum",    align: "left",  mobile: false },
    { key: "Track Link",  label: "Ver",      align: "center",mobile: false, isLink: true },
  ],
};

/* ── Types ───────────────────────────────────────────────────────────────── */
type Row = Record<string, string>;
interface SheetData { headers: string[]; rows: Row[] }
interface HubData { lastUpdated: string; sheets: Record<string, SheetData> }

/* ── Helpers ─────────────────────────────────────────────────────────────── */
// Must match kworb's toSlug exactly: strip all non-alphanumeric, no hyphens.
// "Fuerza Regida" → "fuerzaregida", matching the known-slugs endpoint format.
function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Separator regex — keeps separators as capture groups so split() returns them */
const SEP_RE = /(\s*[,&]\s*|\s*\/\s*|\s+feat\.\s+|\s+ft\.\s+|\s+x\s+|\s+and\s+|\s+y\s+|\s+junto\s+a\s+)/i;

/* ── Per-sheet image config ──────────────────────────────────────────────── */
type ImgSrc = "youtube" | "artist";
interface SheetImgCfg { source: ImgSrc; round: boolean; field: string }
const SHEET_IMG: Record<string, SheetImgCfg> = {
  Spotify_Artists_Daily:   { source: "artist",  round: true,  field: "Artist"       },
  Spotify_Artists_Weekly:  { source: "artist",  round: true,  field: "Artist"       },
  YT_Artists_Weekly:       { source: "artist",  round: true,  field: "Artist Name"  },
  YT_Songs_Weekly:         { source: "youtube", round: false, field: "YouTube URL"  },
  YT_Videos_Daily:         { source: "youtube", round: false, field: "YouTube URL"  },
  YT_Shorts_Daily:         { source: "youtube", round: false, field: "YouTube URL"  },
  Spotify_Regional_Daily:  { source: "artist",  round: false, field: "artist_names" },
  Spotify_Regional_Weekly: { source: "artist",  round: false, field: "artist_names" },
  Spotify_Viral_Daily:     { source: "artist",  round: false, field: "artist_names" },
  Apple_Songs:             { source: "artist",  round: false, field: "Artist Names" },
  Apple_Albums:            { source: "artist",  round: true,  field: "Artist Names" },
  Deezer_Top_Mexico:       { source: "artist",  round: false, field: "Artist"       },
};

function ytThumb(url: string): string | null {
  const m = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

function firstArtist(credit: string): string {
  return credit.split(SEP_RE)[0]?.trim() ?? "";
}

function fmt(val: string): string {
  if (!val || val === "n/a" || val === "—") return val || "—";
  const n = parseInt(val.replace(/,/g, ""), 10);
  if (isNaN(n)) return val;
  return n.toLocaleString("es-MX");
}

function topEntry(sheetId: string, data?: HubData) {
  const rows = data?.sheets?.[sheetId]?.rows ?? [];
  const row = rows[0];
  if (!row) return null;

  if (sheetId === "YT_Artists_Weekly") {
    return {
      title: row["Artist Name"] ?? "—",
      detail: row["Views"] ? `${fmt(row["Views"])} vistas` : "YouTube Artists",
    };
  }

  if (sheetId === "YT_Songs_Weekly") {
    return {
      title: row["Track Name"] ?? "—",
      detail: row["Artist Names"] ?? "YouTube Songs",
    };
  }

  if (sheetId === "Spotify_Artists_Weekly") {
    return {
      title: row["Artist"] ?? "—",
      detail: "Spotify Artists semanal",
    };
  }

  if (sheetId === "Spotify_Regional_Weekly") {
    return {
      title: row["track_name"] ?? "—",
      detail: row["artist_names"] ?? "Spotify Regional",
    };
  }

  return null;
}

function rankKey(row: Row): string {
  return (row["Rank"] ?? row["rank"] ?? "").trim();
}
function prevKey(row: Row): string {
  return (row["Previous Rank"] ?? row["previous_rank"] ?? "").trim();
}
function movKey(row: Row): string {
  return (row["Movement"] ?? "").trim();
}
function isMexican(row: Row): boolean {
  return (row["Contains Mexican Artist"] ?? "").toUpperCase() === "TRUE";
}

/* ── Known-slugs hook ────────────────────────────────────────────────────── */
function useKnownSlugs() {
  return useQuery<{ slugs: string[] }>({
    queryKey: ["known-artist-slugs"],
    queryFn: async () => {
      const resp = await fetch("/api/kworb/known-slugs");
      if (!resp.ok) return { slugs: [] };
      return resp.json();
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

/* ── Movement badge ──────────────────────────────────────────────────────── */
function Movement({ rank, prev, mov }: { rank: string; prev: string; mov: string }) {
  // Priority: use Movement column (Apple/Deezer), else derive from rank vs prev
  let label = mov || "";
  let positive = false;
  let negative = false;
  let isNew = false;
  let isNeutral = false;

  if (label === "NEW" || label === "Re") {
    isNew = true;
  } else if (label === "=" || label === "") {
    // Try to derive from rank/prev
    if (prev && rank) {
      const d = parseInt(prev) - parseInt(rank);
      if (d > 0) { label = `+${d}`; positive = true; }
      else if (d < 0) { label = String(d); negative = true; }
      else isNeutral = true;
    } else {
      isNeutral = true;
    }
  } else {
    const n = parseInt(label);
    if (!isNaN(n)) {
      if (n > 0) { positive = true; label = `+${n}`; }
      else if (n < 0) { negative = true; }
      else isNeutral = true;
    }
  }

  if (isNew) return (
    <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded"
      style={{ background: `${G}22`, color: G }}>NEW</span>
  );
  if (isNeutral) return <span style={{ color: "rgba(255,255,255,0.42)", fontSize: 11 }}>—</span>;
  if (positive) return <span className="text-[11px] font-black" style={{ color: G }}>{label}</span>;
  if (negative) return <span className="text-[11px] font-black" style={{ color: "#f87171" }}>{label}</span>;
  return <span style={{ color: "rgba(255,255,255,0.42)", fontSize: 11 }}>—</span>;
}

/* ── Artist cell with linking ────────────────────────────────────────────── */
// Links only artists that have a real Mexico Charts profile page (knownSlugs).
// Exact slug match only — no substring/partial matching to avoid false positives.
function ArtistCell({ value, knownSlugs }: { value: string; knownSlugs: Set<string> }) {
  const parts = value.split(SEP_RE);

  return (
    <>
      {parts.map((part, i) => {
        // Odd-indexed parts are separators (captured groups from split)
        if (i % 2 === 1) {
          return <span key={i} style={{ color: "rgba(255,255,255,0.4)" }}>{part}</span>;
        }
        const trimmed = part.trim();
        if (!trimmed) return <span key={i}>{part}</span>;

        const slug = slugify(trimmed);
        if (slug && knownSlugs.has(slug)) {
          return (
            <Link key={i} href={`/artist/${slug}`}>
              <span className="underline decoration-white/30 underline-offset-2 hover:decoration-white/70 transition-all cursor-pointer text-white">
                {part}
              </span>
            </Link>
          );
        }
        return <span key={i} className="text-white">{part}</span>;
      })}
    </>
  );
}

/* ── Thumbnail ───────────────────────────────────────────────────────────── */
function Thumbnail({ src, name, round, size = 36 }: { src?: string | null; name: string; round: boolean; size?: number }) {
  const [status, setStatus] = useState<"idle" | "loaded" | "error">("idle");
  return (
    <div className="flex-shrink-0" style={{
      width: size, height: size,
      borderRadius: round ? "50%" : 5,
      overflow: "hidden",
      background: "rgba(255,255,255,0.07)",
      position: "relative",
    }}>
      {src && status !== "error" && (
        <img
          src={src} alt={name}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            opacity: status === "loaded" ? 1 : 0,
            transition: "opacity 0.3s",
            position: "absolute", inset: 0,
          }}
        />
      )}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.33, fontWeight: 900,
        color: "rgba(255,255,255,0.48)",
        opacity: status === "loaded" ? 0 : 1,
        transition: "opacity 0.3s",
        userSelect: "none",
      }}>
        {name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

function PreviewArt({ src, name }: { src?: string | null; name: string }) {
  const [status, setStatus] = useState<"idle" | "loaded" | "error">("idle");
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
      {src && status !== "error" && (
        <img
          src={src}
          alt={name}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          style={{ opacity: status === "loaded" ? 1 : 0 }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center text-2xl font-black"
        style={{ color: "rgba(255,255,255,0.4)", opacity: status === "loaded" ? 0 : 1 }}>
        {name.charAt(0).toUpperCase()}
      </div>
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function SkeletonRow({ i }: { i: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: 1 - i * 0.08 }}>
      <div className="w-8 h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
      <div className="w-6 flex-shrink-0" />
      <div className="w-9 h-9 rounded animate-pulse flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="flex-1 h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
      <div className="hidden md:block h-3 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function ChartsHub() {
  const search = useSearch();

  // Parse initial platform/sheet from URL query params (e.g. ?platform=YouTube&sheet=YT_Artists_Weekly)
  const initialState = useMemo(() => {
    const params = new URLSearchParams(search);
    const pid = params.get("platform") as PlatformId | null;
    const sid = params.get("sheet");
    const validPlatform = PLATFORMS.find(p => p.id === pid);
    if (validPlatform) {
      const validSheet = validPlatform.charts.find(c => c.id === sid);
      return {
        platform: validPlatform.id,
        sheet: validSheet ? validSheet.id : validPlatform.charts[0].id,
      };
    }
    return { platform: "YouTube" as PlatformId, sheet: "YT_Songs_Weekly" };
  }, []);

  const [activePlatform, setActivePlatform] = useState<PlatformId>(initialState.platform);
  const [activeSheet, setActiveSheet] = useState(initialState.sheet);
  const [filterMex, setFilterMex] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  const platform = PLATFORMS.find(p => p.id === activePlatform)!;

  const { data, isLoading, isError } = useQuery<HubData>({
    queryKey: ["charts-hub"],
    queryFn: async () => {
      const resp = await fetch("/api/charts/hub");
      if (!resp.ok) throw new Error("Failed to fetch charts");
      return resp.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });

  const { data: slugsData } = useKnownSlugs();
  const knownSlugs = useMemo<Set<string>>(
    () => new Set(slugsData?.slugs ?? []),
    [slugsData],
  );

  const sheetData = useMemo<SheetData | null>(() => {
    return data?.sheets?.[activeSheet] ?? null;
  }, [data, activeSheet]);

  const rows = useMemo<Row[]>(() => {
    if (!sheetData) return [];
    let r = sheetData.rows;
    if (filterMex) r = r.filter(isMexican);
    return r;
  }, [sheetData, filterMex]);

  const visibleRows = useMemo(() => showAll ? rows : rows.slice(0, 50), [rows, showAll]);

  const cols = useMemo(() => COLS[activeSheet] ?? [], [activeSheet]);

  /* ── Per-row image resolution ─────────────────────────────────────────── */
  const imgCfg = SHEET_IMG[activeSheet] ?? null;

  const topSpotifyArtists = useMemo(() => {
    return data?.sheets?.["Spotify_Artists_Weekly"]?.rows.slice(0, 5) ?? [];
  }, [data]);

  const topYoutubeArtists = useMemo(() => {
    return data?.sheets?.["YT_Artists_Weekly"]?.rows.slice(0, 5) ?? [];
  }, [data]);

  const topYoutubeSongs = useMemo(() => {
    return data?.sheets?.["YT_Songs_Weekly"]?.rows.slice(0, 5) ?? [];
  }, [data]);

  const topRegionalSongs = useMemo(() => {
    return data?.sheets?.["Spotify_Regional_Weekly"]?.rows.slice(0, 5) ?? [];
  }, [data]);

  const featuredArtistNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (name: string) => {
      const clean = firstArtist(name ?? "");
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    };
    topSpotifyArtists.forEach(row => add(row["Artist"] ?? ""));
    topYoutubeArtists.forEach(row => add(row["Artist Name"] ?? ""));
    topYoutubeSongs.forEach(row => add(row["Artist Names"] ?? ""));
    topRegionalSongs.forEach(row => add(row["artist_names"] ?? ""));
    return out;
  }, [topSpotifyArtists, topYoutubeArtists, topYoutubeSongs, topRegionalSongs]);

  const artistNamesForImg = useMemo<string[]>(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (name: string) => {
      const clean = firstArtist(name ?? "");
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    };
    featuredArtistNames.forEach(add);
    if (imgCfg?.source === "artist") {
      for (const row of rows) {
        add(row[imgCfg.field] ?? "");
      }
    }
    return out;
  }, [rows, imgCfg, activeSheet, featuredArtistNames]);

  const { data: artistImgData } = useQuery<Record<string, string | null>>({
    queryKey: ["chart-artist-images", artistNamesForImg.join(",")],
    queryFn: async () => {
      if (!artistNamesForImg.length) return {};
      const resp = await fetch(`/api/spotify/artist-images?names=${encodeURIComponent(artistNamesForImg.join(","))}`);
      if (!resp.ok) return {};
      return resp.json();
    },
    enabled: artistNamesForImg.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  function getRowImg(row: Row): string | null {
    if (!imgCfg) return null;
    if (imgCfg.source === "youtube") return ytThumb(row[imgCfg.field] ?? "");
    const name = firstArtist(row[imgCfg.field] ?? "");
    return name ? (artistImgData?.[name] ?? null) : null;
  }

  function getRowName(row: Row): string {
    if (!imgCfg) return "";
    return firstArtist(row[imgCfg.field] ?? "") || (row[imgCfg.field] ?? "");
  }

  function getArtistPreviewImg(name: string): string | null {
    const clean = firstArtist(name);
    return clean ? (artistImgData?.[clean] ?? null) : null;
  }

  function previewImg(sheetId: string, row: Row): string | null {
    if (sheetId === "YT_Songs_Weekly") return ytThumb(row["YouTube URL"] ?? "");
    if (sheetId === "YT_Artists_Weekly") return getArtistPreviewImg(row["Artist Name"] ?? "");
    if (sheetId === "Spotify_Artists_Weekly") return getArtistPreviewImg(row["Artist"] ?? "");
    if (sheetId === "Spotify_Regional_Weekly") return getArtistPreviewImg(row["artist_names"] ?? "");
    return null;
  }

  function previewTitle(sheetId: string, row: Row): string {
    if (sheetId === "YT_Songs_Weekly") return row["Track Name"] ?? "—";
    if (sheetId === "YT_Artists_Weekly") return row["Artist Name"] ?? "—";
    if (sheetId === "Spotify_Artists_Weekly") return row["Artist"] ?? "—";
    if (sheetId === "Spotify_Regional_Weekly") return row["track_name"] ?? "—";
    return "—";
  }

  function previewDetail(sheetId: string, row: Row): string {
    if (sheetId === "YT_Songs_Weekly") return row["Artist Names"] ?? "";
    if (sheetId === "YT_Artists_Weekly") return row["Views"] ? `${fmt(row["Views"])} vistas` : "YouTube semanal";
    if (sheetId === "Spotify_Artists_Weekly") return "Spotify semanal";
    if (sheetId === "Spotify_Regional_Weekly") return row["artist_names"] ?? "";
    return "";
  }

  const switchPlatform = useCallback((pid: PlatformId) => {
    const p = PLATFORMS.find(x => x.id === pid)!;
    setActivePlatform(pid);
    setActiveSheet(p.charts[0].id);
    setFilterMex(false);
    setShowAll(false);
  }, []);

  const switchSheet = useCallback((sid: string) => {
    setActiveSheet(sid);
    setFilterMex(false);
    setShowAll(false);
  }, []);

  const updatedFmt = useMemo(() => {
    if (!data?.lastUpdated) return null;
    return new Date(data.lastUpdated).toLocaleString("es-MX", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }, [data]);

  const no1Entries = useMemo(() => {
    const entries = [
      { label: "YouTube artistas", entry: topEntry("YT_Artists_Weekly", data), href: "/charts?platform=YouTube&sheet=YT_Artists_Weekly" },
      { label: "Spotify semanal", entry: topEntry("Spotify_Artists_Weekly", data), href: "/charts?platform=Spotify&sheet=Spotify_Artists_Weekly" },
      { label: "YouTube canciones", entry: topEntry("YT_Songs_Weekly", data), href: "/charts?platform=YouTube&sheet=YT_Songs_Weekly" },
      { label: "Regional semanal", entry: topEntry("Spotify_Regional_Weekly", data), href: "/charts?platform=Spotify&sheet=Spotify_Regional_Weekly" },
    ];
    return entries.flatMap(item => item.entry ? [{ ...item, entry: item.entry }] : []);
  }, [data]);

  const currentChartMeta = platform.charts.find(c => c.id === activeSheet) ?? platform.charts[0];
  const activeMeta = `${platform.label} · México · ${currentChartMeta.period || "Diario"}`;

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <PageSEO
        title="Listas de música mexicana — YouTube, Spotify, Apple Music"
        description="Listas semanales y diarias de música mexicana en YouTube, Spotify, Apple Music y Deezer. Corridos tumbados, regional mexicano, norteño y más."
        path="/charts"
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />

      <SiteNav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 pt-8 pb-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="text-[10px] font-black uppercase tracking-[0.35em] mb-2" style={{ color: G }}>
              Listas
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.04 }}
              className="font-black uppercase leading-[0.88]"
              style={{ fontSize: "clamp(2rem,4vw,3.8rem)", letterSpacing: "-0.04em" }}>
              Universo de <span style={{ color: G }}>charts</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="mt-4 max-w-3xl text-sm md:text-base leading-relaxed"
              style={{ color: "rgba(255,255,255,0.55)" }}>
              Rankings propios de Mexico Charts, números uno de la semana, géneros y listas oficiales de plataformas en un solo lugar.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
              className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.22em]"
                style={{ color: "rgba(255,255,255,0.48)" }}>
                MX100 · Plataformas · Géneros · Giras
              </span>
              <Link href="/metodologia">
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em] hover:opacity-70 transition-opacity"
                  style={{ color: "rgba(57,255,20,0.74)" }}>
                  ⓘ Metodología
                </span>
              </Link>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.38)" }}>
              YouTube · Spotify · Apple Music · Deezer
            </span>
            {updatedFmt && (
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>
                Actualizado: {updatedFmt}
              </span>
            )}
          </motion.div>
        </div>
      </section>

      <div className="px-6 lg:px-12 py-6 space-y-5">
        {/* ── CHART UNIVERSE ─────────────────────────────────────────────── */}
        <section id="mexico-charts" className="relative overflow-hidden px-4 py-5 md:px-7 md:py-7"
          style={{ border: `1px solid ${G}24`, background: "radial-gradient(circle at 20% 0%, rgba(57,255,20,0.14), transparent 34%), linear-gradient(135deg, rgba(57,255,20,0.055), rgba(255,255,255,0.018) 48%, rgba(0,0,0,0))" }}>
          <div className="pointer-events-none absolute -right-8 top-2 hidden text-[13vw] font-black uppercase leading-none opacity-[0.045] xl:block">
            Charts
          </div>

          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_440px]">
            <div className="min-w-0">
              <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.28em] mb-3" style={{ color: G }}>
                    Mexico Charts
                  </p>
                  <h2 className="max-w-5xl font-black uppercase leading-[0.86]"
                    style={{ fontSize: "clamp(2.55rem,7vw,7.25rem)", letterSpacing: "-0.055em" }}>
                    Charts con identidad propia
                  </h2>
                </div>
                <Link href="/mx100">
                  <span className="hidden shrink-0 text-[9px] font-black uppercase tracking-[0.2em] hover:opacity-70 transition-opacity md:inline-flex"
                    style={{ color: G }}>
                    Ver MX100
                  </span>
                </Link>
              </div>

              <Link href="/mx100">
                <motion.article whileHover={{ y: -3 }}
                  className="group grid cursor-pointer gap-5 overflow-hidden p-4 md:grid-cols-[minmax(0,1fr)_220px] md:p-5"
                  style={{ borderRadius: 8, border: `1px solid ${G}66`, background: "rgba(0,0,0,0.42)", boxShadow: `0 0 32px ${G}10` }}>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: G }}>
                      MX100 · Activo
                    </p>
                    <h3 className="mt-4 max-w-3xl text-3xl font-black uppercase leading-[0.9] md:text-5xl">
                      Mexico Charts Top 100
                    </h3>
                    <p className="mt-5 max-w-2xl text-sm leading-relaxed md:text-base" style={{ color: "rgba(255,255,255,0.58)" }}>
                      Los artistas más exitosos de la semana, con una fórmula editorial pensada para música mexicana.
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2 md:grid-cols-2">
                    {topSpotifyArtists.slice(0, 4).map((row, index) => {
                      const artist = row["Artist"] ?? "";
                      return (
                        <div key={`${artist}-${index}`} className="relative aspect-square overflow-hidden"
                          style={{ borderRadius: 8, border: `1px solid ${index === 0 ? G : "rgba(255,255,255,0.12)"}` }}>
                          <PreviewArt src={getArtistPreviewImg(artist)} name={artist || "MX"} />
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-black tabular-nums"
                            style={{ background: G, color: "#000", borderRadius: 4 }}>
                            {index + 1}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.article>
              </Link>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {MEXICO_CHARTS.slice(1).map((chart) => (
                  <Link key={chart.title} href={chart.href}>
                    <span className="flex min-h-[62px] items-center justify-between gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] hover:bg-white/[0.035] transition-colors"
                      style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.76)" }}>
                      <span>
                        <span className="block text-[8px] tracking-[0.2em]" style={{ color: G }}>{chart.kicker}</span>
                        <span className="mt-1 block">{chart.title}</span>
                      </span>
                      <span className="text-[8px] tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {chart.status}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: G }}>
                  Top semanal
                </p>
                <span className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Spotify Artists
                </span>
              </div>
              <div className="divide-y divide-white/[0.06] overflow-hidden"
                style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.36)" }}>
                {topSpotifyArtists.map((row, index) => {
                  const artist = row["Artist"] ?? "";
                  return (
                    <Link key={`${artist}-${index}`} href="/charts?platform=Spotify&sheet=Spotify_Artists_Weekly">
                      <div className="grid cursor-pointer grid-cols-[34px_44px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 hover:bg-white/[0.035]">
                        <span className="text-xl font-black tabular-nums" style={{ color: index === 0 ? G : "#fff" }}>
                          {index + 1}
                        </span>
                        <Thumbnail src={getArtistPreviewImg(artist)} name={artist} round={true} size={44} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black uppercase tracking-tight">{artist || "—"}</p>
                          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.34)" }}>
                            Pico {row["Peak"] || "—"} · Racha {row["Streak"] || "—"}
                          </p>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: G }}>
                          Ver
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {no1Entries.length > 0 && (
          <section id="no1" className="px-4 py-5 md:px-7 md:py-6"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}>
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="text-2xl font-black uppercase leading-none md:text-4xl">
                No. 1 esta semana
              </h2>
              {updatedFmt && (
                <span className="hidden text-[9px] font-bold uppercase tracking-[0.16em] md:block" style={{ color: "rgba(255,255,255,0.32)" }}>
                  {updatedFmt}
                </span>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { label: "YouTube artistas", sheet: "YT_Artists_Weekly", rows: topYoutubeArtists, href: "/charts?platform=YouTube&sheet=YT_Artists_Weekly" },
                { label: "Spotify semanal", sheet: "Spotify_Artists_Weekly", rows: topSpotifyArtists, href: "/charts?platform=Spotify&sheet=Spotify_Artists_Weekly" },
                { label: "YouTube canciones", sheet: "YT_Songs_Weekly", rows: topYoutubeSongs, href: "/charts?platform=YouTube&sheet=YT_Songs_Weekly" },
                { label: "Regional semanal", sheet: "Spotify_Regional_Weekly", rows: topRegionalSongs, href: "/charts?platform=Spotify&sheet=Spotify_Regional_Weekly" },
              ].map((module) => (
                <div key={module.sheet} className="overflow-hidden"
                  style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.28)" }}>
                  <Link href={module.href}>
                    <div className="flex items-center justify-between px-4 py-3" style={{ background: `${G}e8`, color: "#000" }}>
                      <h3 className="text-sm font-black uppercase tracking-[0.1em]">{module.label}</h3>
                      <span className="text-[8px] font-black uppercase tracking-[0.18em]">Ver lista</span>
                    </div>
                  </Link>
                  <div className="divide-y divide-white/[0.06]">
                    {module.rows.map((row, index) => (
                      <Link key={`${module.sheet}-${index}`} href={module.href}>
                        <div className="grid cursor-pointer grid-cols-[28px_42px_minmax(0,1fr)] items-center gap-3 px-4 py-3 hover:bg-white/[0.035]">
                          <span className="text-xl font-black tabular-nums" style={{ color: index === 0 ? G : "rgba(255,255,255,0.72)" }}>
                            {index + 1}
                          </span>
                          <Thumbnail src={previewImg(module.sheet, row)} name={previewTitle(module.sheet, row)} round={module.sheet.includes("Artists")} size={42} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">{previewTitle(module.sheet, row)}</p>
                            <p className="mt-0.5 truncate text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.42)" }}>
                              {previewDetail(module.sheet, row)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="genres" className="px-4 py-5 md:px-7 md:py-6"
          style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: G }}>
              Géneros
            </h2>
            <Link href="/generos">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] hover:opacity-70 transition-opacity" style={{ color: G }}>
                Explorar
              </span>
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {GENRE_LANES.map((genre, index) => (
              <Link key={genre} href="/generos">
                <span className="group flex min-h-[74px] items-end justify-between p-3 text-[11px] font-black uppercase tracking-[0.14em] hover:bg-white/[0.035] transition-colors"
                  style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.78)" }}>
                  {genre}
                  <span className="text-lg tabular-nums" style={{ color: index === 0 ? G : "rgba(255,255,255,0.18)" }}>
                    {index + 1}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="platforms" className="pt-4">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] mb-2" style={{ color: G }}>
                Plataformas
              </p>
              <h2 className="text-2xl md:text-3xl font-black uppercase leading-none">
                Listas oficiales
              </h2>
            </div>
            <span className="hidden md:block text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.32)" }}>
              {activeMeta}
            </span>
          </div>
        </section>

        {/* ── PLATFORM TABS ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => {
            const active = activePlatform === p.id;
            return (
              <button key={p.id} type="button" onClick={() => switchPlatform(p.id as PlatformId)}
                aria-pressed={active}
                aria-label={`Ver listas de ${p.label}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all"
                style={{
                  background: active ? "rgba(255,255,255,0.07)" : "transparent",
                  border: active ? `1px solid ${p.color}55` : "1px solid rgba(255,255,255,0.08)",
                  color: active ? "#fff" : "rgba(255,255,255,0.4)",
                  boxShadow: active ? `0 0 16px ${p.color}18` : "none",
                }}>
                <p.Icon className="w-3.5 h-3.5" style={{ color: active ? p.color : "rgba(255,255,255,0.3)" }} />
                {p.label}
              </button>
            );
          })}
        </div>

        {/* ── CONTROLS ROW ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Chart type pills */}
          <div className="flex flex-wrap gap-2">
            {platform.charts.map(c => {
              const active = activeSheet === c.id;
              return (
                <button key={c.id} type="button" onClick={() => switchSheet(c.id)}
                  aria-pressed={active}
                  aria-label={`Ver ${c.label}${c.period ? ` ${c.period}` : ""}`}
                  className="px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all"
                  style={{
                    background: active ? G : "rgba(255,255,255,0.05)",
                    color: active ? "#000" : "rgba(255,255,255,0.4)",
                    border: active ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}>
                  {c.label}{c.period ? ` · ${c.period}` : ""}
                </button>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "rgba(255,255,255,0.38)" }}>
            Fuente: {platform.source}
          </div>

          {/* Mexican filter toggle */}
          <div className="flex items-center gap-0 rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            {[false, true].map(isMex => (
              <button key={String(isMex)} type="button" onClick={() => setFilterMex(isMex)}
                aria-pressed={filterMex === isMex}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-all"
                style={{
                  background: filterMex === isMex ? (isMex ? `${G}22` : "rgba(255,255,255,0.07)") : "transparent",
                  color: filterMex === isMex ? (isMex ? G : "#fff") : "rgba(255,255,255,0.3)",
                }}>
                {isMex ? "Solo artistas mexicanos" : "Todos"}
              </button>
            ))}
          </div>
        </div>

        {/* ── FILTER NOTE ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {filterMex && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="rounded-xl px-4 py-3 text-[11px] leading-relaxed"
              style={{ background: `${G}0d`, border: `1px solid ${G}25`, color: "rgba(255,255,255,0.5)" }}>
              <span style={{ color: G, fontWeight: 900 }}>Vista filtrada por Mexico Charts · </span>
              Se muestran filas con artistas mexicanos o colaboraciones con participación mexicana. Las posiciones originales del chart se conservan.
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CHART TABLE ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div key={activeSheet + String(filterMex)}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}>

            {/* Column header (desktop) */}
            {!isLoading && !isError && cols.length > 0 && (
              <div className="hidden md:flex items-center px-5 py-2 mb-1 gap-4 text-[9px] font-black uppercase tracking-[0.22em]"
                style={{ color: "rgba(255,255,255,0.52)" }}>
                <span className="w-8 text-right">#</span>
                <span className="w-6 text-center">Mov</span>
                {cols.map((c, i) => (
                  <span key={i} className={`${i === 0 ? "flex-1" : "w-24 text-right"} ${c.align === "right" ? "text-right" : ""}`}>
                    {c.label}
                  </span>
                ))}
              </div>
            )}

            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

              {isLoading && Array.from({ length: 15 }, (_, i) => <SkeletonRow key={i} i={i} />)}

              {isError && (
                <div className="py-20 text-center">
                  <p className="text-sm font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Listas no disponibles
                  </p>
                  <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.50)" }}>
                    Intenta recargar la página en unos momentos.
                  </p>
                </div>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-sm font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.52)" }}>
                    Sin resultados para este filtro
                  </p>
                </div>
              )}

              {visibleRows.map((row, i) => {
                const rank = rankKey(row);
                const prev = prevKey(row);
                const mov  = movKey(row);
                const rankNum = parseInt(rank) || (i + 1);
                const isTop3 = rankNum <= 3;

                return (
                  <motion.div key={`${activeSheet}-${rank || i}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.005, 0.25) }}
                    style={{ borderBottom: i < visibleRows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>

                    {/* Desktop row */}
                    <div className="hidden md:flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.018] transition-colors">
                      {/* Rank */}
                      <div className="w-8 text-right font-black text-sm flex-shrink-0"
                        style={{ color: isTop3 ? G : "rgba(255,255,255,0.3)", textShadow: isTop3 ? `0 0 20px ${G}55` : "none" }}>
                        {rank}
                      </div>
                      {/* Movement */}
                      <div className="w-6 text-center flex-shrink-0">
                        <Movement rank={rank} prev={prev} mov={mov} />
                      </div>
                      {/* Thumbnail */}
                      {imgCfg && (
                        <Thumbnail
                          src={getRowImg(row)}
                          name={getRowName(row)}
                          round={imgCfg.round}
                          size={36}
                        />
                      )}
                      {/* Data columns */}
                      {cols.map((col, ci) => {
                        const val = row[col.key] ?? "";
                        const isFirst = ci === 0;
                        return (
                          <div key={ci}
                            className={`${isFirst ? "flex-1 min-w-0" : "w-24 flex-shrink-0"} ${col.align === "right" ? "text-right" : ""}`}>
                            {col.isLink && val ? (
                              <a href={val} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
                                style={{ color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.25)", padding: "3px 8px", borderRadius: 6 }}>
                                ↗ Ver
                              </a>
                            ) : col.isArtist ? (
                              <span className="text-sm font-bold text-white truncate block">
                                <ArtistCell value={val} knownSlugs={knownSlugs} />
                              </span>
                            ) : col.isMetric ? (
                              <div className="text-xs font-black tabular-nums" style={{ color: G }}>{fmt(val)}</div>
                            ) : isFirst ? (
                              <span className="text-sm font-bold text-white truncate block">{val}</span>
                            ) : (
                              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{val || "—"}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile card */}
                    <div className="md:hidden flex items-center gap-3 px-4 py-3.5">
                      <div className="w-7 text-right font-black text-sm flex-shrink-0"
                        style={{ color: isTop3 ? G : "rgba(255,255,255,0.3)" }}>
                        {rank}
                      </div>
                      {imgCfg && (
                        <Thumbnail
                          src={getRowImg(row)}
                          name={getRowName(row)}
                          round={imgCfg.round}
                          size={32}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        {/* Artist */}
                        {cols.filter(c => c.isArtist && c.mobile).map((col, ci) => (
                          <div key={ci} className="text-sm font-black text-white truncate">
                            <ArtistCell value={row[col.key] ?? ""} knownSlugs={knownSlugs} />
                          </div>
                        ))}
                        {/* Title/track */}
                        {cols.filter(c => !c.isArtist && c.mobile && !c.isLink).map((col, ci) => (
                          <div key={ci} className="text-[11px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                            {row[col.key] || ""}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Movement rank={rank} prev={prev} mov={mov} />
                        {cols.filter(c => c.isMetric).map((col, ci) => (
                          <div key={ci} className="text-[10px] font-black tabular-nums" style={{ color: G }}>
                            {fmt(row[col.key] ?? "")}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Show more */}
            {!isLoading && rows.length > 50 && !showAll && (
              <div className="flex justify-center mt-4">
                <button onClick={() => setShowAll(true)}
                  className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.18em] transition-all hover:opacity-80"
                  style={{ border: `1px solid ${G}44`, color: G, background: `${G}0d` }}>
                  Ver los {rows.length - 50} restantes
                </button>
              </div>
            )}

            {/* Fuente + metodología */}
            {!isLoading && !isError && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.50)" }}>
                    Fuente: {platform.source} · {activeMeta} ·{" "}
                    <a href={platform.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                      {platform.sourceUrl}
                    </a>
                  </span>
                  {sheetData && (
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.50)" }}>
                      {rows.length} entradas
                    </span>
                  )}
                </div>
                <p className="px-1 text-[9px] leading-relaxed" style={{ color: "rgba(255,255,255,0.48)", maxWidth: "65ch" }}>
                  Mexico Charts organiza y presenta datos de plataformas musicales para mostrar listas en México.
                  La vista «Solo artistas mexicanos» es un filtro editorial aplicado a las listas originales y conserva las posiciones originales de cada plataforma.
                  La identificación de artistas mexicanos se realiza únicamente contra la base de datos de Mexico Charts y el listado Mexican_Artist_Master; no se infiere la nacionalidad por género, idioma ni popularidad regional.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
