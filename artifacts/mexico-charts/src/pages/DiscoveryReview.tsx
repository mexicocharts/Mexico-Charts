import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";
import { ArrowLeft, Check, ExternalLink, KeyRound, Link2, RefreshCw, Search, X } from "lucide-react";
import PageSEO from "@/components/PageSEO";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

type CandidateStatus =
  | "pending"
  | "likely_mexican"
  | "needs_review"
  | "approved"
  | "rejected"
  | "linked_existing_artist"
  | "not_mexican";

type StatusFilter = CandidateStatus | "all";

interface SourceCount {
  source: string;
  count: number;
}

interface DiscoveryCandidate {
  id: number;
  artist_name: string;
  normalized_name: string;
  status: CandidateStatus;
  confidence_score: number;
  first_seen_date: string | null;
  last_seen_date: string | null;
  total_appearances: number;
  source_count: number;
  notes: string | null;
  matched_artist_id: string | null;
  created_at: string;
  updated_at: string;
  top_sources?: SourceCount[];
  positive_signal_count?: number;
  negative_signal_count?: number;
  needs_review_reason?: string | null;
}

interface DiscoveryEvent {
  id: number;
  source: string;
  chart_type: string;
  chart_date: string;
  rank: number | null;
  song_or_video_title: string | null;
  metadata: {
    sheetName?: string;
    artistCredit?: string;
  } | null;
}

interface DiscoverySignal {
  id: number;
  signal_type: string;
  source: string;
  value: string;
  confidence_weight: number;
  created_at: string;
}

interface OfficialArtist {
  artist_key: string;
  artist_name: string;
  normalized_name: string;
  source: string;
  discovery_candidate_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CandidateAuditEntry {
  id: number;
  action: string;
  artist_key: string | null;
  previous_status: string | null;
  next_status: string | null;
  note: string | null;
  actor: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface CandidateListResponse {
  candidates: DiscoveryCandidate[];
  counts: Array<{ status: CandidateStatus; count: number }>;
  sources: SourceCount[];
}

interface CandidateDetailResponse {
  candidate: DiscoveryCandidate;
  events: DiscoveryEvent[];
  recentAppearances: DiscoveryEvent[];
  signals: DiscoverySignal[];
  topSources: SourceCount[];
  auditEntries: CandidateAuditEntry[];
  officialArtist: OfficialArtist | null;
}

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "likely_mexican", label: "Probables MX" },
  { value: "needs_review", label: "Revisar" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
  { value: "linked_existing_artist", label: "Vinculados" },
  { value: "not_mexican", label: "No mexicanos" },
];

const sortOptions = [
  { value: "appearances", label: "Mas apariciones" },
  { value: "first_seen", label: "Nuevo primero" },
  { value: "last_seen", label: "Mas reciente" },
  { value: "confidence", label: "Confianza" },
  { value: "source_count", label: "Mas fuentes" },
  { value: "name", label: "Nombre" },
] as const;

type SortValue = typeof sortOptions[number]["value"];

function statusLabel(status: StatusFilter) {
  return statusOptions.find(option => option.value === status)?.label ?? status;
}

function formatChartType(value: string) {
  return value.replace(/_/g, " ");
}

function artistKeyFromName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\by\b/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function errorMessage(status: number) {
  if (status === 401 || status === 403) return "Clave de admin invalida.";
  if (status === 404) return "No se encontro el candidato.";
  if (status === 409) return "Ese artista ya existe. Vincula el candidato al artist_key existente.";
  return "No se pudo cargar descubrimiento.";
}

export default function DiscoveryReview() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mexicocharts_admin_key") ?? "");
  const [draftKey, setDraftKey] = useState(adminKey);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [minAppearances, setMinAppearances] = useState("");
  const [confidenceMin, setConfidenceMin] = useState("");
  const [confidenceMax, setConfidenceMax] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<SortValue>("appearances");
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [counts, setCounts] = useState<CandidateListResponse["counts"]>([]);
  const [sources, setSources] = useState<SourceCount[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detail, setDetail] = useState<CandidateDetailResponse | null>(null);
  const [approvalArtistKey, setApprovalArtistKey] = useState("");
  const [linkArtistKey, setLinkArtistKey] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const unlocked = Boolean(adminKey.trim());

