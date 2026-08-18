import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { SiApplemusic, SiSpotify, SiYoutube } from "react-icons/si";
import { MdMusicNote } from "react-icons/md";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { useLanguage } from "@/i18n/LanguageContext";

const G = "#39FF14";
type Row = Record<string, string>;
type Sheet = { rows: Row[]; chartDate?: string | null; fetchedAt?: string | null };
type Hub = { sheets: Record<string, Sheet> };
type ComparisonEntry = { rank: number; previousRank: number | null; movement: number | null; debut: boolean; row: Row };
type WeeklySummary = { charts: Array<{ chartKey: string; chartDate: string; comparisonReady: boolean; mexicanEntries: ComparisonEntry[]; climbers: ComparisonEntry[] }> };
type PlatformKey = "spotify" | "youtube" | "apple" | "deezer";

const platforms = [
  { id: "spotify" as const, label: "Spotify", Icon: SiSpotify, color: "#1DB954", sheet: "Spotify_Artists_Weekly", artist: "Artist", title: "Artist" },
  { id: "youtube" as const, label: "YouTube", Icon: SiYoutube, color: "#ff3434", sheet: "YT_Artists_Weekly", artist: "Artist Name", title: "Artist Name" },
  { id: "apple" as const, label: "Apple Music", Icon: SiApplemusic, color: "#fa5264", sheet: "Apple_Albums", artist: "Artist Names", title: "Title" },
  { id: "deezer" as const, label: "Deezer", Icon: MdMusicNote, color: "#a855f7", sheet: "Deezer_Top_Mexico", artist: "Artist", title: "Title" },
];

