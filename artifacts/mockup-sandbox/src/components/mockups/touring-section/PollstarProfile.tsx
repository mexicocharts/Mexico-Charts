import React, { useEffect, useState } from "react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";

const CONCERT_BG = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1280&h=600&fit=crop&q=80";
const ARTIST_IMG = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=640&h=700&fit=crop&q=80";
const MARKET_ARTIST = "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=480&h=360&fit=crop&q=75";
const TIMELINE_ARTIST = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=320&h=320&fit=crop&q=70";

const SHOW1 = "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=120&h=80&fit=crop&q=60";
const SHOW2 = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&h=80&fit=crop&q=60";
const SHOW3 = "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=120&h=80&fit=crop&q=60";
const SHOW4 = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120&h=80&fit=crop&q=60";
const SHOW5 = "https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=120&h=80&fit=crop&q=60";

function AnimCount({ to, prefix = "", suffix = "", decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const v = useMotionValue(0);
  const d = useTransform(v, (n) => prefix + (decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()) + suffix);
  useEffect(() => { const c = animate(v, to, { duration: 2, ease: "easeOut" }); return c.stop; }, []);
  return <motion.span>{d}</motion.span>;
}

function SellRing({ pct }: { pct: number }) {
  const r = 24; const circ = 2 * Math.PI * r;
  const [off, setOff] = useState(circ);
  useEffect(() => { const t = setTimeout(() => setOff(circ * (1 - pct / 100)), 500); return () => clearTimeout(t); }, []);
  return (
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r={r} fill="none" stroke="#1a1a1a" strokeWidth="3" />
      <circle cx="30" cy="30" r={r} fill="none" stroke="#39FF14" strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 2s ease-out" }} />
    </svg>
  );
}

const biggestShows = [
  { rank: 1, venue: "Foro Sol", city: "Ciudad de México, MX", date: "9 Sep 2023", tickets: 58999, gross: "$4.00M", img: SHOW1 },
  { rank: 2, venue: "BMO Stadium", city: "Los Ángeles, CA, USA", date: "11 Oct 2024 (2 Shows)", tickets: 43658, gross: "$6.78M", img: SHOW2 },
  { rank: 3, venue: "Crypto.com Arena", city: "Los Ángeles, CA, USA", date: "20 Abr 2024", tickets: 42070, gross: "$6.46M", img: SHOW3 },
  { rank: 4, venue: "Madison Square Garden", city: "Nueva York, NY, USA", date: "6 Abr 2024", tickets: 34351, gross: "$4.65M", img: SHOW4 },
  { rank: 5, venue: "Toyota Center", city: "Houston, TX, USA", date: "14 Mar 2024 (2 Shows)", tickets: 28422, gross: "$3.85M", img: SHOW5 },
];

const timeline = [
  { year: "2021", shows: 24, tickets: "72K", gross: "$2.5M" },
  { year: "2022", shows: 51, tickets: "189K", gross: "$8.9M" },
  { year: "2023", shows: 124, tickets: "412K", gross: "$41.8M", peak: true },
  { year: "2024", shows: 89, tickets: "312K", gross: "$34.2M" },
];

/* Simplified SVG dots for US + Mexico tour map */
const mapDots = [
  { cx: 180, cy: 180, r: 5, type: "headline" },   // LA
  { cx: 200, cy: 210, r: 4, type: "headline" },   // Phoenix
  { cx: 235, cy: 195, r: 3.5, type: "festival" }, // Las Vegas
  { cx: 270, cy: 200, r: 5, type: "headline" },   // Houston area
  { cx: 280, cy: 180, r: 3, type: "festival" },   // Dallas
  { cx: 320, cy: 165, r: 5, type: "headline" },   // Chicago
  { cx: 355, cy: 155, r: 6, type: "headline" },   // NY/NE
  { cx: 340, cy: 175, r: 3, type: "festival" },   // Philly/DC
  { cx: 230, cy: 235, r: 4, type: "headline" },   // San Antonio
  { cx: 250, cy: 260, r: 5, type: "headline" },   // Monterrey MX
  { cx: 230, cy: 285, r: 4, type: "headline" },   // Guadalajara
  { cx: 255, cy: 300, r: 6, type: "headline" },   // CDMX
  { cx: 305, cy: 195, r: 3, type: "festival" },   // Atlanta
  { cx: 165, cy: 165, r: 3, type: "festival" },   // SF
  { cx: 295, cy: 175, r: 3.5, type: "headline" }, // Nashville/Memphis
];

export function PollstarProfile() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ background: "#080808", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#9ca3af" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;900&display=swap');
        .font-anton { font-family: 'Anton', sans-serif !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .show-row:hover { background: rgba(57,255,20,0.04) !important; }
      ` }} />

      {/* ── NAV ── */}
      <nav style={{ background: "#080808", borderBottom: "1px solid #161616", height: 52, display: "flex", alignItems: "center", padding: "0 32px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span className="font-anton" style={{ color: "#fff", fontSize: 17, letterSpacing: "0.12em", textTransform: "uppercase" }}>Mexico</span>
          <span className="font-anton" style={{ color: "#39FF14", fontSize: 17, letterSpacing: "0.12em", textTransform: "uppercase" }}>Charts</span>
          <sup style={{ color: "#39FF14", fontSize: 8, fontWeight: 700, marginLeft: 1 }}>™</sup>
        </div>
        <div style={{ display: "flex", gap: 24, marginLeft: 40, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          {["Home", "Charts", "Certifications", "Artists", "Touring", "News", "About"].map((n) => (
            <span key={n} style={{ color: n === "Touring" ? "#39FF14" : "#555", borderBottom: n === "Touring" ? "2px solid #39FF14" : "none", paddingBottom: 2, cursor: "pointer" }}>{n}</span>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, color: "#555", fontSize: 12 }}>
          {["IG", "X", "YT", "♪"].map(s => <span key={s} style={{ cursor: "pointer" }}>{s}</span>)}
        </div>
      </nav>

      {/* ── 1. CINEMATIC HERO ── */}
      <section style={{ position: "relative", height: 500, overflow: "hidden" }}>
        <img src={CONCERT_BG} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(8,8,8,0.97) 35%, rgba(8,8,8,0.6) 60%, rgba(8,8,8,0.2) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,8,8,1) 0%, transparent 50%)" }} />

        {/* Artist on right */}
        <div style={{ position: "absolute", right: "5%", top: 0, height: "100%", width: 400 }}>
          <img src={ARTIST_IMG} alt="" style={{ height: "100%", width: "100%", objectFit: "cover", objectPosition: "center top", maskImage: "linear-gradient(to left, rgba(0,0,0,0.85) 25%, transparent 100%)", WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.85) 25%, transparent 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, rgba(57,255,20,0.1) 0%, transparent 60%)" }} />
        </div>

        {/* Left content */}
        <div style={{ position: "relative", zIndex: 10, padding: "32px 40px 36px", maxWidth: 580, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {/* Top */}
          <div>
            <div style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 12 }}>Touring Profile</div>
            <motion.h1 className="font-anton"
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}
              style={{ color: "#fff", fontSize: 100, lineHeight: 0.88, textTransform: "uppercase", letterSpacing: "0.01em" }}>
              Peso<br />Pluma
            </motion.h1>
          </div>

          {/* Bottom: gross number */}
          <div>
            <div style={{ color: "#555", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.25em", marginBottom: 4 }}>Gross Reportado</div>
            <div className="font-anton" style={{ color: "#39FF14", fontSize: 88, lineHeight: 1, letterSpacing: "-0.01em" }}>
              $<AnimCount to={87.4} decimals={1} />M
            </div>
            <div style={{ color: "#aaa", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 2 }}>USD en Taquilla</div>
            <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 12 }}>
              Datos Pollstar · 1/01/2021 – 12/31/2024
            </div>
          </div>
        </div>

        {/* Top-right tagline */}
        <div style={{ position: "absolute", top: 32, right: 44, zIndex: 10, textAlign: "right" }}>
          <div style={{ color: "#bbb", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1.9, fontWeight: 600 }}>
            De la Calle<br />a los Escenarios<br />Más Grandes.
          </div>
          <div style={{ color: "#39FF14", fontSize: 10, marginTop: 6, fontStyle: "italic" }}>— Hassan Emilio Kabande Laija</div>
        </div>
      </section>

      {/* ── 2. STATS STRIP ── */}
      <section style={{ borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a", background: "#0c0c0c" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {/* Tickets */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 28px", borderRight: "1px solid #1a1a1a" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="8" width="24" height="12" rx="2" stroke="#39FF14" strokeWidth="1.5" />
              <line x1="9" y1="8" x2="9" y2="20" stroke="#39FF14" strokeWidth="1.5" strokeDasharray="2 2" />
              <line x1="19" y1="8" x2="19" y2="20" stroke="#39FF14" strokeWidth="1.5" strokeDasharray="2 2" />
            </svg>
            <div>
              <div className="font-anton" style={{ color: "#fff", fontSize: 28, lineHeight: 1 }}>
                <AnimCount to={758} suffix="K" />
              </div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginTop: 3 }}>Tickets Vendidos</div>
              <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Total</div>
            </div>
          </div>

          {/* Shows */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 28px", borderRight: "1px solid #1a1a1a" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="6" width="20" height="18" rx="2" stroke="#39FF14" strokeWidth="1.5" />
              <line x1="4" y1="11" x2="24" y2="11" stroke="#39FF14" strokeWidth="1.5" />
              <line x1="9" y1="3" x2="9" y2="9" stroke="#39FF14" strokeWidth="1.5" />
              <line x1="19" y1="3" x2="19" y2="9" stroke="#39FF14" strokeWidth="1.5" />
            </svg>
            <div>
              <div className="font-anton" style={{ color: "#fff", fontSize: 28, lineHeight: 1 }}>
                <AnimCount to={288} />
              </div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginTop: 3 }}>Shows</div>
              <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Total Reportados</div>
            </div>
          </div>

          {/* Attendance */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 28px", borderRight: "1px solid #1a1a1a" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="10" cy="9" r="4" stroke="#39FF14" strokeWidth="1.5" />
              <circle cx="20" cy="9" r="3" stroke="#39FF14" strokeWidth="1.2" />
              <path d="M2 22c0-4 3.6-7 8-7s8 3 8 7" stroke="#39FF14" strokeWidth="1.5" />
              <path d="M20 14c3 0 6 2 6 5" stroke="#39FF14" strokeWidth="1.2" />
            </svg>
            <div>
              <div className="font-anton" style={{ color: "#fff", fontSize: 28, lineHeight: 1 }}>
                <AnimCount to={11856} />
              </div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginTop: 3 }}>Asistencia Promedio</div>
              <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Por Show</div>
            </div>
          </div>

          {/* Sell-through */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 28px" }}>
            <SellRing pct={98} />
            <div>
              <div className="font-anton" style={{ color: "#fff", fontSize: 28, lineHeight: 1 }}>98%</div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginTop: 3 }}>Sell-Through</div>
              <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Porcentaje Vendido</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. TOUR MAP + BIGGEST SHOWS (two columns) ── */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #111", minHeight: 380 }}>

        {/* LEFT: Tour Map */}
        <div style={{ padding: "28px 32px", borderRight: "1px solid #111", position: "relative" }}>
          <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.25em", marginBottom: 16 }}>Tour Map</div>

          <div className="font-anton" style={{ color: "#fff", fontSize: 38, textTransform: "uppercase", lineHeight: 0.92, marginBottom: 20 }}>
            Llevando la Nueva<br />Música Mexicana<br />a todo EUA.
          </div>

          {/* SVG Map */}
          <div style={{ position: "relative", background: "#0a0a0a", border: "1px solid #141414", overflow: "hidden" }}>
            <svg viewBox="0 0 500 370" width="100%" style={{ display: "block" }}>
              {/* US rough outline */}
              <path d="M80,80 L420,80 L420,60 L440,65 L445,80 L440,120 L430,140 L420,180 L410,200 L390,220 L370,230 L350,240 L330,250 L300,260 L270,265 L240,270 L220,275 L210,280 L200,290 L210,310 L220,330 L230,345 L220,350 L200,345 L185,335 L175,320 L170,305 L175,285 L170,270 L160,260 L140,250 L120,240 L100,225 L85,200 L78,175 L75,150 L78,125 L80,80Z"
                fill="#0e1a0e" stroke="#1a2a1a" strokeWidth="1.5" />
              {/* Mexico rough outline */}
              <path d="M170,285 L175,270 L180,260 L190,255 L200,258 L210,262 L215,270 L220,280 L225,290 L230,305 L240,320 L250,335 L255,345 L248,352 L238,355 L225,350 L215,342 L205,330 L195,315 L185,305 L175,295 L170,285Z"
                fill="#0a160a" stroke="#141e14" strokeWidth="1.5" />
              {/* State lines - simplified */}
              <line x1="220" y1="80" x2="220" y2="175" stroke="#141e14" strokeWidth="0.7" />
              <line x1="280" y1="80" x2="280" y2="180" stroke="#141e14" strokeWidth="0.7" />
              <line x1="340" y1="80" x2="340" y2="170" stroke="#141e14" strokeWidth="0.7" />
              <line x1="80" y1="140" x2="420" y2="140" stroke="#141e14" strokeWidth="0.7" />
              <line x1="80" y1="190" x2="400" y2="190" stroke="#141e14" strokeWidth="0.7" />
              {/* Border line US-Mexico */}
              <path d="M170,262 L190,258 L220,260 L240,263 L260,265" stroke="#255025" strokeWidth="1.2" strokeDasharray="4 3" />

              {/* Show dots */}
              {mapDots.map((dot, i) => (
                <g key={i}>
                  {dot.type === "headline" ? (
                    <>
                      <circle cx={dot.cx} cy={dot.cy} r={dot.r + 5} fill="rgba(57,255,20,0.08)" />
                      <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill="#39FF14" />
                    </>
                  ) : (
                    <circle cx={dot.cx} cy={dot.cy} r={dot.r - 0.5} fill="rgba(57,255,20,0.4)" stroke="rgba(57,255,20,0.3)" strokeWidth="0.8" />
                  )}
                </g>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 24, marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#39FF14" }} />
              <span style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>Headline Shows</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(57,255,20,0.4)" }} />
              <span style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>Festival Appearances</span>
            </div>
          </div>

          {/* Bottom stats */}
          <div style={{ display: "flex", gap: 32, marginTop: 18, paddingTop: 14, borderTop: "1px solid #111" }}>
            <div>
              <div className="font-anton" style={{ color: "#fff", fontSize: 28, lineHeight: 1 }}>62</div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginTop: 2 }}>Shows en EUA</div>
              <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>(82%)</div>
            </div>
            <div>
              <div className="font-anton" style={{ color: "#fff", fontSize: 28, lineHeight: 1 }}>14</div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginTop: 2 }}>Shows en México</div>
              <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>(12%)</div>
            </div>
          </div>
          <div style={{ color: "#333", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 10 }}>
            No incluye shows no reportados o datos no publicados.
          </div>
        </div>

        {/* RIGHT: Biggest Reported Shows */}
        <div style={{ padding: "28px 28px" }}>
          <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.25em", marginBottom: 16 }}>Biggest Reported Shows</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {biggestShows.map((show, i) => (
              <motion.div key={show.venue}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="show-row"
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 10px",
                  borderBottom: i < biggestShows.length - 1 ? "1px solid #0f0f0f" : "none",
                  cursor: "pointer",
                }}>
                {/* Rank */}
                <span className="font-anton" style={{ color: i === 0 ? "#39FF14" : "#2a2a2a", fontSize: 22, width: 22, flexShrink: 0, lineHeight: 1 }}>{show.rank}</span>

                {/* Venue photo */}
                <div style={{ width: 72, height: 48, overflow: "hidden", flexShrink: 0, border: "1px solid #1a1a1a" }}>
                  <img src={show.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.6) grayscale(0.3)" }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-anton" style={{ color: "#fff", fontSize: 16, textTransform: "uppercase", lineHeight: 1.1 }}>{show.venue}</div>
                  <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{show.city}</div>
                  <div style={{ color: "#444", fontSize: 9, marginTop: 1 }}>{show.date}</div>
                </div>

                {/* Stats */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{show.tickets.toLocaleString()}</div>
                  <div style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Tickets</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, minWidth: 60 }}>
                  <div className="font-anton" style={{ color: i === 0 ? "#39FF14" : "#fff", fontSize: 16 }}>{show.gross}</div>
                  <div style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gross</div>
                </div>
              </motion.div>
            ))}
          </div>

          <button style={{ marginTop: 16, width: "100%", background: "none", border: "1px solid #1a1a1a", color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
            Ver Todos los Shows <span>›</span>
          </button>
        </div>
      </section>

      {/* ── 4. MARKET IMPACT ── */}
      <section style={{ display: "grid", gridTemplateColumns: "300px 1fr", borderBottom: "1px solid #111", minHeight: 240, overflow: "hidden" }}>
        {/* Artist photo */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          <img src={MARKET_ARTIST} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "brightness(0.55)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 60%, #080808 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,8,8,0.6) 0%, transparent 50%)" }} />
        </div>

        {/* Content */}
        <div style={{ padding: "36px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 12 }}>#Market Impact</div>
          <div className="font-anton" style={{ color: "#fff", fontSize: 44, textTransform: "uppercase", lineHeight: 0.9, marginBottom: 16 }}>
            El Poder de<br />la Diáspora.
          </div>
          <p style={{ color: "#666", fontSize: 12, lineHeight: 1.7, maxWidth: 380, marginBottom: 24 }}>
            Peso Pluma ha construido su base más sólida en Estados Unidos, donde la demanda por la nueva música mexicana sigue rompiendo récords en arenas y anfiteatros.
          </p>
          <div style={{ display: "flex", gap: 40 }}>
            <div>
              <div className="font-anton" style={{ color: "#39FF14", fontSize: 52, lineHeight: 1 }}>82%</div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginTop: 4 }}>Shows en EUA</div>
            </div>
            <div>
              <div className="font-anton" style={{ color: "#fff", fontSize: 52, lineHeight: 1 }}>12%</div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginTop: 4 }}>Shows en México</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. TOUR TIMELINE ── */}
      <section style={{ padding: "36px 40px 40px", borderBottom: "1px solid #111", display: "grid", gridTemplateColumns: "1fr 280px", gap: 32 }}>
        {/* Left: timeline */}
        <div>
          <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.25em", marginBottom: 12 }}>Tour Timeline</div>
          <div className="font-anton" style={{ color: "#fff", fontSize: 40, textTransform: "uppercase", lineHeight: 0.9, marginBottom: 28 }}>
            Crecimiento<br />Año Tras Año.
          </div>

          {/* Timeline row */}
          <div style={{ position: "relative" }}>
            {/* connecting line */}
            <div style={{ position: "absolute", top: 10, left: 10, right: 10, height: 2, background: "#1a1a1a" }} />
            <motion.div
              style={{ position: "absolute", top: 10, left: 10, height: 2, background: "#39FF14", transformOrigin: "left" }}
              initial={{ width: 0 }}
              animate={{ width: mounted ? "calc(100% - 20px)" : 0 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
            />

            <div style={{ display: "grid", gridTemplateColumns: `repeat(${timeline.length}, 1fr)`, paddingTop: 0 }}>
              {timeline.map((t, i) => (
                <div key={t.year} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", paddingTop: 0 }}>
                  {/* Dot */}
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.15, duration: 0.3 }}
                    style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: t.peak ? "#39FF14" : "#0d0d0d",
                      border: t.peak ? "2px solid #39FF14" : "2px solid #333",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative", zIndex: 2, marginBottom: 16,
                    }}>
                    {t.peak && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#000" }} />}
                  </motion.div>

                  {/* Year */}
                  <div className="font-anton" style={{ color: t.peak ? "#39FF14" : "#fff", fontSize: 22, lineHeight: 1, marginBottom: 10 }}>{t.year}</div>

                  {/* Stats */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div>
                      <div style={{ color: "#aaa", fontSize: 11, fontWeight: 700 }}>{t.shows} Shows</div>
                      <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}></div>
                    </div>
                    <div>
                      <div style={{ color: "#aaa", fontSize: 11, fontWeight: 700 }}>{t.tickets} Tickets</div>
                      <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}></div>
                    </div>
                    <div>
                      <div className="font-anton" style={{ color: t.peak ? "#39FF14" : "#fff", fontSize: 15 }}>{t.gross}</div>
                      <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gross</div>
                    </div>
                  </div>
                  {t.peak && (
                    <div style={{ marginTop: 8, background: "rgba(57,255,20,0.1)", border: "1px solid rgba(57,255,20,0.2)", padding: "2px 8px" }}>
                      <span style={{ color: "#39FF14", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Genesis Tour</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: artist photo with monogram overlay */}
        <div style={{ position: "relative", overflow: "hidden", background: "#0a0a0a", border: "1px solid #111" }}>
          <img src={TIMELINE_ARTIST} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.35) grayscale(0.4)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="font-anton" style={{ color: "rgba(57,255,20,0.08)", fontSize: 160, textTransform: "uppercase", lineHeight: 1, userSelect: "none" }}>PP</div>
          </div>
          <div style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
            <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em" }}>Peso Pluma · Carrera</div>
            <div className="font-anton" style={{ color: "#fff", fontSize: 22 }}>2021 – 2024</div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderTop: "1px solid #111" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span className="font-anton" style={{ color: "#fff", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>Mexico</span>
          <span className="font-anton" style={{ color: "#39FF14", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>Charts</span>
          <sup style={{ color: "#39FF14", fontSize: 7, fontWeight: 700, marginLeft: 1 }}>™</sup>
        </div>
        <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Datos provistos por Pollstar Research · No incluye shows no reportados</div>
        <button style={{ background: "none", border: "none", color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          Ver en Pollstar →
        </button>
      </footer>
    </div>
  );
}

export default PollstarProfile;
