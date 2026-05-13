import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, LargeStatNum, StatPill, SourceFooter, ACCENT,
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
}: TourProps = {}) {
  return (
    <TemplateCanvas>
      {/* Stage-like atmospheric gradient */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          radial-gradient(ellipse 60% 40% at 50% 110%, ${ACCENT}12 0%, transparent 60%),
          radial-gradient(ellipse 100% 50% at 50% 100%, rgba(255,255,255,0.03) 0%, transparent 50%)
        `,
        pointerEvents: "none",
      }} />

      {/* Spotlight lines from bottom */}
      {[-30, -10, 10, 30].map((angle, i) => (
        <div key={i} style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          width: 2,
          height: "55%",
          background: `linear-gradient(to top, ${ACCENT}${["18","10","10","18"][i]}, transparent)`,
          transform: `translateX(-50%) rotate(${angle}deg)`,
          transformOrigin: "bottom center",
          pointerEvents: "none",
        }} />
      ))}

      <LogoBar date={dateRange} source="Touring" />
      <AccentLine />

      <div style={{ padding: "52px 64px 0" }}>
        <SectionLabel>Touring · Recaudación</SectionLabel>

        {/* Tour name */}
        <div style={{
          fontSize: 86,
          fontWeight: 900,
          color: "#fff",
          letterSpacing: "-0.045em",
          lineHeight: 0.86,
          textTransform: "uppercase",
          marginTop: 10,
        }}>
          {tourName?.toUpperCase()}
        </div>

        {/* Artist */}
        <div style={{
          fontSize: 30,
          fontWeight: 700,
          color: `${ACCENT}CC`,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginTop: 14,
        }}>
          {artist}
        </div>

        {/* Divider */}
        <div style={{
          width: "100%", height: 1,
          background: "rgba(255,255,255,0.07)",
          margin: "36px 0",
        }} />

        {/* Main gross */}
        <LargeStatNum value={grossValue!} label={grossLabel} size={108} />

        {/* Stats grid */}
        <div style={{
          display: "flex", gap: 16, marginTop: 48,
        }}>
          <StatPill label="Boletos vendidos" value={tickets!} />
          <StatPill label="Shows" value={shows!} />
          <StatPill label="Gross promedio" value={avgGross!} />
          <StatPill label="Ciudades" value={cities!} />
        </div>

        {/* Source */}
        <div style={{ marginTop: 44 }}>
          <SourceFooter source={source} date={dateRange} />
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <AccentLine opacity={0.12} />
      <CTAFooter />
    </TemplateCanvas>
  );
}