function mexican(row: Row) { return /^(true|yes|1)$/i.test(row["Contains Mexican Artist"] ?? ""); }
function rank(row: Row, index: number) { return Number.parseInt(row.Rank ?? row.rank ?? "", 10) || index + 1; }
function firstArtist(value = "") { return value.split(/\s*(?:,|&|\/| feat\.| ft\.| x | y )\s*/i)[0]?.trim() || value; }
function dateLabel(value?: string | null) {
  if (!value) return "Edición actual";
  return new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

export default function WeeklyCharts() {
  const { pick } = useLanguage();
  const [active, setActive] = useState<PlatformKey>("spotify");
  const platform = platforms.find(item => item.id === active)!;
  const hub = useQuery<Hub>({ queryKey: ["charts-hub"], queryFn: async () => { const response = await fetch("/api/charts/hub", { cache: "no-store" }); if (!response.ok) throw new Error("Charts unavailable"); return response.json(); }, staleTime: 60_000 });
  const weekly = useQuery<WeeklySummary>({ queryKey: ["weekly-editorial"], queryFn: async () => { const response = await fetch("/api/charts/editorial/weekly"); if (!response.ok) throw new Error("Weekly summary unavailable"); return response.json(); }, staleTime: 15 * 60_000 });
  const rows = useMemo(() => (hub.data?.sheets[platform.sheet]?.rows ?? []).filter(mexican).slice(0, 10), [hub.data, platform.sheet]);
  const comparison = weekly.data?.charts.find(chart => chart.chartKey === platform.sheet);
  const leader = rows[0];
  const leaderName = leader ? firstArtist(leader[platform.artist]) : "—";
  const secondaryEntry = comparison?.comparisonReady
    ? comparison.climbers.find(entry => mexican(entry.row))
    : undefined;
  const secondary = secondaryEntry?.row ?? rows[1];
  const secondaryName = secondary ? firstArtist(secondary[platform.artist]) : "—";
  const names = useMemo(() => [...new Set(rows.map(row => firstArtist(row[platform.artist])).filter(Boolean))], [rows, platform.artist]);
  const images = useQuery<Record<string, string | null>>({
    queryKey: ["weekly-chart-images", names.join("|")],
    queryFn: async () => { if (!names.length) return {}; const response = await fetch(`/api/spotify/artist-images?names=${encodeURIComponent(names.join(","))}`); return response.ok ? response.json() : {}; },
    enabled: names.length > 0, staleTime: 30 * 60_000,
  });
  const chartDate = hub.data?.sheets[platform.sheet]?.chartDate;
  const loading = hub.isLoading;

  return <div className="min-h-screen bg-[#050505] text-white">
    <PageSEO title={pick("Esta semana — artistas mexicanos en las listas", "This week — Mexican artists on the charts")} description={pick("Los artistas mexicanos destacados esta semana en Spotify, YouTube, Apple Music y Deezer.", "Mexican artists highlighted this week on Spotify, YouTube, Apple Music and Deezer.")} path="/esta-semana" />
    <SiteNav />
    <main className="mx-auto max-w-[1380px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <header className="grid gap-7 border-b border-white/10 pb-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}mexico-charts-logo.png`} alt="Mexico Charts" className="h-11 w-11 object-contain" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>Mexico Charts · Editorial</span>
          </div>
          <h1 className="mt-6 text-[clamp(3.6rem,10vw,9rem)] font-black uppercase leading-[0.82] tracking-[-0.07em]">Esta<br/><span style={{ color: G }}>semana</span></h1>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">{pick("Los mexicanos que están marcando las listas oficiales, plataforma por plataforma.", "The Mexican artists making their mark on the official charts, platform by platform.")}</p>
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{dateLabel(chartDate)}</div>
      </header>

      <div className="my-7 flex flex-wrap gap-2" role="tablist" aria-label={pick("Plataforma", "Platform")}>
        {platforms.map(item => <button key={item.id} type="button" role="tab" aria-selected={active === item.id} onClick={() => setActive(item.id)} className="flex items-center gap-2 border px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] transition" style={{ borderColor: active === item.id ? item.color : "rgba(255,255,255,.12)", background: active === item.id ? item.color : "transparent", color: active === item.id ? "#050505" : "rgba(255,255,255,.62)" }}><item.Icon className="h-4 w-4" />{item.label}</button>)}
      </div>

      {loading ? <div className="grid gap-4 lg:grid-cols-[1.35fr_.85fr]">{[1,2].map(i => <div key={i} className="h-[420px] animate-pulse bg-white/[.04]" />)}</div> : !leader ? <div className="border border-white/10 p-10 text-zinc-500">{pick("No hay entradas mexicanas verificadas en esta edición.", "There are no verified Mexican entries in this edition.")}</div> : <>
        <section className="grid gap-4 lg:grid-cols-[1.35fr_.85fr]">
          <article className="overflow-hidden border border-white/10 bg-[#0b0b0b]">
            <div className="h-[280px] overflow-hidden bg-white/[.04] sm:h-[360px]">{images.data?.[leaderName] ? <img src={images.data[leaderName]!} alt={leaderName} className="h-full w-full object-cover object-top" /> : null}</div>
            <div className="p-6 sm:p-8">
              <div className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: platform.color }}>{pick("Artista mexicano destacado", "Featured Mexican artist")}</div>
              <div className="mt-5 text-sm font-black uppercase text-zinc-500">#{rank(leader, 0)} {pick("en México", "in Mexico")}</div>
              <h2 className="mt-2 text-[clamp(2.5rem,7vw,5.5rem)] font-black uppercase leading-[.88] tracking-[-.05em]">{leaderName}</h2>
              {leader[platform.title] !== leader[platform.artist] && <p className="mt-4 text-base text-zinc-400">{leader[platform.title]}</p>}
            </div>
          </article>
          <article className="flex flex-col border border-white/10 bg-[#0b0b0b] p-6 sm:p-8">
            <div className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: platform.color }}>{secondaryEntry ? pick("Mayor ascenso mexicano", "Biggest Mexican climber") : pick("Siguiente mexicano", "Next Mexican artist")}</div>
            <div className="mt-8 aspect-[4/3] overflow-hidden bg-white/[.04]">{images.data?.[secondaryName] ? <img src={images.data[secondaryName]!} alt={secondaryName} className="h-full w-full object-cover object-top" /> : null}</div>
            <div className="mt-auto pt-7">
              <div className="text-5xl font-black" style={{ color: platform.color }}>{secondaryEntry ? `+${secondaryEntry.movement}` : `#${secondary ? rank(secondary, 1) : "—"}`}</div>
              <h3 className="mt-3 text-3xl font-black uppercase leading-none">{secondaryName}</h3>
              {secondary && secondary[platform.title] !== secondary[platform.artist] && <p className="mt-3 text-sm text-zinc-500">{secondary[platform.title]}</p>}
            </div>
          </article>
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-[-.04em]">Top mexicano</h2>
            <div className="mt-5 border-t border-white/10">
              {rows.map((row, index) => { const name = firstArtist(row[platform.artist]); return <div key={`${name}-${index}`} className="grid grid-cols-[46px_48px_minmax(0,1fr)] items-center gap-4 border-b border-white/10 py-4"><span className="text-xl font-black text-zinc-500">{String(rank(row,index)).padStart(2,"0")}</span><div className="h-12 w-12 overflow-hidden bg-white/[.04]">{images.data?.[name] && <img src={images.data[name]!} alt="" className="h-full w-full object-cover object-top" />}</div><div className="min-w-0"><div className="truncate font-black uppercase">{name}</div>{row[platform.title] !== row[platform.artist] && <div className="mt-1 truncate text-xs text-zinc-500">{row[platform.title]}</div>}</div></div>; })}
            </div>
          </div>
          <aside>
            <h2 className="text-3xl font-black uppercase tracking-[-.04em]">{pick("Datos de esta edición", "Edition details")}</h2>
            <div className="mt-5 space-y-3 border border-white/10 p-6 text-sm text-zinc-400">
              <p><strong className="text-white">{platform.label}</strong> · México</p>
              <p>{rows.length} {pick("entradas con participación mexicana verificada entre las primeras posiciones disponibles.", "entries with verified Mexican participation among the available leading positions.")}</p>
              <p>{comparison?.comparisonReady ? pick("Los movimientos comparan ediciones oficiales guardadas; no se estiman posiciones.", "Movements compare saved official editions; positions are never estimated.") : pick("Los movimientos aparecerán cuando exista una segunda edición comparable.", "Movements will appear after a second comparable edition exists.")}</p>
              <Link href={`/charts?platform=${encodeURIComponent(platform.label)}&sheet=${platform.sheet}`}><span className="mt-4 inline-block font-black uppercase tracking-[.16em]" style={{ color: G }}>{pick("Abrir lista completa", "Open full chart")} →</span></Link>
            </div>
          </aside>
        </section>
      </>}
    </main>
  </div>;
}
