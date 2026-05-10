import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const GREEN = "#39FF14";

const STATS = [
  { value: "#10",      label: "Mercado global de\nmúsica grabada",       highlight: true,  source: "IFPI 2026" },
  { value: "+13.3%",   label: "Crecimiento de\ningresos en 2025",         highlight: false, source: "IFPI 2026" },
  { value: "#15→#10",  label: "Ascenso global\nentre 2022 y 2024",        highlight: false, source: "AMPROFON" },
  { value: "10 años",  label: "Crecimiento sostenido\nde la industria",   highlight: false, source: "AMPROFON" },
  { value: "2×",       label: "Ingresos duplicados\nen cinco años",       highlight: false, source: "AMPROFON" },
];

const INSIGHTS = [
  {
    title: "Reconocimiento global",
    body: "México ya forma parte de los mercados de música grabada más importantes del mundo. Es la primera vez que el país entra al Top 10 del ranking IFPI, que mide el revenue total de streaming, descargas y ventas físicas.",
  },
  {
    title: "Crecimiento sostenido",
    body: "El mercado mexicano ha registrado diez años consecutivos de expansión en música grabada. En ese período los ingresos se duplicaron, impulsados principalmente por la adopción acelerada del streaming digital.",
  },
  {
    title: "Streaming y suscripciones",
    body: "El consumo musical en México ocurre principalmente en plataformas digitales — Spotify, YouTube Music, Apple Music, Deezer. Los oyentes mexicanos muestran una fuerte preferencia por suscripciones de pago, lo que genera revenue de mayor calidad para la industria.",
  },
  {
    title: "Impacto cultural e industrial",
    body: "La música mexicana no solo tiene fuerza cultural: también está consolidando a México como un mercado de alto valor dentro de la industria global. El corrido tumbado y el regional mexicano generan demanda internacional que alimenta el crecimiento del mercado doméstico.",
  },
];

const FUTURE_PAGES = [
  { label: "Música Grabada",         sub: "IFPI · AMPROFON · Streaming · Suscripciones" },
  { label: "Streaming",              sub: "Spotify · YouTube · Plataformas digitales" },
  { label: "Live & Touring",         sub: "Conciertos · Venues · Pollstar" },
  { label: "Música Mexicana Global", sub: "Corridos tumbados · Exportación cultural" },
  { label: "Ciudades",               sub: "CDMX · GDL · MTY · Hermosillo · Mazatlán" },
  { label: "Artistas Independientes",sub: "Distribución · Sellos · Profesionalización" },
];

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-[2px] h-5 rounded-full" style={{ background: GREEN }} />
      <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: "rgba(255,255,255,0.4)" }}>{text}</span>
    </div>
  );
}

