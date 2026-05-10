import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Trophy, TrendingUp, ArrowUpRight, CalendarDays, Layers,
  Globe, BarChart3, Headphones, Star,
  Music2, Radio, MapPin, Users, ExternalLink, Home, ChevronRight, Lock
} from "lucide-react";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const G = "#39FF14";

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className}
      initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

/* ── Decorative globe SVG ── */
function GlobeGraphic() {
  return (
    <svg viewBox="0 0 340 340" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <radialGradient id="gg" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#39FF14" stopOpacity="0.18" />
          <stop offset="60%" stopColor="#39FF14" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#39FF14" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="gc" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#39FF14" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#39FF14" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Outer glow */}
      <circle cx="170" cy="170" r="155" fill="url(#gg)" />
      {/* Globe outline */}
      <circle cx="170" cy="170" r="130" stroke="#39FF14" strokeWidth="0.6" strokeOpacity="0.25" />
      {/* Latitude lines */}
      {[-80,-55,-25,0,25,55,80].map((lat, i) => {
        const y = 170 + (lat / 90) * 130;
        const r2 = Math.sqrt(Math.max(0, 130 * 130 - (y - 170) * (y - 170)));
        return r2 > 0 ? <ellipse key={i} cx="170" cy={y} rx={r2} ry={r2 * 0.28} stroke="#39FF14" strokeWidth="0.5" strokeOpacity="0.18" /> : null;
      })}
      {/* Longitude lines */}
      {[0,30,60,90,120,150].map((lon, i) => (
        <ellipse key={i} cx="170" cy="170" rx={130 * Math.abs(Math.cos(lon * Math.PI / 180))} ry="130"
          stroke="#39FF14" strokeWidth="0.5" strokeOpacity="0.18"
          transform={`rotate(${lon} 170 170)`} />
      ))}
      {/* Mexico blob — rough silhouette */}
      <path d="M145 128 L165 124 L182 130 L190 138 L196 150 L192 160 L202 165 L208 175 L200 182 L190 178 L182 185 L175 195 L168 202 L162 195 L155 185 L148 175 L140 168 L132 162 L128 152 L132 142 Z"
        fill="#39FF14" fillOpacity="0.22" stroke="#39FF14" strokeWidth="0.8" strokeOpacity="0.55" />
      {/* Center glow on Mexico */}
      <circle cx="170" cy="162" r="22" fill="url(#gc)" />
      {/* Pulse dot */}
      <circle cx="170" cy="162" r="4" fill="#39FF14" fillOpacity="0.9" />
      <circle cx="170" cy="162" r="8" fill="#39FF14" fillOpacity="0.18" />
    </svg>
  );
}

const NAV_ITEMS = ["INICIO","ARTISTAS","CHARTS","GÉNEROS","INDUSTRIA","TOURING"] as const;

