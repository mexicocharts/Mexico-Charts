import { useEffect, useRef } from "react";
import { motion, useScroll, useTransform, animate, useMotionValue } from "framer-motion";
import { Link } from "wouter";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

/* ─────────────────────────────────────────────────────────────────────────────
   IMAGES
────────────────────────────────────────────────────────────────────────────── */
import _lmStageSetup  from "@assets/ImageTransformer.aspx_1778594713058.jpeg";
import _lmCrowdScreen from "@assets/353929_1152x775_1778594713058.jpg";
import _lmBand        from "@assets/353926_1778594713058.png";
import _lmOrangeArms  from "@assets/3HKIHV4EEVDONOWCEUT2KYKELQ_1778594713058.jpg";
import _lmFlying      from "@assets/image_1778594713058.webp";
import _lmGetty       from "@assets/GettyImages-1719488470-scaled_1778594713058.jpg";
import _lmSinging     from "@assets/73537366007-05012024-luis-miguel-at-don-haskins-10.jpg_1778595179832.webp";
import _lmSpread      from "@assets/73537371007-05012024-luis-miguel-at-don-haskins-13.jpg_1778595179832.webp";
import _lmMicUp       from "@assets/O7OF6LMKQJAOLG2RCDSZCZ44WE_1778595853657.jpg";
import _showBernabeu1 from "@assets/bernabeu_1_1778596969222.PNG";
import _showBernabeu4 from "@assets/Bernabeu_4_1778596941310.png";
import _showCaracas   from "@assets/caracas_venezuela_1778596995437.webp";
import _showGNP       from "@assets/GNP_Seguros_1778597015306.JPG";
import _showPeru      from "@assets/Estadio_Nacional_Peru_1778597058807.jpg";

const BG_HERO      = _lmStageSetup;
const BG_CROWD     = _lmCrowdScreen;
const BG_PULLQUOTE = _lmMicUp;     // dark close-up mic raised — section 3
const BG_LIGHTS    = _lmSinging;   // near-black with warm glints — section 2 stats bar
const BG_CLOSE     = _lmSpread;    // arms-wide, very dark — section 7 timeline
const ARTIST_IMG   = _lmGetty;

// kept in imports so bundler doesn't warn — not currently used as bg
const _unused = [_lmBand, _lmFlying, _lmOrangeArms]; void _unused;

/* ─────────────────────────────────────────────────────────────────────────────
   POLLSTAR DATA — Luis Miguel Tour History Reports
   ─ Full career: Report purchased 2/8/2026 · Shows 2/1/2000 – 2/8/2026
   ─ Latest tour: Report purchased 2/8/2026 · Shows 2/1/2023 – 2/8/2026
   Source of truth: Pollstar Tour History Reports (PDFs attached)
────────────────────────────────────────────────────────────────────────────── */

// CAREER CENTURY TOTAL (2000–2026 Pollstar report header — exact values)
const CAREER_GROSS_USD     = 786434715;   // $786,434,715 USD
const CAREER_TICKETS       = 7319267;     // 7,319,267 tickets
const CAREER_SHOWS         = 796;         // 796 total shows
const CAREER_SELL_THROUGH  = 87;          // 87% average sell-through
const CAREER_AVG_GROSS     = 1536005;     // $1,536,005 avg gross per show
const CAREER_AVG_ATT       = 14295;       // 14,295 avg tickets sold per show

// LATEST TOUR — 2023–2024 (Pollstar 2023–2026 report header — exact values)
const TOUR_GROSS_USD       = 415849128;   // $415,849,128 USD
const TOUR_TICKETS         = 2861491;     // 2,861,491 tickets
const TOUR_SHOWS           = 186;         // 186 shows
const TOUR_SELL_THROUGH    = 95;          // 95% sell-through
const TOUR_AVG_GROSS       = 2260050;     // $2,260,050 avg gross per show
const TOUR_AVG_ATT         = 15552;       // 15,552 avg attendance

