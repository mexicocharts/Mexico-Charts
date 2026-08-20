import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Activity, ArrowLeft, BarChart3, CheckCircle2, ChevronDown, Clock3, Copy, Disc3, ExternalLink, Eye, KeyRound, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { SiMusicbrainz, SiSpotify, SiYoutube } from "react-icons/si";
import PageSEO from "@/components/PageSEO";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const SPOTIFY_BACKFILL_COMMAND = "cd scripts && pnpm tsx ./src/spotify-artist-backfill.ts --limit=100 --minAutoScore=45 --write=true";
const MUSICBRAINZ_BACKFILL_COMMAND = "cd scripts && pnpm tsx ./src/musicbrainz-artist-backfill.ts --limit=100 --minAutoScore=65 --write=true";
const MUSICBRAINZ_APPROVE_COMMAND = "cd scripts && pnpm tsx ./src/musicbrainz-approve-candidates.ts --minScore=65 --write=true";
const YOUTUBE_SEARCH_BACKFILL_COMMAND = "cd scripts && pnpm tsx ./src/youtube-channel-search-backfill.ts --limit=25 --minScore=80 --write=true";
const KWORB_DIRECT_COMMAND = "node scripts/src/kworb-direct-backfill.mjs --concurrency=12";

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
    thisHour?: number;
    caps: { daily: number; hourly: number };
    remainingToday: number;
    byMetric?: Record<string, number>;
  };
  queue?: {
    pending?: string;
    running?: string;
    done?: string;
    failed?: string;
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
    spotify?: string;
    youtube?: string;
    itunes?: string;
    total?: string;
  };
  snapshotsToday?: {
    artists?: string;
    spotify?: string;
    youtube?: string;
    itunes?: string;
    total?: string;
  };
  topDaily?: {
    spotify?: Array<{
      artist_key: string;
      artist_name: string;
      daily_streams: string | number | null;
      total_streams: string | number | null;
      fetched_at: string;
    }>;
    youtube?: Array<{
      artist_key: string;
      artist_name: string;
      daily_views: string | number | null;
      total_views: string | number | null;
      fetched_at: string;
    }>;
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

interface DailySnapshotStatus {
  snapshotDate: string;
  generatedAt: string;
  youtube: {
    total: number;
    dateRows: number;
    missing: number;
    latestFetchedAt: string | null;
    totalDailyViews: number;
    missingPreview?: MomentumMissingRow[];
    missingReasonCounts?: Record<string, number>;
  };
  youtubeVideoTracker?: {
    total: number;
    artists: number;
    activeLinks: number;
    dateRows: number;
    rollupRows: number;
    missing: number;
    frozenVideos: number;
    latestFetchedAt: string | null;
    totalDailyViews: number;
    missingPreview?: MomentumMissingRow[];
    missingReasonCounts?: Record<string, number>;
  };
  spotifyKworb: {
    total: number;
    dateRows: number;
    missing: number;
    latestFetchedAt: string | null;
    totalDailyStreams: number;
    missingPreview?: MomentumMissingRow[];
    missingReasonCounts?: Record<string, number>;
  };
  recentRuns?: Array<{
    id: number;
    provider: "youtube" | "spotify" | "youtube-video" | string;
    snapshotDate: string;
    reason: string;
    status: string;
    expectedCount: number;
    fetchedCount: number;
    savedCount: number;
    missingCount: number;
    dateRows: number;
    totalDailyValue: number;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
}

interface MomentumMissingRow {
  artistKey: string;
  artistName: string;
  linkedId: string | null;
  linkedLabel: string | null;
  lastSnapshotDate: string | null;
  lastFetchedAt: string | null;
  reason: string;
}

interface YoutubeShadowStatus {
  publicDataChanged: false;
  shadowMode: true;
  automationEnabled: boolean;
  catalogReady: boolean;
  readyPilotArtists: number;
  totalPilotArtists: number;
  pilotArtists: Array<{
    artist_key: string;
    artist_name: string;
    eligible_candidates: number;
    rejected_candidates: number;
    discovery_status: string | null;
    mapping_status: string | null;
    discovery_error: string | null;
    last_attempt_at: string | null;
  }>;
  counts: {
    mappings: number;
    candidates: number;
    unique_videos: number;
    review: number;
    verified: number;
    rejected: number;
    observed: number;
    latest_observed_at: string | null;
  };
  usage: Array<{
    usage_date: string;
    api_calls: number;
    videos_requested: number;
    videos_returned: number;
  }>;
  artists: Array<{
    artist_key: string;
    tracked_video_count: number;
    videos_with_observations: number;
    total_views: string | number;
    latest_observed_at: string | null;
    review_count: number;
    verified_count: number;
    rejected_count: number;
    hot_count: number;
    warm_count: number;
    baseline_count: number;
    latest_view_delta: string | number;
  }>;
  recentRuns: Array<{
    id: number;
    run_type: string;
    artist_key: string | null;
    status: string;
    started_at: string;
    finished_at: string | null;
  }>;
  rejectedCandidates: Array<{
    artist_key: string;
    artist_name: string;
    video_id: string;
    title: string;
    canonical_url: string;
    rejection_reason: string | null;
  }>;
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

function fmtCount(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtCompact(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function snapshotRunStatusTone(status: string) {
  if (status === "complete" || status === "already_complete") return "border-[#39FF14]/20 bg-[#39FF14]/[0.06] text-[#39FF14]";
  if (status === "failed") return "border-red-400/20 bg-red-500/[0.08] text-red-300";
  if (status === "running" || status === "locked") return "border-amber-300/20 bg-amber-300/[0.08] text-amber-200";
  return "border-white/10 bg-white/[0.04] text-zinc-400";
}

function momentumReasonLabel(reason: string) {
  if (reason === "never_measured") return "Nunca medido";
  if (reason === "not_measured_today") return "Pendiente hoy";
  return "Revisar";
}

function providerMeta(provider: ProviderKey) {
  if (provider === "spotify") {
    return { label: "Spotify oficial", color: "#1DB954", icon: <SiSpotify className="h-5 w-5" /> };
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

  if (spotify.missing > 0 && !((kworb?.coverage.bySource.withSpotify ?? 0) > 0)) {
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
  const [dailySnapshots, setDailySnapshots] = useState<DailySnapshotStatus | null>(null);
  const [youtubeShadow, setYoutubeShadow] = useState<YoutubeShadowStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshingTouring, setRefreshingTouring] = useState(false);
  const [refreshingYoutube, setRefreshingYoutube] = useState(false);
  const [runningYoutubeSnapshots, setRunningYoutubeSnapshots] = useState(false);
  const [runningYoutubeVideoSnapshots, setRunningYoutubeVideoSnapshots] = useState(false);
  const [runningSpotifySnapshots, setRunningSpotifySnapshots] = useState(false);
  const [syncingKworb, setSyncingKworb] = useState(false);
  const [runningKworb, setRunningKworb] = useState(false);
  const [runningYoutubeShadow, setRunningYoutubeShadow] = useState(false);
  const [showShadowRejected, setShowShadowRejected] = useState(false);
  const [expandedMissing, setExpandedMissing] = useState<Record<string, boolean>>({});
  const [expandedReview, setExpandedReview] = useState<Record<string, boolean>>({});
  const [expandedMomentumMissing, setExpandedMomentumMissing] = useState<Record<string, boolean>>({});
  const [missingSearch, setMissingSearch] = useState("");

  const providerEntries = useMemo(() => {
    if (!coverage) return [] as Array<[ProviderKey, CoverageProvider]>;
    return Object.entries(coverage.providers) as Array<[ProviderKey, CoverageProvider]>;
  }, [coverage]);
  const visibleProviderEntries = useMemo(
    () => providerEntries.filter(([key]) => key !== "spotify"),
    [providerEntries],
  );
  const kworbStreamCards = useMemo(() => {
    if (!coverage || !kworb) return [];
    const total = coverage.totalArtists || kworb.coverage.total || 0;
    const makeCard = (
      key: "spotify" | "youtube" | "charts",
      label: string,
      linked: number,
      snapshots: string | number | undefined,
      color: string,
      icon: ReactNode,
    ) => {
      const missing = Math.max(0, total - linked);
      return {
        key,
        label,
        linked,
        missing,
        snapshots: Number(snapshots ?? 0),
        color,
        icon,
        coveragePct: total ? Number(((linked / total) * 100).toFixed(1)) : 0,
      };
    };

    return [
      makeCard("spotify", "Spotify Kworb", kworb.coverage.bySource.withSpotify, kworb.snapshots.spotify, "#1DB954", <SiSpotify className="h-5 w-5" />),
      makeCard("youtube", "YouTube Kworb", kworb.coverage.bySource.withYoutube, kworb.snapshots.youtube, "#ff4444", <SiYoutube className="h-5 w-5" />),
      makeCard("charts", "Charts Kworb", kworb.coverage.bySource.withItunes, kworb.snapshots.itunes, "#39FF14", <BarChart3 className="h-5 w-5" />),
    ];
  }, [coverage, kworb]);
  const todayTasks = useMemo(() => coverage ? buildTodayTasks(coverage, kworb, touring) : [], [coverage, kworb, touring]);
  const normalizedMissingSearch = missingSearch.trim().toLowerCase();

  async function loadDashboard(key = adminKey) {
    const savedKey = key.trim();
    if (!savedKey) return;
    setLoading(true);
    setError(null);
    try {
      const coverageRes = await fetch("/api/admin/artists/api-coverage", { headers: { "X-Admin-Key": savedKey } });
      if (!coverageRes.ok) throw new Error(coverageRes.status === 403 ? "Clave de admin inválida." : "No se pudo cargar la cobertura.");
      setCoverage(await coverageRes.json());

      const [kworbRes, touringRes, dailySnapshotRes, youtubeShadowRes] = await Promise.all([
        fetch("/api/kworb/admin/stats", { headers: { "X-Admin-Key": savedKey } }),
        fetch("/api/admin/touring/coverage", { headers: { "X-Admin-Key": savedKey } }),
        fetch("/api/admin/artists/daily-snapshots/status", { headers: { "X-Admin-Key": savedKey } }),
        fetch("/api/admin/youtube/music-shadow/status", { headers: { "X-Admin-Key": savedKey } }),
      ]);
      setKworb(kworbRes.ok ? await kworbRes.json() : null);
      setTouring(touringRes.ok ? await touringRes.json() : null);
      setDailySnapshots(dailySnapshotRes.ok ? await dailySnapshotRes.json() : null);
      setYoutubeShadow(youtubeShadowRes.ok ? await youtubeShadowRes.json() : null);
    } catch (err) {
      setError((err as Error).message);
      setCoverage(null);
      setKworb(null);
      setTouring(null);
      setDailySnapshots(null);
      setYoutubeShadow(null);
    } finally {
      setLoading(false);
    }
  }

  function saveKey() {
    const next = draftKey.trim();
    if (!next) {
      localStorage.removeItem("mexicocharts_admin_key");
      setAdminKey("");
      setCoverage(null);
      setKworb(null);
      setTouring(null);
      setDailySnapshots(null);
      setYoutubeShadow(null);
      setError(null);
      return;
    }
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

  async function runYoutubeShadowSample() {
    if (!adminKey.trim()) {
      setError("Guarda la clave admin primero.");
      return;
    }
    setRunningYoutubeShadow(true);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/youtube/music-shadow/intraday/run", {
        method: "POST",
        headers: { "X-Admin-Key": adminKey.trim() },
      });
      const data = await res.json() as {
        status?: string;
        requestedVideos?: number;
        saved?: number;
        missing?: number;
        apiCalls?: number;
        bootstrapArtists?: number;
        bootstrapSavedCandidates?: number;
        bootstrapErrors?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "No se pudo correr la muestra privada.");
      const prepared = (data.bootstrapSavedCandidates ?? 0) > 0
        ? ` · catálogo preparado: ${data.bootstrapArtists ?? 0} artistas, ${data.bootstrapSavedCandidates ?? 0} videos`
        : "";
      const warnings = data.bootstrapErrors?.length
        ? ` · pendientes: ${data.bootstrapErrors.join(" | ")}`
        : "";
      setActionMessage(`YouTube privado: ${data.status ?? "ok"}${prepared} · ${data.saved ?? 0}/${data.requestedVideos ?? 0} videos medidos · ${data.apiCalls ?? 0} llamadas API${warnings}.`);
      await loadDashboard(adminKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunningYoutubeShadow(false);
    }
  }

  async function runDailySnapshot(provider: "youtube" | "spotify" | "youtube-video") {
    if (!adminKey.trim()) {
      setError("Guarda la clave admin primero.");
      return;
    }

    const setRunning = provider === "youtube"
      ? setRunningYoutubeSnapshots
      : provider === "youtube-video"
        ? setRunningYoutubeVideoSnapshots
        : setRunningSpotifySnapshots;
    setRunning(true);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/artists/daily-snapshots/run?provider=${provider}`, {
        method: "POST",
        headers: { "X-Admin-Key": adminKey.trim() },
      });
      if (!res.ok) {
        const label = provider === "youtube"
          ? "YouTube diario"
          : provider === "youtube-video"
            ? "YouTube videos diario"
            : "Spotify Kworb diario";
        throw new Error(`No se pudo correr ${label}.`);
      }
      const data = await res.json() as {
        result?: {
          status?: string;
          channels?: number;
          artists?: number;
          videos?: number;
          saved?: number;
          dateRows?: number;
          missing?: number;
        };
      };
      const result = data.result;
      const label = provider === "youtube" ? "YouTube canales" : provider === "youtube-video" ? "YouTube videos" : "Spotify Kworb";
      setActionMessage(`${label}: ${result?.status ?? "ok"} · ${result?.dateRows ?? result?.saved ?? 0}/${result?.videos ?? result?.channels ?? result?.artists ?? 0} snapshots hoy.`);
      await loadDashboard(adminKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function syncKworbCoverage() {
    if (!adminKey.trim()) {
      setError("Guarda la clave admin primero.");
      return;
    }

    setSyncingKworb(true);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/kworb/admin/sync-coverage", {
        method: "POST",
        headers: { "X-Admin-Key": adminKey.trim() },
      });
      if (!res.ok) throw new Error("No se pudo sincronizar Kworb.");
      const data = await res.json() as { metadataTotal?: number; newAdded?: number; jobsEnqueued?: number };
      setActionMessage(`Kworb sincronizado: ${data.metadataTotal ?? 0} artistas revisados, ${data.newAdded ?? 0} nuevos, ${data.jobsEnqueued ?? 0} jobs en cola.`);
      await loadDashboard(adminKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncingKworb(false);
    }
  }

  async function runKworbNow() {
    if (!adminKey.trim()) {
      setError("Guarda la clave admin primero.");
      return;
    }

    setRunningKworb(true);
    setActionMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/kworb/admin/run-now", {
        method: "POST",
        headers: { "X-Admin-Key": adminKey.trim() },
      });
      if (!res.ok) throw new Error("No se pudo arrancar Kworb.");
      const data = await res.json() as {
        coverage_synced?: number;
        coverage_added?: number;
        jobs_enqueued?: number;
        pending_reset?: number;
        zombies_released?: number;
      };
      setActionMessage(`Kworb listo: ${data.coverage_synced ?? 0} artistas sincronizados, ${data.coverage_added ?? 0} nuevos, ${data.jobs_enqueued ?? 0} jobs nuevos, ${data.pending_reset ?? 0} pendientes movidos a ahora.`);
      await loadDashboard(adminKey);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunningKworb(false);
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

  async function copyMissingArtists(provider: string, rows: CoverageProvider["missingPreview"]) {
    const names = rows.map(row => row.artistName).filter(Boolean).join("\n");
    if (!names) {
      setActionMessage("No hay artistas faltantes para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(names);
      setActionMessage(`Lista de faltantes de ${provider} copiada.`);
    } catch {
      setActionMessage(`Lista de faltantes de ${provider} lista para copiar manualmente.`);
    }
  }

  async function copyReviewArtists(provider: string, rows: NonNullable<CoverageProvider["reviewPreview"]>) {
    const names = rows.map(row => `${row.artistName} (${row.bestScore})`).join("\n");
    if (!names) {
      setActionMessage("No hay candidatos en revisión para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(names);
      setActionMessage(`Revisión de ${provider} copiada.`);
    } catch {
      setActionMessage(`Revisión de ${provider} lista para copiar manualmente.`);
    }
  }

  async function copyMomentumMissing(provider: string, rows: MomentumMissingRow[]) {
    const text = rows
      .map(row => `${row.artistName} (${row.artistKey}) — ${momentumReasonLabel(row.reason)} — last=${row.lastSnapshotDate ?? "never"} — id=${row.linkedId ?? "missing"}`)
      .join("\n");
    if (!text) {
      setActionMessage(`No hay pendientes de ${provider} para copiar.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setActionMessage(`Pendientes de ${provider} copiados.`);
    } catch {
      setActionMessage(`Pendientes de ${provider} listos para copiar manualmente.`);
    }
  }

  async function copyAllMissingArtists() {
    const blocks = visibleProviderEntries
      .filter(([, provider]) => provider.missingPreview.length > 0)
      .map(([key, provider]) => {
        const meta = providerMeta(key);
        const rows = normalizedMissingSearch
          ? provider.missingPreview.filter(row => {
              const haystack = `${row.artistName} ${row.artistKey}`.toLowerCase();
              return haystack.includes(normalizedMissingSearch);
            })
          : provider.missingPreview;
        const names = rows.map(row => row.artistName).filter(Boolean).join("\n");
        return `${meta.label}\n${names}`;
      })
      .filter(block => block.split("\n").length > 1)
      .join("\n\n");

    if (!blocks) {
      setActionMessage("No hay listas de faltantes para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(blocks);
      setActionMessage(normalizedMissingSearch ? "Faltantes filtrados copiados." : "Todas las listas de faltantes fueron copiadas.");
    } catch {
      setActionMessage("Listas de faltantes listas para copiar manualmente.");
    }
  }

  function setAllMissingLists(open: boolean) {
    setExpandedMissing(Object.fromEntries(visibleProviderEntries.map(([key]) => [key, open])));
  }

  useEffect(() => {
    if (adminKey) void loadDashboard(adminKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const savedKey = adminKey.trim();
    if (!savedKey) return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/youtube/music-shadow/status", {
          headers: { "X-Admin-Key": savedKey },
        });
        if (response.ok) setYoutubeShadow(await response.json());
      } catch {
        // Keep the last good private snapshot visible during a transient refresh failure.
      }
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [adminKey]);

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
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="h-3.5 w-3.5" />
            Admin
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

            {youtubeShadow && (
              <section className="rounded-lg border border-red-400/15 bg-[radial-gradient(circle_at_top_right,rgba(255,45,45,0.08),transparent_38%),#0b0b0b] p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-400/15 bg-red-500/[0.07] text-red-300">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">YouTube Live Lab</h2>
                      <span className="rounded border border-[#39FF14]/20 bg-[#39FF14]/[0.06] px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#39FF14]">
                        Privado
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-zinc-600">
                      Catálogo ampliado y medición intradía. Nada de esta prueba aparece en perfiles públicos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runYoutubeShadowSample()}
                    disabled={runningYoutubeShadow}
                    className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-red-400/25 bg-red-500/[0.08] px-3 text-[10px] font-black uppercase tracking-[0.14em] text-red-200 hover:bg-red-500/[0.13] disabled:cursor-wait disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${runningYoutubeShadow ? "animate-spin" : ""}`} />
                    {runningYoutubeShadow ? "Preparando y midiendo…" : youtubeShadow.catalogReady ? "Medir ahora" : "Preparar y medir"}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    ["Artistas", `${youtubeShadow.readyPilotArtists}/${youtubeShadow.totalPilotArtists}`],
                    ["Videos únicos", youtubeShadow.counts.unique_videos],
                    ["Observados", youtubeShadow.counts.observed],
                    ["En revisión", youtubeShadow.counts.review],
                    ["Verificados", youtubeShadow.counts.verified],
                    ["Rechazados", youtubeShadow.counts.rejected],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg border border-white/[0.06] bg-black/25 p-3">
                      <div className="text-2xl font-black text-white">
                        {typeof value === "string" && value.includes("/") ? value : fmtCount(value as number)}
                      </div>
                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-white/[0.055] bg-black/20 px-4 py-3 text-[10px] font-black uppercase tracking-[0.13em] text-zinc-600">
                  <span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-[#39FF14]" /> Sin cambios públicos</span>
                  <span>Automatización: {youtubeShadow.automationEnabled ? "activa" : "pausada"}</span>
                  <span>Última muestra: {fmtDate(youtubeShadow.counts.latest_observed_at)}</span>
                  <span>Llamadas API hoy: {youtubeShadow.usage[0]?.api_calls ?? 0}</span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {youtubeShadow.pilotArtists.map(pilot => {
                    const ready = Number(pilot.eligible_candidates) > 0;
                    return (
                      <div key={pilot.artist_key} className={`rounded-lg border p-3 ${ready ? "border-[#39FF14]/15 bg-[#39FF14]/[0.035]" : "border-amber-300/15 bg-amber-300/[0.035]"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-zinc-200">{pilot.artist_name}</span>
                          <span className={`text-[8px] font-black uppercase tracking-[0.12em] ${ready ? "text-[#39FF14]" : "text-amber-200"}`}>
                            {ready ? "Listo" : pilot.discovery_status === "failed" ? "Falló" : "Pendiente"}
                          </span>
                        </div>
                        <div className="mt-1 text-[9px] font-bold text-zinc-600">
                          {ready
                            ? `${pilot.eligible_candidates} videos elegibles`
                            : pilot.discovery_error ?? "Se intentará preparar en la siguiente ejecución."}
                        </div>
                        {!ready && pilot.last_attempt_at && (
                          <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-700">Último intento: {fmtDate(pilot.last_attempt_at)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-white/[0.07]">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-white/[0.06] bg-white/[0.025] px-4 py-3 text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(80px,auto))]">
                    <span>Artista</span>
                    <span className="hidden sm:block">Catálogo</span>
                    <span className="hidden sm:block">Medidos</span>
                    <span>Total views</span>
                    <span>Cambio</span>
                  </div>
                  {youtubeShadow.artists.length > 0 ? youtubeShadow.artists.map(artist => (
                    <div key={artist.artist_key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-white/[0.045] px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(80px,auto))]">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black uppercase tracking-[0.08em] text-zinc-200">{artist.artist_key.replaceAll("-", " ")}</div>
                        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700">
                          {artist.hot_count} hot · {artist.warm_count} warm · {artist.baseline_count} base
                        </div>
                      </div>
                      <span className="hidden text-sm font-black text-zinc-300 sm:block">{artist.tracked_video_count}</span>
                      <span className="hidden text-sm font-black text-zinc-300 sm:block">{artist.videos_with_observations}</span>
                      <span className="text-sm font-black text-white">{fmtCompact(artist.total_views)}</span>
                      <span className={`text-sm font-black ${Number(artist.latest_view_delta) > 0 ? "text-[#39FF14]" : "text-zinc-600"}`}>
                        +{Number(artist.latest_view_delta) > 0 ? fmtCount(artist.latest_view_delta) : "0"}
                      </span>
                    </div>
                  )) : (
                    <div className="px-4 py-6 text-center text-xs font-bold text-zinc-600">
                      {youtubeShadow.catalogReady
                        ? "El catálogo privado está listo; todavía no hay muestras guardadas."
                        : "El catálogo piloto todavía no se ha preparado. Usa “Preparar y medir” para cargarlo y guardar la primera muestra."}
                    </div>
                  )}
                </div>

                {youtubeShadow.rejectedCandidates.length > 0 && (
                  <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20">
                    <button
                      type="button"
                      onClick={() => setShowShadowRejected(value => !value)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <Eye className="h-4 w-4 text-zinc-600" />
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Ver rechazos confirmados</span>
                      <span className="rounded bg-white/[0.05] px-2 py-0.5 text-[9px] font-black text-zinc-500">{youtubeShadow.rejectedCandidates.length}</span>
                      <ChevronDown className={`ml-auto h-4 w-4 text-zinc-600 transition-transform ${showShadowRejected ? "rotate-180" : ""}`} />
                    </button>
                    {showShadowRejected && (
                      <div className="max-h-80 overflow-auto border-t border-white/[0.06]">
                        {youtubeShadow.rejectedCandidates.map(row => (
                          <a key={`${row.artist_key}-${row.video_id}`} href={row.canonical_url} target="_blank" rel="noreferrer" className="grid gap-1 border-b border-white/[0.04] px-4 py-3 last:border-b-0 hover:bg-white/[0.025] sm:grid-cols-[1fr_auto]">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-zinc-300">{row.title}</div>
                              <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700">{row.artist_name} · {row.video_id}</div>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-red-300/70">{row.rejection_reason?.replaceAll("_", " ") ?? "Rechazado"}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {dailySnapshots && (
              <section className="rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <Clock3 className="h-5 w-5 text-[#39FF14]" />
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">Momentum diario</h2>
                    <p className="mt-1 text-xs font-bold text-zinc-600">
                      Medición de hoy: {dailySnapshots.snapshotDate} · Actualizado {fmtDate(dailySnapshots.generatedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadDashboard(adminKey)}
                    className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 hover:border-[#39FF14]/30 hover:text-[#39FF14]"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refrescar
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  {[
                    {
                      key: "youtube",
                      label: "YouTube canales",
                      scope: "canales oficiales vinculados",
                      color: "#ff4444",
                      icon: <SiYoutube className="h-5 w-5" />,
                      total: dailySnapshots.youtube.total,
                      dateRows: dailySnapshots.youtube.dateRows,
                      missing: dailySnapshots.youtube.missing,
                      latestFetchedAt: dailySnapshots.youtube.latestFetchedAt,
                      totalDaily: dailySnapshots.youtube.totalDailyViews,
                      totalLabel: "views diarias",
                      missingPreview: dailySnapshots.youtube.missingPreview ?? [],
                      missingReasonCounts: dailySnapshots.youtube.missingReasonCounts ?? {},
                      running: runningYoutubeSnapshots,
                      run: () => void runDailySnapshot("youtube"),
                      totalCountLabel: "Canales",
                      extraMeta: "Total del canal oficial; no siempre cambia diario",
                    },
                    {
                      key: "youtube-video",
                      label: "YouTube videos",
                      scope: `${dailySnapshots.youtubeVideoTracker?.artists ?? 0} artistas · ${dailySnapshots.youtubeVideoTracker?.activeLinks ?? 0} enlaces activos`,
                      color: "#ff7a3d",
                      icon: <SiYoutube className="h-5 w-5" />,
                      total: dailySnapshots.youtubeVideoTracker?.total ?? 0,
                      dateRows: dailySnapshots.youtubeVideoTracker?.dateRows ?? 0,
                      missing: dailySnapshots.youtubeVideoTracker?.missing ?? 0,
                      latestFetchedAt: dailySnapshots.youtubeVideoTracker?.latestFetchedAt ?? null,
                      totalDaily: dailySnapshots.youtubeVideoTracker?.totalDailyViews ?? 0,
                      totalLabel: "views rastreadas",
                      missingPreview: dailySnapshots.youtubeVideoTracker?.missingPreview ?? [],
                      missingReasonCounts: dailySnapshots.youtubeVideoTracker?.missingReasonCounts ?? {},
                      running: runningYoutubeVideoSnapshots,
                      run: () => void runDailySnapshot("youtube-video"),
                      totalCountLabel: "Videos",
                      extraMeta: `${dailySnapshots.youtubeVideoTracker?.rollupRows ?? 0} rollups · ${dailySnapshots.youtubeVideoTracker?.frozenVideos ?? 0} videos sin cambio`,
                    },
                    {
                      key: "spotify",
                      label: "Spotify",
                      scope: "artistas Spotify con Kworb",
                      color: "#1DB954",
                      icon: <SiSpotify className="h-5 w-5" />,
                      total: dailySnapshots.spotifyKworb.total,
                      dateRows: dailySnapshots.spotifyKworb.dateRows,
                      missing: dailySnapshots.spotifyKworb.missing,
                      latestFetchedAt: dailySnapshots.spotifyKworb.latestFetchedAt,
                      totalDaily: dailySnapshots.spotifyKworb.totalDailyStreams,
                      totalLabel: "streams diarios",
                      missingPreview: dailySnapshots.spotifyKworb.missingPreview ?? [],
                      missingReasonCounts: dailySnapshots.spotifyKworb.missingReasonCounts ?? {},
                      running: runningSpotifySnapshots,
                      run: () => void runDailySnapshot("spotify"),
                      totalCountLabel: "Artistas",
                      extraMeta: "Streams diarios desde Kworb",
                    },
                  ].map(card => {
                    const complete = card.total > 0 && card.dateRows >= card.total;
                    const pct = card.total > 0 ? Math.min(100, Math.round((card.dateRows / card.total) * 100)) : 0;
                    return (
                      <article key={card.key} className="rounded-lg border border-white/[0.07] bg-black/20 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04]" style={{ color: card.color }}>
                            {card.icon}
                          </div>
                          <div>
                            <h3 className="text-sm font-black uppercase tracking-[0.1em] text-white">{card.label}</h3>
                            <p className={`mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${complete ? "text-[#39FF14]" : "text-amber-300"}`}>
                              {complete ? "Completo hoy" : `${card.missing} pendientes hoy`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={card.run}
                            disabled={card.running}
                            className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#39FF14] hover:bg-[#39FF14]/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${card.running ? "animate-spin" : ""}`} />
                            Run now
                          </button>
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: card.color }} />
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-3">
                          <div>
                            <div className="text-2xl font-black text-white">{card.dateRows}</div>
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Medidos hoy</div>
                          </div>
                          <div>
                            <div className="text-2xl font-black text-white">{card.total}</div>
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">{card.totalCountLabel}</div>
                          </div>
                          <div>
                            <div className="text-2xl font-black text-white">{fmtCompact(card.totalDaily)}</div>
                            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">{card.totalLabel}</div>
                          </div>
                        </div>

                        <div className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                          <div>{card.dateRows}/{card.total} {card.scope}</div>
                          <div className="mt-1">Última corrida: {fmtDate(card.latestFetchedAt)}</div>
                          <div className="mt-1">{card.extraMeta}</div>
                        </div>

                        {card.missing > 0 && (
                          <div className="mt-3 rounded-lg border border-white/[0.055] bg-white/[0.018] p-3">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              {Object.entries(card.missingReasonCounts).map(([reason, count]) => (
                                <span key={reason} className="rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-200">
                                  {momentumReasonLabel(reason)}: {count}
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedMomentumMissing(prev => ({ ...prev, [card.key]: !prev[card.key] }))}
                                className="inline-flex items-center gap-2 rounded border border-white/10 bg-black/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 hover:border-amber-300/25 hover:text-amber-200"
                              >
                                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedMomentumMissing[card.key] ? "rotate-180" : ""}`} />
                                Ver pendientes
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyMomentumMissing(card.label, card.missingPreview)}
                                className="inline-flex items-center gap-2 rounded border border-white/10 bg-black/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 hover:border-[#39FF14]/25 hover:text-[#39FF14]"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                Copiar
                              </button>
                            </div>

                            {expandedMomentumMissing[card.key] && (
                              <div className="mt-3 max-h-72 overflow-auto rounded border border-white/[0.05] bg-black/20">
                                {card.missingPreview.length > 0 ? (
                                  card.missingPreview.map(row => (
                                    <div key={`${card.key}-${row.artistKey}-${row.linkedId ?? row.linkedLabel ?? row.reason}`} className="grid gap-2 border-b border-white/[0.04] px-3 py-2 last:border-b-0 sm:grid-cols-[1fr_auto]">
                                      <div className="min-w-0">
                                        <div className="truncate text-xs font-black text-zinc-200">{row.artistName}</div>
                                        <div className="mt-0.5 truncate text-[10px] font-bold text-zinc-700">
                                          {row.artistKey} · {row.linkedLabel ?? card.label} · {row.linkedId ?? "sin ID"}
                                        </div>
                                      </div>
                                      <div className="text-left sm:text-right">
                                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-200">{momentumReasonLabel(row.reason)}</div>
                                        <div className="mt-0.5 text-[10px] font-bold text-zinc-700">
                                          Último: {row.lastSnapshotDate ?? "nunca"}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-3 py-3 text-xs font-bold text-zinc-600">
                                    Sin detalle disponible todavía.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-lg border border-white/[0.06] bg-black/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">Últimas corridas</h3>
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-700">
                      YouTube + Spotify + Videos
                    </span>
                  </div>
                  <div className="grid gap-2 lg:grid-cols-2">
                    {(dailySnapshots.recentRuns ?? []).length > 0 ? (
                      (dailySnapshots.recentRuns ?? []).slice(0, 8).map(run => {
                        const providerLabel = run.provider === "youtube"
                          ? "YouTube canales"
                          : run.provider === "youtube-video"
                            ? "YouTube videos"
                            : "Spotify";
                        const valueLabel = run.provider === "spotify" ? "streams" : "views";
                        return (
                          <div key={run.id} className="rounded border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-200">{providerLabel}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${snapshotRunStatusTone(run.status)}`}>
                                {run.status}
                              </span>
                              <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700">
                                {fmtDate(run.startedAt)}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-black uppercase tracking-[0.12em]">
                              <div>
                                <div className="text-sm text-white">{run.savedCount}/{run.expectedCount}</div>
                                <div className="text-zinc-700">Guardados</div>
                              </div>
                              <div>
                                <div className="text-sm text-white">{run.missingCount}</div>
                                <div className="text-zinc-700">Faltantes</div>
                              </div>
                              <div>
                                <div className="text-sm text-white">{fmtCompact(run.totalDailyValue)}</div>
                                <div className="text-zinc-700">{valueLabel}</div>
                              </div>
                            </div>
                            {run.error && (
                              <div className="mt-2 truncate rounded border border-red-400/10 bg-red-500/[0.04] px-2 py-1 text-[10px] font-bold text-red-200">
                                {run.error}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded border border-white/[0.05] px-3 py-3 text-xs font-bold text-zinc-600 lg:col-span-2">
                        Sin corridas registradas todavía.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white">Buscar faltantes</h2>
                  <p className="mt-1 text-xs font-bold text-zinc-600">Filtra YouTube, MusicBrainz y portadas Deezer por nombre o clave de artista.</p>
                </div>
                <div className="relative lg:ml-auto lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <input
                    value={missingSearch}
                    onChange={e => setMissingSearch(e.target.value)}
                    placeholder="Buscar artista faltante"
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm font-bold text-white outline-none placeholder:text-zinc-700 focus:border-[#39FF14]/50"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAllMissingLists(true)}
                    className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 hover:border-[#39FF14]/30 hover:text-[#39FF14]"
                  >
                    Abrir todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllMissingLists(false)}
                    className="h-10 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 hover:border-[#39FF14]/30 hover:text-[#39FF14]"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyAllMissingArtists()}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#39FF14] hover:bg-[#39FF14]/15"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {normalizedMissingSearch ? "Copiar filtro" : "Copiar todo"}
                  </button>
                </div>
              </div>
            </section>

            {kworbStreamCards.length > 0 && (
              <section className="grid gap-4 lg:grid-cols-3">
                {kworbStreamCards.map(card => (
                  <article key={card.key} className="rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04]" style={{ color: card.color }}>
                        {card.icon}
                      </div>
                      <div>
                        <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">{card.label}</h2>
                        <p className="text-xs font-bold text-zinc-600">{card.coveragePct}% de cobertura</p>
                      </div>
                      {card.key === "spotify" && (
                        <button
                          type="button"
                          onClick={() => void copyCommand(KWORB_DIRECT_COMMAND, "Kworb directo")}
                          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#39FF14]/25 bg-[#39FF14]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/15"
                        >
                          Copiar comando
                        </button>
                      )}
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full" style={{ width: `${card.coveragePct}%`, background: card.color }} />
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-2xl font-black text-white">{card.linked}</div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Con datos</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white">{card.missing}</div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Sin datos</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white">{card.snapshots}</div>
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Snapshots</div>
                      </div>
                    </div>

                    <div className="mt-5 border-t border-white/[0.06] pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                      Datos diarios guardados desde Kworb
                    </div>
                  </article>
                ))}
              </section>
            )}

            <section className="grid gap-4 lg:grid-cols-3">
              {visibleProviderEntries.map(([key, provider]) => {
                const meta = providerMeta(key);
                const visibleMissing = normalizedMissingSearch
                  ? provider.missingPreview.filter(row => {
                      const haystack = `${row.artistName} ${row.artistKey}`.toLowerCase();
                      return haystack.includes(normalizedMissingSearch);
                    })
                  : provider.missingPreview;
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
                      {(provider.reviewPreview?.length ?? 0) > 0 && (
                        <div className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.04]">
                          <div className="flex items-center gap-2 border-b border-amber-500/10 p-3">
                            <button
                              type="button"
                              onClick={() => setExpandedReview(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <ChevronDown className={`h-4 w-4 shrink-0 text-amber-400/60 transition-transform ${expandedReview[key] ? "rotate-180" : ""}`} />
                              <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                                Revisar candidatos
                              </span>
                              <span className="rounded border border-amber-400/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-300/80">
                                {provider.reviewPreview?.length ?? 0}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyReviewArtists(meta.label, provider.reviewPreview ?? [])}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-amber-400/20 text-amber-300/70 hover:bg-amber-400/10 hover:text-amber-200"
                              aria-label={`Copiar revisión de ${meta.label}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {expandedReview[key] && (
                            <div className="max-h-56 overflow-y-auto p-2">
                              {(provider.reviewPreview ?? []).map(row => (
                                <div key={row.artistKey} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs font-bold text-zinc-400 hover:bg-white/[0.03]">
                                  <span className="min-w-0 flex-1 truncate">{row.artistName}</span>
                                  <span className="rounded border border-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300">{row.bestScore}</span>
                                </div>
                              ))}
                              <Link href="/admin/enrichment-review" className="mt-1 block rounded px-2 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300 hover:bg-amber-400/10">
                                Abrir cola completa
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
                      {provider.missingPreview.length > 0 && (
                        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20">
                          <div className="flex items-center gap-2 border-b border-white/[0.06] p-3">
                            <button
                              type="button"
                              onClick={() => setExpandedMissing(prev => ({ ...prev, [key]: !prev[key] }))}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-600 transition-transform ${expandedMissing[key] ? "rotate-180" : ""}`} />
                              <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                                Ver faltantes
                              </span>
                              <span className="rounded border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
                                {normalizedMissingSearch ? visibleMissing.length : provider.missingPreview.length}{provider.missing > provider.missingPreview.length && !normalizedMissingSearch ? "+" : ""}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyMissingArtists(meta.label, visibleMissing)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/10 text-zinc-500 hover:border-[#39FF14]/30 hover:text-[#39FF14]"
                              aria-label={`Copiar faltantes de ${meta.label}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {expandedMissing[key] && (
                            <div className="max-h-64 overflow-y-auto p-2">
                              {visibleMissing.map(row => (
                                <div key={row.artistKey} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs font-bold text-zinc-400 hover:bg-white/[0.03]">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
                                  <span className="min-w-0 flex-1 truncate">{row.artistName}</span>
                                  <span className="truncate text-[10px] uppercase tracking-[0.12em] text-zinc-700">{row.artistKey}</span>
                                </div>
                              ))}
                              {visibleMissing.length === 0 && (
                                <div className="px-2 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                                  No hay coincidencias con ese filtro.
                                </div>
                              )}
                              {provider.missing > provider.missingPreview.length && (
                                <div className="px-2 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-700">
                                  Hay más faltantes fuera de esta vista rápida.
                                </div>
                              )}
                            </div>
                          )}
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
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void syncKworbCoverage()}
                      disabled={syncingKworb}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 hover:border-[#39FF14]/30 hover:text-[#39FF14] disabled:cursor-wait disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncingKworb ? "animate-spin" : ""}`} />
                      Sync
                    </button>
                    <button
                      type="button"
                      onClick={() => void runKworbNow()}
                      disabled={runningKworb}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#39FF14]/30 bg-[#39FF14]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#39FF14] hover:bg-[#39FF14]/16 disabled:cursor-wait disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${runningKworb ? "animate-spin" : ""}`} />
                      Run now
                    </button>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                    {kworb.fetchingEnabled ? "Activo" : "Pausado"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-5">
                  <div><div className="text-2xl font-black text-white">{kworb.coverage.total}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Seguimiento</div></div>
                  <div><div className="text-2xl font-black text-white">{kworb.coverage.bySource.withAny}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Con datos</div></div>
                  <div><div className="text-2xl font-black text-white">{kworb.noSnapshotCount}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Sin snapshot</div></div>
                  <div><div className="text-2xl font-black text-white">{kworb.snapshots.stale_snapshots ?? "0"}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Vencidos</div></div>
                  <div><div className="text-2xl font-black text-white">{kworb.estimatedDaysToFull}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Días est.</div></div>
                </div>

                <div className="mt-6 rounded-lg border border-[#39FF14]/15 bg-[#39FF14]/[0.035] p-4">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white">Actividad reciente</h3>
                    <span className="ml-auto text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">
                      Snapshots guardados en base de datos
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    <div><div className="text-2xl font-black text-white">{kworb.snapshotsToday?.artists ?? "0"}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Artistas hoy</div></div>
                    <div><div className="text-2xl font-black text-white">{kworb.snapshotsToday?.spotify ?? "0"}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Spotify</div></div>
                    <div><div className="text-2xl font-black text-white">{kworb.snapshotsToday?.youtube ?? "0"}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">YouTube</div></div>
                    <div><div className="text-2xl font-black text-white">{kworb.snapshotsToday?.itunes ?? "0"}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Charts</div></div>
                    <div><div className="text-2xl font-black text-white">{kworb.queue?.pending ?? "0"}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Pendientes</div></div>
                    <div><div className="text-2xl font-black text-white">{kworb.queue?.running ?? "0"}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Corriendo</div></div>
                    <div><div className="text-2xl font-black text-white">{kworb.requestBudget.today}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Requests sesión</div></div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-white/[0.07] bg-black/25 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">Spotify diario</h3>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#39FF14]">Streams</span>
                    </div>
                    <div className="space-y-2">
                      {(kworb.topDaily?.spotify ?? []).length > 0 ? (
                        (kworb.topDaily?.spotify ?? []).slice(0, 6).map((row, index) => (
                          <div key={row.artist_key} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                            <span className="text-[10px] font-black text-zinc-700">#{index + 1}</span>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-zinc-200">{row.artist_name}</div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700">Total {fmtCompact(row.total_streams)}</div>
                            </div>
                            <div className="text-right text-sm font-black text-white">{fmtCount(row.daily_streams)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded border border-white/[0.05] px-3 py-3 text-xs font-bold text-zinc-600">
                          Sin snapshots de Spotify guardados todavía
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/[0.07] bg-black/25 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">YouTube diario</h3>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">Views</span>
                    </div>
                    <div className="space-y-2">
                      {(kworb.topDaily?.youtube ?? []).length > 0 ? (
                        (kworb.topDaily?.youtube ?? []).slice(0, 6).map((row, index) => (
                          <div key={row.artist_key} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                            <span className="text-[10px] font-black text-zinc-700">#{index + 1}</span>
                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-zinc-200">{row.artist_name}</div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-700">Total {fmtCompact(row.total_views)}</div>
                            </div>
                            <div className="text-right text-sm font-black text-white">{fmtCount(row.daily_views)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded border border-white/[0.05] px-3 py-3 text-xs font-bold text-zinc-600">
                          Sin snapshots de YouTube guardados todavía
                        </div>
                      )}
                    </div>
                  </div>
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
                    {touring.configured ? "Configurado" : "Sin clave API"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <div><div className="text-2xl font-black text-white">{touring.totalTracked}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Seguimiento</div></div>
                  <div><div className="text-2xl font-black text-white">{touring.checked}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Revisados</div></div>
                  <div><div className="text-2xl font-black text-white">{touring.withUpcomingShows}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Con shows</div></div>
                  <div><div className="text-2xl font-black text-white">{touring.withoutUpcomingShows}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Sin shows</div></div>
                  <div><div className="text-2xl font-black text-white">{touring.stale}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Por revisar</div></div>
                  <div><div className="text-sm font-black text-white">{fmtDate(touring.newestFetchAt)}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Última actualización</div></div>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
