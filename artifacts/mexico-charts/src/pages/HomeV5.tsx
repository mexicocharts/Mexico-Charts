import { useState, useEffect, useMemo } from "react";
import { useArtistImages } from "@/hooks/useArtistImages";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { SiInstagram, SiX, SiTiktok, SiYoutube, SiSpotify, SiApple } from "react-icons/si";
import { Music, Search, TrendingUp, MapPin } from "lucide-react";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const FEATURED = [
  {
    rank: 1, artist: "Peso Pluma", genre: "Corridos Tumbados",
    streams: "8.14M", growth: "+12%", countries: "60+ países",
    from: "#0f0035", to: "#5b21b6", mid: "#4c1d95",
    tag: "#1 EN MÉXICO",
  },
  {
    rank: 2, artist: "Fuerza Regida", genre: "Corridos Tumbados",
    streams: "4.31M", growth: "+8%", countries: "42 países",
    from: "#3d0000", to: "#991b1b", mid: "#7f1d1d",
    tag: "#2 EN MÉXICO",
  },
  {
    rank: 3, artist: "Carin León", genre: "Regional Mexicano",
    streams: "3.18M", growth: "+28%", countries: "38 países",
    from: "#1c0900", to: "#b45309", mid: "#92400e",
    tag: "#5 · MAYOR CRECIMIENTO",
  },
];

const HOT_ARTISTS = [
  { rank: 1,  name: "Peso Pluma",        genre: "Corridos Tumb.",  streams: "8.14M", from: "#1a0533", to: "#7c3aed" },
  { rank: 2,  name: "Fuerza Regida",     genre: "Corridos Tumb.",  streams: "4.31M", from: "#3d0000", to: "#dc2626" },
  { rank: 3,  name: "Natanael Cano",     genre: "Corridos Tumb.",  streams: "3.97M", from: "#003333", to: "#0d9488" },
  { rank: 4,  name: "Junior H",          genre: "Reg. Mexicano",   streams: "3.62M", from: "#0a1f0a", to: "#16a34a" },
  { rank: 5,  name: "Carin León",        genre: "Reg. Mexicano",   streams: "3.18M", from: "#1f1000", to: "#d97706" },
  { rank: 6,  name: "Grupo Frontera",    genre: "Norteño",         streams: "2.94M", from: "#001433", to: "#2563eb" },
  { rank: 7,  name: "Luis R Conriquez",  genre: "Corridos Tumb.",  streams: "2.71M", from: "#2d0000", to: "#be123c" },
  { rank: 8,  name: "Xavi",             genre: "Reg. Mexicano",   streams: "2.43M", from: "#0f0a2e", to: "#4f46e5" },
  { rank: 9,  name: "Eslabon Armado",    genre: "Reg. Mexicano",   streams: "2.28M", from: "#002200", to: "#059669" },
  { rank: 10, name: "Gabito Ballesteros",genre: "Corridos Tumb.",  streams: "2.17M", from: "#0d0d1f", to: "#6366f1" },
];

const ASCENSO = [
  { name: "Tito Double P",    pct: "+78%", streams: "1.98M", from: "#1a0040", to: "#9333ea" },
  { name: "Oscar Maydon",     pct: "+65%", streams: "1.76M", from: "#001a00", to: "#15803d" },
  { name: "Marca Registrada", pct: "+56%", streams: "1.62M", from: "#1a0a00", to: "#ea580c" },
  { name: "Clave Especial",   pct: "+49%", streams: "1.41M", from: "#00001a", to: "#1d4ed8" },
  { name: "Jasiel Nuñez",     pct: "+47%", streams: "1.19M", from: "#1a1a00", to: "#ca8a04" },
  { name: "Yng Lvcas",        pct: "+38%", streams: "0.98M", from: "#1a0033", to: "#db2777" },
];

const GENRES = [
  { name: "Corridos Tumbados", streams: "12.4M", artists: 48, from: "#1a0533", to: "#7c3aed" },
  { name: "Regional Mexicano", streams: "9.1M",  artists: 62, from: "#001433", to: "#2563eb" },
  { name: "Norteño",           streams: "5.3M",  artists: 34, from: "#003333", to: "#0d9488" },
  { name: "Banda",             streams: "4.2M",  artists: 29, from: "#1c0900", to: "#b45309" },
  { name: "Hip-Hop Mexicano",  streams: "2.8M",  artists: 21, from: "#0a1f0a", to: "#16a34a" },
  { name: "Pop Urbano",        streams: "1.9M",  artists: 18, from: "#3d0000", to: "#dc2626" },
];

