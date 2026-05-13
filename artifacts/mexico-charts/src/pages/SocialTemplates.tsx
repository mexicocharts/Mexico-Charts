import { useState, useRef, useCallback, useEffect } from "react";
import ReactDOM from "react-dom";
import { Link } from "wouter";
import { ArrowLeft, ChevronRight, Download, Loader2, AlertCircle } from "lucide-react";
import { toPng } from "html-to-image";
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

const PREVIEW_SCALE = 0.30;
const PW = Math.round(1080 * PREVIEW_SCALE);
const PH = Math.round(1350 * PREVIEW_SCALE);

const LIGHT_SCALE = 0.56;
const LW = Math.round(1080 * LIGHT_SCALE);
const LH = Math.round(1350 * LIGHT_SCALE);

/* ── Editable field definition ───────────────────────────────── */
interface EditableField {
  key: string;
  label: string;
  type: "text" | "textarea";
}

/* ── Template config ─────────────────────────────────────────── */
interface TemplateConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  Component: React.ComponentType<any>;
  defaultProps: Record<string, any>;
  fields: EditableField[];
  staticData?: boolean; // true = chart data can't be edited here
}

const TEMPLATES: TemplateConfig[] = [
  {
    id: "daily-top-songs",
    name: "Top Canciones Diarias",
    category: "Charts Diarios",
    description: "Lista diaria Top 10 canciones con streams, movimiento y plataforma",
    Component: DailyTopSongs,
    defaultProps: {},
    fields: [],
    staticData: true,
  },
  {
    id: "daily-top-artists",
    name: "Top Artistas Diarios",
    category: "Charts Diarios",
    description: "Ranking diario de artistas con oyentes mensuales y movimiento",
    Component: DailyTopArtists,
    defaultProps: {},
    fields: [],
    staticData: true,
  },
  {
    id: "weekly-top-songs",
    name: "Top Canciones Semanales",
    category: "Charts Semanales",
    description: "Chart semanal editorial con Top 3 destacado, pico y semanas en lista",
    Component: WeeklyTopSongs,
    defaultProps: {},
    fields: [],
    staticData: true,
  },
  {
    id: "weekly-top-albums",
    name: "Top Álbumes Semanales",
    category: "Charts Semanales",
    description: "Top 5 álbumes con portada cinematográfica, streams y semanas",
    Component: WeeklyTopAlbums,
    defaultProps: {},
    fields: [],
    staticData: true,
  },
  {
    id: "viral-songs",
    name: "Viral México",
    category: "Tendencias",
    description: "Canciones en tendencia con porcentaje de crecimiento viral",
    Component: ViralSongs,
    defaultProps: {},
    fields: [],
    staticData: true,
  },
  {
    id: "artist-milestone",
    name: "Hito de Artista",
    category: "Logros",
    description: "Récord o logro con número dramático, titular y stat de soporte",
    Component: ArtistMilestone,
    defaultProps: {
      artistName: "Peso Pluma",
      milestoneValue: "10B",
      milestoneLabel: "Streams en Spotify",
      headline: "supera los 10 mil millones\nde streams en Spotify",
      supportingStat: "Primer artista regional mexicano en alcanzar este hito · 38 países en el Top 50",
      source: "Spotify",
      date: "Mayo 2026",
    },
    fields: [
      { key: "artistName",     label: "Nombre del artista",  type: "text" },
      { key: "milestoneValue", label: "Valor del hito",       type: "text" },
      { key: "milestoneLabel", label: "Etiqueta del hito",    type: "text" },
      { key: "headline",       label: "Titular (usa \\n para salto de línea)", type: "textarea" },
      { key: "supportingStat", label: "Stat de soporte",      type: "textarea" },
      { key: "source",         label: "Fuente",               type: "text" },
      { key: "date",           label: "Fecha",                type: "text" },
    ],
  },
  {
    id: "industry-insight",
    name: "Análisis de Industria",
    category: "Industria",
    description: "Post editorial de reporte con gran stat, titular y bullets de contexto",
    Component: IndustryInsight,
    defaultProps: {
      headline: "México entra al Top 10 de mercados de streaming global",
      statValue: "#7",
      statLabel: "Mercado global de streaming",
      body: "Por primera vez en la historia, México ocupa un lugar entre los diez mayores mercados de consumo musical digital del mundo, con un crecimiento interanual del 34% en ingresos por streaming.",
      context: [
        "34% de crecimiento interanual en ingresos",
        "Corridos Tumbados lidera el consumo local y global",
        "Más de 80M de usuarios activos de streaming",
        "Exportación cultural hacia EUA, España y Latinoamérica",
      ],
      source: "IFPI Global Music Report",
      date: "2026",
    },
    fields: [
      { key: "statValue",  label: "Stat grande",   type: "text" },
      { key: "statLabel",  label: "Etiqueta stat",  type: "text" },
      { key: "headline",   label: "Titular",         type: "textarea" },
      { key: "body",       label: "Párrafo cuerpo",  type: "textarea" },
      { key: "source",     label: "Fuente",          type: "text" },
      { key: "date",       label: "Fecha / año",     type: "text" },
    ],
  },
  {
    id: "touring-data",
    name: "Datos de Touring",
    category: "Industria",
    description: "Recaudación de gira con gross, boletos, shows y gross promedio",
    Component: TouringData,
    defaultProps: {
      tourName: "Éxodo Tour",
      artist: "Peso Pluma",
      grossValue: "$82M USD",
      grossLabel: "Recaudación total estimada",
      tickets: "780K",
      shows: "62",
      avgGross: "$1.3M",
      cities: "38",
      dateRange: "2025–2026",
      source: "Pollstar · México Charts",
    },
    fields: [
      { key: "tourName",   label: "Nombre de la gira", type: "text" },
      { key: "artist",     label: "Artista",            type: "text" },
      { key: "grossValue", label: "Gross total",        type: "text" },
      { key: "grossLabel", label: "Etiqueta gross",     type: "text" },
      { key: "tickets",    label: "Boletos vendidos",   type: "text" },
      { key: "shows",      label: "Shows",              type: "text" },
      { key: "avgGross",   label: "Gross promedio",     type: "text" },
      { key: "cities",     label: "Ciudades",           type: "text" },
      { key: "dateRange",  label: "Rango de fechas",    type: "text" },
      { key: "source",     label: "Fuente",             type: "text" },
    ],
  },
  {
    id: "quote-headline",
    name: "Titular / Quote",
    category: "Contenido Editorial",
    description: "Tipografía gigante para declaraciones, anuncios y captions de impacto",
    Component: QuoteHeadline,
    defaultProps: {
      line1: "MÉXICO",
      line2: "DOMINA",
      line3: "LOS CHARTS",
      subtext: "La música mexicana encabeza las listas globales por tercer mes consecutivo",
      context: "Mayo 2026",
    },
    fields: [
      { key: "line1",   label: "Línea 1 (blanco)",          type: "text" },
      { key: "line2",   label: "Línea 2 (verde — grande)",   type: "text" },
      { key: "line3",   label: "Línea 3 (gris)",            type: "text" },
      { key: "subtext", label: "Subtexto",                   type: "textarea" },
      { key: "context", label: "Contexto / fecha",           type: "text" },
    ],
  },
  {
    id: "carousel-cover",
    name: "Portada de Carrusel",
    category: "Carrusel",
    description: "Slide de apertura cinematográfico con llamado a deslizar",
    Component: CarouselCover,
    defaultProps: {
      title: "LOS DATOS QUE NADIE\nESTÁ VIENDO",
      subtitle: "Charts · Streaming · Industria",
      edition: "Edición Semanal",
      date: "13 Mayo 2026",
      source: "Spotify · IFPI · Pollstar",
    },
    fields: [
      { key: "title",    label: "Título (usa \\n para segunda línea)", type: "textarea" },
      { key: "subtitle", label: "Subtítulo (debajo del título)",       type: "text" },
      { key: "edition",  label: "Edición",                             type: "text" },
      { key: "date",     label: "Fecha",                               type: "text" },
      { key: "source",   label: "Fuentes",                             type: "text" },
    ],
  },
  {
    id: "carousel-data-slide",
    name: "Slide de Datos (Carrusel)",
    category: "Carrusel",
    description: "Slide de datos reutilizable con stat grande, titular y bullets",
    Component: CarouselDataSlide,
    defaultProps: {
      slideNumber: 2,
      totalSlides: 8,
      heading: "Corridos Tumbados conquista el mundo",
      subheading: "El género más exportado de México en 2025–2026",
      bigStat: "310%",
      bigStatLabel: "Crecimiento global en 3 años",
      source: "Spotify · Billboard",
      date: "2026",
    },
    fields: [
      { key: "bigStat",      label: "Stat grande",                type: "text" },
      { key: "bigStatLabel", label: "Etiqueta del stat",          type: "text" },
      { key: "heading",      label: "Titular",                     type: "textarea" },
      { key: "subheading",   label: "Subtítulo",                   type: "text" },
      { key: "source",       label: "Fuente",                      type: "text" },
      { key: "date",         label: "Fecha / año",                 type: "text" },
    ],
  },
  {
    id: "final-cta",
    name: "CTA Final",
    category: "Carrusel",
    description: "Slide de cierre con taglines de marca, handle y sitio web",
    Component: FinalCTA,
    defaultProps: {
      tagline1: "Datos",
      tagline2: "Cultura",
      tagline3: "Impacto",
      handle: "@mexicocharts",
      website: "mexicochart.com",
      date: "México Charts · 2026",
    },
    fields: [
      { key: "tagline1", label: "Tagline 1 (blanco)",  type: "text" },
      { key: "tagline2", label: "Tagline 2 (verde)",   type: "text" },
      { key: "tagline3", label: "Tagline 3 (gris)",    type: "text" },
      { key: "handle",   label: "Handle de Instagram", type: "text" },
      { key: "website",  label: "Sitio web",           type: "text" },
      { key: "date",     label: "Línea de fecha",      type: "text" },
    ],
  },
];

