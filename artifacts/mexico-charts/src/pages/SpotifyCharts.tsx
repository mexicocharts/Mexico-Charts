import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { SiSpotify } from "react-icons/si";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

interface ChartEntry {
  pos: number;
  posChange: string;
  artist: string;
  title: string;
  features: string[];
  trackId: string;
  artistId: string;
  streams: string;
  totalStreams: string;
  coverUrl: string | null;
}

interface ChartResponse {
  period: string;
  fetchedAt: string;
  entries: ChartEntry[];
}

function useChart(period: "daily" | "weekly") {
  return useQuery<ChartResponse>({
    queryKey: ["mx-spotify-chart", period],
    queryFn: async () => {
      const resp = await fetch(`/api/charts/mx-spotify?period=${period}`);
      if (!resp.ok) throw new Error("Failed to fetch chart");
      return resp.json();
    },
    staleTime: 15 * 60 * 1000,
    retry: 2,
  });
}

function PosChange({ val }: { val: string }) {
  if (val === "=" || val === "") return <span style={{ color: "rgba(255,255,255,0.45)" }}>—</span>;
  if (val === "NEW") return <span className="text-[8px] font-black tracking-widest" style={{ color: G }}>NEW</span>;
  const n = parseInt(val);
  if (!isNaN(n) && n > 0) return <span className="text-[10px] font-black" style={{ color: G }}>+{n}</span>;
  if (!isNaN(n) && n < 0) return <span className="text-[10px] font-black" style={{ color: "#f87171" }}>{n}</span>;
  return <span style={{ color: "rgba(255,255,255,0.45)" }}>—</span>;
}

function artistCredit(entry: ChartEntry) {
  return `${entry.artist}${entry.features.length > 0 ? ` ft. ${entry.features.join(", ")}` : ""}`;
}

function AlbumArt({ src, title }: { src: string | null; title: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: 48, height: 48, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <SiSpotify className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
      </div>
    );
  }
  return (
    <img src={src} alt={title} onError={() => setErr(true)}
      className="rounded-lg flex-shrink-0 object-cover"
      style={{ width: 48, height: 48 }} />
  );
}

function SkeletonRow({ i }: { i: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: 1 - i * 0.06 }}>
      <div className="w-8 text-center text-sm font-black" style={{ color: "rgba(255,255,255,0.25)" }}>{i + 1}</div>
      <div className="w-5 text-center" />
      <div className="rounded-lg flex-shrink-0 animate-pulse" style={{ width: 48, height: 48, background: "rgba(255,255,255,0.06)" }} />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)", width: "55%" }} />
        <div className="h-2.5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)", width: "35%" }} />
      </div>
      <div className="hidden md:block h-3 w-20 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

