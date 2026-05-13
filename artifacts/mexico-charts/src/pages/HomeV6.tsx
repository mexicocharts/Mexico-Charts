import { useState, useEffect, useMemo, useRef } from "react";
import PageSEO from "@/components/PageSEO";
import { useQuery } from "@tanstack/react-query";
import { useArtistImages } from "@/hooks/useArtistImages";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { slugify } from "@/lib/utils";
import {
  motion, AnimatePresence,
  useScroll, useTransform,
  useReducedMotion,
} from "framer-motion";
import { Search, Menu, TrendingUp, Music, Mail } from "lucide-react";
import { useArtistsWeekly, useArtistMetadata, lookupArtistMetadata } from "@/services/dataProvider";
import { SHEET_SOURCES } from "@/config/sheetSources";
import { SiInstagram, SiX, SiTiktok, SiYoutube, SiSpotify } from "react-icons/si";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

/* ─── NOISE SVG ──────────────────────────────────────────────── */
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/* ─── DEFAULT DATA (shown while sheets aren't configured yet) ─── */

const DEFAULT_HERO_ARTISTS = [
  { rank:"#1", name:"Peso Pluma",     line1:"PESO",     line2:"PLUMA",  listeners:"32.4M", growth:"+18%", countries:"60+ PAÍSES", tag:"CORRIDOS TUMBADOS" },
  { rank:"#2", name:"Fuerza Regida",  line1:"FUERZA",   line2:"REGIDA", listeners:"12.4M", growth:"+31%", countries:"45+ PAÍSES", tag:"CORRIDOS TUMBADOS" },
  { rank:"#3", name:"Natanael Cano",  line1:"NATANAEL", line2:"CANO",   listeners:"11.7M", growth:"+22%", countries:"38+ PAÍSES", tag:"CORRIDOS TUMBADOS" },
  { rank:"#4", name:"Junior H",       line1:"JUNIOR",   line2:"H",      listeners:"9.8M",  growth:"+15%", countries:"32+ PAÍSES", tag:"REGIONAL MEXICANO" },
  { rank:"#5", name:"Carin León",     line1:"CARIN",    line2:"LEÓN",   listeners:"7.1M",  growth:"+28%", countries:"28+ PAÍSES", tag:"REGIONAL MEXICANO" },
];

const RANK_ACCENTS_HOME = [
  "#39FF14",
  "rgba(57,255,20,0.62)",
  "rgba(57,255,20,0.48)",
  "rgba(255,255,255,0.42)",
  "rgba(255,255,255,0.35)",
  "rgba(255,255,255,0.28)",
  "rgba(255,255,255,0.23)",
  "rgba(255,255,255,0.20)",
  "rgba(255,255,255,0.18)",
  "rgba(255,255,255,0.15)",
];

const GENRES = [
  { name:"Corridos Tumbados", artists:48, accent:"#39FF14" },
  { name:"Regional Mexicano",  artists:62, accent:"rgba(57,255,20,0.78)" },
  { name:"Norteño",            artists:34, accent:"rgba(57,255,20,0.60)" },
  { name:"Banda",              artists:29, accent:"rgba(57,255,20,0.46)" },
  { name:"Hip-Hop Mexicano",   artists:21, accent:"rgba(57,255,20,0.35)" },
  { name:"Pop",                artists:18, accent:"rgba(57,255,20,0.26)" },
];

const ASCENSO_ACCENTS = [
  "#39FF14",
  "rgba(57,255,20,0.72)",
  "rgba(57,255,20,0.52)",
  "rgba(57,255,20,0.36)",
  "rgba(57,255,20,0.24)",
];

/* ── Charts-hub types (minimal, same shape as ChartsHub.tsx) ── */
type HubRow = Record<string, string>;
interface HubSheetData { headers: string[]; rows: HubRow[] }
interface HubData { lastUpdated: string; sheets: Record<string, HubSheetData> }

function fmtViews(raw: string): string {
  const n = parseInt((raw ?? "").replace(/,/g, ""), 10);
  if (isNaN(n) || n === 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function parseGrowthNum(raw: string): number {
  return parseFloat((raw ?? "").replace(/[^0-9.\-]/g, "")) || 0;
}



/* ── Helper: split artist name into display lines ── */
function splitName(name: string): { line1: string; line2: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { line1: parts[0].toUpperCase(), line2: "" };
  const mid = Math.ceil(parts.length / 2);
  return {
    line1: parts.slice(0, mid).join(" ").toUpperCase(),
    line2: parts.slice(mid).join(" ").toUpperCase(),
  };
}

/* ─── SKELETON COMPONENTS ────────────────────────────────────── */

function SkeletonPulse({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: "rgba(255,255,255,0.06)", ...style }}
    />
  );
}

function SkeletonCard() {
  return (
    <div
      className="flex-shrink-0 relative overflow-hidden rounded-2xl"
      style={{ width: 150, height: 228, background: "linear-gradient(160deg, #0d0d0d 0%, #0a0a0a 100%)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <SkeletonPulse className="absolute inset-0" style={{ borderRadius: "1rem", background: "rgba(255,255,255,0.04)" }} />
      <div className="absolute top-2 left-3 w-8 h-6 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <SkeletonPulse className="h-3 w-3/4 mb-1.5" />
        <SkeletonPulse className="h-2 w-1/2 mb-1.5" />
        <SkeletonPulse className="h-2.5 w-1/3" style={{ background: "rgba(57,255,20,0.12)" }} />
      </div>
    </div>
  );
}

function SkeletonAscensoRow({ idx }: { idx: number }) {
  const widths = ["75%", "62%", "54%", "46%", "38%"];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <SkeletonPulse className="h-3.5" style={{ width: `${40 + idx * 5}%` }} />
        <SkeletonPulse className="h-3 w-10" style={{ background: "rgba(57,255,20,0.1)" }} />
      </div>
      <div className="h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
        <SkeletonPulse className="h-full rounded-full" style={{ width: widths[idx] ?? "40%", background: "rgba(57,255,20,0.12)", animationDelay: `${idx * 0.1}s` }} />
      </div>
    </div>
  );
}

/* ─── MOTION VARIANTS ───────────────────────────────────────── */

const fadeUpVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

/* ─── COMPONENTS ─────────────────────────────────────────────── */

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      custom={delay}
      variants={fadeUpVariants}
    >
      {children}
    </motion.div>
  );
}

function Shelf({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-7 relative">
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background:"linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)" }} />
      <FadeUp>
        <div className="flex items-center gap-3 px-6 lg:px-12 mb-5">
          <span style={{ color:"#39FF14" }}>{icon}</span>
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">{label}</h2>
          <div className="flex-1 h-px ml-2" style={{ background:"rgba(255,255,255,0.07)" }} />
        </div>
      </FadeUp>
      <div
        className="flex gap-4 overflow-x-auto px-6 lg:px-12 pb-3"
        style={{ scrollSnapType:"x mandatory", scrollbarWidth:"none", WebkitOverflowScrolling:"touch" } as React.CSSProperties}
      >
        {children}
      </div>
    </section>
  );
}

