import { Link } from "wouter";
import { CheckCircle2, Mail } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { EditorialFooter } from "@/components/EditorialLayout";
import { CONTACT_EMAIL } from "@/config/brand";
import { useLanguage } from "@/i18n/LanguageContext";

export default function MonitoringSuccess() {
  const { pick } = useLanguage();
  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <PageSEO title={pick("Monitoreo activado — Mexico Charts", "Monitoring activated — Mexico Charts")} description={pick("Confirmación del monitoreo mensual de Mexico Charts.", "Confirmation of Mexico Charts monthly monitoring.")} path="/monitoreo/exito" noindex />
      <SiteNav />
      <main className="mx-auto flex min-h-[72vh] max-w-3xl items-center px-6 py-16 text-center lg:px-10">
        <div className="w-full rounded-3xl border border-[#39FF14]/20 bg-gradient-to-br from-[#39FF14]/[0.08] to-white/[0.02] p-8 sm:p-12">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#39FF14]" />
          <h1 className="mt-7 text-3xl font-black uppercase tracking-[-0.03em] sm:text-5xl">{pick("Monitoreo activado", "Monitoring activated")}</h1>
          <p className="mx-auto mt-5 max-w-xl text-sm font-medium leading-7 text-zinc-500 sm:text-base">
            {pick("Stripe enviará la confirmación de pago al email utilizado. Mexico Charts usará ese mismo email para entregar el reporte mensual del artista seleccionado.", "Stripe will send payment confirmation to the email used at checkout. Mexico Charts will use that same email to deliver the selected artist's monthly report.")}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/artists" className="rounded-full bg-[#39FF14] px-6 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-black">{pick("Explorar artistas", "Explore artists")}</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-white/65"><Mail className="h-4 w-4" />{pick("Ayuda", "Help")}</a>
          </div>
        </div>
      </main>
      <EditorialFooter />
    </div>
  );
}
