import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, LargeStatNum, SourceFooter, ACCENT,
} from "../components";

interface InsightProps {
  headline?: string;
  statValue?: string;
  statLabel?: string;
  body?: string;
  context?: string[];
  source?: string;
  date?: string;
}

const DEFAULTS: InsightProps = {
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
};

export default function IndustryInsight({
  headline = DEFAULTS.headline,
  statValue = DEFAULTS.statValue,
  statLabel = DEFAULTS.statLabel,
  body = DEFAULTS.body,
  context = DEFAULTS.context,
  source = DEFAULTS.source,
  date = DEFAULTS.date,
}: InsightProps = {}) {
  return (
    <TemplateCanvas>
      {/* Report-style background lines */}
      <div style={{
        position: "absolute", left: 64, top: 0, bottom: 0, width: 1,
        background: `linear-gradient(to bottom, transparent, ${ACCENT}25, transparent)`,
        pointerEvents: "none",
      }} />

      {/* Atmospheric glow */}
      <div style={{
        position: "absolute", top: -100, right: -100,
        width: 600, height: 600,
        background: `radial-gradient(circle, ${ACCENT}0c 0%, transparent 65%)`,
        filter: "blur(80px)",
        pointerEvents: "none",
      }} />

      <LogoBar date={date} source="Industria" />
      <AccentLine />

      <div style={{ padding: "52px 64px 0" }}>
        <SectionLabel>Análisis · Industria</SectionLabel>

        {/* Big stat */}
        <div style={{ marginTop: 32, marginBottom: 40 }}>
          <LargeStatNum value={statValue!} label={statLabel} size={140} />
        </div>

        {/* Headline */}
        <div style={{
          fontSize: 44,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          maxWidth: 860,
          textTransform: "uppercase",
        }}>
          {headline}
        </div>

        {/* Accent rule */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginTop: 36, marginBottom: 36,
        }}>
          <div style={{ width: 48, height: 2, background: ACCENT, borderRadius: 1, boxShadow: `0 0 12px ${ACCENT}60` }} />
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Body paragraph */}
        <div style={{
          fontSize: 27,
          color: "rgba(255,255,255,0.52)",
          lineHeight: 1.6,
          maxWidth: 880,
          letterSpacing: "-0.005em",
        }}>
          {body}
        </div>

        {/* Context bullets */}
        {context && context.length > 0 && (
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>
            {context.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: ACCENT,
                  flexShrink: 0,
                  marginTop: 9,
                  boxShadow: `0 0 8px ${ACCENT}80`,
                }} />
                <div style={{ fontSize: 23, color: "rgba(255,255,255,0.38)", lineHeight: 1.4 }}>
                  {item}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 40 }}>
          <SourceFooter source={source} date={date} />
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <AccentLine opacity={0.12} />
      <CTAFooter />
    </TemplateCanvas>
  );
}
