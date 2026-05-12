import React, { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, animate, useMotionValue } from "framer-motion";

/* ── Images ── */
const BG_HERO    = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1280&h=700&fit=crop&q=85";
const BG_CROWD   = "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1280&h=700&fit=crop&q=80";
const BG_STAGE   = "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1280&h=700&fit=crop&q=80";
const BG_LIGHTS  = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1280&h=700&fit=crop&q=80";
const BG_CLOSE   = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1280&h=600&fit=crop&q=80";
const ARTIST_IMG = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=700&h=800&fit=crop&q=80";
const MARKET_IMG = "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=900&h=500&fit=crop&q=75";
const SHOW_IMG_1 = "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=500&h=340&fit=crop&q=70";
const SHOW_IMG_2 = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=340&fit=crop&q=70";
const SHOW_IMG_3 = "https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=500&h=340&fit=crop&q=70";

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

/* Glowing city dot */
function CityDot({ x, y, size = 4, delay = 0, label = "", labelPos = "right" }: {
  x: number; y: number; size?: number; delay?: number; label?: string; labelPos?: "right" | "left" | "top";
}) {
  return (
    <g>
      <motion.circle cx={x} cy={y} r={size * 3} fill="rgba(57,255,20,0.06)"
        initial={{ opacity: 0, r: 0 }} animate={{ opacity: 1, r: size * 3 }}
        transition={{ delay, duration: 0.8 }} />
      <motion.circle cx={x} cy={y} r={size * 1.6} fill="rgba(57,255,20,0.15)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.1, duration: 0.5 }} />
      <motion.circle cx={x} cy={y} r={size} fill="#39FF14"
        initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.2, duration: 0.4 }} />
      {label && (
        <motion.text
          x={labelPos === "right" ? x + size + 5 : labelPos === "left" ? x - size - 5 : x}
          y={labelPos === "top" ? y - size - 4 : y + 4}
          textAnchor={labelPos === "left" ? "end" : labelPos === "top" ? "middle" : "start"}
          fill="rgba(255,255,255,0.55)" fontSize="8" fontFamily="Inter, sans-serif" fontWeight="600"
          letterSpacing="0.08em"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.4 }}>
          {label.toUpperCase()}
        </motion.text>
      )}
    </g>
  );
}

const topShows = [
  { rank: 1, venue: "Foro Sol", city: "Ciudad de México", date: "9 Sep 2023", tickets: "58,999", gross: "$4.00M", img: SHOW_IMG_1 },
  { rank: 2, venue: "BMO Stadium", city: "Los Ángeles, CA", date: "11 Oct 2024", tickets: "43,658", gross: "$6.78M", img: SHOW_IMG_2 },
  { rank: 3, venue: "Crypto.com Arena", city: "Los Ángeles, CA", date: "20 Abr 2024", tickets: "42,070", gross: "$6.46M", img: SHOW_IMG_3 },
];

