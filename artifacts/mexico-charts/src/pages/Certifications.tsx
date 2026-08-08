import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ExternalLink, Home, ChevronRight,
  ChevronDown, ChevronUp, X, Trophy, Disc3, Music2,
  ArrowUpDown
} from "lucide-react";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { formatCertificationLevels } from "@/lib/certificationLabels";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const G = "#39FF14";
const BASE = import.meta.env.BASE_URL;
const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ?? "https://mexicochart.com";
const CERT_IMG: Record<string, string> = {
  DIAMANTE: `${BASE}cert-diamond.png`,
  PLATINO:  `${BASE}cert-platinum.png`,
  ORO:      `${BASE}cert-gold.png`,
};
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const STAT_BORDER = "1px solid rgba(255,255,255,0.07)";

const PAGE_SIZE = 60;

type CertRow = {
  artista: string;
  titulo: string;
  disquera: string;
  formato: string;
  certificacion: string;
  nivel: string;
  fechaISO: string | null;
  year: number | null;
  diamante: number;
  platino: number;
  oro: number;
  totalLevels: number;
};

type ArtistSummary = {
  artista: string;
  rows: number;
  diamante: number;
  platino: number;
  oro: number;
  totalLevels: number;
  albums: number;
  singles: number;
  latestDate: string | null;
};

type Data = { rows: CertRow[]; artistSummary: ArtistSummary[]; meta: { total: number; updated: string } };

