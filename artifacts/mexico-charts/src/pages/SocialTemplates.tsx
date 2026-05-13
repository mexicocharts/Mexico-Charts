import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Download, ChevronRight } from "lucide-react";
import DailyTopSongs from "@/social/templates/DailyTopSongs";
import DailyTopArtists from "@/social/templates/DailyTopArtists";
import WeeklyTopSongs from "@/social/templates/WeeklyTopSongs";
import WeeklyTopAlbums from "@/social/templates/WeeklyTopAlbums";
import ViralSongs from "@/social/templates/ViralSongs";
import ArtistMilestone from "@/social/templates/ArtistMilestone";
import IndustryInsight from "@/social/templates/IndustryInsight";
import TouringData from "@/social/templates/TouringData";
import QuoteHeadline from "@/social/templates/QuoteHeadline";
import CarouselCover from "@/social/templates/CarouselCover";
import CarouselDataSlide from "@/social/templates/CarouselDataSlide";
import FinalCTA from "@/social/templates/FinalCTA";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const ACCENT = "#39FF14";

/* ── Scale constants ─────────────────────────────────────────────
   Templates are 1080 × 1350 internally.
   Gallery preview: 0.30 scale → 324 × 405 px displayed.
   Lightbox (full view): 0.75 scale → 810 × 1012 px.
──────────────────────────────────────────────────────────────── */
const PREVIEW_SCALE = 0.30;
const PW = Math.round(1080 * PREVIEW_SCALE); // 324
const PH = Math.round(1350 * PREVIEW_SCALE); // 405

const LIGHT_SCALE = 0.72;
const LW = Math.round(1080 * LIGHT_SCALE);   // 778
const LH = Math.round(1350 * LIGHT_SCALE);   // 972

interface TemplateEntry {
  id: string;
  name: string;
  category: string;
  description: string;
  component: React.ReactNode;
}

const TEMPLATES: TemplateEntry[] = [
  {
    id: "daily-top-songs",
    name: "Top Canciones Diarias",
    category: "Charts Diarios",
    description: "Lista diaria Top 10 canciones con streams, movimiento y plataforma",
    component: <DailyTopSongs />,
  },
  {
    id: "daily-top-artists",
    name: "Top Artistas Diarios",
    category: "Charts Diarios",
    description: "Ranking diario de artistas con oyentes mensuales y movimiento",
    component: <DailyTopArtists />,
  },
  {
    id: "weekly-top-songs",
    name: "Top Canciones Semanales",
    category: "Charts Semanales",
    description: "Chart semanal editorial con Top 3 destacado, pico y semanas en lista",
    component: <WeeklyTopSongs />,
  },
  {
    id: "weekly-top-albums",
    name: "Top Álbumes Semanales",
    category: "Charts Semanales",
    description: "Top 5 álbumes con portada cinematográfica, streams y semanas",
    component: <WeeklyTopAlbums />,
  },
  {
    id: "viral-songs",
    name: "Viral México",
    category: "Tendencias",
    description: "Canciones en tendencia con porcentaje de crecimiento viral",
    component: <ViralSongs />,
  },
  {
    id: "artist-milestone",
    name: "Hito de Artista",
    category: "Logros",
    description: "Récord o logro con número dramático, titular y stat de soporte",
    component: <ArtistMilestone />,
  },
  {
    id: "industry-insight",
    name: "Análisis de Industria",
    category: "Industria",
    description: "Post editorial de reporte con gran stat, titular y bullets de contexto",
    component: <IndustryInsight />,
  },
  {
    id: "touring-data",
    name: "Datos de Touring",
    category: "Industria",
    description: "Recaudación de gira con gross, boletos, shows y gross promedio",
    component: <TouringData />,
  },
  {
    id: "quote-headline",
    name: "Titular / Quote",
    category: "Contenido Editorial",
    description: "Tipografía gigante para declaraciones, anuncios y captions de impacto",
    component: <QuoteHeadline />,
  },
  {
    id: "carousel-cover",
    name: "Portada de Carrusel",
    category: "Carrusel",
    description: "Slide de apertura cinematográfico con llamado a deslizar",
    component: <CarouselCover />,
  },
  {
    id: "carousel-data-slide",
    name: "Slide de Datos (Carrusel)",
    category: "Carrusel",
    description: "Slide de datos reutilizable con stat grande, titular y bullets",
    component: <CarouselDataSlide />,
  },
  {
    id: "final-cta",
    name: "CTA Final",
    category: "Carrusel",
    description: "Slide de cierre con taglines de marca, handle y sitio web",
    component: <FinalCTA />,
  },
];

const CATEGORIES = ["Todos", ...Array.from(new Set(TEMPLATES.map(t => t.category)))];

/* ── Scaled preview wrapper ───────────────────────────────────── */
function TemplatePreview({ children, scale, width, height }: {
  children: React.ReactNode;
  scale: number;
  width: number;
  height: number;
}) {
  return (
    <div style={{ width, height, position: "relative", overflow: "hidden", flexShrink: 0 }}>
      <div style={{
        position: "absolute",
        top: 0, left: 0,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: 1080,
        height: 1350,
        pointerEvents: "none",
      }}>
        {children}
      </div>
    </div>
  );
}

