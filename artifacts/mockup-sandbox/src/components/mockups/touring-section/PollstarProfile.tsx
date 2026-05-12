import React, { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

const CONCERT_BG = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1280&h=700&fit=crop&q=80";
const ARTIST_STAGE = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=700&h=900&fit=crop&q=80";
const ARTIST_SIDE = "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=700&fit=crop&q=80";
const ARTIST_SMALL = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=500&fit=crop&q=80";

const VENUE_IMGS: Record<string, string> = {
  "Foro Sol": "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=160&h=90&fit=crop&q=60",
  "BMO Stadium": "https://images.unsplash.com/photo-1518604666860-9ed391f76460?w=160&h=90&fit=crop&q=60",
  "Credit Union 1": "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=160&h=90&fit=crop&q=60",
  "Hollywood Bowl": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=160&h=90&fit=crop&q=60",
  "Dos Equis Pavilion": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=160&h=90&fit=crop&q=60",
};

function AnimatedNumber({ to, prefix = "", suffix = "", decimals = 0, duration = 2 }: {
  to: number; prefix?: string; suffix?: string; decimals?: number; duration?: number;
}) {
  const val = useMotionValue(0);
  const display = useTransform(val, (v) =>
    prefix + (decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()) + suffix
  );
  useEffect(() => {
    const c = animate(val, to, { duration, ease: "easeOut" });
    return c.stop;
  }, []);
  return <motion.span>{display}</motion.span>;
}

function CircleProgress({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - pct / 100)), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#1a1a1a" strokeWidth="4" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke="#39FF14" strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dashoffset 1.8s ease-out" }}
      />
      <text x="36" y="41" textAnchor="middle" fill="#39FF14" fontSize="14" fontWeight="bold" fontFamily="sans-serif">
        {pct}%
      </text>
    </svg>
  );
}

const bigShows = [
  { rank: 1, venue: "Foro Sol", city: "Ciudad de México, México", date: "9 Sep 2023", tickets: 58999, gross: "$4.00M", img: VENUE_IMGS["Foro Sol"] },
  { rank: 2, venue: "BMO Stadium", city: "Los Ángeles, CA, USA", date: "11 Oct 2024 (2 shows)", tickets: 43658, gross: "$6.78M", img: VENUE_IMGS["BMO Stadium"] },
  { rank: 3, venue: "Credit Union 1 Amphitheatre", city: "Tinley Park, IL, USA", date: "31 Ago – 1 Sep 2025", tickets: 37251, gross: "$4.35M", img: VENUE_IMGS["Credit Union 1"] },
  { rank: 4, venue: "Hollywood Bowl", city: "Los Ángeles, CA, USA", date: "7–8 Nov 2025 (2 shows)", tickets: 33373, gross: "$5.45M", img: VENUE_IMGS["Hollywood Bowl"] },
  { rank: 5, venue: "Dos Equis Pavilion", city: "Dallas, TX, USA", date: "25–26 Oct 2025 (2 shows)", tickets: 34322, gross: "$3.55M", img: VENUE_IMGS["Dos Equis Pavilion"] },
];

const timeline = [
  { year: "2022", shows: 6, tickets: "6K", gross: "$76K" },
  { year: "2023", shows: 10, tickets: "63K", gross: "$785K" },
  { year: "2024", shows: 17, tickets: "146K", gross: "$2.8M" },
  { year: "2025", shows: 34, tickets: "424K", gross: "$51.2M" },
  { year: "2026*", shows: 2, tickets: "33K", gross: "$5.4M" },
];

