import {
  TemplateCanvas, LogoBar, AccentLine, ChartRow, CTAFooter,
  SectionLabel, PlatformBadge, ACCENT,
} from "../components";
import type { ChartRowData } from "../components";

const ARTISTS: ChartRowData[] = [
  { rank: 1, title: "Peso Pluma",       subtitle: "Guadalajara, MX",        stat: "47.1M", statLabel: "Oyentes", movement: 0 },
  { rank: 2, title: "Grupo Frontera",   subtitle: "Tamaulipas, MX",         stat: "38.5M", statLabel: "Oyentes", movement: 1 },
  { rank: 3, title: "Fuerza Regida",    subtitle: "Sinaloa, MX",            stat: "22.4M", statLabel: "Oyentes", movement: -1 },
  { rank: 4, title: "Natanael Cano",    subtitle: "Sonora, MX",             stat: "19.7M", statLabel: "Oyentes", movement: 0 },
  { rank: 5, title: "Junior H",         subtitle: "Guanajuato, MX",         stat: "16.3M", statLabel: "Oyentes", movement: 2 },
  { rank: 6, title: "Carin León",       subtitle: "Sonora, MX",             stat: "14.8M", statLabel: "Oyentes", movement: -1 },
  { rank: 7, title: "Banda MS",         subtitle: "Sinaloa, MX",            stat: "12.9M", statLabel: "Oyentes", movement: 1 },
  { rank: 8, title: "Eslabon Armado",   subtitle: "California / MX",        stat: "11.4M", statLabel: "Oyentes", isNew: true },
  { rank: 9, title: "Grupo Firme",      subtitle: "Sinaloa, MX",            stat: "10.7M", statLabel: "Oyentes", movement: -2 },
  { rank: 10, title: "Luis Miguel",     subtitle: "Ciudad de México, MX",   stat: "9.3M",  statLabel: "Oyentes", movement: 0 },
];

export default function DailyTopArtists() {
  return (
    <TemplateCanvas>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 500,
        background: `radial-gradient(ellipse 70% 90% at 50% -10%, ${ACCENT}0d 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <LogoBar date="13 Mayo 2026" />
      <AccentLine />

      <div style={{ padding: "30px 64px 24px" }}>
        <SectionLabel>Top Artistas</SectionLabel>
        <div style={{
          fontSize: 90, fontWeight: 900, color: "#fff",
          letterSpacing: "-0.045em", lineHeight: 0.86,
          textTransform: "uppercase", marginTop: 6,
        }}>
          DIARIOS
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 22, alignItems: "center" }}>
          <PlatformBadge platform="spotify" />
          <PlatformBadge platform="apple" active={false} />
        </div>
      </div>

      <AccentLine opacity={0.25} />

      <div style={{
        display: "flex", padding: "0 64px", height: 44, alignItems: "center", gap: 18,
      }}>
        <div style={{ width: 56 }} />
        <div style={{ width: 44 }} />
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.18em", textTransform: "uppercase" }}>Artista · Origen</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.18em", textTransform: "uppercase" }}>Oyentes</div>
      </div>

      <AccentLine opacity={0.12} />

      <div>{ARTISTS.map(a => <ChartRow key={a.rank} row={a} compact />)}</div>

      <AccentLine opacity={0.1} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
