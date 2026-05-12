import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, animate, useMotionValue } from "framer-motion";
import { Link } from "wouter";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

/* ─────────────────────────────────────────────────────────────────────────────
   IMAGES
   Background images: Unsplash (stable)
   Artist portrait: Deezer CDN (stable) — swap hash if needed
────────────────────────────────────────────────────────────────────────────── */
const BG_HERO    = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1400&h=800&fit=crop&q=85";
const BG_CROWD   = "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1400&h=700&fit=crop&q=82";
const BG_STAGE   = "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1400&h=700&fit=crop&q=80";
const BG_STADIUM = "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1400&h=700&fit=crop&q=80";
const BG_LIGHTS  = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1400&h=700&fit=crop&q=80";
const BG_CLOSE   = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1400&h=600&fit=crop&q=80";
const ARTIST_IMG = "https://cdn-images.dzcdn.net/images/artist/b6bbe4ed8f73bf3fdbf5b6f68e7a75e4/1000x1000-000000-80-0-0.jpg";

/* ─────────────────────────────────────────────────────────────────────────────
   POLLSTAR DATA — Luis Miguel Tour History Report (Feb 2023 – Feb 2026)
   Purchased: 2/8/2026 · Shows from 2/1/2023 to 2/8/2026
   Source of truth: Pollstar Tour History Report (PDF attached)
────────────────────────────────────────────────────────────────────────────── */

// SUMMARY (from Pollstar report header — exact values)
const TOTAL_GROSS_USD  = 415849128;   // $415,849,128 USD
const TOTAL_TICKETS    = 2861491;     // 2,861,491 tickets
const TOTAL_SHOWS      = 186;         // 186 total shows
const SELL_THROUGH_PCT = 95;          // 95% sell-through
const AVG_GROSS        = 2260050;     // $2,260,050 avg gross per show
const AVG_ATTENDANCE   = 15552;       // 15,552 avg tickets sold per show

// TOP SHOWS BY GROSS — exact figures from Pollstar PDF
const TOP_SHOWS = [
  {
    rank: 1,
    venue: "Estadio Santiago Bernabéu",
    city: "Madrid, España",
    date: "6 Jul 2024",
    tickets: "45,541",
    gross: "$8.24M",
    sellout: true,
    capacity: "45,541",
    note: "100% vendido",
  },
  {
    rank: 2,
    venue: "Estadio Monumental de Caracas",
    city: "Caracas, Venezuela",
    date: "12 Feb 2024",
    tickets: "35,422",
    gross: "$6.85M",
    sellout: false,
    capacity: "36,013",
    note: "98% vendido",
  },
  {
    rank: 3,
    venue: "Estadio GNP Seguros",
    city: "Ciudad de México, México",
    date: "30 Nov 2024",
    tickets: "56,539",
    gross: "$6.00M",
    sellout: false,
    capacity: "57,874",
    note: "98% vendido · Mayor asistencia",
  },
  {
    rank: 4,
    venue: "Estadio Santiago Bernabéu",
    city: "Madrid, España",
    date: "7 Jul 2024",
    tickets: "43,644",
    gross: "$5.59M",
    sellout: true,
    capacity: "45,541",
    note: "100% vendido",
  },
  {
    rank: 5,
    venue: "Estadio Nacional",
    city: "Lima, Perú",
    date: "25 Feb 2024",
    tickets: "41,263",
    gross: "$5.45M",
    sellout: true,
    capacity: "41,263",
    note: "100% vendido",
  },
];

// TOP MARKETS by number of shows (from PDF data)
const TOP_MARKETS = [
  { n: "01", city: "Ciudad de México",  sub: "México",              hi: true  },
  { n: "02", city: "Buenos Aires",      sub: "Argentina",           hi: false },
  { n: "03", city: "Santiago",          sub: "Chile",               hi: false },
  { n: "04", city: "Las Vegas",         sub: "Nevada, EUA",         hi: false },
  { n: "05", city: "Monterrey",         sub: "México",              hi: false },
  { n: "06", city: "Madrid",            sub: "España",              hi: false },
  { n: "07", city: "Miami",             sub: "Florida, EUA",        hi: false },
  { n: "08", city: "Lima",              sub: "Perú",                hi: false },
];

