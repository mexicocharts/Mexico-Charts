import {
  TemplateCanvas, LogoBar, AccentLine, ChartRow, CTAFooter,
  SectionLabel, PlatformBadge, ACCENT, NOISE,
} from "../components";
import type { ChartRowData } from "../components";

const VIRAL: ChartRowData[] = [
  { rank: 1,  title: "El Azul",              subtitle: "Fuerza Regida · Peso Pluma", stat: "↑ 840%", isNew: true },
  { rank: 2,  title: "Chuy",                 subtitle: "Junior H",                   stat: "↑ 610%", movement: 2 },
  { rank: 3,  title: "Primera Cita",         subtitle: "Carin León",                 stat: "↑ 490%", isNew: true },
  { rank: 4,  title: "El Mechón",            subtitle: "Natanael Cano",              stat: "↑ 380%", movement: -1 },
  { rank: 5,  title: "Quedate",              subtitle: "Grupo Frontera",             stat: "↑ 310%", movement: 1 },
  { rank: 6,  title: "Chabelo",              subtitle: "Peso Pluma",                 stat: "↑ 280%", movement: 0 },
  { rank: 7,  title: "Del Rancho",           subtitle: "Grupo Frontera",             stat: "↑ 240%", isNew: true },
  { rank: 8,  title: "La Noche de Anoche",  subtitle: "Bad Bunny · Rosalía",        stat: "↑ 195%", movement: -3 },
  { rank: 9,  title: "Mente en Blanco",     subtitle: "Junior H",                   stat: "↑ 175%", movement: 2 },
  { rank: 10, title: "Playa Grande",         subtitle: "Carin León",                 stat: "↑ 160%", movement: 0 },
];

export default function ViralSongs() {
  return (
    <TemplateCanvas>
      {/* Intense green radial glow */}
      <div style={{
        position: "absolute", top: "-10%", left: "50%",
        transform: "translateX(-50%)",
        width: 900, height: 700,
        background: `radial-gradient(ellipse at 50% 50%, ${ACCENT}20 0%, ${ACCENT}08 35%, transparent 70%)`,
        filter: "blur(40px)",
        pointerEvents: "none",
      }} />

      {/* Motion lines */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${10 + i * 8}%`,
          left: 0, right: 0,
          height: 1,
          background: `linear-gradient(to right, transparent, ${ACCENT}${["0a","08","06","04","06","08"][i]}, transparent)`,
          pointerEvents: "none",
        }} />
      ))}

      <LogoBar date="13 Mayo 2026" />
      <AccentLine />

      {/* Header */}
      <div style={{ padding: "30px 64px 16px" }}>
        <SectionLabel>Tendencias · TikTok &amp; Redes</SectionLabel>
        <div style={{
          fontSize: 86, fontWeight: 900,
          letterSpacing: "-0.045em", lineHeight: 0.86,
          textTransform: "uppercase", marginTop: 6,
        }}>
          <span style={{ color: "#fff" }}>VIRAL</span>
          {" "}
          <span style={{
            color: ACCENT,
            textShadow: `0 0 40px ${ACCENT}60, 0 0 80px ${ACCENT}25`,
          }}>MÉXICO</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <PlatformBadge platform="tiktok" />
          <PlatformBadge platform="spotify" active={false} />
        </div>
      </div>

      <AccentLine color={ACCENT} opacity={0.5} />

      {/* Subheader */}
      <div style={{
        display: "flex", padding: "0 64px", height: 44, alignItems: "center", gap: 18,
        background: `${ACCENT}06`,
      }}>
        <div style={{ width: 56 }} />
        <div style={{ width: 44 }} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.2)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
          Canción · Artista
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: `${ACCENT}80`, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          Crecimiento
        </div>
      </div>

      <div>{VIRAL.map(s => <ChartRow key={s.rank} row={s} compact accent={ACCENT} />)}</div>

      <AccentLine color={ACCENT} opacity={0.15} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
