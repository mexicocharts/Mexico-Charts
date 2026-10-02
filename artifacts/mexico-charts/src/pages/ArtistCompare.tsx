import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeftRight, ArrowUpRight, BadgeCheck, BarChart3, CalendarDays, Check, ChevronDown, Copy, Search } from "lucide-react";
import { SiInstagram, SiSpotify, SiTiktok, SiYoutube } from "react-icons/si";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { artistMatches, useCertifications } from "@/hooks/useCertifications";
import { getArtistImageUrl, isValidArtistImageUrl, proxyArtistImageUrl, useArtistImagesWithStatus } from "@/hooks/useArtistImages";
import { useChartsHub, type ChartsHubData } from "@/hooks/useChartsHub";
import { useTouring } from "@/hooks/useTouring";
import { useSongstatsArtist, type SongstatsArtistData } from "@/hooks/useSongstatsArtist";
import { slugify } from "@/lib/utils";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";
import { countryLabel, genreLabel, labelAssociationValue } from "@/lib/presentationLabels";
import { listenerSnapshot } from "@/lib/listenerSnapshot.mjs";
import { commonSourceReadings, comparisonBars, formatComparisonValue, metricValue, snapshotCompatibility } from "@/lib/comparisonMetrics.mjs";
import { spotifyMexicoRankLabel } from "@/lib/rankLabels";
import { useArtistMetadata, type ArtistMetadata } from "@/services/dataProvider";
import "./artist-compare.css";

const G = "#39FF14";
type HubData = ChartsHubData;
type Platform = "all" | "spotify" | "youtube" | "tiktok" | "instagram" | "activity";
type Reading = { value: number | null; text: string; source: string; date: string | null; context: string };
type Metric = {
  key: string; group: "Streaming" | "Social" | "Actividad"; platform: Platform; label: string;
  a: Reading; b: Reading; compatible: boolean; note: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties; size?: number; "aria-hidden"?: boolean | "true" | "false" }>;
};
const PLATFORMS: { value: Platform; label: string; icon: Metric["icon"] }[] = [
  { value: "all", label: "Todas las señales", icon: BarChart3 },
  { value: "spotify", label: "Spotify", icon: SiSpotify },
  { value: "youtube", label: "YouTube", icon: SiYoutube },
  { value: "tiktok", label: "TikTok", icon: SiTiktok },
  { value: "instagram", label: "Instagram", icon: SiInstagram },
  { value: "activity", label: "Actividad", icon: CalendarDays },
];

const CHART_ARTIST_FIELDS = ["Artist", "Artist Name", "Artist Names", "artist_names"];
const CHART_TITLE_FIELDS = ["Track Name", "Video Title", "Title", "track_name"];

function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const compact = formatComparisonValue;

function artistOptionLabel(artist: ArtistMetadata) {
  return [artist.displayName, genreLabel(artist.subgenre || artist.genre)].filter(Boolean).join(" · ");
}

function artistSearchText(artist: ArtistMetadata) {
  return norm(`${artist.displayName} ${artist.artistKey} ${artist.genre} ${artist.subgenre} ${artist.label} ${artist.country}`);
}

function matchArtistField(field: string, artist: ArtistMetadata) {
  const target = norm(artist.displayName);
  const key = norm(artist.artistKey);
  const source = ` ${norm(field)} `;
  return Boolean(target && source.includes(` ${target} `)) || Boolean(key && source.includes(` ${key} `));
}

function chartAppearances(hub: HubData | undefined, artist: ArtistMetadata) {
  if (!hub?.sheets) return { count: 0, top: [] as Array<{ sheet: string; title: string; rank: string }> };
  const top: Array<{ sheet: string; title: string; rank: string }> = [];
  let count = 0;

  Object.entries(hub.sheets).forEach(([sheet, data]) => {
    data.rows.forEach((row, index) => {
      const artistField = CHART_ARTIST_FIELDS.map(field => row[field]).find(Boolean) ?? "";
      if (!artistField || !matchArtistField(artistField, artist)) return;
      count += 1;
      if (top.length < 5) {
        const title = CHART_TITLE_FIELDS.map(field => row[field]).find(Boolean) || artist.displayName;
        const rank = row.Rank || row.rank || row.Position || row.position || String(index + 1);
        top.push({ sheet, title, rank });
      }
    });
  });

  return { count, top };
}