const CATEGORIES = ["Todos", ...Array.from(new Set(TEMPLATES.map(t => t.category)))];

/* ── Scaled preview wrapper ──────────────────────────────────── */
function ScaledPreview({ children, scale, width, height }: {
  children: React.ReactNode;
  scale: number;
  width: number;
  height: number;
}) {
  return (
    <div style={{ width, height, position: "relative", overflow: "hidden", flexShrink: 0 }}>
      <div style={{
        position: "absolute", top: 0, left: 0,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: 1080, height: 1350,
        pointerEvents: "none",
      }}>
        {children}
      </div>
    </div>
  );
}

/* ── Input styles ─────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#fff",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
};

/* ── Blob → data URL ──────────────────────────────────────────── */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ── Inline all <img> srcs as base64 data URLs before toPng ──── */
async function inlineImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll<HTMLImageElement>("img[src]"));
  await Promise.allSettled(
    imgs.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
      try {
        // External CDN URLs (Deezer, Spotify) send Access-Control-Allow-Origin: *
        // so we can fetch them directly from the browser without a proxy.
        // Same-origin paths (logo, etc.) are fetched directly too.
        const fetchInit: RequestInit = src.startsWith("http")
          ? { mode: "cors", cache: "no-cache" }
          : { cache: "no-cache" };
        const res = await fetch(src, fetchInit);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        img.setAttribute("src", dataUrl);
      } catch {
        // If direct fetch failed (rare — some CDNs restrict fetch even with CORS header),
        // fall back to server-side proxy which fetches and returns same-origin.
        if (src.startsWith("http")) {
          try {
            const res = await fetch(`/api/image-proxy?url=${encodeURIComponent(src)}`, { cache: "no-cache" });
            if (!res.ok) return;
            const blob = await res.blob();
            img.setAttribute("src", await blobToDataUrl(blob));
          } catch { /* leave placeholder */ }
        }
      }
    })
  );
  // Allow browser to apply new src values before toPng serialises the DOM
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

