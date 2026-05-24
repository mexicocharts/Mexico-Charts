import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform, animate, useMotionValue } from "framer-motion";
import { Link } from "wouter";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

import _crowd from "@assets/concertcrowd_1778591170250.jpeg";
import _arena from "@assets/241010_JuniorH_RC_30-2-scaled_1778593369451.jpg";
import _lights from "@assets/556661257_1253304393508985_3929356419242217826_n_1778591705965.jpg";
import _bowl from "@assets/GkFhxFRXQAA-UOD_1778593407114.jpg";
import _stage from "@assets/Junior_H-6.jpg_1778591705965.webp";

const ARTIST_IMG = "https://cdn-images.dzcdn.net/images/artist/dde2bf89c1e8da0aeb94436681bc3aac/1000x1000-000000-80-0-0.jpg";
const BG_HERO = _arena;
const BG_CROWD = _crowd;
const BG_LIGHTS = _lights;
const BG_BOWL = _bowl;
const BG_STAGE = _stage;

const CAREER_GROSS_USD = 192_432_259;
const CAREER_TICKETS = 1_549_513;
const CAREER_SHOWS = 124;
const HEADLINE_REPORTS = 112;
const SUPPORT_REPORTS = 6;
const SELL_THROUGH = 99;
const AVG_TICKETS = 13_835;
const AVG_GROSS = 1_718_145;

const TOURING_PERIOD = "mar 2023 - mayo 2026";
const POLLSTAR_DATE = "5/23/2026";

const TOP_SHOWS = [
  {
    rank: 1,
    venue: "Tecate Pa'l Norte",
    city: "Monterrey, México",
    date: "29-31 mar 2024",
    tickets: "244,940",
    gross: "$26.33M",
    note: "reporte de festival de 3 días",
    img: BG_STAGE,
  },
  {
    rank: 2,
    venue: "Festival ARRE HSBC",
    city: "Ciudad de México, México",
    date: "9-10 sep 2023",
    tickets: "123,381",
    gross: "$8.91M",
    note: "reporte de festival de 2 días",
    img: BG_CROWD,
  },
  {
    rank: 3,
    venue: "United Center",
    city: "Chicago, IL",
    date: "7-9 may 2026",
    tickets: "46,895",
    gross: "$6.84M",
    note: "tres noches de arena",
    img: BG_HERO,
  },
  {
    rank: 4,
    venue: "Foro Sol",
    city: "Ciudad de México, México",
    date: "11 nov 2023",
    tickets: "55,925",
    gross: "$5.00M",
    note: "primer golpe de estadio en Ciudad de México",
    img: BG_LIGHTS,
  },
  {
    rank: 5,
    venue: "Festival de Viña del Mar",
    city: "Viña del Mar, Chile",
    date: "25 feb-1 mar 2024",
    tickets: "85,741",
    gross: "$4.90M",
    note: "reporte de festival de 6 shows",
    img: BG_BOWL,
  },
];

const HEADLINE_SHOWS = [
  { n: "01", venue: "United Center", city: "Chicago, IL", gross: "$6.84M", tickets: "46,895", hi: true },
  { n: "02", venue: "Foro Sol", city: "Ciudad de México, México", gross: "$5.00M", tickets: "55,925", hi: true },
  { n: "03", venue: "Intuit Dome", city: "Inglewood, CA", gross: "$4.67M", tickets: "25,911", hi: false },
  { n: "04", venue: "Honda Center", city: "Anaheim, CA", gross: "$4.65M", tickets: "24,774", hi: false },
  { n: "05", venue: "Dos Equis Pavilion", city: "Dallas, TX", gross: "$3.15M", tickets: "37,658", hi: false },
];

const MARKETS = [
  { n: "01", city: "Chicago", sub: "United Center + Sueños", hi: true },
  { n: "02", city: "Ciudad de México", sub: "Foro Sol + Festival ARRE", hi: true },
  { n: "03", city: "Los Ángeles", sub: "Inglewood / YouTube Theater / Intuit Dome", hi: false },
  { n: "04", city: "Texas", sub: "Dallas, Houston, San Antonio, Austin, Laredo", hi: false },
  { n: "05", city: "California", sub: "San José, Sacramento, Fresno, Anaheim, Palm Desert", hi: false },
  { n: "06", city: "Europa", sub: "Londres, París, Berlín, Barcelona, Ámsterdam, Roma", hi: false },
];