const GIRAS = [
  { artist: "Peso Pluma",     tour: "Éxodo Tour",         dates: "Jun – Dic 2024", cities: "CDMX · LA · NYC · Madrid", gross: "$60M+", from: "#1a0533", to: "#7c3aed" },
  { artist: "Grupo Frontera", tour: "No Se Va Tour",       dates: "Jul – Nov 2024", cities: "Houston · Dallas · Chicago", gross: "$28M",  from: "#001433", to: "#2563eb" },
  { artist: "Carin León",     tour: "Latinoamérica 2024", dates: "Ago – Oct 2024", cities: "Monterrey · Guadalajara · Lima", gross: "$19M",  from: "#1c0900", to: "#b45309" },
  { artist: "Natanael Cano",  tour: "CT Tour 2024",        dates: "Sep – Dic 2024", cities: "Phoenix · Denver · Las Vegas", gross: "$12M",  from: "#003333", to: "#0d9488" },
];

function Shelf({ children, label, icon }: { children: React.ReactNode; label: string; icon: React.ReactNode }) {
  return (
    <section className="py-8">
      <div className="flex items-center gap-2 px-6 md:px-10 mb-5">
        <span className="text-[#39FF14]">{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-white">{label}</h2>
      </div>
      <div
        className="flex gap-4 overflow-x-auto px-6 md:px-10 pb-3"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
    </section>
  );
}

export default function HomeV5() {
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [activeTab, setActiveTab] = useState("INICIO");

  useEffect(() => {
    const t = setInterval(() => setFeaturedIdx(i => (i + 1) % FEATURED.length), 6000);
    return () => clearInterval(t);
  }, []);

  const allArtistNames = useMemo(() => [
    ...HOT_ARTISTS.map(a => a.name),
    ...ASCENSO.map(a => a.name),
    ...FEATURED.map(a => a.artist),
  ], []);
  const artistImages = useArtistImages(allArtistNames);

  const feat = FEATURED[featuredIdx];

  return (
    <div
      className="min-h-[100dvh] text-white overflow-x-hidden"
      style={{ background: "#0d0d0d", fontFamily: "'Syne', sans-serif" }}
      data-testid="page-v5"
    >

      {/* ── VERSION BANNER ── */}
      <div className="border-b border-white/5 text-center py-1.5 text-[9px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 text-zinc-600" style={{ fontFamily: "'Inter', sans-serif" }}>
        <Link href="/v1" className="hover:text-white transition-colors">V1</Link>
        <span className="text-white/10">·</span>
        <Link href="/" className="hover:text-white transition-colors">V2</Link>
        <span className="text-white/10">·</span>
        <Link href="/v3" className="hover:text-white transition-colors">V3</Link>
        <span className="text-white/10">·</span>
        <Link href="/v4" className="hover:text-white transition-colors">V4</Link>
        <span className="text-white/10">·</span>
        <span style={{ color: "#39FF14" }}>V5 — STREAMING</span>
      </div>

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-md" style={{ background: "rgba(13,13,13,0.92)" }} data-testid="navigation">
        <div className="px-6 md:px-10 h-14 flex items-center gap-6">
          <Link href="/v5" data-testid="link-logo" className="flex-shrink-0">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90" />
          </Link>

          {/* Tabs */}
          <div className="flex items-center gap-1 flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {["INICIO","CHARTS","GÉNEROS","TOURING"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-shrink-0 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] rounded-full transition-all duration-200"
                style={{
                  background: activeTab === tab ? "#39FF14" : "transparent",
                  color: activeTab === tab ? "#000" : "rgba(255,255,255,0.4)",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Search className="w-4 h-4 text-zinc-600 hover:text-white cursor-pointer transition-colors" />
            <a href="#" data-testid="link-social-ig" className="text-zinc-700 hover:text-white transition-colors hidden md:block"><SiInstagram className="w-4 h-4" /></a>
            <a href="#" data-testid="link-social-x"  className="text-zinc-700 hover:text-white transition-colors hidden md:block"><SiX className="w-4 h-4" /></a>
            <a href="#" data-testid="link-social-yt" className="text-zinc-700 hover:text-white transition-colors hidden md:block"><SiYoutube className="w-4 h-4" /></a>
            <a href="#" data-testid="link-social-tk" className="text-zinc-700 hover:text-white transition-colors hidden md:block"><SiTiktok className="w-4 h-4" /></a>
          </div>
        </div>
      </nav>

      {/* ── FEATURED HERO ── */}
      <section className="relative overflow-hidden" style={{ height: "62vh", minHeight: "420px" }} data-testid="section-hero">
        <AnimatePresence mode="wait">
          <motion.div
            key={featuredIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${feat.from} 0%, ${feat.mid} 50%, ${feat.to} 100%)`,
            }}
          />
        </AnimatePresence>

        {/* Artist portrait – right side, fade left */}
        <AnimatePresence mode="wait">
          {artistImages[feat.artist] && (
            <motion.div
              key={`portrait-${featuredIdx}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute right-0 top-0 bottom-0 w-1/2 md:w-2/5 pointer-events-none"
              style={{
                backgroundImage: `url(${artistImages[feat.artist]})`,
                backgroundSize: "cover",
                backgroundPosition: "center top",
                maskImage: "linear-gradient(to right, transparent 0%, black 40%)",
                WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 40%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Noise/texture overlay */}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "none" }} />

        {/* Large rank watermark */}
        <div
          className="absolute right-8 bottom-0 font-black leading-none select-none pointer-events-none"
          style={{ fontSize: "clamp(8rem, 22vw, 18rem)", color: "rgba(255,255,255,0.06)", lineHeight: 0.85 }}
        >
          {String(feat.rank).padStart(2, "0")}
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col justify-end px-6 md:px-10 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={featuredIdx}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3" style={{ color: "#39FF14" }}>
                {feat.tag}
              </div>
              <h1 className="font-black uppercase leading-none tracking-[-0.02em] mb-3" style={{ fontSize: "clamp(2.8rem, 8vw, 7rem)" }}>
                {feat.artist}
              </h1>
              <p className="text-sm text-white/60 uppercase tracking-[0.15em] mb-6" style={{ fontFamily: "'Inter', sans-serif" }}>
                {feat.genre} · {feat.streams} streams · {feat.countries}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <button className="px-5 py-2 text-xs font-bold uppercase tracking-[0.1em] rounded-full text-black transition-opacity hover:opacity-90" style={{ background: "#39FF14" }}>
                  Ver Charts
                </button>
                <button className="px-5 py-2 text-xs font-bold uppercase tracking-[0.1em] rounded-full border border-white/30 text-white hover:bg-white/10 transition-colors">
                  Ver Perfil
                </button>
                <span className="ml-2 text-sm font-bold" style={{ color: "#39FF14" }}>
                  {feat.growth} esta semana
                </span>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="absolute bottom-8 right-6 md:right-10 flex items-center gap-2">
            {FEATURED.map((_, i) => (
              <button
                key={i}
                onClick={() => setFeaturedIdx(i)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: i === featuredIdx ? 20 : 6,
                  height: 6,
                  background: i === featuredIdx ? "#39FF14" : "rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── SHELF 1: HOT ARTISTS ── */}
      <Shelf label="Más Escuchado Esta Semana" icon={<TrendingUp className="w-4 h-4" />}>
        {HOT_ARTISTS.map((a) => (
          <div
            key={a.rank}
            className="flex-shrink-0 relative rounded-xl overflow-hidden cursor-pointer group"
            style={{
              width: 160, height: 240,
              background: artistImages[a.name]
                ? `url(${artistImages[a.name]}) center/cover no-repeat`
                : `linear-gradient(160deg, ${a.from} 0%, ${a.to} 100%)`,
              scrollSnapAlign: "start",
            }}
            data-testid={`hot-card-${a.rank}`}
          >
            {/* Rank watermark */}
            <div className="absolute top-2 left-3 font-black text-4xl leading-none" style={{ color: "rgba(255,255,255,0.12)" }}>
              {String(a.rank).padStart(2, "0")}
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />

            {/* Info at bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-3" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}>
              <div className="font-black text-sm uppercase leading-tight mb-0.5">{a.name}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>{a.genre}</div>
              <div className="text-[11px] font-bold mt-1" style={{ color: "#39FF14", fontFamily: "'Inter', sans-serif" }}>{a.streams}</div>
            </div>
          </div>
        ))}
      </Shelf>

      {/* ── SHELF 2: EN ASCENSO ── */}
      <Shelf label="En Ascenso Esta Semana" icon={<TrendingUp className="w-4 h-4" />}>
        {ASCENSO.map((a, i) => (
          <div
            key={i}
            className="flex-shrink-0 relative rounded-xl overflow-hidden cursor-pointer group"
            style={{
              width: 200, height: 120,
              background: artistImages[a.name]
                ? `url(${artistImages[a.name]}) center/cover no-repeat`
                : `linear-gradient(120deg, ${a.from} 0%, ${a.to} 100%)`,
              scrollSnapAlign: "start",
            }}
          >
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
            <div className="relative h-full flex flex-col justify-between p-4">
              <span className="text-xl font-black" style={{ color: "#39FF14" }}>{a.pct}</span>
              <div>
                <div className="font-black text-sm uppercase">{a.name}</div>
                <div className="text-[10px] text-white/50 mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>{a.streams} streams</div>
              </div>
            </div>
          </div>
        ))}
      </Shelf>

      {/* ── SHELF 3: GÉNEROS ── */}
      <Shelf label="Explorar Por Género" icon={<Music className="w-4 h-4" />}>
        {GENRES.map((g, i) => (
          <div
            key={i}
            className="flex-shrink-0 relative rounded-xl overflow-hidden cursor-pointer group"
            style={{
              width: 220, height: 110,
              background: `linear-gradient(135deg, ${g.from} 0%, ${g.to} 100%)`,
              scrollSnapAlign: "start",
            }}
          >
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
            <div className="relative h-full flex flex-col justify-between p-4">
              <div className="font-black text-base uppercase leading-tight">{g.name}</div>
              <div className="flex items-end justify-between">
                <span className="text-[10px] text-white/50" style={{ fontFamily: "'Inter', sans-serif" }}>{g.artists} artistas</span>
                <span className="text-[11px] font-bold" style={{ color: "#39FF14", fontFamily: "'Inter', sans-serif" }}>{g.streams}</span>
              </div>
            </div>
          </div>
        ))}
      </Shelf>

      {/* ── SHELF 4: GIRAS ── */}
      <Shelf label="Próximas Giras" icon={<MapPin className="w-4 h-4" />}>
        {GIRAS.map((g, i) => (
          <div
            key={i}
            className="flex-shrink-0 relative rounded-xl overflow-hidden cursor-pointer group"
            style={{
              width: 300, height: 160,
              background: `linear-gradient(140deg, ${g.from} 0%, ${g.to} 100%)`,
              scrollSnapAlign: "start",
            }}
          >
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />

            {/* Large artist initial watermark */}
            <div className="absolute right-4 top-2 font-black text-6xl leading-none select-none pointer-events-none" style={{ color: "rgba(255,255,255,0.08)" }}>
              {g.artist[0]}
            </div>

            <div className="relative h-full flex flex-col justify-between p-5">
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>{g.dates}</div>
                <div className="font-black text-lg uppercase leading-tight">{g.artist}</div>
                <div className="text-[11px] text-white/50 mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>{g.tour}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/40 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>
                  <MapPin className="w-3 h-3 inline mr-1 opacity-60" />{g.cities}
                </div>
                <span className="text-sm font-bold" style={{ color: "#39FF14", fontFamily: "'Inter', sans-serif" }}>{g.gross} estimado</span>
              </div>
            </div>
          </div>
        ))}
      </Shelf>

      {/* ── PLATFORM STATS STRIP ── */}
      <section className="mx-6 md:mx-10 my-4 rounded-xl border border-white/5 overflow-hidden" data-testid="platform-strip">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-white/60">Streams Por Plataforma · Semana 19</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
          {[
            { icon: <SiSpotify className="w-5 h-5" style={{ color: "#1DB954" }} />, name: "Spotify",     streams: "32.4M", share: "48%" },
            { icon: <SiYoutube className="w-5 h-5 text-red-500" />,                 name: "YouTube",     streams: "18.2M", share: "28%" },
            { icon: <SiApple className="w-5 h-5 text-pink-400" />,                  name: "Apple Music", streams: "9.1M",  share: "14%" },
            { icon: <Music className="w-5 h-5 text-purple-400" />,                  name: "Deezer",      streams: "6.5M",  share: "10%" },
          ].map(p => (
            <div key={p.name} className="flex items-center gap-3 px-6 py-4">
              {p.icon}
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wide" style={{ fontFamily: "'Inter', sans-serif" }}>{p.name}</div>
                <div className="text-base font-black">{p.streams}</div>
                <div className="text-[10px]" style={{ color: "#39FF14", fontFamily: "'Inter', sans-serif" }}>{p.share}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-6 md:px-10 py-6 mt-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ fontFamily: "'Inter', sans-serif" }} data-testid="footer">
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-700">© 2024 Mexico Charts</span>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          <Link href="/v1" className="hover:text-white transition-colors">V1</Link>
          <span className="text-white/10">·</span>
          <Link href="/" className="hover:text-white transition-colors">V2</Link>
          <span className="text-white/10">·</span>
          <Link href="/v3" className="hover:text-white transition-colors">V3</Link>
          <span className="text-white/10">·</span>
          <Link href="/v4" className="hover:text-white transition-colors">V4</Link>
          <span className="text-white/10">·</span>
          <span style={{ color: "#39FF14" }}>V5</span>
        </div>
        <span className="text-[10px] text-zinc-800 uppercase tracking-[0.2em]">v5.0.0-streaming</span>
      </footer>

    </div>
  );
}
