import { useState, useEffect, useMemo } from "react";
import { useArtistImages } from "@/hooks/useArtistImages";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, TrendingUp, MapPin, Music, Mail } from "lucide-react";
import { SiInstagram, SiX, SiTiktok, SiYoutube, SiSpotify, SiApple } from "react-icons/si";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

/* ─── DATA ──────────────────────────────────────────────────── */

const HERO_ARTISTS = [
  { rank:"#1", line1:"PESO",     line2:"PLUMA",  listeners:"32.4M OYENTES", growth:"+18%", countries:"60+ PAÍSES", tag:"CORRIDOS TUMBADOS", from:"#0f0035", mid:"#4c1d95", to:"#5b21b6" },
  { rank:"#2", line1:"FUERZA",   line2:"REGIDA", listeners:"12.4M OYENTES", growth:"+31%", countries:"45+ PAÍSES", tag:"CORRIDOS TUMBADOS", from:"#3d0000", mid:"#7f1d1d", to:"#991b1b" },
  { rank:"#3", line1:"NATANAEL", line2:"CANO",   listeners:"11.7M OYENTES", growth:"+22%", countries:"38+ PAÍSES", tag:"CORRIDOS TUMBADOS", from:"#001f1f", mid:"#0f766e", to:"#0d9488" },
  { rank:"#4", line1:"JUNIOR",   line2:"H",      listeners:"9.8M OYENTES",  growth:"+15%", countries:"32+ PAÍSES", tag:"REGIONAL MEXICANO", from:"#0a1a0a", mid:"#166534", to:"#16a34a" },
  { rank:"#5", line1:"CARIN",    line2:"LEÓN",   listeners:"7.1M OYENTES",  growth:"+28%", countries:"28+ PAÍSES", tag:"REGIONAL MEXICANO", from:"#1c0900", mid:"#92400e", to:"#b45309" },
];
const HERO_NAMES = ["Peso Pluma","Fuerza Regida","Natanael Cano","Junior H","Carin León"];

const TOP_STRIP = [
  { rank:1,  name:"Peso Pluma",       genre:"Corridos Tumb.", streams:"32.4M", from:"#071a07", to:"#194d19", accent:"#39FF14" },
  { rank:2,  name:"Fuerza Regida",    genre:"Corridos Tumb.", streams:"12.4M", from:"#1a0700", to:"#4d1500", accent:"#FF6B35" },
  { rank:3,  name:"Natanael Cano",    genre:"Corridos Tumb.", streams:"11.7M", from:"#001a1a", to:"#004040", accent:"#00E5CC" },
  { rank:4,  name:"Junior H",         genre:"Reg. Mexicano",  streams:"9.8M",  from:"#1a0a00", to:"#4d2200", accent:"#FFB703" },
  { rank:5,  name:"Carin León",       genre:"Reg. Mexicano",  streams:"7.1M",  from:"#00001a", to:"#000040", accent:"#4D9DFF" },
  { rank:6,  name:"Luis R Conriquez", genre:"Norteño",        streams:"7.6M",  from:"#1a001a", to:"#400040", accent:"#E040FB" },
  { rank:7,  name:"Grupo Frontera",   genre:"Norteño",        streams:"6.2M",  from:"#1a0000", to:"#400000", accent:"#FF4D4D" },
  { rank:8,  name:"Xavi",            genre:"Corridos Tumb.", streams:"5.4M",  from:"#0a0a1a", to:"#1a1a40", accent:"#A78BFA" },
  { rank:9,  name:"Eslabon Armado",   genre:"Reg. Mexicano",  streams:"5.1M",  from:"#001a0a", to:"#004020", accent:"#34D399" },
  { rank:10, name:"Chino Pacas",      genre:"Corridos Tumb.", streams:"4.8M",  from:"#1a1000", to:"#403000", accent:"#FBBF24" },
];

const GENRES = [
  { name:"Corridos Tumbados", streams:"48.3M", artists:48, from:"#071a07", to:"#194d19", accent:"#39FF14" },
  { name:"Regional Mexicano",  streams:"31.2M", artists:62, from:"#1a0a00", to:"#4d2200", accent:"#FFB703" },
  { name:"Norteño",            streams:"18.7M", artists:34, from:"#00001a", to:"#000040", accent:"#4D9DFF" },
  { name:"Banda",              streams:"14.2M", artists:29, from:"#1a0014", to:"#400036", accent:"#E040FB" },
  { name:"Hip-Hop Mexicano",   streams:"9.6M",  artists:21, from:"#1a0000", to:"#400000", accent:"#FF4D4D" },
  { name:"Pop Urbano",         streams:"6.8M",  artists:18, from:"#001a1a", to:"#004040", accent:"#00E5CC" },
];

