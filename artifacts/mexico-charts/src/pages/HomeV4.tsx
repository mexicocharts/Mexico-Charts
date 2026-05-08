import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { SiInstagram, SiX, SiTiktok, SiYoutube, SiSpotify, SiApple } from "react-icons/si";
import { Music } from "lucide-react";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const GREEN = "#39FF14";

const HOT_20 = [
  { rank: 1,  trend: "▲", artist: "Peso Pluma",          genre: "Corridos Tumbados", streams: "8.14M",  change: "+3",  platforms: "SP YT AM" },
  { rank: 2,  trend: "▲", artist: "Fuerza Regida",        genre: "Corridos Tumbados", streams: "4.31M",  change: "+1",  platforms: "SP YT" },
  { rank: 3,  trend: "●", artist: "Natanael Cano",        genre: "Corridos Tumbados", streams: "3.97M",  change: "—",   platforms: "SP AM DZ" },
  { rank: 4,  trend: "▼", artist: "Junior H",             genre: "Regional Mexicano", streams: "3.62M",  change: "-1",  platforms: "SP YT" },
  { rank: 5,  trend: "▲", artist: "Carin León",           genre: "Regional Mexicano", streams: "3.18M",  change: "+2",  platforms: "SP YT AM" },
  { rank: 6,  trend: "▼", artist: "Grupo Frontera",       genre: "Norteño",           streams: "2.94M",  change: "-1",  platforms: "SP" },
  { rank: 7,  trend: "▲", artist: "Luis R Conriquez",     genre: "Corridos Tumbados", streams: "2.71M",  change: "+4",  platforms: "SP YT" },
  { rank: 8,  trend: "●", artist: "Xavi",                 genre: "Regional Mexicano", streams: "2.43M",  change: "—",   platforms: "SP AM" },
  { rank: 9,  trend: "▲", artist: "Eslabon Armado",       genre: "Regional Mexicano", streams: "2.28M",  change: "+2",  platforms: "SP YT AM" },
  { rank: 10, trend: "▼", artist: "Gabito Ballesteros",   genre: "Corridos Tumbados", streams: "2.17M",  change: "-2",  platforms: "SP" },
  { rank: 11, trend: "▲", artist: "Tito Double P",        genre: "Corridos Tumbados", streams: "1.98M",  change: "+5",  platforms: "SP YT" },
  { rank: 12, trend: "▼", artist: "Santa Fe Klan",        genre: "Hip-Hop Mexicano",  streams: "1.84M",  change: "-1",  platforms: "SP YT" },
  { rank: 13, trend: "▲", artist: "Oscar Maydon",         genre: "Corridos Tumbados", streams: "1.76M",  change: "+3",  platforms: "SP" },
  { rank: 14, trend: "●", artist: "Marca Registrada",     genre: "Regional Mexicano", streams: "1.62M",  change: "—",   platforms: "SP AM" },
  { rank: 15, trend: "▼", artist: "Grupo Firme",          genre: "Banda",             streams: "1.54M",  change: "-2",  platforms: "SP YT" },
  { rank: 16, trend: "▲", artist: "Clave Especial",       genre: "Corridos Tumbados", streams: "1.41M",  change: "+6",  platforms: "SP" },
  { rank: 17, trend: "●", artist: "Edén Muñoz",           genre: "Regional Mexicano", streams: "1.33M",  change: "—",   platforms: "SP YT AM" },
  { rank: 18, trend: "▲", artist: "Jasiel Nuñez",         genre: "Corridos Tumbados", streams: "1.19M",  change: "+2",  platforms: "SP" },
  { rank: 19, trend: "▼", artist: "Remmy Valenzuela",     genre: "Banda",             streams: "1.07M",  change: "-3",  platforms: "SP YT" },
  { rank: 20, trend: "▲", artist: "Yng Lvcas",            genre: "Pop Urbano",        streams: "0.98M",  change: "+1",  platforms: "SP YT AM" },
];

