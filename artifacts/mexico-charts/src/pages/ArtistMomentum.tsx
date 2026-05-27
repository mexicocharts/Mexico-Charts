import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, Award, CalendarDays, Info, Radio, TrendingUp, Users } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { useArtistImages } from "@/hooks/useArtistImages";
import { useBatchKworbStreamStats, type KworbStreamSnapshot } from "@/hooks/useKworbStats";
import { lookupArtistMetadata, useArtistMetadata, useArtistsDaily } from "@/services/dataProvider";
import { slugify } from "@/lib/utils";
import type { ChartArtist } from "@/types/chartData";
import type { ArtistMetadata } from "@/services/artistMetadata";

const ACCENT = "#39FF14";
const LIVE_TOURING_API = "https://mexicochart.com/api/touring/concerts";
const SCORE_COMPONENTS = [
  { key: "chart", label: "Ranking", max: 35, helper: "posición diaria" },
  { key: "growth", label: "Streams diarios", max: 30, helper: "Spotify diario" },
  { key: "audience", label: "Audiencia", max: 20, helper: "escala relativa" },
  { key: "social", label: "Fanbase", max: 10, helper: "social + plataformas" },
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
  dailyStreams: number;
  dailyStreamsLabel: string;
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

function scaleSocial(value: number, max: number, points: number): number {
  if (value <= 0 || max <= 0) return 0;
  return clamp(Math.pow(value / max, 0.35) * points, 0, points);
}

function componentWidth(value: number, max: number) {
  if (value <= 0) return "0%";
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function scoreTier(score: number): string {
  if (score >= 80) return "Dominante";
  if (score >= 65) return "Impulso fuerte";
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

function getStreamSnapshot(name: string, stats?: Record<string, KworbStreamSnapshot | null>) {
  return stats?.[name] ?? null;
}

function socialReachFromMeta(meta?: ArtistMetadata): number {
  if (!meta) return 0;
  return (
    meta.tiktokFollowers +
    meta.instagramFollowers +
    meta.youtubeSubscribers +
    meta.facebookFollowers +
    meta.spotifyFollowers * 0.75
  );
}

function scoreArtists(
  artists: ChartArtist[],
  metadata: { byKey: Map<string, ArtistMetadata>; byName: Map<string, ArtistMetadata> },
  tours: ArtistTours[],
  streamStats?: Record<string, KworbStreamSnapshot | null>,
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
  const dailyStreamValues = candidates.map((name) => getStreamSnapshot(name, streamStats)?.dailyStreams ?? 0);
  const maxDailyStreams = Math.max(...dailyStreamValues, 1);
  const maxTouring = Math.max(...tours.map((artist) => artist.events.length), 1);
  const socialValues = candidates.map((name) => {
    const meta = lookupArtistMetadata(undefined, name, metadata.byKey, metadata.byName);
    return socialReachFromMeta(meta);
  });
  const maxSocial = Math.max(...socialValues, 1);

  return candidates
    .map((name) => {
      const key = normalizeName(name);
      const chartArtist = chartMap.get(key);
      const meta = lookupArtistMetadata(undefined, name, metadata.byKey, metadata.byName);
      const tour = tourMap.get(key);
      const listeners = chartArtist?.listenersRaw || meta?.spotifyListeners || 0;
      const dailyStreams = getStreamSnapshot(name, streamStats)?.dailyStreams ?? 0;
      const socialReach = socialReachFromMeta(meta);
      const touringDates = tour?.events.length ?? 0;

      const chartScore = chartArtist && chartArtist.mexicoRank <= 100 ? ((101 - chartArtist.mexicoRank) / 100) * 35 : 0;
      const growthScore = scale(dailyStreams, maxDailyStreams, 30);
      const audienceScore = scale(listeners, maxListeners, 20);
      const socialScore = scaleSocial(socialReach, maxSocial, 10);
      const touringScore = scale(touringDates, maxTouring, 5);
      const score = Math.round(chartScore + growthScore + audienceScore + socialScore + touringScore);

      const reasons = [
        chartArtist ? `#${chartArtist.mexicoRank} en artistas diarios` : "",
        dailyStreams > 0 ? `${compact(dailyStreams)} streams diarios en Spotify` : "",
        listeners > 0 ? `${compact(listeners)} oyentes mensuales` : "",
        socialReach > 0 ? `${compact(socialReach)} alcance de fanbase` : "",
        touringDates > 0 ? `${touringDates === 1 ? "1 fecha activa" : `${touringDates} fechas activas`}` : "",
      ].filter(Boolean);

      return {
        name,
        chartArtist,
        meta,
        listeners,
        dailyStreams,
        dailyStreamsLabel: compact(dailyStreams),
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
    .slice(0, 100);
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

function MomentumRow({ item, index, photoUrl }: { item: MomentumArtist; index: number; photoUrl?: string | null }) {
  const { chartArtist, meta, components } = item;
  const slug = slugify(item.name);
  const genre = meta?.subgenre || chartArtist?.subgenre || chartArtist?.genre;
  const isTopThree = index < 3;
  const rank = index + 1;
  const initial = item.name.trim()[0]?.toUpperCase() ?? "?";

  return (
    <Link href={`/artist/${slug}`}>
      <article
        className="group relative cursor-pointer overflow-hidden border bg-[#080808] transition hover:border-[#39FF14]/35"
        style={{
          borderColor: isTopThree ? "rgba(57,255,20,0.26)" : "rgba(255,255,255,0.08)",
          borderRadius: 8,
          boxShadow: isTopThree ? "0 0 34px rgba(57,255,20,0.06)" : undefined,
        }}
      >
        {isTopThree && <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: ACCENT }} />}
        <div className="grid gap-4 p-4 xl:grid-cols-[152px_1.2fr_1fr_240px] xl:items-center xl:gap-5">
          <div className="flex items-center justify-between gap-4 xl:justify-start xl:gap-5">
            <div className="flex items-center gap-4 xl:gap-5">
              <div className="w-12 text-right text-4xl font-black tabular-nums leading-none text-zinc-200 sm:w-14 xl:w-14">
                {rank}
              </div>
              <div
                className="relative h-14 w-14 flex-shrink-0 overflow-hidden border bg-white/[0.04] sm:h-16 sm:w-16"
                style={{ borderColor: isTopThree ? "rgba(57,255,20,0.28)" : "rgba(255,255,255,0.08)", borderRadius: 8 }}
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={item.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    style={{ filter: "brightness(0.82) saturate(0.78) contrast(1.08)" }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-black text-zinc-500">
                    {initial}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 text-right xl:hidden">
              <div className="text-4xl font-black leading-none" style={{ color: ACCENT }}>
                {item.score}
              </div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">/ 100</div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
              {isTopThree && <Award className="h-3.5 w-3.5" style={{ color: ACCENT }} />}
              {scoreTier(item.score)}
            </div>
            <h2 className="max-w-full break-words text-[1.65rem] font-black uppercase leading-[0.98] tracking-normal text-white group-hover:text-[#39FF14] sm:text-3xl xl:text-[1.65rem]">
              {item.name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              <span>{genre || "Mexico Charts"}</span>
              {chartArtist && <span>#{chartArtist.mexicoRank} artistas diarios</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Diario</div>
              <div className="mt-1 text-sm font-black text-white">{item.dailyStreamsLabel}</div>
            </div>
            <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Audiencia</div>
              <div className="mt-1 text-sm font-black text-white">{compact(item.listeners)}</div>
            </div>
            <div className="border border-white/[0.06] bg-white/[0.025] p-2 max-sm:col-span-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Fanbase</div>
              <div className="mt-1 text-sm font-black text-white">{compact(item.socialReach)}</div>
            </div>
          </div>

          <div>
            <div className="hidden items-end justify-between gap-3 border-t border-white/[0.06] pt-3 xl:flex xl:border-t-0 xl:pt-0">
              <div>
                <div className="text-4xl font-black leading-none" style={{ color: ACCENT }}>
                  {item.score}
                </div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">/ 100</div>
              </div>
              <div className="hidden flex-1 space-y-1.5 xl:block">
                {SCORE_COMPONENTS.slice(0, 3).map((component) => (
                  <ComponentBar
                    key={component.key}
                    label={component.label}
                    value={components[component.key]}
                    max={component.max}
                    helper={component.helper}
                  />
                ))}
              </div>
            </div>
          </div>
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
  const momentumNames = useMemo(
    () => buildCandidateNames(artistsDaily.data, metadata.byKey, touring.data ?? []),
    [artistsDaily.data, metadata.byKey, touring.data],
  );
  const kworbStreams = useBatchKworbStreamStats(momentumNames);
  const artistImages = useArtistImages(momentumNames);

  const momentum = useMemo(
    () =>
      scoreArtists(
        artistsDaily.data,
        { byKey: metadata.byKey, byName: metadata.byName },
        touring.data ?? [],
        kworbStreams.data,
      ),
    [artistsDaily.data, metadata.byKey, metadata.byName, touring.data, kworbStreams.data],
  );

  const leader = momentum[0];
  const leaderImage = leader ? artistImages[leader.name] : null;
  const isLoading = artistsDaily.isLoading || metadata.isLoading || kworbStreams.isLoading;
  const isError = artistsDaily.isError || metadata.isError || kworbStreams.isError;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PageSEO
        title="Mexico Charts Top 100 — MX100"
        description="Ranking editorial de Mexico Charts que mide a los artistas con mayor impacto en la música mexicana a partir de listas, streams diarios, audiencia, fanbase y giras."
        path="/mx100"
      />
      <SiteNav />

      <main>
        <section className="overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(ellipse_at_top,rgba(57,255,20,0.14),transparent_58%),#050505]">
          <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-5 sm:py-14 md:px-8 md:py-18">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ACCENT }}>
              <Activity className="h-4 w-4" />
              MX100
            </div>
            <div className="flex flex-col gap-8">
              <div className="w-full">
                <h1 className="max-w-full text-[2.08rem] font-black uppercase leading-[0.9] tracking-normal text-white sm:text-5xl md:max-w-4xl md:text-6xl">
                  <span className="lg:hidden">
                    <span className="block">Mexico Charts</span>
                    <span className="block">Top</span>
                    <span className="block" style={{ color: ACCENT }}>
                      100
                    </span>
                  </span>
                  <span className="hidden lg:block">
                    Mexico Charts Top <span style={{ color: ACCENT }}>100</span>
                  </span>
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
                  El ranking editorial de Mexico Charts que mide a los artistas con mayor impacto
                  en la música mexicana a partir de listas, streams diarios, audiencia, fanbase y giras
                </p>
                {leader && (
                  <Link href={`/artist/${slugify(leader.name)}`}>
                    <div
                      className="mt-6 max-w-2xl cursor-pointer overflow-hidden border bg-black/30 transition hover:border-[#39FF14]/40 lg:max-w-4xl"
                      style={{ borderColor: "rgba(57,255,20,0.22)", borderRadius: 8 }}
                    >
                      <div className="grid grid-cols-[78px_1fr] sm:grid-cols-[104px_1fr]">
                        <div className="relative min-h-full overflow-hidden bg-white/[0.04]">
                          {leaderImage ? (
                            <img
                              src={leaderImage}
                              alt={leader.name}
                              className="h-full w-full object-cover"
                              style={{ filter: "brightness(0.78) saturate(0.78) contrast(1.1)" }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-3xl font-black text-zinc-600">
                              {leader.name.trim()[0]?.toUpperCase() ?? "?"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 p-4">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                                Líder actual
                              </div>
                              <div className="mt-2 break-words text-[1.55rem] font-black uppercase leading-[0.95] text-white sm:text-2xl md:text-3xl">
                                {leader.name}
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <div className="text-4xl font-black leading-none" style={{ color: ACCENT }}>{leader.score}</div>
                              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">puntos</div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                            <span>{leader.dailyStreamsLabel} diario</span>
                            <span>{compact(leader.socialReach)} fanbase</span>
                            {leader.chartArtist && <span>#{leader.chartArtist.mexicoRank} ranking</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
                <div className="border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4" style={{ borderRadius: 8 }}>
                  <TrendingUp className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                  <div className="text-xl font-black sm:text-2xl">{leader?.dailyStreamsLabel ?? "—"}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Streams líder</div>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4" style={{ borderRadius: 8 }}>
                  <Users className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                  <div className="text-xl font-black sm:text-2xl">{momentum.length || "—"}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Top activo</div>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4" style={{ borderRadius: 8 }}>
                  <CalendarDays className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                  <div className="text-xl font-black sm:text-2xl">{touring.data?.reduce((sum, a) => sum + a.events.length, 0) ?? "—"}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Fechas</div>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4" style={{ borderRadius: 8 }}>
                  <Radio className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                  <div className="text-xl font-black sm:text-2xl">En vivo</div>
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
                  Mexico Charts Top 100 mide a los artistas con mayor impacto desde la base activa de Mexico Charts con un máximo de 100 puntos
                  Streams diarios mide actividad reciente en Spotify y Fanbase combina TikTok, Instagram, YouTube, Facebook y seguidores de Spotify
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
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse bg-white/[0.04]" style={{ borderRadius: 8 }} />
              ))}
            </div>
          )}

          {isError && (
            <div className="border border-red-500/25 bg-red-500/5 p-5 text-sm text-red-200" style={{ borderRadius: 8 }}>
              No se pudo cargar la data del MX100 en este momento.
            </div>
          )}

          {!isLoading && !isError && (
            <div className="space-y-3">
              {momentum.map((item, index) => (
                <MomentumRow
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
