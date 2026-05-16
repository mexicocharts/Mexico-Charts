import { Link } from "wouter";
import { Home, ChevronRight, Mail, Instagram, Globe } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { CONTACT_EMAIL, SITE_DOMAIN, SITE_URL, SOCIAL_HANDLE, SOCIAL_URLS } from "@/config/brand";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function Contacto() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <PageSEO
        title="Contacto — Mexico Charts"
        description="Para colaboraciones, correcciones, prensa y oportunidades con Mexico Charts."
        path="/contacto"
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />

      <SiteNav />

      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.20)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>Contacto</span>
      </div>

      <div className="relative z-10 max-w-[860px] mx-auto px-6 lg:px-10 py-20">
        <div className="mb-4">
          <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>Mexico Charts</span>
        </div>
        <h1 className="font-black uppercase leading-[0.88] mb-6"
          style={{ fontSize: "clamp(52px,8vw,108px)", letterSpacing: "-0.04em" }}>
          CONTACTO
        </h1>
        <p className="text-lg font-medium mb-16 max-w-xl" style={{ color: "rgba(255,255,255,0.38)", letterSpacing: "-0.01em" }}>
          Para colaboraciones, correcciones, prensa y oportunidades
        </p>

        <div style={{ borderTop: `1px solid rgba(57,255,20,0.12)` }} className="pt-12 space-y-10">
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            Para consultas relacionadas con Mexico Charts, colaboraciones, correcciones de datos, propuestas editoriales, prensa, publicidad o alianzas, puedes contactarnos a través de:
          </p>

          <div className="space-y-4">
            <a href={`mailto:${CONTACT_EMAIL}`}
              className="flex items-center gap-4 rounded-xl p-5 group transition-all duration-200"
              style={{ background: "rgba(57,255,20,0.05)", border: `1px solid rgba(57,255,20,0.18)` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(57,255,20,0.1)" }}>
                <Mail className="w-4 h-4" style={{ color: G }} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Email</div>
                <div className="text-sm font-bold group-hover:underline" style={{ color: G }}>{CONTACT_EMAIL}</div>
              </div>
            </a>
            <a href={SOCIAL_URLS.instagram}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 rounded-xl p-5 group transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <Instagram className="w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Instagram</div>
                <div className="text-sm font-bold group-hover:underline" style={{ color: "rgba(255,255,255,0.7)" }}>{SOCIAL_HANDLE}</div>
              </div>
            </a>
            <a href={SITE_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 rounded-xl p-5 group transition-all duration-200"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <Globe className="w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Website</div>
                <div className="text-sm font-bold group-hover:underline" style={{ color: "rgba(255,255,255,0.7)" }}>{SITE_DOMAIN}</div>
              </div>
            </a>
          </div>

          <div className="space-y-6 pt-4">
            {[
              {
                title: "Correcciones de datos",
                body: "Si detectas un error en un chart, perfil de artista, cifra o fuente, envíanos el enlace y la información correcta para revisarlo.",
              },
              {
                title: "Colaboraciones",
                body: "Estamos abiertos a colaboraciones con comunidades de fans, plataformas musicales, creadores, medios, artistas emergentes y proyectos relacionados con la música mexicana.",
              },
              {
                title: "Prensa y publicidad",
                body: "Para oportunidades de prensa, patrocinios o integración de marca, escríbenos con detalles de la propuesta.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: G }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{body}</p>
              </div>
            ))}
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
