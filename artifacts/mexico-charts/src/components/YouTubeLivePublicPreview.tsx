import { useEffect, useRef, useState } from "react";
import { Activity, Clock3, Eye, Play } from "lucide-react";
import { Link } from "wouter";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

export interface YouTubeLivePreviewVideo {
  video_id: string;
  title: string;
  thumbnail_url: string | null;
  canonical_url: string;
  view_count: string | number | null;
  view_delta: string | number | null;
  seconds_since_previous: string | number | null;
  observed_at: string | null;
  views_24h: string | number | null;
  views_24h_started_at: string | null;
  views_24h_ended_at: string | null;
  views_today_et: string | number | null;
  views_today_et_started_at: string | null;
  views_today_et_ended_at: string | null;
}

interface YouTubeLivePublicPreviewProps {
  artistName: string;
  videos: YouTubeLivePreviewVideo[];
  motionDemo?: boolean;
  publicPreview?: boolean;
}

function numberValue(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(numberValue(value));
}

function GainValue({ value }: { value: string | number | null | undefined }) {
  if (value == null) return <span className="text-zinc-700">Pendiente</span>;
  return <span className="tabular-nums text-[#39FF14]">+{formatNumber(value)}</span>;
}

function formatClock(iso: string | null): string {
  if (!iso) return "Esperando lectura";
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatInterval(value: string | number | null | undefined): string {
  const seconds = numberValue(value);
  if (seconds <= 0) return "intervalo pendiente";
  if (seconds < 90) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;
  const hours = seconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
}

function useRollingInteger(value: string | number | null | undefined) {
  const target = numberValue(value);
  const [displayed, setDisplayed] = useState(target);
  const previousTarget = useRef(target);

  useEffect(() => {
    const start = previousTarget.current;
    previousTarget.current = target;
    if (start === target) {
      setDisplayed(target);
      return;
    }

    const startedAt = performance.now();
    const duration = 850;
    let animationFrame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(start + (target - start) * eased));
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [target]);

  return displayed;
}

function RollingCount({ value, className = "" }: { value: string | number | null | undefined; className?: string }) {
  const displayed = useRollingInteger(value);
  return <span className={`tabular-nums ${className}`}>{formatNumber(displayed)}</span>;
}

function VideoThumb({ video, className = "" }: { video: YouTubeLivePreviewVideo; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-zinc-950 ${className}`}>
      {video.thumbnail_url ? (
        <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full items-center justify-center text-zinc-800"><Play className="h-8 w-8" /></div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      <span className="absolute bottom-2 left-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-950/40">
        <Play className="ml-0.5 h-3 w-3 fill-current" />
      </span>
    </div>
  );
}

export default function YouTubeLivePublicPreview({ artistName, videos, motionDemo = false, publicPreview = false }: YouTubeLivePublicPreviewProps) {
  const ranked = [...videos]
    .filter(video => video.view_count != null)
    .sort((a, b) => numberValue(b.view_count) - numberValue(a.view_count));
  const featured = ranked[0];

  if (!featured) return null;

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[#070707] shadow-2xl shadow-black/40">
      <div className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_82%_-20%,rgba(255,35,35,0.18),transparent_34%),radial-gradient(circle_at_12%_0%,rgba(57,255,20,0.08),transparent_28%)] px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center gap-3">
          <img src={logoUrl} alt="Mexico Charts" className="h-9 w-9 object-contain" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">
              <span>Mexico Charts</span>
              <span className="text-zinc-800">/</span>
              <span className="inline-flex items-center gap-1.5 text-red-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> YouTube en vivo
              </span>
            </div>
            <h3 className="mt-1 truncate text-xl font-black uppercase tracking-[-0.02em] text-white sm:text-2xl">{artistName}</h3>
          </div>
          <div className="ml-auto text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-red-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Contador activo
            </div>
            <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-600">Lectura {formatClock(featured.observed_at)} ET</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
        <a href={featured.canonical_url} target="_blank" rel="noreferrer" className="group block border-b border-white/[0.07] p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <VideoThumb video={featured} className="aspect-video rounded-xl border border-white/[0.08]" />
          <div className="mt-5 border-b border-white/[0.07] pb-5">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-600">
              <Eye className="h-3.5 w-3.5 text-red-400" /> Vistas totales
            </div>
            <div aria-live="polite" className="mt-1 overflow-hidden text-[clamp(2.3rem,7vw,4.75rem)] font-black leading-none tracking-[-0.055em] text-white">
              <RollingCount value={featured.view_count} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[8px] font-black uppercase tracking-[0.13em] text-zinc-600">
              <span>Conteo oficial guardado</span>
              {motionDemo && <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1 text-amber-200">Movimiento de muestra</span>}
            </div>
          </div>
          <div className="mt-4">
            <div className="line-clamp-2 text-base font-black leading-snug text-white transition-colors group-hover:text-red-200">{featured.title}</div>
            <div className="mt-2 text-[9px] font-bold uppercase tracking-[0.13em] text-zinc-600">Cada lectura reemplaza el total anterior con la cifra exacta más reciente.</div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="text-[8px] font-black uppercase tracking-[0.13em] text-zinc-600">Última lectura</div>
              <div className="mt-1 text-lg font-black"><GainValue value={featured.view_delta} /></div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-700">Desde el conteo anterior · {formatInterval(featured.seconds_since_previous)}</div>
            </div>
            <div className="rounded-xl border border-[#39FF14]/10 bg-[#39FF14]/[0.025] p-3">
              <div className="text-[8px] font-black uppercase tracking-[0.13em] text-zinc-600">Hoy · ET</div>
              <div className="mt-1 text-lg font-black"><GainValue value={featured.views_today_et} /></div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-700">Desde 12:00 a.m.</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="text-[8px] font-black uppercase tracking-[0.13em] text-zinc-600">Último día completo</div>
              <div className="mt-1 text-lg font-black"><GainValue value={featured.views_24h} /></div>
              <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-700">12 a.m. → 12 a.m. ET</div>
            </div>
          </div>
        </a>

        <div className="max-h-[620px] divide-y divide-white/[0.06] overflow-y-auto">
          {ranked.slice(1).map((video, index) => (
            <a key={video.video_id} href={video.canonical_url} target="_blank" rel="noreferrer" className="group grid grid-cols-[112px_minmax(0,1fr)] gap-3 p-4 transition-colors hover:bg-white/[0.025]">
              <VideoThumb video={video} className="aspect-video rounded-lg border border-white/[0.07]" />
              <div className="flex min-w-0 flex-col justify-between py-0.5">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-700">0{index + 2}</div>
                  <div className="mt-1 line-clamp-2 text-xs font-black leading-snug text-zinc-200 group-hover:text-white">{video.title}</div>
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-700">Última lectura</div>
                    <div className="mt-0.5 text-xs font-black"><GainValue value={video.view_delta} /></div>
                    <div className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-zinc-700">{formatInterval(video.seconds_since_previous)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-700">Hoy desde 12 a.m. ET</div>
                    <div className="mt-0.5 text-sm font-black"><GainValue value={video.views_today_et} /></div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] bg-white/[0.018] px-5 py-3 text-[9px] font-bold text-zinc-600 sm:px-7">
        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Lecturas exactas periódicas</span>
        <span>{ranked.length} videos con contador individual</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-zinc-500"><Activity className="h-3.5 w-3.5" /> Sin estimaciones entre lecturas</span>
      </div>
      {publicPreview && ranked.length >= 10 && (
        <div className="flex flex-col gap-4 border-t border-[#39FF14]/15 bg-[#39FF14]/[0.035] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#39FF14]">Vista pública · 10 videos</p>
            <p className="mt-1 text-sm font-bold text-white/70">El Monitor desbloquea todos los videos rastreados de este artista.</p>
          </div>
          <Link href="/monitoreo" className="shrink-0 rounded-full bg-[#39FF14] px-5 py-3 text-center text-[9px] font-black uppercase tracking-[0.15em] text-black">
            Ver Monitor · $6/mes
          </Link>
        </div>
      )}
    </section>
  );
}
