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
      {/* Left editorial accent rule */}
      <div style={{
        position: "absolute", left: 64, top: "12%", bottom: "12%",
        width: 3,
        background: `linear-gradient(to bottom, transparent, ${ACCENT}90, ${ACCENT}50, transparent)`,
        borderRadius: 2,
        boxShadow: `4px 0 24px ${ACCENT}30`,
        pointerEvents: "none",
      }} />

      {/* Primary left glow */}
      <div style={{
        position: "absolute", top: "15%", left: -80,
        width: 700, height: 700,
        background: `radial-gradient(circle, ${ACCENT}10 0%, transparent 65%)`,
        filter: "blur(80px)",
        pointerEvents: "none",
      }} />

      {/* Secondary glow — upper right, fainter */}
      <div style={{
        position: "absolute", top: "5%", right: -60,
        width: 450, height: 450,
        background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 65%)`,
        filter: "blur(100px)",
        pointerEvents: "none",
      }} />

      {/* Ghost watermark — vertical, right side */}
      <div style={{
        position: "absolute", right: -40, top: "10%",
        fontSize: 320,
        fontWeight: 900,
        color: "rgba(57,255,20,0.03)",
        lineHeight: 0.8,
        letterSpacing: "-0.06em",
        pointerEvents: "none",
        userSelect: "none",
        writingMode: "vertical-rl",
        textTransform: "uppercase",
      }}>
        MX
      </div>

      {/* Main content */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        justifyContent: "center",
        padding: "0 90px 0 96px",
        zIndex: 2,
      }}>
        {/* Eyebrow */}
        <div style={{
          fontSize: 17, fontWeight: 900,
          color: ACCENT,
          letterSpacing: "0.36em",
          textTransform: "uppercase",
          marginBottom: 24,
          textShadow: `0 0 30px ${ACCENT}60`,
        }}>
          Mexico Charts
        </div>

        {/* Giant headline — three lines, staggered colors */}
        <div style={{
          fontSize: 148,
          fontWeight: 900,
          letterSpacing: "-0.055em",
          lineHeight: 0.84,
          textTransform: "uppercase",
        }}>
          <div style={{ color: "#fff" }}>{line1}</div>
          <div style={{
            color: ACCENT,
            textShadow: `0 0 70px ${ACCENT}55, 0 0 140px ${ACCENT}25`,
          }}>{line2}</div>
          <div style={{ color: "rgba(255,255,255,0.48)" }}>{line3}</div>
        </div>

        {/* Accent rule with chart-line accent */}
        <div style={{
          display: "flex", alignItems: "center", gap: 0, marginTop: 44, marginBottom: 32,
        }}>
          <div style={{
            width: 56, height: 3, background: ACCENT, borderRadius: 1,
            boxShadow: `0 0 20px ${ACCENT}80`,
          }} />
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Subtext */}
        {subtext && (
          <div style={{
            fontSize: 30,
            color: "rgba(255,255,255,0.4)",
            lineHeight: 1.52,
            maxWidth: 740,
            letterSpacing: "-0.005em",
          }}>
            {subtext}
          </div>
        )}

        {/* Context */}
        {context && (
          <div style={{
            marginTop: 28,
            fontSize: 16, fontWeight: 800,
            color: "rgba(255,255,255,0.18)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}>
            {context}
          </div>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2 }}>
        <AccentLine opacity={0.14} />
        <CTAFooter />
      </div>
    </TemplateCanvas>
  );
}