const INITIAL_FEED = [
  { time: "15:41", msg: "PESO PLUMA sube #1 en Spotify MX",        type: "peak" },
  { time: "15:38", msg: "FUERZA REGIDA +2.1M streams hoy",          type: "stream" },
  { time: "15:34", msg: "CLAVE ESPECIAL nuevo pico histórico #16",  type: "peak" },
  { time: "15:29", msg: "NATANAEL CANO supera 11M oyentes/mes",     type: "stream" },
  { time: "15:21", msg: "TITO DOUBLE P entra TOP 11 por 1ra vez",   type: "peak" },
  { time: "15:14", msg: "CARIN LEÓN +28% crecimiento semanal",      type: "stream" },
  { time: "15:06", msg: "GRUPO FRONTERA baja -1 posición esta sem", type: "drop" },
  { time: "14:58", msg: "OSCAR MAYDON +3.2M streams semana 19",     type: "stream" },
  { time: "14:47", msg: "ESLABON ARMADO regresa TOP 10 → #9",       type: "peak" },
  { time: "14:39", msg: "SANTA FE KLAN baja -1 esta semana",        type: "drop" },
];

const NEW_FEED_ITEMS = [
  { msg: "LUIS R CONRIQUEZ nuevo peak #7 semana 19",  type: "peak" },
  { msg: "JUNIOR H supera 9.8M oyentes mensuales",    type: "stream" },
  { msg: "XAVI estable en #8, sin movimiento",         type: "neutral" },
  { msg: "GABITO BALLESTEROS baja -2 esta semana",    type: "drop" },
  { msg: "MARCA REGISTRADA entra TOP 15 global",      type: "peak" },
  { msg: "EDEN MUÑOZ acumula 1.33M streams hoy",      type: "stream" },
];

const TOURING = [
  { rank: "01", artist: "Luis Miguel",    tour: "Tour 2023-24",        gross: "$318.2M" },
  { rank: "02", artist: "Peso Pluma",     tour: "Éxodo Tour",          gross: "$60.0M+" },
  { rank: "03", artist: "RBD",            tour: "Soy Rebelde Tour",    gross: "$54.4M" },
  { rank: "04", artist: "Grupo Firme",    tour: "Tour 2022",           gross: "$45.7M" },
  { rank: "05", artist: "Bad Bunny",      tour: "World's Hottest",     gross: "$41.9M" },
  { rank: "06", artist: "Grupo Frontera", tour: "No Se Va Tour",       gross: "$28.3M" },
];

const PLATFORMS = [
  { name: "SPOTIFY",     share: 48, streams: "32.4M" },
  { name: "YOUTUBE",     share: 28, streams: "18.2M" },
  { name: "APPLE MUSIC", share: 14, streams: "9.1M"  },
  { name: "DEEZER",      share: 10, streams: "6.5M"  },
];

const ASCENSO = [
  { artist: "Tito Double P",   pct: "+78%", streams: "1.98M" },
  { artist: "Oscar Maydon",    pct: "+65%", streams: "1.76M" },
  { artist: "Marca Registrada",pct: "+56%", streams: "1.62M" },
  { artist: "Clave Especial",  pct: "+49%", streams: "1.41M" },
  { artist: "Jasiel Nuñez",    pct: "+47%", streams: "1.19M" },
  { artist: "Tito Double P",   pct: "+38%", streams: "0.94M" },
];

const REPORTES = [
  {
    path: "/reportes/touring/peso-pluma-exodo-tour",
    tag: "[DESTACADO]",
    size: "4.2MB",
    date: "2024-05-14",
    desc: "Análisis completo: ciudades, ingresos, asistencia y alcance global del Éxodo Tour.",
    featured: true,
  },
  {
    path: "/reportes/touring/luis-miguel-tour-2023",
    tag: "",
    size: "3.1MB",
    date: "2024-05-10",
    desc: "El tour más lucrativo de la música mexicana — $318M en ingresos brutos.",
    featured: false,
  },
  {
    path: "/reportes/streaming/spotify-mexico-top100-2024",
    tag: "",
    size: "2.8MB",
    date: "2024-05-07",
    desc: "Ranking completo: oyentes mensuales, streams acumulados y crecimiento por artista.",
    featured: false,
  },
  {
    path: "/reportes/plataformas/youtube-top-mx-mayo",
    tag: "",
    size: "1.9MB",
    date: "2024-05-01",
    desc: "Los artistas mexicanos más vistos en YouTube — mayo 2024.",
    featured: false,
  },
];

