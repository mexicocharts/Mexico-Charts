import { useState, useCallback, useEffect, useMemo } from "react";
import { useArtistImages } from "@/hooks/useArtistImages";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, Globe, Mail } from "lucide-react";
import { SiInstagram, SiX, SiTiktok, SiYoutube, SiSpotify, SiApple } from "react-icons/si";
import { Music } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const HERO_ARTISTS = [
  {
    rank: "#1",
    line1: "PESO",
    line2: "PLUMA",
    listeners: "32.4M OYENTES MENSUALES",
    growth: "+18% ESTA SEMANA",
    countries: "60+ PAÍSES",
    tag: "CORRIDOS TUMBADOS",
    featuredTag: "TOURING",
    featuredRank: "01",
    featuredTitle: "ÉXODO\nTOUR",
    featuredArtist: "PESO PLUMA",
    featuredDesc: "Análisis completo del tour más importante de la música mexicana en 2024.",
  },
  {
    rank: "#2",
    line1: "FUERZA",
    line2: "REGIDA",
    listeners: "12.4M OYENTES MENSUALES",
    growth: "+31% ESTA SEMANA",
    countries: "45+ PAÍSES",
    tag: "CORRIDOS TUMBADOS",
    featuredTag: "STREAMING",
    featuredRank: "02",
    featuredTitle: "MÚSICO\nLOGO",
    featuredArtist: "FUERZA REGIDA",
    featuredDesc: "El álbum que consolidó a Fuerza Regida como la banda más escuchada de su género.",
  },
  {
    rank: "#3",
    line1: "NATANAEL",
    line2: "CANO",
    listeners: "11.7M OYENTES MENSUALES",
    growth: "+22% ESTA SEMANA",
    countries: "38+ PAÍSES",
    tag: "CORRIDOS TUMBADOS",
    featuredTag: "CHARTS",
    featuredRank: "03",
    featuredTitle: "PA'\nTODOS",
    featuredArtist: "NATANAEL CANO",
    featuredDesc: "El pionero del movimiento corridos tumbados y su impacto en la música global.",
  },
  {
    rank: "#4",
    line1: "JUNIOR",
    line2: "H",
    listeners: "9.8M OYENTES MENSUALES",
    growth: "+15% ESTA SEMANA",
    countries: "32+ PAÍSES",
    tag: "REGIONAL MEXICANO",
    featuredTag: "ARTISTA",
    featuredRank: "04",
    featuredTitle: "EL\nAZUL",
    featuredArtist: "JUNIOR H",
    featuredDesc: "De las calles de Sonora al mundo: el ascenso imparable de Junior H en streaming.",
  },
  {
    rank: "#5",
    line1: "CARIN",
    line2: "LEÓN",
    listeners: "7.1M OYENTES MENSUALES",
    growth: "+28% ESTA SEMANA",
    countries: "28+ PAÍSES",
    tag: "REGIONAL MEXICANO",
    featuredTag: "TOURING",
    featuredRank: "05",
    featuredTitle: "BOCA\nCHUECA",
    featuredArtist: "CARIN LEÓN",
    featuredDesc: "El sonido nortec que conquistó las radios latinas y los festivales internacionales.",
  },
];

const TICKER_ITEMS = [
  "PESO PLUMA — ÉXODO TOUR — 32.4M OYENTES",
  "FUERZA REGIDA — MUSICOLOGO — 12.4M OYENTES",
  "NATANAEL CANO — CORRIDOS TUMBADOS — 11.7M OYENTES",
  "JUNIOR H — EL AZUL — 9.8M OYENTES",
  "LUIS R CONRIQUEZ — NORTEÑO — 7.6M OYENTES",
  "CARIN LEÓN — BOCA CHUECA — 7.1M OYENTES",
  "GRUPO FRONTERA — NO SE VA — 6.2M OYENTES",
  "XAVI — LA DIABLA — 5.4M OYENTES",
];

const STATS_TICKER = [
  "250+ ARTISTAS ANALIZADOS",
  "150+ REPORTES",
  "10M+ DATOS",
  "60+ PAÍSES",
  "250K+ COMUNIDAD",
];

const TOP_ARTISTAS = [
  { rank: "01", name: "Peso Pluma", listeners: "32.4M", genre: "Corridos Tumbados" },
  { rank: "02", name: "Fuerza Regida", listeners: "12.4M", genre: "Corridos Tumbados" },
  { rank: "03", name: "Natanael Cano", listeners: "11.7M", genre: "Corridos Tumbados" },
  { rank: "04", name: "Junior H", listeners: "9.8M", genre: "Regional Mexicano" },
  { rank: "05", name: "Carin León", listeners: "7.1M", genre: "Regional Mexicano" },
];

