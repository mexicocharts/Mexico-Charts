import { Link } from "wouter";
import { BarChart3, ChevronRight, Disc3, Globe2, Home, Landmark, Radio, ShieldCheck, Sparkles, Users } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const PILLARS = [
  {
    title: "Datos",
    body: "Rankings, señales de streaming, fuentes públicas y lectura editorial para entender movimiento real.",
    icon: BarChart3,
  },
  {
    title: "Cultura",
    body: "Artistas, escenas, géneros, comunidades y momentos que empujan la música mexicana.",
    icon: Sparkles,
  },
  {
    title: "Industria",
    body: "Certificaciones, mercado, giras y contexto para leer el impacto más allá de una lista.",
    icon: Landmark,
  },
] as const;

const COVERAGE = [
  { label: "Listas", detail: "Plataformas digitales", icon: Disc3 },
  { label: "Artistas", detail: "Perfiles y audiencia", icon: Users },
  { label: "Streaming", detail: "Crecimiento y señales", icon: Radio },
  { label: "Industria", detail: "Mercado y contexto", icon: Globe2 },
] as const;

export default function AcercaDe() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <PageSEO
        title="Acerca de Mexico Charts — Datos y cultura de la música mexicana"
        description="Mexico Charts es una plataforma independiente de datos sobre música mexicana, listas, artistas, streaming, industria, certificaciones y giras."
        path="/acerca-de"
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
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>Acerca de</span>
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
              Datos con contexto cultural
            </h1>
            <p className="mt-7 max-w-2xl text-lg font-medium leading-8 sm:text-xl" style={{ color: "rgba(255,255,255,0.52)" }}>
              Mexico Charts documenta el crecimiento, desempeño e impacto de la música mexicana dentro de México y alrededor del mundo.
            </p>
          </div>

          <div
            className="rounded-3xl p-6"
            style={{ background: "linear-gradient(160deg,rgba(57,255,20,0.075),rgba(255,255,255,0.028) 45%,rgba(0,0,0,0.24))", border: "1px solid rgba(57,255,20,0.16)" }}
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(57,255,20,0.10)", color: G }}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">Independiente</h2>
            <p className="mt-4 text-sm font-medium leading-7 text-zinc-500">
              No somos una lista oficial de una plataforma. Reunimos señales disponibles y criterio editorial para hacer más legible el momento de la música mexicana.
            </p>
          </div>
        </section>

        <section className="mt-16 grid gap-3 md:grid-cols-3">
          {PILLARS.map(({ title, body, icon: Icon }) => (
            <article
              key={title}
              className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.075)" }}
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(57,255,20,0.08)", color: G }}>
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: G }}>{title}</h2>
              <p className="mt-3 text-sm font-medium leading-6" style={{ color: "rgba(255,255,255,0.48)" }}>{body}</p>
            </article>
          ))}
        </section>

        <section className="mt-14 grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.22em]" style={{ color: G }}>Qué cubrimos</h2>
            <p className="mt-4 text-sm font-medium leading-7 text-zinc-500">
              Listas, artistas, streaming, giras, industria y tendencias culturales en un solo espacio diseñado para lectura rápida.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {COVERAGE.map(({ label, detail, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-4 rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.026)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.045)", color: "rgba(255,255,255,0.62)" }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-black uppercase tracking-[0.1em] text-white">{label}</span>
                  <span className="mt-1 block text-xs font-medium text-zinc-600">{detail}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="mt-14 rounded-2xl p-5 sm:p-6"
          style={{ background: "rgba(255,255,255,0.026)", border: "1px solid rgba(255,255,255,0.075)" }}
        >
          <h2 className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.38)" }}>Aviso independiente</h2>
          <p className="mt-3 text-xs font-medium leading-6" style={{ color: "rgba(255,255,255,0.36)" }}>
            Mexico Charts es una plataforma independiente. No estamos afiliados oficialmente con Spotify, YouTube, Apple Music, Deezer, Billboard, IFPI, AMPROFON, Pollstar, Ticketmaster ni con ningún artista, sello discográfico o plataforma mencionada, salvo que se indique lo contrario.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/mx100"
            className="inline-flex items-center justify-center rounded-full px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-black"
            style={{ background: G }}
          >
            Explorar MX100
          </Link>
          <Link
            href="/charts"
            className="inline-flex items-center justify-center rounded-full border border-white/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:text-white"
          >
            Ver listas
          </Link>
        </div>
      </div>

      <footer className="border-t py-8 px-6 lg:px-10 text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
          Mexico Charts © 2026 — Plataforma independiente de datos, cultura e impacto de la música mexicana
        </p>
      </footer>
    </div>
  );
}
