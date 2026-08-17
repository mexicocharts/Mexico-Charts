import { useMemo } from "react";
import { Link } from "wouter";
import { Activity, CalendarDays, Info, Radio, TrendingUp, Users } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { useArtistImages } from "@/hooks/useArtistImages";
import { useChartsHub, type HubRow } from "@/hooks/useChartsHub";
import { useTouring, type ArtistTours } from "@/hooks/useTouring";
import { lookupArtistMetadata, useArtistMetadata, useArtistsDaily, useArtistsWeekly } from "@/services/dataProvider";
import { slugify } from "@/lib/utils";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";
import { genreLabel } from "@/lib/presentationLabels";
import type { ChartArtist } from "@/types/chartData";
import type { ArtistMetadata } from "@/services/artistMetadata";

const ACCENT = "#39FF14";
const SCORE_COMPONENTS = [
  { key: "spotify", label: "Spotify semanal" },
  { key: "youtube", label: "YouTube México" },
  { key: "fanbase", label: "Fanbase" },
  { key: "touring", label: "Giras" },
] as const;

interface Mx100Artist {
  name: string;
  dailyChartArtist?: ChartArtist;
  weeklyChartArtist?: ChartArtist;
  meta?: ArtistMetadata;
  score: number;
  spotifyWeeklyRank?: number;
  youtubeWeeklyRank?: number;
  youtubeWeeklyViews: number;
  youtubeWeeklyViewsLabel: string;
  socialReach: number;
  touringDates: number;
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

function scaleSqrt(value: number, max: number, points: number): number {
  if (value <= 0 || max <= 0) return 0;
  return clamp(Math.sqrt(value / max) * points, 0, points);
}

function scaleSocial(value: number, max: number, points: number): number {
  if (value <= 0 || max <= 0) return 0;
  return clamp(Math.pow(value / max, 0.35) * points, 0, points);
}

function rankScore(rank: number | undefined, maxRank: number, points: number): number {
  if (!rank || rank > maxRank) return 0;
  return ((maxRank + 1 - rank) / maxRank) * points;
}

function rankSort(rank: number | undefined): number {
  return rank ?? 9999;
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

function parseMetric(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, "").trim().toUpperCase();
  if (cleaned.endsWith("B")) return Math.round(parseFloat(cleaned) * 1_000_000_000);
  if (cleaned.endsWith("M")) return Math.round(parseFloat(cleaned) * 1_000_000);
  if (cleaned.endsWith("K")) return Math.round(parseFloat(cleaned) * 1_000);
  return parseInt(cleaned.replace(/[^0-9.-]/g, ""), 10) || 0;
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

function buildCandidateNames(metadata: Map<string, ArtistMetadata>) {
  const names = new Map<string, string>();
  metadata.forEach((meta) => names.set(normalizeName(meta.displayName), meta.displayName));
  return [...names.values()];
}

function socialReachFromMeta(meta?: ArtistMetadata): number {
  if (!meta) return 0;
  return (
    meta.tiktokFollowers +
    meta.instagramFollowers +
    meta.youtubeSubscribers +
    meta.facebookFollowers +
    meta.spotifyFollowers
  );
}

function scoreArtists(
  dailyArtists: ChartArtist[],
  weeklyArtists: ChartArtist[],
  metadata: { byKey: Map<string, ArtistMetadata>; byName: Map<string, ArtistMetadata> },
  tours: ArtistTours[],
  youtubeArtistRows: HubRow[] = [],
  spotifyArtistRows: HubRow[] = [],
): Mx100Artist[] {
  const candidates = buildCandidateNames(metadata.byKey);
  const dailyChartMap = buildChartMap(dailyArtists);
  const weeklyChartMap = buildChartMap(weeklyArtists);
  const youtubeChartMap = buildYoutubeArtistMap(youtubeArtistRows);
  const spotifyChartMap = buildSpotifyArtistMap(spotifyArtistRows);
  const tourMap = buildTouringMap(tours);
  const youtubeWeeklyValues = candidates.map((name) => youtubeChartMap.get(normalizeName(name))?.views ?? 0);
  const maxYoutubeWeeklyViews = Math.max(...youtubeWeeklyValues, 1);
  const maxTouring = Math.max(...tours.map((artist) => artist.events.length), 1);
  const socialValues = candidates.map((name) => {
    const meta = lookupArtistMetadata(undefined, name, metadata.byKey, metadata.byName);
    return socialReachFromMeta(meta);
  });
  const maxSocial = Math.max(...socialValues, 1);
  const spotifyRankMax = 100;

  return candidates
    .map((name) => {
      const key = normalizeName(name);
      const dailyChartArtist = dailyChartMap.get(key);
      const weeklyChartArtist = weeklyChartMap.get(key);
      const spotifyChartArtist = spotifyChartMap.get(key);
      const youtubeChartArtist = youtubeChartMap.get(key);
      const meta = lookupArtistMetadata(undefined, name, metadata.byKey, metadata.byName);
      const tour = tourMap.get(key);
      const spotifyWeeklyRank = spotifyChartArtist?.rank ?? weeklyChartArtist?.mexicoRank;
      const youtubeWeeklyRank = youtubeChartArtist?.rank;
      const youtubeWeeklyViews = youtubeChartArtist?.views ?? 0;
      const socialReach = socialReachFromMeta(meta);
      const touringDates = tour?.events.length ?? 0;

      const spotifyScore = rankScore(spotifyWeeklyRank, spotifyRankMax, 55);
      const youtubeScore = scaleSqrt(youtubeWeeklyViews, maxYoutubeWeeklyViews, 25);
      const fanbaseScore = scaleSocial(socialReach, maxSocial, 12);
      const touringScore = scale(touringDates, maxTouring, 8);
      const score = Math.round(spotifyScore + youtubeScore + fanbaseScore + touringScore);

      const reasons = [
        spotifyWeeklyRank ? `#${spotifyWeeklyRank} en Spotify semanal` : "",
        youtubeWeeklyRank ? `#${youtubeWeeklyRank} en YouTube artistas` : "",
        youtubeWeeklyViews > 0 ? `${compact(youtubeWeeklyViews)} vistas semanales en México` : "",
        socialReach > 0 ? `${compact(socialReach)} fanbase` : "",
        touringDates > 0 ? `${touringDates === 1 ? "1 fecha activa" : `${touringDates} fechas activas`}` : "",
      ].filter(Boolean);

      return {
        name,
        dailyChartArtist,
        weeklyChartArtist,
        meta,
        spotifyWeeklyRank,
        youtubeWeeklyRank,
        youtubeWeeklyViews,
        youtubeWeeklyViewsLabel: compact(youtubeWeeklyViews),
        score,
        socialReach,
        touringDates,
        reasons,
      };
    })
    .filter((artist) => artist.score > 0)
    .sort((a, b) => (
      b.score - a.score ||
      rankSort(a.spotifyWeeklyRank) - rankSort(b.spotifyWeeklyRank) ||
      rankSort(a.youtubeWeeklyRank) - rankSort(b.youtubeWeeklyRank) ||
      b.youtubeWeeklyViews - a.youtubeWeeklyViews ||
      b.socialReach - a.socialReach
    ))
    .slice(0, 100);
}

function Mx100Row({ item, index, photoUrl }: { item: Mx100Artist; index: number; photoUrl?: string | null }) {
  const { dailyChartArtist, meta } = item;
  const slug = slugify(item.name);
  const rawGenre = meta?.subgenre || dailyChartArtist?.subgenre || dailyChartArtist?.genre;
  const genre = rawGenre ? genreLabel(rawGenre) : "";
  const isTopThree = index < 3;
  const rank = index + 1;
  const initial = item.name.trim()[0]?.toUpperCase() ?? "?";

  return (
    <Link href={canonicalArtistHref(meta?.artistKey ?? item.name) ?? "/artists"}>
      <article
        className="group relative cursor-pointer overflow-hidden border bg-[#080808] transition hover:border-[#39FF14]/35"
        style={{
          borderColor: isTopThree ? "rgba(57,255,20,0.26)" : "rgba(255,255,255,0.08)",
          borderRadius: 8,
          boxShadow: isTopThree ? "0 0 34px rgba(57,255,20,0.06)" : undefined,
        }}
      >
        {isTopThree && <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: ACCENT }} />}
        <div className="grid gap-4 p-4 xl:grid-cols-[152px_1.2fr_1.35fr] xl:items-center xl:gap-5">
          <div className="flex items-center gap-4 xl:gap-5">
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
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
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
          </div>

          <div className="min-w-0">
            <h2 className="max-w-full break-words text-[1.65rem] font-black uppercase leading-[0.98] tracking-normal text-white group-hover:text-[#39FF14] sm:text-3xl xl:text-[1.65rem]">
              {item.name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              <span>{genre || "Mexico Charts"}</span>
              {item.spotifyWeeklyRank && <span>Spotify #{item.spotifyWeeklyRank}</span>}
              {item.youtubeWeeklyRank && <span>YouTube #{item.youtubeWeeklyRank}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">YouTube MX</div>
              <div className="mt-1 text-sm font-black text-white">{item.youtubeWeeklyViewsLabel}</div>
            </div>
            <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Spotify MX</div>
              <div className="mt-1 text-sm font-black text-white">{item.spotifyWeeklyRank ? `#${item.spotifyWeeklyRank}` : "—"}</div>
            </div>
            <div className="border border-white/[0.06] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Fanbase</div>
              <div className="mt-1 text-sm font-black text-white">{compact(item.socialReach)}</div>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function Mx100() {
  const artistsDaily = useArtistsDaily();
  const artistsWeekly = useArtistsWeekly();
  const metadata = useArtistMetadata();
  const touring = useTouring();
  const chartsHub = useChartsHub({ retry: 2 });
  const mx100Names = useMemo(
    () => buildCandidateNames(metadata.byKey),
    [metadata.byKey],
  );
  const artistImages = useArtistImages(mx100Names);

  const mx100 = useMemo(
    () =>
      scoreArtists(
        artistsDaily.data,
        artistsWeekly.data,
        { byKey: metadata.byKey, byName: metadata.byName },
        touring.data ?? [],
        chartsHub.data?.sheets?.YT_Artists_Weekly?.rows ?? [],
        chartsHub.data?.sheets?.Spotify_Artists_Weekly?.rows ?? [],
      ),
    [artistsDaily.data, artistsWeekly.data, metadata.byKey, metadata.byName, touring.data, chartsHub.data],
  );

  const leader = mx100[0];
  const leaderImage = leader ? artistImages[leader.name] : null;
  const isLoading = artistsDaily.isLoading || artistsWeekly.isLoading || metadata.isLoading || chartsHub.isLoading;
  const isError = artistsDaily.isError || artistsWeekly.isError || metadata.isError || chartsHub.isError;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PageSEO
        title="Mexico Charts Top 100 — MX100"
        description="Ranking editorial de Mexico Charts que mide a los artistas más exitosos de la música mexicana a partir de Spotify semanal, YouTube México, fanbase y giras."
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
                  El ranking editorial de Mexico Charts que mide a los artistas más exitosos
                  de la música mexicana a partir de Spotify semanal, YouTube México, fanbase y giras
                </p>
                {leader && (
                  <Link href={canonicalArtistHref(leader.meta?.artistKey ?? leader.name) ?? "/artists"}>
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
                          <div className="min-w-0">
                            <div className="min-w-0">
                              <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                                Líder actual
                              </div>
                              <div className="mt-2 break-words text-[1.55rem] font-black uppercase leading-[0.95] text-white sm:text-2xl md:text-3xl">
                                {leader.name}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                            {leader.spotifyWeeklyRank && <span>Spotify #{leader.spotifyWeeklyRank}</span>}
                            {leader.youtubeWeeklyRank && <span>YouTube #{leader.youtubeWeeklyRank}</span>}
                            <span>{leader.youtubeWeeklyViewsLabel} YouTube MX</span>
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
                  <div className="text-xl font-black sm:text-2xl">{leader?.youtubeWeeklyViewsLabel ?? "—"}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">YouTube México</div>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4" style={{ borderRadius: 8 }}>
                  <Users className="mb-3 h-5 w-5" style={{ color: ACCENT }} />
                  <div className="text-xl font-black sm:text-2xl">{mx100.length || "—"}</div>
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
                  Ranking calculado entre los artistas mexicanos actualmente monitoreados por Mexico Charts. No representa necesariamente la totalidad de artistas mexicanos. El consumo manda con Spotify semanal México y vistas semanales de YouTube México, con fanbase y giras como señales secundarias.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SCORE_COMPONENTS.map((component) => (
                  <div
                    key={component.key}
                    className="border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400"
                    style={{ borderRadius: 6 }}
                  >
                    <span className="text-white">{component.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-3" aria-busy="true" aria-label="Cargando ranking MX100">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse bg-white/[0.04]" style={{ borderRadius: 8 }} />
              ))}
            </div>
          )}

          {isError && (
            <div className="border border-red-500/20 bg-red-500/[0.045] p-5" style={{ borderRadius: 8 }} role="status">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-200">
                MX100 temporalmente no disponible
              </div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                No pudimos actualizar el ranking en este momento. La página mantiene su estructura y volverá a mostrar el listado cuando la fuente responda.
              </p>
            </div>
          )}

          {!isLoading && !isError && mx100.length === 0 && (
            <div className="border border-white/[0.08] bg-white/[0.025] p-5 text-sm leading-6 text-zinc-500" style={{ borderRadius: 8 }}>
              Aún no hay suficientes señales activas para construir el MX100.
            </div>
          )}

          {!isLoading && !isError && mx100.length > 0 && (
            <div className="space-y-3">
              {mx100.map((item, index) => (
                <Mx100Row
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
