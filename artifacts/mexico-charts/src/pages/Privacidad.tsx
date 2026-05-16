import { Link } from "wouter";
import { Home, ChevronRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { CONTACT_EMAIL, SITE_DOMAIN } from "@/config/brand";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function Privacidad() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <PageSEO
        title="Privacidad — Mexico Charts"
        description="Cómo Mexico Charts maneja información y uso del sitio."
        path="/privacidad"
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />

      <SiteNav />

      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.20)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>Privacidad</span>
      </div>

      <div className="relative z-10 max-w-[860px] mx-auto px-6 lg:px-10 py-20">
        <div className="mb-4">
          <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>Mexico Charts</span>
        </div>
        <h1 className="font-black uppercase leading-[0.88] mb-6"
          style={{ fontSize: "clamp(52px,8vw,108px)", letterSpacing: "-0.04em" }}>
          PRIVACI<br />DAD
        </h1>
        <p className="text-lg font-medium mb-16 max-w-xl" style={{ color: "rgba(255,255,255,0.38)", letterSpacing: "-0.01em" }}>
          Cómo manejamos información y uso del sitio
        </p>

        <div style={{ borderTop: `1px solid rgba(57,255,20,0.12)` }} className="pt-12 space-y-5">
          <p className="text-base leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.62)" }}>
            Mexico Charts respeta la privacidad de sus usuarios. Esta página explica de forma general cómo puede manejarse la información al visitar {SITE_DOMAIN}.
          </p>

          {[
            {
              title: "Información recopilada",
              body: "Mexico Charts puede recopilar información básica de uso del sitio, como páginas visitadas, dispositivo, navegador, ubicación aproximada, fuente de tráfico y métricas de interacción. Esta información se usa para entender el rendimiento del sitio y mejorar la experiencia del usuario.",
            },
            {
              title: "Cookies y analítica",
              body: "El sitio puede utilizar cookies, herramientas de analítica o servicios de terceros para medir tráfico, rendimiento, errores y comportamiento general de navegación.",
            },
            {
              title: "Servicios de terceros",
              body: "Mexico Charts puede enlazar o integrar contenido de plataformas externas como Spotify, YouTube, Apple Music, Deezer, Instagram, TikTok, X, Ticketmaster u otras. Cada plataforma externa tiene sus propias políticas de privacidad.",
            },
            {
              title: "Datos personales",
              body: "Mexico Charts no vende información personal de usuarios. Si una persona nos contacta por email o redes sociales, la información compartida se usará únicamente para responder o gestionar la consulta.",
            },
            {
              title: "Publicidad",
              body: "En el futuro, Mexico Charts podría utilizar publicidad, patrocinios o herramientas de monetización. Si se implementan, esta página deberá actualizarse.",
            },
            {
              title: "Cambios",
              body: "Esta política puede actualizarse conforme el sitio evolucione.",
            },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{body}</p>
            </div>
          ))}

          <div className="rounded-xl p-6" style={{ background: "rgba(57,255,20,0.04)", border: `1px solid rgba(57,255,20,0.12)` }}>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: G }}>Contacto</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Para dudas relacionadas con privacidad:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline" style={{ color: G }}>{CONTACT_EMAIL}</a>
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
