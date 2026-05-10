import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink } from "lucide-react";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const STATS = [
  { value: "#10",    label: "mercado global de\nmúsica grabada" },
  { value: "+13.3%", label: "crecimiento en\nrevenue 2025" },
  { value: "1ª VEZ", label: "dentro del\nTop 10 global" },
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

const GREEN = "#39FF14";
const bodyStyle: React.CSSProperties = {
  fontSize: "1rem",
  lineHeight: 1.85,
  color: "rgba(255,255,255,0.62)",
  fontFamily: "system-ui, -apple-system, sans-serif",
};
const strongStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.88)",
  fontWeight: 600,
};

export default function InsightIFPI2026() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>

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
            Volver
          </motion.span>
        </Link>
      </header>

      <main className="relative z-10 max-w-[780px] mx-auto px-6 lg:px-0 pt-14 pb-28">

        {/* ── Eyebrow ── */}
        <FadeUp>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-[3px] h-4 rounded-full" style={{ background: GREEN }} />
            <span className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: GREEN }}>
              Insight · IFPI Global Music Report 2026
            </span>
          </div>
        </FadeUp>

        {/* ── Headline ── */}
        <FadeUp delay={0.04}>
          <h1
            className="font-black uppercase leading-[0.9] tracking-tight mb-6"
            style={{ fontSize: "clamp(2.8rem, 8vw, 5.5rem)", letterSpacing: "-0.02em" }}
          >
            México entra<br />
            al{" "}
            <span style={{ color: GREEN }}>Top 10</span><br />
            Global
          </h1>
        </FadeUp>

        {/* ── Subheadline ── */}
        <FadeUp delay={0.07}>
          <p className="leading-relaxed mb-10" style={{ fontSize: "clamp(0.95rem, 2vw, 1.15rem)", color: "rgba(255,255,255,0.55)", maxWidth: 600, fontFamily: "system-ui, sans-serif", fontWeight: 400 }}>
            Por primera vez, México forma parte de los 10 mercados de música grabada más grandes del mundo. En 2025, se mantuvo en el puesto{" "}
            <strong style={strongStyle}>#10 con un crecimiento del 13.3%</strong>{" "}en revenue, según el IFPI Global Music Report 2026.
          </p>
        </FadeUp>

        {/* ── Divider ── */}
        <FadeUp delay={0.09}>
          <div className="h-px mb-12" style={{ background: `linear-gradient(to right, ${GREEN}, rgba(57,255,20,0.08), transparent)` }} />
        </FadeUp>

        {/* ── Stat trio ── */}
        <FadeUp delay={0.11}>
          <div className="grid grid-cols-3 gap-2 mb-14">
            {STATS.map((s, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-xl p-5"
                style={{
                  background: "linear-gradient(160deg, #0e0e0e 0%, #0a0a0a 100%)",
                  border: i === 0 ? "1px solid rgba(57,255,20,0.22)" : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: i === 0 ? "0 0 28px rgba(57,255,20,0.06), inset 0 1px 0 rgba(57,255,20,0.08)" : "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "64px" }} />
                <div
                  className="font-black leading-none mb-3 relative z-10"
                  style={{
                    fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
                    color: i === 0 ? GREEN : "#fff",
                    letterSpacing: "-0.03em",
                    textShadow: i === 0 ? "0 0 30px rgba(57,255,20,0.3)" : "none",
                  }}
                >
                  {s.value}
                </div>
                <div
                  className="text-[9px] font-black uppercase tracking-[0.18em] leading-relaxed relative z-10"
                  style={{ color: "rgba(255,255,255,0.35)", whiteSpace: "pre-line" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </FadeUp>

        {/* ══════════════════════════════════════
            ARTICLE BODY
        ══════════════════════════════════════ */}

        <div className="flex flex-col gap-10">

          {/* ── Section 1: El hito ── */}
          <FadeUp delay={0.12}>
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-[2px] h-5 rounded-full" style={{ background: GREEN }} />
                <h2 className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  El Hito
                </h2>
              </div>
              <div className="flex flex-col gap-5">
                <p style={bodyStyle}>
                  El <strong style={strongStyle}>IFPI Global Music Report 2026</strong> confirma que México entró por primera vez al Top 10 de mercados de música grabada a nivel mundial, cerrando 2025 en el puesto <strong style={strongStyle}>#10</strong>. Esto lo coloca por encima de mercados con décadas de infraestructura musical consolidada, y representa un punto de inflexión para la industria local.
                </p>
                <p style={bodyStyle}>
                  El ranking de la IFPI mide el <strong style={strongStyle}>revenue total de música grabada</strong> por país — incluyendo streaming pagado, streaming ad-supported, descargas digitales y ventas físicas. No se trata de un ranking de Spotify ni de popularidad en plataformas: es la medición económica más completa de la industria musical que existe a nivel global.
                </p>
                <p style={bodyStyle}>
                  Con un crecimiento del <strong style={strongStyle}>13.3% en 2025</strong>, México no solo entró al Top 10: lo hizo con uno de los crecimientos más acelerados entre todos los mercados de la lista. Países como Estados Unidos, el Reino Unido, Japón y Alemania llevan décadas en esas posiciones; México llegó con momentum.
                </p>
              </div>
            </div>
          </FadeUp>

          {/* ── Editorial callout 1 ── */}
          <FadeUp>
            <blockquote
              className="relative rounded-xl px-8 py-7"
              style={{
                background: "linear-gradient(135deg, rgba(57,255,20,0.04) 0%, rgba(57,255,20,0.01) 100%)",
                borderLeft: `3px solid ${GREEN}`,
                boxShadow: "0 0 40px rgba(57,255,20,0.04)",
              }}
            >
              <div className="absolute inset-0 opacity-[0.025] rounded-xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
              <p
                className="relative z-10 font-black uppercase leading-tight"
                style={{ fontSize: "clamp(1.05rem, 2.2vw, 1.45rem)", color: "#fff", letterSpacing: "-0.01em" }}
              >
                México ya no solo exporta cultura: ahora también figura entre los mercados musicales más importantes del planeta.
              </p>
            </blockquote>
          </FadeUp>

          {/* ── Section 2: Qué lo impulsó ── */}
          <FadeUp>
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-[2px] h-5 rounded-full" style={{ background: GREEN }} />
                <h2 className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Qué Lo Impulsó
                </h2>
              </div>
              <div className="flex flex-col gap-5">
                <p style={bodyStyle}>
                  El crecimiento del mercado de música grabada en México está liderado principalmente por el <strong style={strongStyle}>streaming</strong>, que representa la mayor porción del revenue total. Plataformas como Spotify, YouTube Music, Apple Music y Deezer han expandido su penetración en México de forma sostenida en los últimos tres años, especialmente en segmentos de usuarios que antes no consumían música de forma pagada.
                </p>
                <p style={bodyStyle}>
                  Desde el lado del contenido, el <strong style={strongStyle}>corrido tumbado</strong> y el <strong style={strongStyle}>regional mexicano</strong> son los géneros que más han empujado el consumo tanto dentro como fuera del país. Artistas como Peso Pluma, Fuerza Regida, Natanael Cano y Carin León no solo dominan las charts mexicanas — han logrado colocar a México en el mapa global del streaming, generando revenue en mercados que históricamente no consumían música en español.
                </p>
                <p style={bodyStyle}>
                  Este fenómeno de <strong style={strongStyle}>exportación cultural masiva</strong> convierte a México en un caso único: el crecimiento de su mercado de música grabada no viene solo del consumo interno, sino de la demanda internacional de música mexicana. Eso lo diferencia de mercados como Brasil o Argentina, donde el crecimiento es predominantemente doméstico.
                </p>
              </div>
            </div>
          </FadeUp>

          {/* ── Inline stat callout ── */}
          <FadeUp>
            <div
              className="rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6"
              style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="shrink-0">
                <div className="text-4xl font-black" style={{ color: GREEN, letterSpacing: "-0.03em" }}>+13.3%</div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>crecimiento 2025</div>
              </div>
              <div className="w-px h-12 hidden sm:block" style={{ background: "rgba(255,255,255,0.08)" }} />
              <p style={{ ...bodyStyle, fontSize: "0.9rem" }}>
                México creció <strong style={strongStyle}>13.3% en revenue de música grabada</strong> durante 2025, uno de los crecimientos más altos entre todos los países del Top 10 global. La IFPI atribuye este crecimiento al auge del streaming pagado y al impacto internacional de los géneros mexicanos.
              </p>
            </div>
          </FadeUp>

          {/* ── Section 3: Qué significa para la industria local ── */}
          <FadeUp>
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-[2px] h-5 rounded-full" style={{ background: GREEN }} />
                <h2 className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Qué Significa Para México
                </h2>
              </div>
              <div className="flex flex-col gap-5">
                <p style={bodyStyle}>
                  Entrar al Top 10 global no es solo un logro estadístico: tiene implicaciones directas para la industria local. Los mercados en ese rango de la IFPI atraen más inversión de sellos discográficos internacionales, más acuerdos de licenciamiento, y mayor atención de plataformas que priorizan el desarrollo de contenido local. En la práctica, significa más recursos disponibles para artistas, productores y toda la cadena de la industria musical en México.
                </p>
                <p style={bodyStyle}>
                  También posiciona a México como un <strong style={strongStyle}>hub de exportación musical</strong> en América Latina. Mientras otros países de la región tienen mercados más grandes en términos absolutos de población, México ha logrado convertir su escena musical en un producto de exportación cultural con alcance global — algo que ningún otro país de habla hispana ha logrado en esta escala en los últimos cinco años.
                </p>
                <p style={bodyStyle}>
                  Para Mexico Charts, este hito es exactamente la razón por la que este proyecto existe: documentar, en tiempo real, el ascenso de la música mexicana en el mundo.
                </p>
              </div>
            </div>
          </FadeUp>

          {/* ── Editorial callout 2 ── */}
          <FadeUp>
            <blockquote
              className="relative rounded-xl px-8 py-7"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderLeft: "3px solid rgba(255,255,255,0.18)",
              }}
            >
              <p
                className="font-black uppercase leading-tight"
                style={{ fontSize: "clamp(1rem, 2vw, 1.3rem)", color: "rgba(255,255,255,0.7)", letterSpacing: "-0.01em" }}
              >
                "El Top 10 no es el destino — es la confirmación de que el camino era correcto."
              </p>
            </blockquote>
          </FadeUp>

          {/* ── Section 4: Contexto de la clasificación ── */}
          <FadeUp>
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-[2px] h-5 rounded-full" style={{ background: GREEN }} />
                <h2 className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Contexto del Ranking IFPI
                </h2>
              </div>
              <div className="flex flex-col gap-5">
                <p style={bodyStyle}>
                  La IFPI — <em style={{ fontStyle: "normal", color: "rgba(255,255,255,0.8)" }}>International Federation of the Phonographic Industry</em> — es el organismo global que representa a la industria discográfica. Su reporte anual, el <strong style={strongStyle}>Global Music Report</strong>, es la fuente de referencia más autorizada del sector y es utilizado por gobiernos, inversionistas y medios especializados en todo el mundo.
                </p>
                <p style={bodyStyle}>
                  El ranking de mercados mide el <strong style={strongStyle}>revenue total de música grabada</strong>: streaming de pago, streaming gratuito con publicidad, descargas digitales, y ventas físicas (CD, vinilo). No incluye revenue de conciertos ni touring. México ocupó el puesto <strong style={strongStyle}>#10 en 2025</strong>, primera vez en la historia que el país aparece dentro de los diez mercados más grandes.
                </p>
              </div>
            </div>
          </FadeUp>

          {/* ── Divider ── */}
          <FadeUp>
            <div className="h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </FadeUp>

          {/* ── Source / citation ── */}
          <FadeUp>
            <div
              className="rounded-xl px-6 py-5 flex items-start justify-between gap-6"
              style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.26em] mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Fuente</div>
                <div className="text-sm font-black text-white mb-1">IFPI Global Music Report 2026</div>
                <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "system-ui" }}>
                  State of the Industry · International Federation of the Phonographic Industry
                </div>
              </div>
              <a
                href="https://www.ifpi.org/wp-content/uploads/2026/03/GMR2026_SOTI.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] shrink-0 mt-1"
                style={{ color: GREEN }}
              >
                Ver reporte
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </FadeUp>

          {/* ── Accuracy note ── */}
          <FadeUp>
            <div className="flex items-start gap-3">
              <div className="w-[2px] min-h-[36px] rounded-full mt-1 shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />
              <p className="text-[10px] font-medium leading-relaxed" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "system-ui" }}>
                Esta clasificación se refiere al mercado de <strong style={{ color: "rgba(255,255,255,0.4)" }}>música grabada</strong> (streaming + descargas + físico), no a rankings de Spotify ni a revenue de touring. Los datos corresponden al ejercicio fiscal 2025, publicados por la IFPI en su reporte anual 2026. El término correcto es "mercado de música grabada", no "mercado musical" en general.
              </p>
            </div>
          </FadeUp>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t px-6 lg:px-12 py-8 flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
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
