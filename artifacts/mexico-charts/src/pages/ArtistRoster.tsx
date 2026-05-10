import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ChevronDown, Users, Music2, Globe, SlidersHorizontal } from "lucide-react";
import { useArtistMetadata } from "@/services/dataProvider";
import { slugify } from "@/lib/utils";
import { SiSpotify, SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const ACCENT = "#39FF14";

/* ── Genre color map ─────────────────────────────────────────────── */
const GENRE_COLORS: Record<string, string> = {
  "Corridos Tumbados": "#39FF14",
  "Regional Mexicano": "#4ade80",
  "Norteño": "#86efac",
  "Banda": "#a3e635",
  "Hip-Hop Mexicano": "#facc15",
  "Pop Urbano": "#fb923c",
  "Grupero": "#f472b6",
  "Balada": "#818cf8",
  "Rock Mexicano": "#f87171",
};
function genreColor(g: string) {
  return GENRE_COLORS[g] ?? "#39FF14";
}

/* ── Card skeleton ───────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div
      className="rounded-xl overflow-hidden animate-pulse"
      style={{ background: "linear-gradient(160deg,#0d0d0d,#080808)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="h-36 bg-white/5" />
      <div className="p-4 flex flex-col gap-2">
        <div className="h-4 w-2/3 rounded bg-white/8" />
        <div className="h-3 w-1/2 rounded bg-white/5" />
        <div className="h-3 w-1/3 rounded bg-white/5 mt-1" />
      </div>
    </div>
  );
}

/* ── Artist card ─────────────────────────────────────────────────── */
interface CardProps {
  name: string;
  genre: string;
  country: string;
  label: string;
  spotifyListenersFmt: string;
  instagramFollowersFmt: string;
  tiktokFollowersFmt: string;
  youtubeSubscribersFmt: string;
  index: number;
}

function ArtistCard({ name, genre, country, label, spotifyListenersFmt, instagramFollowersFmt, tiktokFollowersFmt, youtubeSubscribersFmt, index }: CardProps) {
  const slug = slugify(name);
  const color = genreColor(genre);
  const initial = name.trim()[0]?.toUpperCase() ?? "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.015, 0.3), ease: "easeOut" }}
      layout
    >
      <Link href={`/artist/${slug}`}>
        <div
          className="group relative rounded-xl overflow-hidden cursor-pointer h-full flex flex-col"
          style={{
            background: "linear-gradient(160deg,#0d0d0d 0%,#080808 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
            transition: "border-color 0.25s, box-shadow 0.25s, transform 0.2s",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = `${color}44`;
            el.style.boxShadow = `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`;
            el.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = "rgba(255,255,255,0.07)";
            el.style.boxShadow = "0 4px 24px rgba(0,0,0,0.55)";
            el.style.transform = "translateY(0)";
          }}
        >
          {/* Noise texture */}
          <div className="absolute inset-0 opacity-[0.022] pointer-events-none rounded-xl" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />

          {/* Top accent band */}
          <div className="h-1 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, ${color}cc, ${color}33)` }} />

          {/* Avatar area */}
          <div
            className="relative flex items-center justify-center flex-shrink-0"
            style={{ height: 100, background: `radial-gradient(circle at 50% 100%, ${color}12 0%, transparent 70%)` }}
          >
            <div
              className="flex items-center justify-center rounded-full font-black text-3xl select-none"
              style={{
                width: 60,
                height: 60,
                background: `linear-gradient(135deg, ${color}22, ${color}08)`,
                border: `1.5px solid ${color}44`,
                color,
                textShadow: `0 0 20px ${color}88`,
              }}
            >
              {initial}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col p-4 pt-2 relative z-10">
            <h3
              className="font-black text-sm uppercase tracking-wide text-white mb-0.5 truncate group-hover:text-white transition-colors"
              title={name}
            >
              {name}
            </h3>

            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-[10px] font-black uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full"
                style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}
              >
                {genre || "—"}
              </span>
            </div>

            {country && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 mb-2">
                <Globe className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{country}</span>
              </div>
            )}

            {label && (
              <div className="text-[10px] text-zinc-600 truncate mb-2">{label}</div>
            )}

            {/* Stats row */}
            <div className="mt-auto grid grid-cols-2 gap-1 pt-2 border-t border-white/[0.05]">
              {spotifyListenersFmt && spotifyListenersFmt !== "—" && (
                <div className="flex items-center gap-1">
                  <SiSpotify className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "#1DB954" }} />
                  <span className="text-[10px] text-zinc-400 truncate">{spotifyListenersFmt}</span>
                </div>
              )}
              {instagramFollowersFmt && instagramFollowersFmt !== "—" && (
                <div className="flex items-center gap-1">
                  <SiInstagram className="w-2.5 h-2.5 flex-shrink-0 text-pink-500" />
                  <span className="text-[10px] text-zinc-400 truncate">{instagramFollowersFmt}</span>
                </div>
              )}
              {tiktokFollowersFmt && tiktokFollowersFmt !== "—" && (
                <div className="flex items-center gap-1">
                  <SiTiktok className="w-2.5 h-2.5 flex-shrink-0 text-zinc-300" />
                  <span className="text-[10px] text-zinc-400 truncate">{tiktokFollowersFmt}</span>
                </div>
              )}
              {youtubeSubscribersFmt && youtubeSubscribersFmt !== "—" && (
                <div className="flex items-center gap-1">
                  <SiYoutube className="w-2.5 h-2.5 flex-shrink-0 text-red-500" />
                  <span className="text-[10px] text-zinc-400 truncate">{youtubeSubscribersFmt}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Filter dropdown ─────────────────────────────────────────────── */
interface DropdownProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}
function FilterDropdown({ label, value, options, onChange }: DropdownProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white/[0.04] border border-white/[0.09] rounded-full pl-3 pr-7 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 focus:outline-none focus:border-[#39FF14]/40 cursor-pointer transition-colors hover:border-white/20"
        style={{ colorScheme: "dark" }}
        aria-label={label}
      >
        <option value="">{label}</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function ArtistRoster() {
  const { byKey, isLoading, isError, isEmpty } = useArtistMetadata();
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  /* Derive sorted array from map */
  const allArtists = useMemo(() => {
    return Array.from(byKey.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" })
    );
  }, [byKey]);

  /* Unique genre / country lists */
  const genres = useMemo(
    () => [...new Set(allArtists.map(a => a.genre).filter(Boolean))].sort(),
    [allArtists]
  );
  const countries = useMemo(
    () => [...new Set(allArtists.map(a => a.country).filter(Boolean))].sort(),
    [allArtists]
  );

  /* Filtered list */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allArtists.filter(a => {
      if (q && !a.displayName.toLowerCase().includes(q) && !a.normalizedName.includes(q)) return false;
      if (genreFilter && a.genre !== genreFilter) return false;
      if (countryFilter && a.country !== countryFilter) return false;
      return true;
    });
  }, [allArtists, search, genreFilter, countryFilter]);

  const hasActiveFilter = search || genreFilter || countryFilter;

  function clearFilters() {
    setSearch("");
    setGenreFilter("");
    setCountryFilter("");
  }

  /* ── Render ── */
  return (
    <div
      className="min-h-screen"
      style={{ background: "#050505", color: "#fff", fontFamily: "'Inter', sans-serif" }}
    >
      {/* ── NAV ── */}
      <nav
        className="sticky top-0 z-50 w-full"
        style={{ background: "rgba(5,5,5,0.92)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.055)" }}
      >
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex-shrink-0">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90 hover:opacity-100 transition-opacity" />
          </Link>
          <div className="flex items-center gap-1">
            {(["INICIO", "ARTISTAS", "CHARTS", "GÉNEROS", "TOURING"] as const).map((item) => {
              const href = item === "INICIO" ? "/" : item === "ARTISTAS" ? "/artists" : "#";
              const active = item === "ARTISTAS";
              return (
                <Link
                  key={item}
                  href={href}
                  className="px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] rounded-full transition-all duration-250"
                  style={{
                    background: active ? ACCENT : "transparent",
                    color: active ? "#000" : "rgba(255,255,255,0.35)",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
                >
                  {item}
                </Link>
              );
            })}
          </div>
          <div className="text-[11px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.12)" }}>
            MEXICO CHARTS
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(180deg,#0a0f0a 0%,#050505 100%)", borderBottom: "1px solid rgba(255,255,255,0.055)" }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 60% 80% at 50% -10%, ${ACCENT}18 0%, transparent 70%)` }}
        />
        <div className="max-w-[1400px] mx-auto px-6 py-16 relative z-10 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] mb-3" style={{ color: ACCENT }}>
            BASE DE DATOS COMPLETA
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            TODOS LOS{" "}
            <span style={{ color: ACCENT }}>
              ARTISTAS
            </span>
          </h1>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
            Explora el roster completo de artistas mexicanos — busca, filtra por género o país y accede al perfil de cada artista.
          </p>
          {!isLoading && !isEmpty && (
            <div className="flex items-center justify-center gap-6 text-center">
              <div>
                <div className="text-2xl font-black text-white">{allArtists.length}</div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Artistas</div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <div className="text-2xl font-black text-white">{genres.length}</div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Géneros</div>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <div className="text-2xl font-black text-white">{countries.length}</div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Países</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div
        className="sticky z-40"
        style={{ top: 56, background: "rgba(5,5,5,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div
            className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs rounded-full px-3 border focus-within:border-[#39FF14]/40 transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar artista..."
              className="bg-transparent text-xs text-zinc-300 placeholder-zinc-600 py-1.5 flex-1 focus:outline-none min-w-0"
              aria-label="Buscar artista"
              data-testid="roster-search"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-zinc-600 hover:text-zinc-300 transition-colors" aria-label="Limpiar búsqueda">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-600 hidden sm:block" />
            <FilterDropdown
              label="Género"
              value={genreFilter}
              options={genres}
              onChange={setGenreFilter}
            />
            <FilterDropdown
              label="País"
              value={countryFilter}
              options={countries}
              onChange={setCountryFilter}
            />
            <AnimatePresence>
              {hasActiveFilter && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.15 }}
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors"
                  style={{ background: "rgba(57,255,20,0.1)", color: ACCENT, border: "1px solid rgba(57,255,20,0.25)" }}
                  data-testid="roster-clear-filters"
                >
                  <X className="w-3 h-3" /> Limpiar
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="ml-auto text-[11px] text-zinc-600 hidden sm:block">
            {isLoading ? "Cargando…" : `${filtered.length} artista${filtered.length !== 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="max-w-[1400px] mx-auto px-6 py-8">

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 24 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              <X className="w-6 h-6 text-red-400" />
            </div>
            <div className="text-sm font-semibold text-zinc-400">Error al cargar los artistas</div>
            <div className="text-xs text-zinc-600">Revisa la conexión o inténtalo de nuevo más tarde.</div>
          </div>
        )}

        {/* Empty metadata source */}
        {isEmpty && !isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(57,255,20,0.07)", border: "1px solid rgba(57,255,20,0.15)" }}
            >
              <Users className="w-6 h-6" style={{ color: ACCENT }} />
            </div>
            <div className="text-sm font-semibold text-zinc-400">No hay fuente de datos configurada</div>
            <div className="text-xs text-zinc-600 max-w-sm text-center">Configura la hoja de metadatos de artistas para ver el roster completo.</div>
          </div>
        )}

        {/* No results after filter */}
        {!isLoading && !isError && !isEmpty && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(57,255,20,0.07)", border: "1px solid rgba(57,255,20,0.15)" }}
            >
              <Music2 className="w-6 h-6" style={{ color: ACCENT }} />
            </div>
            <div className="text-sm font-semibold text-zinc-400">Sin resultados</div>
            <div className="text-xs text-zinc-600 max-w-xs text-center">
              No encontramos artistas con esos filtros. Prueba buscando con otro nombre o cambia los filtros.
            </div>
            <button
              onClick={clearFilters}
              className="text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-colors"
              style={{ background: "rgba(57,255,20,0.1)", color: ACCENT, border: "1px solid rgba(57,255,20,0.2)" }}
            >
              Ver todos los artistas
            </button>
          </motion.div>
        )}

        {/* Artist grid */}
        {!isLoading && !isError && !isEmpty && filtered.length > 0 && (
          <motion.div
            layout
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((artist, i) => (
                <ArtistCard
                  key={artist.artistKey}
                  name={artist.displayName}
                  genre={artist.genre}
                  country={artist.country}
                  label={artist.label}
                  spotifyListenersFmt={artist.spotifyListenersFmt}
                  instagramFollowersFmt={artist.instagramFollowersFmt}
                  tiktokFollowersFmt={artist.tiktokFollowersFmt}
                  youtubeSubscribersFmt={artist.youtubeSubscribersFmt}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="max-w-[1400px] mx-auto px-6 py-8 mt-8 border-t border-white/[0.05] flex items-center justify-between gap-4 flex-wrap">
        <Link href="/">
          <img src={logoUrl} alt="Mexico Charts" className="h-6 object-contain opacity-40 hover:opacity-70 transition-opacity" />
        </Link>
        <div className="text-[10px] uppercase tracking-widest text-zinc-700">
          © 2024 Mexico Charts — Todos los derechos reservados
        </div>
      </footer>
    </div>
  );
}
