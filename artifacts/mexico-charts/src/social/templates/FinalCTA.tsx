import {
  TemplateCanvas, AccentLine, ACCENT, LOGO_URL,
} from "../components";

interface FinalCTAProps {
  tagline1?: string;
  tagline2?: string;
  tagline3?: string;
  handle?: string;
  website?: string;
  date?: string;
}

const DEFAULTS: FinalCTAProps = {
  tagline1: "Datos",
  tagline2: "Cultura",
  tagline3: "Impacto",
  handle: "@mexicocharts",
  website: "mexicochart.com",
  date: "México Charts · 2026",
};

export default function FinalCTA({
  tagline1 = DEFAULTS.tagline1,
  tagline2 = DEFAULTS.tagline2,
  tagline3 = DEFAULTS.tagline3,
  handle = DEFAULTS.handle,
  website = DEFAULTS.website,
  date = DEFAULTS.date,
}: FinalCTAProps = {}) {
  return (
    <TemplateCanvas>
      {/* Deep center glow — cinematic */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          radial-gradient(ellipse 90% 70% at 50% 55%, ${ACCENT}16 0%, transparent 60%),
          radial-gradient(ellipse 70% 50% at 50% 105%, ${ACCENT}0c 0%, transparent 50%)
        `,
        pointerEvents: "none",
      }} />

      {/* Ghost watermark — behind taglines */}
      <div style={{
        position: "absolute",
        left: "50%", top: "20%",
        transform: "translateX(-50%)",
        fontSize: 380,
        fontWeight: 900,
        color: "rgba(57,255,20,0.04)",
        letterSpacing: "-0.06em",
        lineHeight: 0.85,
        pointerEvents: "none",
        userSelect: "none",
        textAlign: "center",
        whiteSpace: "nowrap",
        textTransform: "uppercase",
      }}>
        MX
      </div>

      {/* Subtle vertical grid lines */}
      {[25, 50, 75].map((pos) => (
        <div key={pos} style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${pos}%`, width: 1,
          background: `linear-gradient(to bottom, transparent, rgba(255,255,255,0.025), transparent)`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 2 }}>
        <AccentLine opacity={0.6} />
      </div>

      {/* Main content — centered */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 80px",
        textAlign: "center",
        zIndex: 2,
      }}>
        {/* Logo */}
        <img
          src={LOGO_URL}
          alt="Mexico Charts"
          style={{ height: 68, objectFit: "contain", opacity: 0.95, marginBottom: 52 }}
        />

        {/* CTA message */}
        <div style={{
          fontSize: 26, fontWeight: 800,
          color: "rgba(255,255,255,0.36)",
          letterSpacing: "0.16em", textTransform: "uppercase",
          marginBottom: 20,
        }}>
          Sigue a Mexico Charts para más datos de la música mexicana
        </div>

        {/* Three taglines — cinematic stacked typography */}
        <div style={{ marginBottom: 60 }}>
          {[tagline1, tagline2, tagline3].map((t, i) => (
            <div key={i} style={{
              fontSize: 112,
              fontWeight: 900,
              letterSpacing: "-0.055em",
              lineHeight: 0.84,
              textTransform: "uppercase",
              color: i === 1 ? ACCENT : i === 0 ? "#fff" : "rgba(255,255,255,0.32)",
              textShadow: i === 1 ? `0 0 70px ${ACCENT}55, 0 0 140px ${ACCENT}25` : "none",
            }}>
              {t}
            </div>
          ))}
        </div>

        {/* Handle */}
        <div style={{
          fontSize: 40, fontWeight: 900,
          color: ACCENT,
          letterSpacing: "0.04em",
          textShadow: `0 0 40px ${ACCENT}60`,
          marginBottom: 14,
        }}>
          {handle}
        </div>

        {/* Website */}
        <div style={{
          fontSize: 23, fontWeight: 700,
          color: "rgba(255,255,255,0.22)",
          letterSpacing: "0.1em",
        }}>
          {website}
        </div>

        {/* Date */}
        <div style={{
          marginTop: 44,
          fontSize: 15, fontWeight: 700,
          color: "rgba(255,255,255,0.12)",
          letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          {date}
        </div>
      </div>

      {/* Bottom accent */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2 }}>
        <AccentLine opacity={0.35} />
      </div>
    </TemplateCanvas>
  );
}
