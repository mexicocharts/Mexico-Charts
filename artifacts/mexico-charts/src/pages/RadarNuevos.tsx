import { useMemo } from "react";
import { Link } from "wouter";
import { Activity, Radio, Sparkles, TrendingUp, Users } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { useArtistImages } from "@/hooks/useArtistImages";
import { useChartsHub, type HubRow } from "@/hooks/useChartsHub";
import { lookupArtistMetadata, useArtistMetadata, useArtistsDaily, useArtistsWeekly } from "@/services/dataProvider";
import { slugify } from "@/lib/utils";
import type { ArtistMetadata } from "@/services/artistMetadata";
import type { ChartArtist } from "@/types/chartData";

const ACCENT = "#39FF14";

type RadarStage = "Nuevo" | "Emergente" | "Solo breakout";

interface RadarCandidateConfig {
  name: string;
  stage: RadarStage;
  firstSignal: string;
  releaseCount: number;
  confidence: "Alta" | "Media";
  note: string;
}

interface RadarArtist extends RadarCandidateConfig {
  meta?: ArtistMetadata;
  spotifyWeeklyRank?: number;
  youtubeWeeklyRank?: number;
  youtubeWeeklyViews: number;
  youtubeWeeklyViewsLabel: string;
  socialReach: number;
  dailyChartRank?: number;
  weeklyChartRank?: number;
  score: number;
  reasons: string[];
}

const RADAR_CANDIDATES: RadarCandidateConfig[] = [
  { name: "Neton Vega", stage: "Emergente", firstSignal: "2023", releaseCount: 29, confidence: "Alta", note: "primer gran impulso" },
  { name: "Tito Double P", stage: "Emergente", firstSignal: "2023", releaseCount: 3, confidence: "Alta", note: "solo breakout" },
  { name: "Chino Pacas", stage: "Emergente", firstSignal: "2023", releaseCount: 9, confidence: "Alta", note: "primer hit cycle" },
  { name: "Jorsshh", stage: "Emergente", firstSignal: "2022", releaseCount: 8, confidence: "Media", note: "descubrimiento" },
  { name: "Moy Bobadilla", stage: "Nuevo", firstSignal: "2024", releaseCount: 4, confidence: "Alta", note: "catálogo inicial" },
  { name: "Panter Bélico", stage: "Solo breakout", firstSignal: "2023", releaseCount: 37, confidence: "Media", note: "carrera solista" },
  { name: "El De Las R's", stage: "Emergente", firstSignal: "2023", releaseCount: 10, confidence: "Media", note: "señal temprana" },
  { name: "Régulo Molina", stage: "Nuevo", firstSignal: "2024", releaseCount: 5, confidence: "Alta", note: "radar nuevos" },
  { name: "Alan Arrieta", stage: "Nuevo", firstSignal: "2024", releaseCount: 5, confidence: "Alta", note: "catálogo inicial" },
  { name: "Kevin AMF", stage: "Emergente", firstSignal: "2023", releaseCount: 26, confidence: "Alta", note: "primer gran impulso" },
  { name: "Angel Almaguer", stage: "Emergente", firstSignal: "2023", releaseCount: 9, confidence: "Alta", note: "descubrimiento" },
  { name: "Rey Quinto", stage: "Emergente", firstSignal: "2023", releaseCount: 11, confidence: "Media", note: "señal temprana" },
  { name: "Victor Cibrian", stage: "Emergente", firstSignal: "2022", releaseCount: 36, confidence: "Media", note: "pre-breakout" },
  { name: "El Randal", stage: "Nuevo", firstSignal: "2024", releaseCount: 6, confidence: "Alta", note: "radar nuevos" },
  { name: "Oscar Ortiz", stage: "Emergente", firstSignal: "2023", releaseCount: 30, confidence: "Alta", note: "primer gran impulso" },
  { name: "Miranda León", stage: "Emergente", firstSignal: "2023", releaseCount: 14, confidence: "Alta", note: "descubrimiento" },
  { name: "Grupo Descarga Del 3030", stage: "Emergente", firstSignal: "2022", releaseCount: 32, confidence: "Media", note: "pre-breakout" },
  { name: "Eugenio Esquivel", stage: "Emergente", firstSignal: "2023", releaseCount: 7, confidence: "Media", note: "ecosistema nuevo" },
  { name: "Conjunto Nuevo Amanecer", stage: "Emergente", firstSignal: "2022", releaseCount: 38, confidence: "Media", note: "pre-breakout" },
  { name: "Alfonso Muñoz", stage: "Emergente", firstSignal: "2022", releaseCount: 20, confidence: "Media", note: "descubrimiento" },
  { name: "Hans el Oso", stage: "Emergente", firstSignal: "2022", releaseCount: 44, confidence: "Media", note: "pre-breakout" },
  { name: "Los Esquivel", stage: "Nuevo", firstSignal: "2024", releaseCount: 6, confidence: "Media", note: "proyecto nuevo" },
  { name: "Hernan Sepulveda", stage: "Emergente", firstSignal: "2022", releaseCount: 32, confidence: "Media", note: "pre-breakout" },
  { name: "Omar Camacho", stage: "Emergente", firstSignal: "2023", releaseCount: 5, confidence: "Alta", note: "catálogo inicial" },
  { name: "Linea Personal", stage: "Emergente", firstSignal: "2022", releaseCount: 22, confidence: "Media", note: "descubrimiento" },
  { name: "Los Hnos Rodriguez", stage: "Emergente", firstSignal: "2022", releaseCount: 44, confidence: "Media", note: "pre-breakout" },
];

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value: number): string {
  if (!value) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rankScore(rank: number | undefined, maxRank: number, points: number): number {
  if (!rank || rank > maxRank) return 0;
  return ((maxRank + 1 - rank) / maxRank) * points;
}

function scaleSqrt(value: number, max: number, points: number): number {
  if (value <= 0 || max <= 0) return 0;
  return clamp(Math.sqrt(value / max) * points, 0, points);
}

function scaleSocial(value: number, max: number, points: number): number {
  if (value <= 0 || max <= 0) return 0;
  return clamp(Math.pow(value / max, 0.38) * points, 0, points);
}

function parseMetric(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, "").trim().toUpperCase();
  if (cleaned.endsWith("B")) return Math.round(parseFloat(cleaned) * 1_000_000_000);
  if (cleaned.endsWith("M")) return Math.round(parseFloat(cleaned) * 1_000_000);
  if (cleaned.endsWith("K")) return Math.round(parseFloat(cleaned) * 1_000);
  return parseInt(cleaned.replace(/[^0-9.-]/g, ""), 10) || 0;
}

