import React, { useEffect, useState } from "react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";

const CONCERT_BG = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1280&h=600&fit=crop&q=80";
const ARTIST_IMG = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=640&h=580&fit=crop&q=80";
const ARTIST_SIDE = "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=500&h=400&fit=crop&q=75";

function AnimCount({ to, prefix = "", suffix = "", decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const v = useMotionValue(0);
  const d = useTransform(v, (n) => prefix + (decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()) + suffix);
  useEffect(() => { const c = animate(v, to, { duration: 2, ease: "easeOut" }); return c.stop; }, []);
  return <motion.span>{d}</motion.span>;
}

const chartData = [
  { year: "2021", gross: 2.5, label: "$2.5M", shows: 24 },
  { year: "2022", gross: 8.9, label: "$8.9M", shows: 51 },
  { year: "2023", gross: 41.8, label: "$41.8M", shows: 124, peak: true },
  { year: "2024", gross: 34.2, label: "$34.2M", shows: 89 },
];
const maxGross = Math.max(...chartData.map((d) => d.gross));

const toursData = [
  { name: "Genesis Tour", year: "2023", shows: 124, grossStr: "$41.8M", avgShow: "$337K", pct: 100, isBiggest: true, gross: 41.8 },
  { name: "Éxodo World Tour", year: "2024", shows: 89, grossStr: "$34.2M", avgShow: "$384K", pct: 82, isBiggest: false, gross: 34.2 },
  { name: "Doble P Tour", year: "2022", shows: 51, grossStr: "$8.9M", avgShow: "$174K", pct: 21, isBiggest: false, gross: 8.9 },
  { name: "Regional Breakout", year: "2021", shows: 24, grossStr: "$2.5M", avgShow: "$104K", pct: 6, isBiggest: false, gross: 2.5 },
];

const topVenues = [
  { rank: 1, name: "Foro Sol", city: "CDMX", shows: 8, gross: 18.4 },
  { rank: 2, name: "Crypto.com Arena", city: "Los Ángeles", shows: 4, gross: 9.1 },
  { rank: 3, name: "Madison Square Garden", city: "Nueva York", shows: 3, gross: 7.2 },
  { rank: 4, name: "Auditorio Nacional", city: "CDMX", shows: 6, gross: 5.8 },
  { rank: 5, name: "Toyota Center", city: "Houston", shows: 5, gross: 4.3 },
];
const maxVenueGross = Math.max(...topVenues.map((v) => v.gross));

export function PollstarProfile() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ background: "#080808", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#9ca3af" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;900&display=swap');
        .font-anton { font-family: 'Anton', sans-serif !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .venue-bar { transition: width 1s ease-out; }
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
      </nav>

      {/* ── 1. CINEMATIC HERO ── */}
      <section style={{ position: "relative", height: 460, overflow: "hidden" }}>
        <img src={CONCERT_BG} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(8,8,8,0.96) 38%, rgba(8,8,8,0.65) 62%, rgba(8,8,8,0.25) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,8,8,1) 0%, transparent 45%)" }} />

        {/* Artist from back */}
        <div style={{ position: "absolute", right: "8%", top: 0, height: "100%", width: 380 }}>
          <img src={ARTIST_IMG} alt="" style={{ height: "100%", width: "100%", objectFit: "cover", objectPosition: "center top", maskImage: "linear-gradient(to left, rgba(0,0,0,0.8) 30%, transparent 100%)", WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.8) 30%, transparent 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(57,255,20,0.12) 0%, transparent 65%)" }} />
        </div>

        {/* Left content */}
        <div style={{ position: "relative", zIndex: 10, padding: "48px 40px 36px", maxWidth: 540, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 14 }}>Historial de Giras · Touring Profile</div>
            <motion.h1 className="font-anton" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              style={{ color: "#fff", fontSize: 88, lineHeight: 0.88, textTransform: "uppercase" }}>
              Peso<br />Pluma
            </motion.h1>
          </div>
          <div>
            <div style={{ color: "#666", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 6 }}>Gross Reportado — Carrera Total</div>
            <div className="font-anton" style={{ color: "#39FF14", fontSize: 80, lineHeight: 1 }}>
              $<AnimCount to={87.4} decimals={1} />M
            </div>
            <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", marginTop: 4 }}>USD en Taquilla · 288 Shows · 18 Países</div>
          </div>
          <div style={{ color: "#444", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em" }}>
            Datos Pollstar · 2/01/2021 – 12/31/2024
          </div>
        </div>

        {/* Right tagline */}
        <div style={{ position: "absolute", top: 48, right: 44, zIndex: 10, textAlign: "right" }}>
          <div style={{ color: "#bbb", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.2em", lineHeight: 1.8, fontWeight: 600 }}>
            De la Calle<br />a los Escenarios<br />Más Grandes.
          </div>
        </div>
      </section>

      {/* ── 2. CAREER STATS STRIP ── */}
      <section style={{ borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a", background: "#0d0d0d" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Gira Más Lucrativa", value: "Genesis Tour", sub: "$41.8M" },
            { label: "Show Más Grande", value: "65,000", sub: "Foro Sol · CDMX" },
            { label: "Promedio Por Show", value: "$303K", sub: "Todas las giras" },
            { label: "Año Pico", value: "2023", sub: "124 shows · $41.8M" },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: "20px 28px", borderRight: i < 3 ? "1px solid #1a1a1a" : "none" }}>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
              <div style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>
                {s.value} {s.sub && <span style={{ color: "#39FF14", fontSize: 15 }}>{s.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. TOURING TIMELINE CHART (horizontally scrollable) ── */}
      <section style={{ padding: "40px 0 0", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ padding: "0 40px", display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 3, height: 20, background: "#39FF14" }} />
          <h2 style={{ color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 13 }}>Trayectoria de Giras</h2>
          <span style={{ color: "#444", fontSize: 11, marginLeft: 12 }}>Ingresos brutos por año · Fuente: Pollstar</span>
        </div>

        <div style={{ overflowX: "auto", padding: "0 40px 36px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 48, minWidth: 480, height: 180, position: "relative" }}>
            {/* Grid lines */}
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none", paddingBottom: 32 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: "100%", height: 1, background: "#141414" }} />
              ))}
            </div>

            {chartData.map((d, i) => (
              <div key={d.year} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end", position: "relative", minWidth: 90 }}>
                {/* Peak badge */}
                {d.peak && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
                    style={{ position: "absolute", top: 0, background: "#39FF14", color: "#000", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", padding: "2px 8px", borderRadius: 2 }}>
                    Pico
                    <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid #39FF14" }} />
                  </motion.div>
                )}
                {/* Value label */}
                <motion.div className="font-anton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.1 }}
                  style={{ color: d.peak ? "#39FF14" : "#fff", fontSize: 20, position: "absolute", top: d.peak ? 22 : 8 }}>
                  {d.label}
                </motion.div>
                {/* Bar */}
                <motion.div
                  style={{ width: "70%", background: d.peak ? "#39FF14" : "#1e3320", borderTop: d.peak ? "none" : "2px solid #39FF14", position: "relative", zIndex: 1 }}
                  initial={{ height: 0 }}
                  animate={{ height: mounted ? ((d.gross / maxGross) * 110) + "px" : 0 }}
                  transition={{ duration: 1, delay: i * 0.12, ease: "easeOut" }}
                />
                {/* Year label */}
                <div style={{ color: d.peak ? "#39FF14" : "#555", fontWeight: 700, fontSize: 11, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>{d.year}</div>
                <div style={{ color: "#444", fontSize: 9 }}>{d.shows} shows</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. TOUR ERAS ── */}
      <section style={{ padding: "40px 40px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{ width: 3, height: 20, background: "#39FF14" }} />
          <h2 style={{ color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 13 }}>Eras de Gira</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {toursData.map((tour, i) => (
            <motion.div key={tour.name}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.09 }}
              style={{
                position: "relative", padding: "24px 20px",
                border: tour.isBiggest ? "1px solid rgba(57,255,20,0.35)" : "1px solid #1a1a1a",
                background: tour.isBiggest ? "linear-gradient(135deg, rgba(57,255,20,0.06) 0%, transparent 60%)" : "#0a0a0a",
              }}>
              {tour.isBiggest && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#39FF14" }} />
              )}
              {tour.isBiggest && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ background: "#39FF14", color: "#000", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", padding: "2px 8px" }}>Mayor Ingreso</span>
                </div>
              )}
              <div style={{ color: "#555", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>{tour.year}</div>
              <div className="font-anton" style={{ color: "#fff", fontSize: 22, textTransform: "uppercase", lineHeight: 1.1, marginBottom: 12 }}>{tour.name}</div>
              <div className="font-anton" style={{ color: tour.isBiggest ? "#39FF14" : "#fff", fontSize: 36, lineHeight: 1, marginBottom: 4 }}>{tour.grossStr}</div>
              <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>{tour.shows} shows · {tour.avgShow} prom.</div>
              {/* Gross bar relative to biggest */}
              <div style={{ height: 2, background: "#1a1a1a", width: "100%" }}>
                <motion.div
                  style={{ height: "100%", background: tour.isBiggest ? "#39FF14" : "#2a3a2a" }}
                  initial={{ width: 0 }}
                  animate={{ width: mounted ? tour.pct + "%" : 0 }}
                  transition={{ duration: 1.2, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 5. BIGGEST NIGHT CARD ── */}
      <section style={{ padding: "40px 40px", borderBottom: "1px solid #1a1a1a", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#39FF14" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{ width: 3, height: 20, background: "#39FF14" }} />
          <h2 style={{ color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 13 }}>La Noche Más Grande</h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
          {/* Venue image */}
          <div style={{ position: "relative", width: 220, height: 140, borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
            <img src={ARTIST_SIDE} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.6)" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, transparent 50%, #080808 100%)" }} />
          </div>

          {/* Left: venue name */}
          <div style={{ flex: 1 }}>
            <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginBottom: 8 }}>Recinto</div>
            <div className="font-anton" style={{ color: "#fff", fontSize: 52, textTransform: "uppercase", lineHeight: 0.9 }}>Foro Sol</div>
            <div style={{ color: "#666", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 8 }}>Ciudad de México · 18 Nov 2023</div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 40, flexShrink: 0 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", border: "1px solid #39FF14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(57,255,20,0.05)" }}>
                <span style={{ color: "#39FF14", fontWeight: 900, fontSize: 16 }}>100%</span>
                <span style={{ color: "#fff", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>Sold Out</span>
              </div>
            </div>
            <div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 4 }}>Gross</div>
              <div className="font-anton" style={{ color: "#39FF14", fontSize: 40 }}>$4.2M</div>
            </div>
            <div>
              <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 4 }}>Asistencia</div>
              <div className="font-anton" style={{ color: "#fff", fontSize: 40 }}>65,000</div>
              <div style={{ color: "#555", fontSize: 10 }}>de 65,000</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. TOP VENUES ── */}
      <section style={{ padding: "40px 40px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 3, height: 20, background: "#39FF14" }} />
          <h2 style={{ color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", fontSize: 13 }}>Recintos Principales</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {topVenues.map((v, i) => (
            <motion.div key={v.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 12px", background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent", borderRadius: 2 }}>
              <span className="font-anton" style={{ color: v.rank === 1 ? "#39FF14" : "#2a2a2a", fontSize: 24, width: 28, flexShrink: 0 }}>{v.rank}</span>
              <div style={{ width: 220, flexShrink: 0 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{v.name}</div>
                <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>{v.city}</div>
              </div>
              <div style={{ color: "#666", fontSize: 12, width: 80, flexShrink: 0 }}>{v.shows} shows</div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, justifyContent: "flex-end" }}>
                <span className="font-anton" style={{ color: "#fff", fontSize: 18, letterSpacing: "0.03em" }}>${v.gross}M</span>
                <div style={{ width: 200, height: 3, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                  <motion.div
                    style={{ height: "100%", background: "#39FF14", borderRadius: 2 }}
                    initial={{ width: 0 }}
                    animate={{ width: ((v.gross / maxVenueGross) * 100) + "%" }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 7. FOOTER ── */}
      <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", borderTop: "1px solid #111" }}>
        <div style={{ color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Mexico Charts</div>
        <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>Datos provistos por Pollstar Research</div>
        <button style={{ background: "none", border: "none", color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
          Ver en Pollstar →
        </button>
      </footer>
    </div>
  );
}

export default PollstarProfile;