/* ── Lightbox ─────────────────────────────────────────────────── */
function Lightbox({ entry, onClose }: { entry: TemplateEntry; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)" }}
      onClick={onClose}
    >
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Template name */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
            {entry.category}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.01em" }}>
            {entry.name}
          </div>
        </div>

        {/* Preview */}
        <div style={{
          borderRadius: 12, overflow: "hidden",
          boxShadow: `0 32px 100px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07), 0 0 60px ${ACCENT}10`,
        }}>
          <TemplatePreview scale={LIGHT_SCALE} width={LW} height={LH}>
            {entry.component}
          </TemplatePreview>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px", borderRadius: 40,
              fontSize: 13, fontWeight: 800,
              color: "rgba(255,255,255,0.5)",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
            }}
          >
            Cerrar
          </button>
          <div style={{
            padding: "10px 24px", borderRadius: 40,
            fontSize: 13, fontWeight: 800,
            color: "rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            letterSpacing: "0.1em", textTransform: "uppercase",
          }}>
            1080 × 1350 · 4:5 Instagram
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────── */
export default function SocialTemplates() {
  const [category, setCategory] = useState("Todos");
  const [lightbox, setLightbox] = useState<TemplateEntry | null>(null);

  const filtered = category === "Todos"
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === category);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(5,5,5,0.94)", backdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 20 }}>
          <Link href="/">
            <img src={logoUrl} alt="Mexico Charts" style={{ height: 28, objectFit: "contain", opacity: 0.9 }} />
          </Link>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.12)" }} />
          <Link href="/"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)",
              textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase",
            }}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} />
            Inicio
          </Link>
          <div style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Templates Sociales
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        position: "relative", overflow: "hidden",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, #080808 0%, #050505 100%)",
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse 60% 80% at 50% -10%, ${ACCENT}10 0%, transparent 65%)`,
        }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "56px 32px 48px", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: ACCENT, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>
            Sistema de Plantillas
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12, textTransform: "uppercase" }}>
            Social Media <span style={{ color: ACCENT }}>Templates</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.38)", maxWidth: 560, lineHeight: 1.6, marginBottom: 28 }}>
            12 plantillas premium listas para Instagram y Facebook. Formato 1080 × 1350 px (4:5).
            Haz clic en cualquier plantilla para verla en detalle.
          </p>
          <div style={{ display: "flex", gap: 32 }}>
            {[
              { n: "12", label: "Plantillas" },
              { n: "5", label: "Categorías" },
              { n: "1080×1350", label: "Resolución" },
              { n: "9", label: "Componentes" },
            ].map(({ n, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>{n}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        position: "sticky", top: 56, zIndex: 30,
        background: "rgba(5,5,5,0.96)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px", height: 52, display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
          {CATEGORIES.map(cat => {
            const active = cat === category;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: "6px 18px", borderRadius: 40, whiteSpace: "nowrap",
                  fontSize: 11, fontWeight: 800,
                  textTransform: "uppercase", letterSpacing: "0.1em",
                  cursor: "pointer",
                  background: active ? ACCENT : "rgba(255,255,255,0.04)",
                  color: active ? "#000" : "rgba(255,255,255,0.4)",
                  border: active ? "none" : "1px solid rgba(255,255,255,0.08)",
                  transition: "all 0.15s",
                }}
              >
                {cat}
              </button>
            );
          })}
          <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
            {filtered.length} plantilla{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Grid */}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "40px 32px 80px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${PW}px, 1fr))`,
          gap: 28,
        }}>
          {filtered.map((entry) => (
            <div
              key={entry.id}
              onClick={() => setLightbox(entry)}
              style={{
                cursor: "pointer",
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.07)",
                background: "#0a0a0a",
                transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = `${ACCENT}40`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px ${ACCENT}20`;
                (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.5)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }}
            >
              {/* Preview */}
              <div style={{ background: "#050505", overflow: "hidden" }}>
                <TemplatePreview scale={PREVIEW_SCALE} width={PW} height={PH}>
                  {entry.component}
                </TemplatePreview>
              </div>

              {/* Label */}
              <div style={{ padding: "14px 18px 16px" }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, color: `${ACCENT}aa`,
                  letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4,
                }}>
                  {entry.category}
                </div>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
                    {entry.name}
                  </div>
                  <ChevronRight style={{ width: 14, height: 14, color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", marginTop: 4, lineHeight: 1.4 }}>
                  {entry.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Components reference */}
        <div style={{
          marginTop: 80, padding: "40px",
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: ACCENT, letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 16 }}>
            Componentes Reutilizables
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginBottom: 8 }}>
            Sistema de Diseño
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", maxWidth: 600, lineHeight: 1.6, marginBottom: 28 }}>
            Todos los templates usan componentes compartidos desde{" "}
            <code style={{ color: ACCENT, background: `${ACCENT}12`, padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
              src/social/components.tsx
            </code>{" "}
            — edita ahí para actualizar el sistema completo.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              ["TemplateCanvas", "Base 1080×1350px"],
              ["LogoBar", "Logo + fecha top"],
              ["AccentLine", "Línea divisoria emerald"],
              ["SectionLabel", "Etiqueta eyebrow"],
              ["ChartRow", "Fila de ranking"],
              ["MovementBadge", "▲3 ▼1 NEW —"],
              ["PlatformBadge", "Spotify / YouTube / etc"],
              ["AlbumFrame", "Marco de portada"],
              ["LargeStatNum", "Número grande con glow"],
              ["StatPill", "Píldora de estadística"],
              ["SourceFooter", "Línea de fuente"],
              ["CTAFooter", "Footer con logo + handle"],
            ].map(([name, desc]) => (
              <div key={name} style={{
                padding: "14px 16px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightbox && <Lightbox entry={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