function buildChartMap(artists: ChartArtist[]) {
  const map = new Map<string, ChartArtist>();
  artists.forEach((artist) => map.set(normalizeName(artist.name), artist));
  return map;
}

function buildYoutubeArtistMap(rows: HubRow[]) {
  const map = new Map<string, { rank: number; views: number }>();
  rows.forEach((row) => {
    const name = (row["Artist Name"] ?? row["Artist"] ?? "").trim();
    const rank = parseInt(row["Rank"] ?? row["rank"] ?? "", 10);
    if (!name || !rank) return;
    map.set(normalizeName(name), {
      rank,
      views: parseMetric(row["Views"]),
    });
  });
  return map;
}

function buildSpotifyArtistMap(rows: HubRow[]) {
  const map = new Map<string, { rank: number }>();
  rows.forEach((row) => {
    const name = (row["Artist"] ?? row["Artist Name"] ?? "").trim();
    const rank = parseInt(row["Rank"] ?? row["rank"] ?? "", 10);
    if (!name || !rank) return;
    map.set(normalizeName(name), { rank });
  });
  return map;
}

function socialReachFromMeta(meta?: ArtistMetadata): number {
  if (!meta) return 0;
  return (
    meta.spotifyFollowers +
    meta.youtubeSubscribers +
    meta.instagramFollowers +
    meta.tiktokFollowers +
    meta.facebookFollowers
  );
}

function freshnessScore(firstSignal: string): number {
  const year = Number(firstSignal);
  if (year >= 2024) return 16;
  if (year === 2023) return 13;
  if (year === 2022) return 9;
  return 5;
}

function catalogScore(releaseCount: number): number {
  if (releaseCount <= 8) return 14;
  if (releaseCount <= 20) return 11;
  if (releaseCount <= 35) return 8;
  return 5;
}

