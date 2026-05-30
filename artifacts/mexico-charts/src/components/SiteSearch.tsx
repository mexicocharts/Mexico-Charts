import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, X } from "lucide-react";
import { useArtistMetadata } from "@/services/dataProvider";
import { slugify } from "@/lib/utils";

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

function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type SearchResult = {
  label: string;
  href: string;
  type: string;
  detail: string;
  score: number;
};

export default function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { byKey } = useArtistMetadata();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.key === "/" && !typing) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    const q = norm(query.trim());
    const artists = Array.from(byKey.values()).map(artist => ({
      label: artist.displayName,
      href: `/artist/${slugify(artist.displayName)}`,
      type: "Artista",
      detail: [artist.subgenre || artist.genre, artist.spotifyListenersFmt].filter(Boolean).join(" · "),
      score: 0,
      haystack: norm(`${artist.displayName} ${artist.artistKey} ${artist.genre} ${artist.subgenre} ${artist.label}`),
    }));

    const staticRows = STATIC_RESULTS.map(row => ({
      ...row,
      score: 0,
      haystack: norm(`${row.label} ${row.type} ${row.detail}`),
    }));

    const all = [...staticRows, ...artists];
    const ranked = all
      .map(row => {
        if (!q) return { ...row, score: row.type === "Artista" ? 1 : 2 };
        if (norm(row.label) === q) return { ...row, score: 100 };
        if (norm(row.label).startsWith(q)) return { ...row, score: 80 };
        if (row.haystack.includes(q)) return { ...row, score: 50 };
        return { ...row, score: 0 };
      })
      .filter(row => row.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, "es", { sensitivity: "base" }))
      .slice(0, 9);

    return ranked.map(({ haystack: _haystack, ...row }) => row);
  }, [byKey, query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    navigate(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors lg:flex"
        style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.48)" }}
        aria-label="Buscar en Mexico Charts"
      >
        <Search className="h-3.5 w-3.5" />
        Buscar
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg lg:hidden"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] px-4 pt-20" style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }} onMouseDown={() => setOpen(false)}>
          <div
            className="mx-auto max-w-2xl overflow-hidden rounded-xl"
            style={{ background: "linear-gradient(180deg,#0b0b0b,#050505)", border: "1px solid rgba(57,255,20,0.2)", boxShadow: "0 28px 80px rgba(0,0,0,0.72)" }}
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <Search className="h-4 w-4" style={{ color: G }} />
              <input
                ref={inputRef}
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && results[0]) go(results[0].href);
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/25"
                placeholder="Buscar artista, chart, género, gira..."
              />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/40 hover:text-white" aria-label="Cerrar búsqueda">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-2">
              {results.map(result => (
                <button
                  key={`${result.type}-${result.href}`}
                  type="button"
                  onClick={() => go(result.href)}
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
                  Tip: usa <span style={{ color: G }}>/</span> o Cmd K para abrir búsqueda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