export default function IndustryLanding() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>

      {/* Noise overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.018]" style={{ backgroundImage: NOISE_SVG, backgroundSize: "128px", zIndex: 0 }} />

      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4"
        style={{ background: "rgba(8,8,8,0.92)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link href="/">
          <img src={logoUrl} alt="Mexico Charts" className="h-8 object-contain opacity-90 cursor-pointer" />
        </Link>
        <Link href="/">
          <motion.span
            whileHover={{ x: -2 }}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] cursor-pointer"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Inicio
          </motion.span>
        </Link>
      </header>

      <main className="relative z-10">

        {/* ═══════════════════════════════════════
            HERO
        ═══════════════════════════════════════ */}
        <section className="max-w-[1100px] mx-auto px-6 lg:px-12 pt-16 pb-14">

          <FadeUp>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-[3px] h-4 rounded-full" style={{ background: GREEN }} />
              <span className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: GREEN }}>
                Industria · Mercado Musical
              </span>
            </div>
          </FadeUp>

          <FadeUp delay={0.05}>
            <h1
              className="font-black uppercase leading-[0.88] mb-8"
              style={{ fontSize: "clamp(2.6rem, 7.5vw, 6rem)", letterSpacing: "-0.025em", maxWidth: 900 }}
            >
              México ya es{" "}
              <span style={{ color: GREEN }}>Top 10</span>
              <br />
              global en música
              <br />
              grabada
            </h1>
          </FadeUp>

          <FadeUp delay={0.09}>
            <p
              className="mb-6 leading-relaxed"
              style={{ fontSize: "clamp(0.95rem, 1.8vw, 1.12rem)", color: "rgba(255,255,255,0.52)", maxWidth: 680, fontFamily: "system-ui, sans-serif" }}
            >
              México forma parte de los 10 mercados de música grabada más grandes del mundo. Según la IFPI, en 2025 se mantuvo en el puesto{" "}
              <strong style={{ color: "rgba(255,255,255,0.82)", fontWeight: 600 }}>#10 tras crecer 13.3% en ingresos de música grabada</strong>.
              Según AMPROFON, el país pasó del puesto #15 en 2022 al #10 en 2024 — un ascenso que se viene construyendo desde hace una década.
            </p>
          </FadeUp>

          <FadeUp delay={0.11}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.22)" }}>
              Fuentes: IFPI Global Music Report 2026 · AMPROFON Reporte Música México
            </p>
          </FadeUp>
        </section>

        {/* ── Divider ── */}
        <div className="h-px mx-6 lg:mx-12" style={{ background: `linear-gradient(to right, ${GREEN}, rgba(57,255,20,0.06), transparent)` }} />

        {/* ═══════════════════════════════════════
            STAT CARDS
        ═══════════════════════════════════════ */}
        <section className="px-6 lg:px-12 py-12">
          <FadeUp>
            <SectionLabel text="Datos Clave" />
          </FadeUp>

          {/* Scrollable on mobile, wrapping grid on desktop */}
          <div
            className="flex gap-3 overflow-x-auto pb-3 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0"
            style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" } as React.CSSProperties}
          >
            {STATS.map((s, i) => (
              <FadeUp key={i} delay={i * 0.05}>
                <div
                  className="relative overflow-hidden rounded-xl p-5 flex-shrink-0"
                  style={{
                    minWidth: 160,
                    background: "linear-gradient(160deg, #0e0e0e 0%, #0a0a0a 100%)",
                    border: s.highlight
                      ? "1px solid rgba(57,255,20,0.22)"
                      : "1px solid rgba(255,255,255,0.07)",
                    boxShadow: s.highlight
                      ? "0 0 32px rgba(57,255,20,0.06), inset 0 1px 0 rgba(57,255,20,0.08)"
                      : "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "64px" }} />
                  {s.highlight && (
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(57,255,20,0.12) 0%, transparent 70%)" }} />
                  )}
                  <div
                    className="font-black leading-none mb-3 relative z-10"
                    style={{
                      fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
                      letterSpacing: "-0.03em",
                      color: s.highlight ? GREEN : "#fff",
                      textShadow: s.highlight ? "0 0 28px rgba(57,255,20,0.28)" : "none",
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="text-[9px] font-black uppercase tracking-[0.16em] leading-relaxed relative z-10 mb-3"
                    style={{ color: "rgba(255,255,255,0.35)", whiteSpace: "pre-line" }}
                  >
                    {s.label}
                  </div>
                  <div className="text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: s.highlight ? "rgba(57,255,20,0.5)" : "rgba(255,255,255,0.18)" }}>
                    {s.source}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════
            QUÉ SIGNIFICA PARA MÉXICO
        ═══════════════════════════════════════ */}
        <section className="px-6 lg:px-12 py-10">
          <div className="max-w-[1100px] mx-auto">
            <FadeUp>
              <SectionLabel text="Qué Significa Para México" />
            </FadeUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INSIGHTS.map((ins, i) => (
                <FadeUp key={i} delay={i * 0.06}>
                  <div
                    className="relative overflow-hidden rounded-xl p-6"
                    style={{
                      background: "linear-gradient(135deg, #0d0d0d 0%, #0a0a0a 100%)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "80px" }} />
                    <div className="w-[2px] h-5 rounded-full mb-4" style={{ background: GREEN }} />
                    <h3 className="text-sm font-black uppercase tracking-tight text-white mb-3 relative z-10">{ins.title}</h3>
                    <p
                      className="text-sm leading-relaxed relative z-10"
                      style={{ color: "rgba(255,255,255,0.52)", fontFamily: "system-ui, sans-serif" }}
                    >
                      {ins.body}
                    </p>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ── Callout ── */}
        <section className="px-6 lg:px-12 py-4">
          <FadeUp>
            <div className="max-w-[1100px] mx-auto">
              <blockquote
                className="relative rounded-xl px-8 py-8"
                style={{
                  background: "linear-gradient(135deg, rgba(57,255,20,0.04) 0%, rgba(57,255,20,0.01) 100%)",
                  borderLeft: `3px solid ${GREEN}`,
                  boxShadow: "0 0 40px rgba(57,255,20,0.04)",
                }}
              >
                <div className="absolute inset-0 opacity-[0.025] rounded-xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
                <p
                  className="relative z-10 font-black uppercase leading-tight"
                  style={{ fontSize: "clamp(1.05rem, 2.2vw, 1.5rem)", color: "#fff", letterSpacing: "-0.01em", maxWidth: 780 }}
                >
                  México ya no solo exporta cultura: ahora figura entre los mercados de música grabada más importantes del planeta, por primera vez en la historia.
                </p>
              </blockquote>
            </div>
          </FadeUp>
        </section>

        {/* ═══════════════════════════════════════
            FUENTES / SOURCE CARDS
        ═══════════════════════════════════════ */}
        <section className="px-6 lg:px-12 py-12">
          <div className="max-w-[1100px] mx-auto">
            <FadeUp>
              <SectionLabel text="Fuentes" />
            </FadeUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* IFPI */}
              <FadeUp delay={0.04}>
                <div
                  className="relative overflow-hidden rounded-xl p-6 flex flex-col gap-4"
                  style={{
                    background: "#0d0d0d",
                    border: "1px solid rgba(57,255,20,0.12)",
                    boxShadow: "0 0 24px rgba(57,255,20,0.04)",
                  }}
                >
                  <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "72px" }} />
                  <div className="relative z-10">
                    <div className="text-[9px] font-black uppercase tracking-[0.28em] mb-2" style={{ color: GREEN }}>IFPI</div>
                    <div className="text-base font-black text-white mb-2">IFPI Global Music Report 2026</div>
                    <div className="text-[11px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.42)", fontFamily: "system-ui" }}>
                      State of the Industry · International Federation of the Phonographic Industry
                    </div>
                    <div className="text-[11px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.38)", fontFamily: "system-ui" }}>
                      Usado para: ranking global de mercados · crecimiento +13.3% en 2025 · México como #10 mercado de música grabada
                    </div>
                    <div className="flex items-center gap-6">
                      <a
                        href="https://www.ifpi.org/wp-content/uploads/2026/03/GMR2026_SOTI.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em]"
                        style={{ color: GREEN }}
                      >
                        Ver fuente <ExternalLink className="w-3 h-3" />
                      </a>
                      <Link href="/insights/mexico-top-10-ifpi-2026">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>
                          Leer análisis →
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              </FadeUp>

              {/* AMPROFON */}
              <FadeUp delay={0.07}>
                <div
                  className="relative overflow-hidden rounded-xl p-6 flex flex-col gap-4"
                  style={{
                    background: "#0d0d0d",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "72px" }} />
                  <div className="relative z-10">
                    <div className="text-[9px] font-black uppercase tracking-[0.28em] mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>AMPROFON</div>
                    <div className="text-base font-black text-white mb-2">Reporte Música México</div>
                    <div className="text-[11px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.42)", fontFamily: "system-ui" }}>
                      Asociación Mexicana de Productores de Fonogramas y Videogramas
                    </div>
                    <div className="text-[11px] leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.38)", fontFamily: "system-ui" }}>
                      Usado para: contexto de mercado México · ascenso #15→#10 (2022-2024) · década de crecimiento sostenido · consumo digital · preferencia por suscripciones de paga
                    </div>
                    <a
                      href="https://amprofon.com.mx/es/media/pdfs/Reporte_Musica_Mexico_(1).pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em]"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Ver fuente <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </FadeUp>

            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            FUTURE PAGES ROADMAP
        ═══════════════════════════════════════ */}
        <section className="px-6 lg:px-12 py-10">
          <div className="max-w-[1100px] mx-auto">
            <FadeUp>
              <SectionLabel text="Próximamente en Industria" />
            </FadeUp>
            <FadeUp delay={0.03}>
              <p className="text-xs mb-8" style={{ color: "rgba(255,255,255,0.28)", fontFamily: "system-ui", maxWidth: 520 }}>
                Estas secciones están en desarrollo. México Charts irá expandiendo su cobertura de la industria musical mexicana.
              </p>
            </FadeUp>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FUTURE_PAGES.map((fp, i) => (
                <FadeUp key={i} delay={i * 0.04}>
                  <div
                    className="relative rounded-xl p-5 flex items-start gap-4"
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid rgba(255,255,255,0.05)",
                      opacity: 0.6,
                    }}
                  >
                    <div className="mt-0.5 shrink-0">
                      <Lock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.2)" }} />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-tight text-white mb-1">{fp.label}</div>
                      <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "system-ui" }}>{fp.sub}</div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════
            METHODOLOGY NOTE
        ═══════════════════════════════════════ */}
        <section className="px-6 lg:px-12 py-10">
          <div className="max-w-[1100px] mx-auto">
            <FadeUp>
              <div className="flex items-start gap-3">
                <div className="w-[2px] min-h-[40px] rounded-full mt-1 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />
                <p className="text-[10px] font-medium leading-relaxed" style={{ color: "rgba(255,255,255,0.22)", fontFamily: "system-ui" }}>
                  Mexico Charts resume datos públicos de reportes de la industria como IFPI y AMPROFON. No reproducimos gráficos, tablas ni elementos visuales protegidos de los reportes originales. Las cifras se presentan con atribución a sus fuentes correspondientes. Esta clasificación se refiere al mercado de{" "}
                  <strong style={{ color: "rgba(255,255,255,0.38)" }}>música grabada</strong>
                  {" "}(streaming + descargas + físico), no a rankings de plataformas ni a revenue de conciertos o touring.
                </p>
              </div>
            </FadeUp>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 border-t px-6 lg:px-12 py-8 flex items-center justify-between"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <Link href="/">
          <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-50 cursor-pointer hover:opacity-80 transition-opacity" />
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
          © 2026 Mexico Charts
        </p>
      </footer>

    </div>
  );
}
