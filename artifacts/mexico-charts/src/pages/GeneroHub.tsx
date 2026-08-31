import { useState, useMemo, useEffect } from "react";
import PageSEO from "@/components/PageSEO";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import SiteNav from "@/components/SiteNav";
import { useArtistMetadata } from "@/services/dataProvider";
import type { ArtistMetadata } from "@/services/artistMetadata";
import { useArtistImages } from "@/hooks/useArtistImages";
import { useChartsHub, type HubRow } from "@/hooks/useChartsHub";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";
import { genreLabel, labelAssociationValue } from "@/lib/presentationLabels";

/* ─── Constants ─────────────────────────────────────────────── */
const G = "#39FF14";
const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`;

type GenreName = "Corridos Tumbados" | "Regional Mexicano" | "Norteño" | "Banda" | "Hip-Hop Mexicano" | "Pop";

interface GenreDef {
  name: GenreName;
  accent: string;
  synonyms: string[];
  description: string;
}

const GENRES: GenreDef[] = [
  {
    name: "Corridos Tumbados",
    accent: G,
    synonyms: ["corridos tumbados", "corrido tumbado", "corridos"],
    description: "La fusión de corridos tradicionales con trap y hip-hop. El sonido que conquistó el mundo desde Sinaloa.",
  },
  {
    name: "Regional Mexicano",
    accent: "rgba(57,255,20,0.82)",
    synonyms: ["regional mexicano", "regional mexican", "regional mexicana"],
    description: "El género más escuchado de México. Banda, norteño, cumbia y más bajo un mismo estandarte.",
  },
  {
    name: "Norteño",
    accent: "rgba(57,255,20,0.64)",
    synonyms: ["norteño", "norteno", "norteña", "norteñas"],
    description: "Acordeón, bajo sexto y historias del norte. Raíces profundas con millones de oyentes globales.",
  },
  {
    name: "Banda",
    accent: "rgba(57,255,20,0.48)",
    synonyms: ["banda", "banda sinaloense", "grupero banda"],
    description: "Los metales de Sinaloa que suenan en estadios. Potencia, celebración y tradición mexicana.",
  },
  {
    name: "Hip-Hop Mexicano",
    accent: "rgba(57,255,20,0.36)",
    synonyms: ["hip hop mexicano", "hip-hop mexicano", "hip hop", "hip-hop", "rap mexicano"],
    description: "Letras callejeras y ritmos urbanos nacidos en México. Voz de una generación.",
  },
  {
    name: "Pop",
    accent: "rgba(57,255,20,0.26)",
    synonyms: ["pop", "pop urbano", "latin pop", "pop latino"],
    description: "Pop latino con sello mexicano. Melodías que cruzan fronteras y conectan culturas.",
  },
];

/* ─── Helpers ───────────────────────────────────────────────── */
function fmtNum(n: number): string {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function matchesGenre(meta: ArtistMetadata, synonyms: string[]): boolean {
  const g = (meta.genre ?? "").toLowerCase().trim();
  const sg = (meta.subgenre ?? "").toLowerCase().trim();
  return synonyms.some(s => g === s || sg === s || g.includes(s) || sg.includes(s));
}

/* ─── Sub-components ────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", height: 200 }} />
  );
}

interface ArtistCardProps {
  meta: ArtistMetadata;
  image: string | null | undefined;
  spotifyRank?: number;
  accent: string;
  index: number;
}

function ArtistCard({ meta, image, spotifyRank, accent, index }: ArtistCardProps) {
  const slug = slugify(meta.displayName);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
    >
      <Link href={canonicalArtistHref(meta.artistKey) ?? canonicalArtistHref(meta.displayName) ?? "/artists"}>
        <div
          className="relative overflow-hidden rounded-xl cursor-pointer group"
          style={{
            background: "linear-gradient(160deg, #0d0d0d 0%, #0a0a0a 100%)",
            border: `1px solid ${accent}22`,
            transition: "border-color 0.25s, box-shadow 0.25s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = `${accent}55`;
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${accent}14`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = `${accent}22`;
            (e.currentTarget as HTMLElement).style.boxShadow = "none";
          }}
        >
          {/* Noise */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none rounded-xl" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
          {/* Left accent bar */}
          <div className="absolute left-0 top-5 bottom-5 w-0.5 rounded-full" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />

          <div className="relative flex items-center gap-4 p-4 pl-5">
            {/* Artist photo */}
            <div className="relative shrink-0 w-14 h-14 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${accent}33` }}>
              {image ? (
                <img src={image} alt={meta.displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[11px] font-black uppercase"
                  style={{ color: accent, letterSpacing: "0.08em" }}>
                  {meta.displayName.split(" ").map(w => w[0]).slice(0, 2).join("")}
                </div>
              )}
              {/* Spotify rank badge */}
              {spotifyRank && (
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-black"
                  style={{ background: G, boxShadow: `0 0 6px ${G}80` }}>
                  {spotifyRank}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="font-black text-sm uppercase text-white leading-tight truncate"
                style={{ letterSpacing: "-0.01em" }}>
                {meta.displayName}
              </div>
              {meta.subgenre && (
                <div className="text-[10px] uppercase tracking-wide mt-0.5 truncate"
                  style={{ color: "rgba(255,255,255,0.38)" }}>
                  {genreLabel(meta.subgenre)}
                </div>
              )}
              <div className="flex items-center gap-3 mt-2">
                {meta.spotifyStreams > 0 && (
                  <span className="text-[11px] font-black" style={{ color: G }}>
                    {meta.spotifyStreamsFmt} <span className="opacity-50 font-medium">streams</span>
                  </span>
                )}
                {meta.label && (
                  <span className="text-[10px] uppercase tracking-wide truncate"
                    style={{ color: "rgba(255,255,255,0.55)" }}>
                    Sellos/distribuidores: {labelAssociationValue(meta.label)}
                  </span>
                )}
              </div>
            </div>

            {/* Arrow */}
            <span className="shrink-0 text-[10px] font-black opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: accent }}>
              →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Genre overview card ────────────────────────────────────── */
interface GenreCardProps {
  genre: GenreDef;
  artists: ArtistMetadata[];
  totalStreams: number;
  chartCount: number;
  isSelected: boolean;
  onClick: () => void;
}

function GenreCard({ genre, artists, totalStreams, chartCount, isSelected, onClick }: GenreCardProps) {
  const topThree = artists.slice(0, 3).map(a => a.displayName);
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative overflow-hidden rounded-xl cursor-pointer"
      style={{
        background: isSelected
          ? `linear-gradient(160deg, #0f1f0a 0%, #0a1507 100%)`
          : "linear-gradient(160deg, #0d0d0d 0%, #0a0a0a 100%)",
        border: `1px solid ${isSelected ? genre.accent + "66" : genre.accent + "22"}`,
        boxShadow: isSelected ? `0 0 32px ${genre.accent}18, inset 0 1px 0 ${genre.accent}22` : "0 2px 16px rgba(0,0,0,0.5)",
        transition: "all 0.25s ease",
      }}
    >
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none rounded-xl" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: genre.accent, opacity: isSelected ? 1 : 0.5 }} />

      <div className="relative p-5 pl-6">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="font-black text-sm uppercase text-white leading-tight" style={{ letterSpacing: "-0.01em" }}>
              {genre.name}
            </div>
            <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {artists.length > 0 ? `${artists.length} artistas` : "—"}
            </div>
          </div>
          {isSelected && (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: genre.accent, color: "#000" }}>
              Activo
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-2xl font-black leading-none" style={{ color: isSelected ? genre.accent : "rgba(255,255,255,0.85)" }}>
            {fmtNum(totalStreams)}
          </span>
          <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>streams spotify</span>
        </div>

        {chartCount > 0 && (
          <div className="text-[10px] uppercase tracking-wide mb-3" style={{ color: genre.accent + "cc" }}>
            {chartCount} en top 200 hoy
          </div>
        )}

        {topThree.length > 0 && (
          <div className="text-[10px] uppercase tracking-wide leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)" }}>
            {topThree.join(" · ")}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function GeneroHub() {
  const [selectedGenre, setSelectedGenre] = useState<GenreName>("Corridos Tumbados");

  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, []);

  /* ── Data ── */
  const { byKey: metaByKey, isLoading: metaLoading } = useArtistMetadata();

  const { data: hubData } = useChartsHub({ retry: 2 });

  const spotifyDailyRows: HubRow[] = hubData?.sheets?.["Spotify_Artists_Daily"]?.rows ?? [];

  /* ── Build Spotify Daily rank lookup ── */
  const spotifyRankByArtist = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of spotifyDailyRows) {
      const name = (row["Artist"] ?? "").toLowerCase().trim();
      const rank = parseInt(row["Rank"] ?? "", 10);
      if (name && rank) map.set(name, rank);
    }
    return map;
  }, [spotifyDailyRows]);

  /* ── Build genre buckets from metadata ── */
  const genreBuckets = useMemo(() => {
    const buckets: Record<GenreName, ArtistMetadata[]> = {} as Record<GenreName, ArtistMetadata[]>;
    for (const g of GENRES) buckets[g.name] = [];

    for (const meta of metaByKey.values()) {
      for (const g of GENRES) {
        if (matchesGenre(meta, g.synonyms)) {
          buckets[g.name].push(meta);
          break; // assign to first matching genre only
        }
      }
    }
    // Sort each bucket by Spotify listeners desc
    for (const g of GENRES) {
      buckets[g.name].sort((a, b) => b.spotifyStreams - a.spotifyStreams);
    }
    return buckets;
  }, [metaByKey]);

  /* ── Genre stats ── */
  const genreStats = useMemo(() => {
    return GENRES.reduce((acc, g) => {
      const artists = genreBuckets[g.name] ?? [];
      const totalStreams = artists.reduce((s, a) => s + a.spotifyStreams, 0);
      const chartCount = artists.filter(a =>
        spotifyRankByArtist.has(a.displayName.toLowerCase().trim())
      ).length;
      acc[g.name] = { totalStreams, chartCount };
      return acc;
    }, {} as Record<GenreName, { totalStreams: number; chartCount: number }>);
  }, [genreBuckets, spotifyRankByArtist]);

  /* ── Active genre artists + their images ── */
  const activeGenre = GENRES.find(g => g.name === selectedGenre)!;
  const activeArtists = genreBuckets[selectedGenre] ?? [];
  const artistNames = useMemo(() => activeArtists.map(a => a.displayName), [activeArtists]);
  const images = useArtistImages(artistNames);

  const isLoading = metaLoading && metaByKey.size === 0;

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#fff" }}>
      <PageSEO
        title="Géneros de Música Mexicana — Corridos, Regional, Norteño, Banda"
        description="Explora los géneros de la música mexicana: corridos tumbados, regional mexicano, norteño y banda. Estadísticas de streaming, artistas top y tendencias."
        path="/generos"
        breadcrumbs={[
          { name: "Mexico Charts", path: "/" },
          { name: "Géneros", path: "/generos" },
        ]}
      />
      <SiteNav />

      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden"
        style={{ borderBottom: "1px solid rgba(57,255,20,0.07)", background: "linear-gradient(180deg, #0c0c0c 0%, #080808 100%)" }}>
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: NOISE_SVG, backgroundSize: "96px" }} />
        <div className="relative px-6 lg:px-12 py-5 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.35em] mb-1.5" style={{ color: G + "99" }}>
              Música Mexicana
            </div>
            <h1 className="font-black uppercase text-white leading-none"
              style={{ fontSize: "clamp(1.8rem, 4.5vw, 3.2rem)", letterSpacing: "-0.03em" }}>
              GÉNEROS
            </h1>
          </div>
          <p className="text-xs pb-0.5 max-w-sm" style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.5 }}>
            Rankings en tiempo real · artistas verificados · streams Spotify
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${G}22, transparent)` }} />
      </div>

      {/* ─── Genre overview grid ────────────────────────────── */}
      <section className="px-6 lg:px-12 py-5">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] mb-5" style={{ color: "rgba(255,255,255,0.55)" }}>
          Selecciona un género
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {GENRES.map(g => (
            <GenreCard
              key={g.name}
              genre={g}
              artists={genreBuckets[g.name] ?? []}
              totalStreams={genreStats[g.name]?.totalStreams ?? 0}
              chartCount={genreStats[g.name]?.chartCount ?? 0}
              isSelected={selectedGenre === g.name}
              onClick={() => setSelectedGenre(g.name)}
            />
          ))}
        </div>
      </section>

      {/* ─── Divider ─────────────────────────────────────────── */}
      <div className="px-6 lg:px-12">
        <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${activeGenre.accent}33, transparent)` }} />
      </div>

      {/* ─── Genre detail ────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.section
          key={selectedGenre}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28 }}
          className="px-6 lg:px-12 py-5"
        >
          {/* Genre header */}
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <h2 className="font-black uppercase text-white mb-1"
                style={{ fontSize: "clamp(1.4rem, 4vw, 2.2rem)", letterSpacing: "-0.02em" }}>
                <span style={{ color: activeGenre.accent }}>{activeGenre.name}</span>
              </h2>
              <p className="text-sm max-w-lg" style={{ color: "rgba(255,255,255,0.42)", lineHeight: 1.6 }}>
                {activeGenre.description}
              </p>
            </div>

            {/* Stats pills */}
            <div className="flex items-center gap-3 flex-wrap">
              {activeArtists.length > 0 && (
                <div className="px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
                  {activeArtists.length} artistas
                </div>
              )}
              {genreStats[selectedGenre]?.totalStreams > 0 && (
                <div className="px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide"
                  style={{ background: "rgba(57,255,20,0.07)", border: `1px solid ${activeGenre.accent}33`, color: activeGenre.accent }}>
                  {fmtNum(genreStats[selectedGenre].totalStreams)} streams Spotify
                </div>
              )}
              {genreStats[selectedGenre]?.chartCount > 0 && (
                <div className="px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wide"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  {genreStats[selectedGenre].chartCount} en Spotify Top 200 hoy
                </div>
              )}
            </div>
          </div>

          {/* Sort label */}
          {activeArtists.length > 0 && (
            <div className="text-[10px] font-black uppercase tracking-[0.25em] mb-4" style={{ color: "rgba(255,255,255,0.50)" }}>
              Ordenado por streams acumulados · Spotify
            </div>
          )}

          {/* Artist grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : activeArtists.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-2xl font-black uppercase mb-2" style={{ color: "rgba(255,255,255,0.40)" }}>Sin datos</div>
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.52)" }}>
                No hay artistas catalogados en este género todavía.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeArtists.map((meta, idx) => {
                const rank = spotifyRankByArtist.get(meta.displayName.toLowerCase().trim());
                return (
                  <ArtistCard
                    key={meta.artistKey}
                    meta={meta}
                    image={images[meta.displayName] ?? images[meta.displayName.toLowerCase()]}
                    spotifyRank={rank}
                    accent={activeGenre.accent}
                    index={idx}
                  />
                );
              })}
            </div>
          )}

          {/* Data source footnote */}
          {activeArtists.length > 0 && (
            <div className="mt-8 text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.48)" }}>
              Fuente: Spotify · Datos actualizados semanalmente · Solo artistas mexicanos verificados
            </div>
          )}
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
