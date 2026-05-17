import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, animate, useMotionValue } from "framer-motion";
import { Link } from "wouter";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

import _imgArena    from "@assets/Junior-THS-09-1024x683_1778591170250.jpg";
import _imgCrowd    from "@assets/concertcrowd_1778591170250.jpeg";
import _imgStage1   from "@assets/Junior_H2-2_1778591170250.jpg";
import _imgStage2   from "@assets/DSC06007-Edit.jpg_1778591170250.webp";
import _imgPortrait from "@assets/31f837484b7ef9fc9b4b56589d6da178_1778591170250.jpg";
import _imgBlueArena from "@assets/536273332_1218148096783736_815010960571842960_n_1778591705965.jpg";
import _imgPyro     from "@assets/Junior_H-6.jpg_1778591705965.webp";
import _imgLasers   from "@assets/556661257_1253304393508985_3929356419242217826_n_1778591705965.jpg";
import _imgBMO      from "@assets/241010_JuniorH_RC_30-2-scaled_1778593369451.jpg";
import _imgBowl     from "@assets/GkFhxFRXQAA-UOD_1778593407114.jpg";
import _imgAmphitheater from "@assets/540747277_1217439643521248_6039852340396170805_n_1778593413055.jpg";

const BG_HERO      = _imgArena;
const BG_CROWD     = _imgCrowd;
const BG_STAGE     = _imgStage1;
const BG_LIGHTS    = _imgStage2;
const BG_FOOTPRINT = _imgLasers;
const BG_CLOSE     = _imgPyro;
const ARTIST_IMG   = _imgPortrait;
const MARKET_IMG   = _imgBlueArena;
const SHOW_IMG_1   = _imgBMO;
const SHOW_IMG_2   = _imgBowl;
const SHOW_IMG_3   = _imgAmphitheater;

