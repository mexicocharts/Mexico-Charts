import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BarChart3, CheckCircle2, Clock3, Disc3, ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { SiMusicbrainz, SiSpotify, SiYoutube } from "react-icons/si";
import PageSEO from "@/components/PageSEO";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const SPOTIFY_BACKFILL_COMMAND = "cd scripts && pnpm tsx ./src/spotify-artist-backfill.ts --limit=100 --minAutoScore=45 --write=true";
const MUSICBRAINZ_BACKFILL_COMMAND = "cd scripts && pnpm tsx ./src/musicbrainz-artist-backfill.ts --limit=100 --minAutoScore=65 --write=true";
const MUSICBRAINZ_APPROVE_COMMAND = "cd scripts && pnpm tsx ./src/musicbrainz-approve-candidates.ts --minScore=65 --write=true";
const YOUTUBE_SEARCH_BACKFILL_COMMAND = "cd scripts && pnpm tsx ./src/youtube-channel-search-backfill.ts --limit=25 --minScore=80 --write=true";

type ProviderKey = "spotify" | "youtube" | "musicbrainz" | "deezer";

interface CoverageProvider {
  linked: number;
  missing: number;
  review: number;
  rejected: number;
  coveragePct: number;
  newestUpdatedAt: string | null;
  oldestUpdatedAt: string | null;
  missingPreview: Array<{ artistKey: string; artistName: string }>;
  reviewPreview?: Array<{ artistKey: string; artistName: string; bestScore: number }>;
}

interface CoverageResponse {
  source: string;
  totalArtists: number;
  generatedAt: string;
  providers: Record<ProviderKey, CoverageProvider>;
}

interface KworbStats {
  fetchingEnabled: boolean;
  requestBudget: {
    today: number;
    caps: { daily: number; hourly: number };
    remainingToday: number;
  };
  coverage: {
    total: number;
    bySource: {
      withSpotify: number;
      withYoutube: number;
      withItunes: number;
      withAny: number;
      noCoverage: number;
    };
  };
  snapshots: {
    artists_with_snapshots?: string;
    stale_snapshots?: string;
  };
  noSnapshotCount: number;
  estimatedDaysToFull: string;
}

interface TouringCoverage {
  provider: "ticketmaster";
  configured: boolean;
  totalTracked: number;
  checked: number;
  stale: number;
  withUpcomingShows: number;
  withoutUpcomingShows: number;
  newestFetchAt: string | null;
  oldestFetchAt: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Sin datos";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function providerMeta(provider: ProviderKey) {
  if (provider === "spotify") {
    return { label: "Spotify", color: "#1DB954", icon: <SiSpotify className="h-5 w-5" /> };
  }
  if (provider === "youtube") {
    return { label: "YouTube", color: "#ff4444", icon: <SiYoutube className="h-5 w-5" /> };
  }
  if (provider === "deezer") {
    return { label: "Deezer Covers", color: "#a855f7", icon: <Disc3 className="h-5 w-5" /> };
  }
  return { label: "MusicBrainz", color: "#f59e0b", icon: <SiMusicbrainz className="h-5 w-5" /> };
}

function buildTodayTasks(coverage: CoverageResponse, kworb: KworbStats | null, touring: TouringCoverage | null) {
  const tasks: Array<{
    title: string;
    detail: string;
    priority: "Alta" | "Media" | "Baja";
    href?: string;
  }> = [];
  const { spotify, youtube, musicbrainz, deezer } = coverage.providers;

  if (spotify.review + musicbrainz.review > 0) {
    tasks.push({
      title: "Revisar coincidencias pendientes",
      detail: `${spotify.review + musicbrainz.review} artistas necesitan aprobación o rechazo antes de seguir limpiamente.`,
      priority: "Alta",
      href: "/admin/enrichment-review",
    });
  }

  if (youtube.missing > 0) {
    tasks.push({
      title: "Continuar YouTube cuando haya cuota",
      detail: `${youtube.missing} artistas siguen sin canal vinculado. Prioridad cuando la cuota diaria vuelva.`,
      priority: "Alta",
    });
  }

  if (spotify.missing > 0) {
    tasks.push({
      title: "Continuar Spotify cuando resetee el límite",
      detail: `${spotify.missing} artistas siguen sin perfil Spotify verificado. No requiere búsqueda manual si el límite ya volvió.`,
      priority: "Media",
    });
  }

  if (musicbrainz.missing > 0 && musicbrainz.review === 0) {
    tasks.push({
      title: "Buscar más MusicBrainz",
      detail: `${musicbrainz.missing} artistas no tienen MusicBrainz vinculado ni candidato pendiente.`,
      priority: "Media",
    });
  }

  if (deezer?.missing > 0) {
    tasks.push({
      title: "Completar portadas Deezer",
      detail: `${deezer.missing} artistas aún no tienen portadas cacheadas para canciones en perfil.`,
      priority: "Baja",
    });
  }

  if (kworb && (kworb.noSnapshotCount > 0 || Number(kworb.snapshots.stale_snapshots ?? 0) > 0)) {
    tasks.push({
      title: "Revisar Kworb",
      detail: `${kworb.noSnapshotCount} artistas sin snapshot y ${kworb.snapshots.stale_snapshots ?? "0"} snapshots vencidos.`,
      priority: kworb.requestBudget.remainingToday > 0 ? "Media" : "Baja",
    });
  }

  if (touring && (!touring.configured || touring.stale > 0)) {
    tasks.push({
      title: touring.configured ? "Actualizar touring" : "Configurar Ticketmaster",
      detail: touring.configured
        ? `${touring.stale} artistas de touring necesitan revisión o refresh.`
        : "Ticketmaster no está configurado en este entorno.",
      priority: touring.configured ? "Media" : "Alta",
    });
  }

  if (tasks.length === 0) {
    tasks.push({
      title: "Sin pendientes urgentes",
      detail: "La cobertura principal está limpia por ahora. Buen momento para revisar diseño, touring o nuevas fuentes.",
      priority: "Baja",
    });
  }

  return tasks.slice(0, 5);
}

