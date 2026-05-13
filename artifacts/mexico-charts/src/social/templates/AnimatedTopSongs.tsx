import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, PlatformBadge, MovementBadge, ACCENT,
} from "../components";
import type { ChartRowData } from "../components";
import { useSpotifyChart, parseMovement, fmtStreams } from "../useChartData";
import { useAnimLoop } from "../useAnimLoop";

const ANIM_CSS = `
@keyframes mcSlideIn {
  from { opacity: 0; transform: translateX(-30px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes mcFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes mcPopIn {
  0%   { transform: scale(0.5); opacity: 0; }
  65%  { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes mcCountUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

const FALLBACK: ChartRowData[] = [
  { rank: 1,  title: "Ella Baila Sola",    subtitle: "Peso Pluma · Eslabon Armado", stat: "3.2M", movement: 0  },
  { rank: 2,  title: "LALA",               subtitle: "Myke Towers",                 stat: "2.9M", movement: 2  },
  { rank: 3,  title: "Cupido",             subtitle: "TINI · Myke Towers",          stat: "2.6M", movement: -1 },
  { rank: 4,  title: "La Bebe (Remix)",    subtitle: "Peso Pluma · Yng Lvcas",      stat: "2.3M", movement: 1  },
  { rank: 5,  title: "Chanel",             subtitle: "Bizarrap · Peso Pluma",        stat: "2.1M", movement: 0  },
  { rank: 6,  title: "Cayó La Noche",      subtitle: "Junior H · Peso Pluma",        stat: "1.9M", movement: -2 },
  { rank: 7,  title: "Un Fin de Semana",   subtitle: "Carin León",                  stat: "1.7M", movement: 3  },
  { rank: 8,  title: "Según Quién",        subtitle: "Carin León",                  stat: "1.6M", movement: 0  },
  { rank: 9,  title: "El Azul",            subtitle: "Fuerza Regida · Peso Pluma",  stat: "1.5M", isNew: true  },
  { rank: 10, title: "La Noche de Anoche", subtitle: "Bad Bunny · Rosalía",         stat: "1.4M", movement: -3 },
];

export default function AnimatedTopSongs() {
  const { data } = useSpotifyChart("daily");
  const { phase, cycle } = useAnimLoop();

  const rows: ChartRowData[] = data?.entries?.slice(0, 10).map(e => ({
    rank: e.pos,
    title: e.title,
    subtitle: [e.artist, ...e.features].join(" · "),
    stat: fmtStreams(e.streams),
    ...parseMovement(e.posChange),
    imageUrl: e.coverUrl,
  })) ?? FALLBACK;

  const date = data
    ? new Date(data.fetchedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "13 Mayo 2026";

  const hasCovers    = !!data;
  const headerVisible = phase !== "intro";
  const outroActive   = phase === "outro";
  const staggerActive = phase === "stagger";
  const rowVisible    = phase !== "intro";

  return (
    <TemplateCanvas>
      <style>{ANIM_CSS}</style>

      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 650,
        background: `radial-gradient(ellipse 80% 85% at 50% -8%, ${ACCENT}0f 0%, ${ACCENT}06 40%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: -80,
        width: 480, height: 480,
        background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 70%)`,
        filter: "blur(60px)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", right: -20, bottom: 120,
        fontSize: 560, fontWeight: 900,
        color: "rgba(57,255,20,0.03)",
        letterSpacing: "-0.07em", lineHeight: 1,
        pointerEvents: "none", userSelect: "none",
      }}>10</div>

      <div style={{
        opacity: outroActive ? 0 : 1,
        transition: outroActive ? "opacity 0.85s ease" : "none",
        display: "flex", flexDirection: "column", flex: 1,
      }}>
        <div style={{ opacity: headerVisible ? 1 : 0, transition: "opacity 0.45s ease" }}>
          <LogoBar date={date} />
          <AccentLine />
          <div style={{ padding: "28px 64px 22px", position: "relative", zIndex: 2 }}>
            <SectionLabel>Top Canciones</SectionLabel>
            <div style={{
              fontSize: 120, fontWeight: 900, color: "#fff",
              letterSpacing: "-0.05em", lineHeight: 0.84,
              textTransform: "uppercase", marginTop: 4,
              textShadow: "0 2px 60px rgba(0,0,0,0.8)",
            }}>DIARIAS</div>
            <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
              <PlatformBadge platform="spotify" />
              <PlatformBadge platform="apple" active={false} />
              <PlatformBadge platform="youtube" active={false} />
            </div>
          </div>
          <AccentLine opacity={0.25} />
          <div style={{
            display: "flex", padding: "0 64px", height: 40, alignItems: "center", gap: 18,
            position: "relative", zIndex: 2,
          }}>
            <div style={{ width: 56 }} />
            <div style={{ width: 44 }} />
            {hasCovers && <div style={{ width: 44 }} />}
            <div style={{ flex: 1, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.16)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Canción · Artista</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.16)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Streams</div>
          </div>
          <AccentLine opacity={0.1} />
        </div>

        <div>
          {rows.map((row, i) => {
            const isTop3 = row.rank <= 3;
            return (
              <div
                key={`${row.rank}-${cycle}`}
                style={{
                  opacity: rowVisible ? 1 : 0,
                  animation: staggerActive
                    ? `mcSlideIn 0.45s cubic-bezier(0.22,1,0.36,1) ${i * 0.13}s both`
                    : "none",
                  display: "flex", alignItems: "center",
                  height: 74,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  gap: 18,
                  background: isTop3
                    ? `linear-gradient(90deg, ${ACCENT}0d 0%, transparent 80%)`
                    : "transparent",
                  padding: "0 64px",
                  position: "relative", zIndex: 2,
                }}
              >
                {row.rank === 1 && (
                  <div style={{
                    position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                    background: `linear-gradient(to bottom, transparent, ${ACCENT}, transparent)`,
                    boxShadow: `2px 0 16px ${ACCENT}50`,
                  }} />
                )}
                <div style={{
                  width: 56, fontSize: isTop3 ? 34 : 24, fontWeight: 900,
                  color: isTop3 ? ACCENT : "rgba(255,255,255,0.18)",
                  flexShrink: 0, letterSpacing: "-0.03em", lineHeight: 1,
                  textShadow: isTop3 ? `0 0 20px ${ACCENT}40` : "none",
                }}>
                  {String(row.rank).padStart(2, "0")}
                </div>
                <MovementBadge movement={row.movement} isNew={row.isNew} size="sm" />
                {/* Album cover */}
                <div style={{
                  width: 44, height: 44, flexShrink: 0, borderRadius: 8,
                  overflow: "hidden",
                  background: `linear-gradient(135deg, #1e1e1e, #0c0c0c)`,
                  border: "1px solid rgba(255,255,255,0.07)",
                  animation: staggerActive
                    ? `mcPopIn 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 0.13 + 0.08}s both`
                    : "none",
                }}>
                  {row.imageUrl ? (
                    <img src={row.imageUrl} alt="" crossOrigin="anonymous"
                      style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.85) contrast(1.05)" }} />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: `radial-gradient(circle at 40% 35%, ${ACCENT}15, #0d0d0d)`,
                    }}>
                      <span style={{ fontSize: 18, color: ACCENT, opacity: 0.3 }}>♪</span>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 22, fontWeight: isTop3 ? 800 : 700,
                    color: isTop3 ? "#fff" : "rgba(255,255,255,0.8)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    letterSpacing: "-0.01em", lineHeight: 1,
                  }}>{row.title}</div>
                  <div style={{
                    fontSize: 16, color: "rgba(255,255,255,0.26)", marginTop: 5,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{row.subtitle}</div>
                </div>
                {row.stat && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      fontSize: 20, fontWeight: 900,
                      color: isTop3 ? ACCENT : "rgba(255,255,255,0.38)",
                      letterSpacing: "-0.02em",
                      textShadow: isTop3 ? `0 0 24px ${ACCENT}45` : "none",
                      animation: staggerActive
                        ? `mcCountUp 0.35s ease ${i * 0.13 + 0.25}s both`
                        : "none",
                    }}>{row.stat}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />
        <AccentLine opacity={0.08} />
        <CTAFooter compact />
      </div>
    </TemplateCanvas>
  );
}