export default function IndustryLanding() {
  const [location] = useLocation();

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />

      {/* ════════════════════════════════════════════
          NAV — matches site nav
      ════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50"
        style={{ background: "rgba(8,8,8,0.95)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
        <div className="flex items-center justify-between px-6 lg:px-10 h-14">
          <Link href="/">
            <img src={logoUrl} alt="Mexico Charts" className="h-8 object-contain opacity-90 cursor-pointer" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7">
            {NAV_ITEMS.map(item => {
              const href = item === "ARTISTAS" ? "/artists" : item === "INDUSTRIA" ? "/industria" : item === "INICIO" ? "/" : "#";
              const active = item === "INDUSTRIA";
              return (
                <Link key={item} href={href}>
                  <span className="relative text-[11px] font-black uppercase tracking-[0.2em] cursor-pointer transition-colors"
                    style={{ color: active ? G : "rgba(255,255,255,0.38)" }}>
                    {item}
                    {active && (
                      <span className="absolute -bottom-[18px] left-0 right-0 h-[2px] rounded-full" style={{ background: G }} />
                    )}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Right badge */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ color: "rgba(255,255,255,0.25)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: G }} />
              En vivo
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
              MX
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════
          BREADCRUMB
      ════════════════════════════════════════════ */}
      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/">
          <span className="cursor-pointer transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
            <Home className="w-3 h-3" />
          </span>
        </Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.15)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.45)" }}>
          Industria
        </span>
      </div>

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <section className="relative px-6 lg:px-10 pt-12 pb-16 overflow-hidden">

        {/* Subtle green top-left glow */}
        <div className="absolute top-0 left-0 pointer-events-none"
          style={{ width: "45vw", height: "50vh", background: "radial-gradient(ellipse at 0% 0%, rgba(57,255,20,0.04) 0%, transparent 65%)", zIndex: 0 }} />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-center max-w-[1200px]">

          {/* LEFT — headline */}
          <div>
            <FadeUp>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] mb-5"
                style={{ color: G }}>
                Industria / Mercado
              </p>
            </FadeUp>

            <FadeUp delay={0.05}>
              <h1 className="font-black uppercase leading-[0.88] mb-6"
                style={{ fontSize: "clamp(2.2rem, 4.6vw, 4.8rem)", letterSpacing: "-0.03em" }}>
                México ya es<br />
                <em className="not-italic" style={{ color: G }}>Top 10</em> Global<br />
                en música grabada
              </h1>
            </FadeUp>

            <FadeUp delay={0.1}>
              <p className="text-sm leading-relaxed mb-7"
                style={{ color: "rgba(255,255,255,0.45)", maxWidth: 500, fontFamily: "system-ui" }}>
                México forma parte de los 10 mercados de música grabada más grandes del mundo. Según IFPI, en 2025 se mantuvo en el puesto #10 tras crecer 13.3% en ingresos de música grabada.
              </p>
            </FadeUp>

            <FadeUp delay={0.13}>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-[0.18em]"
                  style={{ color: "rgba(255,255,255,0.3)" }}>Fuentes:</span>
                <a href="https://www.ifpi.org/wp-content/uploads/2026/03/GMR2026_SOTI.pdf"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] transition-opacity hover:opacity-80"
                  style={{ color: G }}>
                  IFPI Global Music Report 2026
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                <a href="https://amprofon.com.mx/es/media/pdfs/Reporte_Musica_Mexico_(1).pdf"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] transition-opacity hover:opacity-80"
                  style={{ color: "rgba(255,255,255,0.4)" }}>
                  AMPROFON Reporte Música México
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </FadeUp>
          </div>

          {/* RIGHT — globe + badge */}
          <FadeUp delay={0.07} className="hidden lg:flex flex-col items-center gap-6">
            {/* Globe */}
            <div className="relative" style={{ width: 260, height: 260 }}>
              <GlobeGraphic />
            </div>

            {/* #10 badge */}
            <div className="rounded-xl px-7 py-5 text-center"
              style={{ background: "rgba(57,255,20,0.05)", border: "1px solid rgba(57,255,20,0.18)", boxShadow: "0 0 40px rgba(57,255,20,0.06)" }}>
              <div className="text-[9px] font-black uppercase tracking-[0.28em] mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                Ranking Global
              </div>
              <div className="font-black leading-none" style={{ fontSize: "3.5rem", color: G, letterSpacing: "-0.05em", textShadow: "0 0 40px rgba(57,255,20,0.3)" }}>
                #10
              </div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                México
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          STAT STRIP — 5 cards with icons
      ════════════════════════════════════════════ */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="grid grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Trophy,      v: "#10",     l: "Mercado global de\nmúsica grabada",     src: "IFPI 2026",  hi: true  },
            { icon: TrendingUp,  v: "+13.3%",  l: "Crecimiento de ingresos\nen 2025",       src: "IFPI 2026",  hi: false },
            { icon: ArrowUpRight,v: "#15→#10", l: "Avance global entre\n2022 y 2024",       src: "AMPROFON",   hi: false },
            { icon: CalendarDays,v: "10 años", l: "Crecimiento sostenido\nde la industria", src: "AMPROFON",   hi: false },
            { icon: Layers,      v: "2×",      l: "Ingresos duplicados\nen cinco años",     src: "AMPROFON",   hi: false },
          ].map(({ icon: Icon, v, l, src, hi }, i) => (
            <FadeUp key={i} delay={i * 0.04}>
              <div className="relative px-5 py-7"
                style={{
                  borderRight: i < 4 ? "1px solid rgba(255,255,255,0.07)" : "none",
                  background: hi ? "rgba(57,255,20,0.02)" : "transparent",
                }}>
                {hi && <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(57,255,20,0.045) 0%, transparent 70%)" }} />}
                <Icon className="w-4 h-4 mb-4 relative z-10" style={{ color: hi ? G : "rgba(255,255,255,0.25)" }} />
                <div className="font-black leading-none mb-2 relative z-10"
                  style={{ fontSize: "clamp(1.3rem, 2.2vw, 1.9rem)", letterSpacing: "-0.04em",
                    color: hi ? G : "#fff", textShadow: hi ? "0 0 20px rgba(57,255,20,0.2)" : "none" }}>
                  {v}
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.12em] leading-relaxed relative z-10 mb-2"
                  style={{ color: "rgba(255,255,255,0.28)", whiteSpace: "pre-line" }}>
                  {l}
                </div>
                <div className="text-[8px] font-black uppercase tracking-[0.16em]"
                  style={{ color: hi ? "rgba(57,255,20,0.4)" : "rgba(255,255,255,0.14)" }}>
                  {src}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          ¿QUÉ SIGNIFICA PARA MÉXICO?
      ════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 py-14">
        <FadeUp>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] mb-8"
            style={{ color: "rgba(255,255,255,0.25)" }}>
            ¿Qué Significa Para México? ////
          </p>
        </FadeUp>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Globe,      title: "Reconocimiento global",        body: "México ya forma parte de los mercados de música grabada más importantes del mundo." },
            { icon: BarChart3,  title: "Crecimiento sostenido",        body: "El mercado mexicano ha mantenido una década de expansión, impulsado principalmente por el consumo digital." },
            { icon: Headphones, title: "Streaming y suscripciones",    body: "El consumo musical en México ocurre principalmente en plataformas digitales, con fuerte preferencia por suscripciones de paga." },
            { icon: Star,       title: "Impacto cultural e industrial", body: "La música mexicana no solo tiene fuerza cultural: también está consolidando a México como un mercado de alto valor dentro de la industria global." },
          ].map(({ icon: Icon, title, body }, i) => (
            <FadeUp key={i} delay={i * 0.05}>
              <div className="relative overflow-hidden rounded-xl p-6 h-full"
                style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                  style={{ backgroundImage: NOISE, backgroundSize: "64px" }} />
                <Icon className="w-5 h-5 mb-5 relative z-10" style={{ color: "rgba(255,255,255,0.3)" }} />
                <h3 className="text-xs font-black uppercase tracking-tight text-white mb-3 relative z-10">{title}</h3>
                <p className="text-xs leading-relaxed relative z-10" style={{ color: "rgba(255,255,255,0.42)", fontFamily: "system-ui" }}>{body}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          QUOTE BLOCK
      ════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 pb-14">
        <FadeUp>
          <div className="relative overflow-hidden rounded-2xl px-10 py-10"
            style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
              style={{ backgroundImage: NOISE, backgroundSize: "96px" }} />
            {/* Large quote mark */}
            <div className="absolute top-4 left-8 font-black leading-none pointer-events-none select-none"
              style={{ fontSize: "8rem", color: G, opacity: 0.08, lineHeight: 1, fontFamily: "Georgia, serif" }}>"</div>
            <div className="relative z-10 max-w-3xl mx-auto text-center">
              <p className="font-black uppercase leading-tight"
                style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.9rem)", color: "#fff", letterSpacing: "-0.01em", fontStyle: "italic" }}>
                México ya no solo exporta cultura: ahora también figura entre los mercados musicales más importantes del planeta.
              </p>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ════════════════════════════════════════════
          FUENTES Y REPORTES
      ════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 pb-14" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <FadeUp>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] my-8"
            style={{ color: "rgba(255,255,255,0.25)" }}>
            Fuentes y Reportes ////
          </p>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* IFPI */}
          <FadeUp delay={0.04}>
            <div className="relative overflow-hidden rounded-xl flex h-full"
              style={{ background: "#0e0e0e", border: "1px solid rgba(57,255,20,0.12)" }}>
              {/* Left color block */}
              <div className="flex-shrink-0 w-28 flex flex-col items-center justify-center p-4 text-center"
                style={{ background: "rgba(57,255,20,0.06)", borderRight: "1px solid rgba(57,255,20,0.1)" }}>
                <div className="font-black uppercase leading-tight text-[10px] tracking-wide" style={{ color: G }}>
                  GLOBAL<br />MUSIC<br />REPORT
                </div>
                <div className="font-black text-white mt-2" style={{ fontSize: "1.4rem", letterSpacing: "-0.04em" }}>2026</div>
                <div className="text-[8px] font-black uppercase tracking-wide mt-2" style={{ color: "rgba(57,255,20,0.5)" }}>IFPI</div>
              </div>
              {/* Content */}
              <div className="flex-1 p-6">
                <div className="text-[8px] font-black uppercase tracking-[0.24em] mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Fuente: IFPI
                </div>
                <h3 className="text-sm font-black text-white mb-2">IFPI Global Music Report 2026</h3>
                <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.38)", fontFamily: "system-ui" }}>
                  Reporte anual que presenta el estado global de la industria de la música grabada, rankings de mercados, y crecimientos por país.
                </p>
                <a href="https://www.ifpi.org/wp-content/uploads/2026/03/GMR2026_SOTI.pdf"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-opacity hover:opacity-75"
                  style={{ color: G }}>
                  Ver Fuente <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </FadeUp>

          {/* AMPROFON */}
          <FadeUp delay={0.07}>
            <div className="relative overflow-hidden rounded-xl flex h-full"
              style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex-shrink-0 w-28 flex flex-col items-center justify-center p-4 text-center"
                style={{ background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="font-black uppercase leading-tight text-[9px] tracking-wide" style={{ color: "rgba(255,255,255,0.5)" }}>
                  REPORTE<br />MÚSICA<br />MÉXICO
                </div>
                <div className="font-black text-white mt-2" style={{ fontSize: "1.4rem", letterSpacing: "-0.04em" }}>2024</div>
                <div className="text-[8px] font-black uppercase tracking-wide mt-2" style={{ color: "rgba(255,255,255,0.22)" }}>AMPROFON</div>
              </div>
              <div className="flex-1 p-6">
                <div className="text-[8px] font-black uppercase tracking-[0.24em] mb-2" style={{ color: "rgba(255,255,255,0.22)" }}>
                  Fuente: AMPROFON
                </div>
                <h3 className="text-sm font-black text-white mb-2">AMPROFON Reporte Música México</h3>
                <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.38)", fontFamily: "system-ui" }}>
                  Análisis completo del mercado mexicano: música grabada, streaming, en vivo, consumo, retos, oportunidades y ecosistemas musicales por ciudad.
                </p>
                <a href="https://amprofon.com.mx/es/media/pdfs/Reporte_Musica_Mexico_(1).pdf"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] transition-opacity hover:opacity-75"
                  style={{ color: "rgba(255,255,255,0.4)" }}>
                  Ver Fuente <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </FadeUp>
        </div>

        {/* Insight article link */}
        <FadeUp delay={0.1} className="mt-4">
          <Link href="/insights/mexico-top-10-ifpi-2026">
            <div className="rounded-xl px-6 py-4 flex items-center justify-between cursor-pointer group transition-all"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.35)" }}>
                Leer análisis completo: México Top 10 IFPI 2026
              </span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" style={{ color: "rgba(255,255,255,0.25)" }} />
            </div>
          </Link>
        </FadeUp>
      </section>

      {/* ════════════════════════════════════════════
          EXPLORA MÁS
      ════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 pb-14" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <FadeUp>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] my-8"
            style={{ color: "rgba(255,255,255,0.25)" }}>
            Explora más sobre la Industria Musical en México
          </p>
        </FadeUp>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: Music2,   title: "Música Grabada",          sub: "Mercado, ingresos, crecimiento y rankings globales.", locked: false },
            { icon: Radio,    title: "Streaming",                sub: "Plataformas, consumo digital, suscripciones y tendencias.", locked: true },
            { icon: Layers,   title: "Música en Vivo",           sub: "Conciertos, touring, venues, ticketing y datos de la industria.", locked: true },
            { icon: Globe,    title: "Música Mexicana",          sub: "El crecimiento global del regional mexicano y nuevos géneros.", locked: true },
            { icon: MapPin,   title: "Ecosistemas por Ciudad",   sub: "CDMX, Guadalajara, Monterrey, Tijuana y más.", locked: true },
            { icon: Users,    title: "Artistas Independientes",  sub: "Retos, oportunidades, distribución, manager, sellos y más.", locked: true },
          ].map(({ icon: Icon, title, sub, locked }, i) => (
            <FadeUp key={i} delay={i * 0.03}>
              {locked ? (
                <div className="relative overflow-hidden rounded-xl p-6 h-full opacity-50"
                  style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-start justify-between mb-4">
                    <Icon className="w-5 h-5" style={{ color: "rgba(255,255,255,0.2)" }} />
                    <Lock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.15)" }} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-tight text-white mb-1">{title}</h3>
                  <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.28)", fontFamily: "system-ui" }}>{sub}</p>
                </div>
              ) : (
                <Link href="/insights/mexico-top-10-ifpi-2026">
                  <div className="relative overflow-hidden rounded-xl p-6 h-full cursor-pointer group transition-all"
                    style={{ background: "#0e0e0e", border: "1px solid rgba(57,255,20,0.1)" }}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: "rgba(57,255,20,0.02)" }} />
                    <div className="flex items-start justify-between mb-4">
                      <Icon className="w-5 h-5" style={{ color: G, opacity: 0.7 }} />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>
                        Ver más →
                      </span>
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-tight text-white mb-1">{title}</h3>
                    <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.38)", fontFamily: "system-ui" }}>{sub}</p>
                  </div>
                </Link>
              )}
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          METHODOLOGY
      ════════════════════════════════════════════ */}
      <div className="px-6 lg:px-10 py-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#060606" }}>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "system-ui", maxWidth: 760 }}>
          <span className="font-black uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.25)" }}>ℹ</span>{" "}
          Mexico Charts resume datos públicos de reportes de la industria como IFPI y AMPROFON. No reproducimos gráficos, tablas ni elementos visuales protegidos de los reportes originales. Las cifras se presentan con atribución a sus fuentes correspondientes. Esta clasificación se refiere al mercado de{" "}
          <strong style={{ color: "rgba(255,255,255,0.3)" }}>música grabada</strong> (streaming + descargas + físico), no a rankings de plataformas ni a revenue de conciertos.
        </p>
      </div>

      {/* Footer */}
      <footer className="px-6 lg:px-10 py-6 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/"><img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-35 cursor-pointer hover:opacity-55 transition-opacity" /></Link>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.15)" }}>© 2026 Mexico Charts</p>
      </footer>
    </div>
  );
}