function buildRadar(
  metadata: { byKey: Map<string, ArtistMetadata>; byName: Map<string, ArtistMetadata> },
  dailyArtists: ChartArtist[],
  weeklyArtists: ChartArtist[],
  youtubeArtistRows: HubRow[] = [],
  spotifyArtistRows: HubRow[] = [],
): RadarArtist[] {
  const dailyChartMap = buildChartMap(dailyArtists);
  const weeklyChartMap = buildChartMap(weeklyArtists);
  const youtubeChartMap = buildYoutubeArtistMap(youtubeArtistRows);
  const spotifyChartMap = buildSpotifyArtistMap(spotifyArtistRows);
  const maxYoutubeWeeklyViews = Math.max(...RADAR_CANDIDATES.map((artist) => (
    youtubeChartMap.get(normalizeName(artist.name))?.views ?? 0
  )), 1);
  const maxSocial = Math.max(...RADAR_CANDIDATES.map((artist) => (
    socialReachFromMeta(lookupArtistMetadata(undefined, artist.name, metadata.byKey, metadata.byName))
  )), 1);

  return RADAR_CANDIDATES
    .map((candidate) => {
      const key = normalizeName(candidate.name);
      const dailyChartArtist = dailyChartMap.get(key);
      const weeklyChartArtist = weeklyChartMap.get(key);
      const spotifyChartArtist = spotifyChartMap.get(key);
      const youtubeChartArtist = youtubeChartMap.get(key);
      const meta = lookupArtistMetadata(undefined, candidate.name, metadata.byKey, metadata.byName);
      const spotifyWeeklyRank = spotifyChartArtist?.rank ?? weeklyChartArtist?.mexicoRank;
      const youtubeWeeklyRank = youtubeChartArtist?.rank;
      const youtubeWeeklyViews = youtubeChartArtist?.views ?? 0;
      const socialReach = socialReachFromMeta(meta);

      const score = Math.round(
        freshnessScore(candidate.firstSignal) +
        catalogScore(candidate.releaseCount) +
        rankScore(spotifyWeeklyRank, 100, 32) +
        rankScore(youtubeWeeklyRank, 100, 20) +
        scaleSqrt(youtubeWeeklyViews, maxYoutubeWeeklyViews, 16) +
        scaleSocial(socialReach, maxSocial, 12) +
        (candidate.confidence === "Alta" ? 6 : 3),
      );

      const reasons = [
        spotifyWeeklyRank ? `Spotify #${spotifyWeeklyRank}` : "",
        youtubeWeeklyRank ? `YouTube artistas #${youtubeWeeklyRank}` : "",
        youtubeWeeklyViews > 0 ? `${compact(youtubeWeeklyViews)} vistas MX` : "",
        candidate.firstSignal ? `señal desde ${candidate.firstSignal}` : "",
        `${candidate.releaseCount} lanzamientos detectados`,
      ].filter(Boolean);

      return {
        ...candidate,
        meta,
        spotifyWeeklyRank,
        youtubeWeeklyRank,
        youtubeWeeklyViews,
        youtubeWeeklyViewsLabel: compact(youtubeWeeklyViews),
        socialReach,
        dailyChartRank: dailyChartArtist?.mexicoRank,
        weeklyChartRank: weeklyChartArtist?.mexicoRank,
        score,
        reasons,
      };
    })
    .sort((a, b) => (
      b.score - a.score ||
      (a.spotifyWeeklyRank ?? 9999) - (b.spotifyWeeklyRank ?? 9999) ||
      (a.youtubeWeeklyRank ?? 9999) - (b.youtubeWeeklyRank ?? 9999) ||
      b.youtubeWeeklyViews - a.youtubeWeeklyViews ||
      b.socialReach - a.socialReach
    ));
}

function stageColor(stage: RadarStage) {
  if (stage === "Nuevo") return ACCENT;
  if (stage === "Solo breakout") return "#7dd3fc";
  return "#d9f99d";
}

