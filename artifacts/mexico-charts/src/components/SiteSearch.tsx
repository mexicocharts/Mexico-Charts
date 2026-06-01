import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useArtistMetadata } from "@/services/dataProvider";
import { slugify } from "@/lib/utils";
import { useChartsHub, type HubRow } from "@/hooks/useChartsHub";
import { useTouring } from "@/hooks/useTouring";

const G = "#39FF14";

const STATIC_RESULTS = [
  { label: "MX100", href: "/mx100", type: "Ranking", detail: "Ranking editorial de artistas" },
  { label: "Listas oficiales", href: "/charts", type: "Listas", detail: "YouTube, Spotify, Apple Music y Deezer" },
  { label: "Artistas", href: "/artists", type: "Directorio", detail: "Roster completo con filtros" },
  { label: "Comparar artistas", href: "/compare", type: "Herramienta", detail: "Dos artistas, señales lado a lado" },
  { label: "Géneros", href: "/generos", type: "Explorar", detail: "Mapa editorial por género" },
  { label: "Giras", href: "/touring", type: "Touring", detail: "Próximas fechas y perfiles" },
  { label: "Certificaciones", href: "/industry/certifications", type: "Industria", detail: "AMPROFON organizado por Mexico Charts" },
  { label: "Industria", href: "/industria", type: "Industria", detail: "Mercado, reportes y contexto" },
  { label: "Metodología", href: "/metodologia", type: "Confianza", detail: "Fuentes, límites y criterio editorial" },
  { label: "Contacto", href: "/contacto", type: "Sitio", detail: "Correcciones, alianzas y contacto" },
] as const;

const EMPTY_STATE_LINKS = ["MX100", "Listas oficiales", "Géneros", "Certificaciones"] as const;

const GENRE_RESULTS = [
  { label: "Corridos Tumbados", href: "/generos", type: "Género", detail: "Corridos, trap y regional mexicano" },
  { label: "Regional Mexicano", href: "/generos", type: "Género", detail: "Banda, norteño, corridos y grupero" },
  { label: "Norteño", href: "/generos", type: "Género", detail: "Acordeón, bajo sexto y música del norte" },
  { label: "Banda", href: "/generos", type: "Género", detail: "Banda sinaloense y música de metales" },
  { label: "Hip-Hop Mexicano", href: "/generos", type: "Género", detail: "Rap, hip-hop y escenas urbanas mexicanas" },
  { label: "Pop", href: "/generos", type: "Género", detail: "Pop mexicano y pop latino" },
] as const;

const CHART_META: Record<string, { platform: string; label: string; period: string }> = {
  YT_Songs_Weekly: { platform: "YouTube", label: "Canciones", period: "Semanal" },
  YT_Videos_Daily: { platform: "YouTube", label: "Videos", period: "Diario" },
  YT_Artists_Weekly: { platform: "YouTube", label: "Artistas", period: "Semanal" },
  YT_Shorts_Daily: { platform: "YouTube", label: "Shorts", period: "Diario" },
  Spotify_Artists_Daily: { platform: "Spotify", label: "Artistas", period: "Diario" },
  Spotify_Artists_Weekly: { platform: "Spotify", label: "Artistas", period: "Semanal" },
  Spotify_Regional_Daily: { platform: "Spotify", label: "Regional", period: "Diario" },
  Spotify_Regional_Weekly: { platform: "Spotify", label: "Regional", period: "Semanal" },
  Spotify_Viral_Daily: { platform: "Spotify", label: "Viral", period: "Diario" },
  Apple_Songs: { platform: "Apple Music", label: "Canciones", period: "Diario" },
  Apple_Albums: { platform: "Apple Music", label: "Álbumes", period: "Diario" },
  Deezer_Top_Mexico: { platform: "Deezer", label: "México", period: "Diario" },
};

type CertRow = {
  artista: string;
  titulo: string;
  certificacion: string;
  nivel: string;
  year: number;
};

function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type SearchResult = {
  label: string;
  href: string;
  type: string;
  detail: string;
  score: number;
  category?: SearchCategory;
  dedupeKey?: string;
};

type SearchCategory = "site" | "artist" | "genre" | "chart" | "certification" | "touring" | "event";

type SearchCandidate = SearchResult & {
  haystack: string;
  baseScore: number;
};

function rankCandidate(row: SearchCandidate, q: string): SearchResult | null {
  if (!q) return { ...row, score: row.baseScore };
  const label = norm(row.label);
  const terms = q.split(/\s+/).filter(Boolean);
  let score = 0;
  if (label === q) score = 1000;
  else if (label.startsWith(q)) score = 820;
  else if (row.haystack.includes(q)) score = 560;
  else if (terms.length > 1 && terms.every(term => row.haystack.includes(term))) score = 470;
  if (!score) return null;
  const { haystack: _haystack, baseScore: _baseScore, ...result } = row;
  return { ...result, score: score + row.baseScore };
}