export default function SpotifyCharts() {
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [selectedEntry, setSelectedEntry] = useState<ChartEntry | null>(null);
  const { data, isLoading, isError } = useChart(period);

  useEffect(() => {
    setSelectedEntry(null);
  }, [period]);

  const updatedLabel = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const spotifyUrl = useMemo(() =>
    period === "daily"
      ? "https://open.spotify.com/playlist/37i9dQZEVXbO3qyFxbkOE1"
      : "https://open.spotify.com/playlist/37i9dQZEVXbMXbN3EUUhlg",
    [period]);

  const selectedTrackUrl = selectedEntry
    ? `https://open.spotify.com/track/${selectedEntry.trackId}`
    : "";
  const selectedCredit = selectedEntry ? artistCredit(selectedEntry) : "";
  const selectedMetricLabel = period === "daily" ? "Streams hoy" : "Streams semana";
  const selectedChartLabel = `Spotify México · ${period === "daily" ? "Diario" : "Semanal"}`;

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <PageSEO
        title="Spotify México — Charts diarios y semanales"
        description="Charts de Spotify México con rankings diarios y semanales, streams, movimiento, enlaces oficiales y contexto de música mexicana."
        path="/charts/spotify"
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />

      <SiteNav />

      {/* HERO */}
      <section className="px-6 lg:px-12 pt-14 pb-8" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="text-[10px] font-black uppercase tracking-[0.35em] mb-4" style={{ color: G }}>
          Charts / Spotify México
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.04 }}
          className="flex flex-wrap items-end gap-6 mb-4">
          <h1 className="font-black uppercase leading-[0.88]"
            style={{ fontSize: "clamp(2.4rem, 5vw, 5rem)", letterSpacing: "-0.04em" }}>
            Spotify<br /><span style={{ color: G }}>México</span>
          </h1>
          <div className="flex flex-col gap-1 pb-1">
            <div className="flex items-center gap-2">
              <SiSpotify className="w-4 h-4" style={{ color: "#1DB954" }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.4)" }}>
                Spotify · México · {period === "daily" ? "Diario" : "Semanal"}
              </span>
            </div>
            {updatedLabel && (
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.52)" }}>
                Actualizado: {updatedLabel}
              </span>
            )}
          </div>
        </motion.div>

        {/* Tab toggle */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="flex items-center gap-2">
          {(["daily", "weekly"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.18em] transition-all"
              style={{
                background: period === p ? G : "rgba(255,255,255,0.06)",
                color: period === p ? "#000" : "rgba(255,255,255,0.45)",
                border: period === p ? "none" : "1px solid rgba(255,255,255,0.1)",
              }}>
              {p === "daily" ? "Diario" : "Semanal"}
            </button>
          ))}
          <a href={spotifyUrl} target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.16em] transition-opacity hover:opacity-70"
            style={{ background: "rgba(29,185,84,0.1)", border: "1px solid rgba(29,185,84,0.25)", color: "#1DB954" }}>
            <SiSpotify className="w-3.5 h-3.5" /> Ver en Spotify
          </a>
          <a href="/metodologia"
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.16em] transition-opacity hover:opacity-70"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.52)" }}>
            ⓘ Metodología
          </a>
        </motion.div>
      </section>

      {/* CHART TABLE */}
      <div className="px-6 lg:px-12 py-6">
        <AnimatePresence mode="wait">
          <motion.div key={period}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}>

            {/* Column headers */}
            <div className="hidden md:grid px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] mb-1"
              style={{ gridTemplateColumns: "40px 28px 56px 1fr 120px 120px", color: "rgba(255,255,255,0.52)" }}>
              <span>#</span>
              <span></span>
              <span></span>
              <span>Canción</span>
              <span className="text-right">Streams (día)</span>
              <span className="text-right">Total</span>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              {isLoading && Array.from({ length: 20 }, (_, i) => <SkeletonRow key={i} i={i} />)}

              {isError && (
                <div className="py-20 text-center">
                  <p className="text-sm font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
                    No se pudo cargar el chart
                  </p>
                  <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.48)", fontFamily: "system-ui" }}>
                    Inténtalo de nuevo en unos momentos
                  </p>
                </div>
              )}

              {data?.entries.map((entry, i) => (
                <motion.div key={`${period}-${entry.trackId}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.006, 0.3) }}
                  className="group"
                  style={{ borderBottom: i < data.entries.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>

                  {/* Desktop row */}
                  <div
                    className="hidden cursor-pointer items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.028] md:grid"
                    role="button"
                    tabIndex={0}
                    onClick={event => {
                      if ((event.target as HTMLElement).closest("a,button")) return;
                      setSelectedEntry(entry);
                    }}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedEntry(entry);
                      }
                    }}
                    aria-label={`Ver detalle de ${entry.title}`}
                    style={{ gridTemplateColumns: "40px 28px 56px 1fr 120px 120px" }}
                  >
                    {/* Position */}
                    <div className="font-black text-sm text-right pr-2"
                      style={{ color: i < 3 ? G : "rgba(255,255,255,0.35)", textShadow: i < 3 ? `0 0 20px ${G}55` : "none" }}>
                      {entry.pos}
                    </div>
                    {/* Change */}
                    <div className="text-center text-[10px]"><PosChange val={entry.posChange} /></div>
                    {/* Album art */}
                    <a href={`https://open.spotify.com/track/${entry.trackId}`} target="_blank" rel="noopener noreferrer">
                      <AlbumArt src={entry.coverUrl} title={entry.title} />
                    </a>
                    {/* Title + artist */}
                    <div className="min-w-0">
                      <div className="text-sm font-black text-white truncate">{entry.title}</div>
                      <div className="text-[11px] font-medium truncate mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {artistCredit(entry)}
                      </div>
                    </div>
                    {/* Streams */}
                    <div className="text-right">
                      <div className="text-xs font-black tabular-nums" style={{ color: "rgba(255,255,255,0.7)" }}>{entry.streams}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.52)" }}>hoy</div>
                    </div>
                    {/* Total */}
                    <div className="text-right">
                      <div className="text-xs font-black tabular-nums" style={{ color: "rgba(255,255,255,0.4)" }}>{entry.totalStreams}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>total</div>
                    </div>
                  </div>

                  {/* Mobile row */}
                  <div
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.028] md:hidden"
                    role="button"
                    tabIndex={0}
                    onClick={event => {
                      if ((event.target as HTMLElement).closest("a,button")) return;
                      setSelectedEntry(entry);
                    }}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedEntry(entry);
                      }
                    }}
                    aria-label={`Ver detalle de ${entry.title}`}
                  >
                    <div className="font-black text-sm w-7 text-right flex-shrink-0"
                      style={{ color: i < 3 ? G : "rgba(255,255,255,0.3)" }}>
                      {entry.pos}
                    </div>
                    <a href={`https://open.spotify.com/track/${entry.trackId}`} target="_blank" rel="noopener noreferrer">
                      <AlbumArt src={entry.coverUrl} title={entry.title} />
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-white truncate">{entry.title}</div>
                      <div className="text-[11px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {entry.artist}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <PosChange val={entry.posChange} />
                      <div className="text-[10px] font-black tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>{entry.streams}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer attribution */}
            {data && (
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.50)" }}>
                  Fuente: Spotify Charts · México · {period === "daily" ? "Diario" : "Semanal"} · vía kworb.net
                </span>
                <a href={`https://kworb.net/spotify/country/mx_${period}.html`} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
                  style={{ color: "rgba(255,255,255,0.52)" }}>
                  {data.entries.length} canciones ↗
                </a>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/72 px-3 pb-3 backdrop-blur-md md:items-stretch md:justify-end md:p-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={() => setSelectedEntry(null)}
          >
            <motion.aside
              className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-xl md:h-full md:max-h-none md:rounded-none"
              initial={{ y: 44, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 44, opacity: 0 }}
              transition={{ duration: 0.22 }}
              onMouseDown={event => event.stopPropagation()}
              style={{
                background: "linear-gradient(180deg,#0b0b0b,#050505)",
                border: "1px solid rgba(57,255,20,0.22)",
                boxShadow: "0 28px 90px rgba(0,0,0,0.76)",
              }}
            >
              <div
                className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 md:px-6"
                style={{
                  borderColor: "rgba(255,255,255,0.08)",
                  background: "rgba(8,8,8,0.92)",
                  backdropFilter: "blur(14px)",
                }}
              >
                <span className="text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: G }}>
                  Detalle de canción
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedEntry(null)}
                  className="h-9 w-9 rounded-lg text-lg font-black text-white/50 hover:text-white"
                  style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
                  aria-label="Cerrar detalle"
                >
                  ×
                </button>
              </div>

              <div className="p-4 md:p-6">
                <div
                  className="overflow-hidden"
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${G}28`,
                    background: "radial-gradient(circle at 8% 0%, rgba(57,255,20,0.12), transparent 36%), rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-white/[0.04]">
                    {selectedEntry.coverUrl ? (
                      <img src={selectedEntry.coverUrl} alt="" className="h-full w-full object-cover opacity-80" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-7xl font-black uppercase opacity-20">
                        {selectedEntry.title.charAt(0)}
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.9))" }} />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="mb-3 flex items-center gap-3">
                        <span className="text-4xl font-black tabular-nums" style={{ color: G }}>{selectedEntry.pos}</span>
                        <PosChange val={selectedEntry.posChange} />
                      </div>
                      <h3 className="text-4xl font-black uppercase leading-[0.9] md:text-5xl">{selectedEntry.title}</h3>
                      <p className="mt-3 text-sm font-bold" style={{ color: "rgba(255,255,255,0.62)" }}>
                        {selectedCredit}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
                    <div className="bg-[#080808] px-4 py-3">
                      <span className="block text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.36)" }}>
                        Fuente
                      </span>
                      <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: G }}>
                        Spotify Charts
                      </span>
                    </div>
                    <div className="bg-[#080808] px-4 py-3">
                      <span className="block text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.36)" }}>
                        Chart
                      </span>
                      <span className="mt-2 block text-[11px] font-black uppercase tracking-[0.12em] text-white">
                        {selectedChartLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    ["Posición", `#${selectedEntry.pos}`],
                    ["Movimiento", selectedEntry.posChange === "=" || selectedEntry.posChange === "" ? "Estable" : selectedEntry.posChange],
                    [selectedMetricLabel, selectedEntry.streams],
                    ["Streams totales", selectedEntry.totalStreams],
                    ["Artista principal", selectedEntry.artist],
                    ["Actualizado", updatedLabel ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg px-4 py-3" style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.018)" }}>
                      <span className="block text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.34)" }}>
                        {label}
                      </span>
                      <span className="mt-2 block truncate text-sm font-black" style={{ color: label.includes("Streams") ? G : "rgba(255,255,255,0.76)" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <a
                    href={selectedTrackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex justify-center rounded-lg px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em]"
                    style={{ background: G, color: "#000" }}
                  >
                    Abrir en Spotify
                  </a>
                  <a
                    href={spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex justify-center rounded-lg px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em]"
                    style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.72)" }}
                  >
                    Ver lista completa
                  </a>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