function RadarRow({ item, index, photoUrl }: { item: RadarArtist; index: number; photoUrl?: string | null }) {
  const slug = slugify(item.name);
  const rank = index + 1;
  const genre = item.meta?.subgenre || item.meta?.genre || "Mexico Charts";
  const initial = item.name.trim()[0]?.toUpperCase() ?? "?";
  const isTopThree = index < 3;

  return (
    <Link href={`/artist/${slug}`}>
      <article
        className="group cursor-pointer overflow-hidden border bg-[#080808] transition hover:border-[#39FF14]/35"
        style={{
          borderColor: isTopThree ? "rgba(57,255,20,0.28)" : "rgba(255,255,255,0.08)",
          borderRadius: 8,
        }}
      >
        <div className="grid gap-4 p-4 md:grid-cols-[92px_1fr] lg:grid-cols-[112px_1.1fr_1fr] lg:items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 text-right text-3xl font-black tabular-nums leading-none text-white sm:w-12 sm:text-4xl">
              {rank}
            </div>
            <div
              className="h-14 w-14 flex-shrink-0 overflow-hidden border bg-white/[0.04] sm:h-16 sm:w-16"
              style={{ borderColor: "rgba(255,255,255,0.08)", borderRadius: 8 }}
            >
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={item.name}
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  style={{ filter: "brightness(0.82) saturate(0.8) contrast(1.08)" }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-black text-zinc-500">
                  {initial}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className="border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]"
                style={{ borderColor: `${stageColor(item.stage)}55`, color: stageColor(item.stage), borderRadius: 999 }}
              >
                {item.stage}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">{item.note}</span>
            </div>
            <h2 className="break-words text-[1.55rem] font-black uppercase leading-[0.95] text-white group-hover:text-[#39FF14] sm:text-3xl lg:text-[1.7rem]">
              {item.name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              <span>{genre}</span>
              <span>Desde {item.firstSignal}</span>
              <span>{item.confidence}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Radar</div>
              <div className="mt-1 text-sm font-black text-white">{item.score}</div>
            </div>
            <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Spotify</div>
              <div className="mt-1 text-sm font-black text-white">{item.spotifyWeeklyRank ? `#${item.spotifyWeeklyRank}` : "—"}</div>
            </div>
            <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">YouTube</div>
              <div className="mt-1 text-sm font-black text-white">{item.youtubeWeeklyRank ? `#${item.youtubeWeeklyRank}` : item.youtubeWeeklyViewsLabel}</div>
            </div>
            <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Catálogo</div>
              <div className="mt-1 text-sm font-black text-white">{item.releaseCount}</div>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function RadarNuevos() {
  const artistsDaily = useArtistsDaily();
  const artistsWeekly = useArtistsWeekly();
  const metadata = useArtistMetadata();
  const chartsHub = useChartsHub({ retry: 2 });

  const radar = useMemo(
    () => buildRadar(
      { byKey: metadata.byKey, byName: metadata.byName },
      artistsDaily.data,
      artistsWeekly.data,
      chartsHub.data?.sheets?.YT_Artists_Weekly?.rows ?? [],
      chartsHub.data?.sheets?.Spotify_Artists_Weekly?.rows ?? [],
    ),
    [metadata.byKey, metadata.byName, artistsDaily.data, artistsWeekly.data, chartsHub.data],
  );

  const imageNames = useMemo(() => radar.map((artist) => artist.name), [radar]);
  const artistImages = useArtistImages(imageNames);
  const leader = radar[0];
  const isLoading = artistsDaily.isLoading || artistsWeekly.isLoading || metadata.isLoading || chartsHub.isLoading;
  const isError = artistsDaily.isError || artistsWeekly.isError || metadata.isError || chartsHub.isError;
  const newCount = radar.filter((artist) => artist.stage === "Nuevo").length;
  const emergingCount = radar.filter((artist) => artist.stage === "Emergente").length;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PageSEO
        title="Radar Nuevos — Mexico Charts"
        description="Ranking editorial de artistas nuevos y emergentes en música mexicana: primeras señales, etapa de descubrimiento, consumo actual y potencial de breakout."
        path="/radar-nuevos"
      />
      <SiteNav />

      <main>
        <section className="overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(ellipse_at_top,rgba(57,255,20,0.16),transparent_58%),#050505]">
          <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-5 sm:py-14 md:px-8 md:py-18">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ACCENT }}>
              <Sparkles className="h-4 w-4" />
              Radar Nuevos
            </div>
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div>
                <h1 className="max-w-full text-[2.45rem] font-black uppercase leading-[0.88] tracking-normal text-white sm:text-6xl md:max-w-5xl md:text-7xl">
                  Artistas en primer impulso
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
                  Una lectura de artistas nuevos, emergentes o en etapa de primer gran breakout dentro de la música mexicana.
                </p>
              </div>

              {leader && (
                <Link href={`/artist/${slugify(leader.name)}`}>
                  <div
                    className="cursor-pointer overflow-hidden border bg-black/35 transition hover:border-[#39FF14]/40"
                    style={{ borderColor: "rgba(57,255,20,0.22)", borderRadius: 8 }}
                  >
                    <div className="grid grid-cols-[88px_1fr] sm:grid-cols-[116px_1fr]">
                      <div className="relative min-h-full overflow-hidden bg-white/[0.04]">
                        {artistImages[leader.name] ? (
                          <img
                            src={artistImages[leader.name] ?? ""}
                            alt={leader.name}
                            className="h-full w-full object-cover"
                            style={{ filter: "brightness(0.78) saturate(0.8) contrast(1.1)" }}
                          />
                        ) : (
                          <div className="flex h-full min-h-28 w-full items-center justify-center text-3xl font-black text-zinc-600">
                            {leader.name.trim()[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                          Señal líder
                        </div>
                        <div className="mt-2 break-words text-[1.5rem] font-black uppercase leading-[0.95] text-white sm:text-3xl">
                          {leader.name}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                          <span>{leader.stage}</span>
                          <span>{leader.score} radar</span>
                          {leader.spotifyWeeklyRank && <span>Spotify #{leader.spotifyWeeklyRank}</span>}
                          {leader.youtubeWeeklyRank && <span>YouTube #{leader.youtubeWeeklyRank}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )}
            </div>

            <div className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
              <div className="border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4" style={{ borderRadius: 8 }}>
                <Users className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                <div className="text-xl font-black sm:text-2xl">{radar.length || "—"}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Pool activo</div>
              </div>
              <div className="border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4" style={{ borderRadius: 8 }}>
                <Sparkles className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                <div className="text-xl font-black sm:text-2xl">{newCount || "—"}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Nuevos</div>
              </div>
              <div className="border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4" style={{ borderRadius: 8 }}>
                <TrendingUp className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                <div className="text-xl font-black sm:text-2xl">{emergingCount || "—"}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Emergentes</div>
              </div>
              <div className="border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4" style={{ borderRadius: 8 }}>
                <Radio className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                <div className="text-xl font-black sm:text-2xl">En vivo</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Datos</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 py-8 md:px-8">
          <div className="mb-6 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <p className="max-w-3xl text-xs leading-5 text-zinc-500">
              Radar no mide debut literal: mide artistas sin historial largo de hits, con catálogo todavía compacto o primer impulso reciente.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Pre-hit", "Primer impulso", "Baja huella histórica"].map((label) => (
                <span
                  key={label}
                  className="border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400"
                  style={{ borderRadius: 6 }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {isLoading && (
            <div className="space-y-3" aria-busy="true" aria-label="Cargando Radar Nuevos">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse bg-white/[0.04]" style={{ borderRadius: 8 }} />
              ))}
            </div>
          )}

          {isError && (
            <div className="border border-red-500/20 bg-red-500/[0.045] p-5" style={{ borderRadius: 8 }} role="status">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-200">
                Radar temporalmente no disponible
              </div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                No pudimos actualizar las señales activas en este momento. El pool editorial se mantiene y volverá a ordenarse cuando las fuentes respondan.
              </p>
            </div>
          )}

          {!isLoading && !isError && radar.length === 0 && (
            <div className="border border-white/[0.08] bg-white/[0.025] p-5 text-sm leading-6 text-zinc-500" style={{ borderRadius: 8 }}>
              Aún no hay suficientes señales para construir Radar Nuevos.
            </div>
          )}

          {!isLoading && !isError && radar.length > 0 && (
            <div className="space-y-3">
              {radar.map((item, index) => (
                <RadarRow
                  key={item.name}
                  item={item}
                  index={index}
                  photoUrl={artistImages[item.name]}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
