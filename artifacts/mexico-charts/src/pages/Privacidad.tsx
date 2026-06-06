import { Link } from "wouter";
import { BarChart3, ChevronRight, Cookie, ExternalLink, Home, Mail, Megaphone, MousePointer2, ShieldCheck, UserRound } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { CONTACT_EMAIL, SITE_DOMAIN, SITE_URL } from "@/config/brand";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const PRIVACY_ITEMS = [
  {
    title: "Información recopilada",
    body: "Mexico Charts puede recopilar información básica de uso del sitio, como páginas visitadas, dispositivo, navegador, ubicación aproximada, fuente de tráfico y métricas de interacción. Esta información se usa para entender el rendimiento del sitio y mejorar la experiencia del usuario.",
    icon: BarChart3,
  },
  {
    title: "Cookies y analítica",
    body: "El sitio puede utilizar cookies, herramientas de analítica o servicios de terceros para medir tráfico, rendimiento, errores y comportamiento general de navegación.",
    icon: Cookie,
  },
  {
    title: "Servicios de terceros",
    body: "Mexico Charts puede enlazar o integrar contenido de plataformas externas como Spotify, YouTube, Apple Music, Deezer, Instagram, TikTok, X, Ticketmaster u otras. Cada plataforma externa tiene sus propias políticas de privacidad.",
    icon: ExternalLink,
  },
  {
    title: "Datos personales",
    body: "Mexico Charts no vende información personal de usuarios. Si una persona nos contacta por email o redes sociales, la información compartida se usará únicamente para responder o gestionar la consulta.",
    icon: UserRound,
  },
  {
    title: "Publicidad",
    body: "En el futuro, Mexico Charts podría utilizar publicidad, patrocinios o herramientas de monetización. Si se implementan, esta página deberá actualizarse.",
    icon: Megaphone,
  },
  {
    title: "Cambios",
    body: "Esta política puede actualizarse conforme el sitio evolucione.",
    icon: MousePointer2,
  },
] as const;

export default function Privacidad() {
  const privacyJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacidad — Mexico Charts",
    url: `${SITE_URL}/privacidad`,
    description: "Política de privacidad de Mexico Charts: uso del sitio, analítica, cookies, servicios externos y manejo de información relacionada con mexicochart.com.",
    inLanguage: "es-MX",
    isPartOf: {
      "@type": "WebSite",
      name: "Mexico Charts",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Mexico Charts",
      url: SITE_URL,
      email: CONTACT_EMAIL,
    },
  };

  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <PageSEO
        title="Privacidad — Mexico Charts"
        description="Política de privacidad de Mexico Charts: uso del sitio, analítica, cookies, servicios externos y manejo de información relacionada con mexicochart.com."
        path="/privacidad"
        jsonLd={privacyJsonLd}
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-72"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(57,255,20,0.10), transparent 70%)", zIndex: 0 }}
      />

      <SiteNav />

      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.20)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>Privacidad</span>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-14 sm:py-18 lg:px-10 lg:py-24">
        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>Mexico Charts</span>
              <span className="h-px w-10" style={{ background: "rgba(57,255,20,0.25)" }} />
            </div>
            <h1 className="max-w-4xl font-black uppercase leading-[0.84] tracking-normal"
              style={{ fontSize: "clamp(54px,10vw,136px)" }}>
              Privacidad
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-medium leading-8 sm:text-xl" style={{ color: "rgba(255,255,255,0.52)" }}>
              Cómo manejamos información básica de uso, servicios externos y contacto dentro de {SITE_DOMAIN}.
            </p>
          </div>

          <div
            className="rounded-3xl p-6"
            style={{ background: "linear-gradient(160deg,rgba(57,255,20,0.075),rgba(255,255,255,0.028) 45%,rgba(0,0,0,0.24))", border: "1px solid rgba(57,255,20,0.16)" }}
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(57,255,20,0.10)", color: G }}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">Principio base</h2>
            <p className="mt-4 text-sm font-medium leading-7 text-zinc-500">
              Mexico Charts no vende información personal de usuarios. Si nos escribes, usamos esa información solo para responder o gestionar la consulta.
            </p>
          </div>
        </section>

        <section className="mt-14 grid gap-3 md:grid-cols-2">
          {PRIVACY_ITEMS.map(({ title, body, icon: Icon }) => (
            <article
              key={title}
              className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.075)" }}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(57,255,20,0.08)", color: G }}>
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: G }}>{title}</h2>
              <p className="mt-3 text-sm font-medium leading-6" style={{ color: "rgba(255,255,255,0.48)" }}>{body}</p>
            </article>
          ))}
        </section>

        <section
          className="mt-14 rounded-2xl p-5 sm:p-6"
          style={{ background: "rgba(57,255,20,0.04)", border: `1px solid rgba(57,255,20,0.12)` }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: G }}>Contacto de privacidad</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                Para dudas relacionadas con privacidad, escríbenos directo.
              </p>
            </div>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-black"
              style={{ background: G }}
            >
              <Mail className="h-4 w-4" />
              Email
            </a>
          </div>
          <div className="mt-4 text-sm font-black" style={{ color: G }}>{CONTACT_EMAIL}</div>
        </section>

        <p className="mt-8 max-w-3xl text-xs font-medium leading-6 text-zinc-700">
          Esta política puede actualizarse conforme el sitio evolucione. Última versión visible: 2026.
        </p>
      </div>

      <footer className="border-t py-8 px-6 lg:px-10 text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
          Mexico Charts © 2026 — Plataforma independiente de datos, cultura e impacto de la música mexicana
        </p>
      </footer>
    </div>
  );
}
