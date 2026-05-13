import {
  TemplateCanvas, AccentLine, CTAFooter, SectionLabel, ACCENT, LOGO_URL,
} from "../components";

interface CoverProps {
  title?: string;
  subtitle?: string;
  edition?: string;
  date?: string;
  source?: string;
}

const DEFAULTS: CoverProps = {
  title: "Los Datos de la\nMúsica Mexicana",
  subtitle: "Charts · Streaming · Industria",
  edition: "Edición Semanal",
  date: "13 Mayo 2026",
  source: "Spotify · IFPI · Pollstar",
};

export default function CarouselCover({
  title = DEFAULTS.title,
  subtitle = DEFAULTS.subtitle,
  edition = DEFAULTS.edition,
  date = DEFAULTS.date,
  source = DEFAULTS.source,
}: CoverProps = {}) {
  const lines = title?.split("\n") ?? [title];

  return (
    <TemplateCanvas>
      {/* Full-canvas cinematic gradient */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          radial-gradient(ellipse 70% 60% at 50% 0%, ${ACCENT}14 0%, transparent 55%),
          radial-gradient(ellipse 50% 40% at 50% 100%, ${ACCENT}08 0%, transparent 50%),
          linear-gradient(180deg, #060606 0%, #040404 100%)
        `,
        pointerEvents: "none",
      }} />

      {/* Horizontal scan lines — subtle editorial texture */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${12 + i * 10}%`,
          left: 0, right: 0,
          height: 1,
          background: `linear-gradient(to right, transparent, rgba(255,255,255,${0.02 + (i % 2) * 0.01}), transparent)`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Corner accent — top left */}
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: 180, height: 3,
        background: ACCENT,
        boxShadow: `0 0 20px ${ACCENT}80`,
      }} />
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: 3, height: 180,
        background: `linear-gradient(to bottom, ${ACCENT}, transparent)`,
      }} />

      {/* Corner accent — bottom right */}
      <div style={{
        position: "absolute", bottom: 0, right: 0,
        width: 180, height: 2,
        background: `linear-gradient(to left, ${ACCENT}60, transparent)`,
      }} />
      <div style={{
        position: "absolute", bottom: 0, right: 0,
        width: 2, height: 180,
        background: `linear-gradient(to top, ${ACCENT}60, transparent)`,
      }} />

      {/* Main content */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        justifyContent: "center",
        padding: "0 80px",
      }}>
        {/* Logo + edition */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 56 }}>
          <img src={LOGO_URL} alt="Mexico Charts" style={{ height: 46, objectFit: "contain", opacity: 0.95 }} />
          {edition && (
            <>
              <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.15)" }} />
              <div style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                {edition}
              </div>
            </>
          )}
        </div>

        {/* Sub-eyebrow */}
        <SectionLabel>Datos · Cultura · Impacto</SectionLabel>

        {/* Main title */}
        <div style={{
          fontSize: 110,
          fontWeight: 900,
          letterSpacing: "-0.05em",
          lineHeight: 0.88,
          textTransform: "uppercase",
          marginTop: 16,
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{ color: i === 0 ? "#fff" : ACCENT }}>
              {line}
            </div>
          ))}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div style={{
            marginTop: 36,
            fontSize: 22,
            fontWeight: 700,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}>
            {subtitle}
          </div>
        )}

        {/* Swipe hint */}
        <div style={{
          marginTop: 56,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            fontSize: 17, fontWeight: 700, color: ACCENT,
            letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            Desliza para ver los datos
          </div>
          <div style={{ fontSize: 22, color: ACCENT }}>→</div>
        </div>

        {/* Date + source */}
        <div style={{ marginTop: 20, display: "flex", gap: 16 }}>
          {date && <div style={{ fontSize: 16, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>{date}</div>}
          {source && <div style={{ fontSize: 16, color: "rgba(255,255,255,0.12)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>· {source}</div>}
        </div>
      </div>

      {/* Bottom */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <AccentLine opacity={0.2} />
        <CTAFooter />
      </div>
    </TemplateCanvas>
  );
}
