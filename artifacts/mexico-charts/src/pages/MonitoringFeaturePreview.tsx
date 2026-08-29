import { BellRing, CalendarDays, ChartNoAxesCombined, Download, Flag, MapPin, Radar, Sparkles, Users } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

const features = [
  { n:"01", icon:BellRing, title:"Alertas y reportes programados", copy:"Reglas por métrica, meta o porcentaje. Entrega inmediata, diaria o semanal.", detail:"3 reglas activas · YouTube +100K/día · Spotify ±5% · nuevos lanzamientos" },
  { n:"02", icon:Sparkles, title:"Brief de esta mañana", copy:"Todo lo importante resumido sin revisar cada plataforma.", detail:"+7.4M vistas · −12.4K oyentes · Bellakeo lidera · 1 hito nuevo" },
  { n:"03", icon:Download, title:"Reportes listos para compartir", copy:"Resumen ejecutivo con gráficas, periodo y marca Mexico Charts.", detail:"PDF · PNG · CSV · enlace privado con vencimiento" },
  { n:"04", icon:Flag, title:"Hitos y próxima meta", copy:"Historial automático, velocidad y fecha estimada del próximo logro.", detail:"Bellakeo: 755.2M · siguiente 800M · estimado 18 sep 2026" },
  { n:"05", icon:ChartNoAxesCombined, title:"Benchmarks comparables", copy:"Contexto frente a artistas mexicanos de tamaño y género similares.", detail:"Crecimiento YouTube: percentil 82 · conversión Spotify: percentil 74" },
  { n:"06", icon:Users, title:"Shortlists y portafolios", copy:"Grupos reutilizables para comparar artistas, canciones y campañas.", detail:"Corridos 2026 · Peso Pluma #1 crecimiento · Natanael #1 velocidad" },
  { n:"07", icon:CalendarDays, title:"Campaña de lanzamiento", copy:"Día 1, 7, 30 y 90; impacto contra el periodo anterior y releases previos.", detail:"daño · lift 7d +10.8% · confianza alta · 4 plataformas" },
  { n:"08", icon:MapPin, title:"Movimiento de mercados", copy:"Ciudades que ganan o pierden audiencia para promoción y touring.", detail:"CDMX +3.8% · Guadalajara +2.1% · Monterrey −0.7%" },
];

export default function MonitoringFeaturePreview(){
  return <div className="min-h-screen bg-[#050505] text-white"><PageSEO title="Vista previa Monitor — Mexico Charts" description="Demostración del Monitor de artistas." path="/monitoreo/demo/peso-pluma" noindex/><SiteNav/>
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-16">
      <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_85%_10%,rgba(57,255,20,.14),transparent_35%),linear-gradient(140deg,#111,#070707)] p-7 sm:p-10">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.22em] text-[#39FF14]">Demo privada · datos de muestra basados en Peso Pluma</p><h1 className="mt-4 text-4xl font-black tracking-[-.055em] sm:text-6xl">Mexico Charts Monitor</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">Así se sentiría el producto completo: decisiones, contexto y seguimiento automático, no una pared de números.</p></div><div className="rounded-2xl border border-[#39FF14]/20 bg-[#39FF14]/[.06] px-5 py-4"><p className="text-[8px] font-black uppercase tracking-[.16em] text-white/30">Artista de la demo</p><p className="mt-1 text-2xl font-black">Peso Pluma</p><p className="mt-1 text-[9px] font-bold text-[#39FF14]">8 módulos premium</p></div></div>
      </header>
      <section className="mt-5 grid gap-3 lg:grid-cols-2">{features.map(({n,icon:Icon,title,copy,detail})=><article key={n} className="group overflow-hidden rounded-3xl border border-white/[.08] bg-white/[.025] p-6 transition hover:border-[#39FF14]/25 sm:p-7"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#39FF14]/20 bg-[#39FF14]/[.07]"><Icon className="h-5 w-5 text-[#39FF14]"/></span><div><p className="text-[8px] font-black uppercase tracking-[.18em] text-white/25">Módulo {n}</p><h2 className="mt-1 text-xl font-black">{title}</h2></div></div><p className="mt-5 text-sm leading-6 text-white/45">{copy}</p><div className="mt-5 rounded-2xl border border-white/[.07] bg-black/25 px-4 py-3 text-xs font-bold leading-5 text-white/70">{detail}</div></article>)}</section>
      <section className="mt-5 rounded-3xl border border-[#39FF14]/20 bg-[#39FF14]/[.035] p-7 sm:p-9"><div className="flex items-center gap-3"><Radar className="h-6 w-6 text-[#39FF14]"/><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#39FF14]">Resultado</p><h2 className="mt-1 text-2xl font-black">Una suscripción que trabaja mientras el cliente no está mirando</h2></div></div><p className="mt-4 max-w-3xl text-sm leading-7 text-white/45">Los datos directos se mostrarán con su fuente; análisis, benchmarks, predicciones y conclusiones estarán etiquetados como cálculos de Mexico Charts.</p></section>
    </main></div>;
}