const ASCENSO = [
  { name:"Tito Double P",    growth:"+78%", bar:78, accent:"#39FF14" },
  { name:"Oscar Maydon",     growth:"+65%", bar:65, accent:"#FFB703" },
  { name:"Marca Registrada", growth:"+56%", bar:56, accent:"#4D9DFF" },
  { name:"Clave Especial",   growth:"+49%", bar:49, accent:"#E040FB" },
  { name:"Jasiel Nuñez",     growth:"+47%", bar:47, accent:"#FF4D4D" },
];

const GIRAS = [
  { artist:"Peso Pluma",     tour:"Éxodo Tour",       dates:"Jun – Dic 2024", gross:"$60M+", from:"#071a07", to:"#194d19", accent:"#39FF14" },
  { artist:"Grupo Frontera", tour:"No Se Va Tour",    dates:"Jul – Nov 2024", gross:"$28M",  from:"#1a0000", to:"#400000", accent:"#FF4D4D" },
  { artist:"Carin León",     tour:"Latinoamérica 24", dates:"Ago – Oct 2024", gross:"$19M",  from:"#1a0a00", to:"#4d2200", accent:"#FFB703" },
  { artist:"Natanael Cano",  tour:"CT Tour 2024",     dates:"Sep – Dic 2024", gross:"$12M",  from:"#001a1a", to:"#004040", accent:"#00E5CC" },
];

const TICKER = "PESO PLUMA — ÉXODO TOUR — 32.4M OYENTES   ·   FUERZA REGIDA — MUSICOLOGO — 12.4M OYENTES   ·   NATANAEL CANO — CORRIDOS TUMBADOS — 11.7M OYENTES   ·   JUNIOR H — EL AZUL — 9.8M OYENTES   ·   CARIN LEÓN — BOCA CHUECA — 7.1M OYENTES";

/* ─── SHELF ──────────────────────────────────────────────────── */

function Shelf({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-6">
      <div className="flex items-center gap-3 px-6 lg:px-12 mb-5">
        <span style={{ color:"#39FF14" }}>{icon}</span>
        <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">{label}</h2>
        <div className="flex-1 h-px bg-white/5 ml-2" />
      </div>
      <div className="flex gap-4 overflow-x-auto px-6 lg:px-12 pb-3" style={{ scrollSnapType:"x mandatory", scrollbarWidth:"none" }}>
        {children}
      </div>
    </section>
  );
}

/* ─── PAGE ───────────────────────────────────────────────────── */

