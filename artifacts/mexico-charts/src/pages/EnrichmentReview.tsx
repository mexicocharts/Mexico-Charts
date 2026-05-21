import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink, KeyRound, RefreshCw } from "lucide-react";
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

export default function EnrichmentReview() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem("mexicocharts_admin_key") ?? "");
  const [draftKey, setDraftKey] = useState(adminKey);
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rows = useMemo(() => [...(data?.spotify ?? []), ...(data?.musicbrainz ?? [])], [data]);

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
          <span className="ml-auto text-[10px] font-black uppercase tracking-[0.24em] text-[#39FF14]">Admin</span>
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

        <section className="flex flex-col gap-3">
          {rows.map(row => {
            const icon = row.provider === "spotify"
              ? <SiSpotify className="h-4 w-4 text-[#1DB954]" />
              : <SiMusicbrainz className="h-4 w-4 text-[#f59e0b]" />;
            const best = row.candidates[0];
            const url = best ? candidateUrl(row.provider, best) : null;
            const displayName = row.provider === "spotify" ? best?.spotifyName : best?.name;

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
                        Mejor candidato: <span className="font-bold text-zinc-400">{displayName ?? "Sin resultado"}</span>
                        {best?.score != null && <span> · score {best.score}</span>}
                        <span> · {fmtDate(row.searchedAt)}</span>
                      </p>
                      {best?.reasons?.length > 0 && (
                        <p className="mt-1 text-xs text-zinc-700">{best.reasons.join(" · ")}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
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
              </article>
            );
          })}

          {data && rows.length === 0 && (
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-8 text-center text-sm font-bold text-zinc-500">
              No hay candidatos pendientes de revisión.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
