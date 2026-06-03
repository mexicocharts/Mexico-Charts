import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Copy, Download, Loader2, RefreshCw } from "lucide-react";
import { toPng } from "html-to-image";
import html2canvas from "html2canvas";
import DailyTopSongs from "@/social/templates/DailyTopSongs";
import DailyTopArtists from "@/social/templates/DailyTopArtists";
import WeeklyTopSongs from "@/social/templates/WeeklyTopSongs";
import WeeklyTopAlbums from "@/social/templates/WeeklyTopAlbums";
import ViralSongs from "@/social/templates/ViralSongs";
import AnimatedTopArtists from "@/social/templates/AnimatedTopArtists";
import AnimatedTopSongs from "@/social/templates/AnimatedTopSongs";
import AnimatedTopAlbums from "@/social/templates/AnimatedTopAlbums";
import PageSEO from "@/components/PageSEO";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const ACCESS_CODE = (import.meta.env.VITE_SOCIAL_TEMPLATES_ACCESS_CODE as string | undefined)?.trim() ?? "";
const ACCESS_STORAGE_KEY = "mexicocharts:social-templates-access";
const CANVAS_W = 1080;
const CANVAS_H = 1350;
const ACCENT = "#39ff14";
const RED = "#ff3b45";
const BLUE = "#34b7ff";
const GOLD = "#ffc857";

type TemplateId =
  | "daily-top-songs"
  | "daily-top-artists"
  | "weekly-top-songs"
  | "weekly-top-albums"
  | "viral-songs"
  | "animated-top-artists"
  | "animated-top-songs"
  | "animated-top-albums"
  | "daily-momentum"
  | "artist-milestone"
  | "chart-top-five"
  | "song-spotlight"
  | "touring-pulse"
  | "industry-brief"
  | "radar-new"
  | "carousel-data";

type FieldType = "text" | "textarea" | "select";

type Field = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
};

type TemplateConfig = {
  id: TemplateId;
  name: string;
  category: string;
  format: string;
  description: string;
  accent: string;
  defaults: Record<string, string>;
  fields: Field[];
  Component?: React.ComponentType;
};

const todayLabel = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date());