export function PollstarProfile() {
  return (
    <div className="min-h-screen font-sans text-zinc-400 overflow-x-hidden" style={{ background: "#080808" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;900&display=swap');
        .font-anton { font-family: 'Anton', sans-serif; }
        body { margin: 0; }
      ` }} />

      {/* ─── NAV ─── */}
      <nav style={{ background: "#080808", borderBottom: "1px solid #1a1a1a" }} className="sticky top-0 z-50 h-14 flex items-center px-8">
        <div className="flex items-center gap-1">
          <span className="font-anton text-white text-xl tracking-widest uppercase">Mexico</span>
          <span className="font-anton text-[#39FF14] text-xl tracking-widest uppercase">Charts</span>
          <span className="text-[#39FF14] text-[10px] align-super ml-0.5 font-bold">™</span>
        </div>
        <div className="flex items-center gap-7 ml-16 text-[11px] uppercase tracking-widest font-bold text-zinc-500">
          {["Home", "Charts", "Certifications", "Artists", "Touring", "News", "About"].map(n => (
            <span key={n} style={n === "Touring" ? { color: "#39FF14", borderBottom: "2px solid #39FF14", paddingBottom: "2px" } : {}} className="cursor-pointer hover:text-white transition-colors">{n}</span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4 text-zinc-500">
          <span className="text-sm cursor-pointer hover:text-white">IG</span>
          <span className="text-sm cursor-pointer hover:text-white">X</span>
          <span className="text-sm cursor-pointer hover:text-white">YT</span>
          <span className="text-sm cursor-pointer hover:text-white">♪</span>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative w-full overflow-hidden" style={{ height: "480px" }}>
        {/* Background concert photo */}
        <div className="absolute inset-0">
          <img src={CONCERT_BG} alt="" className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(8,8,8,0.97) 35%, rgba(8,8,8,0.7) 60%, rgba(8,8,8,0.3) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(8,8,8,1) 0%, transparent 40%)" }} />
        </div>

        {/* Right: artist image with glow */}
        <div className="absolute right-0 top-0 h-full" style={{ width: "45%" }}>
          <img src={ARTIST_STAGE} alt="" className="h-full w-full object-cover object-top" style={{ maskImage: "linear-gradient(to left, rgba(0,0,0,0.8) 40%, transparent 100%)", WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.8) 40%, transparent 100%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 60% 40%, rgba(57,255,20,0.12) 0%, transparent 65%)" }} />
        </div>

        {/* Left content */}
        <div className="relative z-10 h-full flex flex-col justify-between px-10 py-8 max-w-2xl">
          <div>
            <div className="text-[#39FF14] text-xs uppercase tracking-[0.3em] font-bold mb-4">Touring Profile</div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="font-anton text-white uppercase leading-none"
              style={{ fontSize: "clamp(72px, 10vw, 108px)", lineHeight: 0.9 }}
            >
              Junior H
            </motion.h1>
          </div>

          <div>
            <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-1">Gross Reportado</div>
            <div className="font-anton leading-none" style={{ color: "#39FF14", fontSize: "88px" }}>
              $<AnimatedNumber to={90.4} decimals={1} />M
            </div>
            <div className="text-zinc-400 text-sm uppercase tracking-widest font-bold mt-1">USD en Taquilla</div>
          </div>

          <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
            Datos Pollstar · 2/12/2022 – 5/11/2026
          </div>
        </div>

        {/* Top-right tagline */}
        <div className="absolute top-8 right-10 text-right z-10">
          <div className="text-zinc-300 text-sm uppercase tracking-widest font-bold leading-relaxed">
            De la calle<br />a los escenarios<br />más grandes.
          </div>
          <div className="text-[#39FF14] text-xs mt-2 italic">— Sad Boyz 4 Life</div>
        </div>
      </section>

      {/* ─── STATS STRIP ─── */}
      <section style={{ background: "#0d0d0d", borderTop: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
        <div className="grid grid-cols-4 divide-x" style={{ divideColor: "#1a1a1a" }}>
          {[
            { icon: "🎟", value: "758K", label: "Tickets Vendidos", sublabel: "Total" },
            { icon: "📅", value: "69", label: "Shows", sublabel: "Total Reportados" },
            { icon: "👥", value: "11,856", label: "Asistencia Promedio", sublabel: "Por Show" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-4 px-8 py-6" style={{ borderRight: "1px solid #1a1a1a" }}>
              <span className="text-2xl opacity-60">{s.icon}</span>
              <div>
                <div className="font-anton text-white text-3xl leading-none">{s.value}</div>
                <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mt-1">{s.label}</div>
                <div className="text-zinc-700 text-[9px] uppercase tracking-widest">{s.sublabel}</div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 px-8 py-6">
            <CircleProgress pct={98} />
            <div>
              <div className="font-anton text-white text-3xl leading-none">98%</div>
              <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mt-1">Sell-Through</div>
              <div className="text-zinc-700 text-[9px] uppercase tracking-widest">Porcentaje Vendido</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TOUR MAP + BIGGEST SHOWS ─── */}
      <section className="flex" style={{ minHeight: "420px", borderBottom: "1px solid #1a1a1a" }}>

        {/* Left: Tour Map */}
        <div className="flex flex-col p-10" style={{ width: "52%", borderRight: "1px solid #1a1a1a", background: "#090c09" }}>
          <div className="text-[#39FF14] text-[10px] uppercase tracking-[0.3em] font-bold mb-4">Tour Map</div>
          <h2 className="font-anton text-white uppercase leading-tight mb-6" style={{ fontSize: "36px" }}>
            Llevando la Nueva<br />Música Mexicana<br />a Todo EUA.
          </h2>

          {/* Map visual */}
          <div className="flex-1 relative rounded-sm overflow-hidden mb-4" style={{ background: "#0a120a", border: "1px solid #1f2b1f", minHeight: "180px" }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Blank_US_Map_%28states_only%29.svg/800px-Blank_US_Map_%28states_only%29.svg.png" alt="" className="absolute inset-0 w-full h-full object-contain opacity-10" style={{ filter: "invert(1) sepia(1) saturate(2) hue-rotate(80deg)" }} />
            {/* Green dots for cities */}
            {[
              { top: "42%", left: "18%", size: 10, glow: true },
              { top: "38%", left: "22%", size: 7 },
              { top: "52%", left: "28%", size: 8 },
              { top: "35%", left: "42%", size: 7 },
              { top: "30%", left: "55%", size: 9 },
              { top: "40%", left: "60%", size: 8 },
              { top: "35%", left: "72%", size: 7 },
              { top: "50%", left: "68%", size: 11, glow: true },
              { top: "45%", left: "80%", size: 8 },
              { top: "55%", left: "75%", size: 7 },
              { top: "60%", left: "58%", size: 6 },
              { top: "70%", left: "30%", size: 12, glow: true },
              { top: "65%", left: "40%", size: 8 },
            ].map((dot, i) => (
              <div key={i} className="absolute rounded-full" style={{
                top: dot.top, left: dot.left,
                width: dot.size, height: dot.size,
                background: "#39FF14",
                transform: "translate(-50%, -50%)",
                boxShadow: dot.glow ? "0 0 12px 4px rgba(57,255,20,0.5)" : "0 0 6px 2px rgba(57,255,20,0.3)"
              }} />
            ))}
            <div className="absolute bottom-3 left-3 flex items-center gap-4 text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#39FF14", boxShadow: "0 0 6px #39FF14" }} />
                Headline Shows
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#39FF14", opacity: 0.4 }} />
                Festival Appearances
              </span>
            </div>
          </div>

          <div className="flex gap-10">
            <div>
              <div className="font-anton text-white text-4xl leading-none">62</div>
              <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mt-1">Shows en EUA</div>
              <div className="text-zinc-600 text-[9px]">(90%)</div>
            </div>
            <div>
              <div className="font-anton text-white text-4xl leading-none">4</div>
              <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mt-1">Shows en México</div>
              <div className="text-zinc-600 text-[9px]">(6%)</div>
            </div>
          </div>
          <div className="mt-4 text-[9px] text-zinc-700 italic">No incluye shows no reportados o datos no publicados.</div>
        </div>

        {/* Right: Biggest Reported Shows */}
        <div className="flex flex-col p-10" style={{ width: "48%" }}>
          <div className="text-[#39FF14] text-[10px] uppercase tracking-[0.3em] font-bold mb-5">Biggest Reported Shows</div>
          <div className="flex flex-col gap-0">
            {bigShows.map((show, i) => (
              <motion.div
                key={show.venue}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4 py-3"
                style={{ borderBottom: "1px solid #141414" }}
              >
                <span className="font-anton text-2xl leading-none w-6" style={{ color: i === 0 ? "#39FF14" : "#3a3a3a" }}>{show.rank}</span>
                <img src={show.img} alt="" className="rounded-sm object-cover flex-shrink-0" style={{ width: 64, height: 40 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm uppercase tracking-tight leading-tight">{show.venue}</div>
                  <div className="text-zinc-600 text-[10px] uppercase tracking-widest">{show.city}</div>
                  <div className="text-zinc-700 text-[9px]">{show.date}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-zinc-400 text-xs font-bold">{show.tickets.toLocaleString()}</div>
                  <div className="text-[9px] text-zinc-700 uppercase tracking-widest">Tickets</div>
                  <div className="font-anton text-white text-sm leading-tight">{show.gross}</div>
                  <div className="text-[9px] text-zinc-700 uppercase tracking-widest">Gross</div>
                </div>
              </motion.div>
            ))}
          </div>
          <button className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-zinc-400 hover:text-[#39FF14] transition-colors" style={{ border: "1px solid #222", padding: "8px 16px", borderRadius: 2, width: "fit-content" }}>
            Ver Todos los Shows <span className="text-base leading-none">›</span>
          </button>
        </div>
      </section>

      {/* ─── MARKET IMPACT ─── */}
      <section className="flex relative overflow-hidden" style={{ minHeight: "280px", borderBottom: "1px solid #1a1a1a" }}>
        {/* Artist photo left */}
        <div className="relative flex-shrink-0" style={{ width: "28%" }}>
          <img src={ARTIST_SIDE} alt="" className="w-full h-full object-cover" style={{ minHeight: 280 }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, transparent 60%, #080808 100%)" }} />
          {/* Green glow */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(57,255,20,0.15) 0%, transparent 60%)" }} />
          {/* Rancho Humilde logo area */}
          <div className="absolute bottom-6 left-6 text-[10px] uppercase tracking-widest font-bold text-zinc-600">
            Rancho Humilde
          </div>
        </div>

        {/* Center: editorial text */}
        <div className="flex flex-col justify-center px-10 py-10 flex-1" style={{ background: "#080808" }}>
          <div className="text-[#39FF14] text-[10px] uppercase tracking-[0.3em] font-bold mb-3">#Market Impact</div>
          <h2 className="font-anton text-white uppercase leading-tight mb-4" style={{ fontSize: "42px" }}>
            El Poder de la Diáspora.
          </h2>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-sm">
            Junior H ha construido su base más sólida en Estados Unidos,
            donde la demanda por la nueva música mexicana sigue
            rompiendo récords en arenas y anfiteatros.
          </p>
        </div>

        {/* Right: two big stats */}
        <div className="flex flex-col justify-center gap-8 px-12 flex-shrink-0" style={{ background: "#0a0a0a", borderLeft: "1px solid #1a1a1a", minWidth: "200px" }}>
          <div className="text-center">
            <div className="font-anton leading-none" style={{ color: "#39FF14", fontSize: "56px" }}>90%</div>
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mt-1">Shows en EUA</div>
          </div>
          <div className="text-center">
            <div className="font-anton leading-none" style={{ color: "#39FF14", fontSize: "56px" }}>6%</div>
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mt-1">Shows en México</div>
          </div>
        </div>
      </section>

      {/* ─── TOUR TIMELINE ─── */}
      <section className="flex items-stretch" style={{ minHeight: "220px", borderBottom: "1px solid #1a1a1a" }}>
        {/* Left: label + title */}
        <div className="flex flex-col justify-center px-10 py-8 flex-shrink-0" style={{ width: "34%", borderRight: "1px solid #1a1a1a" }}>
          <div className="text-[#39FF14] text-[10px] uppercase tracking-[0.3em] font-bold mb-3">Tour Timeline</div>
          <h2 className="font-anton text-white uppercase leading-tight" style={{ fontSize: "36px" }}>
            Crecimiento<br />Año Tras Año.
          </h2>
        </div>

        {/* Center: horizontal timeline */}
        <div className="flex-1 flex flex-col justify-center px-10 py-8">
          {/* Line + dots */}
          <div className="relative flex items-center" style={{ marginBottom: 28 }}>
            <div className="absolute left-0 right-0 h-px" style={{ background: "#1f1f1f", top: "50%" }} />
            <div className="relative flex justify-between w-full">
              {timeline.map((t, i) => (
                <div key={t.year} className="flex flex-col items-center relative" style={{ flex: 1 }}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="rounded-full border-2 relative z-10"
                    style={{
                      width: i === 3 ? 14 : 10,
                      height: i === 3 ? 14 : 10,
                      background: i === 3 ? "#39FF14" : "#1a1a1a",
                      borderColor: i === 3 ? "#39FF14" : "#333",
                      boxShadow: i === 3 ? "0 0 10px rgba(57,255,20,0.6)" : "none"
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Year labels + stats */}
          <div className="flex justify-between w-full">
            {timeline.map((t, i) => (
              <div key={t.year} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div className="font-bold text-xs mb-2" style={{ color: i === 3 ? "#39FF14" : "#666" }}>{t.year}</div>
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest text-center">{t.shows} Shows</div>
                <div className="text-[10px] text-zinc-600 text-center">{t.tickets} Tickets</div>
                <div className="text-xs font-bold mt-0.5 text-center" style={{ color: i === 3 ? "#fff" : "#555" }}>{t.gross}</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-zinc-700 mt-4 italic">*2026 hasta el 11 de mayo de 2026</div>
        </div>

        {/* Right: artist photo / monogram */}
        <div className="relative flex-shrink-0 overflow-hidden" style={{ width: "18%", borderLeft: "1px solid #1a1a1a" }}>
          <img src={ARTIST_SMALL} alt="" className="w-full h-full object-cover" style={{ opacity: 0.35, filter: "grayscale(1)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(57,255,20,0.08) 0%, transparent 70%)" }} />
          <div className="absolute inset-0 flex items-end justify-center pb-6">
            <div className="font-anton text-zinc-800 text-7xl leading-none select-none" style={{ letterSpacing: "-0.05em" }}>JH</div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="flex items-center justify-between px-10 py-5" style={{ borderTop: "1px solid #111" }}>
        <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-700">Mexico Charts™</div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-700">Datos provistos por Pollstar Research</div>
        <button className="text-[10px] uppercase tracking-widest font-bold text-[#39FF14] hover:underline flex items-center gap-1">
          Ver en Pollstar <span>›</span>
        </button>
      </footer>
    </div>
  );
}

export default PollstarProfile;
