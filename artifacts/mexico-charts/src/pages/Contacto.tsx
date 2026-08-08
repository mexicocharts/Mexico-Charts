import { Link } from "wouter";
import { ArrowUpRight, BadgeCheck, ChevronRight, Globe, Handshake, Home, Instagram, Mail, Megaphone, PencilLine } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { CONTACT_EMAIL, SITE_DOMAIN, SITE_URL, SOCIAL_HANDLE, SOCIAL_URLS } from "@/config/brand";
import { EditorialFooter, EditorialHero } from "@/components/EditorialLayout";
import { useLanguage } from "@/i18n/LanguageContext";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const CONTACT_LINKS = [
  {
    label: "Email",
    value: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    icon: Mail,
    featured: true,
  },
  {
    label: "Instagram",
    value: SOCIAL_HANDLE,
    href: SOCIAL_URLS.instagram,
    icon: Instagram,
    featured: false,
  },
  {
    label: "Website",
    value: SITE_DOMAIN,
    href: SITE_URL,
    icon: Globe,
    featured: false,
  },
] as const;

export default function Contacto() {
  const { language, pick } = useLanguage();
  const intents = [
    { title: pick("Correcciones", "Corrections"), body: pick("Enlaces rotos, datos incorrectos, cifras desactualizadas o créditos que necesitan revisión.", "Broken links, incorrect data, outdated figures or credits that need review."), icon: PencilLine },
    { title: pick("Colaboraciones", "Collaborations"), body: pick("Propuestas editoriales, comunidades de fans, creadores, proyectos musicales y alianzas culturales.", "Editorial proposals, fan communities, creators, music projects and cultural partnerships."), icon: Handshake },
    { title: pick("Prensa", "Press"), body: pick("Solicitudes de medios, entrevistas, notas, publicidad o integración de marca.", "Media requests, interviews, features, advertising or brand integration."), icon: Megaphone },
  ];
  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: pick("Contacto — Mexico Charts", "Contact — Mexico Charts"),
    url: `${SITE_URL}/contacto`,
    description: pick("Contacto de Mexico Charts para colaboraciones, correcciones de datos, prensa, propuestas editoriales y oportunidades relacionadas con música mexicana.", "Contact Mexico Charts for collaborations, data corrections, press, editorial proposals and opportunities related to Mexican music."),
    inLanguage: language === "en" ? "en" : "es-MX",
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
        title={pick("Contacto — Mexico Charts", "Contact — Mexico Charts")}
        description={pick("Contacto de Mexico Charts para colaboraciones, correcciones de datos, prensa, propuestas editoriales y oportunidades relacionadas con música mexicana.", "Contact Mexico Charts for collaborations, data corrections, press, editorial proposals and opportunities related to Mexican music.")}
        path="/contacto"
        jsonLd={contactJsonLd}
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-64"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(57,255,20,0.10), transparent 70%)", zIndex: 0 }}
      />

      <SiteNav />

      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.20)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>{pick("Contacto", "Contact")}</span>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-14 sm:py-18 lg:px-10 lg:py-24">
        <div>
          <EditorialHero
            title={pick("Contacto", "Contact")}
            description={pick("Correcciones, prensa, colaboraciones y oportunidades relacionadas con música mexicana.", "Corrections, press, collaborations and opportunities related to Mexican music.")}
            aside={<aside
              className="min-w-0 rounded-3xl p-2 sm:p-3"
              style={{ background: "linear-gradient(160deg,rgba(57,255,20,0.07),rgba(255,255,255,0.025) 42%,rgba(0,0,0,0.22))", border: "1px solid rgba(57,255,20,0.16)", boxShadow: "0 28px 90px rgba(0,0,0,0.36)" }}
            >
              <div className="min-w-0 rounded-2xl p-4 sm:p-6" style={{ background: "rgba(5,5,5,0.72)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(57,255,20,0.10)", color: G }}>
                    <BadgeCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black uppercase tracking-[0.12em] text-white">{pick("Canales oficiales", "Official channels")}</div>
                    <div className="mt-1 text-xs font-medium text-zinc-600">{pick("Respuesta editorial directa", "Direct editorial response")}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {CONTACT_LINKS.map(({ label, value, href, icon: Icon, featured }) => (
                    <a
                      key={label}
                      href={href}
                      target={href.startsWith("mailto:") ? undefined : "_blank"}
                      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
                      className="group flex min-w-0 items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-white/[0.045] sm:gap-4 sm:p-4"
                      style={{
                        background: featured ? "rgba(57,255,20,0.055)" : "rgba(255,255,255,0.025)",
                        border: featured ? "1px solid rgba(57,255,20,0.18)" : "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: featured ? "rgba(57,255,20,0.10)" : "rgba(255,255,255,0.045)", color: featured ? G : "rgba(255,255,255,0.56)" }}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">{label}</span>
                        <span className={`mt-1 block font-black ${featured ? "break-all text-xs sm:text-sm" : "truncate text-sm"}`} style={{ color: featured ? G : "rgba(255,255,255,0.72)" }}>{value}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-300" />
                    </a>
                  ))}
                </div>

                <p className="mt-6 border-t pt-5 text-xs font-medium leading-6 text-zinc-600" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  {pick("Para correcciones, incluye el enlace de la página y la fuente correcta. Para prensa o alianzas, agrega contexto y fechas relevantes.", "For corrections, include the page link and the correct source. For press or partnerships, add relevant context and dates.")}
                </p>
              </div>
            </aside>}
          />

          <section>
            <div className="mt-9 flex flex-wrap gap-2">
              {[pick("Datos", "Data"), "Editorial", pick("Prensa", "Press"), pick("Alianzas", "Partnerships")].map(item => (
                <span
                  key={item}
                  className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em]"
                  style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.52)" }}
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-14 grid gap-3 sm:grid-cols-3">
              {intents.map(({ title, body, icon: Icon }) => (
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
            </div>
          </section>
        </div>
      </div>

      <EditorialFooter />
    </div>
  );
}