function AnimCount({ to, prefix = "", suffix = "", decimals = 0 }: {
  to: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const v = useMotionValue(0);
  const d = useTransform(v, (n) =>
    prefix + (decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()) + suffix
  );
  useEffect(() => { const c = animate(v, to, { duration: 2.2, ease: "easeOut" }); return c.stop; }, []);
  return <motion.span>{d}</motion.span>;
}

const topShows = [
  { rank: 1, venue: "BMO Stadium",                  city: "Los Ángeles, CA",    date: "Oct 2024",  tickets: "43,658", gross: "$6.78M", img: SHOW_IMG_1 },
  { rank: 2, venue: "Hollywood Bowl",                city: "Los Ángeles, CA",    date: "Nov 2025",  tickets: "33,373", gross: "$5.45M", img: SHOW_IMG_2 },
  { rank: 3, venue: "Credit Union 1 Amphitheatre",   city: "Tinley Park, IL",    date: "Ago 2025",  tickets: "37,251", gross: "$4.35M", img: SHOW_IMG_3 },
];

export default function TouringProfile() {
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const heroBgY   = useTransform(scrollY, [0, 600], [0, 120]);
  const heroTextY = useTransform(scrollY, [0, 600], [0, 60]);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ background: "#060606", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#9ca3af", overflowX: "hidden" }}>
      <PageSEO
        title="Junior H · Touring Profile — Mexico Charts"
        description="Perfil de touring de Junior H con historial de conciertos, cifras de boletaje, gross y mercados clave."
        path="/touring/junior-h"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,900;1,400;1,600&display=swap');
        .tp-fa { font-family: 'Anton', sans-serif !important; }
        ::selection { background: rgba(57,255,20,0.25); }
        .tp-stat-strip { flex-wrap: wrap; gap: 32px 12px; }
        .tp-stat-item { flex: 1 1 170px; }
        .tp-market-row,
        .tp-show-row-inner,
        .tp-show-title,
        .tp-show-metrics,
        .tp-market-metrics { flex-wrap: wrap; }
        .tp-timeline-grid { grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 24px 16px; }
        @media (max-width: 720px) {
          .tp-hero { min-height: 660px !important; }
          .tp-hero-portrait { width: 84% !important; opacity: 0.5; }
          .tp-hero-copy { padding: 38px 24px 52px !important; max-width: none !important; justify-content: flex-end !important; }
          .tp-hero-kicker { letter-spacing: 0.28em !important; }
          .tp-hero-name { font-size: clamp(4.7rem, 22vw, 6.2rem) !important; margin-bottom: 28px !important; }
          .tp-corner-note, .tp-market-visual { display: none !important; }
          .tp-padded { padding-left: 24px !important; padding-right: 24px !important; }
          .tp-pullquote { align-items: flex-end !important; padding: 56px 24px !important; }
          .tp-stat-strip { flex-direction: column !important; align-items: stretch !important; padding: 0 24px !important; }
          .tp-stat-item { padding: 0 0 20px !important; text-align: left !important; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .tp-footprint-copy { max-width: none !important; padding: 56px 24px !important; }
          .tp-market-row { align-items: flex-start !important; gap: 10px !important; }
          .tp-market-city { flex-basis: calc(100% - 44px); font-size: 34px !important; }
          .tp-market-region { width: 100%; padding-left: 44px; }
          .tp-section-heading { padding: 0 24px 32px !important; }
          .tp-show-card { height: auto !important; min-height: 252px; }
          .tp-show-row-inner { align-items: flex-end !important; padding: 24px !important; gap: 20px !important; }
          .tp-show-title { align-items: flex-start !important; gap: 16px !important; }
          .tp-show-title > span { font-size: 42px !important; }
          .tp-show-title .tp-fa div:first-child { font-size: 23px !important; }
          .tp-show-metrics { width: 100%; gap: 28px !important; justify-content: flex-start; }
          .tp-show-metrics > div { text-align: left !important; }
          .tp-market-impact { height: auto !important; min-height: 520px; }
          .tp-market-impact-copy { padding: 72px 24px !important; }
          .tp-market-metrics { gap: 28px !important; }
          .tp-timeline-wrap { padding: 0 24px !important; }
          .tp-timeline-track {
            overflow: visible;
            padding-top: 12px;
            padding-bottom: 12px;
            scrollbar-width: none;
          }
          .tp-timeline-track::-webkit-scrollbar { display: none; }
          .tp-timeline-line { width: 100% !important; right: 0 !important; }
          .tp-timeline-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            min-width: 0;
            gap: 0 8px;
            padding-right: 0;
          }
          .tp-timeline-year { font-size: 22px !important; }
          .tp-timeline-stat { font-size: 10px !important; }
          .tp-timeline-gross { font-size: 17px !important; }
          .tp-timeline-badge { letter-spacing: 0.08em !important; padding: 2px 5px !important; }
          .tp-closing-title { font-size: clamp(3.5rem, 17vw, 4.75rem) !important; }
          .tp-footer { padding: 20px 24px !important; flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      ` }} />

      <SiteNav />

      {/* ══════════════════════════════════════════
          1. CINEMATIC HERO
      ══════════════════════════════════════════ */}
      <section ref={heroRef} className="tp-hero" style={{ position: "relative", height: "calc(100vh - 56px)", minHeight: 580, overflow: "hidden" }}>
        <motion.img src={BG_HERO} alt="" style={{
          position: "absolute", inset: 0, width: "100%", height: "115%",
          objectFit: "cover", objectPosition: "center 55%", y: heroBgY,
        }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,0.97) 28%, rgba(6,6,6,0.55) 58%, rgba(6,6,6,0.1) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(6,6,6,1) 0%, rgba(6,6,6,0.4) 30%, transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 60%, rgba(57,255,20,0.04) 0%, transparent 55%)" }} />

        <div className="tp-hero-portrait" style={{ position: "absolute", right: 0, top: 0, width: "52%", height: "100%" }}>
          <img src={ARTIST_IMG} alt="" style={{
            width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top",
            maskImage: "linear-gradient(to left, rgba(0,0,0,0.6) 20%, transparent 90%)",
            WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.6) 20%, transparent 90%)",
            filter: "brightness(0.72)",
          }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 40% 55%, rgba(57,255,20,0.10) 0%, transparent 60%)" }} />
        </div>

        <motion.div className="tp-hero-copy" style={{ position: "relative", zIndex: 10, padding: "0 48px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 640, y: heroTextY }}>
          {/* Back breadcrumb */}
          <Link href="/touring">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.5 }}
              style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 16, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              ← Touring
            </motion.div>
          </Link>
          <motion.div className="tp-hero-kicker" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
            style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 20 }}>
            Touring Profile
          </motion.div>
          <motion.h1 className="tp-fa tp-hero-name" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
            style={{ color: "#fff", fontSize: "clamp(4.25rem, 17vw, 120px)", lineHeight: 0.85, textTransform: "uppercase", letterSpacing: "0.01em", marginBottom: 36 }}>
            Junior<br />H
          </motion.h1>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 8 }}>
              Gross Reportado · Carrera Total
            </div>
            <div className="tp-fa" style={{ color: "#39FF14", fontSize: "clamp(3.8rem, 16vw, 92px)", lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 8 }}>
              $<AnimCount to={90.4} decimals={1} />M
            </div>
            <div style={{ color: "rgba(255,255,255,0.58)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.25em" }}>
              USD en Taquilla · 2022–2026
            </div>
          </motion.div>
        </motion.div>

        <motion.div className="tp-corner-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}
          style={{ position: "absolute", top: 48, right: 48, zIndex: 10, textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", lineHeight: 2, fontWeight: 500 }}>
            De la Calle<br />a los Escenarios<br />Más Grandes
          </div>
        </motion.div>

        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}
            style={{ width: 1, height: 40, background: "linear-gradient(to bottom, rgba(57,255,20,0.6), transparent)", margin: "0 auto" }} />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          2. SINGLE-STAT MOMENT — "69 SHOWS"
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 420, overflow: "hidden" }}>
        <img src={BG_CROWD} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 65%", filter: "brightness(0.42) saturate(0.78)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.15) 18%, rgba(6,6,6,0.15) 82%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(57,255,20,0.07) 0%, transparent 65%)" }} />
        <div className="tp-padded" style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 48px" }}>
          <div style={{ color: "rgba(57,255,20,0.6)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 12 }}>Total Reportado</div>
          <div className="tp-fa" style={{ color: "#fff", fontSize: "clamp(5.5rem, 24vw, 148px)", lineHeight: 0.85, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
            {mounted ? <AnimCount to={69} /> : "69"}
          </div>
          <div className="tp-fa" style={{ color: "#39FF14", fontSize: 32, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 12 }}>Shows</div>
          <div style={{ color: "rgba(255,255,255,0.58)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.25em", marginTop: 16 }}>EUA & México · 4 Años de Gira</div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. ATMOSPHERIC PULLQUOTE
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 480, overflow: "hidden" }}>
        <img src={BG_STAGE} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%", filter: "brightness(0.30) saturate(0.65)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.2) 16%, rgba(6,6,6,0.2) 84%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(to bottom, transparent, #39FF14, transparent)" }} />
        <div className="tp-pullquote" style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 64px" }}>
          <div style={{ maxWidth: 800 }}>
            <motion.div className="tp-fa"
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9 }}
              style={{ color: "#fff", fontSize: "clamp(3rem, 12vw, 72px)", textTransform: "uppercase", lineHeight: 0.88, letterSpacing: "0.02em" }}>
              México en los<br />Escenarios<br /><span style={{ color: "#39FF14" }}>del Mundo</span>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5, duration: 0.8 }}
              style={{ color: "rgba(255,255,255,0.58)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 28, maxWidth: 440, lineHeight: 1.8 }}>
              Junior H llevó el sad sierreño a los escenarios más grandes de Estados Unidos — consolidando un nuevo estándar para el género.
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. FLOATING STATS
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "80px 0", overflow: "hidden" }}>
        <img src={BG_LIGHTS} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.20) saturate(0.65)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.1) 14%, rgba(6,6,6,0.1) 86%, rgba(6,6,6,1) 100%)" }} />
        <div className="tp-stat-strip" style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 48px" }}>
          {[
            { value: "758K",   label: "Tickets Vendidos",   sub: "Total reportado" },
            { value: "11,856", label: "Asistencia Promedio", sub: "Por show" },
            { value: "98%",    label: "Sell-Through",        sub: "Porcentaje vendido" },
            { value: "$1.41M", label: "Promedio por Show",   sub: "Gross neto" },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.7 }}
              className="tp-stat-item"
              style={{ textAlign: "center", padding: "0 24px" }}>
              <div className="tp-fa" style={{ color: "#fff", fontSize: 56, lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 12 }}>{s.value}</div>
              <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: "rgba(255,255,255,0.52)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em" }}>{s.sub}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. TOURING FOOTPRINT — city editorial
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="tp-market-visual" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "46%", zIndex: 0 }}>
          <img src={BG_FOOTPRINT} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 55%", filter: "brightness(0.44) saturate(0.78)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,1) 0%, rgba(6,6,6,0.45) 30%, rgba(6,6,6,0.0) 70%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,0.7) 0%, transparent 16%, transparent 84%, rgba(6,6,6,0.7) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 60% 50%, rgba(57,255,20,0.06) 0%, transparent 60%)" }} />
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.8, duration: 0.9 }}
            style={{ position: "absolute", bottom: 64, right: 64, textAlign: "right", zIndex: 2 }}>
            <div style={{ color: "rgba(57,255,20,0.5)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.35em", marginBottom: 20 }}>Distribución de Mercados</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div className="tp-fa" style={{ color: "#39FF14", fontSize: 64, lineHeight: 1 }}>87%</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em" }}>Shows en Estados Unidos</div>
              </div>
              <div>
                <div className="tp-fa" style={{ color: "#fff", fontSize: 40, lineHeight: 1 }}>9%</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em" }}>Shows en México</div>
              </div>
              <div style={{ marginTop: 4 }}>
                <div className="tp-fa" style={{ color: "rgba(255,255,255,0.7)", fontSize: 24, lineHeight: 1 }}>EUA y México</div>
                <div style={{ color: "rgba(255,255,255,0.52)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em" }}>Gira 2022–2026</div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="tp-footprint-copy" style={{ position: "relative", zIndex: 10, padding: "72px 0 72px 56px", maxWidth: "58%" }}>
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            style={{ color: "rgba(57,255,20,0.55)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 40 }}>
            Mercados Principales · 2022–2026
          </motion.div>
          {[
            { n: "01", city: "Los Ángeles",      sub: "California, EUA",    hi: true  },
            { n: "02", city: "Dallas",            sub: "Texas, EUA",         hi: false },
            { n: "03", city: "Chicago",           sub: "Illinois, EUA",      hi: false },
            { n: "04", city: "Houston",           sub: "Texas, EUA",         hi: false },
            { n: "05", city: "Las Vegas",         sub: "Nevada, EUA",        hi: false },
            { n: "06", city: "Ciudad de México",  sub: "México",             hi: false },
            { n: "07", city: "Phoenix",           sub: "Arizona, EUA",       hi: false },
            { n: "08", city: "San Jose",          sub: "California, EUA",    hi: false },
          ].map((row, i) => (
            <motion.div key={row.city}
              initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.55, ease: "easeOut" }}>
              <div style={{ height: 1, background: i === 0 ? "rgba(57,255,20,0.25)" : "rgba(255,255,255,0.06)" }} />
              <div className="tp-market-row" style={{ display: "flex", alignItems: "center", gap: 20, padding: "18px 0" }}>
                <span style={{ color: row.hi ? "#39FF14" : "rgba(57,255,20,0.3)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", minWidth: 24, flexShrink: 0 }}>{row.n}</span>
                <span className="tp-fa tp-market-city" style={{ color: row.hi ? "#fff" : "rgba(255,255,255,0.75)", fontSize: row.hi ? 44 : 36, textTransform: "uppercase", lineHeight: 1, flex: 1 }}>{row.city}</span>
                <span className="tp-market-region" style={{ color: "rgba(255,255,255,0.52)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, flexShrink: 0 }}>{row.sub}</span>
              </div>
            </motion.div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.7, duration: 0.6 }}
            style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 24 }}>
            Por número de shows reportados
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. BIGGEST SHOWS
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "0 0 80px" }}>
        <div className="tp-section-heading" style={{ padding: "0 56px 40px" }}>
          <div style={{ color: "rgba(57,255,20,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 12 }}>Biggest Reported Shows</div>
          <div className="tp-fa" style={{ color: "#fff", fontSize: 44, textTransform: "uppercase", lineHeight: 0.9 }}>Las Noches<br />Más Grandes</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {topShows.map((show, i) => (
            <motion.div key={show.venue}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.7 }}
              className="tp-show-card"
              style={{ position: "relative", height: 180, overflow: "hidden", cursor: "pointer" }}>
              <img src={show.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 65%", filter: "brightness(0.48) saturate(0.82)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,0.88) 0%, rgba(6,6,6,0.5) 50%, rgba(6,6,6,0.12) 100%)" }} />
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: i === 0 ? 3 : 1, background: i === 0 ? "#39FF14" : "rgba(57,255,20,0.2)" }} />
              <div className="tp-show-row-inner" style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 56px", gap: 40, justifyContent: "space-between" }}>
                <div className="tp-show-title" style={{ display: "flex", alignItems: "center", gap: 32 }}>
                  <span className="tp-fa" style={{ color: i === 0 ? "#39FF14" : "rgba(255,255,255,0.48)", fontSize: 52, lineHeight: 1 }}>{show.rank}</span>
                  <div>
                    <div className="tp-fa" style={{ color: "#fff", fontSize: 28, textTransform: "uppercase", lineHeight: 1.1 }}>{show.venue}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>{show.city} · {show.date}</div>
                  </div>
                </div>
                <div className="tp-show-metrics" style={{ display: "flex", gap: 56, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Tickets</div>
                    <div className="tp-fa" style={{ color: "#fff", fontSize: 22 }}>{show.tickets}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Gross</div>
                    <div className="tp-fa" style={{ color: i === 0 ? "#39FF14" : "#fff", fontSize: 22 }}>{show.gross}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. MARKET IMPACT
      ══════════════════════════════════════════ */}
      <section className="tp-market-impact" style={{ position: "relative", height: 520, overflow: "hidden" }}>
        <img src={MARKET_IMG} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%", filter: "brightness(0.34) saturate(0.68)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, rgba(6,6,6,0.92) 38%, rgba(6,6,6,0.5) 65%, rgba(6,6,6,0.18) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,0.6) 0%, transparent 25%, transparent 75%, rgba(6,6,6,0.6) 100%)" }} />
        <div className="tp-market-impact-copy" style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 64px" }}>
          <div>
            <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 20 }}>#Market Impact</div>
            <div className="tp-fa" style={{ color: "#fff", fontSize: "clamp(2.8rem, 11vw, 60px)", textTransform: "uppercase", lineHeight: 0.88, marginBottom: 24 }}>El Poder de<br />la Diáspora</div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, lineHeight: 1.9, maxWidth: 400, marginBottom: 40 }}>
              Junior H construyó su base más sólida en Estados Unidos, donde la demanda por el sad sierreño continúa escalando en arenas y anfiteatros.
            </p>
            <div className="tp-market-metrics" style={{ display: "flex", gap: 56 }}>
              <div>
                <div className="tp-fa" style={{ color: "#39FF14", fontSize: 72, lineHeight: 1 }}>87%</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginTop: 8 }}>Shows en EUA</div>
              </div>
              <div>
                <div className="tp-fa" style={{ color: "#fff", fontSize: 72, lineHeight: 1 }}>9%</div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginTop: 8 }}>Shows en México</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          8. TOUR TIMELINE
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "80px 0 100px", overflow: "hidden" }}>
        <img src={BG_CLOSE} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.16) saturate(0.5)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.15) 14%, rgba(6,6,6,0.15) 86%, rgba(6,6,6,1) 100%)" }} />
        <div className="tp-timeline-wrap" style={{ position: "relative", zIndex: 10, padding: "0 56px" }}>
          <div style={{ color: "rgba(57,255,20,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 12 }}>Tour Timeline</div>
          <div className="tp-fa" style={{ color: "#fff", fontSize: 48, textTransform: "uppercase", lineHeight: 0.9, marginBottom: 56 }}>Crecimiento<br />Año Tras Año</div>
          <div className="tp-timeline-track" style={{ position: "relative", marginBottom: 40 }}>
            <div className="tp-timeline-line" style={{ position: "absolute", top: 10, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <motion.div className="tp-timeline-line" style={{ position: "absolute", top: 10, left: 0, height: 1, background: "linear-gradient(to right, #39FF14, rgba(57,255,20,0.3))" }}
              initial={{ width: 0 }} whileInView={{ width: "100%" }} viewport={{ once: true }}
              transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }} />
            <div className="tp-timeline-grid" style={{ display: "grid", paddingTop: 0 }}>
              {[
                { year: "2022", shows: 12,  tickets: "21K",  gross: "$1.6M",  peak: false },
                { year: "2023", shows: 26,  tickets: "220K", gross: "$21M",   peak: false },
                { year: "2024", shows: 22,  tickets: "140K", gross: "$28M",   peak: false },
                { year: "2025", shows: 24,  tickets: "290K", gross: "$41M",   peak: true, tour: "Sad Boyz Tour" },
              ].map((t, i) => (
                <motion.div key={t.year}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.6 }}>
                  <div style={{ position: "relative", zIndex: 2, marginBottom: 24 }}>
                    <div style={{ width: t.peak ? 22 : 14, height: t.peak ? 22 : 14, borderRadius: "50%", background: t.peak ? "#39FF14" : "rgba(57,255,20,0.15)", border: t.peak ? "none" : "1px solid rgba(57,255,20,0.3)", marginTop: t.peak ? -5 : 0, boxShadow: t.peak ? "0 0 24px rgba(57,255,20,0.5)" : "none" }} />
                  </div>
                  {t.peak && (
                    <div style={{ marginBottom: 10 }}>
                      <span className="tp-timeline-badge" style={{ background: "#39FF14", color: "#000", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", padding: "2px 8px" }}>{t.tour}</span>
                    </div>
                  )}
                  <div className="tp-fa tp-timeline-year" style={{ color: t.peak ? "#39FF14" : "#fff", fontSize: 28, lineHeight: 1, marginBottom: 14 }}>{t.year}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="tp-timeline-stat" style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600 }}>{t.shows} Shows</div>
                    <div className="tp-timeline-stat" style={{ color: "rgba(255,255,255,0.62)", fontSize: 11 }}>{t.tickets} Tickets</div>
                    <div className="tp-fa tp-timeline-gross" style={{ color: t.peak ? "#39FF14" : "rgba(255,255,255,0.9)", fontSize: 20, marginTop: 4 }}>{t.gross}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gross Reportado</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            * Datos provistos por Pollstar Research · No incluye shows no reportados o datos no publicados
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          9. CLOSING
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 360, overflow: "hidden" }}>
        <img src={BG_CROWD} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%", filter: "brightness(0.22) saturate(0.6)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0) 28%, rgba(6,6,6,0) 62%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1, background: "linear-gradient(to right, transparent, rgba(57,255,20,0.35), transparent)" }} />
        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 0 }}>
          <div style={{ color: "rgba(57,255,20,0.55)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.44em", marginBottom: 20 }}>Touring Profile</div>
          <div className="tp-fa tp-closing-title" style={{ color: "#fff", fontSize: 76, textTransform: "uppercase", lineHeight: 0.9, letterSpacing: "0.07em" }}>
            Junior H
          </div>
          <div style={{ width: 36, height: 1, background: "#39FF14", margin: "20px auto" }} />
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <img src={`${import.meta.env.BASE_URL}mexico-charts-logo.png`} alt="Mexico Charts" style={{ height: 64, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(57,255,20,0.3))", opacity: 0.85 }} />
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 7, textTransform: "uppercase", letterSpacing: "0.36em" }}>Touring</div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="tp-footer" style={{ padding: "20px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em" }}>© 2026 Mexico Charts · Datos provistos por Pollstar Research</div>
        <Link href="/touring">
          <span style={{ color: "rgba(57,255,20,0.6)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", cursor: "pointer" }}>← Volver a Touring</span>
        </Link>
        <div style={{ color: "rgba(57,255,20,0.48)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          Fuente: Pollstar Research
        </div>
      </footer>
    </div>
  );
}
