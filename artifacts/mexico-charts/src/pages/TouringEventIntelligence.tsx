import { Link, useParams } from "wouter";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { useTouringEventHistory, useTouringIntelligence } from "@/hooks/useTouringIntelligence";

const money=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);
export default function TouringEventIntelligence(){
  const {eventId=""}=useParams<{eventId:string}>();
  const history=useTouringEventHistory(eventId); const intelligence=useTouringIntelligence();
  const economics=intelligence.data?.events.find(event=>event.eventId===eventId);
  const estimate=intelligence.data?.publicEstimation.events.find(event=>event.eventId===eventId);
  return <div className="min-h-screen bg-[#070707] text-white"><PageSEO title="Inteligencia de evento | Mexico Charts" description="Historial público, precios primary y estimaciones transparentes." path={`/touring/event/${eventId}`} noindex/><SiteNav/>
    <main className="mx-auto max-w-5xl px-6 py-16"><Link href="/touring" className="text-xs font-black uppercase tracking-[.18em] text-[#39FF14]">← Touring</Link>
      <p className="mt-10 text-[10px] font-black uppercase tracking-[.3em] text-zinc-500">Touring Lab · Evento</p><h1 className="mt-2 text-3xl font-black uppercase md:text-5xl">Inteligencia del evento</h1><p className="mt-3 font-mono text-xs text-zinc-500">{eventId}</p>
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <article className="border border-white/10 bg-white/[.02] p-5"><span className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500">Capacidad configurada</span><strong className="mt-3 block text-2xl">{economics?.capacity?`${economics.capacity.low.toLocaleString()}–${economics.capacity.high.toLocaleString()}`:"No disponible"}</strong><p className="mt-2 text-xs text-zinc-500">{economics?.capacity?.configuration??"Requiere configuración de concierto verificada."}</p>{economics?.capacity?.sourceUrl&&<a href={economics.capacity.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-[#39FF14]">Ver fuente →</a>}</article>
        <article className="border border-white/10 bg-white/[.02] p-5"><span className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500">Rango primary público</span><strong className="mt-3 block text-2xl">{economics?.standardPrimaryPrice?`${money(economics.standardPrimaryPrice.min)}–${money(economics.standardPrimaryPrice.max)}`:"No disponible"}</strong><p className="mt-2 text-xs text-zinc-500">No mezcla VIP, resale ni ofertas bloqueadas.</p></article>
        <article className="border border-white/10 bg-white/[.02] p-5"><span className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500">Gross estimado USD</span><strong className="mt-3 block text-2xl">{estimate?.estimatedGrossUsd!=null?money(estimate.estimatedGrossUsd):"Pendiente"}</strong><p className="mt-2 text-xs text-zinc-500">Punto estimado, no box office reportado. Confianza: {estimate?.confidencePercent!=null?`${estimate.confidencePercent}% · ${estimate.confidenceLabel}`:"insuficiente"}.</p></article>
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-4">
        <article className="border border-white/10 bg-white/[.02] p-5"><span className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500">Boletos estimados</span><strong className="mt-3 block text-2xl">{estimate?.estimatedTicketsSold?.toLocaleString("en-US")??"Pendiente"}</strong><p className="mt-2 text-xs text-zinc-500">No es inventario, asistencia ni boletos vendidos reportados.</p></article>
        <article className="border border-white/10 bg-white/[.02] p-5"><span className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500">Ticket promedio</span><strong className="mt-3 block text-2xl">{estimate?.estimatedAverageTicketUsd!=null?money(estimate.estimatedAverageTicketUsd):"Pendiente"}</strong><p className="mt-2 text-xs text-zinc-500">Promedio modelado en USD.</p></article>
        <article className="border border-white/10 bg-white/[.02] p-5"><span className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500">Utilización</span><strong className="mt-3 block text-2xl">{estimate?.estimatedCapacityUtilization!=null?`${(estimate.estimatedCapacityUtilization*100).toFixed(1)}%`:"Pendiente"}</strong><p className="mt-2 text-xs text-zinc-500">Boletos estimados / capacidad configurada.</p></article>
        <article className="border border-white/10 bg-white/[.02] p-5"><span className="text-[9px] font-black uppercase tracking-[.18em] text-zinc-500">Evidencia</span><strong className="mt-3 block text-sm">{estimate?.evidenceTimestamp?new Date(estimate.evidenceTimestamp).toLocaleString("es-MX"):"Pendiente"}</strong><p className="mt-2 text-xs text-zinc-500">Método {estimate?.methodologyVersion??"—"}</p></article>
      </section>
      <p className="mt-5 border-l-2 border-[#39FF14] pl-3 text-xs text-zinc-400">{estimate?.estimateLabel??"Mexico Charts Estimate — not promoter reported"}</p>
      <section className="mt-12"><h2 className="text-xl font-black uppercase">Historial observado</h2><p className="mt-2 text-xs leading-6 text-zinc-500">Cambios en metadatos públicos; no representan boletos vendidos ni inventario.</p>
        <div className="mt-5 space-y-2">{history.isLoading&&<p className="text-sm text-zinc-500">Cargando observaciones…</p>}{history.data?.observations.map((row,index)=><article key={`${row.observed_at}-${index}`} className="flex flex-wrap items-center gap-4 border border-white/10 px-4 py-3 text-xs"><time className="text-zinc-400">{new Date(row.observed_at).toLocaleString("es-MX")}</time><span className="uppercase text-[#39FF14]">{row.event_status??"estado no publicado"}</span><span className="text-zinc-500">{Array.isArray(row.price_ranges)&&row.price_ranges.length?`${row.price_ranges.length} rango(s) público(s)`:"sin rango público"}</span></article>)}</div>
      </section>
    </main></div>;
}