const ERA_CARDS = [
  {
    era: "2023",
    label: "Explosión de taquilla",
    gross: "48 reportes",
    note: "La demanda en arenas y anfiteatros de Estados Unidos llega rápido, con México cerrando el año en escala de estadio y festival",
    stat: "Fechas de mar-dic",
  },
  {
    era: "2024",
    label: "La escala arena se vuelve normal",
    gross: "37 reportes",
    note: "La era Éxodo convierte los llenos en patrón entre Estados Unidos, México y festivales grandes",
    stat: "Pico de la era Éxodo",
  },
  {
    era: "2025",
    label: "Señal global",
    gross: "2 reportes",
    note: "El reporte pasa de prueba norteamericana a salas europeas y cartel global de festival",
    stat: "Ventana europea",
  },
  {
    era: "2026",
    label: "Ruta de arenas",
    gross: "31 reportes",
    note: "La ruta de Live Nation con Tito Double P empuja más de 30 fechas de primavera antes del cierre del reporte",
    stat: "Fechas de ene-may",
  },
];

const COUNTRIES = [
  "Estados Unidos",
  "México",
  "Canadá",
  "Chile",
  "Colombia",
  "Ecuador",
  "España",
  "Reino Unido",
  "Alemania",
  "Francia",
  "Italia",
  "Países Bajos",
  "Bélgica",
  "Finlandia",
  "Rumania",
];

function fmtCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return value.toLocaleString();
}

function AnimCount({ to, prefix = "", suffix = "", decimals = 0 }: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const v = useMotionValue(0);
  const d = useTransform(v, (n) =>
    prefix + (decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()) + suffix
  );
  useEffect(() => {
    const controls = animate(v, to, { duration: 2.2, ease: "easeOut" });
    return controls.stop;
  }, [to, v]);
  return <motion.span>{d}</motion.span>;
}

