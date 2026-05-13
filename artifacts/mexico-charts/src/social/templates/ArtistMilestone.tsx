import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, LargeStatNum, SourceFooter, CinematicPhoto, ACCENT,
} from "../components";

interface MilestoneProps {
  artistName?: string;
  milestoneValue?: string;
  milestoneLabel?: string;
  headline?: string;
  supportingStat?: string;
  source?: string;
  date?: string;
  photoUrl?: string;
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
  photoUrl,
}: MilestoneProps = {}) {
  const hasPhoto = !!photoUrl;

  return (
    <TemplateCanvas>
      {/* Cinematic artist photo — if provided */}
      {hasPhoto && <CinematicPhoto src={photoUrl!} position="center top" darken={0.7} emeraldOverlay={0.05} blur />}

      {/* Giant number watermark — behind content */}
      <div style={{
        position: "absolute",
        right: -50,
        top: "18%",
        fontSize: 480,
        fontWeight: 900,
        color: hasPhoto ? "rgba(57,255,20,0.05)" : "rgba(57,255,20,0.04)",
        letterSpacing: "-0.07em",
        lineHeight: 1,
        pointerEvents: "none",
        userSelect: "none",
      }}>
        {milestoneValue}
      </div>

      {/* Atmospheric glow — bottom left (no photo) or universal */}
      <div style={{
        position: "absolute", bottom: -60, left: -80,
        width: 700, height: 700,
        background: `radial-gradient(circle at 30% 70%, ${ACCENT}18 0%, transparent 60%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
      }} />

      {/* Top glow */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 400,
        background: `radial-gradient(ellipse 60% 70% at 50% -10%, ${ACCENT}0e 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      <LogoBar date={date} source={source} />
      <AccentLine />

      {/* Main content */}
      <div style={{ padding: "52px 64px 0", flex: 1, position: "relative", zIndex: 2 }}>
        <SectionLabel>Hito · Logro</SectionLabel>

        {/* Artist name — cinematic scale */}
        <div style={{
          fontSize: 108,
          fontWeight: 900,
          color: hasPhoto ? "#fff" : "#fff",
          letterSpacing: "-0.055em",
          lineHeight: 0.84,
          textTransform: "uppercase",
          marginTop: 10,
          textShadow: hasPhoto ? "0 4px 40px rgba(0,0,0,0.9)" : "none",
        }}>
          {artistName?.toUpperCase()}
        </div>

        {/* Emerald accent bar */}
        <div style={{
          width: 96, height: 4, background: ACCENT,
          boxShadow: `0 0 28px ${ACCENT}70, 0 0 60px ${ACCENT}30`,
          marginTop: 28, marginBottom: 40,
          borderRadius: 2,
        }} />

        {/* Big stat number */}
        <LargeStatNum
          value={milestoneValue!}
          label={milestoneLabel}
          size={136}
          watermark={false}
        />

        {/* Headline */}
        <div style={{
          fontSize: 36,
          fontWeight: 700,
          color: hasPhoto ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.7)",
          lineHeight: 1.35,
          marginTop: 40,
          maxWidth: 720,
          letterSpacing: "-0.01em",
        }}>
          {headline?.split("\n").map((line, i) => (
            <span key={i}>{line}{i < (headline?.split("\n").length ?? 0) - 1 && <br />}</span>
          ))}
        </div>

        {/* Supporting stat — left-border callout */}
        {supportingStat && (
          <div style={{
            marginTop: 32,
            padding: "18px 26px",
            background: `${ACCENT}09`,
            border: `1px solid ${ACCENT}22`,
            borderLeft: `4px solid ${ACCENT}`,
            borderRadius: "0 8px 8px 0",
            fontSize: 20,
            color: "rgba(255,255,255,0.42)",
            lineHeight: 1.5,
            maxWidth: 700,
            boxShadow: `inset 0 0 40px ${ACCENT}06`,
          }}>
            {supportingStat}
          </div>
        )}
      </div>

      <div style={{ padding: "32px 64px 24px", position: "relative", zIndex: 2 }}>
        <SourceFooter source={source} date={date} />
      </div>

      <AccentLine opacity={0.1} />
      <CTAFooter />
    </TemplateCanvas>
  );
}
