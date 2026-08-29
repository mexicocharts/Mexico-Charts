import { Link } from "wouter";
import { BarChart3, ChevronRight, Cookie, CreditCard, ExternalLink, Home, Mail, MousePointer2, ShieldCheck, UserRound } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { CONTACT_EMAIL, SITE_DOMAIN, SITE_URL } from "@/config/brand";
import { EditorialFooter, EditorialHero } from "@/components/EditorialLayout";
import { useLanguage } from "@/i18n/LanguageContext";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function Privacidad() {
  const { language, pick } = useLanguage();
  const privacyItems = [
    { title: pick("Información recopilada", "Information collected"), body: pick("Mexico Charts recopila información básica de uso del sitio, como páginas visitadas, dispositivo, navegador, ubicación aproximada, fuente de tráfico y métricas de interacción. Se usa para entender el rendimiento del sitio y mejorar la experiencia.", "Mexico Charts collects basic site-usage information such as pages visited, device, browser, approximate location, traffic source and interaction metrics. It is used to understand site performance and improve the experience."), icon: BarChart3 },
    { title: pick("Cookies y analítica", "Cookies and analytics"), body: pick("El sitio utiliza Google Analytics para medir tráfico y navegación de forma agregada. Google puede emplear cookies o tecnologías similares de acuerdo con sus propias políticas.", "The site uses Google Analytics to measure traffic and navigation in aggregate. Google may use cookies or similar technologies under its own policies."), icon: Cookie },
    { title: pick("Servicios de terceros", "Third-party services"), body: pick("Mexico Charts puede enlazar o integrar contenido de plataformas externas como Spotify, YouTube, Apple Music, Deezer, Instagram, TikTok, X, Ticketmaster u otras. Cada plataforma externa tiene sus propias políticas de privacidad.", "Mexico Charts may link to or integrate content from external platforms such as Spotify, YouTube, Apple Music, Deezer, Instagram, TikTok, X, Ticketmaster and others. Each external platform has its own privacy policies."), icon: ExternalLink },
    { title: pick("Datos personales", "Personal data"), body: pick("Mexico Charts no vende información personal de usuarios. Si una persona nos contacta por email o redes sociales, la información compartida se usará únicamente para responder o gestionar su mensaje.", "Mexico Charts does not sell users' personal information. If someone contacts us by email or social media, the information shared is used only to respond to or manage the inquiry."), icon: UserRound },
    { title: pick("Cuentas y preferencias", "Accounts and preferences"), body: pick("Si creas una cuenta, el proveedor de autenticación gestiona el acceso seguro y Mexico Charts conserva los datos necesarios para tu perfil, plan, artistas guardados y preferencias de alertas. No exigimos una cuenta para ver las páginas públicas.", "If you create an account, the authentication provider manages secure access and Mexico Charts stores the information needed for your profile, plan, saved artists and alert preferences. An account is not required to view public pages."), icon: ShieldCheck },
    { title: pick("Pagos y suscripciones", "Payments and subscriptions"), body: pick("Stripe procesa los datos de facturación de las suscripciones y comparte con Mexico Charts los identificadores y el estado necesarios para vincular el plan con tu cuenta y el artista seleccionado. Mexico Charts no almacena números completos de tarjeta.", "Stripe processes subscription billing details and shares the identifiers and status Mexico Charts needs to link the plan to your account and selected artist. Mexico Charts does not store complete card numbers."), icon: CreditCard },
    { title: pick("Cambios", "Changes"), body: pick("Esta política puede actualizarse conforme el sitio evolucione.", "This policy may be updated as the site evolves."), icon: MousePointer2 },
  ];
  const privacyJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pick("Privacidad — Mexico Charts", "Privacy — Mexico Charts"),
    url: `${SITE_URL}/privacidad`,
    description: pick("Política de privacidad de Mexico Charts: uso del sitio, analítica, cookies, servicios externos y manejo de información relacionada con mexicochart.com.", "Mexico Charts privacy policy: site usage, analytics, cookies, external services and information handling related to mexicochart.com."),
    inLanguage: language === "en" ? "en" : "es-MX",
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
        title={pick("Privacidad — Mexico Charts", "Privacy — Mexico Charts")}
        description={pick("Política de privacidad de Mexico Charts: uso del sitio, analítica, cookies, servicios externos y manejo de información relacionada con mexicochart.com.", "Mexico Charts privacy policy: site usage, analytics, cookies, external services and information handling related to mexicochart.com.")}
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
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>{pick("Privacidad", "Privacy")}</span>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-14 sm:py-18 lg:px-10 lg:py-24">
        <EditorialHero
          title={pick("Privacidad", "Privacy")}
          description={pick(`Cómo manejamos información básica de uso, servicios externos y contacto dentro de ${SITE_DOMAIN}.`, `How we handle basic usage information, external services and contact within ${SITE_DOMAIN}.`)}
          aside={<div
            className="rounded-3xl p-6"
            style={{ background: "linear-gradient(160deg,rgba(57,255,20,0.075),rgba(255,255,255,0.028) 45%,rgba(0,0,0,0.24))", border: "1px solid rgba(57,255,20,0.16)" }}
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(57,255,20,0.10)", color: G }}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">{pick("Principio base", "Core principle")}</h2>
            <p className="mt-4 text-sm font-medium leading-7 text-zinc-500">
              {pick("Mexico Charts no vende información personal de usuarios. Si nos escribes, usamos esa información solo para responder o gestionar tu mensaje.", "Mexico Charts does not sell users' personal information. If you write to us, we use that information only to respond to or manage the inquiry.")}
            </p>
          </div>}
        />

        <section className="mt-14 grid gap-3 md:grid-cols-2">
          {privacyItems.map(({ title, body, icon: Icon }) => (
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
              <h2 className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: G }}>{pick("Contacto de privacidad", "Privacy contact")}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">
                {pick("Para dudas relacionadas con privacidad, escríbenos directo.", "For privacy-related questions, contact us directly.")}
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
          {pick("Esta política puede actualizarse conforme el sitio evolucione. Última actualización: 29 de agosto de 2026.", "This policy may be updated as the site evolves. Last updated: August 29, 2026.")}
        </p>
      </div>

      <EditorialFooter />
    </div>
  );
}
