import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, Award, CalendarDays, Info, Radio, TrendingUp, Users } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { lookupArtistMetadata, useArtistMetadata, useArtistsDaily } from "@/services/dataProvider";
import { slugify } from "@/lib/utils";
import type { ChartArtist } from "@/types/chartData";
import type { ArtistMetadata } from "@/services/artistMetadata";

const ACCENT = "#39FF14";
const LIVE_TOURING_API = "https://mexicochart.com/api/touring/concerts";
const SCORE_COMPONENTS = [
  { key: "chart", label: "Ranking", max: 35, helper: "posición diaria" },
  { key: "growth", label: "Crecimiento", max: 30, helper: "cambio de oyentes" },
  { key: "audience", label: "Audiencia", max: 20, helper: "escala relativa" },
  { key: "social", label: "Social", max: 10, helper: "alcance medido" },
  { key: "touring", label: "Giras", max: 5, helper: "fechas activas" },
] as const;

interface TmEvent {
  date: string;
  city: string;
  state: string;
  country: string;
  venue: string;
}

interface ArtistTours {
  id: string;
  name: string;
  events: TmEvent[];
}

interface TouringResponse {
  artists: ArtistTours[];
}

interface MomentumArtist {
  name: string;
  chartArtist?: ChartArtist;
  meta?: ArtistMetadata;
  score: number;
  listeners: number;
  growthRaw: number;
  growthLabel: string;
  socialReach: number;
  touringDates: number;
  components: {
    chart: number;
    growth: number;
    audience: number;
    social: number;
    touring: number;
  };
  reasons: string[];
}

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

function scale(value: number, max: number, points: number): number {
  if (max <= 0) return 0;
  return clamp((value / max) * points, 0, points);
}

function componentWidth(value: number, max: number) {
  if (value <= 0) return "0%";
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function scoreTier(score: number): string {
  if (score >= 80) return "Dominante";
  if (score >= 65) return "En ascenso fuerte";
  if (score >= 50) return "Alta señal";
  return "Señal activa";
}

async function fetchLiveTouring(): Promise<ArtistTours[]> {
  const response = await fetch(LIVE_TOURING_API);
  if (!response.ok) return [];
  const data = (await response.json()) as TouringResponse;
  return data.artists ?? [];
}

function buildTouringMap(artists: ArtistTours[]) {
  const map = new Map<string, ArtistTours>();
  artists.forEach((artist) => map.set(normalizeName(artist.name), artist));
  return map;
}

function buildChartMap(artists: ChartArtist[]) {
  const map = new Map<string, ChartArtist>();
  artists.forEach((artist) => map.set(normalizeName(artist.name), artist));
  return map;
}

function buildCandidateNames(
  artists: ChartArtist[],
  metadata: Map<string, ArtistMetadata>,
  tours: ArtistTours[],
) {
  const names = new Map<string, string>();
  artists.forEach((artist) => names.set(normalizeName(artist.name), artist.name));
  metadata.forEach((meta) => names.set(normalizeName(meta.displayName), meta.displayName));
  tours.forEach((tour) => names.set(normalizeName(tour.name), tour.name));
  return [...names.values()];
}

function scoreArtists(
  artists: ChartArtist[],
  metadata: { byKey: Map<string, ArtistMetadata>; byName: Map<string, ArtistMetadata> },
  tours: ArtistTours[],
): MomentumArtist[] {
  const candidates = buildCandidateNames(artists, metadata.byKey, tours);
  const chartMap = buildChartMap(artists);
  const tourMap = buildTouringMap(tours);
  const listenerValues = candidates.map((name) => {
    const chartArtist = chartMap.get(normalizeName(name));
    const meta = lookupArtistMetadata(undefined, name, metadata.byKey, metadata.byName);
    return chartArtist?.listenersRaw || meta?.spotifyListeners || 0;
  });
  const maxListeners = Math.max(...listenerValues, 1);
  const maxTouring = Math.max(...tours.map((artist) => artist.events.length), 1);
  const socialValues = candidates.map((name) => {
    const meta = lookupArtistMetadata(undefined, name, metadata.byKey, metadata.byName);
    return (meta?.tiktokFollowers ?? 0) + (meta?.instagramFollowers ?? 0) + (meta?.youtubeSubscribers ?? 0);
  });
  const maxSocial = Math.max(...socialValues, 1);

  return candidates
    .map((name) => {
      const key = normalizeName(name);
      const chartArtist = chartMap.get(key);
      const meta = lookupArtistMetadata(undefined, name, metadata.byKey, metadata.byName);
      const tour = tourMap.get(key);
      const listeners = chartArtist?.listenersRaw || meta?.spotifyListeners || 0;
      const growthRaw = chartArtist?.growthRaw ?? 0;
      const socialReach =
        (meta?.tiktokFollowers ?? 0) + (meta?.instagramFollowers ?? 0) + (meta?.youtubeSubscribers ?? 0);
      const touringDates = tour?.events.length ?? 0;

      const chartScore = chartArtist && chartArtist.mexicoRank <= 100 ? ((101 - chartArtist.mexicoRank) / 100) * 35 : 0;
      const growthScore = clamp(growthRaw, 0, 50) * 0.6;
      const audienceScore = scale(listeners, maxListeners, 20);
      const socialScore = scale(socialReach, maxSocial, 10);
      const touringScore = scale(touringDates, maxTouring, 5);
      const score = Math.round(chartScore + growthScore + audienceScore + socialScore + touringScore);

      const reasons = [
        chartArtist ? `#${chartArtist.mexicoRank} en artistas diarios` : "",
        listeners > 0 ? `${compact(listeners)} oyentes mensuales` : "",
        growthRaw > 0 ? `${chartArtist?.growth ?? `+${growthRaw.toFixed(0)}%`} en oyentes` : "",
        socialReach > 0 ? `${compact(socialReach)} alcance social medido` : "",
        touringDates > 0 ? `${touringDates === 1 ? "1 fecha activa" : `${touringDates} fechas activas`}` : "",
      ].filter(Boolean);

      return {
        name,
        chartArtist,
        meta,
        listeners,
        growthRaw,
        growthLabel: chartArtist?.growth ?? "—",
        score,
        socialReach,
        touringDates,
        components: {
          chart: Math.round(chartScore),
          growth: Math.round(growthScore),
          audience: Math.round(audienceScore),
          social: Math.round(socialScore),
          touring: Math.round(touringScore),
        },
        reasons,
      };
    })
    .filter((artist) => artist.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
}

function ComponentBar({ label, value, max, helper }: { label: string; value: number; max: number; helper: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
        <span>{label}</span>
        <span className="text-zinc-300">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: componentWidth(value, max), background: ACCENT }} />
      </div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700">{helper}</div>
    </div>
  );
}

