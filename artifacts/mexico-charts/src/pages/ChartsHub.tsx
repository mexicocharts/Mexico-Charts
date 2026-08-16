import { useState, useMemo, useCallback, useEffect } from "react";
import PageSEO from "@/components/PageSEO";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { SiSpotify, SiYoutube, SiApplemusic } from "react-icons/si";
import { MdMusicNote } from "react-icons/md";
import SiteNav from "@/components/SiteNav";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";

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
      { id: "Spotify_Regional_Daily",  label: "Canciones",   period: "Diario"  },
      { id: "Spotify_Regional_Weekly", label: "Canciones",   period: "Semanal" },
    ],
  },
  {
    id: "Apple Music",
    label: "Apple Music",
    Icon: SiApplemusic,
    color: "#fc3c44",
    source: "Apple Music",
    sourceUrl: "https://music.apple.com/mx/room/1108041827",
    meta: "Apple Music · México · Actualización intradía",
    charts: [
      { id: "Apple_Songs",  label: "Canciones", period: "Intradía" },
      { id: "Apple_Albums", label: "Álbumes",   period: "Intradía" },
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
    body: "Artistas emergentes con primer impulso",
    href: "/radar-nuevos",
    status: "Activo",
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
    href: "/legacy-acts",
    status: "Activo",
  },
  {
    title: "Breakout Songs",
    kicker: "Canciones",
    body: "Tracks con mayor impulso reciente",
    href: "/charts",
    status: "Próximo",
  },
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
    { key: "Prev",       label: "Anterior", align: "right", mobile: false },
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
interface SheetData { headers: string[]; rows: Row[]; chartDate?: string | null; fetchedAt?: string | null }
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

function fmtCount(n: number): string {
  return n.toLocaleString("es-MX");
}

function rankKey(row: Row): string {
  return (row["Rank"] ?? row["rank"] ?? "").trim();
}
function prevKey(row: Row): string {
  return (row["Previous Rank"] ?? row["previous_rank"] ?? row["Prev"] ?? row["Previous"] ?? "").trim();
}
function movKey(row: Row): string {
  return (row["Movement"] ?? "").trim();
}
function isMexican(row: Row): boolean {
  return (row["Contains Mexican Artist"] ?? "").toUpperCase() === "TRUE";
}

type EntryKind = "artist" | "album" | "video" | "song";

function entryKindForSheet(sheetId: string): EntryKind {
  if (sheetId.includes("Artists")) return "artist";
  if (sheetId.includes("Albums")) return "album";
  if (sheetId.includes("Videos") || sheetId.includes("Shorts")) return "video";
  return "song";
}

function entryKindLabel(kind: EntryKind) {
  if (kind === "artist") return "Detalle de artista";
  if (kind === "album") return "Detalle de álbum";
  if (kind === "video") return "Detalle de video";
  return "Detalle de canción";
}

function creditLabelForKind(kind: EntryKind) {
  return kind === "artist" ? "Crédito" : "Artista";
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
        const canonicalHref = canonicalArtistHref(trimmed);
        if (slug && knownSlugs.has(slug) && canonicalHref) {
          return (
            <Link key={i} href={canonicalHref}>
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
  const [detailRow, setDetailRow] = useState<Row | null>(null);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  const platform = PLATFORMS.find(p => p.id === activePlatform)!;

  const { data, isLoading, isError } = useQuery<HubData>({
    queryKey: ["charts-hub"],
    queryFn: async () => {
      const resp = await fetch("/api/charts/hub", { cache: "no-store" });
      if (!resp.ok) throw new Error("Failed to fetch charts");
      return resp.json();
    },
    staleTime: 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
    if (imgCfg.source === "youtube") {
      return row["Thumbnail URL"] || ytThumb(row[imgCfg.field] ?? "");
    }
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
    if (sheetId.startsWith("YT_") && row["Thumbnail URL"]) return row["Thumbnail URL"];
    if (sheetId.startsWith("YT_") && row["YouTube URL"]) return ytThumb(row["YouTube URL"] ?? "");
    if (sheetId === "YT_Artists_Weekly") return getArtistPreviewImg(row["Artist Name"] ?? "");
    if (sheetId.startsWith("Spotify_Artists")) return getArtistPreviewImg(row["Artist"] ?? "");
    if (sheetId.startsWith("Spotify_Regional") || sheetId === "Spotify_Viral_Daily") return getArtistPreviewImg(row["artist_names"] ?? "");
    if (sheetId.startsWith("Apple_")) return getArtistPreviewImg(row["Artist Names"] ?? "");
    if (sheetId === "Deezer_Top_Mexico") return getArtistPreviewImg(row["Artist"] ?? "");
    return null;
  }

  function previewTitle(sheetId: string, row: Row): string {
    if (sheetId === "YT_Songs_Weekly") return row["Track Name"] ?? "—";
    if (sheetId === "YT_Videos_Daily") return row["Video Title"] ?? "—";
    if (sheetId === "YT_Shorts_Daily") return row["Track Name"] ?? row["Video Title"] ?? "—";
    if (sheetId === "YT_Artists_Weekly") return row["Artist Name"] ?? "—";
    if (sheetId.startsWith("Spotify_Artists")) return row["Artist"] ?? "—";
    if (sheetId.startsWith("Spotify_Regional") || sheetId === "Spotify_Viral_Daily") return row["track_name"] ?? "—";
    if (sheetId.startsWith("Apple_")) return row["Title"] ?? "—";
    if (sheetId === "Deezer_Top_Mexico") return row["Title"] ?? "—";
    return "—";
  }

  function previewDetail(sheetId: string, row: Row): string {
    if (sheetId === "YT_Songs_Weekly" || sheetId === "YT_Videos_Daily" || sheetId === "YT_Shorts_Daily") return row["Artist Names"] ?? "";
    if (sheetId === "YT_Artists_Weekly") return row["Views"] ? `${fmt(row["Views"])} vistas` : "YouTube semanal";
    if (sheetId === "Spotify_Artists_Daily") return "Spotify diario";
    if (sheetId === "Spotify_Artists_Weekly") return "Spotify semanal";
    if (sheetId.startsWith("Spotify_Regional") || sheetId === "Spotify_Viral_Daily") return row["artist_names"] ?? "";
    if (sheetId.startsWith("Apple_")) return row["Artist Names"] ?? "";
    if (sheetId === "Deezer_Top_Mexico") return row["Artist"] ?? "";
    return "";
  }

  const switchPlatform = useCallback((pid: PlatformId) => {
    const p = PLATFORMS.find(x => x.id === pid)!;
    setActivePlatform(pid);
    setActiveSheet(p.charts[0].id);
    setFilterMex(false);
    setShowAll(false);
    setDetailRow(null);
  }, []);

  const switchSheet = useCallback((sid: string) => {
    setActiveSheet(sid);
    setFilterMex(false);
    setShowAll(false);
    setDetailRow(null);
  }, []);

  const focusChart = useCallback((pid: PlatformId, sid: string) => {
    setActivePlatform(pid);
    setActiveSheet(sid);
    setFilterMex(false);
    setShowAll(false);
    setDetailRow(null);
    window.requestAnimationFrame(() => {
      document.getElementById("platforms")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const updatedShortFmt = useMemo(() => {
    if (activePlatform === "Apple Music" && sheetData?.fetchedAt) {
      return new Date(sheetData.fetchedAt).toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (!sheetData?.chartDate) return "Fecha no disponible";
    return new Date(`${sheetData.chartDate}T12:00:00Z`).toLocaleDateString("es-MX", {
      day: "numeric", month: "short",
    });
  }, [activePlatform, sheetData?.chartDate, sheetData?.fetchedAt]);

  const currentChartMeta = platform.charts.find(c => c.id === activeSheet) ?? platform.charts[0];
  const activeMeta = `${platform.label} · México · ${currentChartMeta.period || "Diario"}`;
  const selectedChartTitle = `${platform.label} ${currentChartMeta.label} ${currentChartMeta.period || ""}`.trim();
  const featuredRow = rows[0] ?? null;
  const totalEntries = sheetData?.rows.length ?? 0;
  const mexicanEntries = useMemo(() => sheetData?.rows.filter(isMexican).length ?? 0, [sheetData]);
  const chartStats = [
    { label: "Entradas", value: fmtCount(rows.length), tone: G },
    { label: "Base original", value: fmtCount(totalEntries), tone: "rgba(255,255,255,0.72)" },
    { label: "Mexicanos", value: fmtCount(mexicanEntries), tone: G },
    { label: activePlatform === "Apple Music" ? "Consultado" : "Datos del", value: updatedShortFmt, tone: "rgba(255,255,255,0.72)" },
  ];
  const detailKind = entryKindForSheet(activeSheet);
  const detailHeader = entryKindLabel(detailKind);
  const detailTitle = detailRow ? previewTitle(activeSheet, detailRow) : "";
  const detailSubtitle = detailRow ? previewDetail(activeSheet, detailRow) : "";
  const detailImg = detailRow ? (previewImg(activeSheet, detailRow) || getRowImg(detailRow)) : null;
  const detailRank = detailRow ? rankKey(detailRow) : "";
  const detailPrev = detailRow ? prevKey(detailRow) : "";
  const detailMov = detailRow ? movKey(detailRow) : "";
  const detailCredit = detailRow ? (["Artist", "Artist Name", "Artist Names", "artist_names"].map(key => detailRow[key]).find(Boolean) ?? "") : "";
  const detailCreditSlug = slugify(firstArtist(detailCredit));
  const detailExternal = detailRow ? (detailRow["YouTube URL"] || detailRow["Track Link"] || "") : "";
  const repeatedDetailValues = new Set([detailTitle, detailSubtitle, detailCredit].filter(Boolean));
  const detailFields = detailRow ? cols
    .filter(col => !col.isLink)
    .map(col => ({ ...col, value: detailRow[col.key] ?? "" }))
    .filter(col => col.value && !repeatedDetailValues.has(col.value))
    : [];
  const no1Cards = useMemo(() => ([
    {
      label: "YouTube artistas",
      sheet: "YT_Artists_Weekly",
      platform: "YouTube" as PlatformId,
      row: topYoutubeArtists[0],
      color: "#FF0000",
    },
    {
      label: "Spotify semanal",
      sheet: "Spotify_Artists_Weekly",
      platform: "Spotify" as PlatformId,
      row: topSpotifyArtists[0],
      color: "#1DB954",
    },
    {
      label: "YouTube canciones",
      sheet: "YT_Songs_Weekly",
      platform: "YouTube" as PlatformId,
      row: topYoutubeSongs[0],
      color: "#FF0000",
    },
    {
      label: "Regional semanal",
      sheet: "Spotify_Regional_Weekly",
      platform: "Spotify" as PlatformId,
      row: topRegionalSongs[0],
      color: G,
    },
  ].filter(card => card.row)), [topYoutubeArtists, topSpotifyArtists, topYoutubeSongs, topRegionalSongs]);
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    if (no1Cards.length <= 1) return;
    const timer = window.setInterval(() => {
      setPulseIndex(index => (index + 1) % no1Cards.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [no1Cards.length]);

  useEffect(() => {
    if (pulseIndex >= no1Cards.length) setPulseIndex(0);
  }, [pulseIndex, no1Cards.length]);

  const activePulse = no1Cards[pulseIndex] ?? no1Cards[0] ?? null;

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
      <section className="relative overflow-hidden px-4 pb-7 pt-8 sm:px-6 sm:pb-8 sm:pt-10 lg:px-12 lg:pb-10 lg:pt-12"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="pointer-events-none absolute inset-x-0 top-12 hidden text-center text-[18vw] font-black uppercase leading-none opacity-[0.035] lg:block">
          Charts
        </div>
        <div className="relative max-w-6xl">
          <div>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="mb-3 text-[9px] font-black uppercase tracking-[0.24em] sm:text-[10px] sm:tracking-[0.35em]" style={{ color: G }}>
              Listas Mexico Charts
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.04 }}
              className="max-w-[9ch] font-black uppercase leading-[0.88] md:hidden"
              style={{ fontSize: "clamp(3.15rem,14vw,4.8rem)" }}>
              <span className="block">Listas</span>
              <span className="block" style={{ color: G }}>México</span>
            </motion.h1>
            <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.04 }}
              className="hidden max-w-6xl font-black uppercase leading-[0.86] md:block"
              style={{ fontSize: "clamp(4.6rem,9.3vw,9.4rem)" }}>
              Charts de música mexicana
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="mt-4 max-w-3xl text-sm leading-relaxed sm:mt-5 md:text-lg"
              style={{ color: "rgba(255,255,255,0.58)" }}>
              Rankings propios, números uno de la semana, géneros y listas oficiales de plataformas en un solo lugar.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
              className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[8px] font-black uppercase tracking-[0.18em] sm:text-[9px] sm:tracking-[0.24em]" style={{ color: "rgba(255,255,255,0.46)" }}>
                MX100 · YouTube · Spotify · Apple Music · Deezer
              </span>
              <Link href="/metodologia">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] hover:opacity-70 transition-opacity"
                  style={{ color: "rgba(57,255,20,0.74)" }}>
                  Metodología
                </span>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6 md:space-y-7 lg:px-12">
        {activePulse && (
          <section
            id="chart-pulse"
            className="relative overflow-hidden"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              background: `radial-gradient(circle at 18% 15%, ${activePulse.color}24, transparent 34%), radial-gradient(circle at 78% 18%, rgba(255,255,255,0.08), transparent 28%), linear-gradient(135deg, #111, #050505 68%)`,
              boxShadow: `0 24px 90px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.055), 0 0 0 1px ${activePulse.color}10`,
            }}
          >
            {(() => {
              const row = activePulse.row as Row;
              const title = previewTitle(activePulse.sheet, row);
              const detail = previewDetail(activePulse.sheet, row);
              const img = previewImg(activePulse.sheet, row);
              const PlatformIcon = PLATFORMS.find(p => p.id === activePulse.platform)?.Icon ?? MdMusicNote;
              const isArtistSignal = activePulse.sheet.includes("Artists");
              const metric = row["Streams"] || row["streams"] || row["Views"] || row["views"] || row["Total Streams"] || row["Weekly Streams"] || "";
              const pulseAction = isArtistSignal
                ? `Domina ${activePulse.label}`
                : `Lidera ${activePulse.label}`;
              const pulseSubline = detail && detail !== activePulse.label
                ? detail
                : activePulse.platform === "Spotify"
                  ? "La señal de streaming más fuerte de la semana."
                  : "La señal de video más fuerte de la semana.";

              return (
                <div className="relative min-h-[34rem] p-4 sm:p-5 md:p-7 lg:min-h-[32rem]">
                  <div className="pointer-events-none absolute inset-0 opacity-[0.032]" style={{ backgroundImage: NOISE, backgroundSize: "110px" }} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${activePulse.color}99, transparent)` }} />
                  <div className="pointer-events-none absolute bottom-0 right-0 text-[34vw] font-black uppercase leading-none opacity-[0.025] md:text-[18rem]">
                    #1
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: `linear-gradient(90deg, ${activePulse.color}1f, transparent 48%, ${activePulse.color}10)` }} />

                  <div className="relative z-10 grid h-full min-h-[32rem] gap-5 lg:grid-cols-[minmax(0,1fr)_21.5rem]">
                    <div className="grid gap-5 md:grid-cols-[minmax(15rem,22rem)_minmax(0,1fr)] md:items-start">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`pulse-copy-${activePulse.sheet}`}
                          initial={{ opacity: 0, x: -18 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 18 }}
                          transition={{ duration: 0.34, ease: "easeOut" }}
                          className="md:col-span-2"
                        >
                          <div className="mb-5 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em]"
                              style={{ borderRadius: 8, background: `${activePulse.color}18`, border: `1px solid ${activePulse.color}42`, color: activePulse.color }}>
                              <PlatformIcon className="h-3.5 w-3.5" />
                              Pulso en vivo
                            </span>
                            <span className="px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em]"
                              style={{ borderRadius: 8, background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.66)" }}>
                              México · #1
                            </span>
                          </div>
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                            <div>
                              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: activePulse.color }}>
                                {activePulse.label}
                              </p>
                              <h2 className="max-w-[18ch] text-balance font-black uppercase leading-[0.9]" style={{ fontSize: "clamp(2.5rem,5.1vw,5.2rem)" }}>
                                {title}
                              </h2>
                            </div>
                            <p className="max-w-[20rem] text-[10px] font-black uppercase leading-relaxed tracking-[0.18em] md:text-right" style={{ color: activePulse.color }}>
                              {pulseAction}
                            </p>
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`pulse-art-${activePulse.sheet}`}
                          initial={{ opacity: 0, scale: 0.94, rotate: -1 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.97, rotate: 1 }}
                          transition={{ duration: 0.36, ease: "easeOut" }}
                          className="relative aspect-[4/5] overflow-hidden md:aspect-square"
                          style={{
                            borderRadius: 8,
                            border: `1px solid ${activePulse.color}38`,
                            boxShadow: `0 28px 80px rgba(0,0,0,0.5), 0 0 90px ${activePulse.color}1c`,
                            background: `radial-gradient(circle at 30% 20%, ${activePulse.color}34, transparent 44%), rgba(0,0,0,0.54)`,
                          }}
                        >
                          {img ? (
                            <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-5xl font-black uppercase" style={{ color: activePulse.color }}>
                              #1
                            </div>
                          )}
                          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 -80px 90px rgba(0,0,0,0.38)" }} />
                          <span className="absolute bottom-3 left-3 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em]"
                            style={{ borderRadius: 8, background: "rgba(0,0,0,0.66)", color: "#fff", border: "1px solid rgba(255,255,255,0.14)" }}>
                            {activePulse.platform}
                          </span>
                          <span className="absolute right-3 top-3 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em]"
                            style={{ borderRadius: 8, background: activePulse.color, color: "#050505" }}>
                            0{pulseIndex + 1}/0{no1Cards.length}
                          </span>
                        </motion.div>
                      </AnimatePresence>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`pulse-info-${activePulse.sheet}`}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className="flex h-full min-h-[15rem] flex-col justify-between"
                        >
                          <div>
                            <p className="max-w-md text-sm font-semibold leading-relaxed md:text-base" style={{ color: "rgba(255,255,255,0.62)" }}>
                              {pulseSubline}
                            </p>
                            <div className="mt-5 flex max-w-lg flex-wrap gap-x-5 gap-y-3 border-y border-white/[0.08] py-3">
                              {[
                                { label: "Posición", value: "#1" },
                                { label: "Lista", value: activePulse.platform },
                                { label: "Dato", value: metric ? fmt(metric) : activePulse.label },
                              ].map(item => (
                                <div key={item.label} className="min-w-[5.6rem]">
                                  <span className="block text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.38)" }}>
                                    {item.label}
                                  </span>
                                  <span className="mt-1 block max-w-[9rem] truncate text-sm font-black uppercase leading-none md:text-base" style={{ color: item.label === "Posición" ? activePulse.color : "#fff" }}>
                                    {item.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-6 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => focusChart(activePulse.platform, activePulse.sheet)}
                              className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition hover:brightness-110"
                              style={{ borderRadius: 8, background: activePulse.color, color: "#050505" }}
                            >
                              Abrir chart
                            </button>
                            <div className="flex items-center gap-2" aria-label="Seleccionar señal destacada">
                              {no1Cards.map((module, index) => (
                                <button
                                  key={`pulse-dot-${module.sheet}`}
                                  type="button"
                                  aria-label={`Ver ${module.label}`}
                                  onClick={() => setPulseIndex(index)}
                                  className="h-2.5 transition-all"
                                  style={{
                                    width: index === pulseIndex ? 26 : 10,
                                    borderRadius: 999,
                                    background: index === pulseIndex ? activePulse.color : "rgba(255,255,255,0.24)",
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="grid content-end gap-2 lg:content-center">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                          Señales principales
                        </p>
                        <span className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: activePulse.color }}>
                          Rotando
                        </span>
                      </div>
                      {no1Cards.map((module, index) => {
                        const moduleRow = module.row as Row;
                        const moduleTitle = previewTitle(module.sheet, moduleRow);
                        const moduleDetail = previewDetail(module.sheet, moduleRow);
                        const ModuleIcon = PLATFORMS.find(p => p.id === module.platform)?.Icon ?? MdMusicNote;
                        const active = index === pulseIndex;

                        return (
                          <button
                            key={`pulse-selector-${module.sheet}`}
                            type="button"
                            onClick={() => setPulseIndex(index)}
                            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left transition"
                            style={{
                              borderRadius: 8,
                              border: `1px solid ${active ? module.color : "rgba(255,255,255,0.09)"}`,
                              background: active ? `linear-gradient(90deg, ${module.color}1a, rgba(255,255,255,0.04))` : "rgba(255,255,255,0.035)",
                              boxShadow: active ? `0 14px 40px ${module.color}12` : "none",
                            }}
                          >
                            <span className="flex h-10 w-10 items-center justify-center"
                              style={{ borderRadius: 8, background: `${module.color}18`, color: module.color }}>
                              <ModuleIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: module.color }}>
                                {module.label}
                              </span>
                              <span className="mt-1 block truncate text-sm font-black uppercase text-white">
                                {moduleTitle}
                              </span>
                              <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.38)" }}>
                                {moduleDetail || module.platform}
                              </span>
                            </span>
                            <span className="text-xl font-black" style={{ color: active ? module.color : "rgba(255,255,255,0.35)" }}>
                              0{index + 1}
                            </span>
                          </button>
                        );
                      })}
                      <div className="mt-2 h-1 overflow-hidden" style={{ borderRadius: 999, background: "rgba(255,255,255,0.08)" }}>
                        <motion.div
                          key={`pulse-progress-${activePulse.sheet}`}
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 5.6, ease: "linear" }}
                          className="h-full"
                          style={{ background: activePulse.color }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* ── MEXICO CHARTS ──────────────────────────────────────────────── */}
        <section id="mexico-charts" className="relative overflow-hidden"
          style={{ border: `1px solid ${G}28`, borderRadius: 8, background: "radial-gradient(circle at 9% 5%, rgba(57,255,20,0.16), transparent 34%), rgba(255,255,255,0.018)" }}>
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
            <Link href="/mx100">
              <motion.article whileHover={{ y: -2 }}
                className="group relative min-h-[330px] cursor-pointer overflow-hidden px-4 py-6 sm:px-6 sm:py-7 md:min-h-[500px] md:px-9 md:py-10"
                style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="pointer-events-none absolute -right-8 top-4 text-[30vw] font-black uppercase leading-none opacity-[0.035] md:text-[18vw]">
                  MX100
                </div>
                <p className="relative text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>
                  Mexico Charts · Activo
                </p>
                <h2 className="relative mt-7 max-w-full font-black uppercase leading-[0.86] md:hidden"
                  style={{ fontSize: "clamp(3.2rem,15vw,5rem)" }}>
                  <span className="block">Top</span>
                  <span className="block">100</span>
                </h2>
                <h2 className="relative mt-8 hidden max-w-full font-black uppercase leading-[0.86] md:block"
                  style={{ fontSize: "clamp(4.5rem,6.2vw,7.6rem)" }}>
                  <span className="block">Mexico Charts</span>
                  <span className="block">Top 100</span>
                </h2>
                <p className="relative mt-5 max-w-2xl text-sm leading-relaxed md:text-lg"
                  style={{ color: "rgba(255,255,255,0.58)" }}>
                  Los artistas más exitosos de la semana, con una fórmula editorial pensada para música mexicana
                </p>
                <div className="relative mt-7 grid max-w-2xl grid-cols-3 gap-2 md:hidden">
                  {["Base", "México", "Top 100"].map((value, index) => (
                    <div key={value} className="px-3 py-3"
                      style={{ borderRadius: 8, border: `1px solid ${index === 0 ? `${G}66` : "rgba(255,255,255,0.1)"}`, background: index === 0 ? `${G}12` : "rgba(255,255,255,0.025)" }}>
                      <span className="block text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: index === 0 ? G : "rgba(255,255,255,0.36)" }}>
                        {["Streaming", "Audiencia", "Editorial"][index]}
                      </span>
                      <span className="mt-3 block text-lg font-black uppercase leading-none" style={{ color: index === 0 ? "#fff" : "rgba(255,255,255,0.72)" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="relative mt-8 hidden max-w-2xl gap-2 md:grid md:grid-cols-3">
                  {["Streaming", "Audiencia", "Señal editorial"].map((label, index) => (
                    <div key={label} className="px-4 py-4"
                      style={{ borderRadius: 8, border: `1px solid ${index === 0 ? `${G}66` : "rgba(255,255,255,0.1)"}`, background: index === 0 ? `${G}12` : "rgba(255,255,255,0.025)" }}>
                      <span className="block text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: index === 0 ? G : "rgba(255,255,255,0.36)" }}>
                        {label}
                      </span>
                      <span className="mt-5 block text-2xl font-black uppercase leading-none" style={{ color: index === 0 ? "#fff" : "rgba(255,255,255,0.72)" }}>
                        {index === 0 ? "Base" : index === 1 ? "México" : "Top 100"}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.article>
            </Link>

            <div className="grid border-t border-white/[0.06] xl:border-t-0">
              <div className="grid md:hidden">
                {MEXICO_CHARTS.slice(1).map((chart) => (
                  <Link key={chart.title} href={chart.href}>
                    <span className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/[0.06] px-4 py-4 hover:bg-white/[0.035]">
                      <span className="min-w-0">
                        <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>
                          {chart.kicker}
                        </span>
                        <span className="block text-2xl font-black uppercase leading-[0.9]">
                          {chart.title}
                        </span>
                        <span className="mt-2 block text-sm leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {chart.body}
                        </span>
                      </span>
                      <span className="text-right text-[8px] font-black uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {chart.status}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
              <div className="hidden md:grid md:grid-cols-2">
                {MEXICO_CHARTS.slice(1).map((chart, index, charts) => (
                  <Link key={chart.title} href={chart.href}>
                    <span className={`group flex min-h-[122px] flex-col justify-between border-b border-r border-white/[0.06] p-4 hover:bg-white/[0.035] md:min-h-[160px] md:p-5 ${index === charts.length - 1 ? "md:col-span-2" : ""}`}>
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: G }}>
                          {chart.kicker}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {chart.status}
                        </span>
                      </span>
                      <span>
                        <span className="block text-xl font-black uppercase leading-[0.94] sm:text-2xl md:text-3xl">
                          {chart.title}
                        </span>
                        <span className="mt-2 block text-xs leading-snug sm:mt-3 sm:text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                          {chart.body}
                        </span>
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PLATFORM CHART BROWSER ─────────────────────────────────────── */}
        <section id="platforms" className="relative overflow-hidden p-4 md:p-7"
          style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, background: "linear-gradient(180deg, rgba(255,255,255,0.024), rgba(255,255,255,0.01))" }}>
          <div className="mb-5 flex flex-col gap-3 lg:mb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: G }}>
                Plataformas
              </p>
              <h2 className="font-black uppercase leading-[0.92] md:hidden"
                style={{ fontSize: "clamp(2rem,8.4vw,2.85rem)" }}>
                <span className="block">Listas</span>
                <span className="block">oficiales</span>
              </h2>
              <h2 className="hidden font-black uppercase leading-[0.9] md:block md:text-6xl">
                Listas oficiales
              </h2>
            </div>
            <div className="text-[8px] font-bold uppercase tracking-[0.16em] sm:text-[9px] sm:tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.34)" }}>
              {activeMeta}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
            <div className="grid grid-cols-2 gap-2 md:mx-0 md:flex md:overflow-x-auto md:px-0 md:pb-1 xl:block xl:space-y-2 xl:overflow-visible xl:pb-0">
              {PLATFORMS.map(p => {
                const active = activePlatform === p.id;
                return (
                  <button key={p.id} type="button" onClick={() => switchPlatform(p.id as PlatformId)}
                    aria-pressed={active}
                    aria-label={`Ver listas de ${p.label}`}
                    className="flex min-w-0 items-center justify-between gap-2 px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.1em] transition-all md:min-w-[160px] md:gap-3 md:px-4 md:text-[11px] md:tracking-[0.15em] xl:w-full"
                    style={{
                      borderRadius: 8,
                      background: active ? `${p.color}18` : "rgba(255,255,255,0.025)",
                      border: active ? `1px solid ${p.color}80` : "1px solid rgba(255,255,255,0.08)",
                      color: active ? "#fff" : "rgba(255,255,255,0.46)",
                    }}>
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <p.Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: active ? p.color : "rgba(255,255,255,0.3)" }} />
                      <span className="truncate">{p.label}</span>
                    </span>
                    <span className="hidden sm:inline" style={{ color: active ? p.color : "rgba(255,255,255,0.25)" }}>→</span>
                  </button>
                );
              })}
            </div>

            <div className="min-w-0 space-y-4">
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
                {platform.charts.map(c => {
                  const active = activeSheet === c.id;
                  return (
                    <button key={c.id} type="button" onClick={() => switchSheet(c.id)}
                      aria-pressed={active}
                      aria-label={`Ver ${c.label}${c.period ? ` ${c.period}` : ""}`}
                      className="shrink-0 px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.13em] transition-all sm:text-[10px] sm:tracking-[0.15em]"
                      style={{
                        borderRadius: 8,
                        background: active ? G : "rgba(255,255,255,0.045)",
                        color: active ? "#000" : "rgba(255,255,255,0.48)",
                        border: active ? "1px solid transparent" : "1px solid rgba(255,255,255,0.08)",
                      }}>
                      {c.label}{c.period ? ` · ${c.period}` : ""}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 overflow-hidden p-3.5 sm:p-4 md:grid-cols-[minmax(0,1fr)_220px] md:p-5"
                style={{ border: `1px solid ${G}26`, borderRadius: 8, background: "radial-gradient(circle at 0% 0%, rgba(57,255,20,0.12), transparent 38%), rgba(0,0,0,0.34)" }}>
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] sm:text-[9px] sm:tracking-[0.24em]" style={{ color: G }}>
                    Chart seleccionado
                  </p>
                  <div className="mt-3 md:hidden">
                    <div className="inline-flex max-w-full items-center gap-2 rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em]"
                      style={{ color: platform.color, background: `${platform.color}12`, border: `1px solid ${platform.color}38` }}>
                      <platform.Icon className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{platform.label}</span>
                    </div>
                    <h3 className="mt-3 max-w-full break-words font-black uppercase leading-[0.92]"
                      style={{ fontSize: "clamp(1.8rem,7.3vw,2.45rem)" }}>
                      {currentChartMeta.label}
                    </h3>
                    <p className="mt-2 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: G }}>
                      {currentChartMeta.period || "Diario"} · México
                    </p>
                  </div>
                  <h3 className="mt-3 hidden text-5xl font-black uppercase leading-[0.9] md:block">
                    {selectedChartTitle}
                  </h3>
                  {featuredRow && (
                    <div className="mt-5 grid grid-cols-[24px_42px_minmax(0,1fr)] items-center gap-2.5 sm:grid-cols-[34px_52px_minmax(0,1fr)] sm:gap-3">
                      <span className="text-xl font-black tabular-nums sm:text-3xl" style={{ color: G }}>
                        {rankKey(featuredRow) || 1}
                      </span>
                      <div className="sm:hidden">
                        <Thumbnail src={previewImg(activeSheet, featuredRow) || getRowImg(featuredRow)} name={previewTitle(activeSheet, featuredRow)} round={activeSheet.includes("Artists")} size={42} />
                      </div>
                      <div className="hidden sm:block">
                        <Thumbnail src={previewImg(activeSheet, featuredRow) || getRowImg(featuredRow)} name={previewTitle(activeSheet, featuredRow)} round={activeSheet.includes("Artists")} size={52} />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-black leading-tight text-white sm:text-lg">{previewTitle(activeSheet, featuredRow)}</p>
                        <p className="mt-1 line-clamp-1 text-[10px] font-bold uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.45)" }}>
                          {previewDetail(activeSheet, featuredRow) || activeMeta}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {chartStats.map(stat => (
                      <div
                        key={stat.label}
                        className="min-w-0 rounded-lg px-3 py-3"
                        style={{
                          border: "1px solid rgba(255,255,255,0.075)",
                          background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.018))",
                        }}
                      >
                        <div className="truncate text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.34)" }}>
                          {stat.label}
                        </div>
                        <div className="mt-2 truncate text-sm font-black uppercase tracking-[0.06em]" style={{ color: stat.tone }}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[10px] font-bold md:hidden" style={{ color: "rgba(255,255,255,0.36)" }}>
                    Toca una entrada para abrir el detalle.
                  </p>
                </div>

                <div className="flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between gap-3 text-[8px] font-black uppercase tracking-[0.16em] sm:text-[9px] sm:tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.38)" }}>
                    <span>Fuente</span>
                    <a href={platform.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:opacity-70" style={{ color: G }}>
                      {platform.source}
                    </a>
                  </div>
                  <div className="flex overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}>
                    {[false, true].map(isMex => (
                      <button key={String(isMex)} type="button" onClick={() => setFilterMex(isMex)}
                        aria-pressed={filterMex === isMex}
                        className="min-w-0 flex-1 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] transition-all sm:tracking-[0.13em]"
                        style={{
                          background: filterMex === isMex ? (isMex ? `${G}22` : "rgba(255,255,255,0.07)") : "transparent",
                          color: filterMex === isMex ? (isMex ? G : "#fff") : "rgba(255,255,255,0.34)",
                        }}>
                        {isMex ? "Mexicanos" : "Todos"}
                      </button>
                    ))}
                  </div>
                  {sheetData && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {rows.length} entradas
                    </span>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {filterMex && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="px-4 py-3 text-[11px] leading-relaxed"
                    style={{ background: `${G}0d`, border: `1px solid ${G}25`, borderRadius: 8, color: "rgba(255,255,255,0.5)" }}>
                    <span style={{ color: G, fontWeight: 900 }}>Vista filtrada por Mexico Charts · </span>
                    Se muestran filas con artistas mexicanos o colaboraciones con participación mexicana. Las posiciones originales del chart se conservan
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ── CHART TABLE ─────────────────────────────────────────────────── */}
        <div className="md:px-7">
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

            <div className="overflow-hidden rounded-lg md:rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

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
                    <div
                      className="hidden cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.028] md:flex"
                      role="button"
                      tabIndex={0}
                      onClick={event => {
                        if ((event.target as HTMLElement).closest("a,button")) return;
                        setDetailRow(row);
                      }}
                      onKeyDown={event => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDetailRow(row);
                        }
                      }}
                      aria-label={`Ver detalle de ${previewTitle(activeSheet, row)}`}
                    >
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
                                onClick={event => event.stopPropagation()}
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
                    <div
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-3 transition-colors hover:bg-white/[0.028] sm:gap-3 sm:px-4 sm:py-3.5 md:hidden"
                      role="button"
                      tabIndex={0}
                      onClick={event => {
                        if ((event.target as HTMLElement).closest("a,button")) return;
                        setDetailRow(row);
                      }}
                      onKeyDown={event => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDetailRow(row);
                        }
                      }}
                      aria-label={`Ver detalle de ${previewTitle(activeSheet, row)}`}
                    >
                      <div className="w-6 flex-shrink-0 text-right text-sm font-black leading-none sm:w-7"
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
                      <div className="min-w-0 flex-1">
                        {/* Artist */}
                        {cols.filter(c => c.isArtist && c.mobile).map((col, ci) => (
                          <div key={ci} className="truncate text-[13px] font-black leading-tight text-white sm:text-sm">
                            <ArtistCell value={row[col.key] ?? ""} knownSlugs={knownSlugs} />
                          </div>
                        ))}
                        {/* Title/track */}
                        {cols.filter(c => !c.isArtist && c.mobile && !c.isLink).map((col, ci) => (
                          <div key={ci} className="mt-0.5 truncate text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>
                            {row[col.key] || ""}
                          </div>
                        ))}
                      </div>
                      <div className="flex max-w-[88px] flex-shrink-0 flex-col items-end gap-1">
                        <Movement rank={rank} prev={prev} mov={mov} />
                        {cols.filter(c => c.isMetric).map((col, ci) => (
                          <div key={ci} className="text-[10px] font-black tabular-nums sm:text-[11px]" style={{ color: G }}>
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
                <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="break-all text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.50)" }}>
                    Fuente: {platform.source} · {activeMeta} ·{" "}
                    <a href={platform.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                      {platform.sourceUrl}
                    </a>
                  </span>
                  {sheetData && (
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.50)" }}>
                      {rows.length} entradas
                    </span>
                  )}
                </div>
                <p className="px-1 text-[9px] leading-relaxed" style={{ color: "rgba(255,255,255,0.48)", maxWidth: "65ch" }}>
                  Mexico Charts organiza y presenta datos de plataformas musicales para mostrar listas en México
                  La vista «Solo artistas mexicanos» es un filtro editorial aplicado a las listas originales y conserva las posiciones originales de cada plataforma
                  La identificación de artistas mexicanos se realiza únicamente contra la base de datos de Mexico Charts y el listado Mexican_Artist_Master; no se infiere la nacionalidad por género, idioma ni popularidad regional
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {detailRow && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/72 px-3 pb-3 backdrop-blur-md md:items-stretch md:justify-end md:p-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setDetailRow(null)}
          >
            <motion.aside
              className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-xl md:h-full md:max-h-none md:rounded-none"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onMouseDown={event => event.stopPropagation()}
              style={{ background: "linear-gradient(180deg,#0b0b0b,#050505)", border: "1px solid rgba(57,255,20,0.2)", boxShadow: "0 28px 90px rgba(0,0,0,0.76)" }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 md:px-6"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(8,8,8,0.92)", backdropFilter: "blur(14px)" }}>
                <span className="text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: G }}>
                  {detailHeader}
                </span>
                <button type="button" onClick={() => setDetailRow(null)}
                  className="h-9 w-9 rounded-lg text-lg font-black text-white/50 hover:text-white"
                  style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
                  aria-label="Cerrar detalle">
                  ×
                </button>
              </div>

              <div className="p-4 md:p-6">
                <div className="overflow-hidden" style={{ borderRadius: 8, border: `1px solid ${G}28`, background: "radial-gradient(circle at 8% 0%, rgba(57,255,20,0.12), transparent 36%), rgba(255,255,255,0.02)" }}>
                  <div className="relative aspect-[16/10] overflow-hidden bg-white/[0.04]">
                    {detailImg ? (
                      <img src={detailImg} alt="" className="h-full w-full object-cover opacity-80" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-7xl font-black uppercase opacity-20">
                        {detailTitle.charAt(0)}
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.88))" }} />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="mb-3 flex items-center gap-3">
                        <span className="text-4xl font-black tabular-nums" style={{ color: G }}>{detailRank || "—"}</span>
                        <Movement rank={detailRank} prev={detailPrev} mov={detailMov} />
                      </div>
                      <h3 className="text-4xl font-black uppercase leading-[0.9] md:text-5xl">{detailTitle}</h3>
                      <p className="mt-3 text-sm font-bold" style={{ color: "rgba(255,255,255,0.58)" }}>
                        {detailSubtitle || activeMeta}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
                    <div className="bg-[#080808] px-4 py-3">
                      <span className="block text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.36)" }}>Fuente</span>
                      <a href={platform.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-2 block text-[11px] font-black uppercase tracking-[0.12em] hover:opacity-70"
                        style={{ color: G }}>
                        {platform.source}
                      </a>
                    </div>
                    <div className="bg-[#080808] px-4 py-3">
                      <span className="block text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.36)" }}>Chart</span>
                      <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.12em] text-white">
                        {selectedChartTitle}
                      </span>
                    </div>
                  </div>
                </div>

                {detailCredit && (
                  <div className="mt-4 rounded-lg px-4 py-3" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                    <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.36)" }}>
                      {creditLabelForKind(detailKind)}
                    </span>
                    <p className="text-lg font-black text-white">
                      <ArtistCell value={detailCredit} knownSlugs={knownSlugs} />
                    </p>
                  </div>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {detailFields.map(field => (
                    <div key={field.key} className="rounded-lg px-4 py-3" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.018)" }}>
                      <span className="block text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.34)" }}>
                        {field.label}
                      </span>
                      <span className="mt-2 block truncate text-sm font-black" style={{ color: field.isMetric ? G : "rgba(255,255,255,0.76)" }}>
                        {field.isMetric ? fmt(field.value) : field.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  {detailCreditSlug && knownSlugs.has(detailCreditSlug) && canonicalArtistHref(detailCreditSlug) && (
                    <Link href={canonicalArtistHref(detailCreditSlug)!}>
                      <span className="inline-flex justify-center rounded-lg px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em]"
                        style={{ background: G, color: "#000" }}>
                        Abrir perfil
                      </span>
                    </Link>
                  )}
                  {detailExternal && (
                    <a href={detailExternal} target="_blank" rel="noopener noreferrer"
                      className="inline-flex justify-center rounded-lg px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em]"
                      style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.72)" }}>
                      Abrir en plataforma
                    </a>
                  )}
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
