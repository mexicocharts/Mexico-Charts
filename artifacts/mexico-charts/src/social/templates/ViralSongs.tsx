import {
  TemplateCanvas, LogoBar, AccentLine, ChartRow, CTAFooter,
  SectionLabel, PlatformBadge, ACCENT,
} from "../components";
import type { ChartRowData } from "../components";

const VIRAL: ChartRowData[] = [
  { rank: 1,  title: "El Azul",             subtitle: "Fuerza Regida · Peso Pluma", stat: "↑ 840%", isNew: true },
  { rank: 2,  title: "Chuy",                subtitle: "Junior H",                   stat: "↑ 610%", movement: 2 },
  { rank: 3,  title: "Primera Cita",        subtitle: "Carin León",                 stat: "↑ 490%", isNew: true },
  { rank: 4,  title: "El Mechón",           subtitle: "Natanael Cano",              stat: "↑ 380%", movement: -1 },
  { rank: 5,  title: "Quedate",             subtitle: "Grupo Frontera",             stat: "↑ 310%", movement: 1 },
  { rank: 6,  title: "Chabelo",             subtitle: "Peso Pluma",                 stat: "↑ 280%", movement: 0 },
  { rank: 7,  title: "Del Rancho",          subtitle: "Grupo Frontera",             stat: "↑ 240%", isNew: true },
  { rank: 8,  title: "La Noche de Anoche", subtitle: "Bad Bunny · Rosalía",        stat: "↑ 195%", movement: -3 },
  { rank: 9,  title: "Mente en Blanco",    subtitle: "Junior H",                   stat: "↑ 175%", movement: 2 },
  { rank: 10, title: "Playa Grande",        subtitle: "Carin León",                 stat: "↑ 160%", movement: 0 },
];

export default function ViralSongs() {
  return (
    <TemplateCanvas>
      {/* Intense green radial — top central */}
      <div style={{
        position: "absolute", top: "-15%", left: "50%",
        transform: "translateX(-50%)",
        width: 1000, height: 800,
        background: `radial-gradient(ellipse at 50% 50%, ${ACCENT}28 0%, ${ACCENT}0a 30%, transparent 68%)`,
        filter: "blur(30px)",
        pointerEvents: "none",
      }} />

      {/* Secondary glow — bottom right, softer */}
      <div style={{
        position: "absolute", bottom: -100, right: -100,
        width: 600, height: 600,
        background: `radial-gradient(circle, ${ACCENT}0a 0%, transparent 65%)`,
        filter: "blur(80px)",
        pointerEvents: "none",
      }} />

      {/* Motion streak lines — diagonal energy */}
      {[...Array(7)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${6 + i * 9}%`,
          left: 0, right: 0,
          height: i % 2 === 0 ? 1.5 : 1,
          background: `linear-gradient(to right, transparent 5%, ${ACCENT}${["12","0a","07","05","07","0a","0d"][i]}, transparent 95%)`,
          pointerEvents: "none",
        }} />
      ))}

      <LogoBar date="13 Mayo 2026" />
      <AccentLine color={ACCENT} opacity={0.9} />

      {/* Header */}
      <div style={{ padding: "28px 64px 14px", position: "relative", zIndex: 2 }}>
        <SectionLabel>Tendencias · TikTok &amp; Redes</SectionLabel>
        <div style={{
          fontSize: 116,
          fontWeight: 900,
          letterSpacing: "-0.05em",
          lineHeight: 0.84,
          textTransform: "uppercase",
          marginTop: 4,
        }}>
          <span style={{ color: "#fff" }}>VIRAL</span>
          {" "}
          <span style={{
            color: ACCENT,
            textShadow: `0 0 50px ${ACCENT}80, 0 0 100px ${ACCENT}35, 0 0 180px ${ACCENT}15`,
          }}>MÉXICO</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <PlatformBadge platform="tiktok" />
          <PlatformBadge platform="spotify" active={false} />
        </div>
      </div>

      {/* Column header with green accent */}
      <div style={{
        display: "flex", padding: "0 64px", height: 42, alignItems: "center", gap: 18,
        background: `linear-gradient(90deg, ${ACCENT}09 0%, transparent 70%)`,
        borderTop: `1px solid ${ACCENT}18`,
        borderBottom: `1px solid ${ACCENT}12`,
        position: "relative", zIndex: 2,
      }}>
        <div style={{ width: 56 }} />
        <div style={{ width: 44 }} />
        <div style={{ flex: 1, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Canción · Artista
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: `${ACCENT}90`, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Crecimiento
        </div>
      </div>

      <div>{VIRAL.map(s => <ChartRow key={s.rank} row={s} compact accent={ACCENT} />)}</div>

      <div style={{ flex: 1 }} />
      <AccentLine color={ACCENT} opacity={0.2} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
