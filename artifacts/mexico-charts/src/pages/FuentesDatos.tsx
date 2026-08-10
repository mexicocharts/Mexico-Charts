import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  Database,
  Globe2,
  History,
  Home,
  MapPin,
  Music2,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { EditorialFooter } from "@/components/EditorialLayout";
import { useLanguage } from "@/i18n/LanguageContext";
import { useArtistMetadata } from "@/services/dataProvider";

const G = "#39FF14";

type PlatformCard = {
  name: string;
  eyebrow: string;
  metricsEs: string[];
  metricsEn: string[];
  accent: string;
};

const PLATFORMS: PlatformCard[] = [
  {
    name: "Spotify",
    eyebrow: "Streaming",
    metricsEs: ["Oyentes mensuales", "Seguidores", "Popularidad", "Streams e historial disponibles"],
    metricsEn: ["Monthly listeners", "Followers", "Popularity", "Available streams and history"],
    accent: "#1ed760",
  },
  {
    name: "YouTube",
    eyebrow: "Video",
    metricsEs: ["Suscriptores", "Vistas del canal", "Cambios por periodo", "Canal oficial vinculado"],
    metricsEn: ["Subscribers", "Channel views", "Changes by period", "Linked official channel"],
    accent: "#ff3b30",
  },
  {
    name: "Instagram",
    eyebrow: "Social",
    metricsEs: ["Seguidores", "Cambios de 7, 30 y 90 días", "Tendencia histórica disponible"],
    metricsEn: ["Followers", "7, 30 and 90-day changes", "Available historical trend"],
    accent: "#f05aa6",
  },
  {
    name: "TikTok",
    eyebrow: "Social",
    metricsEs: ["Seguidores", "Cambios de 7, 30 y 90 días", "Tendencia histórica disponible"],
    metricsEn: ["Followers", "7, 30 and 90-day changes", "Available historical trend"],
    accent: "#63f5e6",
  },
  {
    name: "Facebook",
    eyebrow: "Social",
    metricsEs: ["Seguidores", "Cambios por periodo cuando están disponibles"],
    metricsEn: ["Followers", "Changes by period when available"],
    accent: "#5b8def",
  },
  {
    name: "Deezer",
    eyebrow: "Streaming",
    metricsEs: ["Fans", "Cambios por periodo cuando están disponibles"],
    metricsEn: ["Fans", "Changes by period when available"],
    accent: "#a970ff",
  },
  {
    name: "SoundCloud",
    eyebrow: "Streaming",
    metricsEs: ["Seguidores", "Cambios por periodo cuando están disponibles"],
    metricsEn: ["Followers", "Changes by period when available"],
    accent: "#ff7a1a",
  },
];