export default function ApiCoverage() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mexicocharts_admin_key") ?? "");
  const [draftKey, setDraftKey] = useState(adminKey);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [kworb, setKworb] = useState<KworbStats | null>(null);
  const [touring, setTouring] = useState<TouringCoverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshingTouring, setRefreshingTouring] = useState(false);
  const [refreshingYoutube, setRefreshingYoutube] = useState(false);

  const providerEntries = useMemo(() => {
    if (!coverage) return [] as Array<[ProviderKey, CoverageProvider]>;
    return Object.entries(coverage.providers) as Array<[ProviderKey, CoverageProvider]>;
  }, [coverage]);
  const todayTasks = useMemo(() => coverage ? buildTodayTasks(coverage, kworb, touring) : [], [coverage, kworb, touring]);

  async function loadDashboard(key = adminKey) {
    if (!key.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [coverageRes, kworbRes, touringRes] = await Promise.all([
        fetch("/api/admin/artists/api-coverage", { headers: { "X-Admin-Key": key.trim() } }),
        fetch("/api/kworb/admin/stats"),
        fetch("/api/admin/touring/coverage", { headers: { "X-Admin-Key": key.trim() } }),
      ]);
      if (!coverageRes.ok) throw new Error(coverageRes.status === 403 ? "Clave de admin inválida." : "No se pudo cargar la cobertura.");
      setCoverage(await coverageRes.json());
      setKworb(kworbRes.ok ? await kworbRes.json() : null);
      setTouring(touringRes.ok ? await touringRes.json() : null);
    } catch (err) {
      setError((err as Error).message);
      setCoverage(null);
      setKworb(null);
      setTouring(null);
    } finally {
      setLoading(false);
    }
  }

  function saveKey() {
    const next = draftKey.trim();
    localStorage.setItem("mexicocharts_admin_key", next);
    setAdminKey(next);
    void loadDashboard(next);
  }

  async function refreshTouring() {
    if (!adminKey.trim()) {
      setError("Guarda la clave admin primero.");
      return;
    }

    setRefreshingTouring(true);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/touring/concerts");
      if (!res.ok) throw new Error("No se pudo refrescar Ticketmaster.");
      const data = await res.json() as { artists?: Array<{ events?: unknown[] }> };
      const withShows = (data.artists ?? []).filter(artist => (artist.events?.length ?? 0) > 0).length;
      setActionMessage(`Ticketmaster actualizado: ${withShows} artistas con shows próximos.`);
      await loadDashboard(adminKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshingTouring(false);
    }
  }

  async function refreshYoutubeChannels() {
    if (!adminKey.trim()) {
      setError("Guarda la clave admin primero.");
      return;
    }

    setRefreshingYoutube(true);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/youtube/refresh-channels?limit=100&staleDays=7&dryRun=false", {
        method: "POST",
        headers: { "X-Admin-Key": adminKey.trim() },
      });
      if (!res.ok) throw new Error("No se pudo refrescar YouTube.");
      const data = await res.json() as {
        refreshed?: number;
        processed?: number;
        quotaExhausted?: boolean;
        remainingStaleEstimate?: number;
      };
      setActionMessage(
        data.quotaExhausted
          ? `YouTube refrescó ${data.refreshed ?? 0} canales antes de llegar al límite.`
          : `YouTube actualizado: ${data.refreshed ?? 0} de ${data.processed ?? 0} canales refrescados.`,
      );
      await loadDashboard(adminKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshingYoutube(false);
    }
  }

  async function copySpotifyCommand() {
    try {
      await navigator.clipboard.writeText(SPOTIFY_BACKFILL_COMMAND);
      setActionMessage("Comando de Spotify copiado.");
    } catch {
      setActionMessage("Comando de Spotify listo para copiar manualmente.");
    }
  }

  async function copyCommand(command: string, label: string) {
    try {
      await navigator.clipboard.writeText(command);
      setActionMessage(`${label} copiado.`);
    } catch {
      setActionMessage(`${label} listo para copiar manualmente.`);
    }
  }

  useEffect(() => {
    if (adminKey) void loadDashboard(adminKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#050505] text-zinc-200">
      <PageSEO
        title="Cobertura API | Mexico Charts"
        description="Panel interno de cobertura para APIs y datos enriquecidos de Mexico Charts."
        path="/admin/api-coverage"
        noindex
      />

      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-6">
          <Link href="/" className="shrink-0">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90" />
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
          <Link href="/admin/enrichment-review" className="ml-auto inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#39FF14] hover:text-white">
            Cola de revisión
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </nav>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#39FF14]">Panel interno</p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">Cobertura API</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Vista rápida de artistas vinculados, faltantes y pendientes de revisión.
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

        {coverage && (
          <>
            <section className="rounded-lg border border-[#39FF14]/20 bg-[#071007] p-5">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[#39FF14]" />
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">Trabajo de hoy</h2>
                <span className="ml-auto text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                  Prioridades sugeridas
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {todayTasks.map((task, index) => {
                  const body = (
                    <div className="flex h-full gap-4 rounded-lg border border-white/[0.07] bg-black/20 p-4 transition-colors hover:border-[#39FF14]/25">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]">
                        {task.priority === "Alta" ? <RefreshCw className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">#{index + 1}</span>
                          <span className="rounded border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#39FF14]">
                            {task.priority}
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-black uppercase tracking-[0.08em] text-white">{task.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{task.detail}</p>
                      </div>
                    </div>
                  );

                  return task.href ? (
                    <Link key={task.title} href={task.href}>
                      {body}
                    </Link>
                  ) : (
                    <div key={task.title}>{body}</div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="text-3xl font-black text-white">{coverage.totalArtists}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Artistas en base</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="text-3xl font-black text-white">{providerEntries.reduce((sum, [, p]) => sum + p.review, 0)}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">En revisión</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="text-3xl font-black text-white">{kworb?.requestBudget.remainingToday ?? "—"}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Kworb restante hoy</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="text-3xl font-black text-white">{fmtDate(coverage.generatedAt)}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Actualizado</div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-4">
              {providerEntries.map(([key, provider]) => {
                const meta = providerMeta(key);
                return (
                  <article key={key} className="rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04]" style={{ color: meta.color }}>
                        {meta.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">{meta.label}</h2>
                        <p className="text-xs font-bold text-zinc-600">{provider.coveragePct}% de cobertura</p>
                      </div>
                      {key === "youtube" && (
                        <button
                          type="button"
                          onClick={() => void refreshYoutubeChannels()}
                          disabled={refreshingYoutube || provider.linked === 0}
                          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-red-300 hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${refreshingYoutube ? "animate-spin" : ""}`} />
                          Refrescar
                        </button>
                      )}
                      {key === "spotify" && provider.missing > 0 && (
                        <button
                          type="button"
                          onClick={() => void copySpotifyCommand()}
                          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#1DB954]/25 bg-[#1DB954]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#8ff0ad] hover:bg-[#1DB954]/15"
                        >
                          Copiar comando
                        </button>
                      )}
                      {key === "musicbrainz" && (
                        <Link
                          href="/admin/enrichment-review"
                          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300 hover:bg-amber-500/15"
                        >
                          Revisar
                        </Link>
                      )}
                      {key === "deezer" && (
                        <span className="ml-auto rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-purple-300">
                          Portadas
                        </span>
                      )}
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full" style={{ width: `${provider.coveragePct}%`, background: meta.color }} />
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-2xl font-black text-white">{provider.linked}</div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Vinculados</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white">{provider.missing}</div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Faltantes</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white">{provider.review}</div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Revisión</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white">{provider.rejected}</div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Rechazados</div>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-white/[0.06] pt-4 text-xs text-zinc-600">
                      <div>Más reciente: <span className="font-bold text-zinc-400">{fmtDate(provider.newestUpdatedAt)}</span></div>
                      <div className="mt-1">Más antiguo: <span className="font-bold text-zinc-400">{fmtDate(provider.oldestUpdatedAt)}</span></div>
                      {key === "youtube" && (
                        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                          Usa cuota baja: solo canales ya vinculados.
                        </div>
                      )}
                      {key === "deezer" && (
                        <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                          Cuenta artistas con al menos una portada de canción cacheada.
                        </div>
                      )}
                      {key === "youtube" && provider.missing > 0 && (
                        <div className="mt-3 rounded-lg border border-red-500/15 bg-red-500/[0.04] p-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-300">Buscar canales faltantes</div>
                          <button
                            type="button"
                            onClick={() => void copyCommand(YOUTUBE_SEARCH_BACKFILL_COMMAND, "Búsqueda YouTube")}
                            className="mt-2 block w-full rounded border border-white/[0.06] bg-black/20 p-2 text-left hover:border-red-400/25"
                          >
                            <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Usa cuota alta</span>
                            <code className="mt-1 block whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-500">
                              {YOUTUBE_SEARCH_BACKFILL_COMMAND}
                            </code>
                          </button>
                        </div>
                      )}
                      {key === "spotify" && provider.missing > 0 && (
                        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8ff0ad]">Comando sugerido</div>
                          <code className="mt-2 block whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-500">
                            {SPOTIFY_BACKFILL_COMMAND}
                          </code>
                          <div className="mt-2 text-[10px] leading-relaxed text-zinc-700">
                            Úsalo solo cuando el límite de Spotify ya haya reseteado.
                          </div>
                        </div>
                      )}
                      {key === "musicbrainz" && (provider.missing > 0 || provider.review > 0) && (
                        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">Comandos sugeridos</div>
                          {provider.missing > 0 && (
                            <button
                              type="button"
                              onClick={() => void copyCommand(MUSICBRAINZ_BACKFILL_COMMAND, "Backfill MusicBrainz")}
                              className="mt-2 block w-full rounded border border-white/[0.06] bg-white/[0.03] p-2 text-left hover:border-amber-400/25"
                            >
                              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Buscar más artistas</span>
                              <code className="mt-1 block whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-500">
                                {MUSICBRAINZ_BACKFILL_COMMAND}
                              </code>
                            </button>
                          )}
                          {provider.review > 0 && (
                            <button
                              type="button"
                              onClick={() => void copyCommand(MUSICBRAINZ_APPROVE_COMMAND, "Aprobación MusicBrainz")}
                              className="mt-2 block w-full rounded border border-white/[0.06] bg-white/[0.03] p-2 text-left hover:border-amber-400/25"
                            >
                              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Aprobar candidatos 65+</span>
                              <code className="mt-1 block whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-500">
                                {MUSICBRAINZ_APPROVE_COMMAND}
                              </code>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>

            {kworb && (
              <section className="rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5">
                <div className="mb-5 flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-[#39FF14]" />
                  <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">Kworb</h2>
                  <span className="ml-auto text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                    {kworb.fetchingEnabled ? "Activo" : "Pausado"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-5">
                  <div><div className="text-2xl font-black text-white">{kworb.coverage.total}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Tracking</div></div>
                  <div><div className="text-2xl font-black text-white">{kworb.coverage.bySource.withAny}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Con datos</div></div>
                  <div><div className="text-2xl font-black text-white">{kworb.noSnapshotCount}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Sin snapshot</div></div>
                  <div><div className="text-2xl font-black text-white">{kworb.snapshots.stale_snapshots ?? "0"}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Vencidos</div></div>
                  <div><div className="text-2xl font-black text-white">{kworb.estimatedDaysToFull}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Días est.</div></div>
                </div>
              </section>
            )}

            {touring && (
              <section className="rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5">
                <div className="mb-5 flex items-center gap-3">
                  <ExternalLink className="h-5 w-5 text-[#39FF14]" />
                  <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">Ticketmaster</h2>
                  <button
                    type="button"
                    onClick={() => void refreshTouring()}
                    disabled={refreshingTouring || !touring.configured}
                    className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#39FF14]/30 bg-[#39FF14]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/16 disabled:cursor-wait disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshingTouring ? "animate-spin" : ""}`} />
                    Refrescar
                  </button>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                    {touring.configured ? "Configurado" : "Sin API key"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <div><div className="text-2xl font-black text-white">{touring.totalTracked}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Tracking</div></div>
                  <div><div className="text-2xl font-black text-white">{touring.checked}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Revisados</div></div>
                  <div><div className="text-2xl font-black text-white">{touring.withUpcomingShows}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Con shows</div></div>
                  <div><div className="text-2xl font-black text-white">{touring.withoutUpcomingShows}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Sin shows</div></div>
                  <div><div className="text-2xl font-black text-white">{touring.stale}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Por revisar</div></div>
                  <div><div className="text-sm font-black text-white">{fmtDate(touring.newestFetchAt)}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Último fetch</div></div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
