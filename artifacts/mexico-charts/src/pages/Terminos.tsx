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
    { title: pick("Servicio", "Service"), body: pick("El monitoreo mensual es un reporte informativo de Mexico Charts sobre un artista seleccionado. Incluye únicamente métricas disponibles y verificables; la cobertura puede variar entre artistas, plataformas y fechas.", "Monthly monitoring is an informational Mexico Charts report for one selected artist. It includes only available and verifiable metrics; coverage may vary by artist, platform and date.") },
    { title: pick("Cuenta", "Account"), body: pick("Para contratar o consultar funciones privadas de monitoreo necesitas una cuenta. Eres responsable de mantener seguro tu acceso. Las listas, perfiles y demás páginas públicas de Mexico Charts pueden consultarse sin registro.", "An account is required to purchase or access private monitoring features. You are responsible for keeping your access secure. Mexico Charts charts, profiles and other public pages remain available without registration.") },
    { title: pick("Precio y renovación", "Price and renewal"), body: pick("El servicio cuesta $6 USD por artista al mes y se renueva automáticamente hasta que sea cancelado. El proveedor de pagos mostrará el importe y la frecuencia antes de confirmar la compra.", "The service costs $6 USD per artist per month and renews automatically until cancelled. The payment provider shows the amount and frequency before purchase confirmation.") },
    { title: pick("Entrega", "Delivery"), body: pick("El reporte se entrega al email utilizado durante el pago. El cliente es responsable de proporcionar una dirección válida y de revisar filtros de correo no deseado.", "Reports are delivered to the email used at checkout. The customer is responsible for providing a valid address and checking spam filters.") },
    { title: pick("Cancelación", "Cancellation"), body: pick(`Puedes solicitar la cancelación antes de la siguiente renovación escribiendo a ${CONTACT_EMAIL}. La cancelación evita cargos futuros; no elimina el periodo ya pagado.`, `You may request cancellation before the next renewal by emailing ${CONTACT_EMAIL}. Cancellation prevents future charges and does not remove the already-paid period.`) },
    { title: pick("Naturaleza de los datos", "Nature of the data"), body: pick("Las cifras pueden cambiar, retrasarse o no estar disponibles. Mexico Charts no garantiza resultados comerciales ni representa al artista. El servicio ofrece información y análisis, no asesoría financiera, legal o profesional.", "Figures may change, be delayed or become unavailable. Mexico Charts does not guarantee commercial outcomes or represent the artist. The service provides information and analysis, not financial, legal or professional advice.") },
    { title: pick("Uso permitido", "Permitted use"), body: pick("Los reportes son para uso personal o interno del cliente. No se permite revenderlos como base de datos, extraerlos de forma masiva ni utilizarlos para reconstruir los datos subyacentes de terceros.", "Reports are for the customer's personal or internal use. They may not be resold as a database, extracted in bulk or used to reconstruct underlying third-party data.") },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080808] text-white">
      <PageSEO title={pick("Términos del servicio — Mexico Charts", "Terms of service — Mexico Charts")} description={pick("Términos aplicables al monitoreo mensual de artistas de Mexico Charts.", "Terms applicable to Mexico Charts monthly artist monitoring.")} path="/terminos" />
      <SiteNav />
      <div className="flex items-center gap-1.5 border-b border-white/[0.05] px-6 py-3 lg:px-10">
        <Link href="/"><Home className="h-3 w-3 text-white/35" /></Link>
        <ChevronRight className="h-3 w-3 text-white/20" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">{pick("Términos", "Terms")}</span>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-14 lg:px-10 lg:py-24">
        <EditorialHero title={pick("Términos", "Terms")} description={pick("Condiciones claras para el monitoreo mensual de artistas.", "Clear conditions for monthly artist monitoring.")} compact />
        <section className="mt-14 grid gap-3 md:grid-cols-2">
          {sections.map(section => (
            <article key={section.title} className="rounded-2xl border border-white/[0.075] bg-white/[0.025] p-5 sm:p-6">
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#39FF14]">{section.title}</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-zinc-500">{section.body}</p>
            </article>
          ))}
        </section>
        <p className="mt-8 text-xs font-medium leading-6 text-zinc-700">{pick("Última actualización: 9 de agosto de 2026.", "Last updated: August 9, 2026.")}</p>
      </main>
      <EditorialFooter />
    </div>
  );
}
