import { Link } from "wouter";
import { ArrowLeft, BarChart3, CheckSquare, ExternalLink, RadioTower } from "lucide-react";
import PageSEO from "@/components/PageSEO";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

const tools = [
  {
    title: "Cobertura API",
    description: "Estado de YouTube, Spotify, MusicBrainz, Ticketmaster y Kworb.",
    href: "/admin/api-coverage",
    icon: <BarChart3 className="h-5 w-5" />,
    status: "Activo",
  },
  {
    title: "Cola de revisión",
    description: "Aprobar o rechazar coincidencias de Spotify y MusicBrainz.",
    href: "/admin/enrichment-review",
    icon: <CheckSquare className="h-5 w-5" />,
    status: "Activo",
  },
  {
    title: "Touring desk",
    description: "Espacio reservado para alertas de giras y nuevos conciertos.",
    href: "/touring",
    icon: <RadioTower className="h-5 w-5" />,
    status: "Próximo",
  },
];

export default function AdminHub() {
  return (
    <div className="min-h-[100dvh] bg-[#050505] text-zinc-200">
      <PageSEO
        title="Admin | Mexico Charts"
        description="Panel interno de herramientas para Mexico Charts."
        path="/admin"
        noindex
      />

      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-4 px-6">
          <Link href="/" className="shrink-0">
            <img src={logoUrl} alt="Mexico Charts" className="h-7 object-contain opacity-90" />
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-200">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
        </div>
      </nav>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 py-10">
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#39FF14]">Mexico Charts</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">Admin</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Herramientas internas para revisar cobertura, datos y flujos de enriquecimiento.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {tools.map(tool => (
            <Link key={tool.href} href={tool.href}>
              <article className="group flex h-full flex-col rounded-lg border border-white/[0.07] bg-[#0b0b0b] p-5 transition-colors hover:border-[#39FF14]/30">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#39FF14]/10 text-[#39FF14]">
                    {tool.icon}
                  </div>
                  <span className="ml-auto rounded border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
                    {tool.status}
                  </span>
                </div>
                <h2 className="text-lg font-black uppercase tracking-[0.08em] text-white">{tool.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-500">{tool.description}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#39FF14]">
                  Abrir
                  <ExternalLink className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </article>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