const ASCENSO = [
  { name: "Tito Double P", growth: "+78%", bar: 78 },
  { name: "Oscar Maydon", growth: "+65%", bar: 65 },
  { name: "Marca Registrada", growth: "+56%", bar: 56 },
  { name: "Clave Especial", growth: "+49%", bar: 49 },
  { name: "Jasiel Nuñez", growth: "+47%", bar: 47 },
];

const TOURING = [
  { rank: "01", tour: "Luis Miguel Tour 2023-24", gross: "$318.2M" },
  { rank: "02", tour: "Peso Pluma Éxodo Tour", gross: "$60M+" },
  { rank: "03", tour: "RBD Soy Rebelde Tour", gross: "$54.4M" },
  { rank: "04", tour: "Grupo Firme Tour 2022", gross: "$45.7M" },
  { rank: "05", tour: "Bad Bunny World's Hottest", gross: "$41.9M" },
];

const NOTICIAS = [
  { tag: "TOURING", title: "Peso Pluma anuncia nuevas fechas en Europa para 2025", date: "16 MAY 2024" },
  { tag: "STREAMING", title: "Fuerza Regida rompe récord histórico en Spotify México", date: "15 MAY 2024" },
  { tag: "CHARTS", title: "Top 100 México: Lo más escuchado del momento en todas las plataformas", date: "14 MAY 2024" },
];

const REPORTES = [
  { tag: "TOURING", title: "Peso Pluma — Éxodo Tour", desc: "Análisis completo: ciudades, ingresos, asistentes y alcance global del tour más importante del año.", featured: true },
  { tag: "TOURING", title: "Luis Miguel Tour 2023-24", desc: "El tour más lucrativo de la música mexicana." },
  { tag: "STREAMING", title: "Artistas Mexicanos en Spotify 2024", desc: "Ranking de oyentes, streams y crecimiento." },
  { tag: "YOUTUBE", title: "Top Mexicanos en YouTube", desc: "Los artistas mexicanos más vistos del año." },
];

const PLATFORMS = [
  {
    id: "spotify",
    name: "Spotify",
    icon: SiSpotify,
    color: "#1DB954",
    bgStart: "#1a1a1a",
    bgEnd: "#0d1f12",
    accent: "rgba(29,185,84,0.15)",
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: SiYoutube,
    color: "#FF0000",
    bgStart: "#1a1a1a",
    bgEnd: "#1f0d0d",
    accent: "rgba(255,0,0,0.12)",
  },
  {
    id: "apple",
    name: "Apple Music",
    icon: SiApple,
    color: "#fa57c1",
    bgStart: "#1a1a1a",
    bgEnd: "#1f0d18",
    accent: "rgba(250,87,193,0.12)",
  },
  {
    id: "deezer",
    name: "Deezer",
    icon: Music,
    color: "#A238FF",
    bgStart: "#1a1a1a",
    bgEnd: "#130d1f",
    accent: "rgba(162,56,255,0.12)",
  },
];

const COLORS = [
  "from-green-600 to-green-900",
  "from-zinc-500 to-zinc-800",
  "from-emerald-600 to-emerald-900",
  "from-lime-600 to-lime-900",
  "from-teal-600 to-teal-900",
];