/* ─── INDUSTRIA DROPDOWN (desktop nav) ───────────────────────── */

const INDUSTRIA_SUB = [
  { label: "Industria",       href: "/industria" },
  { label: "Certificaciones", href: "/industry/certifications" },
  { label: "Música Grabada",  href: "/insights/mexico-top-10-ifpi-2026" },
];

function IndustriaDropdown() {
  const [open, setOpen] = useState(false);
  const [loc] = useLocation();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = loc.startsWith("/industria") || loc.startsWith("/industry");

  function show() { if (timer.current) clearTimeout(timer.current); setOpen(true); }
  function hide() { timer.current = setTimeout(() => setOpen(false), 120); }

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button className="flex items-center gap-0.5 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] rounded-full transition-all duration-250 cursor-pointer"
        style={{ background: "transparent", color: active ? "#39FF14" : "rgba(255,255,255,0.35)", border: "none" }}>
        INDUSTRIA
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" className="ml-0.5 opacity-50"><path d="M2 3.5l2.5 2.5L7 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-44 rounded-xl overflow-hidden py-1"
          style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.7)", zIndex: 100 }}>
          {INDUSTRIA_SUB.map(sub => {
            const subActive = loc === sub.href || loc.startsWith(sub.href + "/");
            return (
              <Link key={sub.href} href={sub.href}>
                <span className="block px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] transition-all cursor-pointer"
                  style={{ color: subActive ? "#39FF14" : "rgba(255,255,255,0.55)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#fff"; (e.currentTarget as HTMLElement).style.background="rgba(255,255,255,0.05)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color=subActive?"#39FF14":"rgba(255,255,255,0.55)"; (e.currentTarget as HTMLElement).style.background="transparent"; }}>
                  {subActive && <span style={{ color: "#39FF14" }}>› </span>}{sub.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── PAGE ───────────────────────────────────────────────────── */

export default function HomeV6() {
  const [heroIndex, setHeroIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tickerPaused, setTickerPaused] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  /* ── Sheet data ── */
  const { data: weeklyArtists, isEmpty: sheetsEmpty, isLoading: sheetsLoading, isError: sheetsError } = useArtistsWeekly();
  const { byKey: metaByKey, byName: metaByName } = useArtistMetadata();

  /* ── Charts-hub (live YouTube/Spotify/Deezer data — same source as /charts page) ── */
  const { data: hubData, isLoading: hubLoading } = useQuery<HubData>({
    queryKey: ["charts-hub"],
    queryFn: async () => {
      const resp = await fetch("/api/charts/hub");
      if (!resp.ok) throw new Error("hub fetch failed");
      return resp.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
  const ytArtistRows: HubRow[] = hubData?.sheets?.["YT_Artists_Weekly"]?.rows ?? [];

  /* ── Loading/error state only relevant when a URL is actually configured ── */
  const showLoadingState = !!SHEET_SOURCES.artistsWeekly && sheetsLoading;
  const showErrorState   = !!SHEET_SOURCES.artistsWeekly && sheetsError && !sheetsLoading;

  /* ── Helper: enrich a listener string with real metadata where available ── */
  function enrichListeners(name: string, fallback: string): string {
    const meta = lookupArtistMetadata(undefined, name, metaByKey, metaByName);
    return (meta && meta.spotifyListeners > 0) ? meta.spotifyListenersFmt : fallback;
  }

  /* ── Derived display arrays — sheet data when available, defaults otherwise ── */
  const TOP_STRIP = useMemo(() => {
    // Use live YouTube Artists Weekly data — Mexican artists only, sorted by rank
    if (ytArtistRows.length > 0) {
      const mexican = ytArtistRows.filter(
        r => (r["Contains Mexican Artist"] ?? "").toUpperCase() === "TRUE",
      );
      const sorted = [...mexican].sort(
        (a, b) => (Number(a["Rank"]) || 999) - (Number(b["Rank"]) || 999),
      );
      return sorted.slice(0, 10).map((row, idx) => ({
        rank: Number(row["Rank"]) || idx + 1,
        name: row["Artist Name"] ?? "",
        genre: "",
        streams: fmtViews(row["Views"] ?? ""),
        accent: RANK_ACCENTS_HOME[idx] ?? RANK_ACCENTS_HOME[RANK_ACCENTS_HOME.length - 1],
      }));
    }
    // Loading or empty — return [] so the caller can decide what to render
    return [];
  }, [ytArtistRows]);

  const HERO_ARTISTS = useMemo(() => {
    const base = (sheetsEmpty || weeklyArtists.length === 0)
      ? DEFAULT_HERO_ARTISTS
      : weeklyArtists.slice(0, 5).map(a => {
          const { line1, line2 } = splitName(a.name);
          return {
            rank: `#${a.mexicoRank}`,
            name: a.name,
            line1,
            line2,
            listeners: a.listeners,
            growth: a.growth,
            countries: a.countriesRaw > 0 ? `${a.countriesRaw}+ PAÍSES` : "—",
            tag: a.genre.toUpperCase(),
          };
        });
    // Overlay real listener counts from metadata
    return base.map(a => ({
      ...a,
      listeners: enrichListeners(a.name, a.listeners),
    }));
  }, [weeklyArtists, sheetsEmpty, metaByKey, metaByName]);

  const ASCENSO = useMemo(() => {
    // Build from Spotify_Artists_Daily — Mexican artists with biggest rank climbs today
    const spotifyRows: HubRow[] = hubData?.sheets?.["Spotify_Artists_Daily"]?.rows ?? [];
    if (spotifyRows.length === 0) return [];

    const climbers = spotifyRows
      .filter(r => (r["Contains Mexican Artist"] ?? "").toUpperCase() === "TRUE")
      .map(r => {
        const rank = parseInt(r["Rank"] ?? "", 10) || 0;
        const prev = parseInt(r["Prev"] ?? "", 10) || 0;
        const gained = prev > 0 && rank > 0 ? prev - rank : 0;
        return { name: r["Artist"] ?? "", rank, prev, gained };
      })
      .filter(a => a.name && a.gained > 0)
      .sort((a, b) => b.gained - a.gained)
      .slice(0, 5);

    if (climbers.length < 3) return [];

    const maxGained = climbers[0].gained;
    return climbers.map((a, idx) => ({
      name: a.name,
      growth: `+${a.gained} pos · #${a.rank} hoy`,
      bar: maxGained > 0 ? Math.round((a.gained / maxGained) * 100) : 0,
      accent: ASCENSO_ACCENTS[idx] ?? ASCENSO_ACCENTS[ASCENSO_ACCENTS.length - 1],
    }));
  }, [hubData]);

  /* ── Top 10 Mexican artists from the dedicated Spotify_Artists_Daily sheet ── */
  const SHELF_ARTISTS = useMemo(() => {
    const rows: HubRow[] = hubData?.sheets?.["Spotify_Artists_Daily"]?.rows ?? [];
    if (rows.length === 0) return [];
    // Filter to Mexican artists only, preserving original Spotify rank
    const mexican = rows.filter(
      r => (r["Contains Mexican Artist"] ?? "").toUpperCase() === "TRUE",
    );
    return mexican.slice(0, 10).map((row, idx) => ({
      rank: parseInt(row["Rank"] ?? "", 10) || idx + 1,
      name: row["Artist"] ?? "",
      genre: "SPOTIFY DAILY",
      streams: row["Streak"] ? `${row["Streak"]} días` : "",
      accent: RANK_ACCENTS_HOME[idx] ?? RANK_ACCENTS_HOME[RANK_ACCENTS_HOME.length - 1],
    }));
  }, [hubData]);

  /* ── Genre artist counts — explicit synonym mapping, per-label independent matching ── */
  const GENRE_SYNONYMS: Record<string, string[]> = {
    "Corridos Tumbados": ["corridos tumbados", "corrido tumbado", "corridos"],
    "Regional Mexicano": ["regional mexicano", "regional mexican", "regional mexicana"],
    "Norteño":           ["norteño", "norteno", "norteña", "norteñas"],
    "Banda":             ["banda", "banda sinaloense", "grupero banda"],
    "Hip-Hop Mexicano":  ["hip hop mexicano", "hip-hop mexicano", "hip hop", "hip-hop", "rap mexicano"],
    "Pop":               ["pop", "pop urbano", "latin pop", "pop latino"],
  };

  const genreStats = useMemo(() => {
    if (metaByKey.size === 0) return null;
    const init = () => ({ artists: 0, streams: 0, listeners: 0 });
    const stats: Record<string, { artists: number; streams: number; listeners: number }> = {
      "Corridos Tumbados": init(),
      "Regional Mexicano": init(),
      "Norteño":           init(),
      "Banda":             init(),
      "Hip-Hop Mexicano":  init(),
      "Pop":               init(),
    };
    for (const m of metaByKey.values()) {
      const g  = m.genre.toLowerCase().trim();
      const sg = m.subgenre.toLowerCase().trim();
      for (const [label, synonyms] of Object.entries(GENRE_SYNONYMS)) {
        if (synonyms.some(s => g === s || sg === s)) {
          stats[label].artists++;
          stats[label].streams   += m.spotifyStreams;
          stats[label].listeners += m.spotifyListeners;
        }
      }
    }
    return stats;
  }, [metaByKey]);

  const genreArtistCounts = useMemo(
    () => genreStats ? Object.fromEntries(Object.entries(genreStats).map(([k, v]) => [k, v.artists])) : null,
    [genreStats],
  );

  /* ── Platform totals — summed from artist metadata (real lifetime numbers) ── */
  function fmtBig(n: number): string {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    return String(n);
  }

  const platformTotals = useMemo(() => {
    let spotify = 0;
    let youtube = 0;
    for (const m of metaByKey.values()) {
      spotify += m.spotifyStreams;
      youtube += m.youtubeViews;
    }
    return {
      spotifyFmt: spotify > 0 ? fmtBig(spotify) : null,
      youtubeFmt: youtube > 0 ? fmtBig(youtube) : null,
    };
  }, [metaByKey]);

  const TICKER_ITEMS = useMemo(() => {
    if (TOP_STRIP.length === 0) return ["MEXICO CHARTS", "TOP ARTISTAS", "YOUTUBE", "SPOTIFY", "APPLE MUSIC", "DEEZER"];
    return TOP_STRIP.flatMap(a => [a.name.toUpperCase(), `${a.streams} VIEWS`]);
  }, [TOP_STRIP]);

  /* Scroll parallax for hero */
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const portraitY  = useTransform(heroScroll, [0,1], ["0%",  reduced ? "0%" : "18%"]);
  const rankY      = useTransform(heroScroll, [0,1], ["0%",  reduced ? "0%" : "30%"]);
  const textY      = useTransform(heroScroll, [0,1], ["0%",  reduced ? "0%" : "10%"]);

  /* Auto-cycle hero */
  useEffect(() => {
    const t = setInterval(() => setHeroIndex(i => (i + 1) % HERO_ARTISTS.length), 5000);
    return () => clearInterval(t);
  }, [HERO_ARTISTS.length]);

  /* Artist images */
  const allNames = useMemo(() => [
    ...HERO_ARTISTS.map(a => a.name),
    ...TOP_STRIP.map(a => a.name),
    ...SHELF_ARTISTS.map(a => a.name),
    ...ASCENSO.map(a => a.name),
  ], [HERO_ARTISTS, TOP_STRIP, SHELF_ARTISTS, ASCENSO]);
  const artistImages = useArtistImages(allNames);
  const imgMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(artistImages)) {
      if (v) m[k.toLowerCase()] = v;
    }
    return m;
  }, [artistImages]);
  const img = (name: string) => imgMap[name.toLowerCase()] ?? null;
  const hero = HERO_ARTISTS[heroIndex] ?? HERO_ARTISTS[0];

  return (
    <div
      className="min-h-[100dvh] text-zinc-300 overflow-x-hidden selection:bg-[#39FF14] selection:text-black"
      style={{ background:"radial-gradient(ellipse 100% 50% at 50% 0%, rgba(57,255,20,0.028) 0%, transparent 60%), #050505" }}
      data-testid="page-v6"
    >
      <PageSEO
        title="Mexico Charts — La Referencia de la Música Mexicana"
        description="Charts semanales, datos de streaming en tiempo real y estadísticas de la industria musical mexicana. Peso Pluma, Fuerza Regida, Natanael Cano y más."
        path="/"
      />

      {/* ── GREEN TICKER — pause on hover ── */}
      <div
        className="bg-[#39FF14] overflow-hidden py-2 cursor-default"
        style={{ whiteSpace:"nowrap", willChange:"transform" }}
        onMouseEnter={() => setTickerPaused(true)}
        onMouseLeave={() => setTickerPaused(false)}
      >
        <div
          className="inline-block animate-marquee"
          style={{ willChange:"transform", animationPlayState: tickerPaused ? "paused" : "running" }}
        >
          <span className="text-black font-black text-[11px] uppercase tracking-[0.22em]">
            {TICKER_ITEMS.map((item, i) => (
              <span key={i}>
                {item}
                <span className="mx-4 opacity-30">·</span>
              </span>
            ))}
            {TICKER_ITEMS.map((item, i) => (
              <span key={`r-${i}`}>
                {item}
                <span className="mx-4 opacity-30">·</span>
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* ── NAV ── */}
      <nav
        className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{ background:"rgba(5,5,5,0.92)", backdropFilter:"blur(20px) saturate(180%)" }}
        data-testid="navigation"
      >
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/v6" className="flex-shrink-0" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90 hover:opacity-100 transition-opacity" />
          </Link>

          <div className="hidden lg:flex items-center gap-0.5">
            {(["INICIO","ARTISTAS","CHARTS","GÉNEROS","INDUSTRIA","TOURING"] as const).map((item, i) => {
              const href = item === "ARTISTAS" ? "/artists" : item === "CHARTS" ? "/charts" : item === "INDUSTRIA" ? "/industria" : item === "GÉNEROS" ? "/generos" : item === "TOURING" ? "/touring" : "#";
              if (item === "INDUSTRIA") {
                return (
                  <IndustriaDropdown key={item} />
                );
              }
              return (
              <Link key={item} href={href}
                className="px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] rounded-full transition-all duration-250"
                style={{
                  background: i===0 ? "#39FF14" : "transparent",
                  color: i===0 ? "#000" : "rgba(255,255,255,0.35)",
                }}
                onMouseEnter={e => { if (i!==0) (e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.75)"; }}
                onMouseLeave={e => { if (i!==0) (e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.35)"; }}
              >{item}</Link>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center border border-white/[0.08] bg-white/[0.03] rounded-full px-3 focus-within:border-[#39FF14]/40 transition-all duration-300">
              <input type="text" placeholder="Buscar artista..." className="bg-transparent text-xs text-zinc-400 placeholder-zinc-700 py-1.5 w-36 focus:outline-none" data-testid="input-search" />
              <Search className="w-3.5 h-3.5 text-zinc-600" />
            </div>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors duration-200" data-testid="link-social-ig"><SiInstagram className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors duration-200" data-testid="link-social-x"><SiX className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors duration-200" data-testid="link-social-tk"><SiTiktok className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors duration-200" data-testid="link-social-yt"><SiYoutube className="w-3.5 h-3.5" /></a>
          </div>

          <button className="lg:hidden text-zinc-500 hover:text-white transition-colors" onClick={() => setMenuOpen(o => !o)} data-testid="btn-mobile-menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }}
              transition={{ duration:0.25, ease:"easeInOut" }}
              className="lg:hidden overflow-hidden border-t border-white/5 bg-[#050505]"
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                {(["INICIO","ARTISTAS","CHARTS","GÉNEROS","INDUSTRIA","TOURING"] as const).map(item => {
                  const href = item === "ARTISTAS" ? "/artists" : item === "CHARTS" ? "/charts" : item === "INDUSTRIA" ? "/industria" : item === "GÉNEROS" ? "/generos" : item === "TOURING" ? "/touring" : "#";
                  return (
                    <Link key={item} href={href} className="text-sm font-black uppercase tracking-[0.15em] text-zinc-400 hover:text-[#39FF14] transition-colors">{item}</Link>
                  );
                })}
                <div className="flex gap-4 pt-2 border-t border-white/5">
                  <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiInstagram className="w-4 h-4" /></a>
                  <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiX className="w-4 h-4" /></a>
                  <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiTiktok className="w-4 h-4" /></a>
                  <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiYoutube className="w-4 h-4" /></a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ══════════════════════════════════════════════════════════
          HERO — V5 gradient + parallax + ambient glow + noise
      ══════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative overflow-hidden" style={{ height:"68vh", minHeight:"480px", zIndex: 1 }} data-testid="section-hero">

        {/* Base — obsidian black */}
        <div className="absolute inset-0" style={{ background:"#050505" }} />

        {/* Green atmospheric glow — brand identity */}
        {!reduced && (
          <>
            <motion.div
              className="absolute pointer-events-none"
              style={{ width:720, height:720, left:"-15%", top:"0%", borderRadius:"50%", background:"radial-gradient(circle, rgba(57,255,20,0.055) 0%, transparent 65%)", filter:"blur(90px)" }}
              animate={{ x:[0,35,0], y:[0,-25,0], scale:[1,1.12,1], opacity:[0.7,1,0.7] }}
              transition={{ duration:11, repeat:Infinity, ease:"easeInOut" }}
            />
            <motion.div
              className="absolute pointer-events-none"
              style={{ width:500, height:500, right:"0%", bottom:"-10%", borderRadius:"50%", background:"radial-gradient(circle, rgba(57,255,20,0.035) 0%, transparent 65%)", filter:"blur(80px)" }}
              animate={{ x:[0,-20,0], y:[0,18,0], scale:[1,1.18,1], opacity:[0.4,0.65,0.4] }}
              transition={{ duration:14, repeat:Infinity, ease:"easeInOut", delay:4 }}
            />
            {/* Left-side cinematic fog diffusion */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ width:520, height:680, left:"2%", top:"8%", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(57,255,20,0.018) 0%, transparent 68%)", filter:"blur(72px)" }}
              animate={{ x:[0,16,0], y:[0,24,0], opacity:[0.45,0.8,0.45] }}
              transition={{ duration:19, repeat:Infinity, ease:"easeInOut", delay:3 }}
            />
            {/* Subtle mid-hero depth layer */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ width:360, height:360, left:"28%", top:"20%", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(57,255,20,0.012) 0%, transparent 70%)", filter:"blur(55px)" }}
              animate={{ x:[0,-12,0], y:[0,14,0], opacity:[0.3,0.6,0.3] }}
              transition={{ duration:23, repeat:Infinity, ease:"easeInOut", delay:7 }}
            />
          </>
        )}

        {/* Artist portrait — parallax */}
        <AnimatePresence mode="wait">
          {img(hero.name) && (
            <motion.div
              key={`portrait-${heroIndex}`}
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.9 }}
              className="absolute right-0 top-0 bottom-0 w-1/2 md:w-2/5 pointer-events-none"
              style={{
                y: portraitY,
                backgroundImage:`url(${img(hero.name)})`,
                backgroundSize:"cover", backgroundPosition:"center top",
                maskImage:"linear-gradient(to right, transparent 0%, black 38%)",
                WebkitMaskImage:"linear-gradient(to right, transparent 0%, black 38%)",
                filter:"saturate(0.58) contrast(1.1) brightness(0.83)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Cinematic vignette — directional layered */}
        <div className="absolute inset-0 pointer-events-none" style={{ background:"linear-gradient(to right, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.55) 42%, rgba(5,5,5,0.15) 68%, transparent 85%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background:"linear-gradient(to bottom, rgba(5,5,5,0.5) 0%, transparent 28%, rgba(5,5,5,0.55) 75%, #050505 100%)" }} />

        {/* Film grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: NOISE_SVG, backgroundSize:"128px", zIndex:3 }}
        />

        {/* Rank watermark — parallax */}
        <motion.div
          className="absolute right-6 md:right-10 bottom-0 font-black leading-none select-none pointer-events-none"
          style={{ fontSize:"clamp(7rem, 20vw, 16rem)", color:"rgba(255,255,255,0.055)", lineHeight:0.85, y: rankY, zIndex:2 }}
        >
          {hero.rank.replace("#","")}
        </motion.div>

        {/* Text content — parallax */}
        <motion.div
          className="relative h-full flex flex-col justify-end px-6 md:px-10 pb-8"
          style={{ y: textY, zIndex:4 }}
        >
          <AnimatePresence mode="wait">
            {(showLoadingState && HERO_ARTISTS.length === 0) ? (
              /* ── HERO SKELETON — only when truly no data (DEFAULT_HERO_ARTISTS covers loading) ── */
              <motion.div
                key="hero-skeleton"
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                transition={{ duration:0.3 }}
                className="flex flex-col gap-3"
                data-testid="hero-skeleton"
              >
                <div className="h-3 w-24 rounded animate-pulse" style={{ background:"rgba(57,255,20,0.18)" }} />
                <div className="h-16 w-2/3 rounded-lg animate-pulse" style={{ background:"rgba(255,255,255,0.07)" }} />
                <div className="h-16 w-1/2 rounded-lg animate-pulse" style={{ background:"rgba(255,255,255,0.05)", animationDelay:"0.1s" }} />
                <div className="flex gap-3 mt-2">
                  <div className="h-3 w-28 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.06)" }} />
                  <div className="h-3 w-20 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.06)", animationDelay:"0.07s" }} />
                  <div className="h-3 w-24 rounded animate-pulse" style={{ background:"rgba(57,255,20,0.1)", animationDelay:"0.14s" }} />
                </div>
                <div className="flex gap-3 mt-2">
                  <div className="h-9 w-32 rounded-full animate-pulse" style={{ background:"rgba(57,255,20,0.2)" }} />
                  <div className="h-9 w-28 rounded-full animate-pulse" style={{ background:"rgba(255,255,255,0.06)", animationDelay:"0.1s" }} />
                </div>
              </motion.div>
            ) : (
            <motion.div
              key={`text-${heroIndex}`}
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-14 }}
              transition={{ duration:0.55, ease:[0.16,1,0.3,1] }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.32em] mb-3" style={{ color:"#39FF14" }}>
                {hero.rank} EN MÉXICO
                <span className="mx-3 opacity-40">·</span>
                {hero.tag}
              </div>
              <h1
                className="font-black uppercase leading-[0.88] tracking-tight text-white mb-4"
                style={{ fontSize:"clamp(2.6rem, 9vw, 7.5rem)", textShadow:"0 2px 80px rgba(0,0,0,0.98), 0 0 200px rgba(0,0,0,0.8)" }}
              >
                {hero.line1} {hero.line2}
              </h1>
              <p className="text-sm text-white/55 uppercase tracking-[0.18em] mb-6 font-medium">
                {hero.listeners} OYENTES
                {hero.countries && hero.countries !== "—" && (
                  <><span className="mx-3 opacity-40">·</span>{hero.countries}</>
                )}
                {hero.growth && hero.growth !== "—" && (
                  <><span className="mx-3 opacity-40">·</span><span style={{ color:"#39FF14" }}>{hero.growth} esta semana</span></>
                )}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Link href="/charts">
                  <motion.span
                    whileHover={reduced ? {} : { scale:1.03 }}
                    whileTap={reduced ? {} : { scale:0.97 }}
                    className="inline-block px-6 py-2.5 text-xs font-black uppercase tracking-[0.12em] rounded-full text-black cursor-pointer"
                    style={{ background:"#39FF14", boxShadow:"0 0 18px rgba(57,255,20,0.26)" }}
                    data-testid="btn-hero-cta"
                  >
                    Ver Charts →
                  </motion.span>
                </Link>
                <Link href={`/artist/${slugify(hero.name)}`}>
                  <motion.span
                    whileHover={reduced ? {} : { scale:1.03, borderColor:"rgba(255,255,255,0.5)" }}
                    whileTap={reduced ? {} : { scale:0.97 }}
                    className="inline-block px-6 py-2.5 text-xs font-black uppercase tracking-[0.12em] rounded-full border border-white/25 text-white backdrop-blur-sm cursor-pointer"
                    data-testid="btn-hero-profile"
                  >
                    Ver Perfil
                  </motion.span>
                </Link>
              </div>
            </motion.div>
            )}
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="absolute bottom-8 right-6 md:right-10 flex items-center gap-2">
            {HERO_ARTISTS.map((_, i) => (
              <button key={i} onClick={() => setHeroIndex(i)}
                className="transition-all duration-300 rounded-full focus:outline-none"
                style={{ width:i===heroIndex?22:6, height:6, background:i===heroIndex?"#39FF14":"rgba(255,255,255,0.25)", border:"none", padding:0, cursor:"pointer" }}
                aria-label={`Artista ${i+1}`}
              />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── STATS TICKER ── */}
      <div
        className="border-b border-white/[0.05] bg-[#080808] overflow-hidden py-3"
        style={{ whiteSpace:"nowrap", borderTop:"1px solid rgba(57,255,20,0.07)", boxShadow:"inset 0 1px 0 rgba(57,255,20,0.04)", willChange:"transform" }}
        onMouseEnter={() => setTickerPaused(true)}
        onMouseLeave={() => setTickerPaused(false)}
      >
        <div
          className="inline-block animate-marquee-slow"
          style={{ willChange:"transform", animationPlayState: tickerPaused ? "paused" : "running" }}
        >
          <span className="text-zinc-700 font-black text-[10px] uppercase tracking-[0.28em]">
            {["145+ ARTISTAS","MÚSICA MEXICANA","DATOS EN TIEMPO REAL","60+ PAÍSES","CHARTS SEMANALES"].map((s,i)=>(
              <span key={i}>{s}<span className="mx-5 text-zinc-800">·</span></span>
            ))}
            {["145+ ARTISTAS","MÚSICA MEXICANA","DATOS EN TIEMPO REAL","60+ PAÍSES","CHARTS SEMANALES"].map((s,i)=>(
              <span key={`r${i}`}>{s}<span className="mx-5 text-zinc-800">·</span></span>
            ))}
          </span>
        </div>
      </div>

      {/* ── ERROR BANNER — only shown when a sheet URL is configured but fetch failed ── */}
      {showErrorState && (
        <div
          className="px-6 lg:px-12 py-3 flex items-center gap-3"
          style={{ background: "rgba(255,40,40,0.06)", borderBottom: "1px solid rgba(255,40,40,0.18)" }}
          data-testid="error-banner"
        >
          <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,80,80,0.9)" }}>
            Error al cargar datos de charts
          </span>
          <span className="text-[10px] text-zinc-600 font-medium">
            · Mostrando datos de referencia. Revisa la URL en sheetSources.ts.
          </span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TOP 10 ARTIST CARDS — V5 cards + premium hover
      ══════════════════════════════════════════════════════════ */}
      <Shelf label="Top 10 Artistas Mexicanos · Esta Semana" icon={<TrendingUp className="w-4 h-4" />}>
        {hubLoading
          ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
          : SHELF_ARTISTS.map((a, idx) => {
          const photo = img(a.name);
          return (
            <Link
              key={a.rank}
              href={`/artist/${slugify(a.name)}`}
              style={{ flexShrink:0, scrollSnapAlign:"start", display:"block" }}
            >
            <motion.div
              initial={reduced ? { opacity:1 } : { opacity:0, y:16 }}
              whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true, margin:"-40px" }}
              transition={{ duration:0.5, delay: idx * 0.055, ease:[0.16,1,0.3,1] }}
              whileHover={reduced ? {} : { scale:1.04, y:-4, transition:{ duration:0.28, ease:[0.16,1,0.3,1] } }}
              className="relative cursor-pointer"
              style={{
                width:150, height:228,
                borderRadius:"1rem",
                boxShadow:"0 4px 28px rgba(0,0,0,0.7)",
              }}
              data-testid={`strip-card-${a.rank}`}
            >
              {/* Clip container: overflow+radius+mask is the proven Safari fix for white fringe.
                  Mask is 99% white so it's visually identical to no-mask but forces Safari's
                  mask renderer which eliminates the border-radius anti-aliasing fringe. */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  borderRadius:"1rem",
                  WebkitMaskImage:"radial-gradient(ellipse 100% 100% at 50% 50%, white 97%, transparent 100%)",
                  maskImage:"radial-gradient(ellipse 100% 100% at 50% 50%, white 97%, transparent 100%)",
                }}
              >
                {/* Photo in its own div so the filter only touches the image */}
                <div className="absolute inset-0" style={{
                  background: photo
                    ? `url(${photo}) center top / cover no-repeat`
                    : "linear-gradient(160deg, #0a0a0a 0%, #141414 100%)",
                  filter: photo ? "brightness(0.86) saturate(0.68) contrast(1.08)" : undefined,
                }} />

                {/* Subtle edge darkening — just enough to blend card edges with background */}
                {photo && <div className="absolute inset-0 pointer-events-none" style={{
                  background:"radial-gradient(ellipse 85% 90% at 50% 42%, transparent 45%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.82) 100%)"
                }} />}

                {/* Hover glow — inset only, no outward bleed */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  initial={{ opacity:0 }}
                  whileHover={{ opacity:1 }}
                  transition={{ duration:0.25 }}
                  style={{ boxShadow:`inset 0 0 0 1px ${a.accent}55` }}
                />

                {/* Brightness shift on hover */}
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-300" />
                {/* Inner top highlight */}
                <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background:"linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)" }} />

                {/* Rank watermark */}
                <div className="absolute top-2 left-3 font-black text-5xl leading-none select-none" style={{ color:"rgba(255,255,255,0.15)" }}>
                  {String(a.rank).padStart(2,"0")}
                </div>

                {/* Genre accent dot */}
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background:a.accent, boxShadow:`0 0 6px ${a.accent}` }} />

                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background:"linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)" }}>
                  <div className="font-black text-sm uppercase leading-tight text-white mb-0.5">{a.name}</div>
                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color:"rgba(255,255,255,0.48)" }}>{a.genre}</div>
                  <div className="text-[11px] font-black" style={{ color:a.accent }}>{a.streams}</div>
                </div>
              </div>
            </motion.div>
            </Link>
          );
        })}
      </Shelf>

      {/* ══════════════════════════════════════════════════════════
          GENRE TERRITORIES — color blocks + depth
      ══════════════════════════════════════════════════════════ */}
      <section className="py-7 px-6 lg:px-12 relative" data-testid="section-generos">
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background:"linear-gradient(to right, transparent, rgba(57,255,20,0.1), transparent)" }} />
        <FadeUp>
          <div className="flex items-center gap-3 mb-5">
            <span style={{ color:"#39FF14" }}><Music className="w-4 h-4" /></span>
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Territorios de Género</h2>
            <div className="flex-1 h-px ml-2" style={{ background:"rgba(255,255,255,0.07)" }} />
          </div>
        </FadeUp>
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once:true, margin:"-60px" }}
          variants={staggerContainer}
        >
          {GENRES.map((g) => (
            <motion.div
              key={g.name}
              variants={fadeUpVariants}
              whileHover={reduced ? {} : { scale:1.025, y:-2, transition:{ duration:0.22 } }}
              className="relative overflow-hidden cursor-pointer rounded-xl"
              style={{
                minHeight:88,
                background:"linear-gradient(160deg, #0d0d0d 0%, #0a0a0a 100%)",
                border:`1px solid ${g.accent}1e`,
                boxShadow:`0 4px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
              }}
            >
              {/* Inner noise */}
              <div className="absolute inset-0 opacity-[0.05] rounded-xl pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"96px" }} />

              {/* Hover glow */}
              <motion.div
                className="absolute inset-0 rounded-xl pointer-events-none"
                initial={{ opacity:0 }}
                whileHover={{ opacity:1 }}
                transition={{ duration:0.3 }}
                style={{ background:`radial-gradient(ellipse at 20% 50%, ${g.accent}22 0%, transparent 65%)`, boxShadow:`inset 0 0 0 1px ${g.accent}30` }}
              />

              {/* Accent left bar */}
              <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full" style={{ background:g.accent, boxShadow:`0 0 8px ${g.accent}` }} />

              <div className="relative h-full flex flex-col justify-between p-4 pl-5">
                <div>
                  <div className="font-black text-sm uppercase leading-tight text-white">{g.name}</div>
                  <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color:"rgba(255,255,255,0.38)" }}>
                    {genreArtistCounts !== null ? `${genreArtistCounts[g.name]} artistas` : "—"}
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-lg font-black leading-none text-white">
                      {genreStats ? fmtBig(genreStats[g.name].streams) : "—"}
                    </div>
                    <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color:"rgba(255,255,255,0.35)" }}>streams spotify</div>
                  </div>
                  <motion.span
                    className="text-[9px] uppercase tracking-widest font-black"
                    initial={{ opacity:0 }}
                    whileHover={{ opacity:1 }}
                    style={{ color:g.accent }}
                  >VER →</motion.span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          IFPI INSIGHT BANNER
      ══════════════════════════════════════════════════════════ */}
      <FadeUp>
        <section className="px-6 lg:px-12 py-3" data-testid="ifpi-teaser">
          <Link href="/insights/mexico-top-10-ifpi-2026">
            <motion.div
              whileHover={reduced ? {} : { y: -2, transition: { duration: 0.22 } }}
              className="relative overflow-hidden rounded-xl cursor-pointer"
              style={{
                background: "#060806",
                border: "1px solid rgba(57,255,20,0.18)",
                boxShadow: "0 0 48px rgba(57,255,20,0.06), inset 0 1px 0 rgba(57,255,20,0.08)",
                minHeight: 88,
              }}
            >
              {/* Globe — screen blend, right-anchored */}
              <div className="absolute pointer-events-none" style={{
                right: "-6%", top: "50%", transform: "translateY(-50%)",
                width: "min(65vw, 520px)", zIndex: 1,
              }}>
                <img
                  src={`${import.meta.env.BASE_URL}globe-mexico.png`}
                  alt=""
                  style={{
                    width: "100%", height: "auto", display: "block",
                    mixBlendMode: "screen",
                    opacity: 0.38,
                    filter: "saturate(0.5) brightness(0.9)",
                  }}
                />
              </div>

              {/* Gradient: keep left content readable over the globe */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, #060806 38%, rgba(6,8,6,0.7) 60%, transparent 100%)", zIndex: 2 }} />

              {/* Noise */}
              <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px", zIndex: 2 }} />

              {/* Green glow bloom — left */}
              <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(57,255,20,0.1) 0%, transparent 70%)", zIndex: 2 }} />

              {/* Top banner stripe */}
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(to right, #39FF14, rgba(57,255,20,0.1))" }} />

              <div className="relative z-10 flex items-center justify-between gap-4 px-6 py-5">
                {/* Left: badge + headline */}
                <div className="flex items-center gap-4 min-w-0">
                  {/* Publication badge */}
                  <div
                    className="hidden sm:flex flex-col items-center justify-center shrink-0 rounded-lg px-3 py-2 text-center"
                    style={{ background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.2)", minWidth: 52 }}
                  >
                    <span className="text-[8px] font-black uppercase tracking-[0.18em] leading-none" style={{ color: "rgba(57,255,20,0.7)" }}>IFPI</span>
                    <span className="text-base font-black leading-none text-white mt-0.5">2026</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em]"
                        style={{ background: "#39FF14", color: "#000" }}
                      >
                        Nuevo Informe
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Música Grabada · Global
                      </span>
                    </div>
                    <div className="text-sm font-black uppercase tracking-tight text-white leading-snug">
                      México entra al <span style={{ color: "#39FF14" }}>Top 10</span> mundial
                    </div>
                    <div className="text-[10px] mt-0.5 font-medium" style={{ color: "rgba(255,255,255,0.38)" }}>
                      Por primera vez en la historia · IFPI Global Music Report
                    </div>
                  </div>
                </div>

                {/* Center: three stats */}
                <div className="hidden md:flex items-center gap-5 shrink-0">
                  {[
                    { v: "#10",    l: "mercado global" },
                    { v: "+13.3%", l: "crecimiento 2025" },
                    { v: "1ª VEZ", l: "en el Top 10" },
                  ].map(s => (
                    <div key={s.l} className="text-center">
                      <div className="text-lg font-black leading-none" style={{ color: "#39FF14", letterSpacing: "-0.02em" }}>{s.v}</div>
                      <div className="text-[8px] font-black uppercase tracking-[0.16em] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Right: CTA */}
                <motion.span
                  className="text-[10px] font-black uppercase tracking-[0.2em] shrink-0 flex items-center gap-1.5 whitespace-nowrap"
                  style={{ color: "#39FF14" }}
                  whileHover={reduced ? {} : { x: 3 }}
                >
                  Leer →
                </motion.span>
              </div>
            </motion.div>
          </Link>
        </section>
      </FadeUp>

      {/* ══════════════════════════════════════════════════════════
          DATA BENTO — editorial depth
      ══════════════════════════════════════════════════════════ */}
      <section className="py-7 px-6 lg:px-12 relative" data-testid="section-bento">
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background:"linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)" }} />
        <FadeUp>
          <div className="flex items-center gap-3 mb-5">
            <span style={{ color:"#39FF14" }}><TrendingUp className="w-4 h-4" /></span>
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Estadísticas · 2026</h2>
            <div className="flex-1 h-px ml-2" style={{ background:"rgba(255,255,255,0.07)" }} />
          </div>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* TOP ARTISTAS */}
          <FadeUp delay={0.05}>
            <div className="relative overflow-hidden rounded-xl p-6" style={{ background:"linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }} data-testid="bento-top-artistas">
              <div className="absolute inset-0 opacity-[0.025] rounded-xl pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"96px" }} />
              <div className="absolute -bottom-6 -right-4 font-black italic text-[110px] leading-none select-none pointer-events-none" style={{ color:"rgba(57,255,20,0.018)" }}>TOP</div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-0.5">YOUTUBE · SEMANAL</div>
                    <h3 className="text-base font-black uppercase text-white">TOP ARTISTAS <span style={{ color:"#39FF14" }}>MÉXICO</span></h3>
                  </div>
                  <Link href="/charts?platform=YouTube&sheet=YT_Artists_Weekly" className="text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors" style={{ color:"#39FF14" }}>VER TODOS →</Link>
                </div>
                <motion.div
                  className="flex flex-col gap-3"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once:true }}
                  variants={staggerContainer}
                >
                  {hubLoading
                    ? Array.from({ length: 5 }).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-3" style={{ opacity: 1 - idx * 0.15 }}>
                          <div className="w-8 h-3 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.06)" }} />
                          <div className="w-9 h-9 rounded-full animate-pulse shrink-0" style={{ background:"rgba(255,255,255,0.06)" }} />
                          <div className="flex-1 h-3 rounded animate-pulse" style={{ background:"rgba(255,255,255,0.06)" }} />
                          <div className="w-12 h-5 rounded-full animate-pulse" style={{ background:"rgba(57,255,20,0.07)" }} />
                        </div>
                      ))
                    : TOP_STRIP.length === 0
                    ? <div className="text-xs text-zinc-600 uppercase tracking-widest py-4">Sin datos disponibles</div>
                    : TOP_STRIP.slice(0,5).map((a) => {
                    const photo = img(a.name);
                    return (
                      <Link key={a.rank} href={`/artist/${slugify(a.name)}`} style={{ display:"block" }}>
                      <motion.div
                        variants={fadeUpVariants}
                        whileHover={reduced ? {} : { x:3, transition:{ duration:0.2 } }}
                        className="flex items-center gap-3 cursor-pointer group/row"
                      >
                        <div className="text-xl font-black text-zinc-800 w-8 font-mono shrink-0">{String(a.rank).padStart(2,"0")}</div>
                        {photo
                          ? <img src={photo} alt={a.name} className="w-9 h-9 rounded-full object-cover shrink-0 transition-all duration-300 group-hover/row:brightness-105" style={{ border:`1px solid ${a.accent}30`, filter:"saturate(0.68) contrast(1.08) brightness(0.86)" }} />
                          : <div className="w-9 h-9 rounded-full shrink-0" style={{ background:"#1c1c1c", border:`1px solid ${a.accent}30` }} />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-black text-sm truncate group-hover/row:text-[#39FF14] transition-colors duration-200">{a.name}</div>
                        </div>
                        <div className="text-xs font-black font-mono shrink-0 px-2 py-1 rounded-full transition-all duration-200 group-hover/row:scale-105" style={{ color:a.accent, background:`${a.accent}0e`, border:`1px solid ${a.accent}20` }}>{a.streams}</div>
                      </motion.div>
                      </Link>
                    );
                  })}
                </motion.div>
              </div>
            </div>
          </FadeUp>

          {/* EN ASCENSO — only shown when real growth data is available */}
          {(hubLoading || ASCENSO.length > 0) && (
          <FadeUp delay={0.1}>
            <div className="relative overflow-hidden rounded-xl p-6" style={{ background:"linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }} data-testid="bento-artistas-ascenso">
              <div className="absolute inset-0 opacity-[0.025] rounded-xl pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"96px" }} />
              <div className="absolute -bottom-4 -right-2 font-black italic text-[100px] leading-none select-none pointer-events-none" style={{ color:"rgba(57,255,20,0.018)" }}>↑</div>
              <div className="relative z-10 flex flex-col">
                <div className="mb-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-0.5">ARTISTAS MEXICANOS · SPOTIFY DIARIO</div>
                  <h3 className="text-base font-black uppercase text-white">EN <span style={{ color:"#39FF14" }}>ASCENSO</span></h3>
                </div>
                <div className="flex flex-col gap-4">
                  {hubLoading
                    ? Array.from({ length: 5 }).map((_, idx) => <SkeletonAscensoRow key={idx} idx={idx} />)
                    : ASCENSO.map((a, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-bold text-sm">{a.name}</span>
                        <span className="font-black text-xs" style={{ color:a.accent }}>{a.growth}</span>
                      </div>
                      <div className="h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width:0 }}
                          whileInView={{ width:`${a.bar}%` }}
                          viewport={{ once:true }}
                          transition={{ duration:1.4, delay: idx * 0.12, ease:[0.16,1,0.3,1] }}
                          className="h-full rounded-full"
                          style={{ background:`linear-gradient(90deg, ${a.accent}, ${a.accent}60)`, boxShadow:`0 0 6px ${a.accent}38` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-5 font-bold">Mayor movimiento hoy</p>
              </div>
            </div>
          </FadeUp>
          )}

        </div>
      </section>

      {/* ── PLATFORM STRIP ── */}
      <FadeUp>
        <section className="px-6 lg:px-12 py-4" data-testid="platform-strip">
          <div className="rounded-xl overflow-hidden" style={{ background:"linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 6px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
            <div className="px-6 py-3 border-b border-white/[0.05] flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">STREAMS TOTALES</h2>
            </div>
            <div className="grid grid-cols-2 divide-x divide-white/[0.05]">
              {([
                {
                  icon: <SiSpotify className="w-5 h-5" />,
                  color: "#1DB954",
                  name: "Spotify",
                  streams: platformTotals.spotifyFmt ?? "—",
                  label: "streams totales",
                },
                {
                  icon: <SiYoutube className="w-5 h-5" />,
                  color: "#FF0000",
                  name: "YouTube",
                  streams: platformTotals.youtubeFmt ?? "—",
                  label: "vistas totales",
                },
              ] as const).map(p => (
                <motion.div
                  key={p.name}
                  whileHover={reduced ? {} : { backgroundColor:"rgba(255,255,255,0.02)", transition:{ duration:0.2 } }}
                  className="flex items-center gap-3 px-4 py-4 md:gap-4 md:px-6 md:py-5 cursor-default"
                >
                  <motion.span
                    style={{ color:p.color }}
                    whileHover={reduced ? {} : { scale:1.18, filter:`drop-shadow(0 0 7px ${p.color}90)` }}
                    transition={{ duration:0.25 }}
                  >{p.icon}</motion.span>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-600 font-bold">{p.name}</div>
                    <div className="text-xl font-black text-white leading-tight">{p.streams}</div>
                    <div className="text-[10px] font-bold text-zinc-600 mt-0.5">{p.label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ── NEWSLETTER ── */}
      <FadeUp>
        <section className="px-6 lg:px-12 py-6">
          <div
            className="relative overflow-hidden rounded-2xl p-8 flex flex-col md:flex-row items-center gap-6 justify-between"
            style={{ background:"linear-gradient(135deg, rgba(57,255,20,0.045) 0%, rgba(57,255,20,0.008) 100%)", border:"1px solid rgba(57,255,20,0.12)", boxShadow:"0 0 50px rgba(57,255,20,0.038), inset 0 1px 0 rgba(57,255,20,0.08)" }}
          >
            <div className="absolute inset-0 opacity-[0.04] rounded-2xl pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"128px" }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4" style={{ color:"#39FF14" }} />
                <span className="text-xs font-black uppercase tracking-[0.25em]" style={{ color:"#39FF14" }}>BOLETÍN SEMANAL</span>
              </div>
              <h3 className="text-xl font-black uppercase text-white mb-1">Reportes exclusivos directo a tu correo</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Charts, análisis y estadísticas de la música mexicana cada semana.</p>
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <input
                type="email" placeholder="correo@ejemplo.com"
                className="bg-black/50 border border-white/10 rounded-full text-white text-xs px-4 py-3 focus:outline-none focus:border-[rgba(57,255,20,0.4)] transition-all duration-300 placeholder-zinc-700 md:w-56"
                data-testid="input-newsletter"
              />
              <motion.button
                whileHover={reduced ? {} : { scale:1.03 }}
                whileTap={reduced ? {} : { scale:0.97 }}
                className="text-black font-black text-xs uppercase tracking-widest px-6 py-3 rounded-full whitespace-nowrap"
                style={{ background:"#39FF14", boxShadow:"0 0 16px rgba(57,255,20,0.22)" }}
                data-testid="btn-newsletter"
              >SUSCRIBIRME</motion.button>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ── FOOTER ── */}
      <footer className="border-t pt-16 pb-8 px-6 lg:px-12 relative overflow-hidden" style={{ background:"linear-gradient(to bottom, #060606 0%, #030303 100%)", borderTop:"1px solid rgba(57,255,20,0.07)", boxShadow:"inset 0 1px 0 rgba(57,255,20,0.04)" }} data-testid="footer">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="font-black uppercase italic text-white leading-none whitespace-nowrap" style={{ fontSize:"clamp(60px,14vw,180px)", opacity:0.013, letterSpacing:"-0.03em" }}>MEXICO CHARTS</span>
        </div>
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"128px" }} />
        <div className="relative z-10 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div>
              <img src={logoUrl} alt="Mexico Charts" className="h-9 object-contain mb-4 opacity-90" />
              <p className="text-zinc-500 text-xs leading-relaxed max-w-[200px]">La fuente líder de estadísticas de la música mexicana en el mundo.</p>
              <div className="flex gap-4 mt-4">
                {([SiInstagram,SiX,SiTiktok,SiYoutube] as React.ElementType[]).map((Icon,i) => (
                  <a key={i} href="#" className="text-zinc-500 hover:text-[#39FF14] transition-colors duration-200"><Icon className="w-4 h-4" /></a>
                ))}
              </div>
            </div>
            {[
              { title:"Explorar", links:[
                { label:"Charts",           href:"/charts" },
                { label:"Artistas",         href:"/artists" },
                { label:"Touring",          href:"/touring" },
                { label:"Certificaciones",  href:"/industry/certifications" },
                { label:"Industria",        href:"/industria" },
              ]},
              { title:"Compañía", links:[
                { label:"Acerca de",   href:"#" },
                { label:"Metodología", href:"#" },
                { label:"Contacto",    href:"#" },
                { label:"Privacidad",  href:"#" },
              ]},
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400 mb-4">{col.title}</h4>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map(({ label, href }) => (
                    <li key={label}>
                      <Link href={href}>
                        <span className="text-zinc-500 hover:text-zinc-200 transition-colors duration-200 text-xs cursor-pointer">{label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center pt-6" style={{ borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">© 2026 Mexico Charts. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