export default function HomeV6() {
  const [heroIndex, setHeroIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setHeroIndex(i => (i + 1) % HERO_ARTISTS.length), 4500);
    return () => clearInterval(t);
  }, []);

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
    <div className="min-h-[100dvh] bg-[#050505] text-zinc-300 overflow-x-hidden selection:bg-[#39FF14] selection:text-black" data-testid="page-v6">

      {/* VERSION BANNER */}
      <div className="border-b border-white/5 py-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center justify-center gap-3">
        {([["V1","/v1"],["V2","/"],["V3","/v3"],["V4","/v4"],["V5","/v5"]] as [string,string][]).map(([l,h]) => (
          <Link key={l} href={h} className="hover:text-[#39FF14] transition-colors">{l}</Link>
        ))}
        <span className="text-zinc-800">|</span>
        <span style={{ color:"#39FF14" }}>V6 — HYBRID</span>
      </div>

      {/* GREEN TICKER */}
      <div className="bg-[#39FF14] overflow-hidden py-2" style={{ whiteSpace:"nowrap" }}>
        <div className="inline-block animate-marquee" style={{ willChange:"transform" }}>
          <span className="text-black font-black text-[11px] uppercase tracking-[0.2em] px-8">
            {TICKER}   ·   {TICKER}
          </span>
        </div>
      </div>

      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b border-white/8 bg-[#050505]/95 backdrop-blur-lg" data-testid="navigation">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/v6" className="flex-shrink-0" data-testid="link-logo">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain" />
          </Link>

          {/* Pill tabs — desktop */}
          <div className="hidden lg:flex items-center gap-1">
            {["INICIO","ARTISTAS","CHARTS","GÉNEROS","TOURING"].map((item, i) => (
              <a key={item} href="#"
                className="px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition-all duration-200 rounded-full"
                style={{ background: i===0 ? "#39FF14" : "transparent", color: i===0 ? "#000" : "rgba(255,255,255,0.35)" }}
              >{item}</a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center border border-white/8 bg-white/3 rounded-full px-3 focus-within:border-[#39FF14]/50 transition-colors">
              <input type="text" placeholder="Buscar..." className="bg-transparent text-xs text-zinc-400 placeholder-zinc-700 py-1.5 w-32 focus:outline-none" data-testid="input-search" />
              <Search className="w-3.5 h-3.5 text-zinc-600" />
            </div>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors" data-testid="link-social-ig"><SiInstagram className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors" data-testid="link-social-x"><SiX className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors" data-testid="link-social-tk"><SiTiktok className="w-3.5 h-3.5" /></a>
            <a href="#" className="text-zinc-600 hover:text-white transition-colors" data-testid="link-social-yt"><SiYoutube className="w-3.5 h-3.5" /></a>
          </div>

          <button className="lg:hidden text-zinc-500" onClick={() => setMenuOpen(o => !o)} data-testid="btn-mobile-menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden border-t border-white/5 bg-[#050505] px-6 py-4 flex flex-col gap-4">
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
        )}
      </nav>

      {/* ══════════════════════════════════════════════════════════
          HERO — V5 colored gradient style
      ══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ height:"66vh", minHeight:"460px" }} data-testid="section-hero">

        {/* Animated gradient background */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`bg-${heroIndex}`}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.7 }}
            className="absolute inset-0"
            style={{ background:`linear-gradient(135deg, ${hero.from} 0%, ${hero.mid} 50%, ${hero.to} 100%)` }}
          />
        </AnimatePresence>

        {/* Artist portrait — right side, fades left */}
        <AnimatePresence mode="wait">
          {img(HERO_NAMES[heroIndex]) && (
            <motion.div
              key={`portrait-${heroIndex}`}
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.85 }}
              className="absolute right-0 top-0 bottom-0 w-1/2 md:w-2/5 pointer-events-none"
              style={{
                backgroundImage:`url(${img(HERO_NAMES[heroIndex])})`,
                backgroundSize:"cover", backgroundPosition:"center top",
                maskImage:"linear-gradient(to right, transparent 0%, black 40%)",
                WebkitMaskImage:"linear-gradient(to right, transparent 0%, black 40%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background:"rgba(0,0,0,0.28)" }} />

        {/* Large rank watermark */}
        <div className="absolute right-8 bottom-0 font-black leading-none select-none pointer-events-none" style={{ fontSize:"clamp(8rem, 22vw, 18rem)", color:"rgba(255,255,255,0.06)", lineHeight:0.85 }}>
          {hero.rank.replace("#","")}
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col justify-end px-6 md:px-10 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={heroIndex}
              initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-12 }}
              transition={{ duration:0.55, ease:"easeOut" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.3em] mb-3" style={{ color:"#39FF14" }}>
                {hero.rank} EN MÉXICO · {hero.tag}
              </div>
              <h1 className="font-black uppercase leading-none tracking-[-0.02em] mb-3 text-white" style={{ fontSize:"clamp(2.8rem, 9vw, 8rem)" }}>
                {hero.line1} {hero.line2}
              </h1>
              <p className="text-sm text-white/60 uppercase tracking-[0.15em] mb-6">
                {hero.listeners} · {hero.countries}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button className="px-6 py-2.5 text-xs font-black uppercase tracking-[0.1em] rounded-full text-black transition-opacity hover:opacity-90" style={{ background:"#39FF14" }} data-testid="btn-hero-cta">
                  Ver Charts
                </button>
                <button className="px-6 py-2.5 text-xs font-black uppercase tracking-[0.1em] rounded-full border border-white/30 text-white hover:bg-white/10 transition-colors">
                  Ver Perfil
                </button>
                <span className="ml-2 text-sm font-black" style={{ color:"#39FF14" }}>{hero.growth} esta semana</span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="absolute bottom-8 right-6 md:right-10 flex items-center gap-2">
            {HERO_ARTISTS.map((_, i) => (
              <button key={i} onClick={() => setHeroIndex(i)} className="transition-all duration-300 rounded-full"
                style={{ width:i===heroIndex?20:6, height:6, background:i===heroIndex?"#39FF14":"rgba(255,255,255,0.3)", border:"none", padding:0, cursor:"pointer" }}
                aria-label={`Artista ${i+1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* STATS TICKER */}
      <div className="border-y border-white/5 bg-[#080808] overflow-hidden py-3" style={{ whiteSpace:"nowrap" }}>
        <div className="inline-block animate-marquee-slow" style={{ willChange:"transform" }}>
          <span className="text-zinc-600 font-black text-[11px] uppercase tracking-[0.25em]">
            250+ ARTISTAS ANALIZADOS   ·   150+ REPORTES   ·   10M+ DATOS   ·   60+ PAÍSES   ·   250K+ COMUNIDAD   ·&nbsp;&nbsp;&nbsp;250+ ARTISTAS ANALIZADOS   ·   150+ REPORTES   ·   10M+ DATOS   ·
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TOP 10 ARTIST CARDS — V5 color card system
      ══════════════════════════════════════════════════════════ */}
      <Shelf label="Top 10 · México · Esta Semana" icon={<TrendingUp className="w-4 h-4" />}>
        {TOP_STRIP.map((a) => {
          const photo = img(a.name);
          return (
            <div key={a.rank} className="flex-shrink-0 relative overflow-hidden cursor-pointer group rounded-2xl"
              style={{ width:150, height:225, scrollSnapAlign:"start",
                background: photo ? `url(${photo}) center top / cover no-repeat` : `linear-gradient(160deg, ${a.from} 0%, ${a.to} 100%)` }}
              data-testid={`strip-card-${a.rank}`}
            >
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-300 rounded-2xl" />
              <div className="absolute top-2 left-3 font-black text-5xl leading-none select-none" style={{ color:"rgba(255,255,255,0.1)" }}>{String(a.rank).padStart(2,"0")}</div>
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background:a.accent }} />
              <div className="absolute bottom-0 left-0 right-0 rounded-b-2xl p-3" style={{ background:"linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)" }}>
                <div className="font-black text-sm uppercase leading-tight text-white mb-0.5">{a.name}</div>
                <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color:"rgba(255,255,255,0.4)" }}>{a.genre}</div>
                <div className="text-[11px] font-black" style={{ color:a.accent }}>{a.streams}</div>
              </div>
            </div>
          );
        })}
      </Shelf>

      {/* ══════════════════════════════════════════════════════════
          GENRE TERRITORIES — V5 color identity system
      ══════════════════════════════════════════════════════════ */}
      <section className="py-6 px-6 lg:px-12" data-testid="section-generos">
        <div className="flex items-center gap-3 mb-5">
          <span style={{ color:"#39FF14" }}><Music className="w-4 h-4" /></span>
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">Territorios de Género</h2>
          <div className="flex-1 h-px bg-white/5 ml-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {GENRES.map((g) => (
            <div key={g.name} className="relative overflow-hidden cursor-pointer group rounded-xl"
              style={{ height:108, background:`linear-gradient(135deg, ${g.from} 0%, ${g.to} 100%)`, border:`1px solid ${g.accent}22` }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ background:`radial-gradient(circle at 30% 50%, ${g.accent}18, transparent 70%)` }} />
              <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full" style={{ background:g.accent }} />
              <div className="relative h-full flex flex-col justify-between p-4 pl-5">
                <div>
                  <div className="font-black text-sm uppercase leading-tight text-white">{g.name}</div>
                  <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color:"rgba(255,255,255,0.3)" }}>{g.artists} artistas</div>
                </div>
                <div className="flex items-end justify-between">
                  <div className="text-lg font-black" style={{ color:g.accent }}>{g.streams}</div>
                  <div className="text-[9px] uppercase tracking-widest font-black opacity-0 group-hover:opacity-100 transition-opacity" style={{ color:g.accent }}>VER →</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          DATA BENTO — V3 depth + per-artist color accents
      ══════════════════════════════════════════════════════════ */}
      <section className="py-6 px-6 lg:px-12" data-testid="section-bento">
        <div className="flex items-center gap-3 mb-5">
          <span style={{ color:"#39FF14" }}><TrendingUp className="w-4 h-4" /></span>
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">Estadísticas · Mayo 2024</h2>
          <div className="flex-1 h-px bg-white/5 ml-2" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* TOP ARTISTAS */}
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#0a0a0a] p-6" data-testid="bento-top-artistas">
            <div className="absolute -bottom-6 -right-4 font-black italic text-[110px] leading-none select-none pointer-events-none" style={{ color:"rgba(57,255,20,0.022)" }}>TOP</div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-0.5">PLATAFORMAS COMBINADAS</div>
                  <h3 className="text-base font-black uppercase text-white">TOP ARTISTAS <span style={{ color:"#39FF14" }}>MÉXICO</span></h3>
                </div>
                <a href="#" className="text-[10px] font-black uppercase tracking-widest" style={{ color:"#39FF14" }}>VER TODOS →</a>
              </div>
              <div className="flex flex-col gap-3">
                {TOP_STRIP.slice(0,5).map((a) => {
                  const photo = img(a.name);
                  return (
                    <div key={a.rank} className="flex items-center gap-3 group/row">
                      <div className="text-xl font-black text-zinc-700 w-8 font-mono shrink-0">{String(a.rank).padStart(2,"0")}</div>
                      {photo
                        ? <img src={photo} alt={a.name} className="w-9 h-9 rounded-full object-cover shrink-0" style={{ border:`1px solid ${a.accent}35` }} />
                        : <div className="w-9 h-9 rounded-full shrink-0" style={{ background:`linear-gradient(135deg,${a.from},${a.to})`, border:`1px solid ${a.accent}35` }} />
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-black text-sm truncate group-hover/row:text-[#39FF14] transition-colors">{a.name}</div>
                        <div className="text-[10px] text-zinc-600 uppercase tracking-wider">{a.genre}</div>
                      </div>
                      <div className="text-xs font-black font-mono shrink-0 px-2 py-1 rounded-full" style={{ color:a.accent, background:`${a.accent}10`, border:`1px solid ${a.accent}22` }}>{a.streams}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* EN ASCENSO */}
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-[#0a0a0a] p-6" data-testid="bento-artistas-ascenso">
            <div className="absolute -bottom-4 -right-2 font-black italic text-[100px] leading-none select-none pointer-events-none" style={{ color:"rgba(57,255,20,0.022)" }}>↑</div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="mb-5">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-0.5">CRECIMIENTO MENSUAL</div>
                <h3 className="text-base font-black uppercase text-white">EN <span style={{ color:"#39FF14" }}>ASCENSO</span></h3>
              </div>
              <div className="flex flex-col gap-4 flex-1 justify-center">
                {ASCENSO.map((a, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white font-bold text-sm">{a.name}</span>
                      <span className="font-black text-xs" style={{ color:a.accent }}>{a.growth}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width:0 }} whileInView={{ width:`${a.bar}%` }} viewport={{ once:true }}
                        transition={{ duration:1.2, delay:idx*0.1, ease:"easeOut" }}
                        className="h-full rounded-full"
                        style={{ background:`linear-gradient(90deg, ${a.accent}, ${a.accent}55)` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-700 uppercase tracking-wider mt-4 font-bold">Crecimiento en Spotify · Semana 19</p>
            </div>
          </div>

        </div>
      </section>

      {/* PLATFORM STRIP */}
      <section className="px-6 lg:px-12 py-4" data-testid="platform-strip">
        <div className="rounded-xl border border-white/5 bg-[#080808] overflow-hidden">
          <div className="px-6 py-3 border-b border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600">STREAMS POR PLATAFORMA · SEMANA 19</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/5">
            {[
              { icon:<SiSpotify className="w-5 h-5"/>, color:"#1DB954", name:"Spotify",     streams:"32.4M", share:"48%" },
              { icon:<SiYoutube className="w-5 h-5"/>, color:"#FF0000", name:"YouTube",     streams:"18.2M", share:"28%" },
              { icon:<SiApple className="w-5 h-5"/>,   color:"#fa57c1", name:"Apple Music", streams:"9.1M",  share:"14%" },
              { icon:<Music className="w-5 h-5"/>,     color:"#A238FF", name:"Deezer",      streams:"6.5M",  share:"10%" },
            ].map(p => (
              <div key={p.name} className="flex items-center gap-3 px-5 py-4">
                <span style={{ color:p.color }}>{p.icon}</span>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-600 font-bold">{p.name}</div>
                  <div className="text-base font-black text-white">{p.streams}</div>
                  <div className="text-[10px] font-black" style={{ color:"#39FF14" }}>{p.share}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          GIRAS SHELF — V5 scrollable colored cards
      ══════════════════════════════════════════════════════════ */}
      <Shelf label="Próximas Giras · Artistas Mexicanos" icon={<MapPin className="w-4 h-4" />}>
        {GIRAS.map((g, i) => (
          <div key={i} className="flex-shrink-0 relative overflow-hidden cursor-pointer group rounded-xl"
            style={{ width:270, height:160, scrollSnapAlign:"start", background:`linear-gradient(140deg, ${g.from} 0%, ${g.to} 100%)`, border:`1px solid ${g.accent}20` }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" style={{ background:"rgba(0,0,0,0.15)" }} />
            <div className="absolute right-4 top-3 font-black text-6xl leading-none select-none pointer-events-none" style={{ color:"rgba(255,255,255,0.06)" }}>{g.artist[0]}</div>
            <div className="relative h-full flex flex-col justify-between p-5">
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color:"rgba(255,255,255,0.35)" }}>{g.dates}</div>
                <div className="font-black text-lg uppercase leading-tight text-white">{g.artist}</div>
                <div className="text-[11px] mt-0.5" style={{ color:"rgba(255,255,255,0.4)" }}>{g.tour}</div>
              </div>
              <div className="flex items-end justify-between">
                <div className="text-sm font-black" style={{ color:g.accent }}>{g.gross} estimado</div>
                <div className="text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity" style={{ color:g.accent }}>VER →</div>
              </div>
            </div>
          </div>
        ))}
      </Shelf>

      {/* NEWSLETTER */}
      <section className="px-6 lg:px-12 py-6">
        <div className="rounded-2xl p-8 flex flex-col md:flex-row items-center gap-6 justify-between"
          style={{ background:"linear-gradient(135deg, rgba(57,255,20,0.06) 0%, rgba(57,255,20,0.02) 100%)", border:"1px solid rgba(57,255,20,0.15)" }}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4" style={{ color:"#39FF14" }} />
              <span className="text-xs font-black uppercase tracking-[0.25em]" style={{ color:"#39FF14" }}>BOLETÍN SEMANAL</span>
            </div>
            <h3 className="text-xl font-black uppercase text-white mb-1">Reportes exclusivos directo a tu correo</h3>
            <p className="text-xs text-zinc-500">Charts, análisis y estadísticas de la música mexicana cada semana.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <input type="email" placeholder="correo@ejemplo.com"
              className="bg-black/40 border border-white/10 rounded-full text-white text-xs px-4 py-3 focus:outline-none focus:border-[rgba(57,255,20,0.4)] transition-colors placeholder-zinc-700 md:w-56"
              data-testid="input-newsletter"
            />
            <button className="text-black font-black text-xs uppercase tracking-widest px-6 py-3 rounded-full hover:bg-white transition-colors whitespace-nowrap" style={{ background:"#39FF14" }} data-testid="btn-newsletter">
              SUSCRIBIRME
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-[#030303] pt-16 pb-8 px-6 lg:px-12 relative overflow-hidden" data-testid="footer">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="font-black uppercase italic text-white leading-none whitespace-nowrap" style={{ fontSize:"clamp(60px,14vw,180px)", opacity:0.016, letterSpacing:"-0.03em" }}>MEXICO CHARTS</span>
        </div>
        <div className="relative z-10 max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div>
              <img src={logoUrl} alt="Mexico Charts" className="h-9 object-contain mb-4 opacity-90" />
              <p className="text-zinc-600 text-xs leading-relaxed max-w-[200px]">La fuente líder de estadísticas de la música mexicana en el mundo.</p>
              <div className="flex gap-4 mt-4">
                {([SiInstagram,SiX,SiTiktok,SiYoutube] as React.ElementType[]).map((Icon,i) => (
                  <a key={i} href="#" className="text-zinc-700 hover:text-[#39FF14] transition-colors"><Icon className="w-4 h-4" /></a>
                ))}
              </div>
            </div>
            {[
              { title:"Explorar",  links:["Charts","Artistas","Touring","Streaming","Noticias"] },
              { title:"Géneros",   links:["Corridos Tumbados","Regional Mexicano","Banda","Norteño","Pop Urbano"] },
              { title:"Compañía", links:["Acerca de","Metodología","Contacto","Privacidad"] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mb-4">{col.title}</h4>
                <ul className="flex flex-col gap-2.5">
                  {col.links.map(link => <li key={link}><a href="#" className="text-zinc-700 hover:text-white transition-colors text-xs">{link}</a></li>)}
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