export default function PesoPlumaProfile() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const heroTextY = useTransform(scrollY, [0, 700], [0, 58]);
  const heroBgY = useTransform(scrollY, [0, 700], [0, 110]);

  return (
    <div style={{ background: "#050505", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#a1a1aa", overflowX: "hidden" }}>
      <PageSEO
        title="Peso Pluma · Perfil de Touring — Mexico Charts"
        description="Perfil de touring de Peso Pluma con datos Pollstar: $192.4M USD, 1.55M boletos y 124 shows reportados entre 2023 y 2026"
        path="/touring/peso-pluma"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,900;1,400;1,600&display=swap');
        .pp-fa { font-family: 'Anton', sans-serif !important; }
        ::selection { background: rgba(57, 255, 20, 0.24); }
        .pp-neon { color: #39FF14; }
        .pp-gold { color: #39FF14; }
        .pp-stat-grid,
        .pp-show-row,
        .pp-market-row,
        .pp-era-grid { flex-wrap: wrap; }
        @media (max-width: 720px) {
          .pp-hero { min-height: 690px !important; }
          .pp-hero-portrait { width: 88% !important; opacity: 0.5; }
          .pp-hero-copy { padding: 38px 24px 54px !important; max-width: none !important; justify-content: flex-end !important; }
          .pp-hero-name { font-size: clamp(4.1rem, 20vw, 5.9rem) !important; margin-bottom: 32px !important; }
          .pp-corner-note, .pp-market-visual { display: none !important; }
          .pp-stat-grid { flex-direction: column !important; align-items: stretch !important; padding: 0 24px !important; gap: 30px !important; }
          .pp-stat-grid > div { text-align: left !important; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 18px !important; }
          .pp-pullquote { align-items: flex-end !important; padding: 56px 24px !important; }
          .pp-footprint-copy { max-width: none !important; padding: 58px 24px !important; }
          .pp-market-city { flex-basis: calc(100% - 44px); font-size: 32px !important; }
          .pp-market-region { width: 100%; padding-left: 44px; }
          .pp-section-heading { padding: 56px 24px 30px !important; }
          .pp-show-card { height: auto !important; min-height: 270px; }
          .pp-show-row { align-items: flex-end !important; padding: 24px !important; gap: 20px !important; }
          .pp-show-title { flex-basis: 100%; }
          .pp-show-metrics { width: 100%; justify-content: flex-start !important; gap: 28px !important; }
          .pp-era-grid { grid-template-columns: 1fr !important; padding: 0 24px !important; }
          .pp-footer { padding: 20px 24px !important; flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      ` }} />

      <SiteNav />

      <section ref={heroRef} className="pp-hero" style={{ position: "relative", height: "calc(100vh - 56px)", minHeight: 610, overflow: "hidden" }}>
        <motion.img src={BG_HERO} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "114%", objectFit: "cover", objectPosition: "center 54%", y: heroBgY, filter: "brightness(0.34) saturate(0.85)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(5,5,5,0.98) 22%, rgba(5,5,5,0.72) 54%, rgba(5,5,5,0.15) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 19% 60%, rgba(57,255,20,0.11) 0%, transparent 54%), radial-gradient(ellipse at 85% 20%, rgba(57,255,20,0.10) 0%, transparent 44%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #050505 0%, rgba(5,5,5,0.22) 34%, transparent 70%)" }} />

        <div className="pp-hero-portrait" style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%" }}>
          <img src={ARTIST_IMG} alt="Peso Pluma" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "brightness(0.72) contrast(1.06) saturate(0.9)", maskImage: "linear-gradient(to left, rgba(0,0,0,0.9) 28%, rgba(0,0,0,0.36) 66%, transparent 94%)", WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.9) 28%, rgba(0,0,0,0.36) 66%, transparent 94%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #050505 0%, transparent 28%)" }} />
        </div>

        <motion.div className="pp-hero-copy" style={{ position: "relative", zIndex: 10, padding: "0 52px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 700, y: heroTextY }}>
          <Link href="/touring">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.5 }} style={{ color: "rgba(255,255,255,0.48)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 18, cursor: "pointer" }}>
              ← Touring
            </motion.div>
          </Link>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.6 }} style={{ color: "#39FF14", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 22 }}>
            Perfil de Touring · Doble P
          </motion.div>
          <motion.h1 className="pp-fa pp-hero-name" initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.85 }} style={{ color: "#fff", fontSize: "clamp(4.2rem, 16vw, 116px)", lineHeight: 0.84, textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 40 }}>
            Peso<br />Pluma
          </motion.h1>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.9 }}>
            <div style={{ color: "rgba(255,255,255,0.58)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 10 }}>
              Taquilla total reportada · {TOURING_PERIOD}
            </div>
            <div className="pp-fa" style={{ color: "#39FF14", fontSize: "clamp(3.6rem, 15vw, 88px)", lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 10 }}>
              $<AnimCount to={192.4} decimals={1} />M
            </div>
            <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
              {["USD · Pollstar", `${CAREER_SHOWS} shows`, "1.55M boletos", `${SELL_THROUGH}% vendido`].map((item) => (
                <div key={item} style={{ color: "rgba(255,255,255,0.52)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em" }}>
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        <motion.div className="pp-corner-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.8 }} style={{ position: "absolute", top: 52, right: 52, zIndex: 10, textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", lineHeight: 2.1, fontWeight: 600 }}>
            Corridos tumbados<br />convertidos en<br />negocio de arenas
          </div>
        </motion.div>
      </section>

      <section style={{ position: "relative", padding: "80px 0", overflow: "hidden" }}>
        <img src={BG_LIGHTS} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.16) saturate(0.72)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, #050505 0%, rgba(5,5,5,0.1) 16%, rgba(5,5,5,0.1) 84%, #050505 100%)" }} />
        <div className="pp-stat-grid" style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 48px", flexWrap: "wrap", gap: 36 }}>
          {[
            { value: "$192.4M", label: "Taquilla total", sub: "Pollstar · 2023-2026" },
            { value: "1.55M", label: "Boletos vendidos", sub: `${CAREER_SHOWS} shows totales` },
            { value: "99%", label: "Promedio vendido", sub: `${HEADLINE_REPORTS} reportes titulares` },
            { value: "$1.72M", label: "Promedio por show", sub: `${fmtCompact(AVG_TICKETS)} boletos promedio` },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.7 }} style={{ textAlign: "center", padding: "0 20px" }}>
              <div className="pp-fa" style={{ color: i === 0 ? "#39FF14" : "#fff", fontSize: 52, lineHeight: 1, marginBottom: 14 }}>{s.value}</div>
              <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.22em", marginBottom: 5 }}>{s.label}</div>
              <div style={{ color: "rgba(255,255,255,0.46)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em" }}>{s.sub}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section style={{ position: "relative", height: 470, overflow: "hidden" }}>
        <img src={BG_CROWD} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 62%", filter: "brightness(0.28) saturate(0.68)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, #050505 0%, rgba(5,5,5,0.18) 18%, rgba(5,5,5,0.18) 82%, #050505 100%)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(to bottom, transparent, #39FF14, #39FF14, transparent)" }} />
        <div className="pp-pullquote" style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 68px" }}>
          <div style={{ maxWidth: 860 }}>
            <motion.div className="pp-fa" initial={{ opacity: 0, y: 44 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.95 }} style={{ color: "#fff", fontSize: "clamp(2.8rem, 11vw, 66px)", textTransform: "uppercase", lineHeight: 0.88, letterSpacing: "0.02em" }}>
              De viral<br />a arena<br /><span style={{ color: "#39FF14" }}>en tres años</span>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.45, duration: 0.8 }} style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 30, maxWidth: 620, lineHeight: 1.88 }}>
              Pollstar reporta $192.4M y 1.55M boletos vendidos entre marzo de 2023 y mayo de 2026: una conversión rápida de corridos tumbados, carteles de festival y arenas llenas
            </motion.div>
          </div>
        </div>
      </section>

      <section style={{ position: "relative", overflow: "hidden" }}>
        <div className="pp-market-visual" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "42%", zIndex: 0 }}>
          <img src={BG_BOWL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", filter: "brightness(0.36) saturate(0.65)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, #050505 0%, rgba(5,5,5,0.48) 30%, rgba(5,5,5,0) 70%)" }} />
        </div>
        <div className="pp-footprint-copy" style={{ position: "relative", zIndex: 10, padding: "76px 0 76px 56px", maxWidth: "61%" }}>
          <div style={{ color: "rgba(57,255,20,0.56)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 42 }}>
            Mapa de mercados · reportes titulares y festival
          </div>
          {MARKETS.map((row, i) => (
            <motion.div key={row.city} initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.55 }}>
              <div style={{ height: 1, background: row.hi ? "rgba(57,255,20,0.24)" : "rgba(255,255,255,0.055)" }} />
              <div className="pp-market-row" style={{ display: "flex", alignItems: "center", gap: 22, padding: "14px 0" }}>
                <span style={{ color: row.hi ? "#39FF14" : "rgba(57,255,20,0.34)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", minWidth: 26, flexShrink: 0 }}>{row.n}</span>
                <span className="pp-fa pp-market-city" style={{ color: row.hi ? "#fff" : "rgba(255,255,255,0.72)", fontSize: row.hi ? 40 : 32, textTransform: "uppercase", lineHeight: 1, flex: 1 }}>{row.city}</span>
                <span className="pp-market-region" style={{ color: "rgba(255,255,255,0.48)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, flexShrink: 0 }}>{row.sub}</span>
              </div>
            </motion.div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.055)" }} />
          <div style={{ marginTop: 32 }}>
            <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.24em", marginBottom: 12 }}>
              Países y territorios en el reporte ({COUNTRIES.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COUNTRIES.map((country) => (
                <span key={country} style={{ background: "rgba(57,255,20,0.055)", border: "1px solid rgba(57,255,20,0.13)", color: "rgba(255,255,255,0.58)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 10px" }}>
                  {country}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ position: "relative", padding: "0 0 82px" }}>
        <div className="pp-section-heading" style={{ padding: "74px 56px 40px" }}>
          <div style={{ color: "rgba(57,255,20,0.55)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 14 }}>
            Noches más grandes reportadas · PDF Pollstar
          </div>
          <div className="pp-fa" style={{ color: "#fff", fontSize: 46, textTransform: "uppercase", lineHeight: 0.88 }}>
            Escala festival,<br />control arena
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TOP_SHOWS.map((show, i) => (
            <motion.div key={`${show.venue}-${show.date}`} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.09, duration: 0.68 }} className="pp-show-card" style={{ position: "relative", height: 184, overflow: "hidden" }}>
              <img src={show.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 52%", filter: "brightness(0.34) saturate(0.68)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(5,5,5,0.94) 0%, rgba(5,5,5,0.58) 54%, rgba(5,5,5,0.12) 100%)" }} />
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: i === 0 ? 3 : 1, background: i === 0 ? "#39FF14" : "rgba(57,255,20,0.22)" }} />
              <div className="pp-show-row" style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 52px", gap: 32, justifyContent: "space-between" }}>
                <div className="pp-show-title" style={{ display: "flex", alignItems: "center", gap: 28 }}>
                  <span className="pp-fa" style={{ color: i === 0 ? "#39FF14" : "rgba(255,255,255,0.42)", fontSize: 50, lineHeight: 1, flexShrink: 0 }}>{show.rank}</span>
                  <div>
                    <div className="pp-fa" style={{ color: "#fff", fontSize: 24, textTransform: "uppercase", lineHeight: 1.1 }}>{show.venue}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>
                      {show.city} · {show.date}
                    </div>
                    <div style={{ color: i === 0 ? "rgba(57,255,20,0.72)" : "rgba(255,255,255,0.46)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 }}>
                      {show.note}
                    </div>
                  </div>
                </div>
                <div className="pp-show-metrics" style={{ display: "flex", gap: 42, justifyContent: "flex-end", flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Boletos</div>
                    <div className="pp-fa" style={{ color: "#fff", fontSize: 20 }}>{show.tickets}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Taquilla USD</div>
                    <div className="pp-fa" style={{ color: i === 0 ? "#39FF14" : "#fff", fontSize: 20 }}>{show.gross}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section style={{ position: "relative", background: "#070707", borderTop: "1px solid rgba(57,255,20,0.07)", borderBottom: "1px solid rgba(57,255,20,0.07)", padding: "74px 0 86px" }}>
        <div className="pp-section-heading" style={{ padding: "0 56px 34px" }}>
          <div style={{ color: "rgba(57,255,20,0.65)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 14 }}>
            Solo titulares
          </div>
          <div className="pp-fa" style={{ color: "#fff", fontSize: 42, textTransform: "uppercase", lineHeight: 0.9 }}>
            Las salas<br />que domina
          </div>
        </div>
        <div style={{ padding: "0 56px", display: "grid", gap: 10 }}>
          {HEADLINE_SHOWS.map((show, i) => (
            <motion.div key={show.venue} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.55 }} style={{ display: "grid", gridTemplateColumns: "42px 1fr auto auto", gap: 18, alignItems: "center", padding: "18px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ color: show.hi ? "#39FF14" : "rgba(57,255,20,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.16em" }}>{show.n}</div>
              <div>
                <div className="pp-fa" style={{ color: "#fff", fontSize: 24, textTransform: "uppercase", lineHeight: 1 }}>{show.venue}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", marginTop: 4 }}>{show.city}</div>
              </div>
              <div style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: 800 }}>{show.tickets}</div>
              <div className="pp-fa" style={{ color: show.hi ? "#39FF14" : "#fff", fontSize: 22 }}>{show.gross}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section style={{ position: "relative", padding: "88px 0 108px", overflow: "hidden" }}>
        <img src={BG_STAGE} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.13) saturate(0.55)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, #050505 0%, rgba(5,5,5,0.16) 14%, rgba(5,5,5,0.16) 86%, #050505 100%)" }} />
        <div className="pp-section-heading" style={{ position: "relative", zIndex: 10, padding: "0 56px 46px" }}>
          <div style={{ color: "rgba(57,255,20,0.52)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 14 }}>
            Reportes por año · {TOURING_PERIOD}
          </div>
          <div className="pp-fa" style={{ color: "#fff", fontSize: 46, textTransform: "uppercase", lineHeight: 0.88 }}>
            Tres años<br />de despegue en taquilla
          </div>
        </div>
        <div className="pp-era-grid" style={{ position: "relative", zIndex: 10, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 1, padding: "0 56px" }}>
          {ERA_CARDS.map((era, i) => (
            <motion.div key={era.era} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.65 }} style={{ background: "rgba(8,8,8,0.72)", border: "1px solid rgba(255,255,255,0.06)", padding: "28px 24px 30px", minHeight: 260 }}>
              <div className="pp-fa" style={{ color: i === 3 ? "#39FF14" : "rgba(255,255,255,0.76)", fontSize: 42, lineHeight: 1, marginBottom: 12 }}>{era.era}</div>
              <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 16 }}>{era.label}</div>
              <div className="pp-fa" style={{ color: "#fff", fontSize: 28, lineHeight: 1.05, marginBottom: 16 }}>{era.gross}</div>
              <div style={{ color: "rgba(255,255,255,0.46)", fontSize: 11, lineHeight: 1.65, marginBottom: 20 }}>{era.note}</div>
              <div style={{ color: "rgba(57,255,20,0.58)", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.16em" }}>{era.stat}</div>
            </motion.div>
          ))}
        </div>
        <div style={{ position: "relative", zIndex: 10, color: "rgba(255,255,255,0.44)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", padding: "30px 56px 0", lineHeight: 1.8 }}>
          Fuente: reporte Pollstar Tour History comprado el {POLLSTAR_DATE} · Las tarjetas cuentan reportes por fecha de inicio: 48 + 37 + 2 + 31 = 118 · Total Pollstar: {CAREER_SHOWS} shows; reportes titulares: {HEADLINE_REPORTS}; reportes de soporte: {SUPPORT_REPORTS}
        </div>
      </section>

      <section style={{ position: "relative", height: 360, overflow: "hidden" }}>
        <img src={BG_CROWD} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 65%", filter: "brightness(0.20) saturate(0.6)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, #050505 0%, rgba(5,5,5,0) 30%, rgba(5,5,5,0) 62%, #050505 100%)" }} />
        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ color: "rgba(57,255,20,0.58)", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.44em", marginBottom: 20 }}>
            Perfil de Touring · Doble P
          </div>
          <div className="pp-fa" style={{ color: "#fff", fontSize: 76, textTransform: "uppercase", lineHeight: 0.9, letterSpacing: "0.07em" }}>
            Peso Pluma
          </div>
          <div style={{ width: 36, height: 1, background: "#39FF14", margin: "20px auto" }} />
          <img src={`${import.meta.env.BASE_URL}mexico-charts-logo.png`} alt="Mexico Charts" style={{ height: 64, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(57,255,20,0.28))", opacity: 0.86 }} />
        </div>
      </section>

      <footer className="pp-footer" style={{ padding: "22px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap", gap: 12 }}>
        <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          © 2026 Mexico Charts · Datos provistos por Pollstar Research
        </div>
        <div style={{ color: "rgba(255,255,255,0.46)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          {CAREER_SHOWS} shows · ${CAREER_GROSS_USD.toLocaleString()} USD · {CAREER_TICKETS.toLocaleString()} boletos
        </div>
        <Link href="/touring">
          <span style={{ color: "rgba(57,255,20,0.62)", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", cursor: "pointer" }}>
            ← Volver a Touring
          </span>
        </Link>
      </footer>
    </div>
  );
}