const templates: TemplateConfig[] = [
  {
    id: "daily-top-songs",
    name: "Top Canciones Diarias",
    category: "Listas",
    format: "Live list · Spotify",
    description: "Lista diaria con covers de canciones, streams y movimiento.",
    accent: ACCENT,
    defaults: {},
    fields: [],
    Component: DailyTopSongs,
  },
  {
    id: "daily-top-artists",
    name: "Top Artistas Diarios",
    category: "Listas",
    format: "Live list · Spotify",
    description: "Lista diaria con fotos de artistas, racha y pico.",
    accent: ACCENT,
    defaults: {},
    fields: [],
    Component: DailyTopArtists,
  },
  {
    id: "weekly-top-songs",
    name: "Top Canciones Semanales",
    category: "Listas",
    format: "Live list · Spotify",
    description: "Lista semanal con canciones, streams y movimiento.",
    accent: ACCENT,
    defaults: {},
    fields: [],
    Component: WeeklyTopSongs,
  },
  {
    id: "weekly-top-albums",
    name: "Top Albumes Semanales",
    category: "Listas",
    format: "Live list · Apple Music",
    description: "Lista semanal con artwork/miniaturas de albumes.",
    accent: ACCENT,
    defaults: {},
    fields: [],
    Component: WeeklyTopAlbums,
  },
  {
    id: "viral-songs",
    name: "Viral Mexico",
    category: "Listas",
    format: "Live list · Tendencias",
    description: "Lista de canciones virales con portada y crecimiento.",
    accent: RED,
    defaults: {},
    fields: [],
    Component: ViralSongs,
  },
  {
    id: "animated-top-artists",
    name: "Top Artistas Animado",
    category: "Listas",
    format: "Animated list",
    description: "Lista animada de artistas para Reels o Stories.",
    accent: ACCENT,
    defaults: {},
    fields: [],
    Component: AnimatedTopArtists,
  },
  {
    id: "animated-top-songs",
    name: "Top Canciones Animado",
    category: "Listas",
    format: "Animated list",
    description: "Lista animada de canciones para Reels o Stories.",
    accent: ACCENT,
    defaults: {},
    fields: [],
    Component: AnimatedTopSongs,
  },
  {
    id: "animated-top-albums",
    name: "Top Albumes Animado",
    category: "Listas",
    format: "Animated list",
    description: "Lista animada de albumes para Reels o Stories.",
    accent: ACCENT,
    defaults: {},
    fields: [],
    Component: AnimatedTopAlbums,
  },
  {
    id: "daily-momentum",
    name: "Daily Momentum",
    category: "Momentum",
    format: "Instagram 4:5",
    description: "Daily YouTube + Spotify movement for an artist profile.",
    accent: ACCENT,
    defaults: {
      eyebrow: "MOMENTUM DIARIO",
      title: "PESO PLUMA",
      subtitle: "YouTube + Spotify medidos hoy",
      primaryValue: "+8.2M",
      primaryLabel: "views en YouTube",
      secondaryValue: "+20.2M",
      secondaryLabel: "streams en Spotify",
      trend: "7-day average: +7.8M views · biggest spike this week",
      footer: `Mexico Charts · ${todayLabel}`,
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Artist", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "primaryValue", label: "Primary value", type: "text" },
      { key: "primaryLabel", label: "Primary label", type: "text" },
      { key: "secondaryValue", label: "Secondary value", type: "text" },
      { key: "secondaryLabel", label: "Secondary label", type: "text" },
      { key: "trend", label: "Trend line", type: "textarea" },
      { key: "footer", label: "Footer", type: "text" },
    ],
  },
  {
    id: "artist-milestone",
    name: "Artist Milestone",
    category: "Artist",
    format: "Instagram 4:5",
    description: "Big achievement card for stream, chart, or touring milestones.",
    accent: GOLD,
    defaults: {
      eyebrow: "HITO DE ARTISTA",
      title: "FUERZA REGIDA",
      stat: "26.3B",
      statLabel: "streams historicos en Spotify",
      headline: "uno de los actos mexicanos mas grandes del streaming global",
      detail: "Momentum diario, catalogo y actividad de charts actualizados por Mexico Charts.",
      footer: `Mexico Charts · ${todayLabel}`,
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Artist", type: "text" },
      { key: "stat", label: "Big stat", type: "text" },
      { key: "statLabel", label: "Stat label", type: "text" },
      { key: "headline", label: "Headline", type: "textarea" },
      { key: "detail", label: "Detail", type: "textarea" },
      { key: "footer", label: "Footer", type: "text" },
    ],
  },
  {
    id: "chart-top-five",
    name: "Chart Top 5",
    category: "Charts",
    format: "Instagram 4:5",
    description: "Clean ranked card for songs, artists, videos, or albums.",
    accent: ACCENT,
    defaults: {
      eyebrow: "MX100 · TOP 5",
      title: "CANCIONES MAS FUERTES",
      subtitle: "Semana actual en Mexico",
      rows: "1. Fuerza Regida — Me jalo\n2. Peso Pluma — La patrulla\n3. Junior H — Extssy\n4. Tito Double P — Linda\n5. Grupo Frontera — Angel",
      footer: "Mexico Charts · Ranking editorial basado en rendimiento de plataformas",
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "rows", label: "Rows, one per line", type: "textarea" },
      { key: "footer", label: "Footer", type: "textarea" },
    ],
  },
  {
    id: "song-spotlight",
    name: "Song Spotlight",
    category: "Songs",
    format: "Instagram 4:5",
    description: "Single-song post with rank, movement, and quick context.",
    accent: RED,
    defaults: {
      eyebrow: "SONG SPOTLIGHT",
      title: "LA PATRULLA",
      subtitle: "Peso Pluma x Neton Vega",
      stat: "#1",
      statLabel: "en YouTube Mexico",
      note: "El tema lidera el consumo diario y mantiene crecimiento fuerte en video oficial.",
      footer: `Mexico Charts · ${todayLabel}`,
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Song", type: "text" },
      { key: "subtitle", label: "Artist", type: "text" },
      { key: "stat", label: "Stat", type: "text" },
      { key: "statLabel", label: "Stat label", type: "text" },
      { key: "note", label: "Note", type: "textarea" },
      { key: "footer", label: "Footer", type: "text" },
    ],
  },
  {
    id: "touring-pulse",
    name: "Touring Pulse",
    category: "Touring",
    format: "Instagram 4:5",
    description: "Touring profile card for show counts, gross, or market movement.",
    accent: BLUE,
    defaults: {
      eyebrow: "TOURING PULSE",
      title: "LUIS MIGUEL",
      subtitle: "Actividad de gira",
      metricOne: "288",
      metricOneLabel: "shows registrados",
      metricTwo: "$400M+",
      metricTwoLabel: "recaudacion estimada",
      insight: "La gira conserva una de las huellas mas grandes del mercado latino.",
      footer: "Mexico Charts · Touring data",
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Artist", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "metricOne", label: "Metric 1", type: "text" },
      { key: "metricOneLabel", label: "Metric 1 label", type: "text" },
      { key: "metricTwo", label: "Metric 2", type: "text" },
      { key: "metricTwoLabel", label: "Metric 2 label", type: "text" },
      { key: "insight", label: "Insight", type: "textarea" },
      { key: "footer", label: "Footer", type: "text" },
    ],
  },
  {
    id: "industry-brief",
    name: "Industry Brief",
    category: "Industry",
    format: "Instagram 4:5",
    description: "Premium editorial card for market notes and reports.",
    accent: ACCENT,
    defaults: {
      eyebrow: "INDUSTRY BRIEF",
      title: "MEXICO SIGUE GANANDO PESO GLOBAL",
      subtitle: "Streaming, touring y exportacion cultural empujan el mercado.",
      bullets: "Streaming diario medido por plataforma\nCharts y consumo local conectados\nTouring como segunda lectura de impacto",
      footer: `Mexico Charts · ${todayLabel}`,
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "textarea" },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      { key: "bullets", label: "Bullets, one per line", type: "textarea" },
      { key: "footer", label: "Footer", type: "text" },
    ],
  },
  {
    id: "radar-new",
    name: "Radar Nuevos",
    category: "Radar",
    format: "Instagram 4:5",
    description: "New and emerging artist ranking card.",
    accent: GOLD,
    defaults: {
      eyebrow: "RADAR NUEVOS",
      title: "ARTISTA EMERGENTE",
      subtitle: "Basado en exito dentro del universo nuevo y emergente",
      rows: "1. Neton Vega\n2. Tito Double P\n3. Gabito Ballesteros\n4. Oscar Maydon\n5. Chino Pacas",
      footer: "Ranking por rendimiento: Spotify, YouTube, charts, social y fanbase reach.",
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      { key: "rows", label: "Rows, one per line", type: "textarea" },
      { key: "footer", label: "Footer", type: "textarea" },
    ],
  },
  {
    id: "carousel-data",
    name: "Carousel Data Slide",
    category: "Carousel",
    format: "Instagram 4:5",
    description: "Reusable slide for a stat, short story, and supporting data.",
    accent: BLUE,
    defaults: {
      eyebrow: "SLIDE 02 / 06",
      title: "LA HISTORIA ESTA EN EL MOVIMIENTO DIARIO",
      stat: "610.9M",
      statLabel: "streams diarios medidos hoy",
      body: "Los catalogos fuertes ya no solo se leen por total historico. La senal real esta en cuanto se mueve cada dia.",
      footer: "Mexico Charts · Daily momentum",
    },
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "title", label: "Title", type: "textarea" },
      { key: "stat", label: "Stat", type: "text" },
      { key: "statLabel", label: "Stat label", type: "text" },
      { key: "body", label: "Body", type: "textarea" },
      { key: "footer", label: "Footer", type: "text" },
    ],
  },
];

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 12 : 16 }}>
      <img
        src={logoUrl}
        alt="Mexico Charts"
        crossOrigin="anonymous"
        style={{
          height: compact ? 30 : 42,
          width: "auto",
          maxWidth: compact ? 150 : 210,
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

function CanvasShell({
  config,
  values,
  children,
}: {
  config: TemplateConfig;
  values: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <div
      data-social-export-canvas
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, #050505 0%, #090909 46%, #050505 100%)",
        color: "#fff",
        fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            `radial-gradient(circle at 76% 8%, ${config.accent}26 0, transparent 36%), ` +
            "radial-gradient(circle at 18% 72%, rgba(255,255,255,0.08) 0, transparent 32%), " +
            "linear-gradient(135deg, rgba(255,255,255,0.08) 0 1px, transparent 1px)",
          backgroundSize: "auto, auto, 42px 42px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.66) 0%, transparent 52%, rgba(0,0,0,0.54) 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 2,
        }}
      >
        <BrandMark />
        <div
          style={{
            color: config.accent,
            fontSize: 14,
            fontWeight: 1000,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            textAlign: "right",
          }}
        >
          {values.eyebrow}
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>
        {children}
      </div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 54,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          zIndex: 2,
          color: "rgba(255,255,255,0.52)",
          fontSize: 18,
          fontWeight: 800,
          lineHeight: 1.25,
        }}
      >
        <div style={{ maxWidth: 720 }}>{values.footer}</div>
        <div style={{ color: config.accent, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          @mexicocharts
        </div>
      </div>
    </div>
  );
}

