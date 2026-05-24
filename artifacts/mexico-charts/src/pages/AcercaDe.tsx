import { Link } from "wouter";
import { Home, ChevronRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

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

      <SiteNav />

      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.20)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>Acerca de</span>
      </div>

      <div className="relative z-10 max-w-[860px] mx-auto px-6 lg:px-10 py-20">
        <div className="mb-4">
          <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>Mexico Charts</span>
        </div>
        <h1 className="font-black uppercase leading-[0.88] mb-6"
          style={{ fontSize: "clamp(52px,8vw,108px)", letterSpacing: "-0.04em" }}>
          ACERCA<br />DE
        </h1>
        <p className="text-lg font-medium mb-16 max-w-xl" style={{ color: "rgba(255,255,255,0.38)", letterSpacing: "-0.01em" }}>
          Datos, cultura e impacto de la música mexicana
        </p>

        <div style={{ borderTop: `1px solid rgba(57,255,20,0.12)` }} className="pt-12 space-y-10">
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            Mexico Charts es una plataforma independiente dedicada a documentar el crecimiento, desempeño e impacto de la música mexicana dentro de México y alrededor del mundo.
          </p>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            Nuestro objetivo es reunir listas, rankings, datos de streaming, giras, industria, artistas y tendencias culturales en un solo espacio con una presentación moderna, clara y visualmente premium.
          </p>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            Mexico Charts nace para conectar los números con la cultura. Detrás de cada lista hay canciones, artistas, comunidades, fans y momentos que impulsan la música mexicana todos los días.
          </p>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>Qué cubrimos</h2>
            <ul className="space-y-3">
              {[
                "Listas de plataformas digitales",
                "Artistas mexicanos y de música mexicana",
                "Streaming, audiencia y crecimiento",
                "Giras y presentaciones en vivo",
                "Industria musical mexicana",
                "Tendencias, logros y contexto cultural",
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: G }} />
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>Aviso</h3>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
              Mexico Charts es una plataforma independiente. No estamos afiliados oficialmente con Spotify, YouTube, Apple Music, Deezer, Billboard, IFPI, AMPROFON, Pollstar, Ticketmaster ni con ningún artista, sello discográfico o plataforma mencionada, salvo que se indique lo contrario.
            </p>
          </div>
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
