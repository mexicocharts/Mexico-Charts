import { useState, useEffect, useMemo, useRef } from "react";
import { useArtistImages } from "@/hooks/useArtistImages";
import { Link } from "wouter";
import {
  motion, AnimatePresence,
  useScroll, useTransform,
  useReducedMotion,
} from "framer-motion";
import { Search, Menu, TrendingUp, MapPin, Music, Mail } from "lucide-react";
import { SiInstagram, SiX, SiTiktok, SiYoutube, SiSpotify, SiApple } from "react-icons/si";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

/* ─── NOISE SVG ──────────────────────────────────────────────── */
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

/* ─── DATA ──────────────────────────────────────────────────── */

const HERO_ARTISTS = [
  { rank:"#1", name:"Peso Pluma",     line1:"PESO",     line2:"PLUMA",  listeners:"32.4M", growth:"+18%", countries:"60+ PAÍSES", tag:"CORRIDOS TUMBADOS" },
  { rank:"#2", name:"Fuerza Regida",  line1:"FUERZA",   line2:"REGIDA", listeners:"12.4M", growth:"+31%", countries:"45+ PAÍSES", tag:"CORRIDOS TUMBADOS" },
  { rank:"#3", name:"Natanael Cano",  line1:"NATANAEL", line2:"CANO",   listeners:"11.7M", growth:"+22%", countries:"38+ PAÍSES", tag:"CORRIDOS TUMBADOS" },
  { rank:"#4", name:"Junior H",       line1:"JUNIOR",   line2:"H",      listeners:"9.8M",  growth:"+15%", countries:"32+ PAÍSES", tag:"REGIONAL MEXICANO" },
  { rank:"#5", name:"Carin León",     line1:"CARIN",    line2:"LEÓN",   listeners:"7.1M",  growth:"+28%", countries:"28+ PAÍSES", tag:"REGIONAL MEXICANO" },
];
const HERO_NAMES = HERO_ARTISTS.map(a => a.name);

const TOP_STRIP = [
  { rank:1,  name:"Peso Pluma",       genre:"Corridos Tumb.", streams:"32.4M", accent:"#39FF14" },
  { rank:2,  name:"Fuerza Regida",    genre:"Corridos Tumb.", streams:"12.4M", accent:"rgba(57,255,20,0.62)" },
  { rank:3,  name:"Natanael Cano",    genre:"Corridos Tumb.", streams:"11.7M", accent:"rgba(57,255,20,0.48)" },
  { rank:4,  name:"Junior H",         genre:"Reg. Mexicano",  streams:"9.8M",  accent:"rgba(255,255,255,0.42)" },
  { rank:5,  name:"Carin León",       genre:"Reg. Mexicano",  streams:"7.1M",  accent:"rgba(255,255,255,0.35)" },
  { rank:6,  name:"Luis R Conriquez", genre:"Norteño",        streams:"7.6M",  accent:"rgba(255,255,255,0.28)" },
  { rank:7,  name:"Grupo Frontera",   genre:"Norteño",        streams:"6.2M",  accent:"rgba(255,255,255,0.23)" },
  { rank:8,  name:"Xavi",            genre:"Corridos Tumb.", streams:"5.4M",  accent:"rgba(255,255,255,0.20)" },
  { rank:9,  name:"Eslabon Armado",   genre:"Reg. Mexicano",  streams:"5.1M",  accent:"rgba(255,255,255,0.18)" },
  { rank:10, name:"Chino Pacas",      genre:"Corridos Tumb.", streams:"4.8M",  accent:"rgba(255,255,255,0.15)" },
];

const GENRES = [
  { name:"Corridos Tumbados", streams:"48.3M", artists:48, accent:"#39FF14" },
  { name:"Regional Mexicano",  streams:"31.2M", artists:62, accent:"rgba(57,255,20,0.78)" },
  { name:"Norteño",            streams:"18.7M", artists:34, accent:"rgba(57,255,20,0.60)" },
  { name:"Banda",              streams:"14.2M", artists:29, accent:"rgba(57,255,20,0.46)" },
  { name:"Hip-Hop Mexicano",   streams:"9.6M",  artists:21, accent:"rgba(57,255,20,0.35)" },
  { name:"Pop Urbano",         streams:"6.8M",  artists:18, accent:"rgba(57,255,20,0.26)" },
];

const ASCENSO = [
  { name:"Tito Double P",    growth:"+78%", bar:78, accent:"#39FF14" },
  { name:"Oscar Maydon",     growth:"+65%", bar:65, accent:"rgba(57,255,20,0.72)" },
  { name:"Marca Registrada", growth:"+56%", bar:56, accent:"rgba(57,255,20,0.52)" },
  { name:"Clave Especial",   growth:"+49%", bar:49, accent:"rgba(57,255,20,0.36)" },
  { name:"Jasiel Nuñez",     growth:"+47%", bar:47, accent:"rgba(57,255,20,0.24)" },
];

