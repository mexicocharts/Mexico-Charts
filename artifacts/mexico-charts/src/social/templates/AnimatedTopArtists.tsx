import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, PlatformBadge, MovementBadge, ACCENT,
} from "../components";
import type { ChartRowData } from "../components";
import { useChartsHub, useArtistImageMap, parseMovement } from "../useChartData";
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
`;

const FALLBACK: ChartRowData[] = [
  { rank: 1,  title: "Peso Pluma",     subtitle: "14 días en chart", movement: 0,  roundImage: true },
  { rank: 2,  title: "Grupo Frontera", subtitle: "9 días en chart",  movement: 1,  roundImage: true },
  { rank: 3,  title: "Fuerza Regida",  subtitle: "7 días en chart",  movement: -1, roundImage: true },
  { rank: 4,  title: "Natanael Cano",  subtitle: "11 días en chart", movement: 0,  roundImage: true },
  { rank: 5,  title: "Junior H",       subtitle: "6 días en chart",  movement: 2,  roundImage: true },
  { rank: 6,  title: "Carin León",     subtitle: "5 días en chart",  movement: -1, roundImage: true },
  { rank: 7,  title: "Banda MS",       subtitle: "8 días en chart",  movement: 1,  roundImage: true },
  { rank: 8,  title: "Eslabon Armado", subtitle: "3 días en chart",  isNew: true,  roundImage: true },
  { rank: 9,  title: "Grupo Firme",    subtitle: "4 días en chart",  movement: -2, roundImage: true },
  { rank: 10, title: "Luis Miguel",    subtitle: "2 días en chart",  movement: 0,  roundImage: true },
];

export default function AnimatedTopArtists() {
  const { data: hub } = useChartsHub();
  const hubRows = hub?.sheets?.Spotify_Artists_Daily?.rows?.slice(0, 10) ?? [];
  const artistNames = hubRows.map(r => r["Artist"] ?? "");
  const { data: images } = useArtistImageMap(artistNames);
  const { phase, cycle } = useAnimLoop();

  const rows: ChartRowData[] = hubRows.length > 0
    ? hubRows.map((r, i) => ({
        rank: i + 1,
        title: r["Artist"] ?? "",
        subtitle: r["Streak"] ? `${r["Streak"]} días en chart` : "",
        stat: r["Peak"] ? `#${r["Peak"]}` : undefined,
        statLabel: r["Peak"] ? "Pico" : undefined,
        ...parseMovement(r["Movement"] ?? "="),
        imageUrl: images?.[r["Artist"] ?? ""] ?? null,
        roundImage: true,
      }))
    : FALLBACK;

  const date = hub
    ? new Date(hub.lastUpdated).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "13 Mayo 2026";

  const outroActive   = phase === "outro";
  const staggerActive = phase === "stagger";
  const rowVisible    = phase !== "intro";

  return (
    <TemplateCanvas>
      <style>{ANIM_CSS}</style>

      {/* Background glows */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 650,
        background: `radial-gradient(ellipse 80% 85% at 50% -8%, ${ACCENT}0f 0%, ${ACCENT}06 40%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -50, right: -80,
        width: 460, height: 460,
        background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 70%)`,
        filter: "blur(60px)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", right: -20, bottom: 110,
        fontSize: 560, fontWeight: 900,
        color: "rgba(57,255,20,0.03)",
        letterSpacing: "-0.07em", lineHeight: 1,
        pointerEvents: "none", userSelect: "none",
      }}>10</div>

      {/* Outer wrapper — fades out during outro */}
      <div style={{
        opacity: outroActive ? 0 : 1,
        transition: outroActive ? "opacity 0.9s ease" : "none",
        display: "flex", flexDirection: "column", flex: 1,
      }}>
        {/* Header — fades IN during intro, stays visible through stagger/hold */}
        <div style={{
          animation: phase === "intro" ? "mcFadeIn 0.55s ease forwards" : "none",
        }}>
          <LogoBar date={date} />
          <AccentLine />
          <div style={{ padding: "28px 64px 22px", position: "relative", zIndex: 2 }}>
            <SectionLabel>Top Artistas</SectionLabel>
            <div style={{
              fontSize: 120, fontWeight: 900, color: "#fff",
              letterSpacing: "-0.05em", lineHeight: 0.84,
              textTransform: "uppercase", marginTop: 4,
              textShadow: "0 2px 60px rgba(0,0,0,0.8)",
            }}>DIARIOS</div>
            <div style={{ display: "flex", gap: 12, marginTop: 20, alignItems: "center" }}>
              <PlatformBadge platform="spotify" />
              <PlatformBadge platform="apple" active={false} />
            </div>
          </div>
          <AccentLine opacity={0.25} />
          <div style={{
            display: "flex", padding: "0 64px", height: 40, alignItems: "center", gap: 18,
            position: "relative", zIndex: 2,
          }}>
            <div style={{ width: 56 }} />
            <div style={{ width: 44 }} />
            <div style={{ width: 44 }} />
            <div style={{ flex: 1, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.16)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Artista · Racha</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.16)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Pico</div>
          </div>
          <AccentLine opacity={0.1} />
        </div>

        {/* Animated rows */}
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
                  display: "flex",
                  alignItems: "center",
                  height: 74,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  gap: 18,
                  background: isTop3
                    ? `linear-gradient(90deg, ${ACCENT}0d 0%, transparent 80%)`
                    : "transparent",
                  padding: "0 64px",
                  position: "relative",
                  zIndex: 2,
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
                <div style={{
                  width: 44, height: 44, flexShrink: 0, borderRadius: "50%",
                  overflow: "hidden",
                  background: `linear-gradient(135deg, #1e1e1e, #0c0c0c)`,
                  border: "1px solid rgba(255,255,255,0.07)",
                  animation: staggerActive
                    ? `mcPopIn 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 0.13 + 0.1}s both`
                    : "none",
                }}>
                  {row.imageUrl ? (
                    <img src={row.imageUrl as string} alt="" crossOrigin="anonymous"
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
                    }}>{row.stat}</div>
                    {row.statLabel && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>
                        {row.statLabel}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <AccentLine opacity={0.08} />
        <CTAFooter compact />
      </div>
    </TemplateCanvas>
  );
}