export default function HomeV3() {
  const [searchQuery, setSearchQuery] = useState("");
  const [heroIndex, setHeroIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start", dragFree: true });
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex(i => (i + 1) % HERO_ARTISTS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const hero = HERO_ARTISTS[heroIndex];

  const artistNames = useMemo(() => {
    const heroNames = HERO_ARTISTS.map(a => a.featuredArtist);
    const topNames = TOP_ARTISTAS.map(a => a.name);
    return [...new Set([...topNames, ...heroNames])];
  }, []);
  const artistImages = useArtistImages(artistNames);

  const artistImageByLower = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(artistImages)) {
      if (v) map[k.toLowerCase()] = v;
    }
    return map;
  }, [artistImages]);

  const getArtistImage = (name: string): string | null =>
    artistImageByLower[name.toLowerCase()] ?? null;

  const tickerContent = TICKER_ITEMS.join("   ·   ");
  const statsContent = STATS_TICKER.map(s => `${s}   ·`).join("   ");

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-zinc-300 overflow-x-hidden selection:bg-[#39FF14] selection:text-black font-sans">

      {/* ── VERSION BANNER ── */}
      <div className="bg-[#050505] border-b border-white/5 text-center py-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center justify-center gap-4">
        <Link href="/v1" className="hover:text-[#39FF14] transition-colors">← V1</Link>
        <span className="text-zinc-800">|</span>
        <Link href="/" className="hover:text-[#39FF14] transition-colors">V2</Link>
        <span className="text-zinc-800">|</span>
        <span className="text-[#39FF14]">V3 — CINEMATIC BENTO</span>
        <span className="text-zinc-800">|</span>
        <Link href="/v4" className="hover:text-[#39FF14] transition-colors">V4</Link>
        <span className="text-zinc-800">|</span>
        <Link href="/v5" className="hover:text-[#39FF14] transition-colors">V5 →</Link>
      </div>

      {/* ── TOP TICKER ── */}
      <div
        className="bg-[#39FF14] overflow-hidden py-2 relative"
        data-testid="ticker-top"
        style={{ whiteSpace: "nowrap" }}
      >
        <div
          className="inline-block animate-marquee"
          style={{ willChange: "transform" }}
        >
          <span className="text-black font-black text-xs uppercase tracking-[0.2em] px-8">
            {tickerContent}   ·   {tickerContent}
          </span>
        </div>
      </div>

      {/* ── NAV ── */}
      <nav
        className="sticky top-0 z-50 border-b border-white/8 bg-[#050505]/95 backdrop-blur-lg"
        data-testid="navigation"
      >
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-6">
          <Link href="/v3" className="flex-shrink-0" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain" />
          </Link>

          <div className="hidden lg:flex items-center text-[11px] font-black tracking-[0.18em] uppercase text-zinc-500" style={{ gap: "24px" }}>
            {["Inicio","Artistas","Charts","Touring","Streaming","Noticias"].map((item) => (
              <a key={item} href="#" className="hover:text-[#39FF14] transition-colors duration-200 whitespace-nowrap">
                {item}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <div
              className="flex items-center border border-white/8 bg-white/3 focus-within:border-[#39FF14]/50 transition-colors"
              data-testid="search-bar"
            >
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="bg-transparent text-xs text-zinc-400 placeholder-zinc-700 px-3 py-2 w-36 focus:outline-none focus:w-48 transition-all duration-300"
                data-testid="input-search"
              />
              <button className="text-zinc-600 hover:text-[#39FF14] px-2 py-2 transition-colors" data-testid="btn-search">
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors" data-testid="link-social-ig"><SiInstagram className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors" data-testid="link-social-x"><SiX className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors" data-testid="link-social-tk"><SiTiktok className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors" data-testid="link-social-yt"><SiYoutube className="w-3.5 h-3.5" /></a>
          </div>

          <button className="lg:hidden text-zinc-500" data-testid="btn-mobile-menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* ── CINEMATIC HERO ── */}
      <section
        className="relative w-full min-h-[100svh] flex overflow-hidden"
        data-testid="section-hero"
        style={{ background: "#050505" }}
      >
        {/* Animated gradient blobs */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {/* Blob 1 — large green, left-center */}
          <div
            className="hero-blob-1 absolute"
            style={{
              width: "900px",
              height: "700px",
              left: "-10%",
              top: "10%",
              background: "radial-gradient(ellipse at center, rgba(57,255,20,0.13) 0%, rgba(57,255,20,0.04) 40%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          {/* Blob 2 — medium green, bottom-right */}
          <div
            className="hero-blob-2 absolute"
            style={{
              width: "600px",
              height: "600px",
              right: "5%",
              bottom: "-10%",
              background: "radial-gradient(ellipse at center, rgba(57,255,20,0.09) 0%, rgba(57,255,20,0.03) 50%, transparent 75%)",
              filter: "blur(60px)",
            }}
          />
          {/* Blob 3 — subtle silver, top-right */}
          <div
            className="hero-blob-3 absolute"
            style={{
              width: "500px",
              height: "400px",
              right: "20%",
              top: "5%",
              background: "radial-gradient(ellipse at center, rgba(180,200,180,0.04) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          {/* Blob 4 — accent green, mid */}
          <div
            className="hero-blob-2 absolute"
            style={{
              width: "400px",
              height: "400px",
              left: "30%",
              top: "40%",
              background: "radial-gradient(ellipse at center, rgba(57,255,20,0.06) 0%, transparent 65%)",
              filter: "blur(80px)",
              animationDelay: "-8s",
            }}
          />
        </div>

        {/* Artist portrait — mobile only (desktop uses the right featured panel instead) */}
        <AnimatePresence mode="wait">
          {getArtistImage(hero.featuredArtist) && (
            <motion.div
              key={`hero-portrait-${heroIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="xl:hidden absolute right-0 top-0 bottom-0 pointer-events-none"
              style={{
                zIndex: 5,
                width: "55%",
                backgroundImage: `url(${getArtistImage(hero.featuredArtist)})`,
                backgroundSize: "cover",
                backgroundPosition: "center top",
                maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 30%, black 60%)",
                WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 30%, black 60%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Noise/grain overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035] z-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "128px",
          }}
        />

        {/* Left 65%: Giant stacked italic type — auto-cycling */}
        <div className="relative z-20 flex flex-col justify-center px-8 xl:px-16 pt-12 pb-24 xl:w-[65%] w-full overflow-hidden">

          <AnimatePresence mode="wait">
            <motion.div
              key={heroIndex}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-[#39FF14] mb-6 opacity-80">
                {hero.rank} EN MÉXICO — {hero.tag}
              </div>

              <h1
                className="font-black italic uppercase leading-[0.86] tracking-tighter text-white select-none"
                style={{ fontSize: "clamp(64px, 12vw, 180px)" }}
              >
                <span className="block">{hero.line1}</span>
                <span
                  className="block animate-glow-pulse-text"
                  style={{ color: "#39FF14" }}
                >
                  {hero.line2}
                </span>
              </h1>

              <div className="mt-10 flex flex-wrap gap-3">
                <div
                  className="px-4 py-2 border text-xs font-black uppercase tracking-widest text-[#39FF14]"
                  style={{ borderColor: "rgba(57,255,20,0.3)", background: "rgba(57,255,20,0.06)" }}
                >
                  {hero.listeners}
                </div>
                <div
                  className="px-4 py-2 border text-xs font-black uppercase tracking-widest text-white"
                  style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
                >
                  {hero.growth}
                </div>
                <div
                  className="px-4 py-2 border text-xs font-black uppercase tracking-widest text-white"
                  style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)" }}
                >
                  {hero.countries}
                </div>
              </div>

              <div className="mt-10">
                <button
                  className="bg-[#39FF14] text-black font-black text-sm uppercase tracking-widest px-8 py-4 hover:bg-white transition-colors animate-glow-pulse"
                  data-testid="btn-hero-cta"
                >
                  EXPLORAR REPORTES →
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators — clickable, show active */}
          <div className="absolute bottom-8 left-8 xl:left-16 flex gap-2 items-center">
            {HERO_ARTISTS.map((_, i) => (
              <button
                key={i}
                onClick={() => setHeroIndex(i)}
                className="transition-all duration-300"
                style={{
                  width: i === heroIndex ? "24px" : "6px",
                  height: "6px",
                  background: i === heroIndex ? "#39FF14" : "rgba(255,255,255,0.2)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
                aria-label={`Artista ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Right 35%: Featured card — also cycles */}
        <div className="hidden xl:flex xl:w-[35%] flex-col relative border-l border-white/5 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #050505 100%)" }}
        >
          {/* Artist portrait background — fades in per slide */}
          <AnimatePresence mode="wait">
            {getArtistImage(hero.featuredArtist) && (
              <motion.div
                key={`portrait-${heroIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `url(${getArtistImage(hero.featuredArtist)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                  maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                }}
              />
            )}
          </AnimatePresence>
          {/* Dark overlay so text stays readable over the photo */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(5,5,5,0.55)" }} />

          <AnimatePresence mode="wait">
            <motion.div
              key={`right-${heroIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex flex-col"
            >
              {/* Giant rank bg number */}
              <div
                className="absolute bottom-0 right-0 font-black italic text-white select-none pointer-events-none leading-none"
                style={{ fontSize: "220px", opacity: 0.04, lineHeight: 1, color: "#39FF14" }}
              >
                {hero.featuredRank}
              </div>

              <div className="relative z-10 flex flex-col h-full p-10 justify-between">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600">
                  REPORTE DESTACADO
                </div>

                <div className="mt-auto">
                  <div
                    className="inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1.5 mb-6"
                    style={{ background: "rgba(57,255,20,0.1)", color: "#39FF14", border: "1px solid rgba(57,255,20,0.2)" }}
                  >
                    {hero.featuredTag}
                  </div>
                  <div className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-2">
                    {hero.rank} EN MÉXICO
                  </div>
                  <h2 className="text-4xl font-black uppercase text-white leading-tight tracking-tight mb-1 whitespace-pre-line">
                    {hero.featuredTitle}
                  </h2>
                  <p className="text-[#39FF14] font-black text-lg uppercase tracking-wider mb-6">
                    {hero.featuredArtist}
                  </p>
                  <p className="text-zinc-500 text-xs font-medium leading-relaxed mb-8 max-w-[200px]">
                    {hero.featuredDesc}
                  </p>
                  <button
                    className="text-xs font-black uppercase tracking-widest text-white border border-white/20 px-5 py-3 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors"
                    data-testid="btn-hero-report"
                  >
                    VER REPORTE →
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── STATS TICKER ROW ── */}
      <div
        className="border-y border-white/5 bg-[#080808] overflow-hidden py-3 relative"
        data-testid="stats-ticker"
        style={{ whiteSpace: "nowrap" }}
      >
        <div className="inline-block animate-marquee-slow" style={{ willChange: "transform" }}>
          <span className="text-zinc-500 font-black text-xs uppercase tracking-[0.25em]">
            {statsContent}   {statsContent}   {statsContent}
          </span>
        </div>
      </div>

      {/* ── BENTO GRID SECTION ── */}
      <section className="max-w-[1400px] mx-auto px-6 py-16" data-testid="section-bento">
        <div className="mb-10 flex items-end justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600">
            ESTADÍSTICAS EN TIEMPO REAL
          </h2>
          <div className="h-px flex-1 mx-6 bg-white/5" />
          <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">Mayo 2024</span>
        </div>

        <div
          className="flex flex-col gap-3 lg:grid"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "auto",
          }}
        >
          {/* ── CARD 1: TOP ARTISTAS (2col × 2row) ── */}
          <div
            className="relative overflow-hidden border border-white/5 bg-[#0a0a0a] group hover:border-[rgba(57,255,20,0.2)] transition-all duration-300"
            style={{
              gridColumn: "1 / 3",
              gridRow: "1 / 3",
              transform: "translateY(0)",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(57,255,20,0.12)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            data-testid="bento-top-artistas"
          >
            {/* Giant rank bg */}
            <div
              className="absolute -bottom-8 -right-4 font-black italic text-white select-none pointer-events-none leading-none"
              style={{ fontSize: "220px", opacity: 0.025, color: "#39FF14" }}
            >
              TOP
            </div>

            <div className="relative z-10 p-7 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-1">
                    PLATAFORMAS COMBINADAS
                  </div>
                  <h3 className="text-xl font-black uppercase text-white tracking-tight">
                    TOP ARTISTAS <span style={{ color: "#39FF14" }}>MÉXICO</span>
                  </h3>
                </div>
                <a href="#" className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#39FF14" }}>
                  VER TODOS →
                </a>
              </div>

              <div className="flex flex-col gap-3 flex-1">
                {TOP_ARTISTAS.map((artist, idx) => (
                  <div
                    key={artist.rank}
                    className="flex items-center gap-4 group/row relative"
                  >
                    {/* giant rank bg per row */}
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 font-black italic select-none pointer-events-none leading-none text-white"
                      style={{ fontSize: "72px", opacity: 0.04, lineHeight: 1 }}
                    >
                      {artist.rank}
                    </div>

                    <div className="relative z-10 flex items-center gap-4 w-full">
                      <div className="text-2xl font-black text-zinc-700 w-10 font-mono">{artist.rank}</div>
                      {artistImages[artist.name] ? (
                        <img
                          src={artistImages[artist.name]!}
                          alt={artist.name}
                          className="w-9 h-9 rounded-full flex-shrink-0 object-cover"
                          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                        />
                      ) : (
                        <div
                          className={`w-9 h-9 rounded-full bg-gradient-to-br ${COLORS[idx]} flex-shrink-0`}
                          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-black truncate group-hover/row:text-[#39FF14] transition-colors">
                          {artist.name}
                        </div>
                        <div className="text-[10px] text-zinc-600 uppercase tracking-wider">{artist.genre}</div>
                      </div>
                      <div
                        className="text-sm font-black font-mono px-2 py-1 flex-shrink-0"
                        style={{
                          color: "#39FF14",
                          background: "rgba(57,255,20,0.07)",
                          border: "1px solid rgba(57,255,20,0.15)",
                        }}
                      >
                        {artist.listeners}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CARD 2: ARTISTAS EN ASCENSO (1col × 2row) ── */}
          <div
            className="relative overflow-hidden border border-white/5 bg-[#0a0a0a] group"
            style={{
              gridColumn: "3 / 4",
              gridRow: "1 / 3",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(57,255,20,0.10)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            data-testid="bento-artistas-ascenso"
          >
            <div
              className="absolute bottom-0 right-0 font-black italic text-white select-none pointer-events-none leading-none"
              style={{ fontSize: "130px", opacity: 0.03, color: "#39FF14" }}
            >
              ↑
            </div>

            <div className="relative z-10 p-6 h-full flex flex-col">
              <div className="mb-5">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-1">
                  CRECIMIENTO MENSUAL
                </div>
                <h3 className="text-base font-black uppercase text-white tracking-tight">
                  EN <span style={{ color: "#39FF14" }}>ASCENSO</span>
                </h3>
              </div>

              <div className="flex flex-col gap-4 flex-1 justify-center">
                {ASCENSO.map((artist, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white font-bold text-sm truncate">{artist.name}</span>
                      <span className="text-[#39FF14] font-black text-xs ml-2 flex-shrink-0">{artist.growth}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${artist.bar}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, delay: idx * 0.1, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg, #39FF14, rgba(57,255,20,0.4))" }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-zinc-700 uppercase tracking-wider mt-4 font-bold">
                Crecimiento en Spotify · Spotify
              </p>
            </div>
          </div>

          {/* ── CARD 3: TOURING (2col × 1row) ── */}
          <div
            className="relative overflow-hidden border border-white/5 group"
            style={{
              gridColumn: "1 / 3",
              gridRow: "3",
              background: "linear-gradient(135deg, #0a0a0a 0%, #0d1a0a 100%)",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(57,255,20,0.10)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            data-testid="bento-touring"
          >
            <div
              className="absolute right-0 top-0 h-full w-1/2 pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent, rgba(57,255,20,0.03))" }}
            />

            <div className="relative z-10 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-1">
                    INGRESOS BRUTOS (USD)
                  </div>
                  <h3 className="text-base font-black uppercase text-white tracking-tight">
                    TOURING <span style={{ color: "#39FF14" }}>ACTUAL</span>
                  </h3>
                </div>
                <a href="#" className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#39FF14" }}>
                  VER RANKING →
                </a>
              </div>

              <div className="flex gap-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {TOURING.map((tour, idx) => (
                  <div
                    key={idx}
                    className="flex-shrink-0 border border-white/5 p-4"
                    style={{ minWidth: "160px", background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="text-4xl font-black text-white/5 font-mono leading-none mb-2">{tour.rank}</div>
                    <div className="text-white font-bold text-sm leading-snug mb-2 line-clamp-2">{tour.tour}</div>
                    <div className="font-black text-sm font-mono" style={{ color: "#39FF14" }}>{tour.gross}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CARD 4: MAPA GLOBAL (1col × 1row) — glassmorphism ── */}
          <div
            className="relative overflow-hidden border group cursor-pointer"
            style={{
              gridColumn: "3 / 4",
              gridRow: "3",
              borderColor: "rgba(57,255,20,0.12)",
              background: "rgba(10, 20, 10, 0.55)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "inset 0 1px 0 rgba(57,255,20,0.08), inset 0 -1px 0 rgba(0,0,0,0.3)",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(57,255,20,0.10)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            data-testid="bento-mapa-global"
          >
            {/* Dot grid */}
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(rgba(57,255,20,0.4) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
            />
            {/* Pulsing dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="w-3 h-3 rounded-full bg-[#39FF14] animate-dot-pulse" />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-[rgba(57,255,20,0.15)] animate-ping" style={{ animationDuration: "2.5s" }} />

            <div className="relative z-10 p-6 h-full flex flex-col justify-between">
              <Globe className="w-5 h-5 text-zinc-600" />
              <div>
                <h3 className="text-base font-black uppercase text-white tracking-tight mb-1">
                  MAPA <span style={{ color: "#39FF14" }}>GLOBAL</span>
                </h3>
                <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
                  60+ países escuchando música mexicana
                </p>
                <button className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#39FF14" }}>
                  VER MAPA →
                </button>
              </div>
            </div>
          </div>

          {/* ── CARD 5: NOTICIAS (2col × 1row) ── */}
          <div
            className="relative overflow-hidden border border-white/5 bg-[#0a0a0a] group"
            style={{
              gridColumn: "1 / 3",
              gridRow: "4",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(57,255,20,0.08)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            data-testid="bento-noticias"
          >
            <div className="relative z-10 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-black uppercase text-white tracking-tight">
                  ÚLTIMAS <span style={{ color: "#39FF14" }}>NOTICIAS</span>
                </h3>
                <a href="#" className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#39FF14" }}>
                  VER TODAS →
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {NOTICIAS.map((n, idx) => (
                  <div key={idx} className="border border-white/5 p-4 hover:border-[rgba(57,255,20,0.2)] transition-colors cursor-pointer group/news">
                    <div
                      className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 mb-3"
                      style={{ color: "#39FF14", background: "rgba(57,255,20,0.08)", border: "1px solid rgba(57,255,20,0.15)" }}
                    >
                      {n.tag}
                    </div>
                    <p className="text-white font-bold text-sm leading-snug mb-3 group-hover/news:text-[#39FF14] transition-colors line-clamp-3">
                      {n.title}
                    </p>
                    <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-wider">{n.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CARD 6: BOLETÍN (1col × 1row) — glassmorphism ── */}
          <div
            className="relative overflow-hidden border group"
            style={{
              gridColumn: "3 / 4",
              gridRow: "4",
              borderColor: "rgba(57,255,20,0.18)",
              background: "rgba(8, 20, 8, 0.60)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              boxShadow: "inset 0 1px 0 rgba(57,255,20,0.12), inset 0 -1px 0 rgba(0,0,0,0.4), 0 0 30px rgba(57,255,20,0.04)",
              transition: "transform 0.3s ease, box-shadow 0.3s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(57,255,20,0.15)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            data-testid="bento-boletin"
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(circle at 80% 20%, rgba(57,255,20,0.08) 0%, transparent 60%)" }}
            />
            <div className="relative z-10 p-6 h-full flex flex-col justify-between">
              <div>
                <Mail className="w-5 h-5 mb-4" style={{ color: "#39FF14" }} />
                <h3 className="text-base font-black uppercase text-white tracking-tight mb-1">BOLETÍN</h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-5">
                  Reportes exclusivos y estadísticas directo a tu correo.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  className="w-full bg-black/40 border border-white/10 text-white text-xs px-3 py-2.5 focus:outline-none focus:border-[rgba(57,255,20,0.4)] transition-colors placeholder-zinc-700"
                />
                <button
                  className="w-full text-black font-black text-xs uppercase tracking-widest py-2.5 hover:bg-white transition-colors animate-glow-pulse"
                  style={{ background: "#39FF14" }}
                  data-testid="btn-boletin-subscribe"
                >
                  SUSCRIBIRME
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── PLATFORM CHARTS STRIP (Embla) ── */}
      <section
        className="py-16 border-t border-white/5 bg-[#080808] overflow-hidden"
        data-testid="section-platform-charts"
      >
        <div className="max-w-[1400px] mx-auto px-6 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-1">
              CHARTS POR PLATAFORMA
            </div>
            <h2 className="text-xl font-black uppercase text-white tracking-tight">
              PLATAFORMAS <span style={{ color: "#39FF14" }}>DE STREAMING</span>
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={scrollPrev}
              className="w-9 h-9 border border-white/10 flex items-center justify-center text-zinc-500 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors text-lg"
              data-testid="btn-platform-prev"
            >
              ←
            </button>
            <button
              onClick={scrollNext}
              className="w-9 h-9 border border-white/10 flex items-center justify-center text-zinc-500 hover:border-[#39FF14] hover:text-[#39FF14] transition-colors text-lg"
              data-testid="btn-platform-next"
            >
              →
            </button>
          </div>
        </div>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-4 px-6 max-w-[1400px] mx-auto">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              return (
                <div
                  key={platform.id}
                  className="flex-shrink-0 w-[320px] border border-white/5 relative overflow-hidden"
                  style={{ background: `linear-gradient(180deg, ${platform.bgStart}, ${platform.bgEnd})` }}
                  data-testid={`platform-card-${platform.id}`}
                >
                  {/* Color accent overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(circle at 90% 10%, ${platform.accent} 0%, transparent 60%)` }}
                  />
                  <div className="relative z-10 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Icon className="w-5 h-5" style={{ color: platform.color }} />
                      <span className="text-white font-black text-sm uppercase tracking-wider">{platform.name}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {TOP_ARTISTAS.map((artist, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-sm font-black text-zinc-700 w-5 font-mono">{idx + 1}</span>
                          {artistImages[artist.name] ? (
                            <img
                              src={artistImages[artist.name]!}
                              alt={artist.name}
                              className="w-7 h-7 rounded-full flex-shrink-0 object-cover"
                              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                            />
                          ) : (
                            <div
                              className={`w-7 h-7 rounded-full bg-gradient-to-br ${COLORS[idx]} flex-shrink-0`}
                              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-white font-bold text-xs truncate">{artist.name}</div>
                            <div className="text-[10px] text-zinc-600">{artist.listeners} oyentes</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 pt-4 border-t border-white/5">
                      <a href="#" className="text-[10px] font-black uppercase tracking-widest" style={{ color: platform.color }}>
                        VER CHART COMPLETO →
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── REPORTES SECTION ── */}
      <section
        className="py-16 border-t border-white/5 bg-[#050505]"
        data-testid="section-reportes"
      >
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-1">
                INVESTIGACIÓN Y ANÁLISIS
              </div>
              <h2 className="text-xl font-black uppercase text-white tracking-tight">
                ÚLTIMOS <span style={{ color: "#39FF14" }}>REPORTES</span>
              </h2>
            </div>
            <a href="#" className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#39FF14" }}>
              VER TODOS →
            </a>
          </div>

          {/* Asymmetric layout: featured (2×) + 3 standard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {REPORTES.map((report, idx) => (
              <div
                key={idx}
                className="relative overflow-hidden border border-white/5 bg-[#0a0a0a] group cursor-pointer"
                style={{
                  gridColumn: idx === 0 ? "span 2" : "span 1",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(57,255,20,0.10)";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(57,255,20,0.2)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)";
                }}
                data-testid={`reporte-card-${idx}`}
              >
                {/* Number bg */}
                <div
                  className="absolute bottom-0 right-0 font-black italic text-white select-none pointer-events-none leading-none"
                  style={{
                    fontSize: idx === 0 ? "160px" : "100px",
                    opacity: 0.03,
                    color: "#39FF14",
                    lineHeight: 1,
                  }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </div>

                <div className="relative z-10 p-6" style={{ minHeight: idx === 0 ? "220px" : "180px" }}>
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div
                        className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 mb-4"
                        style={{
                          color: "#39FF14",
                          background: "rgba(57,255,20,0.08)",
                          border: "1px solid rgba(57,255,20,0.15)",
                        }}
                      >
                        {report.tag}
                      </div>
                      <h3
                        className="font-black uppercase text-white tracking-tight mb-3 group-hover:text-[#39FF14] transition-colors"
                        style={{ fontSize: idx === 0 ? "22px" : "16px", lineHeight: 1.1 }}
                      >
                        {report.title}
                      </h3>
                      <p className="text-zinc-600 text-xs leading-relaxed">{report.desc}</p>
                    </div>
                    <div className="mt-6">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#39FF14" }}>
                        VER REPORTE →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative border-t border-white/5 bg-[#030303] pt-20 pb-10 overflow-hidden" data-testid="footer">
        {/* Giant wordmark background */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
          aria-hidden="true"
        >
          <span
            className="font-black uppercase italic text-white leading-none whitespace-nowrap"
            style={{ fontSize: "clamp(80px, 16vw, 200px)", opacity: 0.022, letterSpacing: "-0.03em" }}
          >
            MEXICO CHARTS
          </span>
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-16">
            <div className="md:col-span-1">
              <img src={logoUrl} alt="Mexico Charts" className="h-10 object-contain mb-5 opacity-90" />
              <p className="text-zinc-600 text-xs leading-relaxed max-w-[200px] font-medium">
                La fuente líder de estadísticas de la música mexicana en el mundo.
              </p>
              <div className="flex gap-4 mt-5">
                <a href="#" className="text-zinc-700 hover:text-[#39FF14] transition-colors"><SiInstagram className="w-4 h-4" /></a>
                <a href="#" className="text-zinc-700 hover:text-[#39FF14] transition-colors"><SiX className="w-4 h-4" /></a>
                <a href="#" className="text-zinc-700 hover:text-[#39FF14] transition-colors"><SiTiktok className="w-4 h-4" /></a>
                <a href="#" className="text-zinc-700 hover:text-[#39FF14] transition-colors"><SiYoutube className="w-4 h-4" /></a>
              </div>
            </div>

            {[
              {
                title: "Explorar",
                links: ["Charts", "Artistas", "Touring", "Streaming", "Noticias"],
              },
              {
                title: "Géneros",
                links: ["Corridos Tumbados", "Regional Mexicano", "Banda", "Norteño", "Pop Urbano"],
              },
              {
                title: "Compañía",
                links: ["Acerca de", "Metodología", "Contacto", "Privacidad", "Cookies"],
              },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-4">{col.title}</h4>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-zinc-700 hover:text-white transition-colors text-xs font-medium">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="flex flex-col md:flex-row items-center justify-between pt-6 gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div className="flex gap-4 items-center">
              <Link href="/v1" className="text-[10px] text-zinc-700 hover:text-[#39FF14] transition-colors uppercase tracking-widest font-bold">
                V1
              </Link>
              <Link href="/" className="text-[10px] text-zinc-700 hover:text-[#39FF14] transition-colors uppercase tracking-widest font-bold">
                V2
              </Link>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#39FF14" }}>
                V3
              </span>
            </div>
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold">
              © 2024 Mexico Charts. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
