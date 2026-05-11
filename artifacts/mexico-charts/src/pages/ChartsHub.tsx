import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
    charts: [
      { id: "YT_Songs_Weekly",   label: "Top Songs",   period: "Semanal" },
      { id: "YT_Videos_Daily",   label: "Top Videos",  period: "Diario"  },
      { id: "YT_Artists_Weekly", label: "Top Artists", period: "Semanal" },
      { id: "YT_Shorts_Daily",   label: "Top Shorts",  period: "Diario"  },
    ],
  },
  {
    id: "Spotify",
    label: "Spotify",
    Icon: SiSpotify,
    color: "#1DB954",
    source: "Spotify Charts",
    sourceUrl: "https://charts.spotify.com",
    charts: [
      { id: "Spotify_Regional_Daily",  label: "Regional",    period: "Diario"  },
      { id: "Spotify_Regional_Weekly", label: "Regional",    period: "Semanal" },
      { id: "Spotify_Viral_Daily",     label: "Viral",       period: "Diario"  },
    ],
  },
  {
    id: "Apple Music",
    label: "Apple Music",
    Icon: SiApplemusic,
    color: "#fc3c44",
    source: "Apple Music",
    sourceUrl: "https://music.apple.com/mx/room/1108041827",
    charts: [
      { id: "Apple_Songs",  label: "Top Songs",  period: "" },
      { id: "Apple_Albums", label: "Top Albums", period: "" },
    ],
  },
  {
    id: "Deezer",
    label: "Deezer",
    Icon: MdMusicNote,
    color: "#A238FF",
    source: "Deezer",
    sourceUrl: "https://link.deezer.com/s/33eGo3PgAInikdTPxA2xN",
    charts: [
      { id: "Deezer_Top_Mexico", label: "Top México", period: "Diario" },
    ],
  },
] as const;

type PlatformId = typeof PLATFORMS[number]["id"];

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
  YT_Artists_Weekly: [
    { key: "Artist Name",      label: "Artista",     align: "left",  mobile: true,  isArtist: true },
    { key: "Views",            label: "Views",       align: "right", mobile: false, isMetric: true },
    { key: "Growth",           label: "Crec.",       align: "right", mobile: false },
    { key: "Periods on Chart", label: "Semanas",     align: "right", mobile: false },
  ],
  YT_Songs_Weekly: [
    { key: "Artist Names", label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Track Name",   label: "Canción",  align: "left",  mobile: true  },
    { key: "Views",        label: "Views",    align: "right", mobile: false, isMetric: true },
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
    { key: "streams",      label: "Streams",  align: "right", mobile: false, isMetric: true },
    { key: "peak_rank",    label: "Pico",     align: "right", mobile: false },
    { key: "days_on_chart",label: "Días",     align: "right", mobile: false },
  ],
  Spotify_Regional_Weekly: [
    { key: "artist_names",  label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "track_name",    label: "Canción",  align: "left",  mobile: true  },
    { key: "streams",       label: "Streams",  align: "right", mobile: false, isMetric: true },
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
    { key: "Artist Names", label: "Artista",  align: "left",  mobile: true,  isArtist: true },
    { key: "Title",        label: "Canción",  align: "left",  mobile: true  },
  ],
};

/* ── Types ───────────────────────────────────────────────────────────────── */
type Row = Record<string, string>;
interface SheetData { headers: string[]; rows: Row[] }
interface HubData { lastUpdated: string; sheets: Record<string, SheetData> }

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Separator regex — keeps separators as capture groups so split() returns them */
const SEP_RE = /(\s*[,&]\s*|\s*\/\s*|\s+feat\.\s+|\s+ft\.\s+|\s+x\s+|\s+and\s+|\s+y\s+|\s+junto\s+a\s+)/i;

function fmt(val: string): string {
  if (!val || val === "n/a" || val === "—") return val || "—";
  const n = parseInt(val.replace(/,/g, ""), 10);
  if (isNaN(n)) return val;
  return n.toLocaleString("es-MX");
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
  if (isNeutral) return <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 11 }}>—</span>;
  if (positive) return <span className="text-[11px] font-black" style={{ color: G }}>{label}</span>;
  if (negative) return <span className="text-[11px] font-black" style={{ color: "#f87171" }}>{label}</span>;
  return <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 11 }}>—</span>;
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

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function SkeletonRow({ i }: { i: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: 1 - i * 0.08 }}>
      <div className="w-8 h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
      <div className="flex-1 h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)", width: "45%" }} />
      <div className="hidden md:block h-3 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function ChartsHub() {
  const [activePlatform, setActivePlatform] = useState<PlatformId>("YouTube");
  const [activeSheet, setActiveSheet] = useState("YT_Songs_Weekly");
  const [filterMex, setFilterMex] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const platform = PLATFORMS.find(p => p.id === activePlatform)!;

  const { data, isLoading, isError, dataUpdatedAt } = useQuery<HubData>({
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

  const currentChartMeta = platform.charts.find(c => c.id === activeSheet) ?? platform.charts[0];

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />

      <SiteNav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-12 pt-14 pb-8"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="text-[10px] font-black uppercase tracking-[0.35em] mb-4" style={{ color: G }}>
          Charts
        </motion.p>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.04 }}
          className="font-black uppercase leading-[0.88] mb-4"
          style={{ fontSize: "clamp(2.6rem,5.5vw,5.5rem)", letterSpacing: "-0.04em" }}>
          Charts<br /><span style={{ color: G }}>México</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-sm max-w-2xl mb-1" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
          Explora rankings de plataformas musicales en México y filtra la presencia de artistas mexicanos dentro de cada chart.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.14 }}
          className="flex flex-wrap items-center gap-4 mt-3">
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
            Fuentes: YouTube Charts · Spotify · Apple Music · Deezer
          </span>
          {updatedFmt && (
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
              · Última actualización: {updatedFmt}
            </span>
          )}
        </motion.div>
      </section>

      <div className="px-6 lg:px-12 py-6 space-y-5">

        {/* ── PLATFORM TABS ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => {
            const active = activePlatform === p.id;
            return (
              <button key={p.id} onClick={() => switchPlatform(p.id as PlatformId)}
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
                <button key={c.id} onClick={() => switchSheet(c.id)}
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

          {/* Mexican filter toggle */}
          <div className="flex items-center gap-0 rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            {[false, true].map(isMex => (
              <button key={String(isMex)} onClick={() => setFilterMex(isMex)}
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
                style={{ color: "rgba(255,255,255,0.25)" }}>
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
                    Charts no disponibles
                  </p>
                  <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Intenta recargar la página en unos momentos.
                  </p>
                </div>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <div className="py-16 text-center">
                  <p className="text-sm font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
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
                                style={{ color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.15)", padding: "3px 8px", borderRadius: 6 }}>
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

            {/* Source + methodology */}
            {!isLoading && !isError && (
              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Fuente: {platform.source} ·{" "}
                    <a href={platform.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                      {platform.sourceUrl}
                    </a>
                  </span>
                  {sheetData && (
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
                      {rows.length} entradas
                    </span>
                  )}
                </div>
                <p className="px-1 text-[9px] leading-relaxed" style={{ color: "rgba(255,255,255,0.18)", maxWidth: "65ch" }}>
                  Mexico Charts organiza y presenta datos de plataformas musicales para mostrar rankings en México.
                  La vista «Solo artistas mexicanos» es un filtro editorial aplicado a los charts originales y conserva las posiciones originales de cada plataforma.
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
