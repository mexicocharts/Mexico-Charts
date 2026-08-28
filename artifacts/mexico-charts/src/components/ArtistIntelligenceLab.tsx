import { useMemo, useState } from "react";
import { BarChart3, Disc3, MapPin, Radar, Sparkles } from "lucide-react";
import type {
  SongstatsArtistData,
  SongstatsMetricGrowth,
  SongstatsTrendPoint,
} from "@/hooks/useSongstatsArtist";

type IntelligenceTab = "audience" | "catalog" | "conversion" | "impact";

const TABS: Array<{ key: IntelligenceTab; label: string; icon: typeof MapPin }> = [
  { key: "audience", label: "Audience Atlas", icon: MapPin },
  { key: "catalog", label: "Catalog Pulse", icon: Disc3 },
  { key: "conversion", label: "Conversion Lab", icon: Radar },
  { key: "impact", label: "Release Impact", icon: Sparkles },
];

function compact(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function percentage(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function releaseTypeLabel(value: string) {
  if (value === "album") return "Álbum";
  if (value === "single") return "Single";
  if (value === "ep") return "EP";
  if (value === "track") return "Canción";
  return "Lanzamiento";
}

function normalizedSeries(points: SongstatsTrendPoint[]) {
  const first = points[0]?.value;
  if (!first || points.length < 2) return [];
  return points.map(point => ({ ...point, value: ((point.value - first) / first) * 100 }));
}

function sparklinePath(points: SongstatsTrendPoint[], width = 520, height = 150) {
  if (points.length < 2) return "";
  const values = points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  return points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / spread) * (height - 16) - 8;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function strongestGrowth(growth: SongstatsArtistData["growth"]) {
  const candidates: Array<{ label: string; growth?: SongstatsMetricGrowth }> = [
    { label: "Spotify", growth: growth.spotifyMonthlyListeners },
    { label: "Instagram", growth: growth.instagramFollowers },
    { label: "TikTok", growth: growth.tiktokFollowers },
    { label: "YouTube", growth: growth.youtubeSubscribers },
  ];
  return candidates
    .filter(item => item.growth?.days30?.percentage != null)
    .sort((a, b) => (b.growth?.days30?.percentage ?? -Infinity) - (a.growth?.days30?.percentage ?? -Infinity))[0] ?? null;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 px-6 text-center">
      <BarChart3 className="mb-4 h-7 w-7 text-zinc-700" />
      <h4 className="text-sm font-black text-zinc-300">{title}</h4>
      <p className="mt-2 max-w-md text-xs font-medium leading-5 text-zinc-600">{body}</p>
    </div>
  );
}

export default function ArtistIntelligenceLab({
  artistName,
  data,
}: {
  artistName: string;
  data: SongstatsArtistData | null | undefined;
}) {
  const [activeTab, setActiveTab] = useState<IntelligenceTab>("audience");
  const cities = data?.topMexicoCities ?? [];
  const maxCity = Math.max(cities[0]?.currentListeners ?? 0, 1);
  const strongest = useMemo(() => strongestGrowth(data?.growth ?? {}), [data]);
  const conversionSeries = useMemo(() => {
    if (!data) return [];
    return [
      { key: "spotify", label: "Spotify", color: "#39FF14", points: normalizedSeries(data.trends.spotifyMonthlyListeners ?? []) },
      { key: "instagram", label: "Instagram", color: "#E1306C", points: normalizedSeries(data.trends.instagramFollowers ?? []) },
      { key: "tiktok", label: "TikTok", color: "#d4d4d8", points: normalizedSeries(data.trends.tiktokFollowers ?? []) },
      { key: "youtube", label: "YouTube", color: "#ef4444", points: normalizedSeries(data.trends.youtubeSubscribers ?? []) },
    ].filter(series => series.points.length >= 2);
  }, [data]);
  const conversionReady = conversionSeries.length >= 2;
  const catalog = data?.catalog;
  const impact = data?.latestReleaseImpact;

  if (!data) {
    return (
      <section data-testid="section-artist-intelligence" className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#111] via-[#090909] to-[#050505] p-4 shadow-2xl sm:p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#39FF14]/40 to-transparent" />
        <div className="relative">
          <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#39FF14]">Mexico Charts Intelligence</div>
          <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">Intelligence Lab</h2>
          <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-zinc-500">Audiencia, catálogo y conversión digital de {artistName}.</p>
          <div className="mt-5">
            <EmptyState title="Estamos preparando la inteligencia de este perfil" body="Las señales aparecerán automáticamente cuando exista una observación Songstats verificada. No mostramos valores estimados ni ceros para datos que todavía no están disponibles." />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-testid="section-artist-intelligence" className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#111] via-[#090909] to-[#050505] p-4 shadow-2xl sm:p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#39FF14]/50 to-transparent" />
      <div className="relative">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.24em] text-[#39FF14]">Mexico Charts Intelligence</div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">Intelligence Lab</h2>
            <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-zinc-500">
              Audiencia, catálogo y conversión digital de {artistName}, calculados con las señales disponibles del perfil.
            </p>
          </div>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-700">
            Actualizado {data.snapshot.snapshotDate ?? "sin fecha"}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="Inteligencia del artista">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.key)}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-black transition ${selected ? "border-[#39FF14]/55 bg-[#39FF14]/10 text-white" : "border-white/[0.07] bg-white/[0.025] text-zinc-500 hover:border-white/20 hover:text-zinc-200"}`}
              >
                <Icon className={`h-3.5 w-3.5 ${selected ? "text-[#39FF14]" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {activeTab === "audience" && (cities.length ? (
            <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-black text-white">Audience Atlas</h3><p className="mt-1 text-[10px] font-bold text-zinc-600">Principales ciudades mexicanas · audiencia mensual de Spotify</p></div>
                  <MapPin className="h-5 w-5 text-[#39FF14]/70" />
                </div>
                <div className="mt-5 space-y-3">
                  {cities.map((city, index) => (
                    <div key={`${city.name}-${city.region ?? ""}`} className="grid grid-cols-[minmax(84px,1fr)_2fr_auto] items-center gap-3 text-[10px]">
                      <div className="min-w-0"><div className="truncate font-black text-zinc-300">{city.name}</div><div className="truncate text-[8px] font-bold uppercase tracking-wider text-zinc-700">{city.region ?? "México"}</div></div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-[#1d7c37] to-[#39FF14]" style={{ width: `${Math.max(5, (city.currentListeners / maxCity) * 100)}%` }} /></div>
                      <div className="text-right"><div className="font-black text-white">{compact(city.currentListeners)}</div><div className="text-[8px] text-[#39FF14]/60">#{index + 1}</div></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 sm:p-5">
                <h3 className="text-sm font-black text-white">Lectura de mercado</h3>
                <p className="mt-1 text-[10px] font-bold text-zinc-600">Señales disponibles en este perfil</p>
                <div className="mt-5 space-y-4">
                  <div><div className="text-[9px] font-black uppercase tracking-wider text-zinc-700">Mercado principal observado</div><div className="mt-1 text-xl font-black text-white">{cities[0]?.name}</div></div>
                  <div><div className="text-[9px] font-black uppercase tracking-wider text-zinc-700">Oyentes en top 5 MX</div><div className="mt-1 text-xl font-black text-[#39FF14]">{compact(cities.reduce((sum, city) => sum + city.currentListeners, 0))}</div></div>
                  <div><div className="text-[9px] font-black uppercase tracking-wider text-zinc-700">Mayor crecimiento 30d</div><div className="mt-1 text-sm font-black text-white">{strongest ? `${strongest.label} · ${percentage(strongest.growth?.days30?.percentage)}` : "Recopilando historial"}</div></div>
                </div>
              </div>
            </div>
          ) : <EmptyState title="Audience Atlas está recopilando datos" body="Aparecerá automáticamente cuando Songstats entregue ciudades verificadas para este artista. Un dato ausente nunca se representa como cero." />)}

          {activeTab === "catalog" && (catalog?.releaseCount ? (
            <div className="grid gap-4 lg:grid-cols-[.75fr_1.25fr]">
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 sm:p-5">
                <h3 className="text-sm font-black text-white">Catalog Pulse</h3>
                <p className="mt-1 text-[10px] font-bold text-zinc-600">Actividad del catálogo guardado</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-xl font-black text-white">{catalog.releaseCount}</div><div className="mt-1 text-[8px] font-black uppercase tracking-wider text-zinc-700">Lanzamientos</div></div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-xl font-black text-[#39FF14]">{catalog.releasesLast90Days}</div><div className="mt-1 text-[8px] font-black uppercase tracking-wider text-zinc-700">Últimos 90d</div></div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-xl font-black text-white">{catalog.albumCount}</div><div className="mt-1 text-[8px] font-black uppercase tracking-wider text-zinc-700">Álbumes</div></div>
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"><div className="text-xl font-black text-white">{catalog.medianReleaseGapDays == null ? "—" : `${catalog.medianReleaseGapDays}d`}</div><div className="mt-1 text-[8px] font-black uppercase tracking-wider text-zinc-700">Intervalo mediano</div></div>
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 sm:p-5">
                <div className="flex items-center justify-between"><h3 className="text-sm font-black text-white">Lanzamientos recientes</h3><Disc3 className="h-5 w-5 text-[#39FF14]/70" /></div>
                <div className="mt-3 divide-y divide-white/[0.06]">
                  {catalog.releases.slice(0, 6).map(release => (
                    <div key={release.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                      <div className="min-w-0"><div className="truncate text-xs font-black text-zinc-200">{release.title}</div><div className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-700">{releaseTypeLabel(release.type)}{release.platformCount > 0 ? ` · ${release.platformCount} plataformas` : ""}</div></div>
                      <div className="text-[9px] font-black text-zinc-500">{dateLabel(release.releaseDate)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : <EmptyState title="Catalog Pulse está recopilando datos" body="El catálogo licenciado todavía no está disponible para este perfil. Cuando llegue una observación guardada, se mostrarán automáticamente la frecuencia, profundidad y actividad reciente." />)}

          {activeTab === "conversion" && (conversionReady ? (
            <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 sm:p-5">
                <h3 className="text-sm font-black text-white">Conversión entre plataformas</h3>
                <p className="mt-1 text-[10px] font-bold text-zinc-600">Cambio relativo desde el primer punto disponible · no compara tamaños absolutos</p>
                <svg viewBox="0 0 520 150" className="mt-5 h-44 w-full" role="img" aria-label="Tendencias normalizadas entre plataformas">
                  {[1, 2, 3].map(line => <line key={line} x1="0" x2="520" y1={line * 37.5} y2={line * 37.5} stroke="rgba(255,255,255,.06)" />)}
                  {conversionSeries.map(series => <polyline key={series.key} points={sparklinePath(series.points)} fill="none" stroke={series.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
                </svg>
                <div className="flex flex-wrap gap-4">{conversionSeries.map(series => <span key={series.key} className="flex items-center gap-1.5 text-[9px] font-black text-zinc-500"><i className="h-1.5 w-1.5 rounded-full" style={{ background: series.color }} />{series.label}</span>)}</div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 sm:p-5">
                <h3 className="text-sm font-black text-white">Lectura actual</h3>
                <div className="mt-5 text-5xl font-black text-[#39FF14]">{conversionSeries.length}/4</div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">plataformas comparables</div>
                <div className="mt-6 border-t border-white/[0.07] pt-4 text-xs font-medium leading-5 text-zinc-500">La puntuación de conversión se activará cuando exista suficiente historial diario coincidente para medir retrasos y retención sin inventar causalidad.</div>
              </div>
            </div>
          ) : <EmptyState title="Conversion Lab está recopilando historial" body="Se necesitan al menos dos plataformas con suficientes fechas coincidentes. Las líneas y puntuaciones aparecerán automáticamente cuando la comparación sea confiable." />)}

          {activeTab === "impact" && (impact ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 sm:p-5">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#39FF14]">Último lanzamiento medible</div>
                <h3 className="mt-2 text-xl font-black text-white">{impact.release.title}</h3>
                <p className="mt-1 text-[10px] font-bold text-zinc-600">{releaseTypeLabel(impact.release.type)} · {dateLabel(impact.release.releaseDate)}</p>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[["7 días", impact.lift7], ["30 días", impact.lift30], ["90 días", impact.lift90]].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3"><div className={`text-lg font-black ${typeof value === "number" && value > 0 ? "text-[#39FF14]" : "text-white"}`}>{percentage(value as number | null)}</div><div className="mt-1 text-[8px] font-black uppercase tracking-wider text-zinc-700">{label}</div></div>
                  ))}
                </div>
                <p className="mt-4 text-[9px] font-medium leading-4 text-zinc-700">Cambio promedio entre las plataformas con historial anterior y posterior suficiente. Asociación temporal; no afirma causalidad.</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/25 p-4 sm:p-5">
                <h3 className="text-sm font-black text-white">Release Impact Score</h3>
                <div className="mt-5 text-6xl font-black leading-none text-[#39FF14]">{impact.score ?? "—"}</div>
                <div className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">{impact.score == null ? "Recopilando ventana posterior" : "Puntuación Mexico Charts · 0–100"}</div>
                <div className="mt-6 border-t border-white/[0.07] pt-4 text-xs font-medium leading-5 text-zinc-500"><b className="text-zinc-300">Confianza: </b>{impact.confidence === "high" ? "Alta" : impact.confidence === "medium" ? "Media" : "En recopilación"}<br /><b className="text-zinc-300">Plataformas medidas: </b>{impact.platformsMeasured}</div>
              </div>
            </div>
          ) : <EmptyState title="Release Impact está esperando historial compatible" body="Se necesita al menos un lanzamiento fechado y observaciones anteriores y posteriores. La puntuación aparecerá automáticamente cuando la ventana sea suficiente." />)}
        </div>

        <p className="mt-4 text-[8px] font-bold leading-4 text-zinc-700">Las métricas directas proceden de fuentes licenciadas. Las lecturas, comparaciones y futuras puntuaciones son cálculos de Mexico Charts.</p>
      </div>
    </section>
  );
}
