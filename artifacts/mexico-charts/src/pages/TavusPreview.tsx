import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BarChart3, Play, RadioTower, Sparkles } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";

const VIDEO_MP4 = `${import.meta.env.BASE_URL}media/tavus-mexico-charts.mp4`;
const VIDEO_MOV = `${import.meta.env.BASE_URL}media/tavus-mexico-charts.mov`;
const LOGO = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const SIGNALS = [
  { label: "Spotify México", value: "Fuerza Regida", sub: "lidera la semana" },
  { label: "YouTube México", value: "Corridos", sub: "dominio sostenido" },
  { label: "Artistas clave", value: "Peso Pluma", sub: "presencia multiplataforma" },
];

export default function TavusPreview() {
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'Inter', sans-serif", overflowX: "hidden" }}>
      <PageSEO
        title="Video Tavus · Mexico Charts"
        description="Vista editorial de un video Tavus integrado dentro de Mexico Charts"
        path="/tavus-preview"
        noindex
      />

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800;900&display=swap');
        .tv-fa { font-family: 'Anton', sans-serif !important; }
        @media (max-width: 860px) {
          .tv-hero { grid-template-columns: 1fr !important; padding: 38px 24px 58px !important; gap: 32px !important; }
          .tv-title { font-size: clamp(4.1rem, 18vw, 6rem) !important; }
          .tv-video-frame { min-height: 520px !important; }
          .tv-signal-row { grid-template-columns: 1fr !important; gap: 18px !important; }
          .tv-lower { grid-template-columns: 1fr !important; padding: 44px 24px 64px !important; }
        }
      ` }} />

      <SiteNav />

      <main>
        <section
          className="tv-hero"
          style={{
            minHeight: "calc(100vh - 56px)",
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.92fr) minmax(430px, 0.78fr)",
            gap: 54,
            alignItems: "center",
            padding: "54px 56px 70px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 15% 20%, rgba(57,255,20,0.14), transparent 34%), radial-gradient(circle at 86% 58%, rgba(57,255,20,0.10), transparent 34%)" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "54px 54px", maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 78%)", WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 78%)" }} />

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} style={{ position: "relative", zIndex: 2, maxWidth: 780 }}>
            <Link href="/">
              <span style={{ color: "rgba(255,255,255,0.46)", fontSize: 9, fontWeight: 900, letterSpacing: "0.28em", textTransform: "uppercase", cursor: "pointer" }}>
                ← Inicio
              </span>
            </Link>
            <div style={{ color: "#39FF14", fontSize: 10, fontWeight: 900, letterSpacing: "0.42em", textTransform: "uppercase", marginTop: 34, marginBottom: 22 }}>
              Video editorial · Tavus
            </div>
            <h1 className="tv-fa tv-title" style={{ margin: 0, color: "#fff", fontSize: "clamp(5.6rem, 12vw, 10.6rem)", lineHeight: 0.82, textTransform: "uppercase", letterSpacing: "0.015em" }}>
              Mexico<br />Charts<br />en video
            </h1>
            <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 17, lineHeight: 1.7, maxWidth: 620, marginTop: 30 }}>
              Una vista de cómo se sentiría un resumen semanal narrado dentro del sitio: datos de charts, contexto de artistas y señal editorial en formato video
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 30 }}>
              {["Resumen semanal", "Presentador IA", "Datos en vivo", "Formato editorial"].map((item) => (
                <span key={item} style={{ border: "1px solid rgba(57,255,20,0.22)", background: "rgba(57,255,20,0.065)", color: "#39FF14", padding: "8px 11px", fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                  {item}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12, duration: 0.75 }} style={{ position: "relative", zIndex: 2 }}>
            <div className="tv-video-frame" style={{ minHeight: 660, border: "1px solid rgba(57,255,20,0.2)", background: "#080808", position: "relative", overflow: "hidden", boxShadow: "0 28px 90px rgba(0,0,0,0.62)" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(57,255,20,0.12), transparent 36%), radial-gradient(circle at 50% 48%, rgba(255,255,255,0.08), transparent 34%)" }} />
              {!videoFailed && (
                <video
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setVideoFailed(true)}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "#050505" }}
                >
                  <source src={VIDEO_MP4} type="video/mp4" />
                  <source src={VIDEO_MOV} type="video/quicktime" />
                </video>
              )}

              {videoFailed && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 34 }}>
                  <div style={{ width: 88, height: 88, borderRadius: "50%", border: "1px solid rgba(57,255,20,0.34)", display: "flex", alignItems: "center", justifyContent: "center", color: "#39FF14", boxShadow: "0 0 36px rgba(57,255,20,0.12)" }}>
                    <Play size={34} fill="currentColor" />
                  </div>
                  <div className="tv-fa" style={{ marginTop: 28, color: "#fff", fontSize: 54, lineHeight: 0.92, textTransform: "uppercase" }}>
                    Resumen<br />semanal
                  </div>
                  <div style={{ marginTop: 18, color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", lineHeight: 1.8 }}>
                    Video Tavus listo para integrarse<br />Mexico Charts
                  </div>
                </div>
              )}

              <div style={{ position: "absolute", left: 18, right: 18, bottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, pointerEvents: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: "rgba(0,0,0,0.52)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
                  <img src={LOGO} alt="Mexico Charts" style={{ height: 28, objectFit: "contain" }} />
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 8, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                    Resumen semanal
                  </span>
                </div>
                <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", padding: "9px 11px", background: "rgba(0,0,0,0.52)", border: "1px solid rgba(57,255,20,0.18)" }}>
                  En vivo
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="tv-lower" style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 1, borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.06)", padding: 0 }}>
          <div style={{ background: "#070707", padding: "54px 56px" }}>
            <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 900, letterSpacing: "0.36em", textTransform: "uppercase", marginBottom: 18 }}>
              Bloque en homepage
            </div>
            <div className="tv-fa" style={{ color: "#fff", fontSize: 54, lineHeight: 0.9, textTransform: "uppercase", marginBottom: 26 }}>
              Una capa<br />más humana<br />para los datos
            </div>
            <p style={{ color: "rgba(255,255,255,0.56)", fontSize: 14, lineHeight: 1.75, maxWidth: 560 }}>
              El video funciona mejor como módulo editorial: debajo del hero o dentro de una sección de resumen semanal, acompañado por señales rápidas que expliquen qué cambió en charts, YouTube y momentum
            </p>
          </div>

          <div style={{ background: "#080808", padding: "54px 56px", display: "grid", alignContent: "center", gap: 12 }}>
            {SIGNALS.map((signal, index) => {
              const Icon = index === 0 ? BarChart3 : index === 1 ? RadioTower : Sparkles;
              return (
                <motion.div
                  key={signal.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08, duration: 0.5 }}
                  className="tv-signal-row"
                  style={{ display: "grid", gridTemplateColumns: "42px 1fr auto", gap: 18, alignItems: "center", padding: "18px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <div style={{ width: 34, height: 34, border: "1px solid rgba(57,255,20,0.24)", color: "#39FF14", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={17} />
                  </div>
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase" }}>{signal.label}</div>
                    <div className="tv-fa" style={{ color: "#fff", fontSize: 26, textTransform: "uppercase", lineHeight: 1.05, marginTop: 3 }}>{signal.value}</div>
                  </div>
                  <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "right" }}>{signal.sub}</div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
