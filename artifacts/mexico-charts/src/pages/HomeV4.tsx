import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { SiInstagram, SiX, SiTiktok, SiYoutube } from "react-icons/si";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const GREEN = "#39FF14";

const HERO_ARTISTS = [
  { name: "PESO\nPLUMA",      stat: "8.14M OYENTES · SEMANA 19", label: "SEMANA 19 · #1 EN MÉXICO" },
  { name: "FUERZA\nREGIDA",   stat: "4.31M OYENTES · SEMANA 19", label: "SEMANA 19 · #2 EN MÉXICO" },
  { name: "NATANAEL\nCANO",   stat: "3.97M OYENTES · SEMANA 19", label: "SEMANA 19 · #3 EN MÉXICO" },
  { name: "JUNIOR H",         stat: "3.62M OYENTES · SEMANA 19", label: "SEMANA 19 · #4 EN MÉXICO" },
  { name: "CARIN\nLEÓN",     stat: "3.18M OYENTES · SEMANA 19", label: "SEMANA 19 · #5 EN MÉXICO" },
];

const TOP_10 = [
  { rank: "01", artist: "Peso Pluma",        streams: "8.14M" },
  { rank: "02", artist: "Fuerza Regida",      streams: "4.31M" },
  { rank: "03", artist: "Natanael Cano",      streams: "3.97M" },
  { rank: "04", artist: "Junior H",           streams: "3.62M" },
  { rank: "05", artist: "Carin León",         streams: "3.18M" },
  { rank: "06", artist: "Grupo Frontera",     streams: "2.94M" },
  { rank: "07", artist: "Luis R Conriquez",   streams: "2.71M" },
  { rank: "08", artist: "Xavi",               streams: "2.43M" },
  { rank: "09", artist: "Eslabon Armado",     streams: "2.28M" },
  { rank: "10", artist: "Gabito Ballesteros", streams: "2.17M" },
];

const GENRES = [
  { name: "CORRIDOS TUMBADOS", streams: "12.4M" },
  { name: "REGIONAL MEXICANO", streams: "9.1M"  },
  { name: "NORTEÑO",           streams: "5.3M"  },
  { name: "BANDA",             streams: "4.2M"  },
  { name: "HIP-HOP MEXICANO",  streams: "2.8M"  },
  { name: "POP URBANO",        streams: "1.9M"  },
];

const REPORTES = [
  {
    date: "14 MAY 2024",
    title: "Éxodo Tour: El ascenso global de Peso Pluma",
    teaser: "Análisis de ciudades, ingresos y el impacto del tour más ambicioso del corrido.",
    featured: true,
  },
  {
    date: "10 MAY 2024",
    title: "Luis Miguel y el tour más lucrativo de México",
    teaser: "$318M en ingresos brutos — la gira que redefinió los estándares de la música mexicana.",
    featured: false,
  },
  {
    date: "07 MAY 2024",
    title: "Spotify México: Top 100 — Semana 19",
    teaser: "Oyentes mensuales, streams acumulados y crecimiento por artista en detalle.",
    featured: false,
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: "easeOut", delay },
});

const fadeUpView = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.85, ease: "easeOut", delay },
});