function bar(pct: number, total = 20): string {
  const filled = Math.round((pct / 100) * total);
  return "█".repeat(filled) + "░".repeat(total - filled);
}

function trendColor(t: string) {
  if (t === "▲") return GREEN;
  if (t === "▼") return "#ef4444";
  return "#71717a";
}

export default function HomeV4() {
  const [feed, setFeed] = useState(INITIAL_FEED);
  const [openReport, setOpenReport] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const newItemIndex = useRef(0);

  // Live clock
  const [clock, setClock] = useState(() => {
    const n = new Date();
    return n.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  });

  useEffect(() => {
    const c = setInterval(() => {
      setClock(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(c);
  }, []);

  // Feed auto-inserts
  useEffect(() => {
    const t = setInterval(() => {
      const item = NEW_FEED_ITEMS[newItemIndex.current % NEW_FEED_ITEMS.length];
      newItemIndex.current += 1;
      const now = new Date();
      const time = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      setFeed(prev => [{ time, msg: item.msg, type: item.type }, ...prev.slice(0, 18)]);
      setTick(t => t + 1);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const mono = "'Space Mono', monospace";

  return (
    <div
      className="scanlines min-h-[100dvh] bg-[#020202] text-zinc-400 overflow-x-hidden selection:bg-[#39FF14] selection:text-black"
      style={{ fontFamily: mono }}
      data-testid="page-v4"
    >

      {/* ── VERSION BANNER ── */}
      <div
        className="border-b text-center py-1 text-[10px] uppercase tracking-widest flex items-center justify-center gap-4"
        style={{ borderColor: "rgba(57,255,20,0.12)", background: "#020202", fontFamily: mono }}
      >
        <Link href="/v1" className="hover:text-white transition-colors">V1</Link>
        <span style={{ color: "rgba(57,255,20,0.2)" }}>│</span>
        <Link href="/" className="hover:text-white transition-colors">V2</Link>
        <span style={{ color: "rgba(57,255,20,0.2)" }}>│</span>
        <Link href="/v3" className="hover:text-white transition-colors">V3</Link>
        <span style={{ color: "rgba(57,255,20,0.2)" }}>│</span>
        <span style={{ color: GREEN }}>V4 — TERMINAL</span>
      </div>

      {/* ── STATUS BAR ── */}
      <div
        className="sticky top-0 z-50 border-b"
        style={{ background: "#020202", borderColor: "rgba(57,255,20,0.15)" }}
        data-testid="navigation"
      >
        {/* Top row: live platform stats */}
        <div
          className="border-b px-4 py-1 flex items-center gap-6 overflow-x-auto"
          style={{ borderColor: "rgba(255,255,255,0.05)", fontSize: "10px" }}
        >
          <span className="text-zinc-600 flex-shrink-0">LIVE</span>
          <span className="flex-shrink-0 flex items-center gap-1">
            <SiSpotify className="w-3 h-3" style={{ color: "#1DB954" }} />
            <span className="text-zinc-500">SPOTIFY</span>
            <span className="font-bold ml-1" style={{ color: GREEN }}>32.4M</span>
            <span style={{ color: GREEN }}>▲</span>
          </span>
          <span className="flex-shrink-0 flex items-center gap-1">
            <SiYoutube className="w-3 h-3 text-red-500" />
            <span className="text-zinc-500">YOUTUBE</span>
            <span className="font-bold ml-1" style={{ color: GREEN }}>18.2M</span>
            <span style={{ color: GREEN }}>▲</span>
          </span>
          <span className="flex-shrink-0 flex items-center gap-1">
            <SiApple className="w-3 h-3 text-pink-400" />
            <span className="text-zinc-500">APPLE MUSIC</span>
            <span className="font-bold ml-1" style={{ color: GREEN }}>9.1M</span>
            <span style={{ color: GREEN }}>▲</span>
          </span>
          <span className="flex-shrink-0 flex items-center gap-1">
            <Music className="w-3 h-3 text-purple-400" />
            <span className="text-zinc-500">DEEZER</span>
            <span className="font-bold ml-1" style={{ color: GREEN }}>6.5M</span>
            <span style={{ color: GREEN }}>▲</span>
          </span>
          <div className="flex-1" />
          <span className="text-zinc-600 flex-shrink-0 tabular-nums">{clock}</span>
        </div>

        {/* Bottom row: logo + nav */}
        <div className="px-4 py-1.5 flex items-center justify-between gap-4">
          <Link href="/v4" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts" className="h-6 object-contain opacity-90" />
          </Link>
          <div className="flex items-center gap-4 text-[10px] text-zinc-600 uppercase tracking-widest">
            {["CHARTS","ARTISTAS","TOURING","STREAMING","REPORTES"].map(item => (
              <a key={item} href="#" className="hover:text-white transition-colors hidden md:block">{item}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a href="#" data-testid="link-social-ig" className="text-zinc-700 hover:text-white transition-colors"><SiInstagram className="w-3 h-3" /></a>
            <a href="#" data-testid="link-social-x"  className="text-zinc-700 hover:text-white transition-colors"><SiX className="w-3 h-3" /></a>
            <a href="#" data-testid="link-social-tk" className="text-zinc-700 hover:text-white transition-colors"><SiTiktok className="w-3 h-3" /></a>
            <a href="#" data-testid="link-social-yt" className="text-zinc-700 hover:text-white transition-colors"><SiYoutube className="w-3 h-3" /></a>
          </div>
        </div>
      </div>

      {/* ── COMMAND HEADER ── */}
      <div
        className="px-4 py-2 border-b text-[11px]"
        style={{ background: "#010101", borderColor: "rgba(57,255,20,0.1)" }}
        data-testid="command-header"
      >
        <span style={{ color: GREEN }}>{">"}</span>
        <span className="ml-2 text-zinc-500">MEXICO CHARTS INTELLIGENCE</span>
        <span className="mx-2 text-zinc-700">—</span>
        <span style={{ color: GREEN }}>SEMANA 19</span>
        <span className="mx-2 text-zinc-700">—</span>
        <span className="text-zinc-500">ACTUALIZADO:</span>
        <span className="ml-1 tabular-nums" style={{ color: GREEN }}>{clock}</span>
        <span className="cursor-blink" />
      </div>

      {/* ── MAIN DATA GRID ── */}
      <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }} data-testid="section-main-grid">

        {/* LEFT 65%: Ranking table */}
        <div className="flex-1 border-r overflow-x-auto" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {/* Table header */}
          <div
            className="px-3 py-1.5 border-b text-[9px] uppercase tracking-widest text-zinc-600 flex items-center justify-between"
            style={{ borderColor: "rgba(57,255,20,0.1)", background: "#010101" }}
          >
            <span>HOT 20 MÉXICO — SEMANA 19</span>
            <span style={{ color: GREEN }}>● EN VIVO</span>
          </div>

          <table className="w-full text-[11px] border-collapse" data-testid="ranking-table">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#010101" }}>
                {["RK","↕","ARTISTA","GÉNERO","STREAMS 7D","CAMBIO","PLAT."].map(h => (
                  <th key={h} className="px-3 py-1.5 text-left font-bold text-[9px] tracking-widest text-zinc-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOT_20.map((row, idx) => (
                <tr
                  key={row.rank}
                  className="terminal-row border-b"
                  style={{
                    borderColor: "rgba(255,255,255,0.03)",
                    background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  }}
                >
                  <td className="px-3 py-1.5 font-bold tabular-nums whitespace-nowrap">
                    <span className="rank-num text-zinc-500">{String(row.rank).padStart(2,"0")}</span>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums font-bold" style={{ color: trendColor(row.trend) }}>{row.trend}</td>
                  <td className="px-3 py-1.5 text-white font-bold whitespace-nowrap">{row.artist}</td>
                  <td className="px-3 py-1.5 text-zinc-600 whitespace-nowrap text-[10px]">{row.genre}</td>
                  <td className="px-3 py-1.5 tabular-nums font-bold whitespace-nowrap" style={{ color: GREEN }}>{row.streams}</td>
                  <td className="px-3 py-1.5 tabular-nums whitespace-nowrap" style={{ color: row.change.startsWith("+") ? GREEN : row.change.startsWith("-") ? "#ef4444" : "#71717a" }}>
                    {row.change}
                  </td>
                  <td className="px-3 py-1.5 text-zinc-700 text-[9px] whitespace-nowrap">{row.platforms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT 35%: Live feed */}
        <div className="w-[320px] flex-shrink-0 flex flex-col" style={{ maxHeight: "600px" }} data-testid="live-feed">
          <div
            className="px-3 py-1.5 border-b text-[9px] uppercase tracking-widest text-zinc-600 flex items-center gap-2"
            style={{ borderColor: "rgba(57,255,20,0.1)", background: "#010101" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-dot-pulse flex-shrink-0" style={{ background: GREEN, display: "inline-block" }} />
            FEED EN VIVO
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {feed.map((entry, idx) => (
              <div
                key={`${entry.time}-${idx}-${tick}`}
                className={`flex gap-3 px-3 py-1.5 border-b text-[10px] ${idx === 0 ? "feed-entry" : ""}`}
                style={{ borderColor: "rgba(255,255,255,0.03)" }}
              >
                <span className="text-zinc-700 tabular-nums flex-shrink-0">{entry.time}</span>
                <span style={{
                  color: entry.type === "peak" ? GREEN : entry.type === "drop" ? "#ef4444" : entry.type === "stream" ? "#a3e635" : "#71717a",
                  lineHeight: "1.4",
                }}>
                  {entry.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── METRICS STRIP ── */}
      <div
        className="border-b px-4 py-2 overflow-x-auto"
        style={{ borderColor: "rgba(57,255,20,0.1)", background: "#010101" }}
        data-testid="metrics-strip"
      >
        <div className="flex items-center gap-0 text-[10px] whitespace-nowrap min-w-max">
          {[
            { label: "STREAMS TOTALES",  val: "2.4B" },
            { label: "TOP GÉNERO",       val: "CORRIDOS TUMBADOS" },
            { label: "MAYOR MOVIMIENTO", val: "CLAVE ESPECIAL +6" },
            { label: "TOURING INGRESOS", val: "$318.2M" },
            { label: "ARTISTAS ACTIVOS", val: "250+" },
            { label: "PAÍSES",           val: "60+" },
          ].map((m, i, arr) => (
            <span key={m.label} className="flex items-center">
              <span className="text-zinc-600">{m.label}</span>
              <span className="mx-2 font-bold" style={{ color: GREEN }}>{m.val}</span>
              {i < arr.length - 1 && <span className="mr-2 text-zinc-800">│</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ── SECONDARY PANELS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }} data-testid="secondary-panels">

        {/* Panel A: Touring Revenue */}
        <div className="border-r" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="px-3 py-1.5 border-b text-[9px] uppercase tracking-widest text-zinc-600" style={{ borderColor: "rgba(57,255,20,0.1)", background: "#010101" }}>
            TOURING REVENUE — USD BRUTO
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <th className="px-3 py-1 text-left text-[9px] text-zinc-700">#</th>
                <th className="px-3 py-1 text-left text-[9px] text-zinc-700">ARTISTA</th>
                <th className="px-3 py-1 text-left text-[9px] text-zinc-700">TOUR</th>
                <th className="px-3 py-1 text-right text-[9px] text-zinc-700">GROSS</th>
              </tr>
            </thead>
            <tbody>
              {TOURING.map(t => (
                <tr key={t.rank} className="terminal-row border-b" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                  <td className="px-3 py-1.5 text-zinc-600 rank-num">{t.rank}</td>
                  <td className="px-3 py-1.5 text-white font-bold whitespace-nowrap">{t.artist}</td>
                  <td className="px-3 py-1.5 text-zinc-500 whitespace-nowrap">{t.tour}</td>
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums whitespace-nowrap" style={{ color: GREEN }}>{t.gross}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Panel B: Platform Breakdown */}
        <div className="border-r" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="px-3 py-1.5 border-b text-[9px] uppercase tracking-widest text-zinc-600" style={{ borderColor: "rgba(57,255,20,0.1)", background: "#010101" }}>
            PLATAFORMAS — DISTRIBUCIÓN DE STREAMS
          </div>
          <div className="px-3 py-3 flex flex-col gap-3">
            {PLATFORMS.map(p => (
              <div key={p.name}>
                <div className="flex justify-between text-[9px] mb-1">
                  <span className="text-zinc-500">{p.name}</span>
                  <span className="tabular-nums" style={{ color: GREEN }}>{p.streams}  {p.share}%</span>
                </div>
                <div className="text-[11px] tracking-[0.05em]" style={{ color: GREEN, letterSpacing: "0" }}>
                  <span style={{ color: GREEN }}>{bar(p.share)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 pb-3 text-[9px] text-zinc-700 border-t mt-1" style={{ borderColor: "rgba(255,255,255,0.04)", paddingTop: "8px" }}>
            █ = streams activos  ░ = capacidad restante
          </div>
        </div>

        {/* Panel C: Artistas en Ascenso */}
        <div>
          <div className="px-3 py-1.5 border-b text-[9px] uppercase tracking-widest text-zinc-600" style={{ borderColor: "rgba(57,255,20,0.1)", background: "#010101" }}>
            ARTISTAS EN ASCENSO — CRECIMIENTO MENSUAL
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <th className="px-3 py-1 text-left text-[9px] text-zinc-700">ARTISTA</th>
                <th className="px-3 py-1 text-right text-[9px] text-zinc-700">STREAMS</th>
                <th className="px-3 py-1 text-right text-[9px] text-zinc-700">CRECIM.</th>
              </tr>
            </thead>
            <tbody>
              {ASCENSO.map((a, i) => (
                <tr key={i} className="terminal-row border-b" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                  <td className="px-3 py-1.5 text-white font-bold whitespace-nowrap">{a.artist}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-500 tabular-nums">{a.streams}</td>
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums" style={{ color: GREEN }}>{a.pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── REPORTES TERMINAL ── */}
      <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }} data-testid="section-reportes">
        <div
          className="px-4 py-1.5 border-b text-[9px] uppercase tracking-widest text-zinc-600 flex items-center justify-between"
          style={{ borderColor: "rgba(57,255,20,0.1)", background: "#010101" }}
        >
          <span>ARCHIVO DE REPORTES — /reportes/</span>
          <span className="text-zinc-700">4 ARCHIVOS</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {REPORTES.map((r, i) => (
            <div
              key={i}
              className="border-r border-b p-3 cursor-pointer transition-all duration-150"
              style={{
                borderColor: openReport === i ? `rgba(57,255,20,0.3)` : "rgba(255,255,255,0.05)",
                background: openReport === i ? "rgba(57,255,20,0.04)" : "transparent",
              }}
              onClick={() => setOpenReport(openReport === i ? null : i)}
              data-testid={`reporte-card-${i}`}
            >
              {r.featured && (
                <div className="text-[9px] font-bold mb-1.5" style={{ color: GREEN }}>[DESTACADO]</div>
              )}
              {openReport === i && (
                <div className="text-[9px] font-bold mb-1.5" style={{ color: GREEN }}>[ABIERTO]</div>
              )}
              <div className="text-[10px] font-bold text-white mb-1 break-all leading-snug">{r.path}</div>
              <div className="flex gap-3 text-[9px] text-zinc-700 mb-2">
                <span>{r.size}</span>
                <span>{r.date}</span>
              </div>
              <div className="text-[10px] text-zinc-500 leading-relaxed">{r.desc}</div>
              <div className="mt-2 text-[9px]" style={{ color: openReport === i ? GREEN : "rgba(57,255,20,0.4)" }}>
                {openReport === i ? "CERRAR ↑" : "ABRIR →"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div
        className="px-4 py-2 flex items-center justify-between text-[9px] text-zinc-700 gap-4"
        style={{ background: "#010101" }}
        data-testid="footer"
      >
        <span>© 2024 MEXICO CHARTS — TODOS LOS DERECHOS RESERVADOS</span>
        <div className="flex items-center gap-3">
          <Link href="/v1" className="hover:text-zinc-400 transition-colors">V1</Link>
          <span>│</span>
          <Link href="/" className="hover:text-zinc-400 transition-colors">V2</Link>
          <span>│</span>
          <Link href="/v3" className="hover:text-zinc-400 transition-colors">V3</Link>
          <span>│</span>
          <span style={{ color: GREEN }}>V4</span>
          <span className="ml-4 text-zinc-800">v4.0.1-terminal</span>
        </div>
      </div>

    </div>
  );
}