function MetricCard({ platform, english }: { platform: PlatformCard; english: boolean }) {
  const metrics = english ? platform.metricsEn : platform.metricsEs;
  return (
    <article
      className="group relative min-h-[265px] overflow-hidden rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-7"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.085)" }}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${platform.accent}, transparent 72%)` }} />
      <div className="flex items-start justify-between gap-5">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: platform.accent }}>{platform.eyebrow}</p>
          <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">{platform.name}</h3>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-full text-lg font-black" style={{ color: platform.accent, background: `${platform.accent}14`, border: `1px solid ${platform.accent}35` }}>
          {platform.name.slice(0, 1)}
        </span>
      </div>
      <ul className="mt-8 space-y-3">
        {metrics.map(metric => (
          <li key={metric} className="flex items-start gap-3 text-sm leading-5" style={{ color: "rgba(255,255,255,0.55)" }}>
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: platform.accent }} />
            {metric}
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function FuentesDatos() {
  const { language, pick } = useLanguage();
  const { byKey, isLoading, isError } = useArtistMetadata();
  const catalogCount = byKey.size;

  const stats = [
    {
      value: isLoading ? "…" : isError || !catalogCount ? "500+" : catalogCount.toLocaleString(language === "en" ? "en-US" : "es-MX"),
      label: pick("artistas en el catálogo", "artists in the catalog"),
      icon: Users,
    },
    { value: "7", label: pick("plataformas de audiencia", "audience platforms"), icon: Globe2 },
    { value: pick("Diaria", "Daily"), label: pick("actualización cuando la fuente la ofrece", "refresh when provided by the source"), icon: Clock3 },
  ];

  const process = [
    {
      icon: ShieldCheck,
      number: "01",
      title: pick("Identidad verificada", "Verified identity"),
      body: pick("Cada métrica se vincula al registro canónico del artista y a sus perfiles oficiales validados.", "Every metric is linked to the artist's canonical record and validated official profiles."),
    },
    {
      icon: Database,
      number: "02",
      title: pick("Datos normalizados", "Normalized data"),
      body: pick("Unificamos nombres, fechas y unidades para presentar plataformas distintas con una lectura coherente.", "We standardize names, dates and units so different platforms can be read consistently."),
    },
    {
      icon: History,
      number: "03",
      title: pick("Historial conservado", "Saved history"),
      body: pick("Guardamos snapshots para calcular cambios, tendencias y comparaciones sin alterar los valores de origen.", "We save snapshots to calculate changes, trends and comparisons without changing source values."),
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <PageSEO
        title={pick("Fuentes de datos de artistas — Mexico Charts", "Artist data sources — Mexico Charts")}
        description={pick("Conoce las métricas de artistas, plataformas, frecuencia de actualización y metodología de Mexico Charts.", "Explore Mexico Charts artist metrics, platforms, refresh frequency and methodology.")}
        path="/fuentes-de-datos"
      />
      <SiteNav />

      <div className="flex items-center gap-1.5 border-b border-white/[0.05] px-6 py-3 lg:px-10">
        <Link href="/"><Home className="h-3 w-3 cursor-pointer text-white/30" /></Link>
        <ChevronRight className="h-3 w-3 text-white/15" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">{pick("Fuentes de datos", "Data sources")}</span>
      </div>

      <main>
        <section className="relative overflow-hidden border-b border-white/[0.06] px-6 pb-16 pt-12 sm:pt-16 lg:px-10 lg:pb-20">
          <div className="pointer-events-none absolute left-1/2 top-[-300px] h-[720px] w-[920px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]" style={{ background: "radial-gradient(circle, rgba(57,255,20,0.35), transparent 68%)" }} />
          <div className="relative mx-auto max-w-[1280px]">
            <div className="flex flex-wrap gap-2">
              {[
                [pick("Estadísticas de artistas", "Artist statistics"), "#estadisticas"],
                [pick("Cómo se procesan", "How data is processed"), "#proceso"],
                [pick("Cobertura", "Coverage"), "#cobertura"],
                [pick("Metodología", "Methodology"), "/metodologia"],
              ].map(([label, href], index) => (
                <a key={label} href={href} className="rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] transition-colors" style={{ color: index === 0 ? "#050505" : "rgba(255,255,255,0.48)", background: index === 0 ? G : "rgba(255,255,255,0.035)", border: index === 0 ? `1px solid ${G}` : "1px solid rgba(255,255,255,0.09)" }}>
                  {label}
                </a>
              ))}
            </div>

            <p className="mt-10 text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: G }}>Mexico Charts / Data</p>
            <h1 className="mt-5 max-w-[880px] text-balance font-black uppercase leading-[0.9] tracking-[-0.05em]" style={{ fontSize: "clamp(2.15rem, 5vw, 4.25rem)", overflowWrap: "anywhere" }}>
              {pick("Datos de artistas, con contexto", "Artist data, with context")}
            </h1>
            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,720px)_1fr] lg:items-end">
              <p className="max-w-2xl text-lg font-medium leading-8 text-white/52 sm:text-xl">
                {pick(
                  "Mexico Charts reúne señales de audiencia, streaming y crecimiento para seguir la evolución de artistas mexicanos y artistas vinculados a la música mexicana.",
                  "Mexico Charts brings together audience, streaming and growth signals to track Mexican artists and artists connected to Mexican music.",
                )}
              </p>
              <div className="flex lg:justify-end">
                <Link href="/artists">
                  <span className="inline-flex cursor-pointer items-center gap-3 rounded-full px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#050505]" style={{ background: G }}>
                    {pick("Explorar artistas", "Explore artists")} <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[0.06]">
          <div className="mx-auto grid max-w-[1280px] md:grid-cols-3">
            {stats.map(({ value, label, icon: Icon }, index) => (
              <div key={label} className="relative px-6 py-9 lg:px-10 lg:py-12" style={{ borderRight: index < 2 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                <Icon className="mb-5 h-5 w-5" style={{ color: G }} />
                <p className="text-4xl font-black uppercase tracking-[-0.05em] sm:text-5xl">{value}</p>
                <p className="mt-2 max-w-[250px] text-[10px] font-black uppercase leading-5 tracking-[0.16em] text-white/35">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="estadisticas" className="scroll-mt-24 px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid gap-7 lg:grid-cols-[1fr_520px] lg:items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>{pick("Estadísticas de artistas", "Artist statistics")}</p>
                <h2 className="mt-4 max-w-3xl text-balance font-black uppercase leading-[0.95] tracking-[-0.04em]" style={{ fontSize: "clamp(1.65rem, 4vw, 2.75rem)", overflowWrap: "anywhere" }}>
                  {pick("Una lectura unificada entre plataformas", "One view across platforms")}
                </h2>
              </div>
              <p className="text-sm leading-7 text-white/45 sm:text-base">
                {pick("La disponibilidad depende del artista, la plataforma y la fecha. Mostramos la fecha de actualización y omitimos una métrica cuando no existe una cifra verificable.", "Availability depends on the artist, platform and date. We show the update date and omit a metric when no verifiable figure exists.")}
              </p>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PLATFORMS.map(platform => <MetricCard key={platform.name} platform={platform} english={language === "en"} />)}
              <article className="relative min-h-[265px] overflow-hidden rounded-2xl p-6 sm:p-7" style={{ background: "linear-gradient(145deg, rgba(57,255,20,0.1), rgba(57,255,20,0.025))", border: "1px solid rgba(57,255,20,0.2)" }}>
                <MapPin className="h-8 w-8" style={{ color: G }} />
                <p className="mt-8 text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>{pick("Audiencia en México", "Audience in Mexico")}</p>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">{pick("Ciudades principales", "Top cities")}</h3>
                <p className="mt-5 text-sm leading-6 text-white/48">{pick("Oyentes actuales y picos por ciudad cuando la fuente ofrece cobertura geográfica para el artista.", "Current listeners and city peaks when geographic audience coverage is available for the artist.")}</p>
              </article>
            </div>
          </div>
        </section>

        <section id="proceso" className="scroll-mt-24 border-y border-white/[0.06] bg-white/[0.012] px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1280px]">
            <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>{pick("Del origen al perfil", "From source to profile")}</p>
            <h2 className="mt-4 max-w-4xl text-balance font-black uppercase leading-[0.95] tracking-[-0.04em]" style={{ fontSize: "clamp(1.65rem, 4vw, 2.75rem)", overflowWrap: "anywhere" }}>{pick("Cómo convertimos cifras aisladas en contexto", "How isolated figures become context")}</h2>
            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] lg:grid-cols-3">
              {process.map(({ icon: Icon, number, title, body }) => (
                <article key={number} className="bg-[#080808] p-7 sm:p-9">
                  <div className="flex items-center justify-between">
                    <Icon className="h-6 w-6" style={{ color: G }} />
                    <span className="text-3xl font-black text-white/[0.08]">{number}</span>
                  </div>
                  <h3 className="mt-12 text-sm font-black uppercase tracking-[0.16em]">{title}</h3>
                  <p className="mt-4 text-sm leading-6 text-white/42">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cobertura" className="scroll-mt-24 px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>{pick("Cobertura responsable", "Responsible coverage")}</p>
              <h2 className="mt-4 text-balance font-black uppercase leading-[0.95] tracking-[-0.04em]" style={{ fontSize: "clamp(1.65rem, 4vw, 2.75rem)", overflowWrap: "anywhere" }}>{pick("Sin rellenar vacíos con ceros", "No filling gaps with zeroes")}</h2>
              <p className="mt-7 max-w-xl text-base leading-8 text-white/48">{pick("No todos los artistas tienen las mismas fuentes conectadas ni el mismo historial. Mexico Charts distingue entre cero, dato no disponible y dato pendiente de actualización.", "Not every artist has the same connected sources or historical depth. Mexico Charts distinguishes between zero, unavailable data and data awaiting an update.")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: CalendarDays, title: pick("Fecha visible", "Visible date"), body: pick("La medición muestra su fecha de corte", "Each measurement shows its cutoff date") },
                { icon: TrendingUp, title: pick("Periodo claro", "Clear period"), body: pick("Los cambios indican su ventana de tiempo", "Changes state their time window") },
                { icon: BarChart3, title: pick("Plataforma indicada", "Named platform"), body: pick("Cada cifra conserva el contexto de su fuente", "Every figure retains its source context") },
                { icon: Music2, title: pick("Identidad canónica", "Canonical identity"), body: pick("Un artista, un perfil y mapeos validados", "One artist, one profile and validated mappings") },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-5">
                  <Icon className="h-5 w-5" style={{ color: G }} />
                  <h3 className="mt-6 text-[11px] font-black uppercase tracking-[0.14em]">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-white/38">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] px-6 py-16 lg:px-10">
          <div className="mx-auto flex max-w-[1280px] flex-col gap-8 rounded-3xl p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between" style={{ background: "linear-gradient(125deg, rgba(57,255,20,0.11), rgba(255,255,255,0.025) 65%)", border: "1px solid rgba(57,255,20,0.18)" }}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>{pick("Más transparencia", "More transparency")}</p>
              <h2 className="mt-4 max-w-2xl font-black uppercase leading-[0.98] tracking-[-0.035em]" style={{ fontSize: "clamp(1.5rem, 3.4vw, 2.25rem)", overflowWrap: "anywhere" }}>{pick("Consulta la metodología completa", "Read the full methodology")}</h2>
            </div>
            <Link href="/metodologia">
              <span className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-white/15 px-6 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:border-[#39FF14]/50 hover:text-[#39FF14]">
                {pick("Ver metodología", "View methodology")} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>
      </main>

      <EditorialFooter />
    </div>
  );
}
