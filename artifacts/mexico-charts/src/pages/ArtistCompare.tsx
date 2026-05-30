import { useMemo } from "react";
import type { ComponentType, CSSProperties } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, BarChart3, CalendarDays, Trophy } from "lucide-react";
import { SiInstagram, SiSpotify, SiTiktok, SiYoutube } from "react-icons/si";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { artistMatches, useCertifications } from "@/hooks/useCertifications";
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

function ArtistPanel({ artist, rank, certs, tours, charts }: {
  artist: ArtistMetadata;
  rank: number | null;
  certs: ReturnType<typeof certSummary>;
  tours: number;
  charts: ReturnType<typeof chartAppearances>;
}) {
  return (
    <div className="relative overflow-hidden p-4 sm:p-5"
      style={{ borderRadius: 8, border: `1px solid ${G}28`, background: "radial-gradient(circle at 12% 0%, rgba(57,255,20,0.12), transparent 34%), rgba(255,255,255,0.022)" }}>
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
        <Link href={`/artist/${slugify(artist.displayName)}`}>
          <span className="shrink-0 rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em]"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.66)" }}>
            Perfil
          </span>
        </Link>
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
  );
}

function MetricRow({ metric }: { metric: Metric }) {
  const max = Math.max(metric.a, metric.b, 1);
  const winner = metric.a === metric.b ? "tie" : metric.a > metric.b ? "a" : "b";
  const Icon = metric.icon;

  return (
    <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="mb-3 flex items-center gap-2">
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

  function setArtist(side: "a" | "b", slug: string) {
    const nextA = side === "a" ? slug : slugify(artistA?.displayName ?? "");
    const nextB = side === "b" ? slug : slugify(artistB?.displayName ?? "");
    navigate(`/compare?a=${encodeURIComponent(nextA)}&b=${encodeURIComponent(nextB)}`);
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
      { key: "listeners", label: "Oyentes Spotify", a: artistA.spotifyListeners, b: artistB.spotifyListeners, aText: artistA.spotifyListenersFmt, bText: artistB.spotifyListenersFmt, icon: SiSpotify },
      { key: "streams", label: "Streams Spotify", a: artistA.spotifyStreams, b: artistB.spotifyStreams, aText: artistA.spotifyStreamsFmt, bText: artistB.spotifyStreamsFmt, icon: SiSpotify },
      { key: "youtube-views", label: "Vistas YouTube", a: artistA.youtubeViews, b: artistB.youtubeViews, aText: artistA.youtubeViewsFmt, bText: artistB.youtubeViewsFmt, icon: SiYoutube },
      { key: "youtube-subs", label: "Suscriptores YouTube", a: artistA.youtubeSubscribers, b: artistB.youtubeSubscribers, aText: artistA.youtubeSubscribersFmt, bText: artistB.youtubeSubscribersFmt, icon: SiYoutube },
      { key: "tiktok", label: "TikTok", a: artistA.tiktokFollowers, b: artistB.tiktokFollowers, aText: artistA.tiktokFollowersFmt, bText: artistB.tiktokFollowersFmt, icon: SiTiktok },
      { key: "instagram", label: "Instagram", a: artistA.instagramFollowers, b: artistB.instagramFollowers, aText: artistA.instagramFollowersFmt, bText: artistB.instagramFollowersFmt, icon: SiInstagram },
      { key: "certifications", label: "Certificaciones", a: aCerts.count, b: bCerts.count, aText: compact(aCerts.count), bText: compact(bCerts.count), icon: BadgeCheck },
      { key: "touring", label: "Fechas activas", a: aTours, b: bTours, aText: compact(aTours), bText: compact(bTours), icon: CalendarDays },
      { key: "charts", label: "Apariciones en listas", a: aCharts.count, b: bCharts.count, aText: compact(aCharts.count), bText: compact(bCharts.count), icon: BarChart3 },
    ];
  }, [artistA, artistB, aCerts, bCerts, aTours, bTours, aCharts, bCharts]);

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
          <h1 className="max-w-5xl font-black uppercase leading-[0.88]" style={{ fontSize: "clamp(3.1rem,9.5vw,8.4rem)" }}>
            Comparar artistas
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed sm:text-lg" style={{ color: "rgba(255,255,255,0.56)" }}>
            Dos perfiles, señales lado a lado: streaming, YouTube, social, certificaciones, giras y presencia en listas.
          </p>
        </section>

        {artistA && artistB ? (
          <section className="mt-7 max-w-7xl space-y-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                  Artista A
                </span>
                <select value={slugify(artistA.displayName)} onChange={event => setArtist("a", event.target.value)}
                  className="h-12 w-full rounded-lg bg-[#101010] px-3 text-sm font-black text-white outline-none"
                  style={{ border: `1px solid ${G}38` }}>
                  {artists.map(artist => (
                    <option key={artist.artistKey} value={slugify(artist.displayName)}>{artistOptionLabel(artist)}</option>
                  ))}
                </select>
              </label>
              <ArrowRight className="hidden h-5 w-5 md:block" style={{ color: "rgba(255,255,255,0.26)" }} />
              <label className="block">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.42)" }}>
                  Artista B
                </span>
                <select value={slugify(artistB.displayName)} onChange={event => setArtist("b", event.target.value)}
                  className="h-12 w-full rounded-lg bg-[#101010] px-3 text-sm font-black text-white outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                  {artists.map(artist => (
                    <option key={artist.artistKey} value={slugify(artist.displayName)}>{artistOptionLabel(artist)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ArtistPanel artist={artistA} rank={weeklyRanks.get(norm(artistA.displayName)) ?? null} certs={aCerts!} tours={aTours} charts={aCharts!} />
              <ArtistPanel artist={artistB} rank={weeklyRanks.get(norm(artistB.displayName)) ?? null} certs={bCerts!} tours={bTours} charts={bCharts!} />
            </div>

            <div className="overflow-hidden" style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.018)" }}>
              <div className="grid grid-cols-2 border-b border-white/[0.06] px-4 py-3">
                <span className="truncate text-sm font-black uppercase">{artistA.displayName}</span>
                <span className="truncate text-right text-sm font-black uppercase">{artistB.displayName}</span>
              </div>
              {metrics.map(metric => <MetricRow key={metric.key} metric={metric} />)}
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
