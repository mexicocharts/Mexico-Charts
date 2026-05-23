import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Copy, ExternalLink, KeyRound, RefreshCw, Search } from "lucide-react";
import { SiMusicbrainz, SiSpotify } from "react-icons/si";
import PageSEO from "@/components/PageSEO";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

interface Candidate {
  spotifyArtistId?: string;
  spotifyName?: string;
  spotifyUrl?: string | null;
  imageUrl?: string | null;
  followers?: number | null;
  popularity?: number | null;
  mbid?: string;
  name?: string;
  type?: string | null;
  country?: string | null;
  areaName?: string | null;
  disambiguation?: string | null;
  score: number;
  reasons: string[];
}

interface ReviewRow {
  provider: "spotify" | "musicbrainz";
  artistKey: string;
  artistName: string;
  bestScore: number;
  status: string;
  searchedAt: string;
  candidates: Candidate[];
}

interface ReviewResponse {
  totals: {
    spotify: number;
    spotifyReview: number;
    musicbrainz: number;
    musicbrainzReview: number;
  };
  spotify: ReviewRow[];
  musicbrainz: ReviewRow[];
}

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function candidateUrl(provider: ReviewRow["provider"], candidate: Candidate): string | null {
  if (provider === "spotify" && candidate.spotifyUrl) return candidate.spotifyUrl;
  if (provider === "musicbrainz" && candidate.mbid) return `https://musicbrainz.org/artist/${candidate.mbid}`;
  return null;
}

function candidateName(provider: ReviewRow["provider"], candidate: Candidate | undefined): string {
  if (!candidate) return "Sin candidato";
  return provider === "spotify" ? candidate.spotifyName ?? "Sin nombre" : candidate.name ?? "Sin nombre";
}

function candidateId(provider: ReviewRow["provider"], candidate: Candidate | undefined): string | null {
  if (!candidate) return null;
  return provider === "spotify" ? candidate.spotifyArtistId ?? null : candidate.mbid ?? null;
}

function candidateMeta(provider: ReviewRow["provider"], candidate: Candidate): string {
  if (provider === "spotify") {
    return [
      candidate.followers != null ? `${candidate.followers.toLocaleString("es-MX")} seguidores` : null,
      candidate.popularity != null ? `popularidad ${candidate.popularity}` : null,
    ].filter(Boolean).join(" · ") || "Perfil Spotify";
  }

  return [
    candidate.type,
    candidate.country,
    candidate.areaName,
    candidate.disambiguation,
  ].filter(Boolean).join(" · ") || "Ficha MusicBrainz";
}

