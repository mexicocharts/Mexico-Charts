import { Link } from "wouter";
import { Home, ChevronRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const EMAIL = "mexicochartsoficial@gmail.com";

export default function Metodologia() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <PageSEO
        title="Metodología — Mexico Charts"
        description="Cómo Mexico Charts recopila, organiza y presenta datos de música, streaming, charts, touring e industria."
        path="/metodologia"
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />

      <SiteNav />

      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.20)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>Metodología</span>
      </div>

      <div className="relative z-10 max-w-[860px] mx-auto px-6 lg:px-10 py-20">
        <div className="mb-4">
          <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>Mexico Charts</span>
        </div>
        <h1 className="font-black uppercase leading-[0.88] mb-6"
          style={{ fontSize: "clamp(52px,8vw,108px)", letterSpacing: "-0.04em" }}>
          METODO<br />LOGÍA
        </h1>
        <p className="text-lg font-medium mb-16 max-w-xl" style={{ color: "rgba(255,255,255,0.38)", letterSpacing: "-0.01em" }}>
          Cómo recopilamos, organizamos y presentamos los datos
        </p>

        <div style={{ borderTop: `1px solid rgba(57,255,20,0.12)` }} className="pt-12 space-y-10">
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            Mexico Charts recopila, organiza y presenta información pública y/o licenciada de distintas fuentes relacionadas con música, streaming, charts, touring e industria.
          </p>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            Nuestros rankings y perfiles pueden incluir datos provenientes de plataformas como Spotify, YouTube, Apple Music, Deezer, Ticketmaster, Pollstar, IFPI, AMPROFON, Chartmetric, Soundcharts, Songstats, Chartmasters u otras fuentes públicas, privadas o editoriales, dependiendo de la disponibilidad y el tipo de sección.
          </p>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>Principios</h2>
            <ul className="space-y-3">
              {[
                "Transparencia de fuente cuando sea posible",
                "Actualización regular de datos",
                "Separación entre charts oficiales, datos agregados y análisis editorial",
                "Corrección de errores cuando sean identificados",
                "Contexto cultural junto a los números",
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: G }} />
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl p-5 mb-2" style={{ background: "rgba(57,255,20,0.04)", border: `1px solid rgba(57,255,20,0.12)` }}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] mb-2" style={{ color: G }}>Importante</h3>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Mexico Charts no inventa cifras. Cuando una cifra es estimada, agregada o editorial, debe indicarse claramente.
            </p>
          </div>

          <div className="space-y-5">
            {[
              {
                title: "Charts",
                body: "Los charts pueden provenir de plataformas públicas o fuentes externas. Cuando un chart pertenece a una plataforma específica, Mexico Charts lo presenta como ranking de esa plataforma y no como ranking propio, salvo que se indique claramente que es una lista editorial o agregada.",
              },
              {
                title: "Artistas",
                body: "La base de datos de artistas se enfoca principalmente en artistas mexicanos y artistas vinculados a la música mexicana. Algunos casos pueden incluir artistas nacidos fuera de México pero culturalmente vinculados al mercado, género o comunidad mexicana.",
              },
              {
                title: "Streaming",
                body: "Las cifras de streaming, oyentes, seguidores o reproducciones pueden cambiar con el tiempo y depender de la disponibilidad de cada plataforma o fuente.",
              },
              {
                title: "Touring",
                body: "Los datos de touring pueden provenir de fuentes oficiales, reportes de la industria, plataformas de venta de boletos o bases de datos especializadas. Cuando los datos sean estimados o incompletos, debe indicarse.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: G }}>Correcciones</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              Si detectas un error, puedes contactarnos en{" "}
              <a href={`mailto:${EMAIL}`} className="hover:underline" style={{ color: G }}>{EMAIL}</a>{" "}
              con la fuente o información correspondiente.
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