export default function HomeV4() {
  const [artistIdx, setArtistIdx] = useState(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredGenre, setHoveredGenre] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setArtistIdx(i => (i + 1) % HERO_ARTISTS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const artist = HERO_ARTISTS[artistIdx];

  return (
    <div
      className="min-h-[100dvh] bg-black text-white overflow-x-hidden selection:bg-[#39FF14] selection:text-black"
      style={{ fontFamily: "'Syne', sans-serif" }}
      data-testid="page-v4"
    >

      {/* ── VERSION BANNER ── */}
      <div className="border-b border-white/5 text-center py-1.5 text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-5 text-zinc-600">
        <Link href="/v1" className="hover:text-white transition-colors duration-300">V1</Link>
        <span className="text-white/10">·</span>
        <Link href="/" className="hover:text-white transition-colors duration-300">V2</Link>
        <span className="text-white/10">·</span>
        <Link href="/v3" className="hover:text-white transition-colors duration-300">V3</Link>
        <span className="text-white/10">·</span>
        <span style={{ color: GREEN }}>V4 — DARK LUXURY</span>
        <span className="text-white/10">·</span>
        <Link href="/v5" className="hover:text-white transition-colors duration-300">V5 →</Link>
      </div>

      {/* ── NAV ── */}
      <nav
        className="sticky top-0 z-50 border-b border-white/5 bg-black/90 backdrop-blur-md"
        data-testid="navigation"
      >
        <div className="px-8 h-14 flex items-center justify-between">
          <Link href="/v4" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-80 hover:opacity-100 transition-opacity" />
          </Link>
          <span className="text-[11px] uppercase tracking-[0.4em] text-zinc-500 hidden md:block">
            Mexico Charts
          </span>
          <div className="flex items-center gap-5">
            <a href="#" data-testid="link-social-ig" className="text-zinc-700 hover:text-white transition-colors duration-300"><SiInstagram className="w-4 h-4" /></a>
            <a href="#" data-testid="link-social-x"  className="text-zinc-700 hover:text-white transition-colors duration-300"><SiX className="w-4 h-4" /></a>
            <a href="#" data-testid="link-social-tk" className="text-zinc-700 hover:text-white transition-colors duration-300"><SiTiktok className="w-4 h-4" /></a>
            <a href="#" data-testid="link-social-yt" className="text-zinc-700 hover:text-white transition-colors duration-300"><SiYoutube className="w-4 h-4" /></a>
          </div>
        </div>
      </nav>

      {/* ── HERO — FULL VIEWPORT ── */}
      <section
        className="relative min-h-[100dvh] flex flex-col justify-center px-8 md:px-16 overflow-hidden"
        data-testid="section-hero"
      >
        {/* Label */}
        <motion.div {...fadeUp(0.1)} className="text-[11px] uppercase tracking-[0.3em] mb-8" style={{ color: GREEN }}>
          {artist.label}
        </motion.div>

        {/* Artist name — huge */}
        <div className="overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.h1
              key={artistIdx}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="font-black uppercase leading-[0.88] tracking-[-0.02em] whitespace-pre-line"
              style={{ fontSize: "clamp(4rem, 14vw, 13rem)", lineHeight: 0.88 }}
            >
              {artist.name}
            </motion.h1>
          </AnimatePresence>
        </div>

        {/* Stat line */}
        <AnimatePresence mode="wait">
          <motion.p
            key={`stat-${artistIdx}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8 text-[13px] uppercase tracking-[0.2em] text-zinc-500"
          >
            {artist.stat}
          </motion.p>
        </AnimatePresence>

        {/* Dot indicators — bottom left */}
        <div className="absolute bottom-12 left-8 md:left-16 flex items-center gap-3">
          {HERO_ARTISTS.map((_, i) => (
            <button
              key={i}
              onClick={() => setArtistIdx(i)}
              className="transition-all duration-500"
              style={{
                width: i === artistIdx ? "24px" : "6px",
                height: "6px",
                borderRadius: "3px",
                background: i === artistIdx ? GREEN : "rgba(255,255,255,0.2)",
              }}
              aria-label={`Ver artista ${i + 1}`}
            />
          ))}
        </div>

        {/* Scroll hint — bottom right */}
        <motion.div
          {...fadeUp(1.2)}
          className="absolute bottom-12 right-8 md:right-16 text-[10px] uppercase tracking-[0.3em] text-zinc-700"
        >
          Scroll ↓
        </motion.div>
      </section>

      {/* ── THE ROLL — TOP 10 ── */}
      <section className="px-8 md:px-16 py-24 border-t border-white/5" data-testid="section-roll">
        <motion.div {...fadeUpView()} className="text-[10px] uppercase tracking-[0.35em] mb-16" style={{ color: GREEN }}>
          Clasificación · Semana 19
        </motion.div>

        <div className="flex flex-col">
          {TOP_10.map((row, i) => (
            <motion.div
              key={row.rank}
              {...fadeUpView(i * 0.07)}
              className="flex items-center justify-between py-6 border-b border-white/5 cursor-pointer group"
              style={{
                transition: "all 0.3s ease",
              }}
              onMouseEnter={() => setHoveredRow(i)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {/* Rank */}
              <span
                className="font-black tabular-nums flex-shrink-0 transition-colors duration-300"
                style={{
                  fontSize: "clamp(2rem, 5vw, 5rem)",
                  color: hoveredRow === i ? GREEN : "rgba(255,255,255,0.08)",
                  lineHeight: 1,
                }}
              >
                {row.rank}
              </span>

              {/* Artist name */}
              <span
                className="flex-1 text-center font-black uppercase tracking-[-0.02em] transition-all duration-300"
                style={{
                  fontSize: "clamp(1.5rem, 3.5vw, 3.5rem)",
                  transform: hoveredRow === i ? "translateX(10px)" : "translateX(0)",
                  lineHeight: 1,
                }}
              >
                {row.artist}
              </span>

              {/* Streams */}
              <span
                className="flex-shrink-0 text-right font-bold tabular-nums transition-colors duration-300"
                style={{
                  fontSize: "clamp(1rem, 2vw, 1.8rem)",
                  color: hoveredRow === i ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
                }}
              >
                {row.streams}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── BIG NUMBER — FULL VIEWPORT ── */}
      <section
        className="min-h-[80vh] flex flex-col items-center justify-center text-center px-8 border-t border-white/5"
        data-testid="section-big-number"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        >
          <div
            className="font-black tracking-[-0.04em] leading-none"
            style={{
              fontSize: "clamp(5rem, 22vw, 20rem)",
              textShadow: `0 0 80px rgba(57,255,20,0.12), 0 0 200px rgba(57,255,20,0.06)`,
            }}
          >
            2.4B
          </div>
        </motion.div>
        <motion.p
          {...fadeUpView(0.3)}
          className="mt-8 text-[11px] uppercase tracking-[0.35em] text-zinc-600"
        >
          Streams Totales · México · Semana 19
        </motion.p>
      </section>

      {/* ── GENRES STRIP ── */}
      <section className="px-8 md:px-16 py-24 border-t border-white/5" data-testid="section-genres">
        <motion.div {...fadeUpView()} className="text-[10px] uppercase tracking-[0.35em] mb-16" style={{ color: GREEN }}>
          Géneros
        </motion.div>

        <div className="flex flex-wrap gap-x-12 gap-y-10">
          {GENRES.map((g, i) => (
            <motion.div
              key={g.name}
              {...fadeUpView(i * 0.06)}
              className="cursor-default group"
              onMouseEnter={() => setHoveredGenre(i)}
              onMouseLeave={() => setHoveredGenre(null)}
            >
              <div
                className="text-xl md:text-3xl font-black uppercase tracking-[-0.01em] pb-2 transition-all duration-300"
                style={{
                  borderBottom: hoveredGenre === i ? `2px solid ${GREEN}` : "2px solid transparent",
                  color: hoveredGenre === i ? "white" : "rgba(255,255,255,0.6)",
                }}
              >
                {g.name}
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-zinc-700">{g.streams}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── REPORTES ── */}
      <section className="px-8 md:px-16 py-24 border-t border-white/5" data-testid="section-reportes">
        <motion.div {...fadeUpView()} className="text-[10px] uppercase tracking-[0.35em] mb-16" style={{ color: GREEN }}>
          Reportes
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5">
          {REPORTES.map((r, i) => (
            <motion.div
              key={i}
              {...fadeUpView(i * 0.1)}
              className="bg-black p-10 flex flex-col gap-6 cursor-pointer group transition-colors duration-300 hover:bg-white/[0.02]"
              data-testid={`reporte-card-${i}`}
            >
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-700 group-hover:text-zinc-500 transition-colors duration-300">
                {r.date}
              </span>

              {r.featured && (
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: GREEN }}>
                  Destacado
                </span>
              )}

              <div
                className="h-px transition-colors duration-300"
                style={{ background: i === 0 ? GREEN : "rgba(255,255,255,0.08)" }}
              />

              <h3 className="text-xl md:text-2xl font-black uppercase leading-tight tracking-[-0.01em] transition-transform duration-300 group-hover:-translate-y-0.5">
                {r.title}
              </h3>

              <p className="text-sm text-zinc-600 leading-relaxed group-hover:text-zinc-500 transition-colors duration-300 flex-1">
                {r.teaser}
              </p>

              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-700 group-hover:text-white transition-colors duration-300">
                Leer →
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] uppercase tracking-[0.25em] text-zinc-700" data-testid="footer">
        <span>© 2024 Mexico Charts</span>
        <div className="flex items-center gap-5">
          <Link href="/v1" className="hover:text-white transition-colors duration-300">V1</Link>
          <span className="text-white/10">·</span>
          <Link href="/" className="hover:text-white transition-colors duration-300">V2</Link>
          <span className="text-white/10">·</span>
          <Link href="/v3" className="hover:text-white transition-colors duration-300">V3</Link>
          <span className="text-white/10">·</span>
          <span style={{ color: GREEN }}>V4 — Dark Luxury</span>
        </div>
        <span>v4.1.0-dark</span>
      </footer>

    </div>
  );
}