function BigStat({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.055)",
        padding: "30px 32px",
        minHeight: 160,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ color: accent, fontSize: 64, fontWeight: 1000, letterSpacing: "-0.06em", lineHeight: 0.9 }}>
        {value}
      </div>
      <div style={{ color: "rgba(255,255,255,0.56)", fontSize: 17, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", lineHeight: 1.2 }}>
        {label}
      </div>
    </div>
  );
}

function RankedRows({ rows, accent }: { rows: string[]; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.slice(0, 7).map((row, index) => {
        const clean = row.replace(/^\d+[\).\s-]+/, "");
        return (
          <div
            key={`${row}-${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "78px 1fr",
              alignItems: "center",
              minHeight: 92,
              border: "1px solid rgba(255,255,255,0.1)",
              background: index === 0 ? `${accent}15` : "rgba(255,255,255,0.045)",
            }}
          >
            <div
              style={{
                color: index === 0 ? "#050505" : accent,
                background: index === 0 ? accent : "transparent",
                height: "100%",
                display: "grid",
                placeItems: "center",
                fontSize: 30,
                fontWeight: 1000,
              }}
            >
              {index + 1}
            </div>
            <div
              style={{
                padding: "0 26px",
                color: "#fff",
                fontSize: 30,
                fontWeight: 950,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              {clean}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TemplateArt({ config, values }: { config: TemplateConfig; values: Record<string, string> }) {
  if (config.Component) {
    const Component = config.Component;
    return <Component />;
  }

  const lines = splitLines(values.rows ?? values.bullets ?? "");

  if (config.id === "daily-momentum") {
    return (
      <CanvasShell config={config} values={values}>
        <div style={{ position: "absolute", left: 64, right: 64, top: 196 }}>
          <div style={{ color: "#fff", fontSize: 98, fontWeight: 1000, letterSpacing: "-0.075em", lineHeight: 0.84, textTransform: "uppercase" }}>
            {values.title}
          </div>
          <div style={{ color: "rgba(255,255,255,0.54)", fontSize: 31, fontWeight: 850, marginTop: 28 }}>
            {values.subtitle}
          </div>
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, top: 548, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <BigStat value={values.primaryValue} label={values.primaryLabel} accent={config.accent} />
          <BigStat value={values.secondaryValue} label={values.secondaryLabel} accent={config.accent} />
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 184, borderTop: `5px solid ${config.accent}`, paddingTop: 30 }}>
          <div style={{ color: "#fff", fontSize: 40, fontWeight: 950, lineHeight: 1.08, letterSpacing: "-0.04em" }}>
            {values.trend}
          </div>
        </div>
      </CanvasShell>
    );
  }

  if (config.id === "chart-top-five" || config.id === "radar-new") {
    return (
      <CanvasShell config={config} values={values}>
        <div style={{ position: "absolute", left: 64, right: 64, top: 186 }}>
          <div style={{ color: "#fff", fontSize: 76, fontWeight: 1000, letterSpacing: "-0.065em", lineHeight: 0.9, textTransform: "uppercase" }}>
            {values.title}
          </div>
          <div style={{ color: "rgba(255,255,255,0.58)", fontSize: 27, fontWeight: 800, lineHeight: 1.2, marginTop: 22 }}>
            {values.subtitle}
          </div>
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, top: 444 }}>
          <RankedRows rows={lines} accent={config.accent} />
        </div>
      </CanvasShell>
    );
  }

  if (config.id === "song-spotlight") {
    return (
      <CanvasShell config={config} values={values}>
        <div style={{ position: "absolute", left: 64, right: 64, top: 214 }}>
          <div style={{ color: config.accent, fontSize: 168, fontWeight: 1000, letterSpacing: "-0.1em", lineHeight: 0.78 }}>
            {values.stat}
          </div>
          <div style={{ color: "#fff", fontSize: 80, fontWeight: 1000, letterSpacing: "-0.07em", lineHeight: 0.9, textTransform: "uppercase", marginTop: 38 }}>
            {values.title}
          </div>
          <div style={{ color: "rgba(255,255,255,0.58)", fontSize: 38, fontWeight: 850, marginTop: 18 }}>
            {values.subtitle}
          </div>
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 190 }}>
          <div style={{ color: config.accent, fontSize: 24, fontWeight: 1000, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 18 }}>
            {values.statLabel}
          </div>
          <div style={{ color: "#fff", fontSize: 42, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.04em" }}>
            {values.note}
          </div>
        </div>
      </CanvasShell>
    );
  }

  if (config.id === "touring-pulse") {
    return (
      <CanvasShell config={config} values={values}>
        <div style={{ position: "absolute", left: 64, right: 64, top: 200 }}>
          <div style={{ color: "#fff", fontSize: 96, fontWeight: 1000, letterSpacing: "-0.08em", lineHeight: 0.85, textTransform: "uppercase" }}>
            {values.title}
          </div>
          <div style={{ color: "rgba(255,255,255,0.56)", fontSize: 34, fontWeight: 850, marginTop: 24 }}>
            {values.subtitle}
          </div>
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, top: 540, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <BigStat value={values.metricOne} label={values.metricOneLabel} accent={config.accent} />
          <BigStat value={values.metricTwo} label={values.metricTwoLabel} accent={config.accent} />
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 190, color: "#fff", fontSize: 48, fontWeight: 950, lineHeight: 1.02, letterSpacing: "-0.05em" }}>
          {values.insight}
        </div>
      </CanvasShell>
    );
  }

  if (config.id === "industry-brief") {
    return (
      <CanvasShell config={config} values={values}>
        <div style={{ position: "absolute", left: 64, right: 64, top: 196 }}>
          <div style={{ color: "#fff", fontSize: 76, fontWeight: 1000, letterSpacing: "-0.065em", lineHeight: 0.9, textTransform: "uppercase" }}>
            {values.title}
          </div>
          <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 32, fontWeight: 850, lineHeight: 1.16, marginTop: 32 }}>
            {values.subtitle}
          </div>
        </div>
        <div style={{ position: "absolute", left: 64, right: 64, bottom: 178, display: "grid", gap: 18 }}>
          {lines.slice(0, 4).map((line, index) => (
            <div key={line} style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 20, alignItems: "start" }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: config.accent, color: "#050505", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 1000, marginTop: 5 }}>
                {index + 1}
              </div>
              <div style={{ color: "#fff", fontSize: 34, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.035em" }}>
                {line}
              </div>
            </div>
          ))}
        </div>
      </CanvasShell>
    );
  }

  return (
    <CanvasShell config={config} values={values}>
      <div style={{ position: "absolute", left: 64, right: 64, top: 188 }}>
        <div style={{ color: "#fff", fontSize: 74, fontWeight: 1000, letterSpacing: "-0.065em", lineHeight: 0.9, textTransform: "uppercase" }}>
          {values.title}
        </div>
      </div>
      <div style={{ position: "absolute", left: 64, top: 492, right: 64 }}>
        <div style={{ color: config.accent, fontSize: 132, fontWeight: 1000, letterSpacing: "-0.1em", lineHeight: 0.8 }}>
          {values.stat}
        </div>
        <div style={{ color: "rgba(255,255,255,0.58)", fontSize: 30, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 20 }}>
          {values.statLabel}
        </div>
      </div>
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 188, color: "#fff", fontSize: 42, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.04em" }}>
        {values.body}
      </div>
    </CanvasShell>
  );
}

async function waitForExportReady(node: HTMLElement, timeoutMs = 7000) {
  const started = Date.now();
  while (node.querySelector("[data-export-loading='true']") && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

async function waitForImages(node: HTMLElement, timeoutMs = 2500) {
  const images = Array.from(node.querySelectorAll<HTMLImageElement>("img[src]"));
  if (!images.length) return;

  await Promise.race([
    Promise.allSettled(
      images.map(async (image) => {
        if (image.complete && image.naturalWidth > 0) return;
        if (typeof image.decode === "function") {
          await image.decode().catch(() => undefined);
          return;
        }
        await new Promise<void>((resolve) => {
          image.onload = () => resolve();
          image.onerror = () => resolve();
        });
      }),
    ),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function exportNode(node: HTMLElement, filename: string) {
  await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await waitForExportReady(node);
  await waitForImages(node);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  try {
    const dataUrl = await toPng(node, {
      width: CANVAS_W,
      height: CANVAS_H,
      pixelRatio: 2,
      backgroundColor: "#050505",
      cacheBust: true,
      skipFonts: false,
    });
    if (!dataUrl || dataUrl === "data:,") throw new Error("empty export");
    downloadDataUrl(dataUrl, filename);
    return "html-to-image";
  } catch (error) {
    console.warn("[social-export] html-to-image failed, using html2canvas fallback", error);
    const canvas = await html2canvas(node, {
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: "#050505",
      scale: 2,
      useCORS: true,
      logging: false,
    });
    downloadDataUrl(canvas.toDataURL("image/png"), filename);
    return "html2canvas";
  }
}

export default function SocialTemplates() {
  const [accessInput, setAccessInput] = useState("");
  const [accessError, setAccessError] = useState("");
  const [hasAccess, setHasAccess] = useState(() =>
    Boolean(ACCESS_CODE) && window.sessionStorage.getItem(ACCESS_STORAGE_KEY) === ACCESS_CODE,
  );
  const [selectedId, setSelectedId] = useState<TemplateId>("daily-momentum");
  const selected = templates.find((template) => template.id === selectedId) ?? templates[0];
  const [valuesByTemplate, setValuesByTemplate] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(templates.map((template) => [template.id, { ...template.defaults }])),
  );
  const values = valuesByTemplate[selected.id] ?? selected.defaults;
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>("");

  const categories = useMemo(() => Array.from(new Set(templates.map((template) => template.category))), []);

  function updateValue(key: string, value: string) {
    setValuesByTemplate((current) => ({
      ...current,
      [selected.id]: {
        ...current[selected.id],
        [key]: value,
      },
    }));
  }

  function resetSelected() {
    setValuesByTemplate((current) => ({
      ...current,
      [selected.id]: { ...selected.defaults },
    }));
    setExportStatus("");
  }

  async function handleExport() {
    if (!exportRef.current || exporting) return;
    setExporting(true);
    setExportStatus("");
    try {
      const filename = `${slugify(selected.name)}-${slugify(values.title || selected.id)}-mexico-charts.png`;
      const engine = await exportNode(exportRef.current, filename);
      setExportStatus(`Exportado como PNG con ${engine}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportStatus(`No se pudo exportar: ${message}`);
    } finally {
      setExporting(false);
    }
  }

  async function copyTemplateText() {
    const text = selected.fields.length
      ? selected.fields.map((field) => `${field.label}: ${values[field.key] ?? ""}`).join("\n")
      : `${selected.name}\n${selected.description}`;
    await navigator.clipboard.writeText(text);
    setExportStatus("Texto copiado.");
  }

  function submitAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ACCESS_CODE) {
      setAccessError("Acceso interno no configurado.");
      return;
    }
    if (accessInput.trim() !== ACCESS_CODE) {
      setAccessError("Codigo incorrecto.");
      return;
    }
    window.sessionStorage.setItem(ACCESS_STORAGE_KEY, ACCESS_CODE);
    setHasAccess(true);
    setAccessError("");
  }

  if (!hasAccess) {
    return (
      <main style={{ minHeight: "100vh", background: "#050505", color: "#fff", display: "grid", placeItems: "center", padding: 24 }}>
        <PageSEO title="Social Studio — Mexico Charts" description="Herramienta interna de templates sociales." path="/social-templates" noindex />
        <section style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <BrandMark compact />
          <div style={{ color: ACCENT, fontSize: 11, fontWeight: 1000, letterSpacing: "0.26em", textTransform: "uppercase", marginTop: 42, marginBottom: 12 }}>
            Herramienta interna
          </div>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 38, lineHeight: 0.94, textTransform: "uppercase", fontWeight: 1000, letterSpacing: "-0.05em" }}>
            Social Studio
          </h1>
          <p style={{ color: "rgba(255,255,255,0.48)", fontSize: 14, lineHeight: 1.6, margin: "18px auto 28px", maxWidth: 340 }}>
            Templates privados de Mexico Charts con exportacion directa a PNG.
          </p>
          <form onSubmit={submitAccess} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="password"
              value={accessInput}
              onChange={(event) => {
                setAccessInput(event.target.value);
                setAccessError("");
              }}
              placeholder="Codigo de acceso"
              aria-label="Codigo de acceso"
              autoComplete="off"
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                padding: "14px 16px",
                outline: "none",
                textAlign: "center",
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              style={{
                border: "none",
                borderRadius: 999,
                background: ACCENT,
                color: "#000",
                padding: "14px 16px",
                fontSize: 12,
                fontWeight: 1000,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Entrar
            </button>
          </form>
          {accessError && <div style={{ color: "rgba(255,100,100,0.9)", fontSize: 12, fontWeight: 800, marginTop: 14 }}>{accessError}</div>}
        </section>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#fff", fontFamily: "Inter, Helvetica Neue, Arial, sans-serif" }}>
      <PageSEO title="Social Studio — Mexico Charts" description="Herramienta interna de templates sociales." path="/social-templates" noindex />
      <style>{`
        input:focus, textarea:focus, select:focus {
          border-color: rgba(57,255,20,0.45) !important;
          box-shadow: 0 0 0 3px rgba(57,255,20,0.1) !important;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          height: 64,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(5,5,5,0.9)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div style={{ maxWidth: 1480, margin: "0 auto", height: "100%", padding: "0 24px", display: "flex", alignItems: "center", gap: 22 }}>
          <BrandMark compact />
          <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.46)", textDecoration: "none", fontSize: 11, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Admin
          </Link>
          <div style={{ marginLeft: "auto", color: ACCENT, fontSize: 11, fontWeight: 1000, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Social Studio · Exportable
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1480, margin: "0 auto", padding: "32px 24px 70px" }}>
        <header style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 24, alignItems: "end", marginBottom: 24 }}>
          <div>
            <div style={{ color: ACCENT, fontSize: 12, fontWeight: 1000, letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: 12 }}>
              New templates
            </div>
            <h1 style={{ margin: 0, color: "#fff", fontSize: "clamp(42px, 6vw, 78px)", lineHeight: 0.88, fontWeight: 1000, letterSpacing: "-0.075em", textTransform: "uppercase" }}>
              Social media templates
            </h1>
            <p style={{ margin: "18px 0 0", maxWidth: 740, color: "rgba(255,255,255,0.52)", fontSize: 16, lineHeight: 1.55 }}>
              Listas con artwork, templates editoriales y cards de momentum built for reliable PNG export. Edit the copy when available, export at 1080x1350, post.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              onClick={copyTemplateText}
              style={toolbarButtonStyle("rgba(255,255,255,0.055)", "rgba(255,255,255,0.72)", "rgba(255,255,255,0.12)")}
            >
              <Copy style={{ width: 16, height: 16 }} />
              Copy text
            </button>
            <button
              onClick={resetSelected}
              style={toolbarButtonStyle("rgba(255,255,255,0.055)", "rgba(255,255,255,0.72)", "rgba(255,255,255,0.12)")}
            >
              <RefreshCw style={{ width: 16, height: 16 }} />
              Reset
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              style={toolbarButtonStyle(exporting ? "rgba(57,255,20,0.42)" : ACCENT, "#050505", "transparent")}
            >
              {exporting ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : <Download style={{ width: 16, height: 16 }} />}
              {exporting ? "Exporting" : "Export PNG"}
            </button>
          </div>
        </header>

        {exportStatus && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 18,
              padding: "12px 14px",
              border: "1px solid rgba(57,255,20,0.18)",
              background: "rgba(57,255,20,0.07)",
              color: "rgba(255,255,255,0.78)",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <CheckCircle2 style={{ width: 16, height: 16, color: ACCENT }} />
            {exportStatus}
          </div>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "280px minmax(420px, 1fr) 360px", gap: 22, alignItems: "start" }}>
          <aside style={panelStyle}>
            <div style={panelTitleStyle}>Templates</div>
            {categories.map((category) => (
              <div key={category} style={{ marginBottom: 18 }}>
                <div style={{ color: "rgba(255,255,255,0.26)", fontSize: 10, fontWeight: 1000, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 8 }}>
                  {category}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {templates
                    .filter((template) => template.category === category)
                    .map((template) => {
                      const active = selected.id === template.id;
                      return (
                        <button
                          key={template.id}
                          onClick={() => {
                            setSelectedId(template.id);
                            setExportStatus("");
                          }}
                          style={{
                            border: `1px solid ${active ? template.accent : "rgba(255,255,255,0.08)"}`,
                            background: active ? `${template.accent}16` : "rgba(255,255,255,0.035)",
                            color: "#fff",
                            padding: "13px 14px",
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ color: active ? template.accent : "#fff", fontSize: 13, fontWeight: 950, letterSpacing: "-0.01em" }}>
                            {template.name}
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: 750, marginTop: 4 }}>
                            {template.format}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </aside>

          <section style={{ ...panelStyle, minHeight: 720, display: "grid", placeItems: "center", overflow: "hidden" }}>
            <div style={{ width: 432, height: 540, position: "relative" }}>
              <div style={{ transform: "scale(0.4)", transformOrigin: "top left", width: CANVAS_W, height: CANVAS_H, boxShadow: "0 32px 90px rgba(0,0,0,0.72)" }}>
                <TemplateArt config={selected} values={values} />
              </div>
            </div>
          </section>

          <aside style={panelStyle}>
            <div style={panelTitleStyle}>{selected.fields.length ? "Edit copy" : "Live chart data"}</div>
            <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, lineHeight: 1.45, marginBottom: 18 }}>
              {selected.description}
            </div>
            {selected.fields.length ? (
              <div style={{ display: "grid", gap: 14 }}>
                {selected.fields.map((field) => (
                  <label key={field.key} style={{ display: "grid", gap: 7 }}>
                    <span style={{ color: "rgba(255,255,255,0.42)", fontSize: 10, fontWeight: 1000, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                      {field.label}
                    </span>
                    {field.type === "textarea" ? (
                      <textarea
                        value={values[field.key] ?? ""}
                        onChange={(event) => updateValue(field.key, event.target.value)}
                        rows={field.key === "rows" || field.key === "bullets" ? 6 : 3}
                        style={inputStyle}
                      />
                    ) : (
                      <input
                        value={values[field.key] ?? ""}
                        onChange={(event) => updateValue(field.key, event.target.value)}
                        style={inputStyle}
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.035)",
                  padding: 14,
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  fontWeight: 750,
                  lineHeight: 1.5,
                }}
              >
                This template pulls live chart data and artwork from Mexico Charts. Use Export PNG once the preview has loaded.
              </div>
            )}
          </aside>
        </section>
      </main>

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          left: -2000,
          top: 0,
          width: CANVAS_W,
          height: CANVAS_H,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div ref={exportRef} style={{ width: CANVAS_W, height: CANVAS_H }}>
          <TemplateArt config={selected} values={values} />
        </div>
      </div>
    </div>
  );
}

function toolbarButtonStyle(background: string, color: string, borderColor: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    minHeight: 42,
    padding: "0 17px",
    border: `1px solid ${borderColor}`,
    background,
    color,
    fontSize: 11,
    fontWeight: 1000,
    letterSpacing: "0.13em",
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

const panelStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 18,
};

const panelTitleStyle: React.CSSProperties = {
  color: "#fff",
  fontSize: 13,
  fontWeight: 1000,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginBottom: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(0,0,0,0.34)",
  color: "#fff",
  padding: "11px 12px",
  fontSize: 13,
  lineHeight: 1.45,
  fontFamily: "inherit",
  outline: "none",
  resize: "vertical",
};