  const selectedCandidate = useMemo(
    () => candidates.find(candidate => candidate.id === selectedId) ?? detail?.candidate ?? null,
    [candidates, selectedId, detail],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function saveKey() {
    const next = draftKey.trim();
    if (!next) {
      clearKey();
      return;
    }
    localStorage.setItem("mexicocharts_admin_key", next);
    setAdminKey(next);
  }

  function clearKey() {
    localStorage.removeItem("mexicocharts_admin_key");
    setAdminKey("");
    setDraftKey("");
    setCandidates([]);
    setCounts([]);
    setSources([]);
    setSelectedId(null);
    setSelectedIds([]);
    setDetail(null);
    setError("");
  }

  async function loadCandidates(key = adminKey, nextStatus = status) {
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: "150",
        sort,
      });
      if (nextStatus !== "all") params.set("status", nextStatus);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (minAppearances.trim()) params.set("minAppearances", minAppearances.trim());
      if (confidenceMin.trim()) params.set("confidenceMin", confidenceMin.trim());
      if (confidenceMax.trim()) params.set("confidenceMax", confidenceMax.trim());
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const res = await fetch(`/api/admin/discovery/candidates?${params.toString()}`, {
        headers: { "X-Admin-Key": key.trim() },
      });
      if (!res.ok) throw new Error(errorMessage(res.status));
      const json = await res.json() as CandidateListResponse;
      setCandidates(json.candidates);
      setCounts(json.counts);
      setSources(json.sources ?? []);
      setSelectedIds(prev => prev.filter(id => json.candidates.some(candidate => candidate.id === id)));
      if (!json.candidates.some(candidate => candidate.id === selectedId)) {
        setSelectedId(json.candidates[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar descubrimiento.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: number, key = adminKey) {
    if (!key.trim()) return;
    setDetailLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/discovery/candidates/${id}`, {
        headers: { "X-Admin-Key": key.trim() },
      });
      if (!res.ok) throw new Error(errorMessage(res.status));
      const json = await res.json() as CandidateDetailResponse;
      setDetail(json);
      setApprovalArtistKey(json.candidate.matched_artist_id ?? artistKeyFromName(json.candidate.artist_name));
      setLinkArtistKey(json.candidate.matched_artist_id ?? "");
      setNotes(json.candidate.notes ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar candidato.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateStatus(nextStatus: CandidateStatus) {
    if (!selectedCandidate || !adminKey.trim()) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/discovery/candidates/${selectedCandidate.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey.trim(),
        },
        body: JSON.stringify({ status: nextStatus, notes: notes.trim() || undefined }),
      });
      if (!res.ok) throw new Error(errorMessage(res.status));
      await loadCandidates(adminKey, status);
      await loadDetail(selectedCandidate.id, adminKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar estado.");
    } finally {
      setActionLoading(false);
    }
  }

  async function approveCandidate() {
    if (!selectedCandidate || !adminKey.trim() || !approvalArtistKey.trim()) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/discovery/candidates/${selectedCandidate.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey.trim(),
        },
        body: JSON.stringify({
          artistKey: approvalArtistKey.trim(),
          artistName: selectedCandidate.artist_name,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(errorMessage(res.status));
      await loadCandidates(adminKey, status);
      await loadDetail(selectedCandidate.id, adminKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aprobar candidato.");
    } finally {
      setActionLoading(false);
    }
  }

  async function updateBulkStatus(nextStatus: "pending" | "needs_review" | "rejected") {
    if (!selectedIds.length || !adminKey.trim()) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/discovery/candidates/bulk-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey.trim(),
        },
        body: JSON.stringify({ ids: selectedIds, status: nextStatus }),
      });
      if (!res.ok) throw new Error(errorMessage(res.status));
      setSelectedIds([]);
      await loadCandidates(adminKey, status);
      if (selectedId) await loadDetail(selectedId, adminKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar seleccion.");
    } finally {
      setActionLoading(false);
    }
  }

  function toggleCandidate(id: number) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  }

  function toggleAllVisible() {
    const visibleIds = candidates.map(candidate => candidate.id);
    if (visibleIds.length && visibleIds.every(id => selectedIdSet.has(id))) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
      return;
    }
    setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
  }

  async function linkExistingArtist() {
    if (!selectedCandidate || !adminKey.trim() || !linkArtistKey.trim()) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/discovery/candidates/${selectedCandidate.id}/link-existing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey.trim(),
        },
        body: JSON.stringify({
          artistKey: linkArtistKey.trim(),
          artistName: selectedCandidate.artist_name,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(errorMessage(res.status));
      await loadCandidates(adminKey, status);
      await loadDetail(selectedCandidate.id, adminKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo vincular artista.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) void loadCandidates(adminKey, status);
  }, [unlocked, adminKey, status, sourceFilter, minAppearances, confidenceMin, confidenceMax, searchTerm, sort]);

  useEffect(() => {
    if (selectedId && unlocked) void loadDetail(selectedId, adminKey);
  }, [selectedId, unlocked, adminKey]);

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-zinc-200">
      <PageSEO
        title="Descubrimiento de artistas | Mexico Charts"
        description="Panel interno para revisar candidatos descubiertos en charts."
        path="/admin/discovery-review"
        noindex
      />

      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-6">
          <Link href="/" className="shrink-0">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90" />
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="h-3.5 w-3.5" />
            Admin
          </Link>
          {unlocked && (
            <button
              type="button"
              onClick={clearKey}
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500 hover:text-white"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Cambiar clave
            </button>
          )}
        </div>
      </nav>

      <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-8">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#39FF14]">Discovery</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">Candidatos de artistas</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Nombres detectados en snapshots de charts que todavia no estan confirmados en la base oficial.
          </p>
        </header>

        {!unlocked ? (
          <section className="max-w-xl rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">Acceso admin</h2>
                <p className="text-xs font-bold text-zinc-600">Usa la clave interna de Mexico Charts.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                value={draftKey}
                onChange={event => setDraftKey(event.target.value)}
                type="password"
                placeholder="Clave admin"
                className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
              />
              <button
                type="button"
                onClick={saveKey}
                className="h-11 rounded-lg border border-[#39FF14]/35 bg-[#39FF14]/10 px-4 text-[11px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/16"
              >
                Entrar
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="space-y-4 rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-4">
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(option => {
                  const count = option.value === "all"
                    ? counts.reduce((sum, item) => sum + item.count, 0)
                    : counts.find(item => item.status === option.value)?.count ?? 0;
                  const active = status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatus(option.value)}
                      className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] ${
                        active
                          ? "border-[#39FF14]/40 bg-[#39FF14]/12 text-[#39FF14]"
                          : "border-white/10 text-zinc-500 hover:text-white"
                      }`}
                    >
                      {option.label} · {count}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))_auto] md:items-end">
                <label className="block">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Buscar</span>
                  <input
                    value={searchTerm}
                    onChange={event => setSearchTerm(event.target.value)}
                    placeholder="Nombre de artista"
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Fuente</span>
                  <select
                    value={sourceFilter}
                    onChange={event => setSourceFilter(event.target.value)}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-xs font-black uppercase tracking-[0.08em] text-zinc-300 outline-none focus:border-[#39FF14]/50"
                  >
                    <option value="all">Todas</option>
                    {sources.map(source => (
                      <option key={source.source} value={source.source}>{source.source} ({source.count})</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Min apar.</span>
                  <input
                    value={minAppearances}
                    onChange={event => setMinAppearances(event.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Conf min</span>
                  <input
                    value={confidenceMin}
                    onChange={event => setConfidenceMin(event.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Conf max</span>
                  <input
                    value={confidenceMax}
                    onChange={event => setConfidenceMax(event.target.value)}
                    inputMode="numeric"
                    placeholder="100"
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Orden</span>
                  <select
                    value={sort}
                    onChange={event => setSort(event.target.value as SortValue)}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-xs font-black uppercase tracking-[0.08em] text-zinc-300 outline-none focus:border-[#39FF14]/50"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void loadCandidates()}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refrescar
                </button>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 md:flex-row md:items-center">
                <button
                  type="button"
                  onClick={toggleAllVisible}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:text-white"
                >
                  {candidates.length && candidates.every(candidate => selectedIdSet.has(candidate.id)) ? "Quitar visibles" : "Seleccionar visibles"}
                </button>
                <span className="text-xs font-bold text-zinc-600">{selectedIds.length} seleccionados</span>
                <div className="flex flex-wrap gap-2 md:ml-auto">
                  <button
                    type="button"
                    disabled={!selectedIds.length || actionLoading}
                    onClick={() => void updateBulkStatus("needs_review")}
                    className="h-9 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Marcar revisar
                  </button>
                  <button
                    type="button"
                    disabled={!selectedIds.length || actionLoading}
                    onClick={() => void updateBulkStatus("pending")}
                    className="h-9 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Marcar pendiente
                  </button>
                  <button
                    type="button"
                    disabled={!selectedIds.length || actionLoading}
                    onClick={() => void updateBulkStatus("rejected")}
                    className="h-9 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-red-200 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            </section>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
                {error}
              </div>
            )}

            <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
              <div className="rounded-lg border border-white/[0.07] bg-[#0b0b0b]">
                <div className="border-b border-white/[0.07] p-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white">{statusLabel(status)}</h2>
                  <p className="mt-1 text-xs font-bold text-zinc-600">{candidates.length} candidatos cargados</p>
                </div>
                <div className="max-h-[720px] overflow-y-auto">
                  {loading ? (
                    <div className="p-4 text-sm font-bold text-zinc-500">Cargando candidatos...</div>
                  ) : candidates.length ? (
                    candidates.map(candidate => (
                      <div
                        key={candidate.id}
                        className={`flex gap-3 border-b border-white/[0.05] p-4 hover:bg-white/[0.03] ${
                          candidate.id === selectedId ? "bg-[#39FF14]/8" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIdSet.has(candidate.id)}
                          onChange={() => toggleCandidate(candidate.id)}
                          className="mt-2 h-4 w-4 shrink-0 accent-[#39FF14]"
                          aria-label={`Seleccionar ${candidate.artist_name}`}
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedId(candidate.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#39FF14]/25 text-xs font-black text-[#39FF14]">
                            {candidate.confidence_score}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-black text-white">{candidate.artist_name}</h3>
                            <p className="mt-1 text-xs font-bold text-zinc-600">
                              {candidate.total_appearances} apariciones · {candidate.source_count} fuentes
                            </p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-700">
                              {candidate.first_seen_date ?? "-"} → {candidate.last_seen_date ?? "-"}
                            </p>
                            {candidate.top_sources?.length ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {candidate.top_sources.slice(0, 3).map(source => (
                                  <span key={source.source} className="rounded border border-white/10 px-1.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500">
                                    {source.source} · {source.count}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {candidate.needs_review_reason ? (
                              <p className="mt-2 text-xs font-bold leading-relaxed text-amber-200/80">
                                {candidate.needs_review_reason}
                              </p>
                            ) : null}
                          </div>
                          </div>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm font-bold text-zinc-500">No hay candidatos en este estado.</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.07] bg-[#0b0b0b]">
                {!selectedCandidate ? (
                  <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                    <Search className="h-8 w-8 text-zinc-700" />
                    <p className="mt-3 text-sm font-bold text-zinc-500">Selecciona un candidato para revisar evidencia.</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="border-b border-white/[0.07] p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#39FF14]">
                            {statusLabel(selectedCandidate.status)}
                          </p>
                          <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white md:text-4xl">
                            {selectedCandidate.artist_name}
                          </h2>
                          <p className="mt-2 text-sm font-bold text-zinc-600">{selectedCandidate.normalized_name}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                          <div className="rounded-lg border border-white/10 p-3">
                            <p className="text-xl font-black text-white">{selectedCandidate.confidence_score}</p>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Confianza</p>
                          </div>
                          <div className="rounded-lg border border-white/10 p-3">
                            <p className="text-xl font-black text-white">{selectedCandidate.total_appearances}</p>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Eventos</p>
                          </div>
                          <div className="rounded-lg border border-white/10 p-3">
                            <p className="text-xl font-black text-white">{selectedCandidate.source_count}</p>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Fuentes</p>
                          </div>
                          <div className="rounded-lg border border-white/10 p-3">
                            <p className="text-xs font-black text-white">{selectedCandidate.first_seen_date ?? "-"}</p>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Primera vez</p>
                          </div>
                          <div className="rounded-lg border border-white/10 p-3">
                            <p className="text-xs font-black text-white">{selectedCandidate.last_seen_date ?? "-"}</p>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Ultima vez</p>
                          </div>
                        </div>
                      </div>
                      {selectedCandidate.needs_review_reason && (
                        <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-sm font-bold leading-relaxed text-amber-100">
                          {selectedCandidate.needs_review_reason}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="space-y-5">
                        <section>
                          <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white">Fuentes principales</h3>
                          <div className="flex flex-wrap gap-2">
                            {(detail?.topSources ?? selectedCandidate.top_sources ?? []).length ? (
                              (detail?.topSources ?? selectedCandidate.top_sources ?? []).map(source => (
                                <span key={source.source} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                                  {source.source} · {source.count}
                                </span>
                              ))
                            ) : (
                              <p className="text-sm font-bold text-zinc-500">Sin fuentes agregadas.</p>
                            )}
                          </div>
                        </section>

                        <section>
                          <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white">Apariciones recientes</h3>
                          <div className="overflow-hidden rounded-lg border border-white/[0.07]">
                            {detailLoading ? (
                              <div className="p-4 text-sm font-bold text-zinc-500">Cargando detalle...</div>
                            ) : (detail?.recentAppearances ?? detail?.events ?? []).length ? (
                              (detail?.recentAppearances ?? detail?.events ?? []).map(event => (
                                <div key={event.id} className="grid gap-2 border-b border-white/[0.05] p-3 last:border-b-0 md:grid-cols-[90px_120px_minmax(0,1fr)_70px] md:items-center">
                                  <p className="text-xs font-black text-[#39FF14]">{event.chart_date}</p>
                                  <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{event.source}</p>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-white">{event.song_or_video_title ?? "Sin titulo"}</p>
                                    <p className="truncate text-xs font-bold text-zinc-600">{formatChartType(event.chart_type)}</p>
                                  </div>
                                  <p className="text-xs font-black text-zinc-500 md:text-right">#{event.rank ?? "-"}</p>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-sm font-bold text-zinc-500">Sin eventos guardados.</div>
                            )}
                          </div>
                          {detail?.events.length && detail.events.length > (detail.recentAppearances?.length ?? 0) ? (
                            <p className="mt-2 text-xs font-bold text-zinc-600">
                              Mostrando {detail.recentAppearances.length} recientes de {detail.events.length} eventos cargados.
                            </p>
                          ) : null}
                        </section>

                        <section>
                          <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white">Senales</h3>
                          <div className="overflow-hidden rounded-lg border border-white/[0.07]">
                            {detail?.signals.length ? (
                              detail.signals.map(signal => (
                                <div key={signal.id} className="grid gap-2 border-b border-white/[0.05] p-3 last:border-b-0 md:grid-cols-[150px_120px_minmax(0,1fr)_70px] md:items-center">
                                  <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">{signal.signal_type}</p>
                                  <p className="text-xs font-bold text-zinc-500">{signal.source}</p>
                                  <p className="min-w-0 truncate text-sm font-bold text-white">{signal.value}</p>
                                  <p className="text-xs font-black text-[#39FF14] md:text-right">{signal.confidence_weight > 0 ? "+" : ""}{signal.confidence_weight}</p>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-sm font-bold text-zinc-500">Sin senales guardadas.</div>
                            )}
                          </div>
                        </section>

                        <section>
                          <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white">Historial de decision</h3>
                          {detail?.officialArtist ? (
                            <div className="mb-3 rounded-lg border border-[#39FF14]/20 bg-[#39FF14]/8 p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14]">Artista oficial</p>
                              <p className="mt-1 text-sm font-black text-white">{detail.officialArtist.artist_name}</p>
                              <p className="mt-1 text-xs font-bold text-zinc-500">{detail.officialArtist.artist_key} · {detail.officialArtist.source}</p>
                            </div>
                          ) : null}
                          <div className="overflow-hidden rounded-lg border border-white/[0.07]">
                            {detail?.auditEntries.length ? (
                              detail.auditEntries.map(entry => (
                                <div key={entry.id} className="border-b border-white/[0.05] p-3 last:border-b-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-black uppercase tracking-[0.12em] text-white">{entry.action.replace(/_/g, " ")}</p>
                                    {entry.artist_key ? (
                                      <span className="rounded border border-[#39FF14]/25 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#39FF14]">
                                        {entry.artist_key}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">
                                    {entry.previous_status ?? "-"} → {entry.next_status ?? "-"} · {new Date(entry.created_at).toLocaleString("es-MX")}
                                  </p>
                                  {entry.note ? (
                                    <p className="mt-2 text-xs font-bold leading-relaxed text-zinc-400">{entry.note}</p>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-sm font-bold text-zinc-500">Sin historial de decision todavia.</div>
                            )}
                          </div>
                        </section>
                      </div>

                      <aside className="space-y-4">
                        <section className="rounded-lg border border-white/[0.07] p-4">
                          <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">Decision</h3>
                          <label className="mt-3 block">
                            <span className="mb-1 block text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">Nuevo artist_key oficial</span>
                            <input
                              value={approvalArtistKey}
                              onChange={event => setApprovalArtistKey(event.target.value)}
                              placeholder="artist_key"
                              className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                            />
                          </label>
                          <p className="mt-2 text-xs font-bold leading-relaxed text-zinc-600">
                            Aprobar crea un registro oficial interno y conserva todo el historial del candidato.
                          </p>
                          <textarea
                            value={notes}
                            onChange={event => setNotes(event.target.value)}
                            placeholder="Notas internas"
                            className="mt-3 min-h-24 w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                          />
                          <div className="mt-3 grid gap-2">
                            <button
                              type="button"
                              disabled={actionLoading || !approvalArtistKey.trim()}
                              onClick={() => void approveCandidate()}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#39FF14]/35 bg-[#39FF14]/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/16 disabled:opacity-60"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Aprobar y crear
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => void updateStatus("needs_review")}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 hover:text-white disabled:opacity-60"
                            >
                              Revisar despues
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => void updateStatus("pending")}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 hover:text-white disabled:opacity-60"
                            >
                              Pendiente
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => void updateStatus("rejected")}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-red-200 hover:bg-red-500/15 disabled:opacity-60"
                            >
                              Rechazar
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => void updateStatus("not_mexican")}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-red-200 hover:bg-red-500/15 disabled:opacity-60"
                            >
                              <X className="h-3.5 w-3.5" />
                              No mexicano
                            </button>
                          </div>
                        </section>

                        <section className="rounded-lg border border-white/[0.07] p-4">
                          <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">Vincular existente</h3>
                          <p className="mt-2 text-xs font-bold leading-relaxed text-zinc-600">
                            Usa el artist_key oficial si este candidato es un alias o duplicado.
                          </p>
                          <input
                            value={linkArtistKey}
                            onChange={event => setLinkArtistKey(event.target.value)}
                            placeholder="artist_key"
                            className="mt-3 h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                          />
                          <button
                            type="button"
                            disabled={actionLoading || !linkArtistKey.trim()}
                            onClick={() => void linkExistingArtist()}
                            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Vincular
                          </button>
                        </section>

                        {selectedCandidate.matched_artist_id && (
                          <Link href={canonicalArtistHref(selectedCandidate.matched_artist_id) ?? "/artists"} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:text-white">
                            Ver perfil vinculado
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </aside>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