// TOUR LEGS (from PDF dates — grouped by segment)
const TOUR_LEGS = [
  {
    id: "2023",
    label: "2023",
    name: "Leg 1 · Las Américas",
    period: "Ago–Dic 2023",
    shows: 60,
    grossLabel: "~$115M",
    markets: "Argentina · Chile · EUA · México",
    peak: false,
    note: "Buenos Aires (9 shows) · Santiago (10 shows) · Arenas de EUA · Estadios México",
  },
  {
    id: "2024",
    label: "2024",
    name: "Leg 2 · El Mundo",
    period: "Ene–Dic 2024",
    shows: 126,
    grossLabel: "~$301M",
    markets: "16+ países · 4 continentes",
    peak: true,
    note: "Caribe · Sudamérica · EUA · Canadá · España · México estadios",
  },
];

// COUNTRIES VISITED (from PDF data — only what appears in the report)
const COUNTRIES = [
  "México","Estados Unidos","Argentina","Chile","Perú","Uruguay",
  "Colombia","Venezuela","Ecuador","Brasil","Paraguay","Costa Rica",
  "Nicaragua","Honduras","El Salvador","Guatemala","Rep. Dominicana",
  "Puerto Rico","España","Canadá",
];

/* ─────────────────────────────────────────────────────────────────────────────
   ANIMATED COUNTER
────────────────────────────────────────────────────────────────────────────── */
function AnimCount({ to, prefix = "", suffix = "", decimals = 0 }: {
  to: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const v = useMotionValue(0);
  const d = useTransform(v, (n) =>
    prefix + (decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()) + suffix
  );
  useEffect(() => { const c = animate(v, to, { duration: 2.4, ease: "easeOut" }); return c.stop; }, []);
  return <motion.span>{d}</motion.span>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE COMPONENT
────────────────────────────────────────────────────────────────────────────── */
export default function LuisMiguelProfile() {
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const heroBgY   = useTransform(scrollY, [0, 700], [0, 140]);
  const heroTextY = useTransform(scrollY, [0, 700], [0, 60]);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ background: "#060606", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#9ca3af", overflowX: "hidden" }}>
      <PageSEO
        title="Luis Miguel · Touring Profile — Mexico Charts"
        description="El perfil de gira más completo de Luis Miguel. $415.8M USD en taquilla, 186 shows, 20+ países. Datos Pollstar 2023–2024."
        path="/touring/luis-miguel"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,900;1,400;1,600&display=swap');
        .lm-fa { font-family: 'Anton', sans-serif !important; }
        ::selection { background: rgba(57,255,20,0.25); }
      ` }} />

      <SiteNav />

      {/* ══════════════════════════════════════════
          1. CINEMATIC HERO
      ══════════════════════════════════════════ */}
      <section ref={heroRef} style={{ position: "relative", height: "calc(100vh - 56px)", minHeight: 600, overflow: "hidden" }}>
        <motion.img src={BG_HERO} alt="" style={{
          position: "absolute", inset: 0, width: "100%", height: "115%",
          objectFit: "cover", objectPosition: "center 30%", y: heroBgY,
        }} />
        {/* Deep left-side overlay for text */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,0.98) 30%, rgba(6,6,6,0.6) 60%, rgba(6,6,6,0.08) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(6,6,6,1) 0%, rgba(6,6,6,0.3) 30%, transparent 60%)" }} />
        {/* Gold atmospheric glow — unique to LM */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 18% 55%, rgba(57,255,20,0.035) 0%, transparent 52%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 30%, rgba(255,220,80,0.025) 0%, transparent 55%)" }} />

        {/* Artist portrait — right panel */}
        <div style={{ position: "absolute", right: 0, top: 0, width: "48%", height: "100%" }}>
          <img src={ARTIST_IMG} alt="Luis Miguel"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            style={{
              width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top",
              maskImage: "linear-gradient(to left, rgba(0,0,0,0.5) 15%, transparent 88%)",
              WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.5) 15%, transparent 88%)",
              filter: "brightness(0.68) contrast(1.05)",
            }}
          />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 45% 50%, rgba(57,255,20,0.07) 0%, transparent 60%)" }} />
        </div>

        {/* Hero text */}
        <motion.div style={{ position: "relative", zIndex: 10, padding: "0 52px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 660, y: heroTextY }}>
          <Link href="/touring">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.5 }}
              style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 18, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              ← Touring
            </motion.div>
          </Link>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
            style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 22 }}>
            Touring Profile · El Sol de México
          </motion.div>

          <motion.h1 className="lm-fa" initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.85 }}
            style={{ color: "#fff", fontSize: 112, lineHeight: 0.84, textTransform: "uppercase", letterSpacing: "0.01em", marginBottom: 40 }}>
            Luis<br />Miguel
          </motion.h1>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.9 }}>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 10 }}>
              Gross Total Reportado · 2023–2024
            </div>
            <div className="lm-fa" style={{ color: "#39FF14", fontSize: 88, lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 10 }}>
              $<AnimCount to={415.8} decimals={1} />M
            </div>
            <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em" }}>
                USD en Taquilla
              </div>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.18)" }} />
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em" }}>
                {TOTAL_SHOWS} Shows Reportados
              </div>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.18)" }} />
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em" }}>
                20+ Países
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Top-right editorial tag */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.8 }}
          style={{ position: "absolute", top: 52, right: 52, zIndex: 10, textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", lineHeight: 2.1, fontWeight: 500 }}>
            La Gira Más Grande<br />de un Artista<br />Mexicano en la Historia.
          </div>
        </motion.div>

        {/* Scroll cue */}
        <div style={{ position: "absolute", bottom: 34, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
          <motion.div animate={{ y: [0, 9, 0] }} transition={{ repeat: Infinity, duration: 1.9 }}
            style={{ width: 1, height: 44, background: "linear-gradient(to bottom, rgba(57,255,20,0.55), transparent)", margin: "0 auto" }} />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          2. IMPACT STAT — 2.86M Fans
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 440, overflow: "hidden" }}>
        <img src={BG_CROWD} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 38%", filter: "brightness(0.38) saturate(0.7)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.12) 18%, rgba(6,6,6,0.12) 80%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(57,255,20,0.06) 0%, transparent 62%)" }} />

        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 48px" }}>
          <div style={{ color: "rgba(57,255,20,0.55)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 14 }}>
            Total de Fans · 2023–2024
          </div>
          <div className="lm-fa" style={{ color: "#fff", fontSize: 136, lineHeight: 0.85, letterSpacing: "-0.02em" }}>
            {mounted ? <AnimCount to={2.86} decimals={2} suffix="M" /> : "2.86M"}
          </div>
          <div className="lm-fa" style={{ color: "#39FF14", fontSize: 28, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 14 }}>
            Boletos Vendidos
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.26em", marginTop: 18 }}>
            Pollstar Reportado · 95% Sell-Through Global
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. EDITORIAL PULLQUOTE
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 500, overflow: "hidden" }}>
        <img src={BG_STAGE} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%", filter: "brightness(0.28) saturate(0.6)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.18) 16%, rgba(6,6,6,0.18) 84%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(to bottom, transparent, #39FF14, transparent)" }} />

        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 68px" }}>
          <div style={{ maxWidth: 820 }}>
            <motion.div className="lm-fa"
              initial={{ opacity: 0, y: 44 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1.0 }}
              style={{ color: "#fff", fontSize: 66, textTransform: "uppercase", lineHeight: 0.88, letterSpacing: "0.02em" }}>
              El Regreso<br />del Sol.<br /><span style={{ color: "#39FF14" }}>Historia Viva.</span>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5, duration: 0.8 }}
              style={{ color: "rgba(255,255,255,0.52)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 30, maxWidth: 480, lineHeight: 1.88 }}>
              En 186 noches — de Buenos Aires a Madrid, de Lima a Ciudad de México — Luis Miguel
              reescribió los récords del entretenimiento latinoamericano en vivo.
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. FLOATING STATS — 4 KEY METRICS
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "88px 0", overflow: "hidden" }}>
        <img src={BG_LIGHTS} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.18) saturate(0.6)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.08) 15%, rgba(6,6,6,0.08) 85%, rgba(6,6,6,1) 100%)" }} />

        <div style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 48px", flexWrap: "wrap", gap: 40 }}>
          {[
            { value: "$415.8M", label: "Gross Total Reportado",   sub: "USD en taquilla · Pollstar" },
            { value: "2.86M",   label: "Boletos Vendidos",        sub: "Total reportado" },
            { value: "95%",     label: "Sell-Through Global",     sub: "Promedio de ocupación" },
            { value: "$2.26M",  label: "Gross Promedio por Show", sub: "USD por concierto" },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.13, duration: 0.72 }}
              style={{ textAlign: "center", padding: "0 20px" }}>
              <div className="lm-fa" style={{ color: "#fff", fontSize: 52, lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 14 }}>{s.value}</div>
              <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", marginBottom: 5 }}>{s.label}</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em" }}>{s.sub}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. WORLD TOUR FOOTPRINT — markets + countries
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        {/* Right side image panel */}
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "44%", zIndex: 0 }}>
          <img src={BG_STADIUM} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 35%", filter: "brightness(0.42) saturate(0.72)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,1) 0%, rgba(6,6,6,0.42) 28%, rgba(6,6,6,0.0) 68%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,0.65) 0%, transparent 16%, transparent 84%, rgba(6,6,6,0.65) 100%)" }} />

          {/* Stats overlay — market split */}
          <motion.div
            initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.85, duration: 0.9 }}
            style={{ position: "absolute", bottom: 56, right: 52, textAlign: "right", zIndex: 2 }}>
            <div style={{ color: "rgba(57,255,20,0.45)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.38em", marginBottom: 22 }}>
              Distribución de Mercados
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {[
                { pct: "~37%", label: "Shows en México",        big: true  },
                { pct: "~23%", label: "Shows en EUA",           big: false },
                { pct: "~17%", label: "Sudamérica",             big: false },
                { pct: "~8%",  label: "España / Europa",        big: false },
              ].map((m, i) => (
                <div key={i}>
                  <div className="lm-fa" style={{ color: m.big ? "#39FF14" : "#fff", fontSize: m.big ? 58 : 36, lineHeight: 1 }}>{m.pct}</div>
                  <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em" }}>{m.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Left content — top cities */}
        <div style={{ position: "relative", zIndex: 10, padding: "76px 0 76px 56px", maxWidth: "60%" }}>
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            style={{ color: "rgba(57,255,20,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 44 }}>
            Mercados Principales · Gira 2023–2024
          </motion.div>

          {TOP_MARKETS.map((row, i) => (
            <motion.div key={row.city}
              initial={{ opacity: 0, x: -26 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.55, ease: "easeOut" }}>
              <div style={{ height: 1, background: i === 0 ? "rgba(57,255,20,0.22)" : "rgba(255,255,255,0.055)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "16px 0" }}>
                <span style={{ color: row.hi ? "#39FF14" : "rgba(57,255,20,0.28)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", minWidth: 26, flexShrink: 0 }}>{row.n}</span>
                <span className="lm-fa" style={{ color: row.hi ? "#fff" : "rgba(255,255,255,0.72)", fontSize: row.hi ? 42 : 34, textTransform: "uppercase", lineHeight: 1, flex: 1 }}>{row.city}</span>
                <span style={{ color: "rgba(255,255,255,0.48)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 600, flexShrink: 0 }}>{row.sub}</span>
              </div>
            </motion.div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.055)" }} />

          {/* Countries tag cloud */}
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.65, duration: 0.7 }}
            style={{ marginTop: 36 }}>
            <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.24em", marginBottom: 14 }}>
              Países visitados ({COUNTRIES.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COUNTRIES.map((c) => (
                <span key={c} style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.12)", color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 10px" }}>
                  {c}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.8, duration: 0.6 }}
            style={{ color: "rgba(255,255,255,0.38)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 22 }}>
            Por número de shows reportados · Fuente: Pollstar Research
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. BIGGEST SHOWS — TOP 5 BY GROSS
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "0 0 80px" }}>
        <div style={{ padding: "72px 56px 40px" }}>
          <div style={{ color: "rgba(57,255,20,0.48)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 14 }}>
            Shows con Mayor Recaudación
          </div>
          <div className="lm-fa" style={{ color: "#fff", fontSize: 44, textTransform: "uppercase", lineHeight: 0.88 }}>
            Las Noches<br />Históricas.
          </div>
          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 14 }}>
            Fuente: Pollstar Tour History Report · Solo muestra shows con datos publicados
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TOP_SHOWS.map((show, i) => (
            <motion.div key={`${show.venue}-${show.date}`}
              initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.11, duration: 0.72 }}
              style={{ position: "relative", height: 192, overflow: "hidden" }}>

              {/* Background */}
              <img src={i % 2 === 0 ? BG_STAGE : BG_CROWD} alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", filter: "brightness(0.4) saturate(0.72)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,0.92) 0%, rgba(6,6,6,0.55) 52%, rgba(6,6,6,0.12) 100%)" }} />

              {/* Left accent bar */}
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: i === 0 ? 3 : 1, background: i === 0 ? "#39FF14" : "rgba(57,255,20,0.2)" }} />

              {/* Content */}
              <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 56px", gap: 36, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                  <span className="lm-fa" style={{ color: i === 0 ? "#39FF14" : "rgba(255,255,255,0.3)", fontSize: 54, lineHeight: 1, flexShrink: 0 }}>{show.rank}</span>
                  <div>
                    <div className="lm-fa" style={{ color: "#fff", fontSize: 26, textTransform: "uppercase", lineHeight: 1.1 }}>{show.venue}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 5 }}>
                      {show.city} · {show.date}
                    </div>
                    <div style={{ color: i === 0 ? "rgba(57,255,20,0.7)" : "rgba(255,255,255,0.32)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>
                      {show.note} · Cap. {show.capacity}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 48, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>Asistencia</div>
                    <div className="lm-fa" style={{ color: "#fff", fontSize: 22 }}>{show.tickets}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 5 }}>Gross USD</div>
                    <div className="lm-fa" style={{ color: i === 0 ? "#39FF14" : "#fff", fontSize: 22 }}>{show.gross}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. RECORD HIGHLIGHT — Estadio GNP / Bernabéu
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "72px 56px", background: "#070707", borderTop: "1px solid rgba(57,255,20,0.06)", borderBottom: "1px solid rgba(57,255,20,0.06)" }}>
        <div style={{ display: "flex", gap: 64, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            {
              label: "Mayor Asistencia Individual",
              venue: "Estadio GNP Seguros",
              city: "Ciudad de México · 30 Nov 2024",
              stat: "56,539",
              unit: "fans",
              note: "98% vendido · 57,874 capacidad",
            },
            {
              label: "Mayor Recaudación Individual",
              venue: "Estadio Santiago Bernabéu",
              city: "Madrid, España · 6 Jul 2024",
              stat: "$8.24M",
              unit: "USD",
              note: "100% vendido · 45,541 fans",
            },
            {
              label: "Asistencia Récord en Argentina",
              venue: "Campo de Polo",
              city: "Buenos Aires · 9–10 Mar 2024",
              stat: "43,085",
              unit: "fans por show",
              note: "2 shows consecutivos · 100% vendido",
            },
          ].map((r, i) => (
            <motion.div key={r.label}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.14, duration: 0.68 }}
              style={{ flex: "1 1 240px", minWidth: 200, maxWidth: 320, borderTop: "1px solid rgba(57,255,20,0.15)", paddingTop: 24 }}>
              <div style={{ color: "rgba(57,255,20,0.45)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 18 }}>{r.label}</div>
              <div className="lm-fa" style={{ color: "#39FF14", fontSize: 48, lineHeight: 1, marginBottom: 10 }}>{r.stat}</div>
              <div style={{ color: "#fff", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 4 }}>{r.unit}</div>
              <div className="lm-fa" style={{ color: "rgba(255,255,255,0.75)", fontSize: 18, textTransform: "uppercase", marginBottom: 6 }}>{r.venue}</div>
              <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>{r.city}</div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>{r.note}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          8. TOUR TIMELINE — Leg 1 vs Leg 2
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "88px 0 108px", overflow: "hidden" }}>
        <img src={BG_CLOSE} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.14) saturate(0.48)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.12) 14%, rgba(6,6,6,0.12) 86%, rgba(6,6,6,1) 100%)" }} />

        <div style={{ position: "relative", zIndex: 10, padding: "0 56px" }}>
          <div style={{ color: "rgba(57,255,20,0.48)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 14 }}>
            Tour Timeline
          </div>
          <div className="lm-fa" style={{ color: "#fff", fontSize: 46, textTransform: "uppercase", lineHeight: 0.88, marginBottom: 60 }}>
            Dos Años.<br />Un Legado.
          </div>

          {/* Timeline bar */}
          <div style={{ position: "relative", marginBottom: 48 }}>
            <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <motion.div style={{ position: "absolute", top: 10, left: 0, height: 1, background: "linear-gradient(to right, #39FF14, rgba(57,255,20,0.25))" }}
              initial={{ width: 0 }} whileInView={{ width: "100%" }} viewport={{ once: true }}
              transition={{ duration: 2.0, ease: "easeOut", delay: 0.3 }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 32, paddingTop: 0 }}>
              {TOUR_LEGS.map((leg, i) => (
                <motion.div key={leg.id}
                  initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.18, duration: 0.65 }}>
                  <div style={{ position: "relative", zIndex: 2, marginBottom: 26 }}>
                    <div style={{
                      width: leg.peak ? 24 : 14, height: leg.peak ? 24 : 14,
                      borderRadius: "50%",
                      background: leg.peak ? "#39FF14" : "rgba(57,255,20,0.14)",
                      border: leg.peak ? "none" : "1px solid rgba(57,255,20,0.28)",
                      marginTop: leg.peak ? -6 : 0,
                      boxShadow: leg.peak ? "0 0 28px rgba(57,255,20,0.55)" : "none",
                    }} />
                  </div>

                  {leg.peak && (
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ background: "#39FF14", color: "#000", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", padding: "3px 10px" }}>
                        El Año Más Grande
                      </span>
                    </div>
                  )}

                  <div className="lm-fa" style={{ color: leg.peak ? "#39FF14" : "#fff", fontSize: 56, lineHeight: 1, marginBottom: 8 }}>{leg.label}</div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{leg.name}</div>
                  <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>{leg.period}</div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 24 }}>
                      <div>
                        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600 }}>{leg.shows} Shows</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Reportados</div>
                      </div>
                      <div>
                        <div className="lm-fa" style={{ color: leg.peak ? "#39FF14" : "rgba(255,255,255,0.85)", fontSize: 22 }}>{leg.grossLabel}</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gross USD aprox.</div>
                      </div>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 10, marginTop: 2 }}>{leg.markets}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, marginTop: 4 }}>
                      {leg.note}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            * Datos provistos por Pollstar Research · No incluye shows no reportados o datos no publicados · Grosses por año son estimaciones basadas en datos del reporte
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          9. CLOSING CINEMATIC MOMENT
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 400, overflow: "hidden" }}>
        <img src={BG_CROWD} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 55%", filter: "brightness(0.32) saturate(0.75)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.1) 22%, rgba(6,6,6,0.1) 68%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1, background: "linear-gradient(to right, transparent, rgba(57,255,20,0.28), transparent)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, background: "linear-gradient(to right, transparent, rgba(57,255,20,0.12), transparent)" }} />

        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ color: "rgba(57,255,20,0.42)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.44em", marginBottom: 18 }}>
            Datos Pollstar · 2023–2024
          </div>
          <div className="lm-fa" style={{ color: "rgba(255,255,255,0.10)", fontSize: 180, textTransform: "uppercase", lineHeight: 0.82, letterSpacing: "0.06em", userSelect: "none" }}>
            LM
          </div>
          <div style={{ position: "absolute", color: "#fff", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.34em", fontWeight: 500 }}>
            Mexico<span style={{ color: "#39FF14" }}>Charts</span>™ · Touring
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: "22px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap", gap: 12 }}>
        <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          © 2026 Mexico Charts · Datos provistos por Pollstar Research
        </div>
        <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Reporte Pollstar adquirido 2/8/2026 · Shows reportados: {TOTAL_SHOWS} · Gross reportado: $415,849,128 USD
        </div>
        <Link href="/touring">
          <span style={{ color: "rgba(57,255,20,0.55)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", cursor: "pointer" }}>
            ← Volver a Touring
          </span>
        </Link>
      </footer>
    </div>
  );
}
