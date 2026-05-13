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
      {/* Left editorial rule line */}
      <div style={{
        position: "absolute", left: 64, top: 0, bottom: 0, width: 1,
        background: `linear-gradient(to bottom, transparent 5%, ${ACCENT}30 30%, ${ACCENT}18 70%, transparent 95%)`,
        pointerEvents: "none",
      }} />

      {/* Ghost large stat watermark — top right */}
      <div style={{
        position: "absolute",
        right: -40, top: "5%",
        fontSize: 440,
        fontWeight: 900,
        color: "rgba(57,255,20,0.04)",
        letterSpacing: "-0.06em",
        lineHeight: 1,
        pointerEvents: "none",
        userSelect: "none",
      }}>
        {statValue}
      </div>

      {/* Atmospheric glow — top right */}
      <div style={{
        position: "absolute", top: -80, right: -80,
        width: 650, height: 650,
        background: `radial-gradient(circle, ${ACCENT}0e 0%, transparent 62%)`,
        filter: "blur(70px)",
        pointerEvents: "none",
      }} />

      {/* Bottom left haze */}
      <div style={{
        position: "absolute", bottom: 0, left: 0,
        width: 450, height: 450,
        background: `radial-gradient(circle, ${ACCENT}09 0%, transparent 65%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
      }} />

      <LogoBar date={date} source="Industria" />
      <AccentLine />

      <div style={{ padding: "44px 64px 0", position: "relative", zIndex: 2 }}>
        <SectionLabel>Análisis · Industria</SectionLabel>

        {/* Big stat — asymmetrically pushed left */}
        <div style={{ marginTop: 28, marginBottom: 36 }}>
          <LargeStatNum value={statValue!} label={statLabel} size={144} watermark={false} />
        </div>

        {/* Headline — all caps, dominant */}
        <div style={{
          fontSize: 44,
          fontWeight: 900,
          color: "#fff",
          lineHeight: 1.18,
          letterSpacing: "-0.025em",
          maxWidth: 880,
          textTransform: "uppercase",
        }}>
          {headline}
        </div>

        {/* Accent rule */}
        <div style={{
          display: "flex", alignItems: "center", gap: 0, marginTop: 32, marginBottom: 32,
        }}>
          <div style={{ width: 56, height: 3, background: ACCENT, borderRadius: 1, boxShadow: `0 0 16px ${ACCENT}70` }} />
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Body paragraph */}
        <div style={{
          fontSize: 25,
          color: "rgba(255,255,255,0.48)",
          lineHeight: 1.62,
          maxWidth: 880,
          letterSpacing: "-0.005em",
        }}>
          {body}
        </div>

        {/* Context bullets */}
        {context && context.length > 0 && (
          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 14 }}>
            {context.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: ACCENT,
                  flexShrink: 0,
                  marginTop: 10,
                  boxShadow: `0 0 10px ${ACCENT}90`,
                }} />
                <div style={{ fontSize: 22, color: "rgba(255,255,255,0.36)", lineHeight: 1.4 }}>
                  {item}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 36 }}>
          <SourceFooter source={source} date={date} />
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <AccentLine opacity={0.1} />
      <CTAFooter />
    </TemplateCanvas>
  );
}
