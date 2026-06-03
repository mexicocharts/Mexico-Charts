import { useMemo } from "react";
import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, AlbumFrame, MovementBadge, ACCENT,
} from "../components";
import { useChartsHub, fmtStreams, proxyImageUrl, imageFromRow, suppressDuplicateImages, useSocialArtwork } from "../useChartData";
import { useAnimLoop, useStreamCounters } from "../useAnimLoop";

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

interface AlbumEntry {
  rank: number;
  title: string;
  artist: string;
  rawStat: number;
  statLabel: string;
  movement?: number;
  isNew?: boolean;
  weeks?: number;
  peak?: number;
  imageUrl?: string | null;
}

const FALLBACK: AlbumEntry[] = [
  { rank: 1, title: "Génesis",           artist: "Peso Pluma",     rawStat: 68_400_000, statLabel: "streams", movement: 0,  weeks: 8,  peak: 1 },
  { rank: 2, title: "Pa'Las Baby's",     artist: "Fuerza Regida",  rawStat: 52_100_000, statLabel: "streams", movement: 1,  weeks: 5,  peak: 2 },
  { rank: 3, title: "Corridos Tumbados", artist: "Natanael Cano",  rawStat: 44_700_000, statLabel: "streams", movement: -1, weeks: 12, peak: 1 },
  { rank: 4, title: "Primera Cita",      artist: "Carin León",     rawStat: 38_200_000, statLabel: "streams", movement: 2,  weeks: 6,  peak: 3 },
  { rank: 5, title: "Del Rancho",        artist: "Grupo Frontera", rawStat: 29_800_000, statLabel: "streams", isNew: true,  weeks: 1,  peak: 5 },
];

