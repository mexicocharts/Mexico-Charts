import {
  TemplateCanvas, AccentLine, CTAFooter, ACCENT,
} from "../components";

interface QuoteProps {
  line1?: string;
  line2?: string;
  line3?: string;
  subtext?: string;
  context?: string;
}

const DEFAULTS: QuoteProps = {
  line1: "MÉXICO",
  line2: "DOMINA",
  line3: "LOS CHARTS",
  subtext: "La música mexicana encabeza las listas globales por tercer mes consecutivo",
  context: "Mayo 2026",
};

export default function QuoteHeadline({
  line1 = DEFAULTS.line1,
  line2 = DEFAULTS.line2,
  line3 = DEFAULTS.line3,
  subtext = DEFAULTS.subtext,
  context = DEFAULTS.context,
}: QuoteProps = {}) {
  return (
    <TemplateCanvas>
      {/* Minimal left accent rule */}
      <div style={{
        position: "absolute", left: 64, top: "15%", bottom: "15%",
        width: 3, background: `linear-gradient(to bottom, transparent, ${ACCENT}, transparent)`,
        borderRadius: 2,
        pointerEvents: "none",
      }} />

      {/* Subtle glow */}
      <div style={{
        position: "absolute", top: "20%", left: "-10%",
        width: 600, height: 600,
        background: `radial-gradient(circle, ${ACCENT}0c 0%, transparent 65%)`,
        filter: "blur(100px)",
        pointerEvents: "none",
      }} />

      {/* Ghost watermark typography */}
      <div style={{
        position: "absolute", right: -30, top: "25%",
        fontSize: 300, fontWeight: 900,
        color: "rgba(255,255,255,0.025)",
        lineHeight: 0.8,
        letterSpacing: "-0.06em",
        pointerEvents: "none",
        userSelect: "none",
        writingMode: "vertical-rl",
        textTransform: "uppercase",
      }}>
        MX
      </div>

      {/* Main content — left aligned, vertically centered */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        justifyContent: "center",
        padding: "0 90px 0 90px",
      }}>
        {/* Eyebrow */}
        <div style={{
          fontSize: 18, fontWeight: 900,
          color: ACCENT,
          letterSpacing: "0.35em",
          textTransform: "uppercase",
          marginBottom: 28,
        }}>
          Mexico Charts
        </div>

        {/* Giant headline */}
        <div style={{
          fontSize: 148,
          fontWeight: 900,
          letterSpacing: "-0.055em",
          lineHeight: 0.85,
          textTransform: "uppercase",
        }}>
          <div style={{ color: "#fff" }}>{line1}</div>
          <div style={{ color: ACCENT, textShadow: `0 0 60px ${ACCENT}40` }}>{line2}</div>
          <div style={{ color: "rgba(255,255,255,0.55)" }}>{line3}</div>
        </div>

        {/* Divider */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, marginTop: 48, marginBottom: 36,
        }}>
          <div style={{ width: 48, height: 2, background: ACCENT, borderRadius: 1 }} />
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Subtext */}
        {subtext && (
          <div style={{
            fontSize: 30,
            color: "rgba(255,255,255,0.42)",
            lineHeight: 1.5,
            maxWidth: 720,
            letterSpacing: "-0.005em",
          }}>
            {subtext}
          </div>
        )}

        {/* Context date */}
        {context && (
          <div style={{
            marginTop: 28,
            fontSize: 17,
            fontWeight: 800,
            color: "rgba(255,255,255,0.2)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}>
            {context}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <AccentLine opacity={0.12} />
        <CTAFooter />
      </div>
    </TemplateCanvas>
  );
}
