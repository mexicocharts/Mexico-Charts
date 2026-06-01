import { useMemo, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, BarChart3, CalendarDays, Check, Copy, Search, Shuffle, Trophy } from "lucide-react";
import { SiInstagram, SiSpotify, SiTiktok, SiYoutube } from "react-icons/si";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { artistMatches, useCertifications } from "@/hooks/useCertifications";
import { useArtistImages } from "@/hooks/useArtistImages";
import { useTouring } from "@/hooks/useTouring";
import { slugify } from "@/lib/utils";
import { useArtistMetadata, type ArtistMetadata } from "@/services/dataProvider";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

type Row = Record<string, string>;
interface SheetData { headers: string[]; rows: Row[] }
interface HubData { lastUpdated: string; sheets: Record<string, SheetData> }

type Metric = {
  key: string;
  group: "Streaming" | "Social" | "Actividad";
  label: string;
  a: number;
  b: number;
  aText: string;
  bText: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
};

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

function compact(value: number) {
  if (!value) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString("es-MX");
}

function artistOptionLabel(artist: ArtistMetadata) {
  return [artist.displayName, artist.subgenre || artist.genre].filter(Boolean).join(" · ");
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
  const levels = matches.reduce((sum, row) => sum + (row.totalLevels || row.diamante * 10 + row.platino + row.oro), 0);
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

function WinnerPill({ winner, side }: { winner: "a" | "b" | "tie"; side: "a" | "b" }) {
  if (winner === "tie" || winner !== side) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em]"
      style={{ color: "#000", background: G }}>
      <Trophy className="h-3 w-3" />
      Lidera
    </span>
  );
}