function certSummary(rows: ReturnType<typeof useCertifications>["rows"], artist: ArtistMetadata) {
  const matches = rows.filter(row => artistMatches(row.artista, artist.displayName));
  const levels = matches.reduce((sum, row) => sum + (row.totalLevels || row.diamante + row.platino + row.oro), 0);
  return {
    count: matches.length,
    levels,
    latest: matches
      .slice()
      .sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""))
      .slice(0, 3),
  };
}

function touringCount(tours: ReturnType<typeof useTouring>["data"], artist: ArtistMetadata) {
  const target = norm(artist.displayName);
  const targetSlug = slugify(artist.displayName);
  const found = tours?.find(tour => norm(tour.name) === target || tour.id === targetSlug || slugify(tour.name) === targetSlug);
  return found?.events.length ?? 0;
}

function ArtistPicker({ artist, other, artists, side, onPick }: {
  artist: ArtistMetadata; other: ArtistMetadata; artists: ArtistMetadata[];
  side: "a" | "b"; onPick: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const q = norm(query);
  const suggestions = useMemo(() => artists
    .filter(candidate => candidate.artistKey !== artist.artistKey && candidate.artistKey !== other.artistKey)
    .map(candidate => {
      const name = norm(candidate.displayName);
      const score = !q ? candidate.spotifyListeners : name.startsWith(q)
        ? 1_000_000_000 + candidate.spotifyListeners
        : artistSearchText(candidate).includes(q) ? 500_000_000 + candidate.spotifyListeners : -1;
      return { candidate, score };
    })
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.candidate.displayName.localeCompare(b.candidate.displayName, "es", { sensitivity: "base" }))
    .slice(0, 7).map(item => item.candidate), [artists, artist.artistKey, other.artistKey, q]);
  function pick(candidate: ArtistMetadata) {
    onPick(slugify(candidate.displayName));
    setOpen(false);
  }
  return <Popover open={open} onOpenChange={next => { setOpen(next); setQuery(""); setActive(-1); }}>
    <PopoverTrigger asChild>
      <button type="button" className="compare-picker-trigger" aria-label={`Cambiar artista ${side.toUpperCase()}: ${artist.displayName}`}>
        <span>Cambiar artista</span><ChevronDown size={17} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="compare-picker-popover" align={side === "a" ? "end" : "start"}
      sideOffset={8} onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }}>
      <div className="compare-picker-search"><Search size={17} aria-hidden="true" />
        <input ref={input} value={query} placeholder="Buscar artista..." role="combobox"
          aria-label={`Buscar artista ${side.toUpperCase()}`} aria-autocomplete="list" aria-expanded={open}
          aria-controls={`${id}-list`} aria-activedescendant={active >= 0 && suggestions[active] ? `${id}-${active}` : undefined}
          onChange={event => { setQuery(event.target.value); setActive(-1); }}
          onKeyDown={event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (suggestions.length) setActive(index => event.key === "ArrowDown"
                ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length - 1 : index - 1));
            } else if (event.key === "Enter" && active >= 0 && suggestions[active]) {
              event.preventDefault(); pick(suggestions[active]);
            }
          }} />
      </div>
      <div id={`${id}-list`} role="listbox" aria-label="Artistas disponibles">
        {suggestions.map((candidate, index) => <button key={candidate.artistKey} id={`${id}-${index}`}
          type="button" role="option" aria-selected={active === index} tabIndex={-1}
          className="compare-picker-option" onMouseDown={event => event.preventDefault()}
          onPointerMove={() => setActive(index)} onClick={() => pick(candidate)}>
          <span><strong>{candidate.displayName}</strong><small>{genreLabel(candidate.subgenre || candidate.genre) || "Mexico Charts"}</small></span>
          <span className="compare-picker-count">{candidate.spotifyListenersFmt}</span>
        </button>)}
      </div>
      {!suggestions.length && <p className="compare-picker-empty" role="status">Sin resultados.</p>}
    </PopoverContent>
  </Popover>;
}

