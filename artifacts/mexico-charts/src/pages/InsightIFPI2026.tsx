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

export default function InsightIFPI2026() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff" }}>

      {/* ── Noise overlay ── */}
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

      <main className="relative z-10 max-w-[820px] mx-auto px-6 lg:px-0 pt-14 pb-24">

        {/* ── Eyebrow ── */}
        <FadeUp>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-[3px] h-4 rounded-full" style={{ background: "#39FF14" }} />
            <span className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: "#39FF14" }}>
              Insight · IFPI Global Music Report 2026
            </span>
          </div>
        </FadeUp>

        {/* ── Headline ── */}
        <FadeUp delay={0.05}>
          <h1
            className="font-black uppercase leading-[0.9] tracking-tight mb-6"
            style={{ fontSize: "clamp(2.8rem, 8vw, 5.5rem)", letterSpacing: "-0.02em" }}
          >
            México entra<br />
            al{" "}
            <span style={{ color: "#39FF14" }}>Top 10</span><br />
            Global
          </h1>
        </FadeUp>

        {/* ── Subheadline ── */}
        <FadeUp delay={0.08}>
          <p
            className="leading-relaxed mb-12"
            style={{ fontSize: "clamp(0.95rem, 2vw, 1.15rem)", color: "rgba(255,255,255,0.55)", maxWidth: 600, fontFamily: "system-ui, sans-serif", fontWeight: 400 }}
          >
            Por primera vez, México forma parte de los 10 mercados de música grabada más grandes del mundo. En 2025, se mantuvo en el puesto{" "}
            <strong style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>#10 con un crecimiento de 13.3%</strong>
            {" "}en revenue, según el reporte anual de la IFPI.
          </p>
        </FadeUp>

        {/* ── Divider ── */}
        <FadeUp delay={0.1}>
          <div className="h-px mb-12" style={{ background: "linear-gradient(to right, #39FF14, rgba(57,255,20,0.08), transparent)" }} />
        </FadeUp>

        {/* ── Stat trio ── */}
        <FadeUp delay={0.12}>
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
                    color: i === 0 ? "#39FF14" : "#fff",
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

        {/* ── Body copy ── */}
        <FadeUp delay={0.14}>
          <div className="flex flex-col gap-7 mb-14" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>

            <p style={{ fontSize: "1rem", lineHeight: 1.85, color: "rgba(255,255,255,0.62)" }}>
              El{" "}
              <em style={{ color: "rgba(255,255,255,0.85)", fontStyle: "normal", fontWeight: 600 }}>IFPI Global Music Report 2026</em>
              {" "}documenta por primera vez la entrada de México al Top 10 de mercados de música grabada a nivel mundial. Con un crecimiento del 13.3% en revenue durante 2025, el país se posicionó en el puesto número 10, superando a mercados históricamente más grandes.
            </p>

            <p style={{ fontSize: "1rem", lineHeight: 1.85, color: "rgba(255,255,255,0.62)" }}>
              Este crecimiento está impulsado principalmente por el streaming — plataformas como Spotify, YouTube Music y Apple Music —, que representan la mayor parte del revenue de música grabada en México. El corrido tumbado, el regional mexicano y el urbano mexicano son los géneros que lideran el consumo tanto dentro como fuera del país.
            </p>

          </div>
        </FadeUp>

        {/* ── Editorial callout ── */}
        <FadeUp delay={0.16}>
          <blockquote
            className="relative rounded-xl px-8 py-7 mb-14"
            style={{
              background: "linear-gradient(135deg, rgba(57,255,20,0.04) 0%, rgba(57,255,20,0.01) 100%)",
              borderLeft: "3px solid #39FF14",
              boxShadow: "0 0 40px rgba(57,255,20,0.04)",
            }}
          >
            <div className="absolute inset-0 opacity-[0.025] rounded-xl pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
            <p
              className="relative z-10 font-black uppercase leading-tight"
              style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", color: "#fff", letterSpacing: "-0.01em" }}
            >
              México ya no solo exporta cultura: ahora también figura entre los mercados musicales más importantes del planeta.
            </p>
          </blockquote>
        </FadeUp>

        {/* ── Source / citation ── */}
        <FadeUp delay={0.18}>
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
              style={{ color: "#39FF14" }}
            >
              Ver reporte
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </FadeUp>

        {/* ── Accuracy note ── */}
        <FadeUp delay={0.2}>
          <div className="mt-8 flex items-start gap-3">
            <div className="w-[2px] h-full min-h-[36px] rounded-full mt-1 shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />
            <p className="text-[10px] font-medium leading-relaxed" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "system-ui" }}>
              Esta clasificación se refiere al mercado de <strong style={{ color: "rgba(255,255,255,0.4)" }}>música grabada</strong> (streaming + descargas + físico), no a rankings de Spotify ni a revenue de touring. Los datos corresponden al ejercicio fiscal 2025, publicados por la IFPI en su reporte anual 2026.
            </p>
          </div>
        </FadeUp>

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