/* ── Download helper ─────────────────────────────────────────── */
async function captureAndDownload(el: HTMLElement, filename: string): Promise<void> {
  // Wait for fonts to be fully loaded
  await document.fonts.ready;
  // Fetch every <img> via our proxy and replace src with base64 data URLs.
  // This guarantees html-to-image sees only same-origin data: URLs and never
  // needs to make any external CDN fetch (which would be blocked by CORS).
  await inlineImages(el);

  const dataUrl = await toPng(el, {
    width: 1080,
    height: 1350,
    pixelRatio: 1,
    backgroundColor: "#050505",
    skipFonts: false,
  });

  if (!dataUrl || dataUrl === "data:,") {
    throw new Error("toPng returned empty data URL");
  }

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/* ── Lightbox ─────────────────────────────────────────────────── */
function Lightbox({
  config,
  onClose,
}: {
  config: TemplateConfig;
  onClose: () => void;
}) {
  const { Component, defaultProps, fields, staticData } = config;
  const [values, setValues] = useState<Record<string, any>>({ ...defaultProps });
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  // Create a stable portal container div and append it to document.body.
  // Using useState initializer so it's created exactly once per Lightbox mount.
  // This keeps the full-size capture canvas in body (no overflow:hidden ancestor)
  // without any manual DOM reparenting during download.
  const [portalEl] = useState<HTMLDivElement>(() => {
    const div = document.createElement("div");
    div.style.cssText =
      "position:fixed;top:-9999px;left:0;width:1080px;height:1350px;" +
      "pointer-events:none;overflow:visible;z-index:-1;";
    return div;
  });
  useEffect(() => {
    document.body.appendChild(portalEl);
    return () => { document.body.removeChild(portalEl); };
  }, [portalEl]);

  const handleChange = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleDownload = useCallback(async () => {
    if (!captureRef.current || downloading) return;
    setDownloading(true);
    setExportError(null);
    try {
      await captureAndDownload(captureRef.current, `${config.id}-mexicocharts.png`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[export] PNG generation failed:", msg, e);
      setExportError(`Error al generar el PNG: ${msg}`);
    }
    setDownloading(false);
  }, [config.id, downloading]);

  const hasFields = fields.length > 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.94)",
        backdropFilter: "blur(24px)",
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
      }}
      onClick={onClose}
    >
      {/* Full-size capture canvas rendered via React Portal into document.body.
          This keeps it outside any overflow:hidden ancestor so html-to-image
          can serialize the full 1080×1350 element without clipping.
          React owns the node properly — no manual DOM reparenting needed. */}
      {ReactDOM.createPortal(
        <div ref={captureRef} style={{ width: 1080, height: 1350 }}>
          <Component {...values} />
        </div>,
        portalEl
      )}

      {/* Main panel */}
      <div
        style={{
          display: "flex", width: "100%", height: "100%",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Left: preview */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: "32px 40px",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ width: "100%", maxWidth: LW, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 4 }}>
                {config.category}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.01em" }}>
                {config.name}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.5)",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 12, fontWeight: 800,
                letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Cerrar ✕
            </button>
          </div>

          {/* Preview */}
          <div style={{
            borderRadius: 12, overflow: "hidden",
            boxShadow: `0 32px 100px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07)`,
          }}>
            <ScaledPreview scale={LIGHT_SCALE} width={LW} height={LH}>
              <Component {...values} />
            </ScaledPreview>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 36px",
              borderRadius: 40,
              background: downloading ? "rgba(57,255,20,0.3)" : ACCENT,
              color: "#000",
              fontSize: 14, fontWeight: 900,
              letterSpacing: "0.1em", textTransform: "uppercase",
              cursor: downloading ? "wait" : "pointer",
              border: "none",
              boxShadow: `0 0 40px ${ACCENT}40`,
              transition: "all 0.15s",
            }}
          >
            {downloading
              ? <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Generando PNG...</>
              : <><Download style={{ width: 16, height: 16 }} /> Descargar PNG · 1080×1350</>
            }
          </button>

          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Instagram 4:5 · listo para publicar
          </div>

          {exportError && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              maxWidth: LW,
              padding: "12px 16px",
              borderRadius: 8,
              background: "rgba(255,60,60,0.08)",
              border: "1px solid rgba(255,60,60,0.2)",
            }}>
              <AlertCircle style={{ width: 16, height: 16, color: "#ff4444", flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: "rgba(255,100,100,0.9)", lineHeight: 1.5, wordBreak: "break-word" }}>
                {exportError}
              </div>
            </div>
          )}
        </div>

        {/* Right: editor panel */}
        {hasFields ? (
          <div style={{
            width: 360,
            flexShrink: 0,
            background: "#080808",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}>
            {/* Editor header */}
            <div style={{
              padding: "24px 28px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 6 }}>
                Personalizar
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                Edita los campos y el preview se actualiza en tiempo real
              </div>
            </div>

            {/* Fields */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "20px 28px",
              display: "flex", flexDirection: "column", gap: 20,
            }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={{
                    display: "block",
                    fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.38)",
                    letterSpacing: "0.14em", textTransform: "uppercase",
                    marginBottom: 8,
                  }}>
                    {f.label}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      value={typeof values[f.key] === "string" ? values[f.key] : ""}
                      onChange={e => handleChange(f.key, e.target.value)}
                      rows={3}
                      style={{ ...inputStyle }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={typeof values[f.key] === "string" ? values[f.key] : ""}
                      onChange={e => handleChange(f.key, e.target.value)}
                      style={{ ...inputStyle }}
                    />
                  )}
                </div>
              ))}

              {/* Reset */}
              <button
                onClick={() => setValues({ ...defaultProps })}
                style={{
                  padding: "10px", borderRadius: 8,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.28)",
                  fontSize: 12, fontWeight: 800,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer", marginTop: 4,
                }}
              >
                Restablecer valores
              </button>
            </div>
          </div>
        ) : staticData ? (
          <div style={{
            width: 320,
            flexShrink: 0,
            background: "#080808",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "40px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>
              Datos del sistema
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.36)", lineHeight: 1.6 }}>
              Este template se conectará a los datos reales de charts de Mexico Charts. Por ahora usa datos de muestra representativos.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ── Main gallery page ────────────────────────────────────────── */
export default function SocialTemplates() {
  const [category, setCategory] = useState("Todos");
  const [lightbox, setLightbox] = useState<TemplateConfig | null>(null);

  const filtered = category === "Todos"
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === category);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        textarea:focus, input:focus { border-color: rgba(57,255,20,0.4) !important; box-shadow: 0 0 0 2px rgba(57,255,20,0.08) !important; }
      `}</style>

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
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "52px 32px 44px", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: ACCENT, letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: 12 }}>
            Sistema de Plantillas
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12, textTransform: "uppercase" }}>
            Social Media <span style={{ color: ACCENT }}>Templates</span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.36)", maxWidth: 560, lineHeight: 1.6, marginBottom: 28 }}>
            12 plantillas premium para Instagram y Facebook. Haz clic en cualquier plantilla para editarla y descargarla como PNG listo para publicar.
          </p>
          <div style={{ display: "flex", gap: 32 }}>
            {[
              { n: "12", label: "Plantillas" },
              { n: "7", label: "Editables" },
              { n: "1080×1350", label: "Resolución" },
              { n: "PNG", label: "Descarga directa" },
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
          {filtered.map((config) => {
            const { Component, defaultProps } = config;
            return (
              <div
                key={config.id}
                onClick={() => setLightbox(config)}
                style={{
                  cursor: "pointer",
                  borderRadius: 16, overflow: "hidden",
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
                <div style={{ background: "#050505", overflow: "hidden" }}>
                  <ScaledPreview scale={PREVIEW_SCALE} width={PW} height={PH}>
                    <Component {...defaultProps} />
                  </ScaledPreview>
                </div>
                <div style={{ padding: "14px 18px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: `${ACCENT}aa`, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>
                    {config.category}
                    {!config.staticData && (
                      <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.22)" }}>· Editable</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
                      {config.name}
                    </div>
                    <ChevronRight style={{ width: 14, height: 14, color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.26)", marginTop: 4, lineHeight: 1.4 }}>
                    {config.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Lightbox */}
      {lightbox && <Lightbox config={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