export function PollstarProfile() {
  const [mounted, setMounted] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const statRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const heroBgY   = useTransform(scrollY, [0, 600], [0, 120]);
  const heroTextY = useTransform(scrollY, [0, 600], [0, 60]);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ background: "#060606", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#9ca3af", overflowX: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,900;1,400;1,600&display=swap');
        .fa { font-family: 'Anton', sans-serif !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: rgba(57,255,20,0.25); }
      ` }} />

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "linear-gradient(to bottom, rgba(6,6,6,0.95) 0%, transparent 100%)",
        height: 56, display: "flex", alignItems: "center", padding: "0 36px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span className="fa" style={{ color: "#fff", fontSize: 16, letterSpacing: "0.12em", textTransform: "uppercase" }}>Mexico</span>
          <span className="fa" style={{ color: "#39FF14", fontSize: 16, letterSpacing: "0.12em", textTransform: "uppercase" }}>Charts</span>
          <sup style={{ color: "#39FF14", fontSize: 7, fontWeight: 700, marginLeft: 1 }}>™</sup>
        </div>
        <div style={{ display: "flex", gap: 28, marginLeft: 44, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          {["Home", "Charts", "Artists", "Touring", "News"].map((n) => (
            <span key={n} style={{ color: n === "Touring" ? "#39FF14" : "rgba(255,255,255,0.35)", cursor: "pointer",
              borderBottom: n === "Touring" ? "1px solid #39FF14" : "none", paddingBottom: 2 }}>{n}</span>
          ))}
        </div>
        <div style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          Touring Profile
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          1. CINEMATIC HERO
      ══════════════════════════════════════════ */}
      <section ref={heroRef} style={{ position: "relative", height: "100vh", minHeight: 640, overflow: "hidden" }}>
        <motion.img src={BG_HERO} alt="" style={{
          position: "absolute", inset: 0, width: "100%", height: "115%",
          objectFit: "cover", objectPosition: "center 20%", y: heroBgY,
        }} />
        {/* Gradient layers */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,0.97) 28%, rgba(6,6,6,0.55) 58%, rgba(6,6,6,0.1) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(6,6,6,1) 0%, rgba(6,6,6,0.4) 30%, transparent 60%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 60%, rgba(57,255,20,0.04) 0%, transparent 55%)" }} />

        {/* Artist silhouette */}
        <div style={{ position: "absolute", right: 0, top: 0, width: "52%", height: "100%" }}>
          <img src={ARTIST_IMG} alt="" style={{
            width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top",
            maskImage: "linear-gradient(to left, rgba(0,0,0,0.6) 20%, transparent 90%)",
            WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.6) 20%, transparent 90%)",
            filter: "brightness(0.5)",
          }} />
          {/* Green halo behind artist */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 40% 55%, rgba(57,255,20,0.07) 0%, transparent 60%)" }} />
        </div>

        {/* Left hero content */}
        <motion.div style={{ position: "relative", zIndex: 10, padding: "0 48px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 640, y: heroTextY }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
            style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 20 }}>
            Touring Profile
          </motion.div>
          <motion.h1 className="fa" initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
            style={{ color: "#fff", fontSize: 120, lineHeight: 0.85, textTransform: "uppercase", letterSpacing: "0.01em", marginBottom: 36 }}>
            Peso<br />Pluma
          </motion.h1>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 8 }}>
              Gross Reportado · Carrera Total
            </div>
            <div className="fa" style={{ color: "#39FF14", fontSize: 92, lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 8 }}>
              $<AnimCount to={87.4} decimals={1} />M
            </div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.25em" }}>
              USD en Taquilla · 2021–2024
            </div>
          </motion.div>
        </motion.div>

        {/* Top-right editorial tagline */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}
          style={{ position: "absolute", top: 80, right: 48, zIndex: 10, textAlign: "right" }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", lineHeight: 2, fontWeight: 500 }}>
            De la Calle<br />a los Escenarios<br />Más Grandes.
          </div>
        </motion.div>

        {/* Bottom scroll cue */}
        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}
            style={{ width: 1, height: 40, background: "linear-gradient(to bottom, rgba(57,255,20,0.6), transparent)", margin: "0 auto" }} />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          2. SINGLE-STAT MOMENT — "288 SHOWS"
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 420, overflow: "hidden" }}>
        <img src={BG_CROWD} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%", filter: "brightness(0.25) saturate(0.6)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, transparent 20%, transparent 80%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(57,255,20,0.05) 0%, transparent 65%)" }} />

        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 48px" }}>
          <div style={{ color: "rgba(57,255,20,0.6)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 12 }}>
            Total Reportado
          </div>
          <div className="fa" style={{ color: "#fff", fontSize: 148, lineHeight: 0.85, textTransform: "uppercase", letterSpacing: "-0.02em" }}>
            {mounted ? <AnimCount to={288} /> : "288"}
          </div>
          <div className="fa" style={{ color: "#39FF14", fontSize: 32, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 12 }}>
            Shows
          </div>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.25em", marginTop: 16 }}>
            18 Países · 4 Años de Gira
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. ATMOSPHERIC PULLQUOTE — FULLSCREEN
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 480, overflow: "hidden" }}>
        <img src={BG_STAGE} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", filter: "brightness(0.18) saturate(0.5)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, transparent 18%, transparent 82%, rgba(6,6,6,1) 100%)" }} />
        {/* Green edge glow */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(to bottom, transparent, #39FF14, transparent)" }} />

        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 64px" }}>
          <div style={{ maxWidth: 800 }}>
            <motion.div className="fa"
              initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9 }}
              style={{ color: "#fff", fontSize: 72, textTransform: "uppercase", lineHeight: 0.88, letterSpacing: "0.02em" }}>
              México en los<br />Escenarios<br /><span style={{ color: "#39FF14" }}>del Mundo.</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.5, duration: 0.8 }}
              style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 28, maxWidth: 440, lineHeight: 1.8 }}>
              Peso Pluma llevó la nueva música mexicana a los venues más grandes del planeta — sin precedentes para el género.
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. FLOATING STATS — no hard boxes
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "80px 0", overflow: "hidden" }}>
        <img src={BG_LIGHTS} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.08) saturate(0.4)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, transparent 12%, transparent 88%, rgba(6,6,6,1) 100%)" }} />

        <div style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 48px" }}>
          {[
            { value: "758K", label: "Tickets Vendidos", sub: "Total reportado" },
            { value: "11,856", label: "Asistencia Promedio", sub: "Por show" },
            { value: "98%", label: "Sell-Through", sub: "Porcentaje vendido" },
            { value: "$303K", label: "Promedio por Show", sub: "Gross neto" },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.7 }}
              style={{ textAlign: "center", padding: "0 24px" }}>
              <div className="fa" style={{ color: "#fff", fontSize: 56, lineHeight: 1, letterSpacing: "-0.01em", marginBottom: 12 }}>
                {s.value}
              </div>
              <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em" }}>
                {s.sub}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. ATMOSPHERIC TOUR MAP
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "0 0 0", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 10, padding: "64px 56px 0" }}>
          <div style={{ color: "rgba(57,255,20,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 16 }}>
            Tour Map · 2021–2024
          </div>
          <div className="fa" style={{ color: "#fff", fontSize: 48, textTransform: "uppercase", lineHeight: 0.9, marginBottom: 8 }}>
            Llevando la Nueva<br />Música Mexicana<br /><span style={{ color: "#39FF14" }}>a todo el Mundo.</span>
          </div>
        </div>

        {/* The atmospheric map */}
        <div style={{ position: "relative", margin: "32px 0 0", height: 400 }}>
          {/* Background glow */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 55% 45%, rgba(57,255,20,0.04) 0%, transparent 60%)" }} />

          <svg viewBox="0 0 800 400" width="100%" height="100%" style={{ display: "block" }}>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="softglow">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* US landmass */}
            <path d="M120,60 L680,60 L690,50 L710,58 L715,75 L705,110 L690,140 L675,175 L655,205 L630,228 L600,245 L565,258 L530,268 L495,275 L460,280 L430,283 L400,285 L375,288 L355,292 L340,298 L330,308 L335,322 L340,338 L335,348 L322,352 L308,350 L295,344 L280,330 L268,315 L260,298 L265,280 L258,265 L242,250 L220,238 L198,225 L178,210 L162,192 L148,170 L138,148 L128,124 L120,100 L120,60Z"
              fill="rgba(20,35,20,0.7)" stroke="rgba(57,255,20,0.12)" strokeWidth="1" />

            {/* Mexico */}
            <path d="M260,285 L268,268 L278,258 L295,252 L310,255 L325,260 L335,270 L340,282 L342,295 L340,310 L338,325 L332,340 L322,352 L308,350 L295,344 L280,330 L268,315 L260,298 L260,285Z"
              fill="rgba(15,28,15,0.8)" stroke="rgba(57,255,20,0.15)" strokeWidth="1" />

            {/* Subtle interior geography lines */}
            <line x1="350" y1="60" x2="350" y2="240" stroke="rgba(57,255,20,0.04)" strokeWidth="0.8" />
            <line x1="480" y1="60" x2="480" y2="250" stroke="rgba(57,255,20,0.04)" strokeWidth="0.8" />
            <line x1="120" y1="150" x2="680" y2="150" stroke="rgba(57,255,20,0.04)" strokeWidth="0.8" />
            <line x1="120" y1="210" x2="650" y2="210" stroke="rgba(57,255,20,0.04)" strokeWidth="0.8" />

            {/* Animated routing lines from CDMX outward */}
            {[
              { x1: 320, y1: 310, x2: 260, y2: 195 },  // to LA
              { x1: 320, y1: 310, x2: 295, y2: 178 },  // to Phoenix
              { x1: 320, y1: 310, x2: 375, y2: 190 },  // to Houston
              { x1: 320, y1: 310, x2: 395, y2: 170 },  // to Dallas
              { x1: 320, y1: 310, x2: 450, y2: 150 },  // to Chicago
              { x1: 320, y1: 310, x2: 540, y2: 130 },  // to NYC
              { x1: 320, y1: 310, x2: 510, y2: 155 },  // to DC/Philly
              { x1: 320, y1: 310, x2: 440, y2: 175 },  // to Atlanta
              { x1: 320, y1: 310, x2: 235, y2: 175 },  // to SF
            ].map((line, i) => (
              <motion.line key={i}
                x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                stroke="rgba(57,255,20,0.2)" strokeWidth="0.8" strokeDasharray="4 6"
                filter="url(#glow)"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1, duration: 1.2, ease: "easeOut" }}
              />
            ))}

            {/* City dots */}
            <CityDot x={320} y={310} size={6} delay={0.2} label="CDMX" labelPos="top" />
            <CityDot x={280} y={268} size={4} delay={0.5} label="Guadalajara" labelPos="left" />
            <CityDot x={260} y={195} size={5} delay={0.6} label="Los Ángeles" labelPos="left" />
            <CityDot x={295} y={178} size={3.5} delay={0.7} label="Phoenix" labelPos="left" />
            <CityDot x={235} y={175} size={3} delay={0.75} label="SF" labelPos="left" />
            <CityDot x={375} y={190} size={4.5} delay={0.8} label="Houston" labelPos="right" />
            <CityDot x={395} y={170} size={3.5} delay={0.85} label="Dallas" labelPos="right" />
            <CityDot x={450} y={150} size={4.5} delay={0.9} label="Chicago" labelPos="right" />
            <CityDot x={540} y={130} size={5} delay={0.95} label="Nueva York" labelPos="right" />
            <CityDot x={510} y={155} size={3} delay={1.0} label="DC" labelPos="right" />
            <CityDot x={440} y={175} size={3} delay={1.05} label="Atlanta" labelPos="right" />
          </svg>
        </div>

        {/* Map footer stats — floating, no boxes */}
        <div style={{ display: "flex", gap: 64, padding: "32px 56px 72px" }}>
          <div>
            <div className="fa" style={{ color: "#fff", fontSize: 44, lineHeight: 1 }}>62</div>
            <div style={{ color: "rgba(57,255,20,0.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 6 }}>Shows en EUA</div>
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>82% del total</div>
          </div>
          <div>
            <div className="fa" style={{ color: "#fff", fontSize: 44, lineHeight: 1 }}>14</div>
            <div style={{ color: "rgba(57,255,20,0.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 6 }}>Shows en México</div>
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>12% del total</div>
          </div>
          <div>
            <div className="fa" style={{ color: "#fff", fontSize: 44, lineHeight: 1 }}>18</div>
            <div style={{ color: "rgba(57,255,20,0.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 6 }}>Países</div>
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gira global</div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. BIGGEST SHOWS — editorial, photos bleeding
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "0 0 80px" }}>
        <div style={{ padding: "0 56px 40px" }}>
          <div style={{ color: "rgba(57,255,20,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 12 }}>
            Biggest Reported Shows
          </div>
          <div className="fa" style={{ color: "#fff", fontSize: 44, textTransform: "uppercase", lineHeight: 0.9 }}>
            Las Noches<br />Más Grandes.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {topShows.map((show, i) => (
            <motion.div key={show.venue}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.7 }}
              style={{ position: "relative", height: 180, overflow: "hidden", cursor: "pointer" }}>
              <img src={show.img} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", filter: "brightness(0.3) saturate(0.7)", transition: "filter 0.4s" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(6,6,6,0.95) 0%, rgba(6,6,6,0.6) 50%, rgba(6,6,6,0.2) 100%)" }} />
              {/* Green left accent */}
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: i === 0 ? 3 : 1, background: i === 0 ? "#39FF14" : "rgba(57,255,20,0.2)" }} />

              <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 56px", gap: 40, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
                  <span className="fa" style={{ color: i === 0 ? "#39FF14" : "rgba(255,255,255,0.15)", fontSize: 52, lineHeight: 1 }}>
                    {show.rank}
                  </span>
                  <div>
                    <div className="fa" style={{ color: "#fff", fontSize: 28, textTransform: "uppercase", lineHeight: 1.1 }}>{show.venue}</div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>{show.city} · {show.date}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 56, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Tickets</div>
                    <div className="fa" style={{ color: "#fff", fontSize: 22 }}>{show.tickets}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>Gross</div>
                    <div className="fa" style={{ color: i === 0 ? "#39FF14" : "#fff", fontSize: 22 }}>{show.gross}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. MARKET IMPACT — fullscreen editorial
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 520, overflow: "hidden" }}>
        <img src={MARKET_IMG} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%", filter: "brightness(0.2) saturate(0.5)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, rgba(6,6,6,0.97) 40%, rgba(6,6,6,0.6) 70%, rgba(6,6,6,0.3) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,0.8) 0%, transparent 30%, transparent 70%, rgba(6,6,6,0.8) 100%)" }} />

        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", alignItems: "center", padding: "0 64px" }}>
          <div>
            <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 20 }}>#Market Impact</div>
            <div className="fa" style={{ color: "#fff", fontSize: 60, textTransform: "uppercase", lineHeight: 0.88, marginBottom: 24 }}>
              El Poder de<br />la Diáspora.
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, lineHeight: 1.9, maxWidth: 400, marginBottom: 40 }}>
              Peso Pluma construyó su base más sólida en Estados Unidos, donde la demanda por la nueva música mexicana sigue rompiendo récords en arenas y anfiteatros.
            </p>
            <div style={{ display: "flex", gap: 56 }}>
              <div>
                <div className="fa" style={{ color: "#39FF14", fontSize: 72, lineHeight: 1 }}>82%</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginTop: 8 }}>Shows en EUA</div>
              </div>
              <div>
                <div className="fa" style={{ color: "#fff", fontSize: 72, lineHeight: 1 }}>12%</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginTop: 8 }}>Shows en México</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          8. TOUR TIMELINE — cinematic horizontal
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "80px 0 100px", overflow: "hidden" }}>
        <img src={BG_CLOSE} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.06)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, transparent 15%, transparent 85%, rgba(6,6,6,1) 100%)" }} />

        <div style={{ position: "relative", zIndex: 10, padding: "0 56px" }}>
          <div style={{ color: "rgba(57,255,20,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 12 }}>Tour Timeline</div>
          <div className="fa" style={{ color: "#fff", fontSize: 48, textTransform: "uppercase", lineHeight: 0.9, marginBottom: 56 }}>
            Crecimiento<br />Año Tras Año.
          </div>

          {/* Timeline track */}
          <div style={{ position: "relative", marginBottom: 40 }}>
            <div style={{ position: "absolute", top: 10, left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <motion.div style={{ position: "absolute", top: 10, left: 0, height: 1, background: "linear-gradient(to right, #39FF14, rgba(57,255,20,0.3))" }}
              initial={{ width: 0 }} whileInView={{ width: "100%" }} viewport={{ once: true }}
              transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", paddingTop: 0 }}>
              {[
                { year: "2021", shows: 24, tickets: "72K", gross: "$2.5M", peak: false },
                { year: "2022", shows: 51, tickets: "189K", gross: "$8.9M", peak: false },
                { year: "2023", shows: 124, tickets: "412K", gross: "$41.8M", peak: true, tour: "Genesis Tour" },
                { year: "2024", shows: 89, tickets: "312K", gross: "$34.2M", peak: false },
              ].map((t, i) => (
                <motion.div key={t.year}
                  initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.6 }}>
                  {/* Dot */}
                  <div style={{ position: "relative", zIndex: 2, marginBottom: 24 }}>
                    <div style={{
                      width: t.peak ? 22 : 14, height: t.peak ? 22 : 14,
                      borderRadius: "50%",
                      background: t.peak ? "#39FF14" : "rgba(57,255,20,0.15)",
                      border: t.peak ? "none" : "1px solid rgba(57,255,20,0.3)",
                      marginTop: t.peak ? -5 : 0,
                      boxShadow: t.peak ? "0 0 24px rgba(57,255,20,0.5)" : "none",
                    }} />
                  </div>

                  {t.peak && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ background: "#39FF14", color: "#000", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", padding: "2px 8px" }}>
                        {t.tour}
                      </span>
                    </div>
                  )}

                  <div className="fa" style={{ color: t.peak ? "#39FF14" : "#fff", fontSize: 28, lineHeight: 1, marginBottom: 14 }}>{t.year}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600 }}>{t.shows} Shows</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{t.tickets} Tickets</div>
                    <div className="fa" style={{ color: t.peak ? "#39FF14" : "rgba(255,255,255,0.8)", fontSize: 20, marginTop: 4 }}>{t.gross}</div>
                    <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Gross Reportado</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            * Datos provistos por Pollstar Research · No incluye shows no reportados o datos no publicados
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          9. CLOSING CINEMATIC MOMENT
      ══════════════════════════════════════════ */}
      <section style={{ position: "relative", height: 380, overflow: "hidden" }}>
        <img src={BG_CROWD} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%", filter: "brightness(0.22) saturate(0.7)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(6,6,6,1) 0%, transparent 25%, transparent 65%, rgba(6,6,6,1) 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 1, background: "linear-gradient(to right, transparent, rgba(57,255,20,0.3), transparent)" }} />

        <div style={{ position: "relative", zIndex: 10, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div style={{ color: "rgba(57,255,20,0.5)", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4em", marginBottom: 16 }}>
            Datos Pollstar · 2021–2024
          </div>
          <div className="fa" style={{ color: "rgba(255,255,255,0.08)", fontSize: 160, textTransform: "uppercase", lineHeight: 0.85, letterSpacing: "0.05em", userSelect: "none" }}>
            PP
          </div>
          <div style={{ position: "absolute", color: "#fff", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.3em", fontWeight: 500 }}>
            Mexico<span style={{ color: "#39FF14" }}>Charts</span>™ · Touring
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: "20px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.15em" }}>
          © 2024 Mexico Charts · Datos provistos por Pollstar Research
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span className="fa" style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>Mexico</span>
          <span className="fa" style={{ color: "#39FF14", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>Charts</span>
          <sup style={{ color: "#39FF14", fontSize: 6, fontWeight: 700, marginLeft: 1 }}>™</sup>
        </div>
        <button style={{ background: "none", border: "none", color: "rgba(57,255,20,0.6)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", cursor: "pointer" }}>
          Ver en Pollstar →
        </button>
      </footer>
    </div>
  );
}

export default PollstarProfile;