function MomentumCard({ item, index }: { item: MomentumArtist; index: number }) {
  const { chartArtist, meta, components } = item;
  const slug = slugify(item.name);
  const genre = meta?.subgenre || chartArtist?.subgenre || chartArtist?.genre;
  const isTopThree = index < 3;

  return (
    <Link href={`/artist/${slug}`}>
      <article
        className="group relative h-full cursor-pointer overflow-hidden border bg-[#0a0a0a] p-4 transition hover:border-[#39FF14]/35"
        style={{
          borderColor: isTopThree ? "rgba(57,255,20,0.26)" : "rgba(255,255,255,0.08)",
          borderRadius: 8,
          boxShadow: isTopThree ? "0 0 34px rgba(57,255,20,0.07)" : undefined,
        }}
      >
        {isTopThree && <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: ACCENT }} />}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              {isTopThree && <Award className="h-3.5 w-3.5" style={{ color: ACCENT }} />}
              Índice #{index + 1}
            </div>
            <h2 className="text-xl font-black uppercase leading-none tracking-normal text-white group-hover:text-[#39FF14]">
              {item.name}
            </h2>
            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              {genre || "Mexico Charts"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black leading-none" style={{ color: ACCENT }}>
              {item.score}
            </div>
            <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">/ 100</div>
            <div className="mt-2 rounded-full border border-[#39FF14]/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#39FF14]">
              {scoreTier(item.score)}
            </div>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Posición</div>
            <div className="mt-1 text-sm font-black text-white">{chartArtist ? `#${chartArtist.mexicoRank}` : "—"}</div>
          </div>
          <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Oyentes</div>
            <div className="mt-1 text-sm font-black text-white">{compact(item.listeners)}</div>
          </div>
          <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Giras</div>
            <div className="mt-1 text-sm font-black text-white">{item.touringDates}</div>
          </div>
        </div>

        <div className="mb-4 space-y-2">
          {SCORE_COMPONENTS.map((component) => (
            <ComponentBar
              key={component.key}
              label={component.label}
              value={components[component.key]}
              max={component.max}
              helper={component.helper}
            />
          ))}
        </div>

        <div className="space-y-1 border-t border-white/[0.06] pt-3">
          {item.reasons.slice(0, 3).map((reason) => (
            <div key={reason} className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: ACCENT }} />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </article>
    </Link>
  );
}

