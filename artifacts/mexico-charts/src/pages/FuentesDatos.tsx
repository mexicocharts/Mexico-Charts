import { Link } from "wouter";
import {
  AudioLines,
  ArrowRight,
  Award,
  BarChart3,
  Camera,
  CalendarDays,
  ChevronRight,
  Clock3,
  Cloud,
  Database,
  Disc3,
  Gauge,
  Globe2,
  History,
  Home,
  Layers3,
  ListMusic,
  MapPin,
  Music2,
  Play,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
  type LucideIcon,
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
  icon: LucideIcon;
};

const PLATFORMS: PlatformCard[] = [
  {
    name: "Spotify",
    eyebrow: "Streaming",
    metricsEs: ["Oyentes mensuales", "Seguidores", "Índice de popularidad", "Reproducciones e historial"],
    metricsEn: ["Monthly listeners", "Followers", "Popularity score", "Streams and history"],
    accent: "#1ed760",
    icon: AudioLines,
  },
  {
    name: "YouTube",
    eyebrow: "Video",
    metricsEs: ["Suscriptores", "Vistas acumuladas", "Evolución por periodo", "Canal oficial asociado"],
    metricsEn: ["Subscribers", "Lifetime views", "Change over time", "Associated official channel"],
    accent: "#ff3b30",
    icon: Play,
  },
  {
    name: "Instagram",
    eyebrow: "Social",
    metricsEs: ["Seguidores", "Crecimiento a 7, 30 y 90 días", "Evolución histórica"],
    metricsEn: ["Followers", "7, 30 and 90-day growth", "Historical trend"],
    accent: "#f05aa6",
    icon: Camera,
  },
  {
    name: "TikTok",
    eyebrow: "Social",
    metricsEs: ["Seguidores", "Crecimiento a 7, 30 y 90 días", "Evolución histórica"],
    metricsEn: ["Followers", "7, 30 and 90-day growth", "Historical trend"],
    accent: "#63f5e6",
    icon: Music2,
  },
  {
    name: "Facebook",
    eyebrow: "Social",
    metricsEs: ["Seguidores", "Evolución disponible"],
    metricsEn: ["Followers", "Available trend"],
    accent: "#5b8def",
    icon: Users,
  },
  {
    name: "Deezer",
    eyebrow: "Streaming",
    metricsEs: ["Fans", "Evolución disponible"],
    metricsEn: ["Fans", "Available trend"],
    accent: "#a970ff",
    icon: BarChart3,
  },
  {
    name: "SoundCloud",
    eyebrow: "Streaming",
    metricsEs: ["Seguidores", "Evolución disponible"],
    metricsEn: ["Followers", "Available trend"],
    accent: "#ff7a1a",
    icon: Cloud,
  },
];