// COMPUTED — Pre-2023 era (difference: career minus 2023–2024 tour)
const PRE23_GROSS          = CAREER_GROSS_USD - TOUR_GROSS_USD;  // $370,585,587
const PRE23_SHOWS          = CAREER_SHOWS - TOUR_SHOWS;          // 610
const PRE23_TICKETS        = CAREER_TICKETS - TOUR_TICKETS;      // 4,457,776

// TOP 5 SHOWS BY GROSS — 2023–2024 tour (exact figures from Pollstar PDF)
const TOP_SHOWS = [
  {
    rank: 1,
    venue: "Estadio Santiago Bernabéu",
    city: "Madrid, España",
    date: "6 Jul 2024",
    tickets: "45,541",
    gross: "$8.24M",
    note: "100% vendido",
    img: _showBernabeu1,
  },
  {
    rank: 2,
    venue: "Estadio Monumental de Caracas",
    city: "Caracas, Venezuela",
    date: "12 Feb 2024",
    tickets: "35,422",
    gross: "$6.85M",
    note: "98% vendido",
    img: _showCaracas,
  },
  {
    rank: 3,
    venue: "Estadio GNP Seguros",
    city: "Ciudad de México",
    date: "30 Nov 2024",
    tickets: "56,539",
    gross: "$6.00M",
    note: "98% vendido · Mayor asistencia",
    img: _showGNP,
  },
  {
    rank: 4,
    venue: "Estadio Santiago Bernabéu",
    city: "Madrid, España",
    date: "7 Jul 2024",
    tickets: "43,644",
    gross: "$5.59M",
    note: "100% vendido",
    img: _showBernabeu4,
  },
  {
    rank: 5,
    venue: "Estadio Nacional",
    city: "Lima, Perú",
    date: "25 Feb 2024",
    tickets: "41,263",
    gross: "$5.45M",
    note: "100% vendido",
    img: _showPeru,
  },
];

// TOP MARKETS by shows — 2023–2024 tour (from PDF data)
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

// COUNTRIES — 2023–2024 tour (from PDF data)
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
   PAGE
