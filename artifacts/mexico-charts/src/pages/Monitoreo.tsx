import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  Home,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { EditorialFooter } from "@/components/EditorialLayout";
import { useArtistMetadata } from "@/services/dataProvider";
import { CONTACT_EMAIL, SITE_URL } from "@/config/brand";
import { useLanguage } from "@/i18n/LanguageContext";

const G = "#39FF14";

type MonitoringConfig = {
  checkoutEnabled: boolean;
  priceUsdCents: number;
  delivery: "daily_dashboard_monthly_report";
};

type MonitoringArtistAvailability = {
  policyVersion: number;
  count: number;
  artists: Array<{ artistKey: string; artistName: string; matchKeys: string[] }>;
};

function compactArtistKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function Monitoreo() {
  const { language, pick } = useLanguage();
  const search = useSearch();
  const requestedArtist = new URLSearchParams(search).get("artist")?.trim().toLowerCase() ?? "";
  const { byKey, isLoading: artistsLoading } = useArtistMetadata();
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(requestedArtist);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { data: config } = useQuery<MonitoringConfig>({
    queryKey: ["monitoringConfig"],
    queryFn: async () => {
      const response = await fetch("/api/monitoring/config");
      if (!response.ok) throw new Error("Monitoring configuration unavailable");
      return response.json() as Promise<MonitoringConfig>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const { data: availability, isLoading: availabilityLoading } = useQuery<MonitoringArtistAvailability>({
    queryKey: ["monitoringArtists"],
    queryFn: async () => {
      const response = await fetch("/api/monitoring/artists");
      if (!response.ok) throw new Error("Monitoring artist availability unavailable");
      return response.json() as Promise<MonitoringArtistAvailability>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const readyMatchKeys = useMemo(() => new Set(
    (availability?.artists ?? []).flatMap(artist => artist.matchKeys.map(compactArtistKey)),
  ), [availability]);

  const artists = useMemo(() => [...byKey.values()]
    .filter(artist => readyMatchKeys.has(compactArtistKey(artist.artistKey)))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es")), [byKey, readyMatchKeys]);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return artists.filter(artist => (
      artist.displayName.toLocaleLowerCase().includes(normalized)
      || artist.artistKey.includes(normalized)
    )).slice(0, 6);
  }, [artists, query]);
  const selectedArtist = artists.find(artist => artist.artistKey === selectedKey) ?? null;
  const previewArtist = selectedArtist
    ?? artists.find(artist => artist.displayName.toLocaleLowerCase() === "peso pluma")
    ?? null;

  async function startCheckout() {
    if (!selectedArtist) return;
    setCheckoutError("");
    if (!config?.checkoutEnabled) {
      const subject = encodeURIComponent(`Monitoreo mensual — ${selectedArtist.displayName}`);
      const body = encodeURIComponent(
        pick(
          `Hola, quiero solicitar el monitoreo mensual de ${selectedArtist.displayName} por $6 USD al mes.`,
          `Hello, I would like to request monthly monitoring for ${selectedArtist.displayName} for $6 USD per month.`,
        ),
      );
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      return;
    }
    setCheckoutLoading(true);
    try {
      const response = await fetch("/api/monitoring/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artistKey: selectedArtist.artistKey,
          artistName: selectedArtist.displayName,
          language,
        }),
      });
      const payload = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Unable to start checkout");
      }
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      console.error("[Monitoring checkout]", error);
      setCheckoutError(pick(
        "No pudimos abrir el pago seguro. Inténtalo de nuevo o escríbenos.",
        "We could not open secure checkout. Please try again or contact us.",
      ));
    } finally {
      setCheckoutLoading(false);
    }
  }

  const features = [
    { icon: BarChart3, title: pick("Métricas actuales", "Current metrics"), body: pick("Audiencia disponible de Spotify, YouTube y plataformas sociales en un solo resumen.", "Available Spotify, YouTube and social-platform audiences in one summary.") },
    { icon: TrendingUp, title: pick("Cambios por periodo", "Period changes"), body: pick("Crecimiento de 7, 30 y 90 días, además del historial disponible del artista.", "7-, 30- and 90-day growth plus the artist's available history.") },
    { icon: MapPin, title: pick("Señales de México", "Mexico signals"), body: pick("Ciudades y datos de audiencia mexicana cuando la fuente los ofrece.", "Mexican audience and city information when available from the source.") },
    { icon: BellRing, title: pick("Panel diario", "Daily dashboard"), body: pick("Consulta el monitor cada día y conserva el historial acumulado.", "Open the monitor every day and keep its accumulated history.") },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070707] text-white">
      <PageSEO
        title={pick("Monitoreo de artistas — Mexico Charts", "Artist monitoring — Mexico Charts")}
        description={pick("Monitorea diariamente el streaming, el catálogo y la audiencia de un artista por $6 USD al mes.", "Monitor one artist's streaming, catalog and audience every day for $6 USD per month.")}
        path="/monitoreo"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: pick("Monitoreo diario de artistas", "Daily artist monitoring"),
          provider: { "@type": "Organization", name: "Mexico Charts", url: SITE_URL },
          offers: { "@type": "Offer", price: "6.00", priceCurrency: "USD" },
        }}
      />
      <SiteNav />

      <div className="flex items-center gap-1.5 border-b border-white/[0.05] px-6 py-3 lg:px-10">
        <Link href="/"><Home className="h-3 w-3 text-white/35" /></Link>
        <ChevronRight className="h-3 w-3 text-white/20" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">{pick("Monitoreo", "Monitoring")}</span>
      </div>

      <main>
        <section className="relative overflow-hidden border-b border-white/[0.06] px-6 py-20 text-center sm:py-24 lg:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(57,255,20,0.22),transparent_42%)]" />
          <div className="relative mx-auto max-w-4xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#39FF14]/25 bg-[#39FF14]/[0.07] px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#39FF14]">
              <BellRing className="h-3.5 w-3.5" /> {pick("Mexico Charts Monitor", "Mexico Charts Monitor")}
            </span>
            <h1 className="mx-auto mt-7 max-w-4xl text-balance font-sans text-[clamp(2.8rem,6.5vw,6rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
              {pick("Entiende el crecimiento de tu artista.", "Understand your artist's growth.")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-7 text-white/50 sm:text-xl sm:leading-8">
              {pick("Streaming diario, discografía, audiencia e historial permanente reunidos en un solo panel.", "Daily streaming, discography, audience and permanent history brought together in one dashboard.")}
            </p>
            <a href="#suscripcion" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#39FF14] px-7 text-[10px] font-black uppercase tracking-[0.16em] text-black">
              {pick("Elegir artista", "Choose an artist")} <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.14em] text-white/25">$6 USD / {pick("artista / mes", "artist / month")} · {pick("Cancela cuando quieras", "Cancel anytime")}</p>
          </div>
        </section>

        <section className="px-6 py-16 sm:py-20 lg:px-10">
          <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title }, index) => (
              <article key={title} className="text-center">
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-white/[0.07] bg-[radial-gradient(circle_at_50%_35%,rgba(57,255,20,0.15),rgba(255,255,255,0.025)_68%)] sm:h-36 sm:w-36">
                  <Icon className="h-12 w-12 text-[#39FF14]" strokeWidth={1.35} />
                </div>
                <h2 className="mt-5 text-sm font-black uppercase tracking-[0.08em]">{title}</h2>
                <p className="mt-2 text-xs font-medium leading-5 text-white/35">
                  {[pick("Las cifras importantes, juntas.", "The important figures, together."), pick("Mira qué cambió y cuándo.", "See what changed and when."), pick("Contexto de audiencia en México.", "Mexican audience context."), pick("Listo para guardar y compartir.", "Ready to save and share.")][index]}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="suscripcion" className="scroll-mt-24 bg-[#f2f1ed] px-4 py-16 text-[#111] sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#198d0b]">{pick("Un plan. Sin complicaciones.", "One plan. No complications.")}</p>
            <h2 className="mt-3 font-sans text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{pick("Empieza a monitorear", "Start monitoring")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-6 text-black/50">{pick("Elige un artista y consulta su panel diario; el historial crece con cada nueva captura.", "Choose an artist and open their daily dashboard; history grows with every new snapshot.")}</p>
          </div>

          <div className="mx-auto mt-10 grid max-w-6xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.16)] lg:grid-cols-[minmax(0,1fr)_430px]">
            <div className="relative overflow-hidden bg-[#090909] p-6 text-white sm:p-9 lg:p-10">
              <div className="pointer-events-none absolute right-[-15%] top-[-10%] h-72 w-72 rounded-full bg-[#39FF14]/10 blur-3xl" />
              <div className="relative flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.22em] text-[#39FF14]">Mexico Charts · Monitor</p>
                  <h3 className="mt-2 text-2xl font-black uppercase tracking-[-0.03em]">{previewArtist?.displayName ?? pick("Tu artista", "Your artist")}</h3>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.15em] text-white/35">{pick("Vista previa", "Preview")}</span>
              </div>

              <div className="relative mt-6 grid grid-cols-2 gap-3">
                {[
                  { label: pick("Oyentes mensuales", "Monthly listeners"), value: previewArtist?.spotifyListenersFmt || "—", icon: BarChart3 },
                  { label: pick("Suscriptores YouTube", "YouTube subscribers"), value: previewArtist?.youtubeSubscribersFmt || "—", icon: BellRing },
                  { label: pick("Crecimiento", "Growth"), value: "7D · 30D · 90D", icon: TrendingUp },
                  { label: pick("Audiencia México", "Mexico audience"), value: pick("Ciudades + señales", "Cities + signals"), icon: MapPin },
                ].map(({ label, value, icon: MetricIcon }) => (
                  <div key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-4">
                    <MetricIcon className="h-4 w-4 text-[#39FF14]" />
                    <p className="mt-5 text-[8px] font-black uppercase tracking-[0.16em] text-white/30">{label}</p>
                    <p className="mt-1 text-base font-black text-white sm:text-lg">{value}</p>
                  </div>
                ))}
              </div>

              <div className="relative mt-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35">{pick("Tendencia de audiencia", "Audience trend")}</p>
                  <TrendingUp className="h-4 w-4 text-[#39FF14]" />
                </div>
                <div className="mt-5 flex h-20 items-end gap-2">
                  {[28, 37, 31, 48, 43, 58, 54, 70, 66, 82, 75, 92].map((height, index) => (
                    <span key={index} className="flex-1 rounded-t-sm bg-[#39FF14]" style={{ height: `${height}%`, opacity: 0.22 + index * 0.055 }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-9 lg:p-10">
              <span className="inline-block rounded-full bg-[#39FF14] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.16em]">{pick("Precio de lanzamiento", "Launch price")}</span>
              <h3 className="mt-5 text-2xl font-black uppercase tracking-[-0.025em]">{pick("Monitor completo", "Complete monitor")}</h3>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-black tracking-[-0.06em]">$6</span>
                <span className="pb-1 text-[9px] font-black uppercase tracking-[0.14em] text-black/40">USD / {pick("mes", "month")}</span>
              </div>

              <ul className="mt-6 space-y-3">
                {[pick("Panel actualizado diariamente", "Dashboard updated daily"), pick("Streams diarios por canción y álbum", "Daily streams by song and album"), pick("Historial por día, mes y año", "Daily, monthly and yearly history"), pick("Cambios de audiencia por periodo", "Audience changes by period"), pick("Resumen mensual descargable", "Downloadable monthly summary")].map(item => (
                  <li key={item} className="flex items-center gap-3 text-xs font-bold text-black/65"><Check className="h-4 w-4 text-[#198d0b]" /> {item}</li>
                ))}
              </ul>

              <label className="mt-7 block text-[8px] font-black uppercase tracking-[0.18em] text-black/40" htmlFor="monitor-artist-search">{pick("Elige un artista", "Choose an artist")}</label>
              <div className="relative mt-2">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
                <input id="monitor-artist-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={pick("Buscar por nombre…", "Search by name…")} className="h-12 w-full rounded-md border border-black/15 bg-[#f7f7f5] pl-10 pr-4 text-sm font-bold outline-none placeholder:text-black/25 focus:border-[#198d0b]" />
              </div>

              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto" aria-live="polite">
                {artistsLoading || availabilityLoading ? (
                  <div className="px-3 py-3 text-xs font-bold text-black/35">{pick("Cargando artistas…", "Loading artists…")}</div>
                ) : query.trim() && matches.length ? matches.map(artist => {
                  const active = artist.artistKey === selectedArtist?.artistKey;
                  return (
                    <button type="button" key={artist.artistKey} onClick={() => { setSelectedKey(artist.artistKey); setQuery(artist.displayName); }} className="flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left" style={{ borderColor: active ? "rgba(25,141,11,0.35)" : "rgba(0,0,0,0.08)", background: active ? "rgba(57,255,20,0.12)" : "rgba(0,0,0,0.018)" }}>
                      <span className="min-w-0 truncate text-sm font-bold text-black/70">{artist.displayName}</span>
                      {active ? <Check className="h-4 w-4 shrink-0 text-[#198d0b]" /> : <ArrowRight className="h-3.5 w-3.5 shrink-0 text-black/20" />}
                    </button>
                  );
                }) : query.trim() ? (
                  <div className="px-3 py-3 text-xs font-bold text-black/35">{pick("Este artista no está disponible para monitoreo completo.", "This artist is not available for complete monitoring.")}</div>
                ) : null}
              </div>

              {selectedArtist && <div className="mt-2 rounded-md bg-[#eafbe7] px-3 py-2.5 text-sm font-black text-[#156c0c]">✓ {selectedArtist.displayName}</div>}

              <button type="button" disabled={!selectedArtist || checkoutLoading} onClick={startCheckout} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#111] px-5 text-[10px] font-black uppercase tracking-[0.15em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-25">
                {checkoutLoading ? pick("Abriendo pago seguro…", "Opening secure checkout…") : config?.checkoutEnabled ? pick("Suscribirme", "Subscribe") : pick("Solicitar monitoreo", "Request monitoring")}
                {!checkoutLoading && (config?.checkoutEnabled ? <ShieldCheck className="h-4 w-4 text-[#39FF14]" /> : <Mail className="h-4 w-4 text-[#39FF14]" />)}
              </button>
              {checkoutError && <p className="mt-3 text-xs font-bold leading-5 text-red-600">{checkoutError}</p>}
              <p className="mt-3 text-center text-[8px] font-bold leading-4 text-black/35">{pick("Renovación mensual. Cancela cuando quieras.", "Monthly renewal. Cancel anytime.")} <Link href="/terminos" className="underline">{pick("Términos", "Terms")}</Link> · <Link href="/privacidad" className="underline">{pick("Privacidad", "Privacy")}</Link></p>
            </div>
          </div>
        </section>

        <section className="px-6 py-14 text-center lg:px-10">
          <p className="mx-auto max-w-3xl text-xs font-medium leading-6 text-white/35">{pick("La cobertura varía según el artista y la disponibilidad de cada plataforma. Una métrica ausente nunca se presenta como cero. El servicio no implica afiliación, autorización ni respaldo del artista.", "Coverage varies by artist and platform availability. A missing metric is never represented as zero. The service does not imply artist affiliation, authorization or endorsement.")}</p>
        </section>
      </main>
      <EditorialFooter />
    </div>
  );
}