function FadeUp({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className}
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

/* Parse certificacion string → sorted highest-first list */
function parseCerts(cert: string): string[] {
  if (!cert) return [];
  const u = cert.toUpperCase();
  const out: string[] = [];
  if (u.includes("DIAMANTE")) out.push("DIAMANTE");
  if (u.includes("PLATINO")) out.push("PLATINO");
  if (u.includes("ORO")) out.push("ORO");
  return out.length ? out : ["ORO"];
}

function CertBadge({ cert }: { cert: string }) {
  const parts = parseCerts(cert);
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map(p => (
        <img
          key={p}
          src={CERT_IMG[p]}
          alt={p}
          title={p === "DIAMANTE" ? "Diamante" : p === "PLATINO" ? "Platino" : "Oro"}
          width={36}
          height={36}
          style={{ objectFit: "contain", display: "block" }}
        />
      ))}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${months[parseInt(m) - 1]} ${y}`;
}

/* Highest cert tier for sorting */
function tierOf(row: CertRow) {
  if (row.diamante > 0) return 3;
  if (row.platino > 0) return 2;
  return 1;
}

function artistSearchHref(artist: string) {
  return `/artists?q=${encodeURIComponent(artist)}`;
}

function artistLinkHref(artist: string) {
  return canonicalArtistHref(artist) ?? artistSearchHref(artist);
}

export default function Certifications() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  /* Pre-fill search from ?artist= query param */
  const searchStr = useSearch();
  const initialArtist = useMemo(() => {
    const p = new URLSearchParams(searchStr);
    return p.get("artist") ?? "";
  }, [searchStr]);

  /* Filters */
  const [search, setSearch] = useState(initialArtist);
  const [filterCert, setFilterCert] = useState<"" | "DIAMANTE" | "PLATINO" | "ORO">("");
  const [filterFormat, setFilterFormat] = useState<"" | "Álbum" | "Single">("");
  const [filterYear, setFilterYear] = useState("");
  const [sortBy, setSortBy] = useState<"fecha" | "artista" | "nivel" | "titulo">("fecha");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}certifications.json`)
      .then(r => r.json())
      .then((d: Data) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  /* Reset page on filter change */
  useEffect(() => { setPage(1); }, [search, filterCert, filterFormat, filterYear, sortBy, sortDir]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.artista.toLowerCase().includes(q) ||
        r.titulo.toLowerCase().includes(q) ||
        r.disquera.toLowerCase().includes(q)
      );
    }
    if (filterCert) {
      rows = rows.filter(r => {
        const u = r.certificacion.toUpperCase();
        return u.includes(filterCert);
      });
    }
    if (filterFormat) {
      rows = rows.filter(r => r.formato === filterFormat);
    }
    if (filterYear) {
      rows = rows.filter(r => r.year?.toString() === filterYear);
    }

    rows = [...rows].sort((a, b) => {
      let v = 0;
      if (sortBy === "fecha") v = (a.fechaISO || "").localeCompare(b.fechaISO || "");
      else if (sortBy === "artista") v = a.artista.localeCompare(b.artista);
      else if (sortBy === "nivel") v = (a.totalLevels || 0) - (b.totalLevels || 0);
      else if (sortBy === "titulo") v = a.titulo.localeCompare(b.titulo);
      return sortDir === "desc" ? -v : v;
    });

    return rows;
  }, [data, search, filterCert, filterFormat, filterYear, sortBy, sortDir]);

  const pageRows = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = pageRows.length < filtered.length;

  const years = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.rows.map(r => r.year).filter(Boolean))].sort((a, b) => (b as number) - (a as number)) as number[];
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return null;
    const rows = data.rows;
    return {
      total: rows.length,
      diamante: rows.reduce((s, r) => s + r.diamante, 0),
      platino: rows.reduce((s, r) => s + r.platino, 0),
      oro: rows.reduce((s, r) => s + r.oro, 0),
      albums: rows.filter(r => r.formato === "Álbum").length,
      singles: rows.filter(r => r.formato === "Single").length,
    };
  }, [data]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  function SortIcon({ col }: { col: typeof sortBy }) {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3" style={{ color: G }} /> : <ChevronUp className="w-3 h-3" style={{ color: G }} />;
  }

  const activeFilters = [filterCert, filterFormat, filterYear].filter(Boolean).length + (search ? 1 : 0);

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <PageSEO
        title="Certificaciones en México"
        description="Archivo filtrado de certificaciones musicales en México: Oro, Platino y Diamante por artista, título, formato y año."
        path="/industry/certifications"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Certificaciones en México",
          description: "Archivo filtrado de certificaciones musicales en México por artista, título, formato y año.",
          url: `${SITE_URL}/industry/certifications`,
          isPartOf: {
            "@type": "WebSite",
            name: "Mexico Charts",
            url: SITE_URL,
          },
        }}
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 639px) {
          .cert-stat-cell:nth-child(2n) > div { border-right: 0 !important; }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .cert-stat-cell:nth-child(3n) > div { border-right: 0 !important; }
        }
      ` }} />

      <SiteNav />

      {/* BREADCRUMB */}
      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.4)" }} />
        <Link href="/industria"><span className="text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>Industria</span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.4)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.85)" }}>Certificaciones</span>
      </div>

      {/* HERO */}
      <section className="px-6 lg:px-10 pt-14 pb-10" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <FadeUp>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] mb-5" style={{ color: G }}>Industria / Certificaciones</p>
        </FadeUp>
        <FadeUp delay={0.04}>
          <h1 className="font-black uppercase leading-[0.9] mb-5"
            style={{ fontSize: "clamp(2rem, 4.5vw, 4.8rem)", letterSpacing: "-0.035em" }}>
            Certificaciones<br />en México
          </h1>
        </FadeUp>
        <FadeUp delay={0.08}>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.6)", maxWidth: 580, fontFamily: "system-ui" }}>
            Un archivo filtrado de certificaciones otorgadas en México a artistas mexicanos y colaboraciones con participación mexicana.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.55)" }}>Fuente:</span>
            <a href="https://amprofon.com.mx/es/pages/certificaciones.php" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-75 transition-opacity" style={{ color: G }}>
              AMPROFON <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </FadeUp>
      </section>

      {/* STAT STRIP */}
      {stats && (
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { icon: Trophy,       v: stats.total.toLocaleString("es-MX"),    l: "Registros de\ncertificación",  hi: false },
              { icon: Trophy,       v: stats.diamante.toLocaleString("es-MX"), l: "Niveles\nDiamante",            hi: true  },
              { icon: Trophy,       v: stats.platino.toLocaleString("es-MX"),  l: "Niveles\nPlatino",             hi: false },
              { icon: Trophy,       v: stats.oro.toLocaleString("es-MX"),      l: "Niveles\nOro",                 hi: false },
              { icon: Disc3,        v: stats.albums.toLocaleString("es-MX"),   l: "Álbumes\ncertificados",        hi: false },
              { icon: Music2,       v: stats.singles.toLocaleString("es-MX"),  l: "Singles\ncertificados",        hi: false },
            ].map(({ icon: Icon, v, l, hi }, i) => (
              <FadeUp key={i} delay={i * 0.04} className="cert-stat-cell">
                <div className="relative px-5 py-7"
                  style={{ borderRight: i < 5 ? STAT_BORDER : "none", background: hi ? "rgba(57,255,20,0.02)" : "transparent" }}>
                  {hi && <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(57,255,20,0.07) 0%, transparent 70%)" }} />}
                  <div className="font-black leading-none mb-1.5 relative z-10"
                    style={{ fontSize: "clamp(1.4rem, 2.2vw, 2rem)", letterSpacing: "-0.04em", color: hi ? G : "#fff", textShadow: hi ? `0 0 24px ${G}55` : "none" }}>{v}</div>
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] leading-relaxed relative z-10"
                    style={{ color: "rgba(255,255,255,0.6)", whiteSpace: "pre-line" }}>{l}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      )}

      {/* SEARCH + FILTERS */}
      <div className="sticky top-14 z-40 px-6 lg:px-10 py-4 flex flex-wrap items-center gap-3"
        style={{ background: "rgba(8,8,8,0.97)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input
            type="text"
            placeholder="Artista, título o disquera…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-xs font-medium rounded-lg outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "system-ui" }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              aria-label="Limpiar búsqueda"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cert filter */}
          {(["DIAMANTE", "PLATINO", "ORO"] as const).map(c => {
            const active = filterCert === c;
            const label = c === "DIAMANTE" ? "Diamante" : c === "PLATINO" ? "Platino" : "Oro";
            return (
              <button key={c} type="button" onClick={() => setFilterCert(active ? "" : c)}
                aria-pressed={active}
                aria-label={`Filtrar certificaciones por ${label}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.14em] transition-all"
                style={{
                  background: active ? `${G}12` : "rgba(255,255,255,0.06)",
                  border: active ? `1px solid ${G}45` : "1px solid rgba(255,255,255,0.1)",
                  color: active ? G : "rgba(255,255,255,0.5)",
                }}>
                <img src={CERT_IMG[c]} alt={label} width={18} height={18} style={{ objectFit: "contain", display: "block" }} />
                {label}
              </button>
            );
          })}

          {/* Format filter */}
          {(["Álbum", "Single"] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilterFormat(filterFormat === f ? "" : f)}
              aria-pressed={filterFormat === f}
              aria-label={`Filtrar certificaciones por formato ${f}`}
              className="px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.14em] transition-all"
              style={{
                background: filterFormat === f ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                border: filterFormat === f ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.1)",
                color: filterFormat === f ? "#fff" : "rgba(255,255,255,0.5)",
              }}>
              {f}
            </button>
          ))}

          {/* Year select */}
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            className="px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.1em]"
            style={{ background: filterYear ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", border: filterYear ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.1)", color: filterYear ? "#fff" : "rgba(255,255,255,0.5)" }}>
            <option value="">Año</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Clear all */}
          {activeFilters > 0 && (
            <button type="button" onClick={() => { setSearch(""); setFilterCert(""); setFilterFormat(""); setFilterYear(""); }}
              aria-label="Limpiar todos los filtros"
              className="px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-[0.14em] flex items-center gap-1.5"
              style={{ background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.2)", color: "rgba(255,120,120,0.8)" }}>
              <X className="w-3 h-3" /> Limpiar ({activeFilters})
            </button>
          )}
        </div>

        <div className="ml-auto text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "rgba(255,255,255,0.3)" }}>
          {filtered.length.toLocaleString("es-MX")} resultados
        </div>
      </div>

      {/* TABLE */}
      <div className="px-6 lg:px-10 py-8" ref={tableRef}>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <Disc3 className="w-8 h-8" style={{ color: G }} />
            </motion.div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {/* Header */}
              <div className="grid text-[9px] font-black uppercase tracking-[0.18em] px-5 py-3"
                style={{ gridTemplateColumns: "2fr 2.5fr 1.2fr 1.6fr 0.7fr 1.1fr 1.5fr", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}>
                {[
                  { label: "Artista", col: "artista" as const },
                  { label: "Título", col: "titulo" as const },
                  { label: "Formato", col: null },
                  { label: "Certificación", col: null },
                  { label: "Nivel", col: "nivel" as const },
                  { label: "Fecha", col: "fecha" as const },
                  { label: "Disquera", col: null },
                ].map(({ label, col }) => (
                  <button key={label}
                    onClick={() => col && toggleSort(col)}
                    className={`flex items-center gap-1 text-left ${col ? "cursor-pointer hover:text-white transition-colors" : "cursor-default"}`}
                    style={{ color: col && sortBy === col ? "rgba(255,255,255,0.85)" : undefined }}>
                    {label}
                    {col && <SortIcon col={col} />}
                  </button>
                ))}
              </div>

              {/* Rows */}
              <AnimatePresence>
                {pageRows.map((row, i) => (
                  <motion.div key={`${row.artista}-${row.titulo}-${i}`}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: Math.min(i * 0.008, 0.2) }}
                    className="grid px-5 py-3.5 items-center group"
                    style={{
                      gridTemplateColumns: "2fr 2.5fr 1.2fr 1.6fr 0.7fr 1.1fr 1.5fr",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)"
                    }}>
                    <Link href={artistLinkHref(row.artista)} className="min-w-0 pr-2">
                      <span className="block truncate text-xs font-black text-white underline decoration-white/15 underline-offset-4 transition-colors hover:text-[#39FF14] hover:decoration-[#39FF14]/45">
                        {row.artista}
                      </span>
                    </Link>
                    <div className="text-xs truncate pr-2" style={{ color: "rgba(255,255,255,0.75)", fontFamily: "system-ui" }}>{row.titulo}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {row.formato === "Álbum" ? "Álbum" : row.formato === "Single" ? "Single" : "—"}
                    </div>
                    <CertBadge cert={row.certificacion} />
                    <div className="text-xs font-black" style={{ color: "rgba(255,255,255,0.85)" }}>{formatCertificationLevels(row.certificacion, row.nivel)}</div>
                    <div className="text-[10px] font-black" style={{ color: "rgba(255,255,255,0.7)" }}>{formatDate(row.fechaISO)}</div>
                    <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui" }}>{row.disquera || "—"}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden space-y-3">
              {pageRows.map((row, i) => (
                <FadeUp key={`m-${row.artista}-${row.titulo}-${i}`} delay={Math.min(i * 0.02, 0.3)}>
                  <div className="rounded-xl p-4" style={{ background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <Link href={artistLinkHref(row.artista)}>
                          <span className="font-black text-sm text-white underline decoration-white/15 underline-offset-4 transition-colors hover:text-[#39FF14] hover:decoration-[#39FF14]/45">
                            {row.artista}
                          </span>
                        </Link>
                        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui" }}>{row.titulo}</div>
                      </div>
                      <div className="shrink-0"><CertBadge cert={row.certificacion} /></div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-black uppercase tracking-[0.1em]" style={{ color: "rgba(255,255,255,0.65)" }}>
                      <span>{row.formato === "Álbum" ? "Álbum" : row.formato === "Single" ? "Single" : "—"}</span>
                      <span>Niveles: {formatCertificationLevels(row.certificacion, row.nivel)}</span>
                      <span>{formatDate(row.fechaISO)}</span>
                    </div>
                    {row.disquera && (
                      <div className="mt-1.5 text-[9px]" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "system-ui" }}>{row.disquera}</div>
                    )}
                  </div>
                </FadeUp>
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button onClick={() => setPage(p => p + 1)}
                  className="px-8 py-3 rounded-xl text-xs font-black uppercase tracking-[0.18em] transition-all hover:opacity-80"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                  Cargar más — {filtered.length - pageRows.length} restantes
                </button>
              </div>
            )}

            {filtered.length === 0 && !loading && (
              <div className="py-20 text-center">
                <Disc3 className="w-10 h-10 mx-auto mb-4 opacity-15" />
                <p className="text-sm font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Sin resultados</p>
                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "system-ui" }}>Intenta con otros filtros</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* DISCLAIMER */}
      <div className="px-6 lg:px-10 py-8 mt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#060606" }}>
        <div className="max-w-3xl space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
            Fuente y Metodología
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "system-ui" }}>
            Las certificaciones mostradas corresponden a información pública atribuida a AMPROFON. Mexico Charts presenta una vista editorial y organizada enfocada en artistas mexicanos y colaboraciones con participación mexicana. Mexico Charts no reproduce el sitio oficial de AMPROFON, no utiliza sus elementos visuales protegidos y no emite certificaciones oficiales.
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "system-ui" }}>
            Mexico Charts organiza y presenta información pública sobre certificaciones otorgadas en México. Mexico Charts no está afiliado a AMPROFON y no emite certificaciones oficiales.
          </p>
          <a href="https://amprofon.com.mx/es/pages/certificaciones.php" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-75 transition-opacity mt-2" style={{ color: G }}>
            Ver fuente oficial <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <footer className="px-6 lg:px-10 py-6 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/"><img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-35 cursor-pointer hover:opacity-55 transition-opacity" /></Link>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.48)" }}>© 2026 Mexico Charts</p>
      </footer>
    </div>
  );
}
