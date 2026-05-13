import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, LargeStatNum, SourceFooter, ACCENT,
} from "../components";

interface MilestoneProps {
  artistName?: string;
  milestoneValue?: string;
  milestoneLabel?: string;
  headline?: string;
  supportingStat?: string;
  source?: string;
  date?: string;
}

const DEFAULTS: MilestoneProps = {
  artistName: "Peso Pluma",
  milestoneValue: "10B",
  milestoneLabel: "Streams en Spotify",
  headline: "supera los 10 mil millones\nde streams en Spotify",
  supportingStat: "Primer artista regional mexicano en alcanzar este hito · 38 países en el Top 50",
  source: "Spotify",
  date: "Mayo 2026",
};

export default function ArtistMilestone({
  artistName = DEFAULTS.artistName,
  milestoneValue = DEFAULTS.milestoneValue,
  milestoneLabel = DEFAULTS.milestoneLabel,
  headline = DEFAULTS.headline,
  supportingStat = DEFAULTS.supportingStat,
  source = DEFAULTS.source,
  date = DEFAULTS.date,
}: MilestoneProps = {}) {
  return (
    <TemplateCanvas>
      {/* Giant number watermark */}
      <div style={{
        position: "absolute",
        right: -60, bottom: 200,
        fontSize: 420,
        fontWeight: 900,
        color: "rgba(57,255,20,0.04)",
        letterSpacing: "-0.06em",
        lineHeight: 1,
        pointerEvents: "none",
        userSelect: "none",
      }}>
        {milestoneValue}
      </div>

      {/* Atmospheric glow — bottom right */}
      <div style={{
        position: "absolute", bottom: 0, right: 0,
        width: 700, height: 700,
        background: `radial-gradient(circle at 80% 80%, ${ACCENT}14 0%, transparent 65%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
      }} />

      <LogoBar date={date} source={source} />
      <AccentLine />

      {/* Main content */}
      <div style={{ padding: "60px 64px 0", flex: 1 }}>
        {/* Artist label */}
        <SectionLabel>Hito · Logro</SectionLabel>

        {/* Artist name */}
        <div style={{
          fontSize: 100,
          fontWeight: 900,
          color: "#fff",
          letterSpacing: "-0.05em",
          lineHeight: 0.88,
          textTransform: "uppercase",
          marginTop: 12,
        }}>
          {artistName?.toUpperCase()}
        </div>

        {/* Accent line */}
        <div style={{
          width: 80, height: 4, background: ACCENT,
          boxShadow: `0 0 20px ${ACCENT}60`,
          marginTop: 32, marginBottom: 44,
          borderRadius: 2,
        }} />

        {/* Big stat */}
        <LargeStatNum value={milestoneValue!} label={milestoneLabel} size={130} />

        {/* Headline */}
        <div style={{
          fontSize: 38,
          fontWeight: 700,
          color: "rgba(255,255,255,0.72)",
          lineHeight: 1.32,
          marginTop: 44,
          maxWidth: 700,
          letterSpacing: "-0.01em",
        }}>
          {headline?.split("\n").map((line, i) => (
            <span key={i}>{line}{i < (headline?.split("\n").length ?? 0) - 1 && <br />}</span>
          ))}
        </div>

        {/* Supporting stat */}
        {supportingStat && (
          <div style={{
            marginTop: 36,
            padding: "20px 28px",
            background: `${ACCENT}0a`,
            border: `1px solid ${ACCENT}20`,
            borderLeft: `3px solid ${ACCENT}`,
            borderRadius: "0 8px 8px 0",
            fontSize: 21,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.5,
            maxWidth: 680,
          }}>
            {supportingStat}
          </div>
        )}
      </div>

      <div style={{ padding: "40px 64px 32px" }}>
        <SourceFooter source={source} date={date} />
      </div>

      <AccentLine opacity={0.12} />
      <CTAFooter />
    </TemplateCanvas>
  );
}
