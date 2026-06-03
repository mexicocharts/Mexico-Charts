import {
  TemplateCanvas, LogoBar, AccentLine, ChartRow, CTAFooter,
  SectionLabel, PlatformBadge, MovementBadge, ACCENT,
} from "../components";
import type { ChartRowData } from "../components";
import { useSpotifyChart, parseMovement, fmtStreams, proxyImageUrl, suppressDuplicateImages, useSocialArtwork } from "../useChartData";

const FALLBACK_TOP3: ChartRowData[] = [
  { rank: 1, title: "Ella Baila Sola", subtitle: "Peso Pluma · Eslabon Armado", stat: "21.4M", movement: 0,  peak: 1, weeks: 12 },
  { rank: 2, title: "Cupido",          subtitle: "TINI · Myke Towers",          stat: "18.9M", movement: 1,  peak: 2, weeks: 8  },
  { rank: 3, title: "LALA",            subtitle: "Myke Towers",                 stat: "16.7M", movement: -1, peak: 1, weeks: 5  },
];
const FALLBACK_REST: ChartRowData[] = [
  { rank: 4,  title: "La Bebe (Remix)",    subtitle: "Peso Pluma · Yng Lvcas",    stat: "14.2M", movement: 2,  peak: 3,  weeks: 7  },
  { rank: 5,  title: "Chanel",             subtitle: "Bizarrap · Peso Pluma",      stat: "13.1M", movement: 0,  peak: 5,  weeks: 4  },
  { rank: 6,  title: "Cayó La Noche",      subtitle: "Junior H · Peso Pluma",      stat: "11.8M", movement: -2, peak: 4,  weeks: 10 },
  { rank: 7,  title: "Un Fin de Semana",   subtitle: "Carin León",                 stat: "10.4M", movement: 3,  peak: 6,  weeks: 3  },
  { rank: 8,  title: "El Azul",            subtitle: "Fuerza Regida · Peso Pluma", stat: "9.7M",  isNew: true,  peak: 8,  weeks: 1  },
  { rank: 9,  title: "Según Quién",        subtitle: "Carin León",                 stat: "8.9M",  movement: -1, peak: 7,  weeks: 6  },
  { rank: 10, title: "Génesis",            subtitle: "Peso Pluma",                 stat: "8.2M",  movement: 0,  peak: 10, weeks: 2  },
];

export default function WeeklyTopSongs() {
  const { data } = useSpotifyChart("weekly");
  const entries = data?.entries?.slice(0, 10) ?? [];
  const artworkItems = entries.map(e => ({
    id: e.trackId,
    title: e.title,
    artist: [e.artist, ...e.features].join(" "),
  }));
  const { data: artwork, isFetching: artworkFetching } = useSocialArtwork("track", artworkItems, "weekly-top-songs");
  const exportLoading = entries.length > 0 && (artworkFetching || artwork === undefined);
  const imageUrls = suppressDuplicateImages(
    entries.map(e => proxyImageUrl(artwork?.[e.trackId] ?? e.coverUrl))
  );

  const allRows: ChartRowData[] = entries.map((e, i) => ({
    rank: e.pos,
    title: e.title,
    subtitle: [e.artist, ...e.features].join(" · "),
    stat: fmtStreams(e.streams),
    ...parseMovement(e.posChange),
    imageUrl: imageUrls[i],
    imageFallbackLabel: e.title,
  }));

  const top3 = allRows.length > 0 ? allRows.slice(0, 3) : FALLBACK_TOP3;
  const rest  = allRows.length > 0 ? allRows.slice(3, 10) : FALLBACK_REST;

  const dateLabel = data
    ? `Semana del ${new Date(data.fetchedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}`
    : "Semana del 13 Mayo";

  return (
    <TemplateCanvas exportLoading={exportLoading}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 700,
        background: `radial-gradient(ellipse 85% 100% at 50% -10%, ${ACCENT}12 0%, ${ACCENT}06 45%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "10%", left: -60,
        width: 400, height: 400,
        background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 70%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
      }} />

      <LogoBar date={dateLabel} />
      <AccentLine />

      <div style={{ padding: "24px 64px 18px", position: "relative", zIndex: 2 }}>
        <SectionLabel>Top Canciones</SectionLabel>
        <div style={{
          fontSize: 108, fontWeight: 900, color: "#fff",
          letterSpacing: "-0.05em", lineHeight: 0.84,
          textTransform: "uppercase", marginTop: 4,
          textShadow: "0 2px 60px rgba(0,0,0,0.8)",
        }}>SEMANALES</div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <PlatformBadge platform="spotify" />
        </div>
      </div>

      <AccentLine opacity={0.35} />

      {/* Top 3 editorial rows */}
      {top3.map((s) => (
        <div key={s.rank} style={{
          display: "flex", alignItems: "center", padding: "0 64px",
          height: 86,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: s.rank === 1
            ? `linear-gradient(90deg, ${ACCENT}0d 0%, transparent 70%)`
            : "transparent",
          gap: 18,
          position: "relative", zIndex: 2,
        }}>
          {s.rank === 1 && (
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: 3,
              background: `linear-gradient(to bottom, transparent, ${ACCENT}, transparent)`,
              boxShadow: `2px 0 20px ${ACCENT}60`,
            }} />
          )}
          <div style={{
            width: 56, fontSize: s.rank === 1 ? 42 : 32, fontWeight: 900,
            color: s.rank === 1 ? ACCENT : "rgba(255,255,255,0.25)",
            letterSpacing: "-0.03em",
            textShadow: s.rank === 1 ? `0 0 24px ${ACCENT}60` : "none",
          }}>
            {String(s.rank).padStart(2, "0")}
          </div>
          <MovementBadge movement={s.movement} isNew={s.isNew} />
          {/* Album art thumbnail */}
          {"imageUrl" in s && (
            <div style={{
              width: 52, height: 52, flexShrink: 0,
              borderRadius: 8, overflow: "hidden",
              background: "linear-gradient(135deg,#1e1e1e,#0c0c0c)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              {s.imageUrl ? (
                <img src={s.imageUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.85) contrast(1.05)" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle at 40% 35%, ${ACCENT}15,#0d0d0d)` }}>
                  <span style={{ fontSize: 16, color: ACCENT, opacity: 0.82, fontWeight: 900 }}>
                    {(s.imageFallbackLabel ?? s.title).split(/\s+/).map(part => part[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: s.rank === 1 ? 30 : 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.title}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.26)" }}>{s.subtitle}</span>
              {s.peak && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.14)", letterSpacing: "0.07em" }}>PICO #{s.peak}</span>}
              {s.weeks && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.14)", letterSpacing: "0.07em" }}>{s.weeks} SEM</span>}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontSize: 24, fontWeight: 900, color: ACCENT, letterSpacing: "-0.02em",
              textShadow: s.rank === 1 ? `0 0 24px ${ACCENT}60` : "none",
            }}>{s.stat}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>Streams</div>
          </div>
        </div>
      ))}

      <div style={{
        display: "flex", alignItems: "center", padding: "0 64px", height: 34,
        background: `${ACCENT}05`,
        position: "relative", zIndex: 2,
      }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.18)", letterSpacing: "0.22em", textTransform: "uppercase", padding: "0 16px" }}>Posiciones 4–10</div>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
      </div>

      <div>{rest.map(s => <ChartRow key={s.rank} row={s} compact showMeta={!data} />)}</div>

      <AccentLine opacity={0.08} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