function ArtistPanel({ artist, other, artists, image, fallbackImage, side, rank, chartDate, onPick }: {
  artist: ArtistMetadata; other: ArtistMetadata; artists: ArtistMetadata[]; image: string | null;
  fallbackImage?: string | null;
  side: "a" | "b"; rank: number | null; chartDate?: string | null; onPick: (slug: string) => void;
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const visibleImage = [image, fallbackImage].find(url => isValidArtistImageUrl(url) && !failedUrls.includes(url));
  return <div className={`compare-artist compare-artist--${side}`}>
    <div className="compare-portrait" aria-hidden="true">
      {visibleImage ? <img key={`${artist.artistKey}-${visibleImage}`} src={proxyArtistImageUrl(visibleImage)} alt=""
        decoding="async" onError={() => setFailedUrls(urls => [...urls, visibleImage])} />
        : <span className="compare-portrait-fallback">{artist.displayName.charAt(0)}</span>}
    </div>
    <div className="compare-artist-overlay" aria-hidden="true" />
    <div className="compare-artist-copy">
      <p className="compare-kicker">Artista {side === "a" ? "01" : "02"}</p>
      <h2 style={{ "--compare-name-scale": Math.min(1, 8 / Math.max(...artist.displayName.split(/\s+/).map(word => word.length))) } as CSSProperties}>{artist.displayName}</h2>
      <ArtistPicker key={artist.artistKey} artist={artist} other={other} artists={artists} side={side} onPick={onPick} />
      <div className="compare-artist-profile">
        <span>{genreLabel(artist.subgenre || artist.genre) || "Mexico Charts"}</span>
        <Link href={canonicalArtistHref(artist.artistKey) ?? canonicalArtistHref(artist.displayName) ?? "/artists"}>
          Ver perfil <ArrowUpRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </div>
    <div className="compare-rank">{rank
      ? `${spotifyMexicoRankLabel(rank)} · artistas · semanal · edición ${chartDate || "no informada"} · rango de fuente`
      : "Perfil Mexico Charts"}</div>
  </div>;
}

function editorialReading(value: number, scope: string): Reading {
  const reading = metricValue(value, { editorial: true });
  return { value: reading, text: compact(reading), source: "Metadatos editoriales", date: null,
    context: `Metadatos editoriales · ${scope} · fecha no disponible` };
}
function listenerReading(artist: ArtistMetadata, data: SongstatsArtistData | null | undefined): Reading {
  const snapshot = listenerSnapshot(artist, data);
  const saved = data?.snapshot.spotifyMonthlyListeners != null;
  const value = metricValue(snapshot.value, { editorial: !saved });
  return { value, text: compact(value), source: snapshot.source, date: snapshot.date ?? null,
    context: saved ? `Songstats · Spotify global · colección ${snapshot.date || "sin fecha"}`
      : "Metadatos editoriales · Spotify global · fecha no disponible" };
}
function followerReading(artist: ArtistMetadata, data: SongstatsArtistData | null | undefined): Reading {
  const snapshot = data?.snapshot;
  if (snapshot?.spotifyFollowers == null) return editorialReading(artist.spotifyFollowers, "seguidores Spotify");
  const value = metricValue(snapshot.spotifyFollowers);
  return { value, text: compact(value), source: "Songstats", date: snapshot.snapshotDate,
    context: `Songstats · seguidores Spotify · colección ${snapshot.snapshotDate || "sin fecha"}` };
}
function activityReading(value: number | null, source: string): Reading {
  // An empty loaded dataset does not prove the artist has a career count of zero.
  const reading = value != null && value > 0 ? value : null;
  return { value: reading, text: compact(reading), source, date: null, context: `${source} · cobertura cargada` };
}
function MetricRow({ metric, artistA, artistB }: { metric: Metric; artistA: string; artistB: string }) {
  const bars = comparisonBars(metric.a.value, metric.b.value, { compatible: metric.compatible });
  const Icon = metric.icon;
  return <article className="compare-metric" aria-labelledby={`metric-${metric.key}`} data-metric={metric.key}>
    <h3 id={`metric-${metric.key}`} className="compare-metric-label"><Icon size={17} aria-hidden="true" />{metric.label}</h3>
    {(["a", "b"] as const).map(side => {
      const reading = metric[side];
      const artist = side === "a" ? artistA : artistB;
      return <div key={side} className={`compare-reading compare-reading--${side}${bars.winner === side ? " compare-reading--winner" : ""}`}>
        <span className="compare-reading-artist">{artist}</span>
        <strong className="compare-value" title={reading.value == null ? "No disponible" : reading.value.toLocaleString("es-MX")}>
          <span aria-hidden="true">{reading.text}</span>
          <span className="sr-only">{reading.value == null ? "No disponible" : reading.value.toLocaleString("es-MX")}{bars.winner === side ? " · valor más alto" : ""}</span>
        </strong>
        {reading.value != null && reading.value >= 1000 && <span className="compare-exact-value" aria-hidden="true">{reading.value.toLocaleString("es-MX")}</span>}
        <span className="compare-reading-context">{reading.value == null ? "No disponible · " : ""}{reading.context}</span>
      </div>;
    })}
    <div className="compare-battle-line" aria-hidden="true">
      {(["a", "b"] as const).map(side => <div key={side} className={`compare-bar compare-bar--${side}${bars.winner === side ? " compare-bar--winner" : ""}`}
        style={{ width: bars[side] == null ? "0%" : `${bars[side]}%` }} />)}
    </div>
    <p className="compare-metric-note">{!bars.comparable && metric.a.value != null && metric.b.value != null
      ? metric.note : metric.a.value == null || metric.b.value == null
        ? "Datos parciales · sin comparación de barras" : metric.note}</p>
  </article>;
}

export default function ArtistCompare() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setCopyState("idle"); return () => { if (copyTimer.current) clearTimeout(copyTimer.current); }; }, [search]);
  const params = new URLSearchParams(search);
  const platform: Platform = PLATFORMS.find(item => item.value === params.get("platform"))?.value ?? "all";
  const SelectedIcon = PLATFORMS.find(item => item.value === platform)!.icon;
  const { byKey, isLoading, isError } = useArtistMetadata();
  const { data: tours, isLoading: toursLoading, isError: toursError } = useTouring();
  const { rows: certRows, loading: certLoading } = useCertifications();
  const { data: hub, isLoading: hubLoading } = useChartsHub();
  const artists = useMemo(() => Array.from(byKey.values()).filter(artist => artist.displayName)
    .sort((a, b) => b.spotifyListeners - a.spotifyListeners || a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" })), [byKey]);
  const weeklyRanks = useMemo(() => {
    const ranks = new Map<string, number>();
    (hub?.sheets?.Spotify_Artists_Weekly?.rows ?? []).forEach((row, index) => {
      if (row.Artist) ranks.set(norm(row.Artist), Number(row.Rank || row.rank || index + 1));
    }); return ranks;
  }, [hub]);
  const aSlug = params.get("a"), bSlug = params.get("b");
  const artistA = artists.find(artist => slugify(artist.displayName) === aSlug) ?? artists[0];
  const artistB = artists.find(artist => slugify(artist.displayName) === bSlug && artist.displayName !== artistA?.displayName)
    ?? artists.find(artist => artist.displayName !== artistA?.displayName);
  const { data: aSongstats, isFetching: aSnapshotLoading } = useSongstatsArtist(artistA?.artistKey ?? "");
  const { data: bSongstats, isFetching: bSnapshotLoading } = useSongstatsArtist(artistB?.artistKey ?? "");
  const { images: artistImages, isFetched: imagesFetched } = useArtistImagesWithStatus([artistA?.displayName, artistB?.displayName].filter(Boolean) as string[]);
  const knownImages = useRef<Record<string, string>>({});
  const freshImageA = artistA ? getArtistImageUrl(artistImages, artistA.displayName, artistA.artistKey)
    ?? (isValidArtistImageUrl(aSongstats?.avatarUrl) ? aSongstats.avatarUrl : null) : null;
  const freshImageB = artistB ? getArtistImageUrl(artistImages, artistB.displayName, artistB.artistKey)
    ?? (isValidArtistImageUrl(bSongstats?.avatarUrl) ? bSongstats.avatarUrl : null) : null;
  useEffect(() => {
    if (artistA && freshImageA) knownImages.current[artistA.artistKey] = freshImageA;
    if (artistB && freshImageB) knownImages.current[artistB.artistKey] = freshImageB;
  }, [artistA, artistB, freshImageA, freshImageB]);
  const imageA = artistA ? freshImageA ?? (!imagesFetched ? knownImages.current[artistA.artistKey] ?? null : null) : null;
  const imageB = artistB ? freshImageB ?? (!imagesFetched ? knownImages.current[artistB.artistKey] ?? null : null) : null;
  function pairUrl(a: string, b: string) {
    const next = new URLSearchParams(search); next.set("a", a); next.set("b", b);
    return `/compare?${next.toString()}`;
  }
  function setArtist(side: "a" | "b", slug: string) {
    navigate(pairUrl(side === "a" ? slug : slugify(artistA?.displayName ?? ""), side === "b" ? slug : slugify(artistB?.displayName ?? "")));
  }
  function swapArtists() { if (artistA && artistB) navigate(pairUrl(slugify(artistB.displayName), slugify(artistA.displayName))); }
  function setPlatform(value: Platform) {
    const next = new URLSearchParams(search);
    if (value === "all") next.delete("platform"); else next.set("platform", value);
    navigate(`/compare${next.size ? `?${next.toString()}` : ""}`);
  }
  async function copyShareUrl() {
    if (!artistA || !artistB) return;
    const href = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${pairUrl(slugify(artistA.displayName), slugify(artistB.displayName))}`;
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(href); setCopyState("copied");
    } catch { setCopyState("error"); }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState("idle"), 1800);
  }
  const aCerts = artistA ? certSummary(certRows, artistA) : null;
  const bCerts = artistB ? certSummary(certRows, artistB) : null;
  const aTours = artistA ? touringCount(tours, artistA) : 0;
  const bTours = artistB ? touringCount(tours, artistB) : 0;
  const aCharts = artistA ? chartAppearances(hub, artistA) : null;
  const bCharts = artistB ? chartAppearances(hub, artistB) : null;
  const metrics: Metric[] = [];
  if (artistA && artistB && aCerts && bCerts && aCharts && bCharts) {
    function add(key: string, group: Metric["group"], selectedPlatform: Platform, label: string, icon: Metric["icon"], a: Reading, b: Reading) {
      metrics.push({ key, group, platform: selectedPlatform, label, icon, a, b, ...snapshotCompatibility(a, b) });
    }
    add("streams", "Streaming", "spotify", "Streams Spotify", SiSpotify,
      editorialReading(artistA.spotifyStreams, "streams Spotify acumulados"), editorialReading(artistB.spotifyStreams, "streams Spotify acumulados"));
    function addSpotifyPair(key: string, group: Metric["group"], label: string, a: Reading, b: Reading, fallbackA: Reading, fallbackB: Reading) {
      const pair = commonSourceReadings(a, b, fallbackA, fallbackB);
      const context = (reading: Reading) => pair.usedFallback
        ? { ...reading, context: `${reading.context} · fuente común para esta comparación` } : reading;
      add(key, group, "spotify", label, SiSpotify, context(pair.a), context(pair.b));
    }
    addSpotifyPair("listeners", "Streaming", "Oyentes mensuales", listenerReading(artistA, aSongstats), listenerReading(artistB, bSongstats),
      editorialReading(artistA.spotifyListeners, "Spotify global"), editorialReading(artistB.spotifyListeners, "Spotify global"));
    addSpotifyPair("followers", "Social", "Seguidores en Spotify", followerReading(artistA, aSongstats), followerReading(artistB, bSongstats),
      editorialReading(artistA.spotifyFollowers, "seguidores Spotify"), editorialReading(artistB.spotifyFollowers, "seguidores Spotify"));
    add("youtube-views", "Streaming", "youtube", "Vistas YouTube", SiYoutube,
      editorialReading(artistA.youtubeViews, "vistas YouTube"), editorialReading(artistB.youtubeViews, "vistas YouTube"));
    add("youtube-subs", "Social", "youtube", "Suscriptores YouTube", SiYoutube,
      editorialReading(artistA.youtubeSubscribers, "suscriptores YouTube"), editorialReading(artistB.youtubeSubscribers, "suscriptores YouTube"));
    add("tiktok", "Social", "tiktok", "Seguidores en TikTok", SiTiktok,
      editorialReading(artistA.tiktokFollowers, "seguidores TikTok"), editorialReading(artistB.tiktokFollowers, "seguidores TikTok"));
    add("instagram", "Social", "instagram", "Seguidores en Instagram", SiInstagram,
      editorialReading(artistA.instagramFollowers, "seguidores Instagram"), editorialReading(artistB.instagramFollowers, "seguidores Instagram"));
    add("certifications", "Actividad", "activity", "Certificaciones", BadgeCheck,
      activityReading(certLoading ? null : aCerts.count, "Archivo de certificaciones"), activityReading(certLoading ? null : bCerts.count, "Archivo de certificaciones"));
    add("touring", "Actividad", "activity", "Fechas activas", CalendarDays,
      activityReading(toursLoading || toursError ? null : aTours, "Giras cargadas"), activityReading(toursLoading || toursError ? null : bTours, "Giras cargadas"));
    add("charts", "Actividad", "activity", "Apariciones en listas", BarChart3,
      activityReading(hubLoading ? null : aCharts.count, "Charts Hub · ediciones mixtas"), activityReading(hubLoading ? null : bCharts.count, "Charts Hub · ediciones mixtas"));
  }
  const filteredMetrics = metrics.filter(metric => platform === "all" || metric.platform === platform);
  const presetPairs = useMemo(() => {
    if (artists.length < 4) return [];
    const pairs = [
      { label: "Top actual", a: artists[0], b: artists[1] },
      { label: "Nuevo vs líder", a: artists[2], b: artists[0] },
      { label: "Social fuerte", a: [...artists].sort((a, b) => b.tiktokFollowers - a.tiktokFollowers)[0], b: [...artists].sort((a, b) => b.instagramFollowers - a.instagramFollowers)[0] },
    ];
    const seen = new Set<string>();
    return pairs.filter(pair => {
      const key = `${pair.a?.displayName}-${pair.b?.displayName}`;
      if (!pair.a || !pair.b || pair.a.displayName === pair.b.displayName || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }, [artists]);
  return <div className="compare-page">
    <div className="compare-background" aria-hidden="true" />
    <PageSEO title="Comparar artistas" description="Compara artistas mexicanos con señales de streaming, YouTube, social, certificaciones, giras y listas oficiales." path="/compare" />
    <SiteNav />
    <main className="compare-main">
      <header className="compare-page-heading">
        <div><p className="compare-kicker">Mexico Charts / Comparar</p><h1>Comparar artistas</h1></div>
        {artistA && artistB && <button type="button" onClick={copyShareUrl} className="compare-share" aria-live="polite">
          {copyState === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copyState === "copied" ? "Copiado" : copyState === "error" ? "No se pudo copiar" : "Compartir"}
        </button>}
      </header>
      {artistA && artistB ? <>
        <section className="compare-hero" aria-label="Artistas seleccionados">
          <ArtistPanel artist={artistA} other={artistB} artists={artists} image={imageA} fallbackImage={aSongstats?.avatarUrl} side="a"
            rank={weeklyRanks.get(norm(artistA.displayName)) ?? null} chartDate={hub?.sheets?.Spotify_Artists_Weekly?.chartDate}
            onPick={slug => setArtist("a", slug)} />
          <div className="compare-versus"><span aria-hidden="true">VS</span>
            <button type="button" onClick={swapArtists} aria-label="Intercambiar artistas"><ArrowLeftRight size={23} aria-hidden="true" /></button>
          </div>
          <ArtistPanel artist={artistB} other={artistA} artists={artists} image={imageB} fallbackImage={bSongstats?.avatarUrl} side="b"
            rank={weeklyRanks.get(norm(artistB.displayName)) ?? null} chartDate={hub?.sheets?.Spotify_Artists_Weekly?.chartDate}
            onPick={slug => setArtist("b", slug)} />
        </section>
        {presetPairs.length > 0 && <div className="compare-presets" aria-label="Comparaciones sugeridas">
          <span>Explorar</span>{presetPairs.map(pair => <button key={pair.label} type="button"
            onClick={() => navigate(pairUrl(slugify(pair.a.displayName), slugify(pair.b.displayName)))}
            aria-label={`Comparar ${pair.a.displayName} con ${pair.b.displayName}`}>{pair.label}</button>)}
        </div>}
        <section className="compare-data" aria-label="Comparación de métricas">
          <div className="compare-data-controls">
            <div className="compare-platform"><SelectedIcon size={22} aria-hidden="true" />
              <label className="sr-only" htmlFor="compare-platform">Plataforma</label>
              <select id="compare-platform" value={platform} onChange={event => setPlatform(event.target.value as Platform)}>
                {PLATFORMS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select><ChevronDown size={16} aria-hidden="true" />
            </div>
            <p className="compare-data-status" role="status">{aSnapshotLoading || bSnapshotLoading ? "Cargando instantáneas…" : "Lecturas disponibles"}</p>
          </div>
          <div className="compare-column-names" aria-hidden="true"><span>{artistA.displayName}</span><span>{artistB.displayName}</span></div>
          {filteredMetrics.map(metric => <MetricRow key={metric.key} metric={metric} artistA={artistA.displayName} artistB={artistB.displayName} />)}
          <p className="compare-data-footnote">El verde indica el valor más alto de cada métrica; los empates quedan en blanco. Los colores reparten la línea en proporción a los valores de estos dos artistas. No representa cuota de mercado. Las fuentes y fechas describen las lecturas disponibles.</p>
        </section>
        <section className="compare-supplement" aria-label="Contexto de los artistas">
          <div className="compare-supplement-heading"><p className="compare-kicker">Más contexto</p><h2>Detrás de las cifras</h2></div>
          <div className="compare-editorial-context">{[artistA, artistB].map(artist => <p key={artist.artistKey}><strong>{artist.displayName}</strong><span>{[
            artist.country ? countryLabel(artist.country) : "", artist.label ? `Sellos/distribuidores: ${labelAssociationValue(artist.label)}` : "",
          ].filter(Boolean).join(" · ") || "Datos editoriales no disponibles"}</span></p>)}</div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { artist: artistA, certs: aCerts!, charts: aCharts! },
                { artist: artistB, certs: bCerts!, charts: bCharts! },
              ].map(item => (
                <div key={item.artist.artistKey} className="p-4 sm:p-5"
                  style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}>
                  <h3 className="text-xl font-black uppercase leading-none">{item.artist.displayName}</h3>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div>
                      <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>Certificaciones recientes</p>
                      <div className="space-y-2">
                        {item.certs.latest.length ? item.certs.latest.map(cert => (
                          <div key={`${cert.titulo}-${cert.fechaISO}`} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.035)" }}>
                            <p className="truncate text-sm font-black">{cert.titulo}</p>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                              {cert.certificacion || cert.nivel || "Certificación"} · {cert.year || "—"}
                            </p>
                          </div>
                        )) : (
                          <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>Sin certificaciones cargadas.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: G }}>Listas detectadas</p>
                      <div className="space-y-2">
                        {item.charts.top.length ? item.charts.top.map(chart => (
                          <div key={`${chart.sheet}-${chart.title}-${chart.rank}`} className="rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.035)" }}>
                            <p className="truncate text-sm font-black">#{chart.rank} {chart.title}</p>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                              {chart.sheet.replace(/_/g, " ")}
                            </p>
                          </div>
                        )) : (
                          <p className="text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>Sin apariciones detectadas en listas oficiales.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        </section>
      </> : <div className="compare-empty" role="status">
        <h2>{isError ? "No se pudo cargar la base de artistas" : isLoading ? "Cargando artistas…" : "No hay suficientes artistas disponibles"}</h2>
        <p>{isError ? "Intenta recargar la página. Los datos no se han sustituido por ceros." : "La comparación necesita dos perfiles disponibles."}</p>
        {isError && <button type="button" onClick={() => window.location.reload()}>Reintentar</button>}
      </div>}
    </main>
    <footer className="compare-footer">MEXICO CHARTS <span>Artistas. Datos. Contexto.</span></footer>
  </div>;
}
