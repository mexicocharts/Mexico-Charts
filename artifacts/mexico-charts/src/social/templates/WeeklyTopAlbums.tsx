import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, AlbumFrame, MovementBadge, ACCENT,
} from "../components";

interface AlbumEntry {
  rank: number;
  title: string;
  artist: string;
  stat: string;
  movement?: number;
  isNew?: boolean;
  weeks?: number;
  peak?: number;
}

const ALBUMS: AlbumEntry[] = [
  { rank: 1, title: "Génesis",            artist: "Peso Pluma",        stat: "68.4M",  movement: 0,  weeks: 8,  peak: 1 },
  { rank: 2, title: "Pa'Las Baby's",      artist: "Fuerza Regida",     stat: "52.1M",  movement: 1,  weeks: 5,  peak: 2 },
  { rank: 3, title: "Corridos Tumbados", artist: "Natanael Cano",     stat: "44.7M",  movement: -1, weeks: 12, peak: 1 },
  { rank: 4, title: "Primera Cita",       artist: "Carin León",        stat: "38.2M",  movement: 2,  weeks: 6,  peak: 3 },
  { rank: 5, title: "Del Rancho",         artist: "Grupo Frontera",    stat: "29.8M",  isNew: true,  weeks: 1,  peak: 5 },
];

export default function WeeklyTopAlbums() {
  return (
    <TemplateCanvas>
      {/* Atmospheric glow */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 600,
        background: `radial-gradient(ellipse 80% 100% at 50% -5%, ${ACCENT}0e 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      <LogoBar date="Semana del 13 Mayo" />
      <AccentLine />

      {/* Header */}
      <div style={{ padding: "30px 64px 24px" }}>
        <SectionLabel>Top Álbumes</SectionLabel>
        <div style={{
          fontSize: 80, fontWeight: 900, color: "#fff",
          letterSpacing: "-0.04em", lineHeight: 0.88,
          textTransform: "uppercase", marginTop: 6,
        }}>
          SEMANALES
        </div>
        <div style={{ marginTop: 14, fontSize: 19, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
          Streams totales del álbum · México
        </div>
      </div>

      <AccentLine opacity={0.25} />

      {/* Album rows */}
      <div style={{ padding: "8px 0" }}>
        {ALBUMS.map((a) => (
          <div key={a.rank} style={{
            display: "flex",
            alignItems: "center",
            padding: "20px 64px",
            gap: 28,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: a.rank === 1 ? `${ACCENT}07` : "transparent",
          }}>
            {/* Album art frame */}
            <AlbumFrame size={150} rank={a.rank} accent={ACCENT} />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 28, fontWeight: 900,
                color: a.rank <= 2 ? "#fff" : "rgba(255,255,255,0.85)",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {a.title}
              </div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.38)", marginTop: 5 }}>
                {a.artist}
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 14, alignItems: "center" }}>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.18)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Pico #{a.peak}
                </div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.18)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {a.weeks} {a.weeks === 1 ? "Semana" : "Semanas"}
                </div>
              </div>
            </div>

            {/* Right: streams + movement */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{
                fontSize: 28, fontWeight: 900,
                color: a.rank <= 2 ? ACCENT : "rgba(255,255,255,0.5)",
                letterSpacing: "-0.02em",
              }}>
                {a.stat}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4, marginBottom: 8 }}>
                streams
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <MovementBadge movement={a.movement} isNew={a.isNew} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <AccentLine opacity={0.1} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
