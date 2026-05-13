import {
  TemplateCanvas, LogoBar, AccentLine, ChartRow, CTAFooter,
  SectionLabel, PlatformBadge, MovementBadge, ACCENT,
} from "../components";
import type { ChartRowData } from "../components";

const TOP3: ChartRowData[] = [
  { rank: 1, title: "Ella Baila Sola",  subtitle: "Peso Pluma · Eslabon Armado", stat: "21.4M", movement: 0,  peak: 1, weeks: 12 },
  { rank: 2, title: "Cupido",           subtitle: "TINI · Myke Towers",          stat: "18.9M", movement: 1,  peak: 2, weeks: 8  },
  { rank: 3, title: "LALA",             subtitle: "Myke Towers",                 stat: "16.7M", movement: -1, peak: 1, weeks: 5  },
];
const REST: ChartRowData[] = [
  { rank: 4, title: "La Bebe (Remix)",      subtitle: "Peso Pluma · Yng Lvcas",    stat: "14.2M", movement: 2,  peak: 3,  weeks: 7  },
  { rank: 5, title: "Chanel",               subtitle: "Bizarrap · Peso Pluma",      stat: "13.1M", movement: 0,  peak: 5,  weeks: 4  },
  { rank: 6, title: "Cayó La Noche",        subtitle: "Junior H · Peso Pluma",      stat: "11.8M", movement: -2, peak: 4,  weeks: 10 },
  { rank: 7, title: "Un Fin de Semana",     subtitle: "Carin León",                 stat: "10.4M", movement: 3,  peak: 6,  weeks: 3  },
  { rank: 8, title: "El Azul",              subtitle: "Fuerza Regida · Peso Pluma", stat: "9.7M",  isNew: true,  peak: 8,  weeks: 1  },
  { rank: 9, title: "Según Quién",          subtitle: "Carin León",                 stat: "8.9M",  movement: -1, peak: 7,  weeks: 6  },
  { rank: 10, title: "Génesis",             subtitle: "Peso Pluma",                 stat: "8.2M",  movement: 0,  peak: 10, weeks: 2  },
];

export default function WeeklyTopSongs() {
  return (
    <TemplateCanvas>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 600,
        background: `radial-gradient(ellipse 80% 100% at 50% -5%, ${ACCENT}10 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      <LogoBar date="Semana del 13 Mayo" />
      <AccentLine />

      {/* Header */}
      <div style={{ padding: "28px 64px 20px" }}>
        <SectionLabel>Top Canciones</SectionLabel>
        <div style={{
          fontSize: 80, fontWeight: 900, color: "#fff",
          letterSpacing: "-0.04em", lineHeight: 0.88,
          textTransform: "uppercase", marginTop: 6,
        }}>
          SEMANALES
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <PlatformBadge platform="spotify" />
        </div>
      </div>

      <AccentLine opacity={0.3} />

      {/* Top 3 — editorial treatment */}
      {TOP3.map((s) => (
        <div key={s.rank} style={{
          display: "flex", alignItems: "center", padding: "0 64px",
          height: 90,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: s.rank === 1 ? `${ACCENT}0a` : "transparent",
          gap: 18,
        }}>
          <div style={{
            width: 56, fontSize: s.rank === 1 ? 40 : 32, fontWeight: 900,
            color: s.rank === 1 ? ACCENT : "rgba(255,255,255,0.3)",
            letterSpacing: "-0.03em",
          }}>
            {String(s.rank).padStart(2, "0")}
          </div>
          <MovementBadge movement={s.movement} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: s.rank === 1 ? 30 : 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.title}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <span style={{ fontSize: 17, color: "rgba(255,255,255,0.28)" }}>{s.subtitle}</span>
              <span style={{ fontSize: 15, color: "rgba(255,255,255,0.16)", letterSpacing: "0.06em" }}>PICO #{s.peak}</span>
              <span style={{ fontSize: 15, color: "rgba(255,255,255,0.16)", letterSpacing: "0.06em" }}>{s.weeks} SEM</span>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: ACCENT, letterSpacing: "-0.02em" }}>{s.stat}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>Streams</div>
          </div>
        </div>
      ))}

      {/* Divider */}
      <div style={{
        display: "flex", alignItems: "center", padding: "0 64px", height: 36,
        background: "rgba(57,255,20,0.04)",
      }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
        <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", padding: "0 16px" }}>Posiciones 4–10</div>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
      </div>

      {/* 4–10 compact */}
      <div>{REST.map(s => <ChartRow key={s.rank} row={s} compact showMeta />)}</div>

      <AccentLine opacity={0.1} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
