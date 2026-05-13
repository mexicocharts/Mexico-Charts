import {
  TemplateCanvas, LogoBar, AccentLine, ChartRow, CTAFooter,
  SectionLabel, PlatformBadge, ACCENT,
} from "../components";
import type { ChartRowData } from "../components";

const SONGS: ChartRowData[] = [
  { rank: 1, title: "Ella Baila Sola",         subtitle: "Peso Pluma · Eslabon Armado", stat: "3.2M", movement: 0 },
  { rank: 2, title: "LALA",                     subtitle: "Myke Towers",                 stat: "2.9M", movement: 2 },
  { rank: 3, title: "Cupido",                   subtitle: "TINI · Myke Towers",          stat: "2.6M", movement: -1 },
  { rank: 4, title: "La Bebe (Remix)",          subtitle: "Peso Pluma · Yng Lvcas",      stat: "2.3M", movement: 1 },
  { rank: 5, title: "Chanel",                   subtitle: "Bizarrap · Peso Pluma",        stat: "2.1M", movement: 0 },
  { rank: 6, title: "Cayó La Noche",            subtitle: "Junior H · Peso Pluma",        stat: "1.9M", movement: -2 },
  { rank: 7, title: "Un Fin de Semana",         subtitle: "Carin León",                   stat: "1.7M", movement: 3 },
  { rank: 8, title: "Según Quién",              subtitle: "Carin León",                   stat: "1.6M", movement: 0 },
  { rank: 9, title: "El Azul",                  subtitle: "Fuerza Regida · Peso Pluma",   stat: "1.5M", isNew: true },
  { rank: 10, title: "La Noche de Anoche",      subtitle: "Bad Bunny · Rosalía",          stat: "1.4M", movement: -3 },
];

export default function DailyTopSongs() {
  return (
    <TemplateCanvas>
      {/* Atmospheric top glow */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 500,
        background: `radial-gradient(ellipse 70% 90% at 50% -10%, ${ACCENT}0d 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <LogoBar date="13 Mayo 2026" />
      <AccentLine />

      {/* Header */}
      <div style={{ padding: "30px 64px 24px" }}>
        <SectionLabel>Top Canciones</SectionLabel>
        <div style={{
          fontSize: 90, fontWeight: 900, color: "#fff",
          letterSpacing: "-0.045em", lineHeight: 0.86,
          textTransform: "uppercase", marginTop: 6,
        }}>
          DIARIAS
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 22, alignItems: "center" }}>
          <PlatformBadge platform="spotify" />
          <PlatformBadge platform="apple" active={false} />
          <PlatformBadge platform="youtube" active={false} />
        </div>
      </div>

      <AccentLine opacity={0.25} />

      {/* Row header */}
      <div style={{
        display: "flex", padding: "0 64px", height: 44, alignItems: "center", gap: 18,
      }}>
        <div style={{ width: 56 }} />
        <div style={{ width: 44 }} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.18em", textTransform: "uppercase" }}>Canción · Artista</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.18em", textTransform: "uppercase" }}>Streams</div>
      </div>

      <AccentLine opacity={0.12} />

      {/* Chart */}
      <div>{SONGS.map(s => <ChartRow key={s.rank} row={s} compact />)}</div>

      <div style={{ flex: 1 }} />
      <AccentLine opacity={0.1} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
