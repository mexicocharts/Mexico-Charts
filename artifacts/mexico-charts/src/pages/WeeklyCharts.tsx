import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { toPng } from "html-to-image";
import { Download, ExternalLink } from "lucide-react";
import { SiApplemusic, SiSpotify, SiYoutube } from "react-icons/si";
import { MdMusicNote } from "react-icons/md";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { useLanguage } from "@/i18n/LanguageContext";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";
import { exportSafeImageUrl, prepareWeeklyCardForExport, weeklyCardRenderOptions } from "@/lib/weeklyCardExport.mjs";

const G = "#39FF14";
type Row = Record<string, string>;
type Hub = { sheets: Record<string, { rows: Row[]; chartDate?: string | null }> };
type Entry = { rank: number; previousRank: number | null; movement: number | null; debut: boolean; row: Row };
type Summary = { editionDate: string | null; charts: Array<{ chartKey: string; chartDate: string; previousChartDate: string | null; comparisonReady: boolean; mexicanEntries: Entry[]; climbers: Entry[]; debuts: Entry[] }> };
type Platform = "spotify" | "youtube" | "apple" | "deezer";
type Mode = "artists" | "songs" | "albums";

const providers = [
  { id: "spotify" as const, label: "Spotify", Icon: SiSpotify, color: "#1DB954" },
  { id: "youtube" as const, label: "YouTube", Icon: SiYoutube, color: "#ff3434" },
  { id: "apple" as const, label: "Apple Music", Icon: SiApplemusic, color: "#fa5264" },
  { id: "deezer" as const, label: "Deezer", Icon: MdMusicNote, color: "#a855f7" },
];
const charts: Record<Platform, Partial<Record<Mode, { sheet: string; artist: string; title: string; urls: string[] }>>> = {
  spotify: { artists: { sheet: "Spotify_Artists_Weekly", artist: "Artist", title: "Artist", urls: ["URL", "Artist URL"] }, songs: { sheet: "Spotify_Regional_Weekly", artist: "Artist", title: "Track Name", urls: ["URL", "Track URL"] } },
  youtube: { artists: { sheet: "YT_Artists_Weekly", artist: "Artist Name", title: "Artist Name", urls: ["YouTube URL", "URL"] }, songs: { sheet: "YT_Songs_Weekly", artist: "Artist Name", title: "Song Name", urls: ["YouTube URL", "URL"] } },
  apple: { songs: { sheet: "Apple_Songs", artist: "Artist Names", title: "Title", urls: ["URL", "Content URL", "Track URL"] }, albums: { sheet: "Apple_Albums", artist: "Artist Names", title: "Title", urls: ["URL", "Content URL", "Album URL"] } },
  deezer: { songs: { sheet: "Deezer_Top_Mexico", artist: "Artist", title: "Title", urls: ["Track Link", "URL"] } },
};
const modeLabels: Record<Mode, [string, string]> = { artists: ["Artistas", "Artists"], songs: ["Canciones", "Songs"], albums: ["Álbumes", "Albums"] };
const isMexican = (row: Row) => /^(true|yes|1)$/i.test(row["Contains Mexican Artist"] ?? "");
const rowRank = (row: Row, index: number) => Number.parseInt(row.Rank ?? row.rank ?? row.Position ?? "", 10) || index + 1;
const firstArtist = (value = "") => value.split(/\s*(?:,|&|\/| feat\.| ft\.| x | y )\s*/i)[0]?.trim() || value;
const mexicanName = (row: Row, fallback = "") => firstArtist(row["Matched Mexican Artists"] || fallback);
const formatDate = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "Edición actual";
const sourceUrl = (row: Row, keys: string[]) => keys.map(key => row[key]).find(value => /^https?:\/\//i.test(value ?? "")) ?? null;

export default function WeeklyCharts() {
  const { pick } = useLanguage();
  const [, params] = useRoute("/esta-semana/:date");
  const requestedDate = params?.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  const [platformId, setPlatformId] = useState<Platform>("spotify");
  const [mode, setMode] = useState<Mode>("artists");
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const provider = providers.find(item => item.id === platformId)!;
  const modes = Object.keys(charts[platformId]) as Mode[];
  const activeMode = modes.includes(mode) ? mode : modes[0];
  const chart = charts[platformId][activeMode]!;
  const hub = useQuery<Hub>({ queryKey: ["charts-hub"], queryFn: async () => { const r = await fetch("/api/charts/hub", { cache: "no-store" }); if (!r.ok) throw new Error(); return r.json(); }, staleTime: 60_000 });
  const weekly = useQuery<Summary>({ queryKey: ["weekly-editorial", requestedDate], queryFn: async () => { const r = await fetch(`/api/charts/editorial/weekly${requestedDate ? `?date=${requestedDate}` : ""}`); if (!r.ok) throw new Error(); return r.json(); }, staleTime: 15 * 60_000 });
  const comparison = weekly.data?.charts.find(item => item.chartKey === chart.sheet);
  const liveRows = hub.data?.sheets[chart.sheet]?.rows ?? [];
  const rows = useMemo(() => (requestedDate && comparison ? comparison.mexicanEntries.map(e => e.row) : liveRows.filter(isMexican)).slice(0, 10), [requestedDate, comparison, liveRows]);
  const leader = rows[0];
  const leaderCredit = leader?.[chart.artist] || "—";
  const leaderName = leader ? mexicanName(leader, leaderCredit) : "—";
  const climber = comparison?.comparisonReady ? comparison.climbers.find(entry => isMexican(entry.row)) : undefined;
  const secondary = climber?.row ?? rows[1];
  const secondaryCredit = secondary?.[chart.artist] || "—";
  const secondaryName = secondary ? mexicanName(secondary, secondaryCredit) : "—";
  const names = useMemo(() => [...new Set(rows.map(row => mexicanName(row, row[chart.artist])).filter(Boolean))], [rows, chart.artist]);
  const images = useQuery<Record<string, string | null>>({ queryKey: ["weekly-images", names.join("|")], queryFn: async () => { const r = await fetch(`/api/spotify/artist-images?names=${encodeURIComponent(names.join(","))}`); return r.ok ? r.json() : {}; }, enabled: names.length > 0, staleTime: 30 * 60_000 });
  const leaderImage = exportSafeImageUrl(images.data?.[leaderName]);
  const editionDate = comparison?.chartDate ?? weekly.data?.editionDate ?? hub.data?.sheets[chart.sheet]?.chartDate;
  const crossPlatform = useMemo(() => {
    const appearances = new Map<string, Set<string>>();
    for (const summary of weekly.data?.charts ?? []) for (const entry of summary.mexicanEntries) {
      const name = mexicanName(entry.row, entry.row["Artist"] || entry.row["Artist Name"] || entry.row["Artist Names"]);
      if (!name) continue;
      const platform = summary.chartKey.startsWith("YT_") ? "YouTube" : summary.chartKey.startsWith("Apple_") ? "Apple Music" : summary.chartKey.startsWith("Deezer_") ? "Deezer" : "Spotify";
      if (!appearances.has(name)) appearances.set(name, new Set());
      appearances.get(name)!.add(platform);
    }
    return [...appearances].filter(([, list]) => list.size > 1).sort((a,b) => b[1].size - a[1].size).slice(0, 5);
  }, [weekly.data]);
  const crossSongGains = useMemo(() => {
    const spotify = weekly.data?.charts.find(item => item.chartKey === "Spotify_Regional_Weekly")?.climbers ?? [];
    const youtube = weekly.data?.charts.find(item => item.chartKey === "YT_Songs_Weekly")?.climbers ?? [];
    const normalize = (value = "") => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    return spotify.flatMap(item => { const title = item.row["Track Name"] || item.row["Title"]; const match = youtube.find(other => normalize(other.row["Song Name"] || other.row["Title"]) === normalize(title)); return match && isMexican(item.row) && isMexican(match.row) ? [{ title, spotify: item.movement, youtube: match.movement }] : []; }).slice(0, 3);
  }, [weekly.data]);

  function chooseProvider(next: Platform) { setPlatformId(next); if (!charts[next][mode]) setMode((Object.keys(charts[next]) as Mode[])[0]); }
  async function downloadCard() {
    if (!cardRef.current || !leader || exporting) return;
    setExporting(true);
    try {
      if (images.isFetching) await images.refetch();
      await prepareWeeklyCardForExport(cardRef.current);
      const href = await toPng(cardRef.current, weeklyCardRenderOptions());
      if (!href || href === "data:,") throw new Error("La tarjeta exportada llegó vacía.");
      const a = document.createElement("a");
      a.download = `mexico-charts-${platformId}-${activeMode}-${editionDate ?? "actual"}.png`;
      a.href = href;
      a.click();
    } catch (error) {
      console.error("[weekly-card-export]", error);
      window.alert(error instanceof Error ? error.message : pick("No se pudo preparar la tarjeta.", "The card could not be prepared."));
    } finally {
      setExporting(false);
    }
  }

  return <div className="min-h-screen bg-[#050505] text-white"><PageSEO title={pick("Esta semana — Mexico Charts", "This week — Mexico Charts")} description={pick("Participación mexicana verificada en las listas oficiales.", "Verified Mexican participation on official charts.")} path={requestedDate ? `/esta-semana/${requestedDate}` : "/esta-semana"} /><SiteNav />
    <main className="mx-auto max-w-[1380px] px-4 py-7 sm:px-6 lg:px-10 lg:py-12">
      <header className="relative overflow-hidden border border-white/10 bg-[#090909] px-5 py-7 sm:px-8 lg:px-10"><div className="pointer-events-none absolute inset-y-0 right-0 w-2/3" style={{ background: "radial-gradient(circle at 85% 20%, rgba(57,255,20,.13), transparent 58%)" }} /><div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end"><div><div className="flex items-center gap-3"><img src={`${import.meta.env.BASE_URL}mexico-charts-logo.png`} alt="Mexico Charts" className="h-9 w-9 object-contain" /><span className="text-[9px] font-black uppercase tracking-[.28em]" style={{ color: G }}>Mexico Charts · Editorial</span></div><h1 className="mt-7 text-[clamp(3.1rem,7vw,6.5rem)] font-black uppercase leading-[.84] tracking-[-.065em]">Esta <span style={{ color: G }}>semana</span></h1><p className="mt-5 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">{pick("Participación mexicana verificada en las listas oficiales, plataforma por plataforma.", "Verified Mexican participation on official charts, platform by platform.")}</p></div><div className="border border-white/10 bg-black/40 p-5"><div className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-500">{pick("Edición", "Edition")}</div><div className="mt-2 text-xl font-black uppercase">{formatDate(editionDate)}</div>{comparison?.previousChartDate && <Link href={`/esta-semana/${comparison.previousChartDate}`}><span className="mt-4 inline-block text-[9px] font-black uppercase tracking-[.16em]" style={{ color: G }}>← {pick("Edición anterior", "Previous edition")}</span></Link>}</div></div></header>
      <div className="my-4 grid grid-cols-2 gap-px border border-white/10 bg-white/10 p-px sm:flex">{providers.map(item => <button key={item.id} onClick={() => chooseProvider(item.id)} className="flex flex-1 items-center justify-center gap-2 px-3 py-3.5 text-[9px] font-black uppercase tracking-[.13em]" style={{ background: platformId === item.id ? item.color : "#080808", color: platformId === item.id ? "#050505" : "#888" }}><item.Icon className="h-4 w-4" />{item.label}</button>)}</div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">{modes.map(item => <button key={item} onClick={() => setMode(item)} className="shrink-0 border px-5 py-2 text-[9px] font-black uppercase tracking-[.18em]" style={{ borderColor: activeMode === item ? provider.color : "rgba(255,255,255,.12)", color: activeMode === item ? provider.color : "#777" }}>{pick(...modeLabels[item])}</button>)}</div>
      {hub.isLoading || weekly.isLoading ? <div className="h-[430px] animate-pulse bg-white/[.04]" /> : !leader ? <div className="border border-white/10 p-10 text-zinc-500">{pick("No hay participación mexicana verificada en esta edición.", "There is no verified Mexican participation in this edition.")}</div> : <>
        <section className="grid gap-4 lg:grid-cols-[1.35fr_.85fr]"><article className="overflow-hidden border border-white/10 bg-[#0b0b0b]"><div className="h-[250px] overflow-hidden bg-white/[.04] sm:h-[340px]">{images.data?.[leaderName] && <img src={images.data[leaderName]!} alt={leaderName} className="h-full w-full object-cover object-top" />}</div><div className="p-6 sm:p-8"><div className="text-[10px] font-black uppercase tracking-[.24em]" style={{ color: provider.color }}>{pick("Participación mexicana destacada", "Featured Mexican participation")}</div><div className="mt-5 text-sm font-black uppercase text-zinc-500">#{rowRank(leader, 0)} {pick("en México", "in Mexico")}</div><h2 className="mt-2 text-[clamp(2.3rem,7vw,5.2rem)] font-black uppercase leading-[.9] tracking-[-.05em]">{activeMode === "artists" ? leaderName : leader[chart.title]}</h2>{activeMode !== "artists" && <><p className="mt-4 text-lg text-zinc-300">{leaderCredit}</p><p className="mt-2 text-xs font-black uppercase tracking-[.15em] text-zinc-500">{pick("Participación mexicana", "Mexican participation")}: {leaderName}</p></>}</div></article>
          <article className="flex flex-col border border-white/10 bg-[#0b0b0b] p-6 sm:p-8"><div className="text-[10px] font-black uppercase tracking-[.24em]" style={{ color: provider.color }}>{climber ? pick("Mayor ascenso mexicano", "Biggest Mexican climber") : pick("Siguiente entrada mexicana", "Next Mexican entry")}</div><div className="mt-7 aspect-[4/3] overflow-hidden bg-white/[.04]">{images.data?.[secondaryName] && <img src={images.data[secondaryName]!} alt={secondaryName} className="h-full w-full object-cover object-top" />}</div><div className="mt-auto pt-6"><div className="text-5xl font-black" style={{ color: provider.color }}>{climber ? `+${climber.movement}` : `#${secondary ? rowRank(secondary, 1) : "—"}`}</div><h3 className="mt-3 text-2xl font-black uppercase leading-tight">{activeMode === "artists" ? secondaryName : secondary?.[chart.title]}</h3>{activeMode !== "artists" && <p className="mt-2 text-sm text-zinc-500">{secondaryCredit}</p>}</div></article></section>
        <section className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_.8fr]"><div className="min-w-0"><div className="flex items-end justify-between gap-4"><h2 className="text-3xl font-black uppercase tracking-[-.04em]">Top mexicano</h2>{comparison?.comparisonReady && <span className="text-[9px] font-black uppercase tracking-[.15em] text-zinc-600">{pick("Cambio real", "Real change")}</span>}</div><div className="mt-5 border-t border-white/10">{rows.map((row, index) => { const credit = row[chart.artist]; const name = mexicanName(row, credit); const entry = comparison?.mexicanEntries.find(item => item.rank === rowRank(row,index)); const url = sourceUrl(row, chart.urls); const profile = canonicalArtistHref(name); return <div key={`${credit}-${index}`} className="grid grid-cols-[38px_44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 py-4 sm:grid-cols-[48px_48px_minmax(0,1fr)_auto]"><span className="text-xl font-black text-zinc-500">{String(rowRank(row,index)).padStart(2,"0")}</span><div className="h-11 w-11 overflow-hidden bg-white/[.04]">{images.data?.[name] && <img src={images.data[name]!} alt="" className="h-full w-full object-cover object-top" />}</div><div className="min-w-0">{profile ? <Link href={profile}><span className="block truncate font-black uppercase hover:underline">{activeMode === "artists" ? name : row[chart.title]}</span></Link> : <div className="truncate font-black uppercase">{activeMode === "artists" ? name : row[chart.title]}</div>}{activeMode !== "artists" && <div className="mt-1 truncate text-xs text-zinc-500">{credit} · MX: {name}</div>}</div><div className="flex items-center gap-3">{comparison?.comparisonReady && <span className="text-xs font-black" style={{ color: (entry?.movement ?? 0) > 0 ? G : "#777" }}>{entry?.debut ? "DEBUT" : entry?.movement ? `${entry.movement > 0 ? "+" : ""}${entry.movement}` : "—"}</span>}{url && <a href={url} target="_blank" rel="noreferrer" aria-label={pick("Abrir fuente oficial", "Open official source")}><ExternalLink className="h-4 w-4 text-zinc-500 hover:text-white" /></a>}</div></div>; })}</div></div>
          <aside><h2 className="text-3xl font-black uppercase tracking-[-.04em]">{pick("Comparación real", "Real comparison")}</h2><div className="mt-5 border border-white/10 p-6 text-sm leading-relaxed text-zinc-400"><p><strong className="text-white">{provider.label}</strong> · {pick(...modeLabels[activeMode])} · México</p><p className="mt-3">{comparison?.comparisonReady ? pick(`${comparison.debuts.filter(e => isMexican(e.row)).length} debuts y ${comparison.climbers.filter(e => isMexican(e.row)).length} ascensos mexicanos frente a la edición guardada anterior.`, `${comparison.debuts.filter(e => isMexican(e.row)).length} Mexican debuts and ${comparison.climbers.filter(e => isMexican(e.row)).length} climbers versus the previous saved edition.`) : pick("La comparación se activará únicamente cuando exista otra edición oficial guardada. No estimamos movimientos.", "Comparison activates only when another official edition is saved. We do not estimate movement.")}</p><Link href={`/charts?platform=${encodeURIComponent(provider.label)}&sheet=${chart.sheet}`}><span className="mt-5 inline-block font-black uppercase tracking-[.16em]" style={{ color: G }}>{pick("Abrir lista completa", "Open full chart")} →</span></Link></div>{crossPlatform.length > 0 && <div className="mt-3 border border-white/10 p-6"><div className="text-[9px] font-black uppercase tracking-[.2em]" style={{ color:G }}>{pick("Presencia multiplataforma", "Cross-platform presence")}</div>{crossPlatform.map(([name, list]) => <div key={name} className="mt-4 flex items-center justify-between gap-3 text-sm"><Link href={canonicalArtistHref(name) ?? "/artists"}><span className="font-black uppercase">{name}</span></Link><span className="text-xs text-zinc-600">{[...list].join(" · ")}</span></div>)}</div>}{crossSongGains.length > 0 && <div className="mt-3 border border-white/10 p-6"><div className="text-[9px] font-black uppercase tracking-[.2em]" style={{ color:G }}>{pick("Suben en Spotify + YouTube", "Rising on Spotify + YouTube")}</div>{crossSongGains.map(song => <div key={song.title} className="mt-4 text-sm"><strong className="uppercase">{song.title}</strong><span className="ml-2 text-zinc-600">+{song.spotify} · +{song.youtube}</span></div>)}</div>}<button onClick={downloadCard} disabled={exporting} className="mt-3 flex w-full items-center justify-center gap-2 border border-white/15 px-5 py-4 text-[10px] font-black uppercase tracking-[.16em]"><Download className="h-4 w-4" />{exporting ? pick("Preparando…", "Preparing…") : pick("Descargar tarjeta", "Download card")}</button></aside></section>
        <div className="fixed -left-[9999px] top-0"><div ref={cardRef} className="relative h-[1350px] w-[1080px] overflow-hidden bg-[#070707] p-20 text-white"><div className="absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle at 75% 20%, ${provider.color}33, transparent 48%)` }} /><div className="relative"><div className="flex items-center gap-5"><img src={`${import.meta.env.BASE_URL}mexico-charts-logo.png`} className="h-20 w-20 object-contain" crossOrigin="anonymous" /><div className="text-2xl font-black uppercase tracking-[.3em]" style={{ color: provider.color }}>Mexico Charts · Esta semana</div></div><div className="mt-20 text-3xl font-black uppercase tracking-[.2em] text-zinc-500">{provider.label} · {pick(...modeLabels[activeMode])} · #{rowRank(leader,0)}</div><div className="mt-10 flex h-[520px] items-center justify-center overflow-hidden border border-white/15 bg-[#090909]">{leaderImage ? <img src={leaderImage} className="h-full w-full object-cover object-top" crossOrigin="anonymous" /> : <div className="px-16 text-center"><div className="text-8xl font-black uppercase" style={{ color: provider.color }}>{leaderName.slice(0, 2)}</div><div className="mt-7 text-xl font-black uppercase tracking-[.22em] text-zinc-600">Mexico Charts</div></div>}</div><div className="mt-12 text-7xl font-black uppercase leading-[.9] tracking-[-.05em]">{activeMode === "artists" ? leaderName : leader[chart.title]}</div>{activeMode !== "artists" && <div className="mt-7 text-3xl text-zinc-400">{leaderCredit}</div>}<div className="mt-12 border-t border-white/15 pt-8 text-2xl font-black uppercase tracking-[.17em]" style={{ color: provider.color }}>{formatDate(editionDate)} · Participación mexicana verificada</div></div></div></div>
      </>}
    </main></div>;
}
