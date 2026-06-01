import { Link } from "wouter";
import { ArrowLeft, BarChart3, Disc3, Home, ListMusic, Music2, Radio, Users } from "lucide-react";
import PageSEO from "@/components/PageSEO";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const QUICK_LINKS = [
  { label: "Inicio", href: "/", detail: "Portada", icon: Home },
  { label: "MX100", href: "/mx100", detail: "Ranking editorial", icon: BarChart3 },
  { label: "Listas", href: "/charts", detail: "Charts oficiales", icon: ListMusic },
  { label: "Artistas", href: "/artists", detail: "Directorio", icon: Users },
  { label: "Géneros", href: "/generos", detail: "Mapa musical", icon: Music2 },
  { label: "Giras", href: "/touring", detail: "Shows activos", icon: Radio },
] as const;

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#050505] px-5 py-10 text-white sm:px-6">
      <PageSEO
        title="Página no encontrada — Mexico Charts"
        description="La página solicitada no existe o cambió de lugar. Vuelve al inicio de Mexico Charts, explora artistas o revisa las listas actuales de música mexicana."
        path="/404"
        noindex
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.018]" style={{ backgroundImage: NOISE, backgroundSize: "128px" }} />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(57,255,20,0.12), transparent 68%)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${G}66, transparent)` }} />

      <section className="relative z-10 w-full max-w-5xl">
        <Link href="/" className="mx-auto mb-10 block w-fit">
          <img
            src={logoUrl}
            alt="Mexico Charts"
            className="h-10 object-contain opacity-85"
          />
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div
              className="mb-6 flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: "rgba(57,255,20,0.08)",
                border: "1px solid rgba(57,255,20,0.18)",
                color: G,
              }}
            >
              <Disc3 className="h-6 w-6" />
            </div>

            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: G }}>
              Error 404 · Mexico Charts
            </p>
            <h1 className="max-w-3xl text-[clamp(3.1rem,13vw,8rem)] font-black uppercase leading-[0.82] tracking-normal">
              Página fuera de lista
            </h1>
            <p className="mt-6 max-w-xl text-base font-medium leading-7 text-zinc-500 sm:text-lg">
              Ese enlace no está disponible o cambió de lugar. Puedes volver a una sección principal y seguir explorando música mexicana.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-black"
                style={{ background: G }}
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio
              </Link>
              <Link
                href="/mx100"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:text-white"
              >
                <BarChart3 className="h-4 w-4" />
                Ver MX100
              </Link>
            </div>
          </div>

          <div
            className="rounded-2xl p-3"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="mb-2 px-3 pt-2 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-600">
              Ir a
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {QUICK_LINKS.map(({ label, href, detail, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.045]"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: "rgba(57,255,20,0.075)", color: G }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black uppercase tracking-[0.08em] text-white">{label}</span>
                    <span className="mt-0.5 block text-xs font-medium text-zinc-600">{detail}</span>
                  </span>
                  <span className="ml-auto text-zinc-700 transition-colors group-hover:text-zinc-400">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
