import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, LargeStatNum, StatPill, SourceFooter, CinematicPhoto, ACCENT,
} from "../components";

interface TourProps {
  tourName?: string;
  artist?: string;
  grossValue?: string;
  grossLabel?: string;
  tickets?: string;
  shows?: string;
  avgGross?: string;
  cities?: string;
  dateRange?: string;
  source?: string;
  photoUrl?: string;
}

const DEFAULTS: TourProps = {
  tourName: "Éxodo Tour",
  artist: "Peso Pluma",
  grossValue: "$82M USD",
  grossLabel: "Recaudación total estimada",
  tickets: "780K",
  shows: "62",
  avgGross: "$1.3M",
  cities: "38",
  dateRange: "2025–2026",
  source: "Pollstar · México Charts",
};

export default function TouringData({
  tourName = DEFAULTS.tourName,
  artist = DEFAULTS.artist,
  grossValue = DEFAULTS.grossValue,
  grossLabel = DEFAULTS.grossLabel,
  tickets = DEFAULTS.tickets,
  shows = DEFAULTS.shows,
  avgGross = DEFAULTS.avgGross,
  cities = DEFAULTS.cities,
  dateRange = DEFAULTS.dateRange,
  source = DEFAULTS.source,
  photoUrl,
}: TourProps = {}) {
  const hasPhoto = !!photoUrl;

  return (
    <TemplateCanvas>
      {/* Cinematic artist photo — if provided */}
      {hasPhoto && <CinematicPhoto src={photoUrl!} position="center 20%" darken={0.65} emeraldOverlay={0.06} blur />}

      {/* Stage-like bottom glow */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 700,
        background: `radial-gradient(ellipse 70% 50% at 50% 110%, ${ACCENT}18 0%, transparent 60%)`,
        filter: "blur(20px)",
        pointerEvents: "none",
      }} />

      {/* Spotlight lines from bottom center */}
      {[-25, -8, 8, 25].map((angle, i) => (
        <div key={i} style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          width: 2,
          height: "60%",
          background: `linear-gradient(to top, ${ACCENT}${["20","12","12","20"][i]}, transparent)`,
          transform: `translateX(-50%) rotate(${angle}deg)`,
          transformOrigin: "bottom center",
          pointerEvents: "none",
          filter: "blur(1px)",
        }} />
      ))}

      {/* Top haze */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 400,
        background: `radial-gradient(ellipse 70% 60% at 50% -10%, ${ACCENT}0b 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />

      <LogoBar date={dateRange} source="Touring" />
      <AccentLine />

      <div style={{ padding: "44px 64px 0", position: "relative", zIndex: 2 }}>
        <SectionLabel>Touring · Recaudación</SectionLabel>

        {/* Tour name — dominant typography */}
        <div style={{
          fontSize: 106,
          fontWeight: 900,
          color: "#fff",
          letterSpacing: "-0.05em",
          lineHeight: 0.84,
          textTransform: "uppercase",
          marginTop: 8,
          textShadow: hasPhoto ? "0 4px 50px rgba(0,0,0,0.9)" : "none",
        }}>
          {tourName?.toUpperCase()}
        </div>

        {/* Artist name */}
        <div style={{
          fontSize: 30,
          fontWeight: 700,
          color: `${ACCENT}CC`,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          marginTop: 12,
          textShadow: `0 0 30px ${ACCENT}40`,
        }}>
          {artist}
        </div>

        {/* Divider */}
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          margin: "32px 0",
        }}>
          <div style={{ width: 64, height: 3, background: ACCENT, borderRadius: 2, boxShadow: `0 0 20px ${ACCENT}70` }} />
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Main gross */}
        <LargeStatNum value={grossValue!} label={grossLabel} size={104} watermark />

        {/* Stats grid */}
        <div style={{
          display: "flex", gap: 14, marginTop: 44,
        }}>
          <StatPill label="Boletos vendidos" value={tickets!} />
          <StatPill label="Shows" value={shows!} />
          <StatPill label="Gross promedio" value={avgGross!} />
          <StatPill label="Ciudades" value={cities!} />
        </div>

        <div style={{ marginTop: 40 }}>
          <SourceFooter source={source} date={dateRange} />
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <AccentLine opacity={0.1} />
      <CTAFooter />
    </TemplateCanvas>
  );
}