────────────────────────────────────────────────────────────────────────────── */
export default function LuisMiguelProfile() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const heroTextY = useTransform(scrollY, [0, 700], [0, 60]);

  return (
    <div style={{ background: "#060606", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#9ca3af", overflowX: "hidden" }}>
      <PageSEO
        title="Luis Miguel · Touring Profile — Mexico Charts"
        description="El artista mexicano con mayor recaudación de la historia. $786.4M USD, 796 shows, 7.3M fans reportados por Pollstar (2000–2024)."
        path="/touring/luis-miguel"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,900;1,400;1,600&display=swap');
        .lm-fa { font-family: 'Anton', sans-serif !important; }
        ::selection { background: rgba(57,255,20,0.25); }
      ` }} />

      <SiteNav />

      {/* ══════════════════════════════════════════
          1. CINEMATIC HERO — Full career headline
      ══════════════════════════════════════════ */}
      <section ref={heroRef} style={{ position: "relative", height: "calc(100vh - 56px)", minHeight: 600, overflow: "hidden", background: "#060606" }}>
        {/* subtle green radial glow on left */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 18% 55%, rgba(57,255,20,0.04) 0%, transparent 52%)" }} />

        {/* Artist portrait — single image, fades left into black */}
        <div style={{ position: "absolute", right: 0, top: 0, width: "52%", height: "100%" }}>
          <img src={ARTIST_IMG} alt="Luis Miguel"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            style={{
              width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top",
              maskImage: "linear-gradient(to left, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.3) 65%, transparent 92%)",
              WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.3) 65%, transparent 92%)",
              filter: "brightness(0.82) contrast(1.08)",
            }}
          />
          {/* bottom fade */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(6,6,6,1) 0%, transparent 28%)" }} />
        </div>

        {/* Hero text */}
        <motion.div style={{ position: "relative", zIndex: 10, padding: "0 52px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 680, y: heroTextY }}>
          <Link href="/touring">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.5 }}
              style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 18, cursor: "pointer" }}>
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
              Gross Total Reportado · Siglo XXI · 2000–2024
            </div>
            <div className="lm-fa" style={{ color: "#39FF14", fontSize: 88, lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 10 }}>
              $<AnimCount to={786.4} decimals={1} />M
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em" }}>
                USD · Pollstar
              </div>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.18)" }} />
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em" }}>
                {CAREER_SHOWS} Shows
              </div>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.18)" }} />
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em" }}>
                7.3M Fans
              </div>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.18)" }} />
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em" }}>
                20+ Países
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Top-right editorial */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.8 }}
          style={{ position: "absolute", top: 52, right: 52, zIndex: 10, textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.22em", lineHeight: 2.1, fontWeight: 500 }}>
            El Mayor Gross<br />de un Artista<br />Mexicano en la Historia.
          </div>
        </motion.div>

        {/* Scroll cue */}
        <div style={{ position: "absolute", bottom: 34, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
          <motion.div animate={{ y: [0, 9, 0] }} transition={{ repeat: Infinity, duration: 1.9 }}
            style={{ width: 1, height: 44, background: "linear-gradient(to bottom, rgba(57,255,20,0.55), transparent)", margin: "0 auto" }} />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          2. CAREER OVERVIEW — 4 headline stats
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "80px 0", overflow: "hidden" }}>
        <img src={BG_LIGHTS} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.16) saturate(0.6)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.08) 14%, rgba(6,6,6,0.08) 86%, rgba(6,6,6,1) 100%)" }} />

        <div style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 48px", flexWrap: "wrap", gap: 40 }}>
          {[
            { value: "$786.4M", label: "Gross Total · 2000–2024",  sub: "USD reportado · Pollstar" },
            { value: "7.32M",   label: "Boletos Vendidos",          sub: "Este siglo · 796 shows" },
            { value: "87%",     label: "Sell-Through Promedio",     sub: "24 años de historia" },
            { value: "$1.54M",  label: "Gross Promedio por Show",   sub: "USD · carrera completa" },
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
          3. EDITORIAL PULLQUOTE
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 460, overflow: "hidden" }}>
        <img src={BG_PULLQUOTE} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 35%", filter: "brightness(0.26) saturate(0.6)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.18) 16%, rgba(6,6,6,0.18) 84%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(to bottom, transparent, #39FF14, transparent)" }} />

        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 68px" }}>
          <div style={{ maxWidth: 820 }}>
            <motion.div className="lm-fa"
              initial={{ opacity: 0, y: 44 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 1.0 }}
              style={{ color: "#fff", fontSize: 62, textTransform: "uppercase", lineHeight: 0.88, letterSpacing: "0.02em" }}>
              El Regreso<br />del Sol<br /><span style={{ color: "#39FF14" }}>Historia Viva</span>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5, duration: 0.8 }}
              style={{ color: "rgba(255,255,255,0.52)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 30, maxWidth: 520, lineHeight: 1.88 }}>
              En 796 noches de este siglo — de Buenos Aires a Madrid, de Lima a Ciudad de México — El Sol
              acumuló $786 millones de dólares y siete millones de fans.
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. WORLD TOUR FOOTPRINT — 2023-2024 latest tour markets
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "44%", zIndex: 0 }}>
          <img src={BG_CROWD} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%", filter: "brightness(0.42) saturate(0.72)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,1) 0%, rgba(6,6,6,0.42) 28%, rgba(6,6,6,0.0) 68%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,0.65) 0%, transparent 16%, transparent 84%, rgba(6,6,6,0.65) 100%)" }} />

          <motion.div
            initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.85, duration: 0.9 }}
            style={{ position: "absolute", bottom: 56, right: 52, textAlign: "right", zIndex: 2 }}>
            <div style={{ color: "rgba(57,255,20,0.45)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.38em", marginBottom: 22 }}>
              Tour 2023–2024 · Distribución
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {[
                { pct: "~37%", label: "Shows en México",    big: true  },
                { pct: "~23%", label: "Shows en EUA",       big: false },
                { pct: "~17%", label: "Sudamérica",         big: false },
                { pct: "~8%",  label: "España / Europa",    big: false },
              ].map((m, i) => (
                <div key={i}>
                  <div className="lm-fa" style={{ color: m.big ? "#39FF14" : "#fff", fontSize: m.big ? 52 : 32, lineHeight: 1 }}>{m.pct}</div>
                  <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em" }}>{m.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div style={{ position: "relative", zIndex: 10, padding: "76px 0 76px 56px", maxWidth: "60%" }}>
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            style={{ color: "rgba(57,255,20,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 44 }}>
            Mercados Principales · Tour 2023–2024
          </motion.div>

          {TOP_MARKETS.map((row, i) => (
            <motion.div key={row.city}
              initial={{ opacity: 0, x: -26 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.55, ease: "easeOut" }}>
              <div style={{ height: 1, background: i === 0 ? "rgba(57,255,20,0.22)" : "rgba(255,255,255,0.055)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "14px 0" }}>
                <span style={{ color: row.hi ? "#39FF14" : "rgba(57,255,20,0.28)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", minWidth: 26, flexShrink: 0 }}>{row.n}</span>
                <span className="lm-fa" style={{ color: row.hi ? "#fff" : "rgba(255,255,255,0.72)", fontSize: row.hi ? 40 : 32, textTransform: "uppercase", lineHeight: 1, flex: 1 }}>{row.city}</span>
                <span style={{ color: "rgba(255,255,255,0.48)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 600, flexShrink: 0 }}>{row.sub}</span>
              </div>
            </motion.div>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.055)" }} />

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.65, duration: 0.7 }}
            style={{ marginTop: 32 }}>
            <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.24em", marginBottom: 12 }}>
              Países visitados 2023–2024 ({COUNTRIES.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {COUNTRIES.map((c) => (
                <span key={c} style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.12)", color: "rgba(255,255,255,0.55)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", padding: "3px 10px" }}>
                  {c}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. BIGGEST SHOWS — top 5 by gross (2023-2024 tour)
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "0 0 80px" }}>
        <div style={{ padding: "72px 56px 40px" }}>
          <div style={{ color: "rgba(57,255,20,0.48)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 14 }}>
            Shows con Mayor Recaudación · Tour 2023–2024
          </div>
          <div className="lm-fa" style={{ color: "#fff", fontSize: 42, textTransform: "uppercase", lineHeight: 0.88 }}>
            Las Noches<br />Históricas
          </div>
          <div style={{ color: "rgba(255,255,255,0.52)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 14 }}>
            Fuente: Pollstar Tour History Report · Solo muestra shows con datos publicados
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TOP_SHOWS.map((show, i) => (
            <motion.div key={`${show.venue}-${show.date}`}
              initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.7 }}
              style={{ position: "relative", height: 182, overflow: "hidden" }}>
              <img src={show.img} alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 50%", filter: "brightness(0.38) saturate(0.75)" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,0.92) 0%, rgba(6,6,6,0.55) 52%, rgba(6,6,6,0.12) 100%)" }} />
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: i === 0 ? 3 : 1, background: i === 0 ? "#39FF14" : "rgba(57,255,20,0.2)" }} />

              <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 52px", gap: 32, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
                  <span className="lm-fa" style={{ color: i === 0 ? "#39FF14" : "rgba(255,255,255,0.44)", fontSize: 50, lineHeight: 1, flexShrink: 0 }}>{show.rank}</span>
                  <div>
                    <div className="lm-fa" style={{ color: "#fff", fontSize: 24, textTransform: "uppercase", lineHeight: 1.1 }}>{show.venue}</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>
                      {show.city} · {show.date}
                    </div>
                    <div style={{ color: i === 0 ? "rgba(57,255,20,0.7)" : "rgba(255,255,255,0.48)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 }}>
                      {show.note}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 44, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Asistencia</div>
                    <div className="lm-fa" style={{ color: "#fff", fontSize: 20 }}>{show.tickets}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Gross USD</div>
                    <div className="lm-fa" style={{ color: i === 0 ? "#39FF14" : "#fff", fontSize: 20 }}>{show.gross}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. RECORD HIGHLIGHTS
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", background: "#070707", borderTop: "1px solid rgba(57,255,20,0.06)", borderBottom: "1px solid rgba(57,255,20,0.06)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {[
            {
              label: "Gross Total Este Siglo",
              stat: "$786M",
              unit: "USD",
              venue: "796 Shows · 2000–2024",
              note: "#1 artista mexicano en historia del touring",
            },
            {
              label: "Tour 2023–2024 vs Era Anterior",
              stat: "+$45M",
              unit: "más que todo lo anterior combinado",
              venue: "186 shows vs ~610 anteriores",
              note: "$415.8M vs ~$370.6M · mismo siglo · Pollstar",
            },
          ].map((r, i) => (
            <motion.div key={r.label}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.14, duration: 0.7 }}
              style={{
                padding: "64px 56px",
                borderLeft: i === 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                borderTop: i === 1 ? "none" : "none",
                position: "relative",
              }}>
              <div style={{ position: "absolute", left: i === 0 ? 0 : undefined, right: i === 1 ? 0 : undefined, top: 0, bottom: 0, width: 3, background: i === 0 ? "#39FF14" : "rgba(57,255,20,0.22)" }} />
              <div style={{ color: "rgba(57,255,20,0.5)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.36em", marginBottom: 22 }}>{r.label}</div>
              <div className="lm-fa" style={{ color: i === 0 ? "#39FF14" : "#fff", fontSize: 92, lineHeight: 0.9, marginBottom: 16 }}>{r.stat}</div>
              <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.18em", marginBottom: 10 }}>{r.unit}</div>
              <div style={{ height: 1, width: 32, background: "rgba(57,255,20,0.3)", marginBottom: 18 }} />
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>{r.venue}</div>
              <div style={{ color: "rgba(255,255,255,0.34)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>{r.note}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          9. CAREER TIMELINE — Two eras comparison
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "88px 0 108px", overflow: "hidden" }}>
        <img src={BG_CLOSE} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.14) saturate(0.48)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0.12) 14%, rgba(6,6,6,0.12) 86%, rgba(6,6,6,1) 100%)" }} />

        <div style={{ position: "relative", zIndex: 10, padding: "0 56px" }}>
          <div style={{ color: "rgba(57,255,20,0.48)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.42em", marginBottom: 14 }}>
            Pollstar · Career Timeline · Este Siglo
          </div>
          <div className="lm-fa" style={{ color: "#fff", fontSize: 46, textTransform: "uppercase", lineHeight: 0.88, marginBottom: 60 }}>
            24 Años<br />Un Legado Incomparable
          </div>

          <div style={{ position: "relative", marginBottom: 48 }}>
            <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <motion.div style={{ position: "absolute", top: 10, left: 0, height: 1, background: "linear-gradient(to right, #39FF14, rgba(57,255,20,0.25))" }}
              initial={{ width: 0 }} whileInView={{ width: "100%" }} viewport={{ once: true }}
              transition={{ duration: 2.0, ease: "easeOut", delay: 0.3 }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 40, paddingTop: 0 }}>
              {[
                {
                  era: "2000–2022",
                  label: "Los Primeros 22 Años",
                  period: "796 shows · Carrera siglo XXI hasta 2022",
                  shows: "~610",
                  gross: "~$370.6M",
                  tickets: "~4.46M",
                  peak: false,
                  note: "Datos computados: total de carrera menos el período 2023–2024",
                  markets: "México · EUA · Latinoamérica · España",
                },
                {
                  era: "2023–2024",
                  label: "El Gran Regreso",
                  period: "186 shows · Ago 2023 – Dic 2024",
                  shows: "186",
                  gross: "$415.8M",
                  tickets: "2.86M",
                  peak: true,
                  note: "Fuente directa: Pollstar 2023–2026 report header · Exact values",
                  markets: "20+ países · 4 continentes",
                },
              ].map((leg, i) => (
                <motion.div key={leg.era}
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
                        Superó toda la era anterior
                      </span>
                    </div>
                  )}

                  <div className="lm-fa" style={{ color: leg.peak ? "#39FF14" : "rgba(255,255,255,0.55)", fontSize: 52, lineHeight: 1, marginBottom: 8 }}>{leg.era}</div>
                  <div style={{ color: leg.peak ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{leg.label}</div>
                  <div style={{ color: "rgba(255,255,255,0.52)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>{leg.period}</div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 28 }}>
                      <div>
                        <div className="lm-fa" style={{ color: leg.peak ? "#39FF14" : "rgba(255,255,255,0.75)", fontSize: 26 }}>{leg.gross}</div>
                        <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gross USD</div>
                      </div>
                      <div>
                        <div style={{ color: leg.peak ? "#fff" : "rgba(255,255,255,0.62)", fontSize: 14, fontWeight: 600 }}>{leg.shows} Shows</div>
                        <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Reportados</div>
                      </div>
                      <div>
                        <div style={{ color: leg.peak ? "#fff" : "rgba(255,255,255,0.62)", fontSize: 14, fontWeight: 600 }}>{leg.tickets}</div>
                        <div style={{ color: "rgba(255,255,255,0.48)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Tickets</div>
                      </div>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{leg.markets}</div>
                    <div style={{ color: "rgba(255,255,255,0.44)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, marginTop: 4 }}>
                      {leg.note}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div style={{ color: "rgba(255,255,255,0.50)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            * Career total (796 shows / $786.4M) from Pollstar 2000–2026 report. 2023–2024 figures from Pollstar 2023–2026 report. Pre-2023 figures computed as difference.
            Shows no incluye reportes de soporte. Gross en USD según tipo de cambio reportado en Pollstar.
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          10. CLOSING
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 360, overflow: "hidden" }}>
        <img src={BG_CROWD} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 65%", filter: "brightness(0.22) saturate(0.6)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, rgba(6,6,6,0) 28%, rgba(6,6,6,0) 62%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1, background: "linear-gradient(to right, transparent, rgba(57,255,20,0.35), transparent)" }} />

        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 0 }}>
          <div style={{ color: "rgba(57,255,20,0.55)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.44em", marginBottom: 20 }}>
            Touring Profile · El Sol de México
          </div>
          <div className="lm-fa" style={{ color: "#fff", fontSize: 76, textTransform: "uppercase", lineHeight: 0.9, letterSpacing: "0.07em" }}>
            Luis Miguel
          </div>
          <div style={{ width: 36, height: 1, background: "#39FF14", margin: "20px auto" }} />
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <img src={`${import.meta.env.BASE_URL}mexico-charts-logo.png`} alt="Mexico Charts" style={{ height: 64, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(57,255,20,0.3))", opacity: 0.85 }} />
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 7, textTransform: "uppercase", letterSpacing: "0.36em" }}>Touring</div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: "22px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap", gap: 12 }}>
        <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          © 2026 Mexico Charts · Datos provistos por Pollstar Research
        </div>
        <div style={{ color: "rgba(255,255,255,0.46)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Career: {CAREER_SHOWS} shows · $786,434,715 USD · {CAREER_TICKETS.toLocaleString()} tickets (Pollstar 2000–2026)
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
