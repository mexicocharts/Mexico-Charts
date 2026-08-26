import { useState, useMemo, useCallback, useEffect } from "react";
import PageSEO from "@/components/PageSEO";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ChevronDown, Users, Music2, Globe, SlidersHorizontal, BadgeCheck } from "lucide-react";
import { useArtistMetadata } from "@/services/dataProvider";
import { isValidArtistImageUrl, normalizeArtistImageKey, proxyArtistImageUrl, useArtistImagesWithStatus } from "@/hooks/useArtistImages";
import { useItunesArtistWithStatus } from "@/hooks/useItunesArtist";
import { useVerifiedArtistKeys } from "@/hooks/useArtistEnrichment";
import { useBatchKworbStreams } from "@/hooks/useKworbStats";
import { auditArtistDirectoryRecords, directoryImageState } from "@/lib/artistDirectory.mjs";
import { countryLabel, genreLabel, labelAssociationValue } from "@/lib/presentationLabels";
import { SiSpotify, SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import SiteNav from "@/components/SiteNav";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const ACCENT = "#39FF14";
const ROSTER_PAGE_SIZE = 48;

type SortMode = "az" | "listeners" | "streams" | "youtube" | "instagram";

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "az", label: "A-Z" },
  { value: "listeners", label: "Oyentes Spotify" },
  { value: "streams", label: "Streams totales" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
];

/* ── Genre color map ─────────────────────────────────────────────── */
const GENRE_COLORS: Record<string, string> = {
  "Corridos Tumbados": "#39FF14",
  "Regional Mexicano": "#4ade80",
  "Norteño": "#86efac",
  "Banda": "#a3e635",
  "Hip-Hop Mexicano": "#facc15",
  "Pop": "#fb923c",
  "Grupero": "#f472b6",
  "Balada": "#818cf8",
  "Rock Mexicano": "#f87171",
};
function genreColor(g: string) {
  return GENRE_COLORS[g] ?? "#39FF14";
}

function lookupArtistImage(images: Record<string, string | null>, names: string[]): string | null {
  for (const name of names) {
    const image = images[normalizeArtistImageKey(name)] ?? images[name];
    if (isValidArtistImageUrl(image)) return image;
  }
  return null;
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
  photoUrl?: string | null;
  canonicalName: string;
  profileHref: string;
  imageLookupReady: boolean;
  totalStreamsFmt?: string | null;
  isVerified?: boolean;
  index: number;
}