function pruneRankedResults(rows: SearchResult[]) {
  const seen = new Set<string>();
  const categoryCounts: Partial<Record<SearchCategory, number>> = {};
  const categoryLimits: Partial<Record<SearchCategory, number>> = {
    chart: 4,
    certification: 3,
    event: 2,
    touring: 3,
  };
  const pruned: SearchResult[] = [];

  for (const row of rows) {
    const key = row.dedupeKey ?? `${norm(row.type)}|${norm(row.label)}|${row.href}`;
    if (seen.has(key)) continue;

    const category = row.category;
    if (category) {
      const limit = categoryLimits[category];
      const count = categoryCounts[category] ?? 0;
      if (limit != null && count >= limit) continue;
      categoryCounts[category] = count + 1;
    }

    seen.add(key);
    pruned.push(row);
    if (pruned.length >= 12) break;
  }

  return pruned;
}

function chartTitle(row: HubRow) {
  return row["Track Name"] || row["Video Title"] || row.Title || row.track_name || row.Artist || row["Artist Name"] || "Entrada de chart";
}

function chartArtist(row: HubRow) {
  return row["Artist Names"] || row.artist_names || row.Artist || row["Artist Name"] || "";
}

function chartRank(row: HubRow, index: number) {
  return row.Rank || row.rank || row.Position || row.position || String(index + 1);
}

export default function SiteSearch() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [, navigate] = useLocation();

  function openSearch(event: MouseEvent<HTMLButtonElement>) {
    triggerRef.current = event.currentTarget;
    setOpen(true);
  }

  function closeSearch() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.key === "/" && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        triggerRef.current = null;
        setOpen(true);
      }
      if (event.key === "Escape" && open) closeSearch();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    navigate(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        className="hidden items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors lg:flex"
        style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.48)" }}
        aria-label="Buscar en Mexico Charts"
      >
        <Search className="h-3.5 w-3.5" />
        Buscar
      </button>

      <button
        type="button"
        onClick={openSearch}
        className="flex h-9 w-9 items-center justify-center rounded-lg lg:hidden"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
      </button>

      {open && <SearchDialog onClose={closeSearch} onNavigate={go} />}
    </>
  );
}