const GIRAS = [
  { artist:"Peso Pluma",     tour:"Éxodo Tour",       dates:"Jun – Dic 2024", gross:"$60M+", accent:"#39FF14" },
  { artist:"Grupo Frontera", tour:"No Se Va Tour",    dates:"Jul – Nov 2024", gross:"$28M",  accent:"rgba(57,255,20,0.65)" },
  { artist:"Carin León",     tour:"Latinoamérica 24", dates:"Ago – Oct 2024", gross:"$19M",  accent:"rgba(57,255,20,0.48)" },
  { artist:"Natanael Cano",  tour:"CT Tour 2024",     dates:"Sep – Dic 2024", gross:"$12M",  accent:"rgba(57,255,20,0.34)" },
];

const TICKER_ITEMS = [
  "PESO PLUMA",
  "32.4M OYENTES",
  "ÉXODO TOUR",
  "FUERZA REGIDA",
  "12.4M OYENTES",
  "MUSICOLOGO",
  "NATANAEL CANO",
  "11.7M OYENTES",
  "CORRIDOS TUMBADOS",
  "JUNIOR H",
  "9.8M OYENTES",
  "EL AZUL",
  "CARIN LEÓN",
  "7.1M OYENTES",
  "BOCA CHUECA",
];

/* ─── MOTION VARIANTS ───────────────────────────────────────── */

const fadeUpVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

/* ─── COMPONENTS ─────────────────────────────────────────────── */

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      custom={delay}
      variants={fadeUpVariants}
    >
      {children}
    </motion.div>
  );
}

function Shelf({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-7 relative">
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background:"linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)" }} />
      <FadeUp>
        <div className="flex items-center gap-3 px-6 lg:px-12 mb-5">
          <span style={{ color:"#39FF14" }}>{icon}</span>
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">{label}</h2>
          <div className="flex-1 h-px ml-2" style={{ background:"rgba(255,255,255,0.07)" }} />
        </div>
      </FadeUp>
      <div
        className="flex gap-4 overflow-x-auto px-6 lg:px-12 pb-3"
        style={{ scrollSnapType:"x mandatory", scrollbarWidth:"none", WebkitOverflowScrolling:"touch" } as React.CSSProperties}
      >
        {children}
      </div>
    </section>
  );
}

/* ─── PAGE ───────────────────────────────────────────────────── */

