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
      {/* Full cinematic glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          radial-gradient(ellipse 80% 60% at 50% 50%, ${ACCENT}12 0%, transparent 65%),
          radial-gradient(ellipse 60% 40% at 50% 100%, ${ACCENT}08 0%, transparent 50%)
        `,
        pointerEvents: "none",
      }} />

      {/* Grid lines — subtle */}
      {[25, 50, 75].map((pos) => (
        <div key={pos} style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${pos}%`, width: 1,
          background: `linear-gradient(to bottom, transparent, rgba(255,255,255,0.03), transparent)`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Top accent */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
        <AccentLine opacity={0.5} />
      </div>

      {/* Main content — centered */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 80px",
        textAlign: "center",
      }}>
        {/* Logo — large */}
        <img
          src={LOGO_URL}
          alt="Mexico Charts"
          style={{ height: 64, objectFit: "contain", opacity: 0.95, marginBottom: 60 }}
        />

        {/* CTA message */}
        <div style={{
          fontSize: 28, fontWeight: 800,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.18em", textTransform: "uppercase",
          marginBottom: 24,
        }}>
          Sigue a Mexico Charts para más datos de la música mexicana
        </div>

        {/* Three taglines — big */}
        <div style={{ marginBottom: 64 }}>
          {[tagline1, tagline2, tagline3].map((t, i) => (
            <div key={i} style={{
              fontSize: 108,
              fontWeight: 900,
              letterSpacing: "-0.05em",
              lineHeight: 0.86,
              textTransform: "uppercase",
              color: i === 1 ? ACCENT : i === 0 ? "#fff" : "rgba(255,255,255,0.38)",
              textShadow: i === 1 ? `0 0 60px ${ACCENT}40` : "none",
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
          textShadow: `0 0 30px ${ACCENT}50`,
          marginBottom: 16,
        }}>
          {handle}
        </div>

        {/* Website */}
        <div style={{
          fontSize: 24, fontWeight: 700,
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "0.1em",
        }}>
          {website}
        </div>

        {/* Date */}
        <div style={{
          marginTop: 48,
          fontSize: 16, fontWeight: 700,
          color: "rgba(255,255,255,0.14)",
          letterSpacing: "0.18em", textTransform: "uppercase",
        }}>
          {date}
        </div>
      </div>

      {/* Bottom accent */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <AccentLine opacity={0.3} />
      </div>
    </TemplateCanvas>
  );
}
