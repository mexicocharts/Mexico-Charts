import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Trophy, TrendingUp, ArrowUpRight, CalendarDays, Layers,
  Globe, BarChart3, Headphones, Star,
  Music2, Radio, MapPin, Users, ExternalLink, Home, ChevronRight, Lock
} from "lucide-react";

const logoUrl      = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const ifpiCover    = `${import.meta.env.BASE_URL}ifpi-cover.jpg`;
const amprofonCover= `${import.meta.env.BASE_URL}amprofon-cover.png`;
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

/* ═══════════════════════════════════════════════════════
   GLOBE SVG — detailed, dramatic, Mexico highlighted
═══════════════════════════════════════════════════════ */
function DramaticGlobe() {
  // Other top markets for connection lines: rough lat/lon mapped to SVG
  // Globe center = (200,200), radius = 175
  const R = 175;
  const cx = 200, cy = 200;

  // Mexico ~ 23°N 102°W → on a front-facing globe (0° lon center)
  // x = cx + R * cos(lat) * sin(-lon)  — we center on ~100°W so Mexico is near center
  // Simplified: Mexico center on globe face
  const mexico = { x: 200, y: 165 }; // slightly above center-left

  // Other market dots (approximate positions on globe face)
  const markets = [
    { x: 170, y: 130, label: "US" },     // north america
    { x: 285, y: 120, label: "UK" },     // europe
    { x: 295, y: 115, label: "DE" },     // germany
    { x: 330, y: 165, label: "JP" },     // asia-right
    { x: 310, y: 180, label: "KR" },     // korea
    { x: 270, y: 195, label: "AU" },     // lower right
    { x: 150, y: 210, label: "BR" },     // brazil
    { x: 280, y: 130, label: "FR" },     // france
  ];

  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <defs>
        <radialGradient id="globeGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%"   stopColor="#39FF14" stopOpacity="0.35" />
          <stop offset="55%"  stopColor="#39FF14" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#39FF14" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mexicoGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#39FF14" stopOpacity="1" />
          <stop offset="45%"  stopColor="#39FF14" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#39FF14" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sphereShade" cx="35%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#1a1a1a" stopOpacity="0" />
          <stop offset="70%"  stopColor="#000"    stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000"    stopOpacity="0.5" />
        </radialGradient>
        <clipPath id="globeClip">
          <circle cx={cx} cy={cy} r={R} />
        </clipPath>
        <filter id="mexBlur">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id="dotGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Outer atmosphere glow */}
      <circle cx={cx} cy={cy} r={R + 28} fill="url(#globeGlow)" />

      {/* Globe base — dark sphere */}
      <circle cx={cx} cy={cy} r={R} fill="#0a0f0a" stroke="#39FF14" strokeWidth="0.5" strokeOpacity="0.2" />

      {/* Grid lines inside globe */}
      <g clipPath="url(#globeClip)" opacity="0.45">
        {/* Latitude lines */}
        {[-60,-40,-20,0,20,40,60].map((lat, i) => {
          const y = cy + (lat / 90) * R;
          const rx = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy)));
          return rx > 0 ? (
            <ellipse key={`lat${i}`} cx={cx} cy={y} rx={rx} ry={rx * 0.3}
              stroke="#39FF14" strokeWidth="0.6" fill="none" />
          ) : null;
        })}
        {/* Longitude lines */}
        {[0,20,40,60,80,100,120,140,160].map((lon, i) => (
          <ellipse key={`lon${i}`} cx={cx} cy={cy}
            rx={R * Math.abs(Math.cos((lon * Math.PI) / 180))} ry={R}
            stroke="#39FF14" strokeWidth="0.6" fill="none"
            transform={`rotate(${lon} ${cx} ${cy})`} />
        ))}
      </g>

      {/* Mexico green glow blob */}
      <circle cx={mexico.x} cy={mexico.y} r={30} fill="#39FF14" fillOpacity="0.08" filter="url(#mexBlur)" />

      {/* Mexico territory shape */}
      <path clipPath="url(#globeClip)"
        d="M182 148 L194 144 L208 149 L216 158 L220 167 L215 175 L222 181 L226 190 L218 197 L208 193 L200 200 L193 208 L186 200 L178 190 L170 183 L163 174 L159 164 L163 155 Z"
        fill="#39FF14" fillOpacity="0.55" stroke="#39FF14" strokeWidth="1.5" strokeOpacity="1" />

      {/* Mexico glow */}
      <ellipse cx={mexico.x} cy={mexico.y} rx={38} ry={26} fill="url(#mexicoGlow)" opacity="0.85" />

      {/* Connection lines from Mexico to other markets */}
      {markets.map((m, i) => (
        <motion.line key={i}
          x1={mexico.x} y1={mexico.y} x2={m.x} y2={m.y}
          stroke="#39FF14" strokeWidth="0.6" strokeOpacity="0.25"
          strokeDasharray="3 5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.4 + i * 0.1, ease: "easeOut" }}
        />
      ))}

      {/* Market dots */}
      {markets.map((m, i) => (
        <g key={`dot${i}`} filter="url(#dotGlow)">
          <circle cx={m.x} cy={m.y} r={3} fill="#39FF14" fillOpacity="0.35" />
          <circle cx={m.x} cy={m.y} r={1.5} fill="#39FF14" fillOpacity="0.7" />
        </g>
      ))}

      {/* Sphere shading overlay */}
      <circle cx={cx} cy={cy} r={R} fill="url(#sphereShade)" />

      {/* Mexico pulse — use foreignObject trick avoided; use g+scale */}
      <motion.g style={{ originX: `${mexico.x}px`, originY: `${mexico.y}px` }}
        animate={{ scale: [1, 2.4, 1], opacity: [0.75, 0, 0.75] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}>
        <circle cx={mexico.x} cy={mexico.y} r={6} fill="none" stroke="#39FF14" strokeWidth="1.2" />
      </motion.g>
      <circle cx={mexico.x} cy={mexico.y} r={4} fill="#39FF14" filter="url(#dotGlow)" />

      {/* MX label */}
      <text x={mexico.x + 8} y={mexico.y - 10}
        fill="#39FF14" fontSize="9" fontWeight="900" fontFamily="system-ui" letterSpacing="0.08em" opacity="0.9">
        MX
      </text>
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

      {/* ════════ NAV ════════ */}
      <header className="sticky top-0 z-50"
        style={{ background: "rgba(8,8,8,0.95)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
        <div className="flex items-center justify-between px-6 lg:px-10 h-14">
          <Link href="/"><img src={logoUrl} alt="Mexico Charts" className="h-8 object-contain opacity-90 cursor-pointer" /></Link>
          <nav className="hidden lg:flex items-center gap-7">
            {NAV_ITEMS.map(item => {
              const href = item === "ARTISTAS" ? "/artists" : item === "INDUSTRIA" ? "/industria" : item === "INICIO" ? "/" : "#";
              const active = item === "INDUSTRIA";
              return (
                <Link key={item} href={href}>
                  <span className="relative text-[11px] font-black uppercase tracking-[0.2em] cursor-pointer transition-colors"
                    style={{ color: active ? G : "rgba(255,255,255,0.42)" }}>
                    {item}
                    {active && <span className="absolute -bottom-[18px] left-0 right-0 h-[2px] rounded-full" style={{ background: G }} />}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.28)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: G }} />En vivo
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>MX</div>
          </div>
        </div>
      </header>

      {/* ════════ BREADCRUMB ════════ */}
      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.15)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>Industria</span>
      </div>

      {/* ════════════════════════════════════════════
          HERO — globe always-visible, absolute right
      ════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: 420 }}>

        {/* Globe — always visible, absolutely pinned to right */}
        <motion.div
          className="absolute pointer-events-none"
          style={{ right: "-4vw", top: "50%", transform: "translateY(-50%)", width: "min(55vw, 520px)", height: "min(55vw, 520px)", zIndex: 1 }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}>
          <DramaticGlobe />
        </motion.div>

        {/* Left-edge green glow */}
        <div className="absolute top-0 left-0 pointer-events-none"
          style={{ width: "35vw", height: "100%", background: "radial-gradient(ellipse at 0% 50%, rgba(57,255,20,0.06) 0%, transparent 65%)", zIndex: 0 }} />

        {/* Content — sits above globe with dark shadow so it's legible */}
        <div className="relative z-10 px-6 lg:px-10 pt-12 pb-10" style={{ maxWidth: 620 }}>
          <FadeUp>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] mb-5" style={{ color: G }}>Industria / Mercado</p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h1 className="font-black uppercase leading-[0.9] mb-6"
              style={{ fontSize: "clamp(2rem, 3.6vw, 4rem)", letterSpacing: "-0.03em" }}>
              México ya es<br />
              <em className="not-italic" style={{ color: G }}>Top 10</em><br />
              Global en<br />
              música grabada
            </h1>
          </FadeUp>
          <FadeUp delay={0.09}>
            <p className="text-sm leading-relaxed mb-7" style={{ color: "rgba(255,255,255,0.75)", maxWidth: 480, fontFamily: "system-ui" }}>
              México forma parte de los 10 mercados de música grabada más grandes del mundo. Según IFPI, en 2025 se mantuvo en el puesto{" "}
              <strong style={{ color: "#fff" }}>#10</strong> tras crecer{" "}
              <strong style={{ color: G }}>13.3%</strong> en ingresos de música grabada.
            </p>
          </FadeUp>
          <FadeUp delay={0.12}>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.4)" }}>Fuentes:</span>
              <a href="https://www.ifpi.org/wp-content/uploads/2026/03/GMR2026_SOTI.pdf" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] hover:opacity-80 transition-opacity" style={{ color: G }}>
                IFPI Global Music Report 2026 <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
              <a href="https://amprofon.com.mx/es/media/pdfs/Reporte_Musica_Mexico_(1).pdf" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] hover:opacity-80 transition-opacity" style={{ color: "rgba(255,255,255,0.55)" }}>
                AMPROFON Reporte Música México <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </FadeUp>
        </div>

        {/* #10 badge — anchored bottom-right of section, always visible */}
        <motion.div
          className="absolute z-10"
          style={{ right: "5vw", bottom: 24 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}>
          <div className="rounded-xl px-6 py-4 text-center"
            style={{ background: "rgba(8,8,8,0.82)", backdropFilter: "blur(12px)", border: "1px solid rgba(57,255,20,0.28)", boxShadow: "0 0 40px rgba(57,255,20,0.12)" }}>
            <div className="text-[8px] font-black uppercase tracking-[0.28em] mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>Ranking Global</div>
            <div className="font-black leading-none" style={{ fontSize: "2.8rem", color: G, letterSpacing: "-0.05em", textShadow: "0 0 30px rgba(57,255,20,0.45)" }}>#10</div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>México</div>
          </div>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════
          STAT STRIP
      ════════════════════════════════════════════ */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="grid grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Trophy,       v: "#10",     l: "Mercado global de\nmúsica grabada",     src: "IFPI 2026",  hi: true  },
            { icon: TrendingUp,   v: "+13.3%",  l: "Crecimiento de ingresos\nen 2025",       src: "IFPI 2026",  hi: false },
            { icon: ArrowUpRight, v: "#15→#10", l: "Avance global entre\n2022 y 2024",       src: "AMPROFON",   hi: false },
            { icon: CalendarDays, v: "10 años", l: "Crecimiento sostenido\nde la industria", src: "AMPROFON",   hi: false },
            { icon: Layers,       v: "2×",      l: "Ingresos duplicados\nen cinco años",     src: "AMPROFON",   hi: false },
          ].map(({ icon: Icon, v, l, src, hi }, i) => (
            <FadeUp key={i} delay={i * 0.04}>
              <div className="relative px-5 py-7"
                style={{ borderRight: i < 4 ? "1px solid rgba(255,255,255,0.07)" : "none", background: hi ? "rgba(57,255,20,0.022)" : "transparent" }}>
                {hi && <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(57,255,20,0.05) 0%, transparent 70%)" }} />}
                <Icon className="w-4 h-4 mb-4 relative z-10" style={{ color: hi ? G : "rgba(255,255,255,0.35)" }} />
                <div className="font-black leading-none mb-2 relative z-10"
                  style={{ fontSize: "clamp(1.3rem, 2.2vw, 1.9rem)", letterSpacing: "-0.04em", color: hi ? G : "#fff", textShadow: hi ? "0 0 20px rgba(57,255,20,0.2)" : "none" }}>
                  {v}
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.12em] leading-relaxed relative z-10 mb-2"
                  style={{ color: "rgba(255,255,255,0.55)", whiteSpace: "pre-line" }}>
                  {l}
                </div>
                <div className="text-[8px] font-black uppercase tracking-[0.16em]"
                  style={{ color: hi ? "rgba(57,255,20,0.45)" : "rgba(255,255,255,0.22)" }}>
                  {src}
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          ¿QUÉ SIGNIFICA PARA MÉXICO?
      ════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 py-14">
        <FadeUp>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] mb-8" style={{ color: "rgba(255,255,255,0.35)" }}>
            ¿Qué Significa Para México? ////
          </p>
        </FadeUp>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Globe,      title: "Reconocimiento global",        body: "México ya forma parte de los mercados de música grabada más importantes del mundo." },
            { icon: BarChart3,  title: "Crecimiento sostenido",        body: "El mercado mexicano ha mantenido una década de expansión, impulsado principalmente por el consumo digital." },
            { icon: Headphones, title: "Streaming y suscripciones",    body: "El consumo musical en México ocurre principalmente en plataformas digitales, con fuerte preferencia por suscripciones de paga." },
            { icon: Star,       title: "Impacto cultural e industrial", body: "La música mexicana no solo tiene fuerza cultural: también consolida a México como un mercado de alto valor dentro de la industria global." },
          ].map(({ icon: Icon, title, body }, i) => (
            <FadeUp key={i} delay={i * 0.05}>
              <div className="relative overflow-hidden rounded-xl p-6 h-full"
                style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: "64px" }} />
                <Icon className="w-5 h-5 mb-5 relative z-10" style={{ color: "rgba(255,255,255,0.45)" }} />
                <h3 className="text-xs font-black uppercase tracking-tight text-white mb-3 relative z-10">{title}</h3>
                <p className="text-xs leading-relaxed relative z-10" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "system-ui" }}>{body}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          QUOTE
      ════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 pb-14">
        <FadeUp>
          <div className="relative overflow-hidden rounded-2xl px-10 py-10"
            style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: "96px" }} />
            <div className="absolute top-2 left-7 font-black leading-none pointer-events-none select-none"
              style={{ fontSize: "7rem", color: G, opacity: 0.07, lineHeight: 1, fontFamily: "Georgia, serif" }}>"</div>
            <p className="relative z-10 font-black uppercase leading-tight text-center max-w-3xl mx-auto"
              style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.9rem)", color: "#fff", letterSpacing: "-0.01em", fontStyle: "italic" }}>
              México ya no solo exporta cultura: ahora también figura entre los mercados musicales más importantes del planeta.
            </p>
          </div>
        </FadeUp>
      </section>

      {/* ════════════════════════════════════════════
          FUENTES — full cover images
      ════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 pb-14" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <FadeUp>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] my-8" style={{ color: "rgba(255,255,255,0.35)" }}>
            Fuentes y Reportes ////
          </p>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* IFPI */}
          <FadeUp delay={0.04}>
            <div className="relative overflow-hidden rounded-2xl flex flex-col"
              style={{ background: "#0e0e0e", border: "1px solid rgba(57,255,20,0.14)", boxShadow: "0 0 40px rgba(57,255,20,0.04)" }}>
              {/* Cover image — full width top */}
              <div className="relative overflow-hidden" style={{ height: 280 }}>
                <img src={ifpiCover} alt="IFPI Global Music Report 2026" className="w-full h-full object-cover object-top" />
                {/* Gradient overlay at bottom */}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(14,14,14,0) 40%, rgba(14,14,14,1) 100%)" }} />
                {/* Badge */}
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]"
                  style={{ background: "rgba(57,255,20,0.9)", color: "#000" }}>IFPI 2026</div>
              </div>
              {/* Content */}
              <div className="px-7 pb-7 -mt-2 relative z-10">
                <h3 className="text-base font-black text-white mb-2">IFPI Global Music Report 2026</h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "system-ui" }}>
                  Reporte anual que presenta el estado global de la industria de la música grabada, rankings de mercados, y crecimientos por país.
                </p>
                <div className="flex items-center gap-5">
                  <a href="https://www.ifpi.org/wp-content/uploads/2026/03/GMR2026_SOTI.pdf" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-80 transition-opacity" style={{ color: G }}>
                    Ver Fuente <ExternalLink className="w-3 h-3" />
                  </a>
                  <Link href="/insights/mexico-top-10-ifpi-2026">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] cursor-pointer hover:opacity-80 transition-opacity" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Leer análisis →
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </FadeUp>

          {/* AMPROFON */}
          <FadeUp delay={0.07}>
            <div className="relative overflow-hidden rounded-2xl flex flex-col"
              style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.09)" }}>
              <div className="relative overflow-hidden" style={{ height: 280 }}>
                <img src={amprofonCover} alt="AMPROFON Reporte Música México" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(14,14,14,0) 40%, rgba(14,14,14,1) 100%)" }} />
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]"
                  style={{ background: "rgba(255,255,255,0.9)", color: "#000" }}>AMPROFON 2025</div>
              </div>
              <div className="px-7 pb-7 -mt-2 relative z-10">
                <h3 className="text-base font-black text-white mb-2">AMPROFON — Estado de la Industria 2025</h3>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "system-ui" }}>
                  Análisis completo del mercado mexicano: música grabada, streaming, en vivo, consumo, retos, oportunidades y ecosistemas por ciudad.
                </p>
                <a href="https://amprofon.com.mx/es/media/pdfs/Reporte_Musica_Mexico_(1).pdf" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-80 transition-opacity" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Ver Fuente <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </FadeUp>
        </div>

        <FadeUp delay={0.1} className="mt-4">
          <Link href="/insights/mexico-top-10-ifpi-2026">
            <div className="rounded-xl px-6 py-4 flex items-center justify-between cursor-pointer group transition-all hover:border-white/10"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.5)" }}>
                Leer análisis completo: México Top 10 IFPI 2026
              </span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" style={{ color: "rgba(255,255,255,0.3)" }} />
            </div>
          </Link>
        </FadeUp>
      </section>

      {/* ════════════════════════════════════════════
          EXPLORA MÁS
      ════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 pb-14" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <FadeUp>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] my-8" style={{ color: "rgba(255,255,255,0.35)" }}>
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
            { icon: Users,    title: "Artistas Independientes",  sub: "Retos, oportunidades, distribución, sellos y más.", locked: true },
          ].map(({ icon: Icon, title, sub, locked }, i) => (
            <FadeUp key={i} delay={i * 0.03}>
              {locked ? (
                <div className="relative overflow-hidden rounded-xl p-6 h-full opacity-45"
                  style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-start justify-between mb-4">
                    <Icon className="w-5 h-5" style={{ color: "rgba(255,255,255,0.22)" }} />
                    <Lock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.18)" }} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-tight text-white mb-1">{title}</h3>
                  <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "system-ui" }}>{sub}</p>
                </div>
              ) : (
                <Link href="/insights/mexico-top-10-ifpi-2026">
                  <div className="relative overflow-hidden rounded-xl p-6 h-full cursor-pointer group transition-colors"
                    style={{ background: "#0e0e0e", border: "1px solid rgba(57,255,20,0.12)" }}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: "rgba(57,255,20,0.025)" }} />
                    <div className="flex items-start justify-between mb-4">
                      <Icon className="w-5 h-5" style={{ color: G, opacity: 0.7 }} />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>Ver más →</span>
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-tight text-white mb-1">{title}</h3>
                    <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui" }}>{sub}</p>
                  </div>
                </Link>
              )}
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ════════ METHODOLOGY ════════ */}
      <div className="px-6 lg:px-10 py-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#060606" }}>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.32)", fontFamily: "system-ui", maxWidth: 760 }}>
          <strong style={{ color: "rgba(255,255,255,0.45)" }}>ℹ</strong>{" "}
          Mexico Charts resume datos públicos de reportes de la industria como IFPI y AMPROFON. No reproducimos gráficos, tablas ni elementos visuales protegidos. Las cifras se presentan con atribución a sus fuentes. Esta clasificación se refiere al mercado de{" "}
          <strong style={{ color: "rgba(255,255,255,0.5)" }}>música grabada</strong> (streaming + descargas + físico), no a rankings de plataformas ni a revenue de conciertos.
        </p>
      </div>

      <footer className="px-6 lg:px-10 py-6 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/"><img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-35 cursor-pointer hover:opacity-55 transition-opacity" /></Link>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.18)" }}>© 2026 Mexico Charts</p>
      </footer>
    </div>
  );
}
