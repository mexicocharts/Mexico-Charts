import {
  TemplateCanvas, AccentLine, CTAFooter, SectionLabel, SourceFooter, ACCENT, LOGO_URL,
} from "../components";

interface DataSlideProps {
  slideNumber?: number;
  totalSlides?: number;
  heading?: string;
  subheading?: string;
  bullets?: string[];
  bigStat?: string;
  bigStatLabel?: string;
  source?: string;
  date?: string;
}

const DEFAULTS: DataSlideProps = {
  slideNumber: 2,
  totalSlides: 8,
  heading: "Corridos Tumbados conquista el mundo",
  subheading: "El género más exportado de México en 2025–2026",
  bullets: [
    "Top 5 géneros en Spotify México, Colombia y España",
    "Peso Pluma presente en el Global 200 durante 48 semanas",
    "28 artistas de corridos en el Billboard Latin Hot 100",
    "Crecimiento de 310% en streams internacionales vs. 2022",
    "Primer género en cruzar de México a Billboard Hot 100",
  ],
  bigStat: "310%",
  bigStatLabel: "Crecimiento global en 3 años",
  source: "Spotify · Billboard",
  date: "2026",
};

export default function CarouselDataSlide({
  slideNumber = DEFAULTS.slideNumber,
  totalSlides = DEFAULTS.totalSlides,
  heading = DEFAULTS.heading,
  subheading = DEFAULTS.subheading,
  bullets = DEFAULTS.bullets,
  bigStat = DEFAULTS.bigStat,
  bigStatLabel = DEFAULTS.bigStatLabel,
  source = DEFAULTS.source,
  date = DEFAULTS.date,
}: DataSlideProps = {}) {
  return (
    <TemplateCanvas>
      {/* Subtle side glow */}
      <div style={{
        position: "absolute", left: -100, top: "30%",
        width: 400, height: 400,
        background: `radial-gradient(circle, ${ACCENT}09 0%, transparent 65%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
      }} />

      {/* Left accent bar */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: 4,
        background: `linear-gradient(to bottom, transparent, ${ACCENT}50, transparent)`,
      }} />

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "40px 64px 32px",
      }}>
        <img src={LOGO_URL} alt="" style={{ height: 30, objectFit: "contain", opacity: 0.7 }} />
        <div style={{
          fontSize: 17, fontWeight: 900, color: "rgba(255,255,255,0.2)",
          letterSpacing: "0.12em", textTransform: "uppercase",
        }}>
          {String(slideNumber).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
        </div>
      </div>
      <AccentLine opacity={0.12} />

      {/* Content */}
      <div style={{ padding: "44px 64px 0" }}>
        <SectionLabel>Insight</SectionLabel>

        {/* Big stat — if provided */}
        {bigStat && (
          <div style={{
            fontSize: 108,
            fontWeight: 900,
            color: ACCENT,
            letterSpacing: "-0.05em",
            lineHeight: 0.88,
            textShadow: `0 0 60px ${ACCENT}35`,
            marginTop: 8,
          }}>
            {bigStat}
          </div>
        )}
        {bigStatLabel && (
          <div style={{
            fontSize: 20, fontWeight: 700,
            color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.14em", textTransform: "uppercase",
            marginTop: 10, marginBottom: 36,
          }}>
            {bigStatLabel}
          </div>
        )}

        {/* Heading */}
        <div style={{
          fontSize: 40, fontWeight: 900, color: "#fff",
          lineHeight: 1.18, letterSpacing: "-0.02em",
          textTransform: "uppercase",
        }}>
          {heading}
        </div>

        {/* Subheading */}
        {subheading && (
          <div style={{
            fontSize: 22, color: "rgba(255,255,255,0.38)",
            marginTop: 10, marginBottom: 36,
            lineHeight: 1.4,
          }}>
            {subheading}
          </div>
        )}

        {/* Bullets */}
        {bullets && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: ACCENT,
                  flexShrink: 0, marginTop: 10,
                  boxShadow: `0 0 8px ${ACCENT}70`,
                }} />
                <div style={{
                  fontSize: 24, color: "rgba(255,255,255,0.58)",
                  lineHeight: 1.4, letterSpacing: "-0.005em",
                }}>
                  {b}
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
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
