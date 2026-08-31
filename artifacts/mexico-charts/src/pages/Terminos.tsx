import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { EditorialFooter, EditorialHero } from "@/components/EditorialLayout";
import { CONTACT_EMAIL } from "@/config/brand";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Terminos() {
  const { pick } = useLanguage();
  const sections = [
    { title: pick("Uso del sitio", "Site use"), body: pick("Mexico Charts ofrece perfiles, listas y análisis informativos sobre música mexicana. La disponibilidad y fecha de actualización de cada métrica dependen de su fuente.", "Mexico Charts provides informational profiles, charts and analysis about Mexican music. The availability and update date of each metric depend on its source.") },
    { title: pick("Cuenta gratuita", "Free account"), body: pick("Puedes crear una cuenta gratuita para guardar artistas y conservar tus preferencias. Eres responsable de mantener seguro tu acceso.", "You may create a free account to save artists and keep your preferences. You are responsible for keeping your access secure.") },
    { title: pick("Monitoreo de pago", "Paid monitoring"), body: pick("Mexico Charts ofrece planes opcionales para conservar y presentar el historial disponible de artistas elegibles. La cobertura exacta depende del artista y se muestra antes de solicitar o contratar el plan.", "Mexico Charts offers optional plans that preserve and present available history for eligible artists. Exact coverage depends on the artist and is shown before a plan is requested or purchased.") },
    { title: pick("Precio y renovación", "Price and renewal"), body: pick("El plan Individual cuesta $6 USD por artista al mes y se renueva automáticamente hasta su cancelación. Los planes Selección y Profesional se activan mediante solicitud; Catálogo completo está sujeto a revisión. El precio y la frecuencia aplicables se muestran antes de confirmar.", "The Individual plan costs $6 USD per artist per month and renews automatically until cancelled. Selection and Professional plans require assisted activation; Complete Catalog is subject to review. Applicable price and billing frequency are shown before confirmation.") },
    { title: pick("Cancelación", "Cancellation"), body: pick(`Puedes solicitar la cancelación antes de la siguiente renovación escribiendo a ${CONTACT_EMAIL}. La cancelación evita cargos futuros y no elimina el periodo ya pagado.`, `You may request cancellation before the next renewal by emailing ${CONTACT_EMAIL}. Cancellation prevents future charges and does not remove the already-paid period.`) },
    { title: pick("Naturaleza de los datos", "Nature of the data"), body: pick("Las cifras pueden cambiar, retrasarse o no estar disponibles. Mexico Charts no garantiza resultados comerciales ni representa a los artistas incluidos.", "Figures may change, be delayed or become unavailable. Mexico Charts does not guarantee commercial outcomes or represent the artists included.") },
    { title: pick("Uso responsable", "Responsible use"), body: pick("No se permite extraer el sitio de forma masiva, interferir con su funcionamiento ni utilizarlo para acceder a sistemas o datos no autorizados.", "You may not scrape the site in bulk, interfere with its operation or use it to access unauthorized systems or data.") },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <PageSEO title={pick("Términos de uso — Mexico Charts", "Terms of use — Mexico Charts")} description={pick("Términos generales para el uso de Mexico Charts y sus cuentas gratuitas.", "General terms for using Mexico Charts and its free accounts.")} path="/terminos" />
      <SiteNav />
      <div className="flex items-center gap-1.5 border-b border-white/[0.05] px-6 py-3 lg:px-10">
        <Link href="/"><Home className="h-3 w-3 text-white/35" /></Link>
        <ChevronRight className="h-3 w-3 text-white/20" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">{pick("Términos", "Terms")}</span>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-14 lg:px-10 lg:py-24">
        <EditorialHero title={pick("Términos", "Terms")} description={pick("Condiciones para usar Mexico Charts y sus planes de monitoreo.", "Terms for using Mexico Charts and its monitoring plans.")} compact />
        <section className="mt-14 grid gap-3 md:grid-cols-2">
          {sections.map(section => (
            <article key={section.title} className="rounded-2xl border border-white/[0.075] bg-white/[0.025] p-5 sm:p-6">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#39FF14]">{section.title}</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-zinc-500">{section.body}</p>
            </article>
          ))}
        </section>
        <section className="mt-14 rounded-2xl border border-white/[0.075] bg-white/[0.025] p-5 sm:p-7" aria-labelledby="youtube-terms">
          <h2 id="youtube-terms" className="text-xs font-black uppercase tracking-[0.18em] text-[#39FF14]">{pick("Funciones de YouTube", "YouTube features")}</h2>
          <div className="mt-4 space-y-4 text-sm font-medium leading-7 text-zinc-500">
            <p>{pick("Algunas funciones de Mexico Charts utilizan los servicios de la API de YouTube. Al aceptar y utilizar esas funciones, también aceptas los ", "Some Mexico Charts features use YouTube API Services. By accepting and using those features, you also agree to the ")}<a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="text-white underline underline-offset-4">{pick("Términos de Servicio de YouTube", "YouTube Terms of Service")}</a>{pick(" y reconoces el ", " and acknowledge the ")}<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-white underline underline-offset-4">{pick("Aviso de Privacidad de Google", "Google Privacy Policy")}</a>{pick(" y la ", " and the ")}<Link href="/privacidad" className="text-white underline underline-offset-4">{pick("Política de Privacidad de Mexico Charts", "Mexico Charts Privacy Policy")}</Link>.</p>
            <p>{pick("Las cifras identificadas como observaciones de YouTube Data API son datos públicos recibidos de ese servicio en la fecha y hora mostradas. Las ganancias, porcentajes, tendencias, velocidad, comparaciones, rankings y otras métricas identificadas como cálculos de Mexico Charts son análisis independientes creados a partir de observaciones guardadas y no son métricas publicadas, aprobadas ni respaldadas por YouTube o Google.", "Figures identified as YouTube Data API observations are public data received from that service at the displayed date and time. Gains, percentages, trends, velocity, comparisons, rankings and other metrics identified as Mexico Charts calculations are independent analytics created from saved observations and are not metrics published, approved or endorsed by YouTube or Google.")}</p>
            <p>{pick("YouTube y Google no patrocinan, avalan ni administran Mexico Charts. Cuando existe un plan de pago, el pago corresponde a la interfaz, organización, monitoreo, análisis, alertas, historial y soporte independientes de Mexico Charts; no compra ni revende acceso a YouTube, a sus servicios de API o a contenido audiovisual de YouTube.", "YouTube and Google do not sponsor, endorse or operate Mexico Charts. Where a paid plan exists, payment is for Mexico Charts' independent interface, organization, monitoring, analytics, alerts, history and support; it does not purchase or resell access to YouTube, its API Services or YouTube audiovisual content.")}</p>
          </div>
        </section>
        <p className="mt-8 text-xs font-medium leading-6 text-zinc-700">{pick("Última actualización: 30 de agosto de 2026.", "Last updated: August 30, 2026.")}</p>
      </main>
      <EditorialFooter />
    </div>
  );
}
