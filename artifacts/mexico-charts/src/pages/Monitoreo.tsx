import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Disc3,
  FileDown,
  Home,
  LibraryBig,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { EditorialFooter } from "@/components/EditorialLayout";
import { useArtistMetadata } from "@/services/dataProvider";
import { CONTACT_EMAIL, SITE_URL } from "@/config/brand";
import { useLanguage } from "@/i18n/LanguageContext";
import { authenticatedFetch, useMexicoAuth } from "@/auth/AuthProvider";

const G = "#39FF14";

type MonitoringConfig = {
  checkoutEnabled: boolean;
  accountsEnabled: boolean;
  priceUsdCents: number;
  delivery: "daily_dashboard_monthly_report";
};

type MonitoringArtistAvailability = {
  policyVersion: number;
  count: number;
  artists: Array<{ artistKey: string; artistName: string; matchKeys: string[] }>;
};

type MonitoringPlanId = "individual" | "seleccion" | "profesional" | "catalogo";

function compactArtistKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function Monitoreo() {
  const { language, pick } = useLanguage();
  const auth = useMexicoAuth();
  const search = useSearch();
  const requestedArtist = new URLSearchParams(search).get("artist")?.trim().toLowerCase() ?? "";
  const { byKey, isLoading: artistsLoading } = useArtistMetadata();
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState(requestedArtist);
  const [selectedPlanId, setSelectedPlanId] = useState<MonitoringPlanId>("individual");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const { data: config } = useQuery<MonitoringConfig>({
    queryKey: ["monitoringConfig"],
    queryFn: async () => {
      const response = await fetch("/api/monitoring/config");
      if (!response.ok) throw new Error("Monitoring configuration unavailable");
      const previewConfig = await response.json() as MonitoringConfig;
      // This restored page is an internal development preview. Checkout stays
      // disabled here regardless of the server configuration.
      return { ...previewConfig, checkoutEnabled: false };
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
    ?? [...byKey.values()].find(artist => artist.displayName.toLocaleLowerCase() === "luis miguel")
    ?? artists.find(artist => artist.displayName.toLocaleLowerCase() === "peso pluma")
    ?? null;
  const readyArtistCount = artists.length;

  const plans = [
    {
      id: "individual" as const,
      name: pick("Individual", "Individual"),
      price: 6,
      artists: pick("1 artista", "1 artist"),
      description: pick("Todo el seguimiento de un artista", "Complete monitoring for one artist"),
      badge: "",
    },
    {
      id: "seleccion" as const,
      name: pick("Selección", "Selection"),
      price: 15,
      artists: pick("Hasta 3 artistas", "Up to 3 artists"),
      description: pick("Sigue y compara a tus favoritos", "Follow and compare your favorites"),
      badge: pick("Más popular", "Most popular"),
    },
    {
      id: "profesional" as const,
      name: pick("Profesional", "Professional"),
      price: 39,
      artists: pick("Hasta 10 artistas", "Up to 10 artists"),
      description: pick("Para equipos, medios y proyectos", "For teams, media and projects"),
      badge: "",
    },
    {
      id: "catalogo" as const,
      name: pick("Catálogo completo", "Complete catalog"),
      price: 99,
      artists: pick("Todos los artistas elegibles", "Every eligible artist"),
      description: pick("Acceso general, comparaciones y reportes", "Full access, comparisons and reports"),
      badge: pick("En revisión", "Under review"),
    },
  ];
  const selectedPlan = plans.find(plan => plan.id === selectedPlanId) ?? plans[0];
  const planBenefits: Record<MonitoringPlanId, string[]> = {
    individual: [
      pick("Panel diario para 1 artista", "Daily dashboard for 1 artist"),
      pick("Streams diarios por canción y álbum", "Daily streams by song and album"),
      pick("Historial por día, mes y año", "Daily, monthly and yearly history"),
      pick("Cambios de audiencia por periodo", "Audience changes by period"),
      pick("Reporte mensual descargable", "Downloadable monthly report"),
    ],
    seleccion: [
      pick("Paneles diarios para hasta 3 artistas", "Daily dashboards for up to 3 artists"),
      pick("Comparación directa entre artistas", "Side-by-side artist comparisons"),
      pick("Streams e historial de cada discografía", "Streaming and catalog history for every artist"),
      pick("Alertas individuales por artista", "Individual alerts for every artist"),
      pick("Reporte mensual consolidado", "Consolidated monthly report"),
    ],
    profesional: [
      pick("Paneles diarios para hasta 10 artistas", "Daily dashboards for up to 10 artists"),
      pick("Comparaciones de rendimiento en grupo", "Group performance comparisons"),
      pick("Reportes individuales y consolidados", "Individual and consolidated reports"),
      pick("Exportaciones para análisis y presentaciones", "Exports for analysis and presentations"),
      pick("Activación y soporte prioritarios", "Priority setup and support"),
    ],
    catalogo: [
      pick("Acceso a todos los artistas elegibles", "Access to every eligible artist"),
      pick("Comparaciones en todo el catálogo", "Catalog-wide comparisons"),
      pick("Historial, discografías y alertas", "History, catalogs and alerts"),
      pick("Reportes generales y por artista", "Catalog-wide and artist reports"),
      pick("Acceso sujeto a confirmación comercial", "Access subject to commercial confirmation"),
    ],
  };

  async function startCheckout() {
    if (selectedPlan.id !== "catalogo" && !selectedArtist) return;
    if (selectedPlan.id === "individual" && config?.checkoutEnabled && auth.configured && !auth.isSignedIn) {
      auth.openSignUp();
      return;
    }
    setCheckoutError("");
    if (!config?.checkoutEnabled || selectedPlan.id !== "individual") {
      const artistDetail = selectedArtist?.displayName ?? pick("catálogo completo", "complete catalog");
      const subject = encodeURIComponent(`${selectedPlan.name} — Mexico Charts Monitor`);
      const body = encodeURIComponent(
        pick(
          `Hola, quiero solicitar el plan ${selectedPlan.name} de Mexico Charts Monitor por $${selectedPlan.price} USD al mes. Quiero comenzar con ${artistDetail}.`,
          `Hello, I would like to request the Mexico Charts Monitor ${selectedPlan.name} plan for $${selectedPlan.price} USD per month. I would like to start with ${artistDetail}.`,
        ),
      );
      window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
      return;
    }
    setCheckoutLoading(true);
    try {
      const response = await authenticatedFetch(auth.getToken, "/api/monitoring/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artistKey: selectedArtist!.artistKey,
          artistName: selectedArtist!.displayName,
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
    { icon: BarChart3, title: pick("Métricas actuales", "Current metrics"), body: pick("Audiencia de Spotify, YouTube y plataformas sociales en un solo resumen", "Available Spotify, YouTube and social-platform audiences in one summary") },
    { icon: TrendingUp, title: pick("Evolución por periodo", "Period changes"), body: pick("Crecimiento de 7, 30 y 90 días, además del historial disponible del artista", "7-, 30- and 90-day growth plus the artist's available history") },
    { icon: MapPin, title: pick("Audiencia en México", "Mexico audience"), body: pick("Ciudades y datos de audiencia mexicana cuando la fuente los ofrece", "Mexican audience and city information when available from the source") },
    { icon: BellRing, title: pick("Panel diario", "Daily dashboard"), body: pick("Revisa el monitor cada día y conserva el historial acumulado", "Open the monitor every day and keep its accumulated history") },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070707] text-white">
      <PageSEO
        title={pick("Monitoreo de artistas — Mexico Charts", "Artist monitoring — Mexico Charts")}
        description={pick("Monitorea diariamente uno o varios artistas con streams, discografía, audiencia e historial permanente.", "Monitor one or more artists every day with streaming, catalog, audience and permanent history.")}
        path="/internal/monitoring"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: pick("Monitoreo diario de artistas", "Daily artist monitoring"),
          provider: { "@type": "Organization", name: "Mexico Charts", url: SITE_URL },
          offers: { "@type": "AggregateOffer", lowPrice: "6.00", highPrice: "39.00", priceCurrency: "USD", offerCount: "3" },
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
              {pick("Sigue el crecimiento de tu artista", "Understand your artist's growth")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-7 text-white/50 sm:text-xl sm:leading-8">
              {pick("Streams diarios, discografía, audiencia e historial permanente reunidos en un solo panel", "Daily streaming, discography, audience and permanent history brought together in one dashboard")}
            </p>
            <a href="#suscripcion" className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#39FF14] px-7 text-[10px] font-black uppercase tracking-[0.16em] text-black">
              {pick("Elegir artista", "Choose an artist")} <ArrowRight className="h-4 w-4" />
            </a>
            <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.14em] text-white/25">{pick("Desde", "From")} $6 USD / {pick("mes", "month")} · {pick("Cancela cuando quieras", "Cancel anytime")}</p>
            <div className="mx-auto mt-8 flex w-fit flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-full border border-white/[0.07] bg-black/25 px-5 py-3 text-[8px] font-black uppercase tracking-[0.15em] text-white/35 backdrop-blur-sm">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#39FF14] shadow-[0_0_10px_#39FF14]" />{availabilityLoading ? pick("Verificando catálogo", "Checking catalog") : `${readyArtistCount.toLocaleString(language === "es" ? "es-MX" : "en-US")} ${pick("artistas disponibles", "artists available")}`}</span>
              <span className="hidden h-3 w-px bg-white/10 sm:block" />
              <span>{pick("Solo artistas con cobertura completa", "Complete coverage only")}</span>
            </div>
          </div>
        </section>

        <section className="px-6 py-16 sm:py-20 lg:px-10">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#39FF14]">{pick("Todo en un lugar", "Everything in one place")}</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{pick("Cada día suma a su historia", "Data that becomes history")}</h2>
          </div>
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title }, index) => (
              <article key={title} className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 text-left transition-colors hover:border-[#39FF14]/20 hover:bg-white/[0.04] sm:p-7">
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#39FF14]/0 blur-3xl transition-colors group-hover:bg-[#39FF14]/10" />
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#39FF14]/20 bg-[#39FF14]/[0.07]">
                    <Icon className="h-5 w-5 text-[#39FF14]" strokeWidth={1.6} />
                  </div>
                  <span className="text-[9px] font-black tracking-[0.2em] text-white/15">0{index + 1}</span>
                </div>
                <h2 className="mt-8 text-sm font-black uppercase tracking-[0.08em]">{title}</h2>
                <p className="mt-3 text-xs font-medium leading-5 text-white/35">
                  {[pick("Las métricas clave en un solo lugar", "The important figures, together"), pick("Descubre qué cambió y cuándo", "See what changed and when"), pick("Conoce dónde está su audiencia mexicana", "Mexican audience context"), pick("Revisa, guarda y comparte", "Ready to save and share")][index]}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.06] px-6 py-16 sm:py-20 lg:px-10 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-[#39FF14]"><Sparkles className="h-3.5 w-3.5" /> {pick("Más que una cifra", "More than a number")}</span>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl">{pick("El perfil muestra el presente; el Monitor conserva el historial", "The profile shows today; Monitor keeps the history")}</h2>
              <p className="mt-5 max-w-xl text-sm font-medium leading-7 text-white/40 sm:text-base">{pick("No pagas por volver a ver una cifra pública. Pagas por seguir su evolución, explorar su discografía completa y volver a cualquier fecha guardada.", "You are not paying to see a public number again. You are paying to follow its movement, explore the full discography and return to every saved day.")}</p>
            </div>

            <div className="grid overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0a0a] sm:grid-cols-2">
              <div className="border-b border-white/[0.07] p-6 sm:border-b-0 sm:border-r sm:p-8">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">{pick("Perfil gratuito", "Free profile")}</p>
                <h3 className="mt-3 text-xl font-black">{pick("La foto de hoy", "Today's snapshot")}</h3>
                <ul className="mt-7 space-y-4 text-xs font-bold text-white/40">
                  {[pick("Métricas públicas actuales", "Current public metrics"), pick("Resumen general del artista", "General artist overview"), pick("Datos públicos disponibles", "Available visible context")].map(item => <li key={item} className="flex gap-3"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/25" />{item}</li>)}
                </ul>
              </div>
              <div className="relative overflow-hidden bg-[linear-gradient(145deg,rgba(57,255,20,0.10),rgba(57,255,20,0.015)_62%)] p-6 sm:p-8">
                <div className="absolute right-5 top-5 rounded-full border border-[#39FF14]/25 bg-[#39FF14]/10 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.16em] text-[#39FF14]">Monitor</div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#39FF14]">{pick("Suscripción", "Subscription")}</p>
                <h3 className="mt-3 text-xl font-black">{pick("La historia completa", "The complete history")}</h3>
                <ul className="mt-7 space-y-4 text-xs font-bold text-white/65">
                  {[pick("Streams diarios por canción y álbum", "Daily streams by song and album"), pick("Historial permanente por fecha", "Permanent history by date"), pick("Cambios, tendencias y comparaciones", "Changes, trends and comparisons"), pick("Alertas y reportes descargables", "Alerts and downloadable summary")].map(item => <li key={item} className="flex gap-3"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#39FF14]" />{item}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="suscripcion" className="scroll-mt-24 bg-[#f2f1ed] px-4 py-16 text-[#111] sm:px-6 sm:py-20 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-7xl text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#198d0b]">{pick("Elige cómo quieres monitorear", "Choose how you want to monitor")}</p>
            <h2 className="mt-3 font-sans text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{pick("Planes para cada nivel", "Plans for every level")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-6 text-black/50">{pick("Desde un solo artista hasta todo el catálogo elegible, con historial que crece cada día", "From one artist to the complete eligible catalog, with history that grows every day")}</p>
          </div>

          <div className="mx-auto mt-10 grid max-w-6xl gap-3 md:grid-cols-2 xl:grid-cols-4">
            {plans.map(plan => {
              const active = plan.id === selectedPlan.id;
              return (
                <button type="button" key={plan.id} onClick={() => setSelectedPlanId(plan.id)} className={`relative overflow-hidden rounded-2xl border p-5 text-left transition-all sm:p-6 ${active ? "border-[#111] bg-[#111] text-white shadow-[0_18px_45px_rgba(0,0,0,0.18)]" : "border-black/[0.08] bg-white text-[#111] hover:border-black/20"}`}>
                  {plan.badge && <span className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.13em] ${plan.id === "catalogo" ? "bg-amber-100 text-amber-800" : "bg-[#39FF14] text-black"}`}>{plan.badge}</span>}
                  <p className={`text-[8px] font-black uppercase tracking-[0.18em] ${active ? "text-[#39FF14]" : "text-black/35"}`}>{plan.name}</p>
                  <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-[-0.06em]">${plan.price}</span><span className={`pb-1 text-[8px] font-black uppercase tracking-[0.12em] ${active ? "text-white/35" : "text-black/35"}`}>USD / {pick("mes", "month")}</span></div>
                  <p className="mt-4 text-xs font-black">{plan.artists}</p>
                  <p className={`mt-2 text-[10px] font-semibold leading-4 ${active ? "text-white/40" : "text-black/40"}`}>{plan.description}</p>
                  <span className={`mt-5 flex h-8 w-8 items-center justify-center rounded-full ${active ? "bg-[#39FF14] text-black" : "bg-black/[0.045] text-black/30"}`}>{active ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</span>
                </button>
              );
            })}
          </div>

          <div className="mx-auto mt-6 max-w-6xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
            <div className="relative overflow-hidden bg-[#060706] p-3 text-white sm:p-5 lg:p-7">
              <div className="pointer-events-none absolute right-[-8%] top-[-24%] h-96 w-96 rounded-full bg-[#39FF14]/10 blur-[110px]" />

              <div className="relative overflow-hidden rounded-xl border border-white/[0.09] bg-[#080908] shadow-2xl shadow-black/70">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5 sm:px-6">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-[#39FF14] shadow-[0_0_10px_#39FF14]" />
                    <p className="text-[8px] font-black uppercase tracking-[0.18em]">Mexico Charts <span className="text-[#39FF14]">Monitor</span></p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1.5 text-[7px] font-black uppercase tracking-[0.15em] text-white/35">{pick("Vista previa", "Preview")}</span>
                </div>

                <div className="flex gap-6 overflow-hidden border-b border-white/[0.07] px-4 sm:px-6">
                  {[pick("Resumen", "Overview"), pick("Historial", "History"), pick("Discografía", "Catalog"), pick("Audiencia", "Audience"), pick("Alertas", "Alerts")].map((tab, index) => (
                    <span key={tab} className={`relative shrink-0 py-3 text-[7px] font-black uppercase tracking-[0.14em] ${index === 0 ? "text-black" : "text-white/25"}`}>
                      {index === 0 && <span className="absolute -inset-x-3 inset-y-0 bg-[#39FF14]" />}
                      <span className="relative">{tab}</span>
                    </span>
                  ))}
                </div>

                <div className="p-4 sm:p-6">
                  <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[linear-gradient(135deg,#101210,#0a0b0a)] p-5 sm:p-7">
                    <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-[#39FF14]/[0.055] blur-3xl" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                        <img src="https://i.scdn.co/image/ab676161000051746481401e529e475116702a29" alt="Luis Miguel" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#39FF14]/10 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.14em] text-[#39FF14]">{pick("Monitoreo activo", "Active monitoring")}</span>
                            <span className="text-[7px] font-bold text-white/25">{pick("Actualizado hoy", "Updated today")}</span>
                          </div>
                          <h3 className="mt-3 break-words text-3xl font-black tracking-[-0.05em] sm:text-4xl lg:text-5xl">{previewArtist?.displayName ?? "Luis Miguel"}</h3>
                          <p className="mt-2 text-[10px] font-medium text-white/35 sm:text-xs">{pick("Audiencia, streaming y rendimiento del catálogo en un solo lugar", "Audience, streaming and catalog performance in one place")}</p>
                        </div>
                      </div>
                      <button type="button" className="hidden h-9 shrink-0 items-center gap-2 rounded-full bg-[#39FF14] px-4 text-[8px] font-black uppercase tracking-[0.13em] text-black lg:inline-flex"><FileDown className="h-3.5 w-3.5" /> {pick("Reporte", "Report")}</button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                      { icon: BarChart3, label: pick("Oyentes mensuales", "Monthly listeners"), value: previewArtist?.spotifyListenersFmt || pick("Datos disponibles", "Data available") },
                      { icon: BellRing, label: pick("Suscriptores YouTube", "YouTube subscribers"), value: previewArtist?.youtubeSubscribersFmt || pick("Datos disponibles", "Data available") },
                      { icon: Disc3, label: pick("Discografía", "Catalog"), value: pick("Streams diarios", "Daily streams") },
                      { icon: CalendarDays, label: pick("Historial", "History"), value: pick("Día, mes y año", "Day, month and year") },
                    ].map(({ icon: PreviewIcon, label, value }) => (
                      <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
                        <PreviewIcon className="h-4 w-4 text-[#39FF14]" />
                        <p className="mt-5 text-[7px] font-black uppercase tracking-[0.15em] text-white/25">{label}</p>
                        <p className="mt-1 text-sm font-black sm:text-lg">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-10 bg-gradient-to-b from-transparent to-black/50" />
              </div>
            </div>

            <div className="mx-auto max-w-2xl p-6 sm:p-9 lg:p-12">
              <span className={`inline-block rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.16em] ${selectedPlan.id === "catalogo" ? "bg-amber-100 text-amber-800" : "bg-[#39FF14]"}`}>
                {selectedPlan.id === "catalogo" ? pick("Acceso en revisión", "Access under review") : pick("Plan seleccionado", "Selected plan")}
              </span>
              <h3 className="mt-5 text-2xl font-black uppercase tracking-[-0.025em]">{selectedPlan.name}</h3>
              <p className="mt-2 text-xs font-bold text-black/40">{selectedPlan.artists} · {selectedPlan.description}</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-5xl font-black tracking-[-0.06em]">${selectedPlan.price}</span>
                <span className="pb-1 text-[9px] font-black uppercase tracking-[0.14em] text-black/40">USD / {pick("mes", "month")}</span>
              </div>

              <ul className="mt-6 space-y-3">
                {planBenefits[selectedPlan.id].map(item => (
                  <li key={item} className="flex items-center gap-3 text-xs font-bold text-black/65"><Check className="h-4 w-4 text-[#198d0b]" /> {item}</li>
                ))}
              </ul>

              <div className="mt-6 flex items-center gap-3 rounded-lg border border-black/[0.07] bg-[#f7f7f4] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111] text-[#39FF14]"><FileDown className="h-4 w-4" /></div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em]">{pick("Tu historial no desaparece", "Your history does not disappear")}</p>
                  <p className="mt-1 text-[9px] font-semibold leading-4 text-black/40">{pick("Cada actualización amplía tu historial privado", "Every snapshot expands your private archive")}</p>
                </div>
              </div>

              {selectedPlan.id === "catalogo" ? (
                <div className="mt-7 rounded-xl border border-amber-300/60 bg-amber-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-900">{pick("Solicitud de acceso", "Access request")}</p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-amber-900/65">{pick("Este plan incluiría todos los artistas que cumplen con la cobertura necesaria. Su activación depende de la confirmación de las condiciones comerciales.", "This plan would include every artist with complete coverage. Activation depends on confirmation of the commercial terms.")}</p>
                </div>
              ) : (
                <>
                  <label className="mt-7 block text-[8px] font-black uppercase tracking-[0.18em] text-black/40" htmlFor="monitor-artist-search">
                    {selectedPlan.id === "individual" ? pick("Elige un artista", "Choose an artist") : pick("Elige el primer artista", "Choose the first artist")}
                  </label>
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
                      <div className="px-3 py-3 text-xs font-bold text-black/35">{pick("Este artista aún no cuenta con la cobertura necesaria para el Monitor.", "This artist is not available for complete monitoring.")}</div>
                    ) : null}
                  </div>

                  {selectedArtist && <div className="mt-2 rounded-md bg-[#eafbe7] px-3 py-2.5 text-sm font-black text-[#156c0c]">✓ {selectedArtist.displayName}</div>}
                  {selectedPlan.id !== "individual" && <p className="mt-2 text-[9px] font-semibold text-black/35">{pick("Podrás completar la selección de artistas durante la activación.", "You can complete your artist selection during setup.")}</p>}
                </>
              )}

              <button type="button" disabled={(selectedPlan.id !== "catalogo" && !selectedArtist) || checkoutLoading} onClick={startCheckout} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#111] px-5 text-[10px] font-black uppercase tracking-[0.15em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-25">
                {checkoutLoading
                  ? pick("Abriendo pago seguro…", "Opening secure checkout…")
                  : selectedPlan.id === "catalogo"
                    ? pick("Solicitar acceso", "Request access")
                    : config?.checkoutEnabled && selectedPlan.id === "individual"
                      ? pick("Suscribirme", "Subscribe")
                      : pick("Solicitar plan", "Request plan")}
                {!checkoutLoading && (config?.checkoutEnabled && selectedPlan.id === "individual" ? <ShieldCheck className="h-4 w-4 text-[#39FF14]" /> : <Mail className="h-4 w-4 text-[#39FF14]" />)}
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