export default function ArtistMomentum() {
  const artistsDaily = useArtistsDaily();
  const metadata = useArtistMetadata();
  const touring = useQuery({
    queryKey: ["artist-momentum", "live-touring"],
    queryFn: fetchLiveTouring,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const momentum = useMemo(
    () =>
      scoreArtists(
        artistsDaily.data,
        { byKey: metadata.byKey, byName: metadata.byName },
        touring.data ?? [],
      ),
    [artistsDaily.data, metadata.byKey, metadata.byName, touring.data],
  );

  const leader = momentum[0];
  const isLoading = artistsDaily.isLoading || metadata.isLoading;
  const isError = artistsDaily.isError || metadata.isError;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PageSEO
        title="Índice de Impulso de Artistas — Mexico Charts"
        description="Ranking de impulso de artistas mexicanos combinando posición en listas, audiencia, crecimiento, alcance social y giras."
        path="/artist-momentum"
      />
      <SiteNav />

      <main>
        <section className="border-b border-white/[0.06] bg-[radial-gradient(ellipse_at_top,rgba(57,255,20,0.14),transparent_58%),#050505]">
          <div className="mx-auto max-w-[1320px] px-5 py-14 md:px-8 md:py-18">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ACCENT }}>
              <Activity className="h-4 w-4" />
              Inteligencia Mexico Charts
            </div>
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div>
                <h1 className="max-w-4xl text-4xl font-black uppercase leading-[0.95] tracking-normal md:text-6xl">
                  Índice de Impulso de <span style={{ color: ACCENT }}>Artistas</span>
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
                  Un indicador editorial de Mexico Charts que combina listas, audiencia, crecimiento,
                  alcance social y actividad de giras para detectar qué artistas están generando más señal ahora.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2">
                <div className="border border-white/[0.08] bg-white/[0.03] p-4" style={{ borderRadius: 8 }}>
                  <TrendingUp className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                  <div className="text-2xl font-black">{leader?.score ?? "—"}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Puntaje líder</div>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-4" style={{ borderRadius: 8 }}>
                  <Users className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                  <div className="text-2xl font-black">{momentum.length || "—"}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Artistas</div>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-4" style={{ borderRadius: 8 }}>
                  <CalendarDays className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                  <div className="text-2xl font-black">{touring.data?.reduce((sum, a) => sum + a.events.length, 0) ?? "—"}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Fechas</div>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-4" style={{ borderRadius: 8 }}>
                  <Radio className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                  <div className="text-2xl font-black">En vivo</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Datos</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 py-8 md:px-8">
          <div className="mb-6 border border-white/[0.08] bg-[#0a0a0a] p-4" style={{ borderRadius: 8 }}>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex gap-3">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: ACCENT }} />
                <p className="text-xs leading-5 text-zinc-400">
                  Ranking propietario de Mexico Charts con puntaje máximo de 100. El Top 25 se calcula desde la base
                  completa de artistas y luego se ordena por señal actual, no solo por artistas ya visibles en el ranking.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SCORE_COMPONENTS.map((component) => (
                  <div
                    key={component.key}
                    className="border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400"
                    style={{ borderRadius: 6 }}
                  >
                    <span className="text-white">{component.label}</span>{" "}
                    <span style={{ color: ACCENT }}>{component.max}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-80 animate-pulse bg-white/[0.04]" style={{ borderRadius: 8 }} />
              ))}
            </div>
          )}

          {isError && (
            <div className="border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-200" style={{ borderRadius: 8 }}>
              No se pudo cargar la data de momentum en este momento.
            </div>
          )}

          {!isLoading && !isError && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {momentum.map((item, index) => (
                <MomentumCard key={item.name} item={item} index={index} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
