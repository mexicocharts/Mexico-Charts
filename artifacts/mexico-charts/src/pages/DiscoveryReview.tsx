import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
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

interface CandidateListResponse {
  candidates: DiscoveryCandidate[];
  counts: Array<{ status: CandidateStatus; count: number }>;
}

interface CandidateDetailResponse {
  candidate: DiscoveryCandidate;
  events: DiscoveryEvent[];
  signals: DiscoverySignal[];
}

const statusOptions: Array<{ value: CandidateStatus; label: string }> = [
  { value: "pending", label: "Pendientes" },
  { value: "likely_mexican", label: "Probables MX" },
  { value: "needs_review", label: "Revisar" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
  { value: "linked_existing_artist", label: "Vinculados" },
  { value: "not_mexican", label: "No mexicanos" },
];

function statusLabel(status: CandidateStatus) {
  return statusOptions.find(option => option.value === status)?.label ?? status;
}

function formatChartType(value: string) {
  return value.replace(/_/g, " ");
}

function errorMessage(status: number) {
  if (status === 401 || status === 403) return "Clave de admin invalida.";
  if (status === 404) return "No se encontro el candidato.";
  return "No se pudo cargar descubrimiento.";
}

export default function DiscoveryReview() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mexicocharts_admin_key") ?? "");
  const [draftKey, setDraftKey] = useState(adminKey);
  const [status, setStatus] = useState<CandidateStatus>("pending");
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [counts, setCounts] = useState<CandidateListResponse["counts"]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CandidateDetailResponse | null>(null);
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
    setSelectedId(null);
    setDetail(null);
    setError("");
  }

  async function loadCandidates(key = adminKey, nextStatus = status) {
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/discovery/candidates?status=${encodeURIComponent(nextStatus)}&limit=150&sort=confidence`, {
        headers: { "X-Admin-Key": key.trim() },
      });
      if (!res.ok) throw new Error(errorMessage(res.status));
      const json = await res.json() as CandidateListResponse;
      setCandidates(json.candidates);
      setCounts(json.counts);
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
  }, [unlocked, adminKey, status]);

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
            <section className="flex flex-col gap-3 rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-4 md:flex-row md:items-center">
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(option => {
                  const count = counts.find(item => item.status === option.value)?.count ?? 0;
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
              <button
                type="button"
                onClick={() => void loadCandidates()}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:text-white disabled:cursor-wait disabled:opacity-60 md:ml-auto"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refrescar
              </button>
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
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelectedId(candidate.id)}
                        className={`block w-full border-b border-white/[0.05] p-4 text-left hover:bg-white/[0.03] ${
                          candidate.id === selectedId ? "bg-[#39FF14]/8" : ""
                        }`}
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
                          </div>
                        </div>
                      </button>
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
                        <div className="grid grid-cols-3 gap-2 text-center">
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
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="space-y-5">
                        <section>
                          <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white">Historial de apariciones</h3>
                          <div className="overflow-hidden rounded-lg border border-white/[0.07]">
                            {detailLoading ? (
                              <div className="p-4 text-sm font-bold text-zinc-500">Cargando detalle...</div>
                            ) : detail?.events.length ? (
                              detail.events.map(event => (
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
                      </div>

                      <aside className="space-y-4">
                        <section className="rounded-lg border border-white/[0.07] p-4">
                          <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">Decision</h3>
                          <textarea
                            value={notes}
                            onChange={event => setNotes(event.target.value)}
                            placeholder="Notas internas"
                            className="mt-3 min-h-24 w-full rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                          />
                          <div className="mt-3 grid gap-2">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => void updateStatus("approved")}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#39FF14]/35 bg-[#39FF14]/10 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/16 disabled:opacity-60"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Aprobar
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
                          <Link href={`/artist/${encodeURIComponent(selectedCandidate.matched_artist_id)}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:text-white">
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