function ArtistPicker({ label, artist, artists, side, onPick }: {
  label: string;
  artist: ArtistMetadata;
  artists: ArtistMetadata[];
  side: "a" | "b";
  onPick: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const q = norm(query);
  const suggestions = useMemo(() => {
    const ranked = artists
      .filter(candidate => candidate.displayName !== artist.displayName)
      .map(candidate => {
        const haystack = artistSearchText(candidate);
        const name = norm(candidate.displayName);
        const score = !q ? candidate.spotifyListeners : name.startsWith(q) ? 1_000_000_000 + candidate.spotifyListeners : haystack.includes(q) ? 500_000_000 + candidate.spotifyListeners : 0;
        return { candidate, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.candidate.displayName.localeCompare(b.candidate.displayName, "es", { sensitivity: "base" }))
      .slice(0, 7);
    return ranked.map(item => item.candidate);
  }, [artist.displayName, artists, q]);

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.42)" }}>
          {label}
        </span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: side === "a" ? G : "rgba(255,255,255,0.38)" }} />
          <input
            value={focused ? query : artistOptionLabel(artist)}
            onFocus={() => {
              setFocused(true);
              setQuery("");
            }}
            onChange={event => setQuery(event.target.value)}
            onBlur={() => window.setTimeout(() => setFocused(false), 120)}
            className="h-12 w-full rounded-lg bg-[#101010] pl-10 pr-3 text-sm font-black text-white outline-none"
            style={{ border: side === "a" ? `1px solid ${G}46` : "1px solid rgba(255,255,255,0.13)", boxShadow: focused ? `0 0 0 1px ${side === "a" ? `${G}30` : "rgba(255,255,255,0.12)"}` : "none" }}
            placeholder="Buscar artista..."
            aria-label={`Buscar ${label.toLowerCase()}`}
          />
        </span>
      </label>

      {focused && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-lg"
          style={{ border: "1px solid rgba(57,255,20,0.18)", background: "linear-gradient(180deg,#101010,#070707)", boxShadow: "0 18px 44px rgba(0,0,0,0.72)" }}>
          {suggestions.length ? suggestions.map(candidate => (
            <button
              key={candidate.artistKey}
              type="button"
              onMouseDown={event => {
                event.preventDefault();
                onPick(slugify(candidate.displayName));
                setQuery("");
                setFocused(false);
              }}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.055] px-3 py-3 text-left transition-colors hover:bg-white/[0.045]"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">{candidate.displayName}</span>
                <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.38)" }}>
                  {artistOptionLabel(candidate).replace(candidate.displayName, "").replace(/^ · /, "") || "Mexico Charts"}
                </span>
              </span>
              <span className="text-[10px] font-black tabular-nums" style={{ color: side === "a" ? G : "rgba(255,255,255,0.62)" }}>
                {candidate.spotifyListenersFmt}
              </span>
            </button>
          )) : (
            <div className="px-4 py-5 text-center text-sm font-bold" style={{ color: "rgba(255,255,255,0.38)" }}>
              Sin resultados.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArtistPanel({ artist, rank, certs, tours, charts, image, side }: {
  artist: ArtistMetadata;
  rank: number | null;
  certs: ReturnType<typeof certSummary>;
  tours: number;
  charts: ReturnType<typeof chartAppearances>;
  image?: string | null;
  side: "a" | "b";
}) {
  return (
    <div className="group relative overflow-hidden"
      style={{ borderRadius: 8, border: `1px solid ${G}28`, background: "radial-gradient(circle at 12% 0%, rgba(57,255,20,0.12), transparent 34%), rgba(255,255,255,0.022)" }}>
      <div className="relative h-36 overflow-hidden bg-white/[0.035] sm:h-44">
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-7xl font-black uppercase opacity-20">
            {artist.displayName.charAt(0)}
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.92))" }} />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <span className="rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: side === "a" ? "#000" : "rgba(255,255,255,0.78)", background: side === "a" ? G : "rgba(255,255,255,0.08)", border: side === "a" ? "none" : "1px solid rgba(255,255,255,0.12)" }}>
            Artista {side.toUpperCase()}
          </span>
          <Link href={`/artist/${slugify(artist.displayName)}`}>
            <span className="rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.16em]"
              style={{ border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.78)", background: "rgba(0,0,0,0.36)" }}>
              Perfil
            </span>
          </Link>
        </div>
      </div>
      <div className="relative p-4 sm:p-5">
      <div className="pointer-events-none absolute -right-6 top-2 text-[22vw] font-black uppercase leading-none opacity-[0.035] md:text-[9vw]">
        MX
      </div>
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: G }}>
            {rank ? `MX100 #${rank}` : "Perfil Mexico Charts"}
          </p>
          <h2 className="mt-3 text-3xl font-black uppercase leading-[0.9] sm:text-5xl">
            {artist.displayName}
          </h2>
          <p className="mt-3 text-sm font-bold" style={{ color: "rgba(255,255,255,0.46)" }}>
            {[artist.subgenre || artist.genre, artist.country, artist.label].filter(Boolean).join(" · ") || "Datos editoriales"}
          </p>
        </div>
      </div>
      <div className="relative mt-5 grid grid-cols-3 gap-2">
        {[
          ["Certs", compact(certs.count)],
          ["Giras", compact(tours)],
          ["Listas", compact(charts.count)],
        ].map(([label, value]) => (
          <div key={label} className="px-3 py-3" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.24)" }}>
            <span className="block text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.36)" }}>{label}</span>
            <span className="mt-2 block text-lg font-black text-white">{value}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

