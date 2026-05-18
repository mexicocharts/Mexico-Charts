import { Link } from "wouter";
import { ArrowLeft, BarChart3 } from "lucide-react";
import PageSEO from "@/components/PageSEO";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

export default function NotFound() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[#050505] px-6 text-white">
      <PageSEO
        title="Pagina no encontrada — Mexico Charts"
        description="La pagina solicitada no existe o cambio de lugar. Vuelve al inicio de Mexico Charts, explora artistas o revisa los charts actuales de musica mexicana."
        path="/404"
      />
      <section className="w-full max-w-xl text-center">
        <Link href="/">
          <img
            src={logoUrl}
            alt="Mexico Charts"
            className="mx-auto mb-10 h-10 object-contain opacity-85"
          />
        </Link>

        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background: "rgba(57,255,20,0.08)",
            border: "1px solid rgba(57,255,20,0.18)",
            color: "#39FF14",
          }}
        >
          <BarChart3 className="h-6 w-6" />
        </div>

        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.32em] text-[#39FF14]">
          404
        </p>
        <h1 className="mb-4 text-4xl font-black uppercase tracking-tight md:text-6xl">
          Pagina no encontrada
        </h1>
        <p className="mx-auto mb-8 max-w-md text-sm leading-6 text-zinc-500">
          El enlace que abriste no existe o cambio de lugar. Vuelve al inicio o revisa los charts actuales.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#39FF14] px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            Inicio
          </Link>
          <Link
            href="/charts"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:text-white"
          >
            Ver charts
          </Link>
        </div>
      </section>
    </main>
  );
}