function ArtistCard({ name, genre, country, label, spotifyListenersFmt, instagramFollowersFmt, tiktokFollowersFmt, youtubeSubscribersFmt, photoUrl, canonicalName, profileHref, imageLookupReady, totalStreamsFmt, isVerified = false, index }: CardProps) {
  const color = genreColor(genre);
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const [needsItunesFallback, setNeedsItunesFallback] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const itunes = useItunesArtistWithStatus(
    canonicalName,
    imageLookupReady && (!isValidArtistImageUrl(photoUrl) || needsItunesFallback),
  );
  const itunesData = itunes.data;

  const imageCandidates = useMemo(
    () => [photoUrl, itunesData?.artworkUrlHd].filter(isValidArtistImageUrl),
    [photoUrl, itunesData?.artworkUrlHd],
  );
  const imageState = directoryImageState({
    primaryUrl: imageCandidates[0],
    fallbackUrl: imageCandidates[1],
    imageLookupReady,
    fallbackLookupLoading: itunes.isLoading,
    failedUrls,
  });
  const photo = imageState.candidates[0] ?? null;
  const imageSrc = photo ? proxyArtistImageUrl(photo) : null;

  useEffect(() => {
    setFailedUrls(new Set());
    setNeedsItunesFallback(false);
  }, [canonicalName]);

  useEffect(() => {
    setImageLoaded(false);
  }, [photo]);

  const handleImgError = useCallback(() => {
    if (!photo) return;
    setFailedUrls(previous => {
      const next = new Set(previous);
      next.add(photo);
      return next;
    });
    setNeedsItunesFallback(true);
  }, [photo]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.015, 0.3), ease: [0.16, 1, 0.3, 1] }}
      layout
    >
      <Link href={profileHref}>
        <div
          className="group relative rounded-xl overflow-hidden cursor-pointer h-full flex flex-col"
          style={{
            background: "linear-gradient(160deg,#0e0e0e 0%,#080808 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 4px 28px rgba(0,0,0,0.6)",
            transition: "border-color 0.3s, box-shadow 0.3s, transform 0.25s",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = `${color}38`;
            el.style.boxShadow = `0 14px 52px rgba(0,0,0,0.8), 0 0 0 1px ${color}18`;
            el.style.transform = "translateY(-3px)";
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = "rgba(255,255,255,0.07)";
            el.style.boxShadow = "0 4px 28px rgba(0,0,0,0.6)";
            el.style.transform = "translateY(0)";
          }}
        >
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.028] pointer-events-none rounded-xl z-10" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />

          {/* Cinematic photo / avatar hero area */}
          <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 148 }}>
            {imageState.state === "image" && photo ? (
              <>
                {/* Keep lazy images visually occupied until their first paint. */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse at 50% 35%, ${color}15 0%, transparent 60%), linear-gradient(160deg, #141414 0%, #080808 100%)`,
                  }}
                />
                {/* Full-bleed photo */}
                <img
                  src={imageSrc!}
                  alt={`${name} — foto de perfil`}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 transition-[opacity,transform] duration-700 group-hover:scale-105"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    opacity: imageLoaded ? 1 : 0,
                    filter: "brightness(0.78) saturate(0.60) contrast(1.08)",
                  }}
                  onLoad={() => setImageLoaded(true)}
                  onError={handleImgError}
                />
                {/* Cinematic edge vignette */}
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 80% at 50% 30%, transparent 35%, rgba(0,0,0,0.40) 75%, rgba(0,0,0,0.72) 100%)" }} />
                {/* Bottom fade into card body */}
                <div className="absolute bottom-0 left-0 right-0" style={{ height: "60%", background: "linear-gradient(to top, rgba(10,10,10,1) 0%, rgba(10,10,10,0.65) 45%, transparent 100%)" }} />
                {/* Subtle top accent glow */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${color}50, transparent)` }} />
              </>
            ) : imageState.state === "loading" ? (
              <div
                className="absolute inset-0 animate-pulse"
                style={{
                  background: `radial-gradient(ellipse at 50% 35%, ${color}15 0%, transparent 60%), linear-gradient(160deg, #141414 0%, #080808 100%)`,
                }}
                aria-label={`Cargando foto de ${name}`}
              >
                <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-white/[0.07]" />
              </div>
            ) : (
              <>
                {/* Atmospheric dark background */}
                <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 65%, ${color}12 0%, transparent 60%), linear-gradient(160deg, #121212 0%, #080808 100%)` }} />
                {/* Large initial letter */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="font-black text-5xl select-none transition-transform duration-500 group-hover:scale-110"
                    style={{ color, textShadow: `0 0 40px ${color}55, 0 0 100px ${color}18`, opacity: 0.88 }}
                  >
                    {initial}
                  </span>
                </div>
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${color}50, transparent)` }} />
                {/* Bottom fade */}
                <div className="absolute bottom-0 left-0 right-0" style={{ height: "45%", background: "linear-gradient(to top, rgba(10,10,10,0.98) 0%, transparent 100%)" }} />
              </>
            )}
            {/* Genre accent dot — top right */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
              {isVerified && (
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full"
                  style={{
                    background: "rgba(5,5,5,0.72)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    boxShadow: `0 0 18px ${color}44, inset 0 1px 0 rgba(255,255,255,0.12)`,
                    backdropFilter: "blur(12px)",
                    color,
                  }}
                  aria-label="Artista verificado"
                  title="Artista verificado por Mexico Charts"
                >
                  <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.8} />
                </span>
              )}
              <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 7px ${color}90` }} />
            </div>
          </div>

          {/* Info panel */}
          <div className="flex-1 flex flex-col px-4 pb-4 pt-3 relative z-10">
            <div className="mb-1.5 flex items-start gap-1.5">
              <h3
                className="font-black text-[13px] uppercase tracking-[0.06em] text-white line-clamp-2 break-words leading-snug"
                title={name}
              >
                {name}
              </h3>
              {isVerified && (
                <BadgeCheck
                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                  strokeWidth={2.8}
                  style={{ color }}
                  aria-label="Artista verificado"
                />
              )}
            </div>

            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="text-[10px] font-black uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full"
                style={{ background: `${color}14`, color, border: `1px solid ${color}28` }}
              >
                {genre ? genreLabel(genre) : "—"}
              </span>
            </div>

            {country && (
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 mb-1">
                <Globe className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{countryLabel(country)}</span>
              </div>
            )}

            {label && (
              <div className="text-[10px] text-zinc-600 truncate mb-1.5" title="Sellos y distribuidores asociados">
                Sellos/distribuidores: {labelAssociationValue(label)}
              </div>
            )}

            {/* Stats row */}
            <div className="mt-auto grid grid-cols-2 gap-1 pt-2 border-t border-white/[0.06]">
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
              {totalStreamsFmt && (
                <div className="flex items-center gap-1 col-span-2 pt-1 mt-0.5 border-t border-white/[0.04]">
                  <SiSpotify className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "#1DB954" }} />
                  <span className="text-[10px] font-black truncate" style={{ color }}>{totalStreamsFmt}</span>
                  <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-wider">streams Spotify</span>
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
  formatOption?: (v: string) => string;
}
function FilterDropdown({ label, value, options, onChange, formatOption = v => v }: DropdownProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white/[0.04] border border-white/[0.09] rounded-full pl-3 pr-7 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 focus:outline-none focus:border-[#39FF14]/40 cursor-pointer transition-colors hover:border-white/20"
        style={{ colorScheme: "dark" }}
        aria-label={`Filtrar por ${label.toLowerCase()}`}
      >
        <option value="">{label}</option>
        {options.map(o => (
          <option key={o} value={o}>{formatOption(o)}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function ArtistRoster() {
  const { byKey, isLoading, isError, isEmpty } = useArtistMetadata();
  const verifiedArtistKeys = useVerifiedArtistKeys();
  const routeSearch = useSearch();
  const initialQuery = useMemo(() => new URLSearchParams(routeSearch).get("q") ?? "", [routeSearch]);
  const [search, setSearch] = useState(initialQuery);
  const [genreFilter, setGenreFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("az");
  const [visibleCount, setVisibleCount] = useState(ROSTER_PAGE_SIZE);

  useEffect(() => {
    setSearch(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setVisibleCount(ROSTER_PAGE_SIZE);
  }, [search, genreFilter, countryFilter, verifiedOnly, sortMode]);

  /* Resolve every metadata row to one unique, profile-backed public record. */
  const directoryAudit = useMemo(
    () => auditArtistDirectoryRecords(Array.from(byKey.values())),
    [byKey],
  );

  const allArtists = useMemo(() => {
    return [...directoryAudit.artists].sort((a, b) =>
      a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" })
    );
  }, [directoryAudit]);

  /* Collect only public artist names for image + kworb batch fetches. */
  const allNames = useMemo(
    () => allArtists.flatMap(artist => [artist.displayName, artist.canonicalName]),
    [allArtists],
  );
  const { images: artistImages, isFetched: artistImagesFetched } = useArtistImagesWithStatus(allNames);
  const { data: kworbStreams } = useBatchKworbStreams(allNames);

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
    const next = allArtists.filter(a => {
      if (q && !a.displayName.toLowerCase().includes(q) && !a.normalizedName.includes(q)) return false;
      if (genreFilter && a.genre !== genreFilter) return false;
      if (countryFilter && a.country !== countryFilter) return false;
      if (verifiedOnly && !verifiedArtistKeys.has(a.artistKey)) return false;
      return true;
    });

    return next.sort((a, b) => {
      if (sortMode === "listeners") return b.spotifyListeners - a.spotifyListeners;
      if (sortMode === "streams") return (kworbStreams?.[b.displayName] ?? 0) - (kworbStreams?.[a.displayName] ?? 0);
      if (sortMode === "youtube") return b.youtubeSubscribers - a.youtubeSubscribers;
      if (sortMode === "instagram") return b.instagramFollowers - a.instagramFollowers;
      return a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" });
    });
  }, [allArtists, search, genreFilter, countryFilter, verifiedOnly, verifiedArtistKeys, sortMode, kworbStreams]);

  const hasActiveFilter = search || genreFilter || countryFilter || verifiedOnly;
  const visibleArtists = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  function clearFilters() {
    setSearch("");
    setGenreFilter("");
    setCountryFilter("");
    setVerifiedOnly(false);
    setSortMode("az");
  }

  /* ── Render ── */
  return (
    <div
      className="min-h-screen"
      style={{ background: "#050505", color: "#fff", fontFamily: "'Inter', sans-serif" }}
    >
      <PageSEO
        title="Artistas de Música Mexicana — Base de Datos Completa"
        description="Base de datos completa de artistas de música mexicana con estadísticas de streaming, redes sociales, oyentes globales y datos editoriales. Peso Pluma, Fuerza Regida, Natanael Cano y más artistas."
        path="/artists"
      />
      <SiteNav />

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
            Explora artistas mexicanos y artistas vinculados a la música mexicana. Busca, filtra por género o país y accede al perfil de cada artista.
          </p>
          {!isLoading && !isEmpty && (
            <div className="flex items-center justify-center gap-6 text-center">
              <div>
                <div className="text-2xl font-black text-white">{allArtists.length}</div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Perfiles del directorio</div>
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
          {!isLoading && !isEmpty && directoryAudit.excluded.length > 0 && (
            <div
              className="mx-auto mt-5 max-w-xl rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-4 py-2 text-[10px] leading-5 text-amber-200/70"
              data-testid="roster-directory-audit"
              title={directoryAudit.excluded.map(artist => artist.displayName).join(", ")}
            >
              {directoryAudit.excluded.length} registro{directoryAudit.excluded.length === 1 ? "" : "s"} omitido{directoryAudit.excluded.length === 1 ? "" : "s"} por no tener un perfil canónico disponible.
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
              <button type="button" onClick={() => setSearch("")} className="text-zinc-600 hover:text-zinc-300 transition-colors" aria-label="Limpiar búsqueda">
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
              formatOption={genreLabel}
            />
            <FilterDropdown
              label="País"
              value={countryFilter}
              options={countries}
              onChange={setCountryFilter}
              formatOption={countryLabel}
            />
            <div className="relative">
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as SortMode)}
                className="appearance-none bg-white/[0.04] border border-white/[0.09] rounded-full pl-3 pr-7 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 focus:outline-none focus:border-[#39FF14]/40 cursor-pointer transition-colors hover:border-white/20"
                style={{ colorScheme: "dark" }}
                aria-label="Ordenar artistas"
                data-testid="roster-sort"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>Orden · {option.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => setVerifiedOnly(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all"
              style={{
                background: verifiedOnly ? "rgba(57,255,20,0.12)" : "rgba(255,255,255,0.04)",
                border: verifiedOnly ? "1px solid rgba(57,255,20,0.30)" : "1px solid rgba(255,255,255,0.09)",
                color: verifiedOnly ? ACCENT : "rgba(255,255,255,0.42)",
              }}
              aria-pressed={verifiedOnly}
              data-testid="roster-verified-filter"
            >
              <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.8} />
              Verificados
            </button>
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
                  type="button"
                  aria-label="Limpiar filtros de artistas"
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
              type="button"
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
              {visibleArtists.map((artist, i) => {
                const rawStreams = kworbStreams?.[artist.displayName];
                let totalStreamsFmt: string | null = null;
                if (rawStreams && rawStreams > 0) {
                  if (rawStreams >= 1_000_000_000) totalStreamsFmt = `${(rawStreams / 1_000_000_000).toFixed(1)}B`;
                  else if (rawStreams >= 1_000_000) totalStreamsFmt = `${(rawStreams / 1_000_000).toFixed(1)}M`;
                  else if (rawStreams >= 1_000) totalStreamsFmt = `${Math.round(rawStreams / 1_000)}K`;
                }
                return (
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
                    canonicalName={artist.canonicalName}
                    profileHref={artist.profileHref}
                    photoUrl={lookupArtistImage(artistImages, [artist.displayName, artist.canonicalName])}
                    imageLookupReady={artistImagesFetched}
                    totalStreamsFmt={totalStreamsFmt}
                    isVerified={verifiedArtistKeys.has(artist.artistKey)}
                    index={i}
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
        {!isLoading && !isError && !isEmpty && visibleArtists.length < filtered.length && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount(count => Math.min(count + ROSTER_PAGE_SIZE, filtered.length))}
              className="rounded-full border border-[#39FF14]/25 bg-[#39FF14]/[.07] px-5 py-3 text-[10px] font-black uppercase tracking-[.16em] text-[#39FF14] transition hover:border-[#39FF14]/45 hover:bg-[#39FF14]/[.12]"
              data-testid="roster-load-more"
            >
              Cargar más
            </button>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="max-w-[1400px] mx-auto px-6 py-8 mt-8 border-t border-white/[0.05] flex items-center justify-between gap-4 flex-wrap">
        <Link href="/">
          <img src={logoUrl} alt="Mexico Charts" className="h-6 object-contain opacity-40 hover:opacity-70 transition-opacity" />
        </Link>
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">
          © 2026 Mexico Charts — Todos los derechos reservados
        </div>
      </footer>
    </div>
  );
}