export default function EnrichmentReview() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mexicocharts_admin_key") ?? "");
  const [draftKey, setDraftKey] = useState(adminKey);
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState<"todos" | ReviewRow["provider"]>("todos");
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState("");
  const [sortMode, setSortMode] = useState<"score" | "reciente" | "antiguo">("score");
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, number>>({});
  const [confirmingApproval, setConfirmingApproval] = useState<string | null>(null);

  const rows = useMemo(() => [...(data?.spotify ?? []), ...(data?.musicbrainz ?? [])], [data]);
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const scoreFloor = Number(minScore);
    const nextRows = rows.filter(row => {
      if (providerFilter !== "todos" && row.provider !== providerFilter) return false;
      if (Number.isFinite(scoreFloor) && minScore.trim() && row.bestScore < scoreFloor) return false;
      if (!normalizedQuery) return true;
      const candidateNames = row.candidates.map(candidate => candidateName(row.provider, candidate)).join(" ");
      const candidateDetails = row.candidates.map(candidate => candidateMeta(row.provider, candidate)).join(" ");
      const candidateIds = row.candidates.map(candidate => candidateId(row.provider, candidate) ?? "").join(" ");
      const haystack = `${row.artistName} ${row.artistKey} ${candidateNames} ${candidateDetails} ${candidateIds}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return nextRows.sort((a, b) => {
      if (sortMode === "reciente") return new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime();
      if (sortMode === "antiguo") return new Date(a.searchedAt).getTime() - new Date(b.searchedAt).getTime();
      return b.bestScore - a.bestScore;
    });
  }, [minScore, providerFilter, query, rows, sortMode]);

  async function loadReviewQueue(key = adminKey) {
    if (!key.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/artists/enrichment-candidates?limit=150", {
        headers: { "X-Admin-Key": key.trim() },
      });
      if (!res.ok) throw new Error(res.status === 403 ? "Clave de admin inválida." : "No se pudo cargar la cola.");
      setData(await res.json());
      setActionMessage(null);
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function saveKey() {
    const next = draftKey.trim();
    localStorage.setItem("mexicocharts_admin_key", next);
    setAdminKey(next);
    void loadReviewQueue(next);
  }

  async function reviewAction(row: ReviewRow, action: "approve" | "reject", candidateIndex = 0) {
    if (!adminKey.trim()) {
      setError("Guarda la clave admin primero.");
      return;
    }

    const key = `${row.provider}-${row.artistKey}`;
    setPendingKey(key);
    setError(null);
    setActionMessage(null);
    setConfirmingApproval(null);
    try {
      const res = await fetch(`/api/admin/artists/enrichment-candidates/${row.provider}/${encodeURIComponent(row.artistKey)}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey.trim(),
        },
        body: JSON.stringify({ candidateIndex }),
      });
      if (!res.ok) throw new Error(action === "approve" ? "No se pudo aprobar este candidato." : "No se pudo rechazar este candidato.");
      await loadReviewQueue(adminKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPendingKey(null);
    }
  }

  function resetFilters() {
    setProviderFilter("todos");
    setQuery("");
    setMinScore("");
    setSortMode("score");
    setSelectedCandidates({});
    setConfirmingApproval(null);
  }

  async function copyVisibleRows() {
    const lines = visibleRows.map(row => {
      const selectedIndex = selectedCandidates[`${row.provider}-${row.artistKey}`] ?? 0;
      const best = row.candidates[selectedIndex] ?? row.candidates[0];
      const displayName = candidateName(row.provider, best);
      const id = candidateId(row.provider, best);
      return `${row.artistName} | ${row.provider} | ${displayName} | ${id ?? "sin ID"} | score ${best?.score ?? row.bestScore}`;
    });

    if (lines.length === 0) {
      setActionMessage("No hay candidatos visibles para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setActionMessage("Candidatos visibles copiados.");
    } catch {
      setActionMessage("Candidatos visibles listos para copiar manualmente.");
    }
  }

  useEffect(() => {
    if (adminKey) void loadReviewQueue(adminKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-zinc-200">
      <PageSEO
        title="Revisión de enriquecimiento | Mexico Charts"
        description="Cola interna para revisar posibles coincidencias de Spotify y MusicBrainz en Mexico Charts."
        path="/admin/enrichment-review"
        noindex
      />

      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-6">
          <Link href="/" className="shrink-0">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90" />
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="h-3.5 w-3.5" />
            Admin
          </Link>
          <Link href="/admin/api-coverage" className="ml-auto inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#39FF14] hover:text-white">
            Cobertura API
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </nav>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#39FF14]">Enriquecimiento de artistas</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">Cola de revisión</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Coincidencias que no se guardaron automáticamente. Sirve para revisar nombres dudosos antes de verificar IDs.
            </p>
          </div>

          <div className="flex w-full max-w-md gap-2">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <input
                value={draftKey}
                onChange={e => setDraftKey(e.target.value)}
                type="password"
                placeholder="Clave admin"
                className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
              />
            </div>
            <button
              type="button"
              onClick={saveKey}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#39FF14]/35 bg-[#39FF14]/10 px-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/16"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Cargar
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
            {error}
          </div>
        )}

        {actionMessage && (
          <div className="rounded-lg border border-[#39FF14]/25 bg-[#39FF14]/10 px-4 py-3 text-sm font-bold text-[#baffb0]">
            {actionMessage}
          </div>
        )}

        {data && (
          <section className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-black text-white">{data.totals.spotifyReview}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Spotify por revisar</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-black text-white">{data.totals.musicbrainzReview}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">MusicBrainz por revisar</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-black text-white">{data.totals.spotify}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Candidatos Spotify</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-black text-white">{data.totals.musicbrainz}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Candidatos MusicBrainz</div>
            </div>
          </section>
        )}

        {data && (
          <section className="rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white">Filtrar revisión</h2>
                <p className="mt-1 text-xs font-bold text-zinc-600">
                  {visibleRows.length} de {rows.length} candidatos visibles.
                </p>
              </div>
              <div className="relative lg:ml-auto lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar artista o candidato"
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["todos", "spotify", "musicbrainz"] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setProviderFilter(option)}
                    className={`h-10 rounded-lg border px-3 text-[10px] font-black uppercase tracking-[0.14em] ${
                      providerFilter === option
                        ? "border-[#39FF14]/35 bg-[#39FF14]/10 text-[#39FF14]"
                        : "border-white/10 bg-white/[0.03] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                    }`}
                  >
                    {option === "todos" ? "Todos" : option}
                  </button>
                ))}
                <input
                  value={minScore}
                  onChange={e => setMinScore(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                  inputMode="numeric"
                  placeholder="Score min."
                  className="h-10 w-28 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
              <span className="flex h-9 items-center text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Orden</span>
              {([
                ["score", "Score alto"],
                ["reciente", "Reciente"],
                ["antiguo", "Antiguo"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSortMode(value)}
                  className={`h-9 rounded-lg border px-3 text-[10px] font-black uppercase tracking-[0.14em] ${
                    sortMode === value
                      ? "border-[#39FF14]/35 bg-[#39FF14]/10 text-[#39FF14]"
                      : "border-white/10 bg-white/[0.03] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 hover:border-red-500/30 hover:text-red-300"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={() => void copyVisibleRows()}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#39FF14] hover:bg-[#39FF14]/15"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar visibles
              </button>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          {visibleRows.map(row => {
            const icon = row.provider === "spotify"
              ? <SiSpotify className="h-4 w-4 text-[#1DB954]" />
              : <SiMusicbrainz className="h-4 w-4 text-[#f59e0b]" />;
            const rowKey = `${row.provider}-${row.artistKey}`;
            const selectedIndex = selectedCandidates[rowKey] ?? 0;
            const best = row.candidates[selectedIndex] ?? row.candidates[0];
            const url = best ? candidateUrl(row.provider, best) : null;
            const displayName = candidateName(row.provider, best);
            const selectedId = candidateId(row.provider, best);
            const isPending = pendingKey === rowKey;
            const confirmKey = `${rowKey}-${selectedIndex}`;
            const isConfirming = confirmingApproval === confirmKey;

            return (
              <article key={`${row.provider}-${row.artistKey}`} className="rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-black uppercase tracking-[0.05em] text-white">{row.artistName}</h2>
                        <span className="rounded border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">{row.provider}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">
                        Candidato seleccionado: <span className="font-bold text-zinc-400">{displayName}</span>
                        {selectedId && <span> · ID {selectedId}</span>}
                        {best?.score != null && <span> · score {best.score}</span>}
                        <span> · {fmtDate(row.searchedAt)}</span>
                      </p>
                      {best?.reasons?.length > 0 && (
                        <p className="mt-1 text-xs text-zinc-700">{best.reasons.join(" · ")}</p>
                      )}
                      {isConfirming && (
                        <p className="mt-2 rounded border border-[#39FF14]/20 bg-[#39FF14]/10 px-2 py-1.5 text-xs font-bold text-[#baffb0]">
                          Confirma que quieres guardar este candidato: {displayName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => void reviewAction(row, "reject")}
                      className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 hover:border-red-500/35 hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      disabled={isPending || !best}
                      onClick={() => {
                        if (!isConfirming) {
                          setConfirmingApproval(confirmKey);
                          return;
                        }
                        void reviewAction(row, "approve", selectedIndex);
                      }}
                      className="rounded-lg border border-[#39FF14]/35 bg-[#39FF14]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/16 disabled:cursor-wait disabled:opacity-50"
                    >
                      {isConfirming ? "Confirmar" : "Aprobar"}
                    </button>
                    <Link
                      href={`/artist/${row.artistKey.replace(/\s+/g, "-")}`}
                      className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:border-white/25 hover:text-white"
                    >
                      Perfil
                    </Link>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-[#39FF14]/30 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/10"
                      >
                        Abrir
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                {row.candidates.length > 1 && (
                  <div className="mt-4 grid gap-2 border-t border-white/[0.06] pt-4 md:grid-cols-2 xl:grid-cols-3">
                    {row.candidates.slice(0, 6).map((candidate, index) => {
                      const candidateHref = candidateUrl(row.provider, candidate);
                      const id = candidateId(row.provider, candidate);
                      const active = selectedIndex === index;
                      return (
                        <button
                          key={`${rowKey}-${index}`}
                          type="button"
                          onClick={() => {
                            setSelectedCandidates(prev => ({ ...prev, [rowKey]: index }));
                            setConfirmingApproval(null);
                          }}
                          className={`min-w-0 rounded-lg border p-3 text-left transition-colors ${
                            active
                              ? "border-[#39FF14]/40 bg-[#39FF14]/10"
                              : "border-white/[0.06] bg-black/20 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${
                              active ? "border-[#39FF14]/30 text-[#39FF14]" : "border-white/10 text-zinc-600"
                            }`}>
                              #{index + 1}
                            </span>
                            <span className="ml-auto text-[10px] font-black text-zinc-500">Score {candidate.score}</span>
                          </div>
                          <div className="mt-2 truncate text-sm font-black text-white">{candidateName(row.provider, candidate)}</div>
                          <div className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-zinc-600">
                            {candidateMeta(row.provider, candidate)}
                          </div>
                          {id && (
                            <div className="mt-2 truncate text-[10px] font-bold text-zinc-700">
                              ID {id}
                            </div>
                          )}
                          {candidateHref && (
                            <a
                              href={candidateHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={event => event.stopPropagation()}
                              className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#39FF14] hover:text-white"
                            >
                              Abrir candidato
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}

          {data && rows.length === 0 && (
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-8 text-center text-sm font-bold text-zinc-500">
              No hay candidatos pendientes de revisión.
            </div>
          )}
          {data && rows.length > 0 && visibleRows.length === 0 && (
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-8 text-center text-sm font-bold text-zinc-500">
              No hay candidatos con esos filtros.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