function MetricCard({ platform, english }: { platform: PlatformCard; english: boolean }) {
  const metrics = english ? platform.metricsEn : platform.metricsEs;
  const Icon = platform.icon;
  return (
    <article
      className="group relative min-h-[250px] overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 sm:p-7"
      style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))", border: "1px solid rgba(255,255,255,0.085)" }}
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-[0.12] blur-3xl transition-opacity duration-300 group-hover:opacity-20" style={{ background: platform.accent }} />
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${platform.accent}, transparent 72%)` }} />
      <div>
        <div className="flex items-start justify-between gap-4">
          <p className="text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: platform.accent }}>{platform.eyebrow}</p>
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ color: platform.accent, background: `${platform.accent}12`, border: `1px solid ${platform.accent}32` }}>
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
        </div>
        <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white" style={{ overflowWrap: "anywhere" }}>{platform.name}</h3>
      </div>
      <ul className="mt-6 border-t border-white/[0.06]">
        {metrics.map(metric => (
          <li key={metric} className="flex items-start gap-3 border-b border-white/[0.045] py-2.5 text-[13px] leading-5" style={{ color: "rgba(255,255,255,0.56)" }}>
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: platform.accent, boxShadow: `0 0 8px ${platform.accent}` }} />
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
    { value: pick("Diaria", "Daily"), label: pick("frecuencia máxima de actualización", "maximum refresh frequency"), icon: Clock3 },
  ];

  const process = [
    {
      icon: ShieldCheck,
      number: "01",
      title: pick("Identidad confirmada", "Confirmed identity"),
      body: pick("Vinculamos cada cifra al perfil canónico del artista y a sus cuentas oficiales verificadas.", "We link every figure to the artist's canonical profile and verified official accounts."),
    },
    {
      icon: Database,
      number: "02",
      title: pick("Datos comparables", "Comparable data"),
      body: pick("Unificamos nombres, fechas y unidades para que las métricas de distintas plataformas puedan compararse con claridad.", "We standardize names, dates and units so metrics from different platforms can be compared clearly."),
    },
    {
      icon: History,
      number: "03",
      title: pick("Historial propio", "Saved history"),
      body: pick("Conservamos cortes periódicos para calcular crecimiento y tendencias sin modificar las cifras originales.", "We retain periodic snapshots to calculate growth and trends without changing the original figures."),
    },
  ];

  const insights = [
    {
      icon: TrendingUp,
      title: pick("Detectar crecimiento", "Spot growth"),
      body: pick("Compara el valor actual con periodos anteriores para identificar aceleración, estabilidad o retroceso.", "Compare the current value with previous periods to identify acceleration, stability or decline."),
    },
    {
      icon: Layers3,
      title: pick("Leer cada plataforma", "Read each platform"),
      body: pick("Distingue dónde crece una audiencia y evita mezclar señales que representan comportamientos diferentes.", "See where an audience is growing without mixing signals that represent different behaviors."),
    },
    {
      icon: Gauge,
      title: pick("Medir el impulso", "Measure momentum"),
      body: pick("Observa cambios recientes junto con el historial para separar un pico momentáneo de una tendencia sostenida.", "View recent changes alongside history to separate a short-lived spike from a sustained trend."),
    },
    {
      icon: MapPin,
      title: pick("Entender a México", "Understand Mexico"),
      body: pick("Consulta la presencia del artista en ciudades mexicanas cuando la plataforma ofrece información geográfica.", "Explore an artist's presence in Mexican cities when geographic information is available."),
    },
  ];

  const dataProducts = [
    {
      icon: Users,
      eyebrow: pick("Perfiles", "Profiles"),
      title: pick("Estadísticas de artistas", "Artist statistics"),
      body: pick("Una vista unificada de audiencia, crecimiento e historial entre plataformas.", "A unified view of audience, growth and history across platforms."),
      items: [pick("Métricas actuales", "Current metrics"), pick("Cambios a 7, 30 y 90 días", "7, 30 and 90-day changes"), pick("Historial por plataforma", "History by platform"), pick("Audiencia en ciudades de México", "Audience in Mexican cities")],
      href: "/artists",
      action: pick("Explorar perfiles", "Explore profiles"),
      accent: "#39FF14",
    },
    {
      icon: Disc3,
      eyebrow: pick("Discografía", "Catalog"),
      title: pick("Streaming de canciones y álbumes", "Song and album streaming"),
      body: pick("Seguimiento del catálogo completo, desde el total histórico hasta el movimiento diario.", "Complete catalog tracking, from lifetime totals to daily movement."),
      items: [pick("Streams acumulados y diarios", "Lifetime and daily streams"), pick("Canciones y álbumes", "Songs and albums"), pick("Orden por rendimiento", "Performance sorting"), pick("Archivo histórico continuo", "Continuous historical archive")],
      href: null,
      action: pick("Archivo en desarrollo", "Archive in development"),
      accent: "#8D7CFF",
    },
    {
      icon: ListMusic,
      eyebrow: pick("Playlisting", "Playlisting"),
      title: pick("Presencia en playlists", "Playlist presence"),
      body: pick("Medición agregada de la presencia del catálogo en playlists y su alcance potencial.", "Aggregated measurement of catalog presence in playlists and its potential reach."),
      items: [pick("Playlists actuales e históricas", "Current and historical playlists"), pick("Alcance agregado", "Aggregated reach"), pick("Presencia editorial", "Editorial presence"), "Spotify · Apple Music · Amazon · Deezer · YouTube · Tidal"],
      href: null,
      action: pick("Integración en desarrollo", "Integration in progress"),
      accent: "#FFB347",
    },
    {
      icon: BarChart3,
      eyebrow: pick("Rankings", "Rankings"),
      title: pick("Listas por plataforma", "Platform charts"),
      body: pick("Listas de México organizadas por plataforma, formato y periodo de actualización.", "Mexico charts organized by platform, format and refresh period."),
      items: [pick("Spotify diario y semanal", "Daily and weekly Spotify"), pick("YouTube diario y semanal", "Daily and weekly YouTube"), pick("Apple Music diario", "Daily Apple Music"), pick("Deezer diario", "Daily Deezer")],
      href: "/charts",
      action: pick("Ver listas", "View charts"),
      accent: "#51C8FF",
    },
    {
      icon: Award,
      eyebrow: pick("Industria", "Industry"),
      title: pick("Certificaciones en México", "Certifications in Mexico"),
      body: pick("Un archivo consultable de certificaciones mexicanas para canciones, álbumes y artistas.", "A searchable archive of Mexican certifications for songs, albums and artists."),
      items: ["AMPROFON", pick("Oro, platino y diamante", "Gold, platinum and diamond"), pick("Álbumes y sencillos", "Albums and singles"), pick("Resumen por artista", "Artist summaries")],
      href: "/industry/certifications",
      action: pick("Ver certificaciones", "View certifications"),
      accent: "#F5C451",
    },
    {
      icon: Ticket,
      eyebrow: pick("En vivo", "Live"),
      title: pick("Giras y presentaciones", "Tours and performances"),
      body: pick("Contexto de actividad en vivo, fechas, recintos y mercados cuando existe cobertura verificable.", "Live activity context, dates, venues and markets when verifiable coverage exists."),
      items: [pick("Próximas fechas", "Upcoming dates"), pick("Recintos y ciudades", "Venues and cities"), pick("Historial disponible", "Available history"), pick("Contexto de mercado", "Market context")],
      href: "/touring",
      action: pick("Explorar giras", "Explore tours"),
      accent: "#FF6B8B",
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
                [pick("Productos de datos", "Data products"), "#productos"],
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

            <p className="mt-10 text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: G }}>{pick("Mexico Charts / Fuentes", "Mexico Charts / Sources")}</p>
            <h1 className="mt-5 max-w-[880px] text-balance font-black uppercase leading-[0.9] tracking-[-0.05em]" style={{ fontSize: "clamp(2.15rem, 5vw, 4.25rem)", overflowWrap: "anywhere" }}>
              {pick("Las métricas detrás de cada artista", "The metrics behind every artist")}
            </h1>
            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,720px)_1fr] lg:items-end">
              <p className="max-w-2xl text-lg font-medium leading-8 text-white/52 sm:text-xl">
                {pick(
                  "Reunimos métricas de audiencia, streaming y crecimiento para mostrar cómo evoluciona la presencia digital de cada artista.",
                  "We bring together audience, streaming and growth metrics to show how each artist's digital presence evolves.",
                )}
              </p>
              <div className="flex lg:justify-end">
                <Link href="/artists">
                  <span className="inline-flex cursor-pointer items-center gap-3 rounded-full px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#050505]" style={{ background: G }}>
                  {pick("Ver directorio", "View directory")} <ArrowRight className="h-4 w-4" />
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

        <section id="productos" className="scroll-mt-24 border-b border-white/[0.06] px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid gap-7 lg:grid-cols-[1fr_520px] lg:items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>{pick("Cobertura de Mexico Charts", "Mexico Charts coverage")}</p>
                <h2 className="mt-4 max-w-3xl text-balance font-black uppercase leading-[0.95] tracking-[-0.04em]" style={{ fontSize: "clamp(1.65rem, 4vw, 2.75rem)", overflowWrap: "anywhere" }}>
                  {pick("Mucho más que cifras de audiencia", "More than audience figures")}
                </h2>
              </div>
              <p className="text-sm leading-7 text-white/45 sm:text-base">
                {pick("La plataforma conecta perfiles, discografías, playlists, rankings, certificaciones y actividad en vivo. Cada producto conserva su propia fuente, frecuencia y nivel de cobertura.", "The platform connects profiles, catalogs, playlists, rankings, certifications and live activity. Every product retains its own source, frequency and coverage level.")}
              </p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              {dataProducts.map(({ icon: Icon, eyebrow, title, body, items, href, action, accent }, index) => (
                <article key={title} className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.018] p-6 sm:p-8">
                  <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-[0.08] blur-3xl" style={{ background: accent }} />
                  <div className="relative flex items-start justify-between gap-6">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ color: accent, background: `${accent}10`, border: `1px solid ${accent}28` }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-[10px] font-black tracking-[0.2em] text-white/15">0{index + 1}</span>
                  </div>
                  <div className="relative mt-8 grid gap-7 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.72fr)]">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.26em]" style={{ color: accent }}>{eyebrow}</p>
                      <h3 className="mt-3 text-2xl font-black leading-tight tracking-[-0.04em]">{title}</h3>
                      <p className="mt-4 text-sm leading-6 text-white/42">{body}</p>
                    </div>
                    <ul className="border-t border-white/[0.06] sm:border-l sm:border-t-0 sm:pl-6">
                      {items.map(item => <li key={item} className="border-b border-white/[0.045] py-2.5 text-xs leading-5 text-white/48">{item}</li>)}
                    </ul>
                  </div>
                  <div className="relative mt-7 border-t border-white/[0.06] pt-5">
                    {href ? (
                      <Link href={href}>
                        <span className="inline-flex cursor-pointer items-center gap-2 text-[9px] font-black uppercase tracking-[0.17em] transition-opacity hover:opacity-70" style={{ color: accent }}>{action}<ArrowRight className="h-3.5 w-3.5" /></span>
                      </Link>
                    ) : <span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.17em] text-white/28"><Clock3 className="h-3.5 w-3.5" />{action}</span>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="estadisticas" className="scroll-mt-24 px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid gap-7 lg:grid-cols-[1fr_520px] lg:items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>{pick("Estadísticas de artistas", "Artist statistics")}</p>
                <h2 className="mt-4 max-w-3xl text-balance font-black uppercase leading-[0.95] tracking-[-0.04em]" style={{ fontSize: "clamp(1.65rem, 4vw, 2.75rem)", overflowWrap: "anywhere" }}>
                  {pick("Todo en una sola lectura", "Everything in one view")}
                </h2>
              </div>
              <p className="text-sm leading-7 text-white/45 sm:text-base">
                {pick("La cobertura cambia según el artista y la plataforma. Cada cifra conserva su fecha de actualización; si una métrica no está disponible, no la presentamos como cero.", "Coverage varies by artist and platform. Every figure retains its update date; when a metric is unavailable, we never present it as zero.")}
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {PLATFORMS.map(platform => <MetricCard key={platform.name} platform={platform} english={language === "en"} />)}
              <article className="relative min-h-[265px] overflow-hidden rounded-2xl p-6 sm:p-7" style={{ background: "linear-gradient(145deg, rgba(57,255,20,0.1), rgba(57,255,20,0.025))", border: "1px solid rgba(57,255,20,0.2)" }}>
                <MapPin className="h-8 w-8" style={{ color: G }} />
                <p className="mt-8 text-[9px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>{pick("Audiencia en México", "Audience in Mexico")}</p>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.04em]">{pick("Audiencia por ciudad", "Audience by city")}</h3>
                <p className="mt-5 text-sm leading-6 text-white/48">{pick("Oyentes actuales y máximos registrados en las principales ciudades, cuando existe cobertura geográfica.", "Current listeners and recorded peaks in leading cities when geographic coverage is available.")}</p>
              </article>
            </div>
          </div>
        </section>

        <section id="proceso" className="scroll-mt-24 border-y border-white/[0.06] bg-white/[0.012] px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1280px]">
            <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>{pick("De la fuente al perfil", "From source to profile")}</p>
            <h2 className="mt-4 max-w-4xl text-balance font-black uppercase leading-[0.95] tracking-[-0.04em]" style={{ fontSize: "clamp(1.65rem, 4vw, 2.75rem)", overflowWrap: "anywhere" }}>{pick("Datos ordenados para entender el movimiento", "Organized data that reveals movement")}</h2>
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

        <section className="border-b border-white/[0.06] px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>{pick("Del dato a la lectura", "From data to insight")}</p>
                <h2 className="mt-4 max-w-2xl text-balance font-black uppercase leading-[0.95] tracking-[-0.04em]" style={{ fontSize: "clamp(1.65rem, 4vw, 2.75rem)", overflowWrap: "anywhere" }}>
                  {pick("Lo que las cifras permiten entender", "What the numbers reveal")}
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-white/45 sm:text-base">
                {pick("Una cifra aislada muestra tamaño. Su periodo, historial y plataforma muestran dirección. Mexico Charts reúne esas piezas para dar contexto al movimiento de cada artista.", "A figure on its own shows scale. Its period, history and platform show direction. Mexico Charts brings those pieces together to add context to every artist's movement.")}
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {insights.map(({ icon: Icon, title, body }, index) => (
                <article key={title} className="group rounded-2xl border border-white/[0.075] bg-white/[0.018] p-6 transition-colors hover:border-[#39FF14]/25 sm:p-7">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#39FF14]/[0.08] text-[#39FF14]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-black tracking-[0.18em] text-white/15">0{index + 1}</span>
                  </div>
                  <h3 className="mt-8 text-sm font-black uppercase leading-5 tracking-[0.12em]">{title}</h3>
                  <p className="mt-4 text-sm leading-6 text-white/42">{body}</p>
                </article>
              ))}
            </div>

            <div className="mt-4 grid overflow-hidden rounded-2xl border border-white/[0.075] bg-[#080808] sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: BarChart3, label: pick("Valor", "Value"), detail: pick("La cifra observada", "The observed figure") },
                { icon: Clock3, label: pick("Periodo", "Period"), detail: pick("El intervalo comparado", "The compared interval") },
                { icon: Globe2, label: pick("Plataforma", "Platform"), detail: pick("El origen de la métrica", "The metric's origin") },
                { icon: CalendarDays, label: pick("Fecha", "Date"), detail: pick("El corte de medición", "The measurement cutoff") },
              ].map(({ icon: Icon, label, detail }, index) => (
                <div key={label} className="flex items-center gap-4 p-5 sm:p-6" style={{ borderLeft: index ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                  <Icon className="h-4 w-4 shrink-0 text-[#39FF14]" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/75">{label}</p>
                    <p className="mt-1 text-xs text-white/32">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cobertura" className="scroll-mt-24 px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>{pick("Cobertura clara", "Clear coverage")}</p>
              <h2 className="mt-4 text-balance font-black uppercase leading-[0.95] tracking-[-0.04em]" style={{ fontSize: "clamp(1.65rem, 4vw, 2.75rem)", overflowWrap: "anywhere" }}>{pick("La ausencia de datos también se explica", "Missing data is explained too")}</h2>
              <p className="mt-7 max-w-xl text-base leading-8 text-white/48">{pick("No todas las plataformas ofrecen la misma cobertura para cada artista. Por eso distinguimos entre una cifra en cero, un dato no disponible y una actualización pendiente.", "Not every platform provides the same coverage for every artist. That is why we distinguish between zero, unavailable data and an update still in progress.")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: CalendarDays, title: pick("Fecha de corte", "Cutoff date"), body: pick("Cada medición indica cuándo fue actualizada", "Every measurement shows when it was updated") },
                { icon: TrendingUp, title: pick("Periodo definido", "Defined period"), body: pick("Cada cambio señala el intervalo que compara", "Every change states the interval being compared") },
                { icon: BarChart3, title: pick("Origen identificable", "Identifiable source"), body: pick("La plataforma acompaña siempre a la cifra", "The platform always accompanies the figure") },
                { icon: Music2, title: pick("Un solo perfil", "One profile"), body: pick("Cada artista conserva una identidad canónica", "Every artist retains one canonical identity") },
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
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: G }}><Sparkles className="h-3.5 w-3.5" />{pick("Más transparencia", "More transparency")}</p>
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