function SearchDialog({ onClose, onNavigate }: { onClose: () => void; onNavigate: (href: string) => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = "site-search-title";
  const resultsId = "site-search-results";
  const { byKey } = useArtistMetadata();
  const normalizedQuery = norm(query.trim());
  const deepSearchEnabled = normalizedQuery.length >= 2;
  const { data: chartData } = useChartsHub({ enabled: deepSearchEnabled, retry: 1 });
  const { data: certificationRows = [] } = useQuery<CertRow[]>({
    queryKey: ["search", "certifications"],
    queryFn: async () => {
      const resp = await fetch(`${import.meta.env.BASE_URL}certifications.json`);
      if (!resp.ok) return [];
      const data = await resp.json() as { rows?: CertRow[] };
      return data.rows ?? [];
    },
    enabled: deepSearchEnabled,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const { data: touringArtists = [] } = useTouring({ enabled: deepSearchEnabled, retry: 1 });

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = normalizedQuery;
    const includeDeep = deepSearchEnabled;
    const artists: SearchCandidate[] = Array.from(byKey.values()).map(artist => ({
      label: artist.displayName,
      href: `/artist/${slugify(artist.displayName)}`,
      type: "Artista",
      detail: [artist.subgenre || artist.genre, artist.spotifyListenersFmt].filter(Boolean).join(" · "),
      score: 0,
      baseScore: 170,
      category: "artist",
      dedupeKey: `artist:${slugify(artist.displayName)}`,
      haystack: norm(`${artist.displayName} ${artist.artistKey} ${artist.genre} ${artist.subgenre} ${artist.label}`),
    }));

    const staticRows: SearchCandidate[] = STATIC_RESULTS.map(row => ({
      ...row,
      score: 0,
      baseScore: 150,
      category: "site",
      dedupeKey: `site:${row.href}`,
      haystack: norm(`${row.label} ${row.type} ${row.detail}`),
    }));

    const genreRows: SearchCandidate[] = GENRE_RESULTS.map(row => ({
      ...row,
      score: 0,
      baseScore: 90,
      category: "genre",
      dedupeKey: `genre:${norm(row.label)}`,
      haystack: norm(`${row.label} ${row.type} ${row.detail}`),
    }));

    const chartRows: SearchCandidate[] = includeDeep && chartData?.sheets
      ? Object.entries(chartData.sheets).flatMap(([sheetId, sheet]) => {
        const meta = CHART_META[sheetId] ?? { platform: "Listas", label: sheetId.replace(/_/g, " "), period: "" };
        return sheet.rows.slice(0, 250).map((row, index) => {
          const title = chartTitle(row);
          const artist = chartArtist(row);
          const rank = chartRank(row, index);
          return {
            label: title,
            href: `/charts?platform=${encodeURIComponent(meta.platform)}&sheet=${encodeURIComponent(sheetId)}`,
            type: "Chart",
            detail: [`#${rank}`, artist, meta.platform, meta.label, meta.period].filter(Boolean).join(" · "),
            score: 0,
            baseScore: 55,
            category: "chart",
            dedupeKey: `chart:${norm(title)}:${norm(artist)}`,
            haystack: norm(`${title} ${artist} ${meta.platform} ${meta.label} ${meta.period} ${sheetId}`),
          };
        });
      })
      : [];

    const certRows: SearchCandidate[] = includeDeep
      ? certificationRows.slice(0, 1000).map(row => ({
        label: row.titulo || "Certificación",
        href: `/industry/certifications?artist=${encodeURIComponent(row.artista)}`,
        type: "Certificación",
        detail: [row.artista, row.certificacion || row.nivel, row.year].filter(Boolean).join(" · "),
        score: 0,
        baseScore: 48,
        category: "certification",
        dedupeKey: `cert:${norm(row.artista)}:${norm(row.titulo)}:${norm(row.certificacion || row.nivel)}`,
        haystack: norm(`${row.artista} ${row.titulo} ${row.certificacion} ${row.nivel} ${row.year}`),
      }))
      : [];

    const touringRows: SearchCandidate[] = includeDeep
      ? touringArtists.flatMap(artist => {
        const artistRow: SearchCandidate = {
          label: artist.name,
          href: `/touring/${artist.id || slugify(artist.name)}`,
          type: "Gira",
          detail: artist.events.length ? `${artist.events.length} fechas activas` : "Perfil de touring",
          score: 0,
          baseScore: 58,
          category: "touring",
          dedupeKey: `touring:${artist.id || slugify(artist.name)}`,
          haystack: norm(`${artist.name} gira touring conciertos ${artist.events.map(event => `${event.city} ${event.state} ${event.venue} ${event.name}`).join(" ")}`),
        };
        const eventRows = artist.events.slice(0, 3).map(event => ({
          label: `${event.city || event.venue} · ${artist.name}`,
          href: `/touring/${artist.id || slugify(artist.name)}`,
          type: "Concierto",
          detail: [artist.name, event.venue, event.state, event.date].filter(Boolean).join(" · "),
          score: 0,
          baseScore: 28,
          category: "event" as const,
          dedupeKey: `event:${artist.id || slugify(artist.name)}:${norm(event.date)}:${norm(event.venue)}:${norm(event.city)}`,
          haystack: norm(`${event.city} ${event.state} ${event.venue} ${event.date}`),
        }));
        return [artistRow, ...eventRows];
      })
      : [];

    if (!q) {
      return staticRows
        .filter(row => EMPTY_STATE_LINKS.includes(row.label as typeof EMPTY_STATE_LINKS[number]))
        .map(row => {
          const { haystack: _haystack, baseScore: _baseScore, ...result } = row;
          return { ...result, score: row.baseScore };
        });
    }

    const all = [...staticRows, ...artists, ...genreRows, ...chartRows, ...certRows, ...touringRows];
    const ranked = all
      .map(row => rankCandidate(row, q))
      .filter((row): row is SearchResult => row !== null && row.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

    return pruneRankedResults(ranked);
  }, [byKey, certificationRows, chartData, deepSearchEnabled, normalizedQuery, touringArtists]);

  return (
        <div className="fixed inset-0 z-[90] px-4 pt-20" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }} onMouseDown={onClose}>
          <div
            className="mx-auto max-w-2xl overflow-hidden rounded-xl"
            style={{ background: "linear-gradient(180deg,#0b0b0b,#050505)", border: "1px solid rgba(57,255,20,0.2)", boxShadow: "0 28px 80px rgba(0,0,0,0.72)" }}
            onMouseDown={event => event.stopPropagation()}
          >
            <h2 id={titleId} className="sr-only">Buscar en Mexico Charts</h2>
            <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <Search className="h-4 w-4" style={{ color: G }} />
              <input
                type="search"
                ref={inputRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && results[0]) onNavigate(results[0].href);
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                placeholder="Buscar artista, canción, chart, certificado, gira..."
                aria-label="Buscar artista, canción, chart, certificado o gira"
                aria-controls={resultsId}
              />
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/40 hover:text-white" aria-label="Cerrar búsqueda">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div id={resultsId} className="max-h-[65vh] overflow-y-auto p-2" aria-live="polite">
              {results.map(result => (
                <button
                  key={result.dedupeKey ?? `${result.type}-${result.href}-${result.label}-${result.detail}`}
                  type="button"
                  onClick={() => onNavigate(result.href)}
                  aria-label={`${result.label}. ${result.detail}. ${result.type}`}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-white/[0.045]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white">{result.label}</span>
                    <span className="mt-1 block truncate text-[11px]" style={{ color: "rgba(255,255,255,0.42)" }}>{result.detail}</span>
                  </span>
                  <span className="rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: G, background: "rgba(57,255,20,0.09)", border: "1px solid rgba(57,255,20,0.18)" }}>
                    {result.type}
                  </span>
                </button>
              ))}
              {results.length === 0 && (
                <div className="px-4 py-10 text-center text-sm font-bold" style={{ color: "rgba(255,255,255,0.38)" }}>
                  Sin resultados para esa búsqueda.
                </div>
              )}
              {!query.trim() && (
                <div className="px-4 pb-4 pt-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.28)" }}>
                  Tip: busca artistas, canciones, certificaciones, ciudades o géneros.
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