function MetricRow({ metric }: { metric: Metric }) {
  const max = Math.max(metric.a, metric.b, 1);
  const winner = metric.a === metric.b ? "tie" : metric.a > metric.b ? "a" : "b";
  const Icon = metric.icon;

  return (
    <div className="grid gap-3 p-4 md:grid-cols-[190px_minmax(0,1fr)] md:items-center" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: G }} />
        <span className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.48)" }}>
          {metric.label}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(["a", "b"] as const).map(side => {
          const value = side === "a" ? metric.a : metric.b;
          const text = side === "a" ? metric.aText : metric.bText;
          return (
            <div key={side}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xl font-black tabular-nums text-white">{text}</span>
                <WinnerPill winner={winner} side={side} />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(4, (value / max) * 100)}%`, background: side === "a" ? G : "rgba(255,255,255,0.76)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ArtistCompare() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const params = new URLSearchParams(search);
  const { byKey } = useArtistMetadata();
  const { data: tours } = useTouring();
  const { rows: certRows } = useCertifications();
  const { data: hub } = useQuery<HubData>({
    queryKey: ["charts-hub"],
    queryFn: async () => {
      const resp = await fetch("/api/charts/hub");
      if (!resp.ok) throw new Error("Failed to fetch charts");
      return resp.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const artists = useMemo(() => (
    Array.from(byKey.values())
      .filter(artist => artist.displayName)
      .sort((a, b) => b.spotifyListeners - a.spotifyListeners || a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" }))
  ), [byKey]);

  const weeklyRanks = useMemo(() => {
    const sheet = hub?.sheets?.Spotify_Artists_Weekly?.rows ?? [];
    const ranks = new Map<string, number>();
    sheet.forEach((row, index) => {
      const name = row.Artist ?? "";
      if (name) ranks.set(norm(name), Number(row.Rank || row.rank || index + 1));
    });
    return ranks;
  }, [hub]);

  const aSlug = params.get("a");
  const bSlug = params.get("b");
  const artistA = artists.find(artist => slugify(artist.displayName) === aSlug) ?? artists[0];
  const artistB = artists.find(artist => slugify(artist.displayName) === bSlug && artist.displayName !== artistA?.displayName) ?? artists.find(artist => artist.displayName !== artistA?.displayName);
  const artistImages = useArtistImages([artistA?.displayName, artistB?.displayName].filter(Boolean) as string[]);
  const imageA = artistA ? artistImages[artistA.displayName] : null;
  const imageB = artistB ? artistImages[artistB.displayName] : null;

  function setArtist(side: "a" | "b", slug: string) {
    const nextA = side === "a" ? slug : slugify(artistA?.displayName ?? "");
    const nextB = side === "b" ? slug : slugify(artistB?.displayName ?? "");
    navigate(`/compare?a=${encodeURIComponent(nextA)}&b=${encodeURIComponent(nextB)}`);
  }

  function swapArtists() {
    if (!artistA || !artistB) return;
    navigate(`/compare?a=${encodeURIComponent(slugify(artistB.displayName))}&b=${encodeURIComponent(slugify(artistA.displayName))}`);
  }

  function copyShareUrl() {
    const href = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/compare?a=${encodeURIComponent(slugify(artistA?.displayName ?? ""))}&b=${encodeURIComponent(slugify(artistB?.displayName ?? ""))}`;
    navigator.clipboard?.writeText(href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  }

  const aCerts = artistA ? certSummary(certRows, artistA) : null;
  const bCerts = artistB ? certSummary(certRows, artistB) : null;
  const aTours = artistA ? touringCount(tours, artistA) : 0;
  const bTours = artistB ? touringCount(tours, artistB) : 0;
  const aCharts = artistA ? chartAppearances(hub, artistA) : null;
  const bCharts = artistB ? chartAppearances(hub, artistB) : null;

  const metrics = useMemo<Metric[]>(() => {
    if (!artistA || !artistB || !aCerts || !bCerts || !aCharts || !bCharts) return [];
    return [
      { key: "listeners", group: "Streaming", label: "Oyentes Spotify", a: artistA.spotifyListeners, b: artistB.spotifyListeners, aText: artistA.spotifyListenersFmt, bText: artistB.spotifyListenersFmt, icon: SiSpotify },
      { key: "streams", group: "Streaming", label: "Streams Spotify", a: artistA.spotifyStreams, b: artistB.spotifyStreams, aText: artistA.spotifyStreamsFmt, bText: artistB.spotifyStreamsFmt, icon: SiSpotify },
      { key: "youtube-views", group: "Streaming", label: "Vistas YouTube", a: artistA.youtubeViews, b: artistB.youtubeViews, aText: artistA.youtubeViewsFmt, bText: artistB.youtubeViewsFmt, icon: SiYoutube },
      { key: "youtube-subs", group: "Social", label: "Suscriptores YouTube", a: artistA.youtubeSubscribers, b: artistB.youtubeSubscribers, aText: artistA.youtubeSubscribersFmt, bText: artistB.youtubeSubscribersFmt, icon: SiYoutube },
      { key: "tiktok", group: "Social", label: "TikTok", a: artistA.tiktokFollowers, b: artistB.tiktokFollowers, aText: artistA.tiktokFollowersFmt, bText: artistB.tiktokFollowersFmt, icon: SiTiktok },
      { key: "instagram", group: "Social", label: "Instagram", a: artistA.instagramFollowers, b: artistB.instagramFollowers, aText: artistA.instagramFollowersFmt, bText: artistB.instagramFollowersFmt, icon: SiInstagram },
      { key: "certifications", group: "Actividad", label: "Certificaciones", a: aCerts.count, b: bCerts.count, aText: compact(aCerts.count), bText: compact(bCerts.count), icon: BadgeCheck },
      { key: "touring", group: "Actividad", label: "Fechas activas", a: aTours, b: bTours, aText: compact(aTours), bText: compact(bTours), icon: CalendarDays },
      { key: "charts", group: "Actividad", label: "Apariciones en listas", a: aCharts.count, b: bCharts.count, aText: compact(aCharts.count), bText: compact(bCharts.count), icon: BarChart3 },
    ];
  }, [artistA, artistB, aCerts, bCerts, aTours, bTours, aCharts, bCharts]);

  const groupedMetrics = useMemo(() => {
    return (["Streaming", "Social", "Actividad"] as const).map(group => ({
      group,
      rows: metrics.filter(metric => metric.group === group),
    })).filter(section => section.rows.length);
  }, [metrics]);

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
      seen.add(key);
      return true;
    });
  }, [artists]);

  return (
    <div className="min-h-screen text-white" style={{ background: "#080808" }}>
      <PageSEO
        title="Comparar artistas"
        description="Compara artistas mexicanos con señales de streaming, YouTube, social, certificaciones, giras y listas oficiales."
        path="/compare"
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.018]" style={{ backgroundImage: NOISE, backgroundSize: 128 }} />
      <SiteNav />

      <main className="relative px-4 pb-12 pt-8 sm:px-6 lg:px-12">
        <section className="max-w-7xl">
          <p className="mb-3 text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>
            Herramienta Mexico Charts
          </p>
          <h1 className="max-w-5xl font-black uppercase leading-[0.88]" style={{ fontSize: "clamp(2.95rem,8vw,7rem)" }}>
            Comparar artistas
          </h1>
          <div className="mt-4 flex max-w-5xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <p className="max-w-2xl text-sm leading-relaxed sm:text-lg" style={{ color: "rgba(255,255,255,0.56)" }}>
              Dos perfiles, señales lado a lado: streaming, YouTube, social, certificaciones, giras y presencia en listas.
            </p>
            {artistA && artistB && (
              <button type="button" onClick={copyShareUrl}
                className="inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-[0.16em] transition-colors hover:bg-white/[0.06]"
                style={{ border: "1px solid rgba(255,255,255,0.1)", color: copied ? G : "rgba(255,255,255,0.62)" }}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Compartir"}
              </button>
            )}
          </div>
        </section>

        {artistA && artistB ? (
          <section className="mt-7 max-w-7xl space-y-5">
            <div className="p-3 sm:p-4" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] md:items-end">
                <ArtistPicker label="Artista A" artist={artistA} artists={artists} side="a" onPick={slug => setArtist("a", slug)} />
                <button type="button" onClick={swapArtists}
                  className="mx-auto flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/[0.06]"
                  style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
                  aria-label="Intercambiar artistas">
                  <Shuffle className="h-4 w-4" />
                </button>
                <ArtistPicker label="Artista B" artist={artistB} artists={artists} side="b" onPick={slug => setArtist("b", slug)} />
              </div>
              {presetPairs.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {presetPairs.map(pair => (
                    <button key={pair.label} type="button"
                      onClick={() => navigate(`/compare?a=${encodeURIComponent(slugify(pair.a.displayName))}&b=${encodeURIComponent(slugify(pair.b.displayName))}`)}
                      className="rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em]"
                      style={{ border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.48)", background: "rgba(255,255,255,0.025)" }}>
                      {pair.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ArtistPanel artist={artistA} rank={weeklyRanks.get(norm(artistA.displayName)) ?? null} certs={aCerts!} tours={aTours} charts={aCharts!} image={imageA} side="a" />
              <ArtistPanel artist={artistB} rank={weeklyRanks.get(norm(artistB.displayName)) ?? null} certs={bCerts!} tours={bTours} charts={bCharts!} image={imageB} side="b" />
            </div>

            <div className="overflow-hidden" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}>
              <div className="grid grid-cols-2 border-b border-white/[0.06] px-4 py-3">
                <span className="truncate text-sm font-black uppercase">{artistA.displayName}</span>
                <span className="truncate text-right text-sm font-black uppercase">{artistB.displayName}</span>
              </div>
              {groupedMetrics.map(section => (
                <div key={section.group}>
                  <div className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: G, background: "rgba(57,255,20,0.045)", borderBottom: "1px solid rgba(57,255,20,0.12)" }}>
                    {section.group}
                  </div>
                  {section.rows.map(metric => <MetricRow key={metric.key} metric={metric} />)}
                </div>
              ))}
            </div>

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
        ) : (
          <div className="mt-12 max-w-xl rounded-lg p-6" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}>
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.56)" }}>
              Cargando base de artistas.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
