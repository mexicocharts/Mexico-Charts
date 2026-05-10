import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Trophy, TrendingUp, ArrowUpRight, CalendarDays, Layers,
  Globe, BarChart3, Headphones, Star, Music2, Radio,
  MapPin, Users, ExternalLink, Home, ChevronRight, Lock, Smartphone
} from "lucide-react";

const logoUrl       = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const ifpiCover     = `${import.meta.env.BASE_URL}ifpi-cover.jpg`;
const amprofonCover = `${import.meta.env.BASE_URL}amprofon-cover.png`;
const globeImg      = `${import.meta.env.BASE_URL}globe-mexico.png`;
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


const NAV_ITEMS = ["INICIO","ARTISTAS","CHARTS","GÉNEROS","INDUSTRIA","TOURING"] as const;

/* Horizontal bar component */
function DataBar({ pct, color = G, delay = 0 }: { pct: number; color?: string; delay?: number }) {
  return (
    <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
      <motion.div className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }} whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }} />
    </div>
  );
}

export default function IndustryLanding() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />

      {/* ── NAV ── */}
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

      {/* ── BREADCRUMB ── */}
      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.15)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>Industria</span>
      </div>

      {/* ══════════════════════════════════════════════════
          HERO — Globe always visible, absolutely positioned
      ══════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ minHeight: 440 }}>
        <motion.div className="absolute pointer-events-none"
          style={{ right: "-6vw", top: "-8%", width: "min(62vw, 580px)", height: "min(62vw, 580px)", zIndex: 1 }}
          initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}>
          <img src={globeImg} alt="Globo terráqueo con México destacado" className="w-full h-full object-contain"
            style={{ mixBlendMode: "screen" }} />
        </motion.div>

        <div className="absolute top-0 left-0 pointer-events-none"
          style={{ width: "38vw", height: "100%", background: "radial-gradient(ellipse at 0% 50%, rgba(57,255,20,0.055) 0%, transparent 65%)", zIndex: 0 }} />

        <div className="relative z-10 px-6 lg:px-10 pt-12 pb-10" style={{ maxWidth: 590 }}>
          <FadeUp>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] mb-5" style={{ color: G }}>Industria / Mercado</p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h1 className="font-black uppercase leading-[0.9] mb-6"
              style={{ fontSize: "clamp(2.2rem, 3.8vw, 4.2rem)", letterSpacing: "-0.03em" }}>
              México ya es<br />
              <em className="not-italic" style={{ color: G }}>Top 10</em><br />
              global en<br />música grabada
            </h1>
          </FadeUp>
          <FadeUp delay={0.09}>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.72)", maxWidth: 460, fontFamily: "system-ui" }}>
              México pasó del <strong style={{ color: "#fff" }}>#15 al #10</strong> en el ranking global de mercados de música grabada de la IFPI entre 2022 y 2024, con un crecimiento del{" "}
              <strong style={{ color: G }}>13.3%</strong> en 2025. Décimo año consecutivo de expansión.
            </p>
          </FadeUp>
          <FadeUp delay={0.12}>
            <div className="flex flex-wrap gap-3">
              <a href="https://www.ifpi.org/wp-content/uploads/2026/03/GMR2026_SOTI.pdf" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] hover:opacity-80 transition-opacity" style={{ color: G }}>
                IFPI Global Music Report 2026 <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <span style={{ color: "rgba(255,255,255,0.12)" }}>·</span>
              <a href="https://amprofon.com.mx/es/media/pdfs/Reporte_Musica_Mexico_(1).pdf" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.16em] hover:opacity-80 transition-opacity" style={{ color: "rgba(255,255,255,0.5)" }}>
                AMPROFON Reporte Música México <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </FadeUp>
        </div>

        {/* Badge */}
        <motion.div className="absolute z-10" style={{ right: "5vw", bottom: 24 }}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}>
          <div className="rounded-xl px-6 py-4 text-center"
            style={{ background: "rgba(8,8,8,0.85)", backdropFilter: "blur(12px)", border: "1px solid rgba(57,255,20,0.3)", boxShadow: "0 0 40px rgba(57,255,20,0.12)" }}>
            <div className="text-[8px] font-black uppercase tracking-[0.28em] mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>Ranking Global</div>
            <div className="font-black leading-none" style={{ fontSize: "2.8rem", color: G, letterSpacing: "-0.05em", textShadow: `0 0 30px ${G}60` }}>#10</div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>México · 2024</div>
          </div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════
          STAT STRIP
      ══════════════════════════════════════════════════ */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="grid grid-cols-2 lg:grid-cols-5">
          {[
            { icon: Trophy,       v: "#10",     l: "Mercado global\nmúsica grabada",      src: "IFPI 2026",  hi: true  },
            { icon: TrendingUp,   v: "+13.3%",  l: "Crecimiento de\ningresos en 2025",    src: "IFPI",       hi: false },
            { icon: ArrowUpRight, v: "#15→#10", l: "Avance global\n2022 a 2024",          src: "AMPROFON",   hi: false },
            { icon: CalendarDays, v: "10 años", l: "Crecimiento\nsostenido",              src: "AMPROFON",   hi: false },
            { icon: Layers,       v: "2×",      l: "Ingresos duplicados\nen cinco años",  src: "AMPROFON",   hi: false },
          ].map(({ icon: Icon, v, l, src, hi }, i) => (
            <FadeUp key={i} delay={i * 0.04}>
              <div className="relative px-5 py-7"
                style={{ borderRight: i < 4 ? "1px solid rgba(255,255,255,0.07)" : "none", background: hi ? "rgba(57,255,20,0.022)" : "transparent" }}>
                {hi && <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(57,255,20,0.05) 0%, transparent 70%)" }} />}
                <Icon className="w-4 h-4 mb-4 relative z-10" style={{ color: hi ? G : "rgba(255,255,255,0.35)" }} />
                <div className="font-black leading-none mb-2 relative z-10"
                  style={{ fontSize: "clamp(1.3rem, 2.2vw, 1.9rem)", letterSpacing: "-0.04em", color: hi ? G : "#fff", textShadow: hi ? `0 0 20px ${G}55` : "none" }}>{v}</div>
                <div className="text-[9px] font-black uppercase tracking-[0.12em] leading-relaxed relative z-10 mb-2"
                  style={{ color: "rgba(255,255,255,0.55)", whiteSpace: "pre-line" }}>{l}</div>
                <div className="text-[8px] font-black uppercase tracking-[0.16em]"
                  style={{ color: hi ? "rgba(57,255,20,0.45)" : "rgba(255,255,255,0.22)" }}>{src}</div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RANKING PROGRESSION + CONTEXT
      ══════════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 py-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Timeline card */}
          <FadeUp>
            <div className="relative overflow-hidden rounded-2xl p-7 h-full"
              style={{ background: "#0e0e0e", border: "1px solid rgba(57,255,20,0.12)" }}>
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: "64px" }} />
              <p className="text-[10px] font-black uppercase tracking-[0.28em] mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>
                Ascenso en el Ranking Global IFPI
              </p>
              <div className="flex items-end gap-0 mb-4">
                {[
                  { year: "2022", rank: 15, h: 28 },
                  { year: "2023", rank: 12, h: 50 },
                  { year: "2024", rank: 10, h: 75 },
                  { year: "2025", rank: 10, h: 75, cur: true },
                ].map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-[9px] font-black" style={{ color: d.cur ? G : "rgba(255,255,255,0.55)" }}>#{d.rank}</div>
                    <motion.div className="w-full rounded-t-lg mx-1"
                      style={{ background: d.cur ? G : "rgba(57,255,20,0.22)", minHeight: 8 }}
                      initial={{ height: 0 }} whileInView={{ height: `${d.h}px` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.7, delay: i * 0.1, ease: [0.16,1,0.3,1] }} />
                    <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>{d.year}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui" }}>
                México avanzó <strong style={{ color: "#fff" }}>5 posiciones</strong> en el ranking global de música grabada entre 2022 y 2024, el mayor ascenso de la región.
              </p>
              <div className="mt-4 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(57,255,20,0.45)" }}>Fuente: IFPI · AMPROFON</div>
            </div>
          </FadeUp>

          {/* Context cards stacked */}
          <div className="flex flex-col gap-4">
            {/* North America context */}
            <FadeUp delay={0.06}>
              <div className="relative overflow-hidden rounded-2xl p-6"
                style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: "64px" }} />
                <p className="text-[10px] font-black uppercase tracking-[0.28em] mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Norteamérica en el Top 10 Global
                </p>
                <div className="flex items-center gap-4 mb-1">
                  {[
                    { rank: "#1", country: "Estados Unidos", pct: 100 },
                    { rank: "#8", country: "Canadá", pct: 52 },
                    { rank: "#10", country: "México", pct: 40, hi: true },
                  ].map((c, i) => (
                    <div key={i} className="flex-1">
                      <div className="flex items-baseline gap-1.5 mb-1.5">
                        <span className="font-black text-sm" style={{ color: c.hi ? G : "#fff", letterSpacing: "-0.03em" }}>{c.rank}</span>
                        <span className="text-[9px] font-black uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>{c.country}</span>
                      </div>
                      <DataBar pct={c.pct} color={c.hi ? G : "rgba(255,255,255,0.3)"} delay={0.2 + i * 0.1} />
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui" }}>
                  Los tres países de Norteamérica ocupan posiciones en el Top 10 global por primera vez simultáneamente.
                </p>
                <div className="mt-3 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.22)" }}>Fuente: AMPROFON 2025</div>
              </div>
            </FadeUp>

            {/* LATAM context */}
            <FadeUp delay={0.1}>
              <div className="relative overflow-hidden rounded-2xl p-6"
                style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: "64px" }} />
                <p className="text-[10px] font-black uppercase tracking-[0.28em] mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Crecimiento Regional en 2024
                </p>
                <div className="space-y-3">
                  {[
                    { label: "Medio Oriente / Norte de África", pct: 100, val: "+22.8%", hi: false },
                    { label: "África Subsahariana",              pct: 99,  val: "+22.6%", hi: false },
                    { label: "Latinoamérica",                    pct: 98,  val: "+22.5%", hi: true  },
                  ].map((r, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black uppercase tracking-tight"
                          style={{ color: r.hi ? "#fff" : "rgba(255,255,255,0.55)" }}>{r.label}</span>
                        <span className="text-[10px] font-black" style={{ color: r.hi ? G : "rgba(255,255,255,0.45)" }}>{r.val}</span>
                      </div>
                      <DataBar pct={r.pct} color={r.hi ? G : "rgba(255,255,255,0.2)"} delay={0.3 + i * 0.1} />
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui" }}>
                  Latinoamérica fue la <strong style={{ color: "#fff" }}>3ª región de mayor crecimiento</strong> del mundo en 2024. México es el <strong style={{ color: "#fff" }}>2° mercado más grande</strong> de la región, detrás de Brasil.
                </p>
                <div className="mt-3 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.22)" }}>Fuente: IFPI State of the Industry 2025 · AMPROFON</div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STREAMING + CONSUMO
      ══════════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 pb-14">
        <FadeUp>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] mb-6" style={{ color: "rgba(255,255,255,0.35)" }}>
            Streaming y Consumo Digital ////
          </p>
        </FadeUp>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: Smartphone, title: "Consumo digital primario",  body: "El consumo musical en México ocurre principalmente a través de plataformas digitales. El formato físico representa una fracción mínima del mercado total.", src: "AMPROFON" },
            { icon: Star,       title: "Preferencia por pago",      body: "Los oyentes mexicanos han mostrado una destacada predilección por las suscripciones de pago frente al streaming gratuito, impulsando el revenue de mayor calidad.", src: "AMPROFON" },
            { icon: Globe,      title: "2° mercado en LATAM",       body: "México es el segundo mayor mercado de música grabada en Latinoamérica, por detrás de Brasil y por encima de Argentina, Colombia y Chile.", src: "AMPROFON" },
            { icon: TrendingUp, title: "Doble dígito consecutivo",  body: "LATAM registró un crecimiento del 22.5% en 2024 — el tercer mayor crecimiento regional a nivel global, consolidando al continente en el mapa de la industria.", src: "IFPI 2025" },
          ].map(({ icon: Icon, title, body, src }, i) => (
            <FadeUp key={i} delay={i * 0.05}>
              <div className="relative overflow-hidden rounded-xl p-6 h-full"
                style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.09)" }}>
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: NOISE, backgroundSize: "64px" }} />
                <Icon className="w-5 h-5 mb-4 relative z-10" style={{ color: "rgba(255,255,255,0.4)" }} />
                <h3 className="text-xs font-black uppercase tracking-tight text-white mb-3 relative z-10">{title}</h3>
                <p className="text-xs leading-relaxed relative z-10 mb-3" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "system-ui" }}>{body}</p>
                <div className="text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.22)" }}>{src}</div>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          QUOTE
      ══════════════════════════════════════════════════ */}
      <section className="px-6 lg:px-10 pb-14">
        <FadeUp>
          <div className="relative overflow-hidden rounded-2xl px-10 py-10"
            style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="absolute top-2 left-6 font-black pointer-events-none select-none"
              style={{ fontSize: "7rem", color: G, opacity: 0.065, lineHeight: 1, fontFamily: "Georgia,serif" }}>"</div>
            <p className="relative z-10 font-black uppercase leading-tight text-center max-w-3xl mx-auto"
              style={{ fontSize: "clamp(1.05rem, 2.4vw, 1.8rem)", color: "#fff", letterSpacing: "-0.01em", fontStyle: "italic" }}>
              El lugar que México ha conquistado en el mapa global no es un punto de llegada, sino un punto de partida.
            </p>
            <p className="relative z-10 text-center mt-4 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.3)" }}>
              — AMPROFON, Reporte Música México 2025
            </p>
          </div>
        </FadeUp>
      </section>

      {/* ══════════════════════════════════════════════════
          FUENTES — Full cover images
      ══════════════════════════════════════════════════ */}
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
              <div className="relative overflow-hidden" style={{ height: 260 }}>
                <img src={ifpiCover} alt="IFPI Global Music Report 2026" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(14,14,14,0) 40%, rgba(14,14,14,1) 100%)" }} />
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]"
                  style={{ background: "rgba(57,255,20,0.9)", color: "#000" }}>IFPI 2026</div>
              </div>
              <div className="px-7 pb-7 -mt-2 relative z-10">
                <h3 className="text-base font-black text-white mb-2">IFPI Global Music Report 2026</h3>
                <p className="text-sm leading-relaxed mb-1" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "system-ui" }}>
                  Ranking global de mercados de música grabada. Confirmó a México en el <strong style={{ color: "#fff" }}>#10</strong> con un crecimiento del <strong style={{ color: G }}>+13.3%</strong> en 2025.
                </p>
                <p className="text-xs leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "system-ui" }}>
                  International Federation of the Phonographic Industry · State of the Industry
                </p>
                <div className="flex items-center gap-5">
                  <a href="https://www.ifpi.org/wp-content/uploads/2026/03/GMR2026_SOTI.pdf" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-80" style={{ color: G }}>
                    Ver Fuente <ExternalLink className="w-3 h-3" />
                  </a>
                  <Link href="/insights/mexico-top-10-ifpi-2026">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] cursor-pointer hover:opacity-80" style={{ color: "rgba(255,255,255,0.4)" }}>
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
              <div className="relative overflow-hidden" style={{ height: 260 }}>
                <img src={amprofonCover} alt="AMPROFON Estado de la Industria 2025" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(14,14,14,0) 35%, rgba(14,14,14,1) 100%)" }} />
                <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]"
                  style={{ background: "rgba(255,255,255,0.92)", color: "#000" }}>AMPROFON 2025</div>
              </div>
              <div className="px-7 pb-7 -mt-2 relative z-10">
                <h3 className="text-base font-black text-white mb-2">AMPROFON — Estado de la Industria 2025</h3>
                <p className="text-sm leading-relaxed mb-1" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "system-ui" }}>
                  El reporte de la industria musical mexicana. Documenta el ascenso de <strong style={{ color: "#fff" }}>#15→#10</strong>, la duplicación de ingresos, el consumo digital y los ecosistemas por ciudad.
                </p>
                <p className="text-xs leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "system-ui" }}>
                  Asociación Mexicana de Productores de Fonogramas y Videogramas · FIM GDL
                </p>
                <a href="https://amprofon.com.mx/es/media/pdfs/Reporte_Musica_Mexico_(1).pdf" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-80" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Ver Fuente <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          EXPLORA MÁS
      ══════════════════════════════════════════════════ */}
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
            { icon: Globe,    title: "Música Mexicana Global",   sub: "El crecimiento del regional mexicano y nuevos géneros.", locked: true },
            { icon: MapPin,   title: "Ecosistemas por Ciudad",   sub: "CDMX, Guadalajara, Monterrey, Tijuana, Hermosillo y más.", locked: true },
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
                  <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "system-ui" }}>{sub}</p>
                </div>
              ) : (
                <Link href="/insights/mexico-top-10-ifpi-2026">
                  <div className="relative overflow-hidden rounded-xl p-6 h-full cursor-pointer group"
                    style={{ background: "#0e0e0e", border: `1px solid rgba(57,255,20,0.14)` }}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: "rgba(57,255,20,0.025)" }} />
                    <div className="flex items-start justify-between mb-4">
                      <Icon className="w-5 h-5" style={{ color: G, opacity: 0.75 }} />
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

      {/* Methodology */}
      <div className="px-6 lg:px-10 py-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#060606" }}>
        <p className="text-[10px] leading-relaxed" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "system-ui", maxWidth: 780 }}>
          <strong style={{ color: "rgba(255,255,255,0.42)" }}>ℹ</strong>{" "}
          Mexico Charts resume datos públicos de reportes de la industria como IFPI y AMPROFON. No reproducimos gráficos, tablas ni elementos visuales protegidos. Las cifras y citas directas se presentan con atribución explícita a sus fuentes. Esta clasificación se refiere al mercado de{" "}
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