export default function HomeV6() {
  const [heroIndex, setHeroIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tickerPaused, setTickerPaused] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  /* Scroll parallax for hero */
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const portraitY  = useTransform(heroScroll, [0,1], ["0%",  reduced ? "0%" : "18%"]);
  const rankY      = useTransform(heroScroll, [0,1], ["0%",  reduced ? "0%" : "30%"]);
  const textY      = useTransform(heroScroll, [0,1], ["0%",  reduced ? "0%" : "10%"]);

  /* Auto-cycle hero */
  useEffect(() => {
    const t = setInterval(() => setHeroIndex(i => (i + 1) % HERO_ARTISTS.length), 5000);
    return () => clearInterval(t);
  }, []);

  /* Artist images */
  const allNames = useMemo(() => [
    ...HERO_NAMES,
    ...TOP_STRIP.map(a => a.name),
    ...ASCENSO.map(a => a.name),
    ...GIRAS.map(a => a.artist),
  ], []);
  const artistImages = useArtistImages(allNames);
  const imgMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [k, v] of Object.entries(artistImages)) {
      if (v) m[k.toLowerCase()] = v;
    }
    return m;
  }, [artistImages]);
  const img = (name: string) => imgMap[name.toLowerCase()] ?? null;
  const hero = HERO_ARTISTS[heroIndex];

  return (
    <div
      className="min-h-[100dvh] text-zinc-300 overflow-x-hidden selection:bg-[#39FF14] selection:text-black"
      style={{ background:"radial-gradient(ellipse 100% 50% at 50% 0%, rgba(57,255,20,0.028) 0%, transparent 60%), #050505" }}
      data-testid="page-v6"
    >

      {/* ── VERSION BANNER ── */}
      <div className="border-b border-white/5 py-1.5 text-[10px] font-bold text-zinc-700 uppercase tracking-widest flex items-center justify-center gap-3">
        {([["V1","/v1"],["V2","/"],["V3","/v3"],["V4","/v4"],["V5","/v5"]] as [string,string][]).map(([l,h]) => (
          <Link key={l} href={h} className="hover:text-[#39FF14] transition-colors duration-200">{l}</Link>
        ))}
        <span className="text-zinc-800">|</span>
        <span style={{ color:"#39FF14" }}>V6 — HYBRID</span>
      </div>

      {/* ── GREEN TICKER — pause on hover ── */}
      <div
        className="bg-[#39FF14] overflow-hidden py-2 cursor-default"
        style={{ whiteSpace:"nowrap" }}
        onMouseEnter={() => setTickerPaused(true)}
        onMouseLeave={() => setTickerPaused(false)}
      >
        <div
          className="inline-block animate-marquee"
          style={{ willChange:"transform", animationPlayState: tickerPaused ? "paused" : "running" }}
        >
          <span className="text-black font-black text-[11px] uppercase tracking-[0.22em]">
            {TICKER_ITEMS.map((item, i) => (
              <span key={i}>
                {item}
                <span className="mx-4 opacity-30">·</span>
              </span>
            ))}
            {TICKER_ITEMS.map((item, i) => (
              <span key={`r-${i}`}>
                {item}
                <span className="mx-4 opacity-30">·</span>
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* ── NAV ── */}
      <nav
        className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{ background:"rgba(5,5,5,0.92)", backdropFilter:"blur(20px) saturate(180%)" }}
        data-testid="navigation"
      >
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/v6" className="flex-shrink-0" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90 hover:opacity-100 transition-opacity" />
          </Link>

          <div className="hidden lg:flex items-center gap-0.5">
            {["INICIO","ARTISTAS","CHARTS","GÉNEROS","TOURING"].map((item, i) => (
              <a key={item} href="#"
                className="px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] rounded-full transition-all duration-250"
                style={{
                  background: i===0 ? "#39FF14" : "transparent",
                  color: i===0 ? "#000" : "rgba(255,255,255,0.35)",
                }}
                onMouseEnter={e => { if (i!==0) (e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.75)"; }}
                onMouseLeave={e => { if (i!==0) (e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.35)"; }}
              >{item}</a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center border border-white/[0.08] bg-white/[0.03] rounded-full px-3 focus-within:border-[#39FF14]/40 transition-all duration-300">
              <input type="text" placeholder="Buscar artista..." className="bg-transparent text-xs text-zinc-400 placeholder-zinc-700 py-1.5 w-36 focus:outline-none" data-testid="input-search" />
              <Search className="w-3.5 h-3.5 text-zinc-600" />
            </div>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors duration-200" data-testid="link-social-ig"><SiInstagram className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors duration-200" data-testid="link-social-x"><SiX className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors duration-200" data-testid="link-social-tk"><SiTiktok className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors duration-200" data-testid="link-social-yt"><SiYoutube className="w-3.5 h-3.5" /></a>
          </div>

          <button className="lg:hidden text-zinc-500 hover:text-white transition-colors" onClick={() => setMenuOpen(o => !o)} data-testid="btn-mobile-menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }}
              transition={{ duration:0.25, ease:"easeInOut" }}
              className="lg:hidden overflow-hidden border-t border-white/5 bg-[#050505]"
            >
              <div className="px-6 py-4 flex flex-col gap-4">
                {["INICIO","ARTISTAS","CHARTS","GÉNEROS","TOURING"].map(item => (
                  <a key={item} href="#" className="text-sm font-black uppercase tracking-[0.15em] text-zinc-400 hover:text-[#39FF14] transition-colors">{item}</a>
                ))}
                <div className="flex gap-4 pt-2 border-t border-white/5">
                  <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiInstagram className="w-4 h-4" /></a>
                  <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiX className="w-4 h-4" /></a>
                  <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiTiktok className="w-4 h-4" /></a>
                  <a href="#" className="text-zinc-600 hover:text-white transition-colors"><SiYoutube className="w-4 h-4" /></a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ══════════════════════════════════════════════════════════
          HERO — V5 gradient + parallax + ambient glow + noise
      ══════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative overflow-hidden" style={{ height:"68vh", minHeight:"480px" }} data-testid="section-hero">

        {/* Base — obsidian black */}
        <div className="absolute inset-0" style={{ background:"#050505" }} />

        {/* Green atmospheric glow — brand identity */}
        {!reduced && (
          <>
            <motion.div
              className="absolute pointer-events-none"
              style={{ width:720, height:720, left:"-15%", top:"0%", borderRadius:"50%", background:"radial-gradient(circle, rgba(57,255,20,0.055) 0%, transparent 65%)", filter:"blur(90px)" }}
              animate={{ x:[0,35,0], y:[0,-25,0], scale:[1,1.12,1], opacity:[0.7,1,0.7] }}
              transition={{ duration:11, repeat:Infinity, ease:"easeInOut" }}
            />
            <motion.div
              className="absolute pointer-events-none"
              style={{ width:500, height:500, right:"0%", bottom:"-10%", borderRadius:"50%", background:"radial-gradient(circle, rgba(57,255,20,0.035) 0%, transparent 65%)", filter:"blur(80px)" }}
              animate={{ x:[0,-20,0], y:[0,18,0], scale:[1,1.18,1], opacity:[0.4,0.65,0.4] }}
              transition={{ duration:14, repeat:Infinity, ease:"easeInOut", delay:4 }}
            />
            {/* Left-side cinematic fog diffusion */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ width:520, height:680, left:"2%", top:"8%", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(57,255,20,0.018) 0%, transparent 68%)", filter:"blur(72px)" }}
              animate={{ x:[0,16,0], y:[0,24,0], opacity:[0.45,0.8,0.45] }}
              transition={{ duration:19, repeat:Infinity, ease:"easeInOut", delay:3 }}
            />
            {/* Subtle mid-hero depth layer */}
            <motion.div
              className="absolute pointer-events-none"
              style={{ width:360, height:360, left:"28%", top:"20%", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(57,255,20,0.012) 0%, transparent 70%)", filter:"blur(55px)" }}
              animate={{ x:[0,-12,0], y:[0,14,0], opacity:[0.3,0.6,0.3] }}
              transition={{ duration:23, repeat:Infinity, ease:"easeInOut", delay:7 }}
            />
          </>
        )}

        {/* Artist portrait — parallax */}
        <AnimatePresence mode="wait">
          {img(hero.name) && (
            <motion.div
              key={`portrait-${heroIndex}`}
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.9 }}
              className="absolute right-0 top-0 bottom-0 w-1/2 md:w-2/5 pointer-events-none"
              style={{
                y: portraitY,
                backgroundImage:`url(${img(hero.name)})`,
                backgroundSize:"cover", backgroundPosition:"center top",
                maskImage:"linear-gradient(to right, transparent 0%, black 38%)",
                WebkitMaskImage:"linear-gradient(to right, transparent 0%, black 38%)",
                filter:"saturate(0.58) contrast(1.1) brightness(0.83)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Cinematic vignette — directional layered */}
        <div className="absolute inset-0 pointer-events-none" style={{ background:"linear-gradient(to right, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.55) 42%, rgba(5,5,5,0.15) 68%, transparent 85%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background:"linear-gradient(to bottom, rgba(5,5,5,0.5) 0%, transparent 28%, rgba(5,5,5,0.55) 75%, #050505 100%)" }} />

        {/* Film grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: NOISE_SVG, backgroundSize:"128px", zIndex:3 }}
        />

        {/* Rank watermark — parallax */}
        <motion.div
          className="absolute right-6 md:right-10 bottom-0 font-black leading-none select-none pointer-events-none"
          style={{ fontSize:"clamp(7rem, 20vw, 16rem)", color:"rgba(255,255,255,0.055)", lineHeight:0.85, y: rankY, zIndex:2 }}
        >
          {hero.rank.replace("#","")}
        </motion.div>

        {/* Text content — parallax */}
        <motion.div
          className="relative h-full flex flex-col justify-end px-6 md:px-10 pb-8"
          style={{ y: textY, zIndex:4 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`text-${heroIndex}`}
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-14 }}
              transition={{ duration:0.55, ease:[0.16,1,0.3,1] }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.32em] mb-3" style={{ color:"#39FF14" }}>
                {hero.rank} EN MÉXICO
                <span className="mx-3 opacity-40">·</span>
                {hero.tag}
              </div>
              <h1
                className="font-black uppercase leading-[0.88] tracking-tight text-white mb-4"
                style={{ fontSize:"clamp(2.6rem, 9vw, 7.5rem)", textShadow:"0 2px 80px rgba(0,0,0,0.98), 0 0 200px rgba(0,0,0,0.8)" }}
              >
                {hero.line1} {hero.line2}
              </h1>
              <p className="text-sm text-white/55 uppercase tracking-[0.18em] mb-6 font-medium">
                {hero.listeners} OYENTES
                <span className="mx-3 opacity-40">·</span>
                {hero.countries}
                <span className="mx-3 opacity-40">·</span>
                <span style={{ color:"#39FF14" }}>{hero.growth} esta semana</span>
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <motion.button
                  whileHover={reduced ? {} : { scale:1.03 }}
                  whileTap={reduced ? {} : { scale:0.97 }}
                  className="px-6 py-2.5 text-xs font-black uppercase tracking-[0.12em] rounded-full text-black"
                  style={{ background:"#39FF14", boxShadow:"0 0 20px rgba(57,255,20,0.35)" }}
                  data-testid="btn-hero-cta"
                >
                  Ver Charts →
                </motion.button>
                <motion.button
                  whileHover={reduced ? {} : { scale:1.03, borderColor:"rgba(255,255,255,0.5)" }}
                  whileTap={reduced ? {} : { scale:0.97 }}
                  className="px-6 py-2.5 text-xs font-black uppercase tracking-[0.12em] rounded-full border border-white/25 text-white backdrop-blur-sm"
                >
                  Ver Perfil
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="absolute bottom-8 right-6 md:right-10 flex items-center gap-2">
            {HERO_ARTISTS.map((_, i) => (
              <button key={i} onClick={() => setHeroIndex(i)}
                className="transition-all duration-300 rounded-full focus:outline-none"
                style={{ width:i===heroIndex?22:6, height:6, background:i===heroIndex?"#39FF14":"rgba(255,255,255,0.25)", border:"none", padding:0, cursor:"pointer" }}
                aria-label={`Artista ${i+1}`}
              />
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── STATS TICKER ── */}
      <div
        className="border-b border-white/[0.05] bg-[#080808] overflow-hidden py-3"
        style={{ whiteSpace:"nowrap", borderTop:"1px solid rgba(57,255,20,0.07)", boxShadow:"inset 0 1px 0 rgba(57,255,20,0.04)" }}
        onMouseEnter={() => setTickerPaused(true)}
        onMouseLeave={() => setTickerPaused(false)}
      >
        <div
          className="inline-block animate-marquee-slow"
          style={{ willChange:"transform", animationPlayState: tickerPaused ? "paused" : "running" }}
        >
          <span className="text-zinc-700 font-black text-[10px] uppercase tracking-[0.28em]">
            {["250+ ARTISTAS","150+ REPORTES","10M+ DATOS","60+ PAÍSES","250K SEGUIDORES","SEMANA 19","MAYO 2024"].map((s,i)=>(
              <span key={i}>{s}<span className="mx-5 text-zinc-800">·</span></span>
            ))}
            {["250+ ARTISTAS","150+ REPORTES","10M+ DATOS","60+ PAÍSES","250K SEGUIDORES","SEMANA 19","MAYO 2024"].map((s,i)=>(
              <span key={`r${i}`}>{s}<span className="mx-5 text-zinc-800">·</span></span>
            ))}
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TOP 10 ARTIST CARDS — V5 cards + premium hover
      ══════════════════════════════════════════════════════════ */}
      <Shelf label="Top 10 · México · Esta Semana" icon={<TrendingUp className="w-4 h-4" />}>
        {TOP_STRIP.map((a, idx) => {
          const photo = img(a.name);
          return (
            <motion.div
              key={a.rank}
              initial={reduced ? { opacity:1 } : { opacity:0, y:16 }}
              whileInView={{ opacity:1, y:0 }}
              viewport={{ once:true, margin:"-40px" }}
              transition={{ duration:0.5, delay: idx * 0.055, ease:[0.16,1,0.3,1] }}
              whileHover={reduced ? {} : { scale:1.04, y:-4, transition:{ duration:0.28, ease:[0.16,1,0.3,1] } }}
              className="flex-shrink-0 relative cursor-pointer"
              style={{
                width:150, height:228, scrollSnapAlign:"start",
                borderRadius:"1rem",
                boxShadow:"0 4px 28px rgba(0,0,0,0.7)",
                border:"3px solid #050505",
                boxSizing:"border-box" as const,
              }}
              data-testid={`strip-card-${a.rank}`}
            >
              {/* Static clip container — overflow-hidden lives here, NOT on the animated motion.div,
                  so GPU compositing from framer-motion never interferes with border-radius clipping */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  borderRadius:"1rem",
                  background: photo ? `url(${photo}) center top / cover no-repeat` : "linear-gradient(160deg, #0a0a0a 0%, #141414 100%)",
                }}
              >
                {/* Dark edge vignette — kills bright photo content at card borders */}
                <div className="absolute inset-0 pointer-events-none" style={{ borderRadius:"1rem", boxShadow:"inset 0 0 0 3px rgba(3,3,3,1), inset 0 0 22px rgba(0,0,0,0.72)" }} />
                {/* Hover glow overlay */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  initial={{ opacity:0 }}
                  whileHover={{ opacity:1 }}
                  transition={{ duration:0.25 }}
                  style={{ boxShadow:`inset 0 0 0 1px ${a.accent}40, 0 0 24px ${a.accent}22` }}
                />

                {/* Brightness shift on hover via CSS */}
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-300" />
                {/* Inner top highlight */}
                <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background:"linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)" }} />
                {/* Cinematic grading overlay — unifies image warmth across all artists */}
                {photo && <div className="absolute inset-0 pointer-events-none" style={{ background:"rgba(6,12,8,0.26)", mixBlendMode:"multiply" }} />}

                {/* Rank watermark */}
                <div className="absolute top-2 left-3 font-black text-5xl leading-none select-none" style={{ color:"rgba(255,255,255,0.09)" }}>
                  {String(a.rank).padStart(2,"0")}
                </div>

                {/* Genre accent dot */}
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background:a.accent, boxShadow:`0 0 6px ${a.accent}` }} />

                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background:"linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)" }}>
                  <div className="font-black text-sm uppercase leading-tight text-white mb-0.5">{a.name}</div>
                  <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color:"rgba(255,255,255,0.48)" }}>{a.genre}</div>
                  <div className="text-[11px] font-black" style={{ color:a.accent }}>{a.streams}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </Shelf>

      {/* ══════════════════════════════════════════════════════════
          GENRE TERRITORIES — color blocks + depth
      ══════════════════════════════════════════════════════════ */}
      <section className="py-7 px-6 lg:px-12 relative" data-testid="section-generos">
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background:"linear-gradient(to right, transparent, rgba(57,255,20,0.1), transparent)" }} />
        <FadeUp>
          <div className="flex items-center gap-3 mb-5">
            <span style={{ color:"#39FF14" }}><Music className="w-4 h-4" /></span>
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Territorios de Género</h2>
            <div className="flex-1 h-px ml-2" style={{ background:"rgba(255,255,255,0.07)" }} />
          </div>
        </FadeUp>
        <motion.div
          className="grid grid-cols-2 md:grid-cols-3 gap-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once:true, margin:"-60px" }}
          variants={staggerContainer}
        >
          {GENRES.map((g) => (
            <motion.div
              key={g.name}
              variants={fadeUpVariants}
              whileHover={reduced ? {} : { scale:1.025, y:-2, transition:{ duration:0.22 } }}
              className="relative overflow-hidden cursor-pointer rounded-xl"
              style={{
                height:112,
                background:"linear-gradient(160deg, #0d0d0d 0%, #0a0a0a 100%)",
                border:`1px solid ${g.accent}1e`,
                boxShadow:`0 4px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
              }}
            >
              {/* Inner noise */}
              <div className="absolute inset-0 opacity-[0.05] rounded-xl pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"96px" }} />

              {/* Hover glow */}
              <motion.div
                className="absolute inset-0 rounded-xl pointer-events-none"
                initial={{ opacity:0 }}
                whileHover={{ opacity:1 }}
                transition={{ duration:0.3 }}
                style={{ background:`radial-gradient(ellipse at 20% 50%, ${g.accent}22 0%, transparent 65%)`, boxShadow:`inset 0 0 0 1px ${g.accent}30` }}
              />

              {/* Accent left bar */}
              <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full" style={{ background:g.accent, boxShadow:`0 0 8px ${g.accent}` }} />

              <div className="relative h-full flex flex-col justify-between p-4 pl-5">
                <div>
                  <div className="font-black text-sm uppercase leading-tight text-white">{g.name}</div>
                  <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color:"rgba(255,255,255,0.38)" }}>{g.artists} artistas activos</div>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-lg font-black" style={{ color:g.accent }}>{g.streams}</div>
                  <motion.span
                    className="text-[9px] uppercase tracking-widest font-black"
                    initial={{ opacity:0 }}
                    whileHover={{ opacity:1 }}
                    style={{ color:g.accent }}
                  >VER →</motion.span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          DATA BENTO — editorial depth
      ══════════════════════════════════════════════════════════ */}
      <section className="py-7 px-6 lg:px-12 relative" data-testid="section-bento">
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background:"linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)" }} />
        <FadeUp>
          <div className="flex items-center gap-3 mb-5">
            <span style={{ color:"#39FF14" }}><TrendingUp className="w-4 h-4" /></span>
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Estadísticas · Mayo 2024</h2>
            <div className="flex-1 h-px ml-2" style={{ background:"rgba(255,255,255,0.07)" }} />
          </div>
        </FadeUp>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* TOP ARTISTAS */}
          <FadeUp delay={0.05}>
            <div className="relative overflow-hidden rounded-xl p-6" style={{ background:"linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }} data-testid="bento-top-artistas">
              <div className="absolute inset-0 opacity-[0.025] rounded-xl pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"96px" }} />
              <div className="absolute -bottom-6 -right-4 font-black italic text-[110px] leading-none select-none pointer-events-none" style={{ color:"rgba(57,255,20,0.018)" }}>TOP</div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-0.5">PLATAFORMAS COMBINADAS</div>
                    <h3 className="text-base font-black uppercase text-white">TOP ARTISTAS <span style={{ color:"#39FF14" }}>MÉXICO</span></h3>
                  </div>
                  <a href="#" className="text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors" style={{ color:"#39FF14" }}>VER TODOS →</a>
                </div>
                <motion.div
                  className="flex flex-col gap-3"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once:true }}
                  variants={staggerContainer}
                >
                  {TOP_STRIP.slice(0,5).map((a) => {
                    const photo = img(a.name);
                    return (
                      <motion.div
                        key={a.rank}
                        variants={fadeUpVariants}
                        whileHover={reduced ? {} : { x:3, transition:{ duration:0.2 } }}
                        className="flex items-center gap-3 cursor-pointer group/row"
                      >
                        <div className="text-xl font-black text-zinc-800 w-8 font-mono shrink-0">{String(a.rank).padStart(2,"0")}</div>
                        {photo
                          ? <img src={photo} alt={a.name} className="w-9 h-9 rounded-full object-cover shrink-0 transition-all duration-300 group-hover/row:brightness-105" style={{ border:`1px solid ${a.accent}30`, filter:"saturate(0.68) contrast(1.08) brightness(0.86)" }} />
                          : <div className="w-9 h-9 rounded-full shrink-0" style={{ background:"#1c1c1c", border:`1px solid ${a.accent}30` }} />
                        }
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-black text-sm truncate group-hover/row:text-[#39FF14] transition-colors duration-200">{a.name}</div>
                          <div className="text-[10px] text-zinc-600 uppercase tracking-wider">{a.genre}</div>
                        </div>
                        <div className="text-xs font-black font-mono shrink-0 px-2 py-1 rounded-full transition-all duration-200 group-hover/row:scale-105" style={{ color:a.accent, background:`${a.accent}0e`, border:`1px solid ${a.accent}20` }}>{a.streams}</div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            </div>
          </FadeUp>

          {/* EN ASCENSO */}
          <FadeUp delay={0.1}>
            <div className="relative overflow-hidden rounded-xl p-6" style={{ background:"linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)" }} data-testid="bento-artistas-ascenso">
              <div className="absolute inset-0 opacity-[0.025] rounded-xl pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"96px" }} />
              <div className="absolute -bottom-4 -right-2 font-black italic text-[100px] leading-none select-none pointer-events-none" style={{ color:"rgba(57,255,20,0.018)" }}>↑</div>
              <div className="relative z-10 flex flex-col">
                <div className="mb-5">
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-0.5">CRECIMIENTO MENSUAL</div>
                  <h3 className="text-base font-black uppercase text-white">EN <span style={{ color:"#39FF14" }}>ASCENSO</span></h3>
                </div>
                <div className="flex flex-col gap-4">
                  {ASCENSO.map((a, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-bold text-sm">{a.name}</span>
                        <span className="font-black text-xs" style={{ color:a.accent }}>{a.growth}</span>
                      </div>
                      <div className="h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width:0 }}
                          whileInView={{ width:`${a.bar}%` }}
                          viewport={{ once:true }}
                          transition={{ duration:1.4, delay: idx * 0.12, ease:[0.16,1,0.3,1] }}
                          className="h-full rounded-full"
                          style={{ background:`linear-gradient(90deg, ${a.accent}, ${a.accent}60)`, boxShadow:`0 0 8px ${a.accent}50` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-5 font-bold">Crecimiento en Spotify · Semana 19</p>
              </div>
            </div>
          </FadeUp>

        </div>
      </section>

      {/* ── PLATFORM STRIP ── */}
      <FadeUp>
        <section className="px-6 lg:px-12 py-4" data-testid="platform-strip">
          <div className="rounded-xl overflow-hidden" style={{ background:"linear-gradient(160deg, #0d0d0d 0%, #090909 100%)", border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 6px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
            <div className="px-6 py-3 border-b border-white/[0.05]">
              <h2 className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">STREAMS POR PLATAFORMA · SEMANA 19</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/[0.05]">
              {[
                { icon:<SiSpotify className="w-5 h-5"/>, color:"#1DB954", name:"Spotify",     streams:"32.4M", share:"48%" },
                { icon:<SiYoutube className="w-5 h-5"/>, color:"#FF0000", name:"YouTube",     streams:"18.2M", share:"28%" },
                { icon:<SiApple className="w-5 h-5"/>,   color:"#FF2D55", name:"Apple Music", streams:"9.1M",  share:"14%" },
                { icon:<Music className="w-5 h-5"/>,     color:"#A238FF", name:"Deezer",      streams:"6.5M",  share:"10%" },
              ].map(p => (
                <motion.div
                  key={p.name}
                  whileHover={reduced ? {} : { backgroundColor:"rgba(255,255,255,0.02)", transition:{ duration:0.2 } }}
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                >
                  <motion.span
                    style={{ color:p.color }}
                    whileHover={reduced ? {} : { scale:1.18, filter:`drop-shadow(0 0 7px ${p.color}90)` }}
                    transition={{ duration:0.25 }}
                  >{p.icon}</motion.span>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-zinc-600 font-bold">{p.name}</div>
                    <div className="text-base font-black text-white">{p.streams}</div>
                    <div className="text-[10px] font-black" style={{ color:"#39FF14" }}>{p.share}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ══════════════════════════════════════════════════════════
          GIRAS SHELF — premium touring cards
      ══════════════════════════════════════════════════════════ */}
      <Shelf label="Próximas Giras · Artistas Mexicanos" icon={<MapPin className="w-4 h-4" />}>
        {GIRAS.map((g, i) => (
          <motion.div
            key={i}
            initial={reduced ? { opacity:1 } : { opacity:0, y:12 }}
            whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }}
            transition={{ duration:0.5, delay:i*0.07 }}
            whileHover={reduced ? {} : { scale:1.03, y:-3, transition:{ duration:0.22 } }}
            className="flex-shrink-0 relative overflow-hidden cursor-pointer rounded-xl"
            style={{
              width:272, height:162, scrollSnapAlign:"start",
              background:"linear-gradient(160deg, #0d0d0d 0%, #090909 100%)",
              border:`1px solid ${g.accent}1c`,
              boxShadow:`0 6px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            <div className="absolute inset-0 opacity-[0.045] rounded-xl pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"96px" }} />
            <motion.div
              className="absolute inset-0 rounded-xl pointer-events-none"
              initial={{ opacity:0 }}
              whileHover={{ opacity:1 }}
              transition={{ duration:0.3 }}
              style={{ background:`radial-gradient(ellipse at 10% 50%, ${g.accent}18, transparent 60%)`, boxShadow:`inset 0 0 0 1px ${g.accent}28` }}
            />
            <div className="absolute right-4 top-3 font-black text-6xl leading-none select-none pointer-events-none" style={{ color:"rgba(255,255,255,0.055)" }}>{g.artist[0]}</div>
            <div className="relative h-full flex flex-col justify-between p-5">
              <div>
                <div className="text-[9px] uppercase tracking-[0.22em] font-bold mb-1" style={{ color:"rgba(255,255,255,0.42)" }}>{g.dates}</div>
                <div className="font-black text-lg uppercase leading-tight text-white">{g.artist}</div>
                <div className="text-[11px] mt-0.5" style={{ color:"rgba(255,255,255,0.48)" }}>{g.tour}</div>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-sm font-black" style={{ color:g.accent, textShadow:`0 0 12px ${g.accent}70` }}>{g.gross} estimado</div>
                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color:g.accent }}>VER →</div>
              </div>
            </div>
          </motion.div>
        ))}
      </Shelf>

      {/* ── NEWSLETTER ── */}
      <FadeUp>
        <section className="px-6 lg:px-12 py-6">
          <div
            className="relative overflow-hidden rounded-2xl p-8 flex flex-col md:flex-row items-center gap-6 justify-between"
            style={{ background:"linear-gradient(135deg, rgba(57,255,20,0.06) 0%, rgba(57,255,20,0.012) 100%)", border:"1px solid rgba(57,255,20,0.16)", boxShadow:"0 0 60px rgba(57,255,20,0.05), inset 0 1px 0 rgba(57,255,20,0.1)" }}
          >
            <div className="absolute inset-0 opacity-[0.04] rounded-2xl pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"128px" }} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4" style={{ color:"#39FF14" }} />
                <span className="text-xs font-black uppercase tracking-[0.25em]" style={{ color:"#39FF14" }}>BOLETÍN SEMANAL</span>
              </div>
              <h3 className="text-xl font-black uppercase text-white mb-1">Reportes exclusivos directo a tu correo</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">Charts, análisis y estadísticas de la música mexicana cada semana.</p>
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <input
                type="email" placeholder="correo@ejemplo.com"
                className="bg-black/50 border border-white/10 rounded-full text-white text-xs px-4 py-3 focus:outline-none focus:border-[rgba(57,255,20,0.4)] transition-all duration-300 placeholder-zinc-700 md:w-56"
                data-testid="input-newsletter"
              />
              <motion.button
                whileHover={reduced ? {} : { scale:1.03 }}
                whileTap={reduced ? {} : { scale:0.97 }}
                className="text-black font-black text-xs uppercase tracking-widest px-6 py-3 rounded-full whitespace-nowrap"
                style={{ background:"#39FF14", boxShadow:"0 0 18px rgba(57,255,20,0.3)" }}
                data-testid="btn-newsletter"
              >SUSCRIBIRME</motion.button>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ── FOOTER ── */}
      <footer className="border-t pt-16 pb-8 px-6 lg:px-12 relative overflow-hidden" style={{ background:"linear-gradient(to bottom, #060606 0%, #030303 100%)", borderTop:"1px solid rgba(57,255,20,0.07)", boxShadow:"inset 0 1px 0 rgba(57,255,20,0.04)" }} data-testid="footer">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="font-black uppercase italic text-white leading-none whitespace-nowrap" style={{ fontSize:"clamp(60px,14vw,180px)", opacity:0.013, letterSpacing:"-0.03em" }}>MEXICO CHARTS</span>
        </div>
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage:NOISE_SVG, backgroundSize:"128px" }} />
        <div className="relative z-10 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div>
              <img src={logoUrl} alt="Mexico Charts" className="h-9 object-contain mb-4 opacity-90" />
              <p className="text-zinc-600 text-xs leading-relaxed max-w-[200px]">La fuente líder de estadísticas de la música mexicana en el mundo.</p>
              <div className="flex gap-4 mt-4">
                {([SiInstagram,SiX,SiTiktok,SiYoutube] as React.ElementType[]).map((Icon,i) => (
                  <a key={i} href="#" className="text-zinc-700 hover:text-[#39FF14] transition-colors duration-200"><Icon className="w-4 h-4" /></a>
                ))}
              </div>
            </div>
            {[
              { title:"Explorar",  links:["Charts","Artistas","Touring","Streaming","Noticias"] },
              { title:"Géneros",   links:["Corridos Tumbados","Regional Mexicano","Banda","Norteño","Pop Urbano"] },
              { title:"Compañía", links:["Acerca de","Metodología","Contacto","Privacidad"] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-600 mb-4">{col.title}</h4>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map(link => <li key={link}><a href="#" className="text-zinc-700 hover:text-zinc-300 transition-colors duration-200 text-xs">{link}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-6 gap-4" style={{ borderTop:"1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex gap-3 items-center text-[10px] font-bold uppercase tracking-widest">
              {([["V1","/v1"],["V2","/"],["V3","/v3"],["V4","/v4"],["V5","/v5"]] as [string,string][]).map(([l,h]) => (
                <Link key={l} href={h} className="text-zinc-700 hover:text-[#39FF14] transition-colors">{l}</Link>
              ))}
              <span style={{ color:"#39FF14" }}>V6</span>
            </div>
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold">© 2024 Mexico Charts. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