export default function AnimatedTopAlbums() {
  const { data: hub } = useChartsHub();
  const hubRows = hub?.sheets?.Apple_Albums?.rows?.slice(0, 5) ?? [];
  const artworkItems = hubRows.map((r, i) => ({
    id: r["Album ID"] || r["id"] || `${i}-${r["Artist Names"]}-${r["Title"]}`,
    title: r["Title"] ?? "",
    artist: r["Artist Names"] ?? "",
  }));
  const { data: artwork, isFetching: artworkFetching } = useSocialArtwork("album", artworkItems, "animated-top-albums");
  const exportLoading = hubRows.length > 0 && (artworkFetching || artwork === undefined);
  const { phase, cycle } = useAnimLoop();

  const isLive = hubRows.length > 0;
  const imageUrls = suppressDuplicateImages(
    hubRows.map((r, i) => proxyImageUrl(
      artwork?.[r["Album ID"] || r["id"] || `${i}-${r["Artist Names"]}-${r["Title"]}`] ??
      imageFromRow(r, ["cover_url", "Cover URL", "image_url", "Image URL", "artwork_url", "album_image_url"])
    ))
  );

  const albums: AlbumEntry[] = useMemo(() => isLive
    ? hubRows.map((r, i) => {
        const weeks = parseInt((r["Weeks"] ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
        return {
          rank: i + 1,
          title: r["Title"] ?? "",
          artist: r["Artist Names"] ?? "",
          rawStat: weeks,
          statLabel: weeks === 1 ? "semana" : "semanas",
          imageUrl: imageUrls[i],
        };
      })
    : FALLBACK,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [hub, artwork, imageUrls.join("|")]);

  const rawStats = useMemo(() => albums.map(a => a.rawStat), [albums]);
  const counterActive = phase === "stagger" || phase === "hold";
  const animCounts = useStreamCounters(rawStats, counterActive, cycle);

  const date = hub
    ? new Date(hub.lastUpdated).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : "Semana del 13 Mayo";

  const outroActive   = phase === "outro";
  const staggerActive = phase === "stagger";
  const rowVisible    = phase !== "intro";

  return (
    <TemplateCanvas exportLoading={exportLoading}>
      <style>{ANIM_CSS}</style>

      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 650,
        background: `radial-gradient(ellipse 85% 100% at 50% -5%, ${ACCENT}12 0%, ${ACCENT}05 45%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "30%", right: -80,
        width: 500, height: 500,
        background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 65%)`,
        filter: "blur(70px)", pointerEvents: "none",
      }} />

      <div style={{
        opacity: outroActive ? 0 : 1,
        transition: outroActive ? "opacity 0.9s ease" : "none",
        display: "flex", flexDirection: "column", flex: 1,
      }}>
        <div style={{ animation: phase === "intro" ? "mcFadeIn 0.35s ease forwards" : "none" }}>
          <LogoBar date={date} />
          <AccentLine />
          <div style={{ padding: "24px 64px 20px", position: "relative", zIndex: 2 }}>
            <SectionLabel>Top Álbumes</SectionLabel>
            <div style={{
              fontSize: 108, fontWeight: 900, color: "#fff",
              letterSpacing: "-0.05em", lineHeight: 0.84,
              textTransform: "uppercase", marginTop: 4,
              textShadow: "0 2px 60px rgba(0,0,0,0.8)",
            }}>SEMANALES</div>
            <div style={{ marginTop: 12, fontSize: 18, color: "rgba(255,255,255,0.22)", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
              {isLive ? "Top Álbumes · Apple Music México" : "Streams totales del álbum · México"}
            </div>
          </div>
          <AccentLine opacity={0.3} />
        </div>

        <div style={{ padding: "6px 0", position: "relative", zIndex: 2, flex: 1 }}>
          {albums.map((a, i) => (
            <div
              key={`${a.rank}-${cycle}`}
              style={{
                opacity: rowVisible ? 1 : 0,
                animation: staggerActive
                  ? `mcSlideIn 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 0.12}s both`
                  : "none",
                display: "flex", alignItems: "center",
                padding: "18px 20px",
                margin: "10px 46px",
                gap: 22,
                border: a.rank <= 3 ? `1px solid ${ACCENT}24` : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                background: a.rank === 1
                  ? `linear-gradient(90deg, ${ACCENT}18 0%, rgba(255,255,255,0.06) 46%, rgba(255,255,255,0.025) 100%)`
                  : "rgba(255,255,255,0.035)",
                position: "relative",
                boxShadow: a.rank <= 3
                  ? `0 18px 42px rgba(0,0,0,0.34), inset 0 0 32px ${ACCENT}06`
                  : "0 12px 28px rgba(0,0,0,0.22)",
              }}
            >
              {a.rank === 1 && (
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: 5,
                  borderRadius: "16px 0 0 16px",
                  background: `linear-gradient(to bottom, ${ACCENT}30, ${ACCENT}, ${ACCENT}30)`,
                  boxShadow: `3px 0 22px ${ACCENT}55`,
                }} />
              )}

              <div style={{
                animation: staggerActive
                  ? `mcPopIn 0.4s cubic-bezier(0.22,1,0.36,1) ${i * 0.12 + 0.1}s both`
                  : "none",
              }}>
                <AlbumFrame
                  size={142}
                  rank={a.rank}
                  accent={ACCENT}
                  src={a.imageUrl ?? undefined}
                  round={false}
                  fallbackLabel={a.title}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 27, fontWeight: 900,
                  color: a.rank <= 2 ? "#fff" : "rgba(255,255,255,0.84)",
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{a.title}</div>
                <div style={{ fontSize: 19, color: "rgba(255,255,255,0.34)", marginTop: 4 }}>
                  {a.artist}
                </div>
                {!isLive && a.weeks !== undefined && (
                  <div style={{ display: "flex", gap: 18, marginTop: 12, alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.16)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Pico #{a.peak}
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.16)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {a.weeks} {a.weeks === 1 ? "Semana" : "Semanas"}
                    </div>
                  </div>
                )}
              </div>

              {/* Animated stat counter — streams (fallback) or weeks on chart (live) */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  fontSize: 28, fontWeight: 900,
                  color: a.rank <= 2 ? ACCENT : "rgba(255,255,255,0.45)",
                  letterSpacing: "-0.02em",
                  textShadow: a.rank <= 2 ? `0 0 30px ${ACCENT}50` : "none",
                }}>
                  {isLive ? String(animCounts[i] ?? 0) : fmtStreams(String(animCounts[i] ?? 0))}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4, marginBottom: 8 }}>
                  {a.statLabel}
                </div>
                {!isLive && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <MovementBadge movement={a.movement} isNew={a.isNew} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <AccentLine opacity={0.08} />
        <CTAFooter compact />
      </div>
    </TemplateCanvas>
  );
}
