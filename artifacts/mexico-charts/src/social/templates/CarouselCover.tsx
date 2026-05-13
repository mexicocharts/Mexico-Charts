import {
  TemplateCanvas, AccentLine, CTAFooter, SectionLabel, CinematicPhoto, ACCENT, LOGO_URL,
} from "../components";

interface CoverProps {
  title?: string;
  subtitle?: string;
  edition?: string;
  date?: string;
  source?: string;
  photoUrl?: string;
  variant?: "datos" | "domina" | "genero" | "impacto" | "industria";
}

const VARIANTS: Record<string, { line1: string; line2: string }> = {
  datos:    { line1: "LOS DATOS QUE", line2: "NADIE ESTÁ VIENDO" },
  domina:   { line1: "MÉXICO YA", line2: "DOMINA EL STREAMING" },
  genero:   { line1: "EL GÉNERO MÁS", line2: "GRANDE DEL PAÍS" },
  impacto:  { line1: "EL IMPACTO", line2: "MEXICANO EN NÚMEROS" },
  industria:{ line1: "LA INDUSTRIA", line2: "CAMBIÓ" },
};

const DEFAULTS: CoverProps = {
  title: "LOS DATOS QUE NADIE\nESTÁ VIENDO",
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
  photoUrl,
  variant,
}: CoverProps = {}) {
  const hasPhoto = !!photoUrl;

  let lines: string[];
  if (variant && VARIANTS[variant]) {
    const v = VARIANTS[variant];
    lines = [v.line1, v.line2];
  } else {
    lines = title?.split("\n") ?? [title ?? ""];
  }

  return (
    <TemplateCanvas>
      {/* Optional cinematic photo */}
      {hasPhoto && <CinematicPhoto src={photoUrl!} position="center center" darken={0.75} emeraldOverlay={0.06} blur />}

      {/* Full-canvas layered atmosphere */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          radial-gradient(ellipse 80% 65% at 50% -5%, ${ACCENT}16 0%, transparent 55%),
          radial-gradient(ellipse 60% 45% at 50% 105%, ${ACCENT}0a 0%, transparent 50%),
          radial-gradient(ellipse 40% 50% at 80% 50%, ${ACCENT}06 0%, transparent 60%)
        `,
        pointerEvents: "none",
      }} />

      {/* Horizontal scan-line editorial texture */}
      {[...Array(10)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${8 + i * 9}%`,
          left: 0, right: 0,
          height: 1,
          background: `linear-gradient(to right, transparent, rgba(255,255,255,${0.015 + (i % 3) * 0.008}), transparent)`,
          pointerEvents: "none",
        }} />
      ))}

      {/* Corner accent — top left: L-bracket with glow */}
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: 220, height: 4,
        background: `linear-gradient(to right, ${ACCENT}, ${ACCENT}60)`,
        boxShadow: `0 0 28px ${ACCENT}90, 0 0 60px ${ACCENT}40`,
      }} />
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: 4, height: 220,
        background: `linear-gradient(to bottom, ${ACCENT}, transparent)`,
        boxShadow: `0 0 24px ${ACCENT}70`,
      }} />

      {/* Corner accent — bottom right */}
      <div style={{
        position: "absolute", bottom: 0, right: 0,
        width: 200, height: 3,
        background: `linear-gradient(to left, ${ACCENT}70, transparent)`,
        boxShadow: `0 0 20px ${ACCENT}50`,
      }} />
      <div style={{
        position: "absolute", bottom: 0, right: 0,
        width: 3, height: 200,
        background: `linear-gradient(to top, ${ACCENT}70, transparent)`,
      }} />

      {/* Diagonal ghost watermark — right side */}
      <div style={{
        position: "absolute",
        right: -80, top: "15%",
        fontSize: 340,
        fontWeight: 900,
        color: hasPhoto ? "rgba(57,255,20,0.06)" : "rgba(57,255,20,0.04)",
        letterSpacing: "-0.07em",
        lineHeight: 0.85,
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
        padding: "0 80px",
        zIndex: 2,
      }}>
        {/* Logo + edition */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 48 }}>
          <img src={LOGO_URL} alt="Mexico Charts" style={{ height: 46, objectFit: "contain", opacity: 0.95 }} />
          {edition && (
            <>
              <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.15)" }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                {edition}
              </div>
            </>
          )}
        </div>

        {/* Eyebrow */}
        <SectionLabel>Datos · Cultura · Impacto</SectionLabel>

        {/* Main title — cinematic scale */}
        <div style={{
          fontSize: 136,
          fontWeight: 900,
          letterSpacing: "-0.055em",
          lineHeight: 0.84,
          textTransform: "uppercase",
          marginTop: 14,
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{
              color: i === 0 ? "#fff" : ACCENT,
              textShadow: i > 0 ? `0 0 60px ${ACCENT}50, 0 0 120px ${ACCENT}20` : (hasPhoto ? "0 4px 40px rgba(0,0,0,0.9)" : "none"),
            }}>
              {line}
            </div>
          ))}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div style={{
            marginTop: 32,
            fontSize: 21,
            fontWeight: 700,
            color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}>
            {subtitle}
          </div>
        )}

        {/* Swipe CTA */}
        <div style={{
          marginTop: 52,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 48, height: 2, background: ACCENT, borderRadius: 1,
            boxShadow: `0 0 16px ${ACCENT}80`,
          }} />
          <div style={{
            fontSize: 16, fontWeight: 800, color: ACCENT,
            letterSpacing: "0.14em", textTransform: "uppercase",
            textShadow: `0 0 20px ${ACCENT}60`,
          }}>
            Desliza para ver los datos
          </div>
          <div style={{ fontSize: 22, color: ACCENT }}>→</div>
        </div>

        {/* Date + source */}
        <div style={{ marginTop: 18, display: "flex", gap: 16 }}>
          {date && <div style={{ fontSize: 15, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>{date}</div>}
          {source && <div style={{ fontSize: 15, color: "rgba(255,255,255,0.12)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>· {source}</div>}
        </div>
      </div>

      {/* Bottom */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 2 }}>
        <AccentLine opacity={0.25} />
        <CTAFooter />
      </div>
    </TemplateCanvas>
  );
}
