import {
  TemplateCanvas, LogoBar, AccentLine, CTAFooter,
  SectionLabel, AlbumFrame, MovementBadge, ACCENT,
} from "../components";
import { useChartsHub, useArtistImageMap, primaryArtist, proxyImageUrl } from "../useChartData";

interface AlbumEntry {
  rank: number;
  title: string;
  artist: string;
  stat?: string;
  movement?: number;
  isNew?: boolean;
  weeks?: number;
  peak?: number;
  imageUrl?: string | null;
}

const FALLBACK: AlbumEntry[] = [
  { rank: 1, title: "Génesis",           artist: "Peso Pluma",     stat: "68.4M", movement: 0,  weeks: 8,  peak: 1 },
  { rank: 2, title: "Pa'Las Baby's",     artist: "Fuerza Regida",  stat: "52.1M", movement: 1,  weeks: 5,  peak: 2 },
  { rank: 3, title: "Corridos Tumbados", artist: "Natanael Cano",  stat: "44.7M", movement: -1, weeks: 12, peak: 1 },
  { rank: 4, title: "Primera Cita",      artist: "Carin León",     stat: "38.2M", movement: 2,  weeks: 6,  peak: 3 },
  { rank: 5, title: "Del Rancho",        artist: "Grupo Frontera", stat: "29.8M", isNew: true,  weeks: 1,  peak: 5 },
];

export default function WeeklyTopAlbums() {
  const { data: hub } = useChartsHub();
  const hubRows = hub?.sheets?.Apple_Albums?.rows?.slice(0, 5) ?? [];
  const artistNames = hubRows.map(r => primaryArtist(r["Artist Names"] ?? ""));
  const { data: images } = useArtistImageMap(artistNames);

  const albums: AlbumEntry[] = hubRows.length > 0
    ? hubRows.map((r, i) => ({
        rank: i + 1,
        title: r["Title"] ?? "",
        artist: r["Artist Names"] ?? "",
        imageUrl: images?.[primaryArtist(r["Artist Names"] ?? "")] ?? null,
      }))
    : FALLBACK;

  const isLive = hubRows.length > 0;

  return (
    <TemplateCanvas>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 650,
        background: `radial-gradient(ellipse 85% 100% at 50% -5%, ${ACCENT}12 0%, ${ACCENT}05 45%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: "30%", right: -80,
        width: 500, height: 500,
        background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 65%)`,
        filter: "blur(70px)",
        pointerEvents: "none",
      }} />

      <LogoBar date={hub ? new Date(hub.lastUpdated).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "Semana del 13 Mayo"} />
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

      <div style={{ padding: "6px 0", position: "relative", zIndex: 2 }}>
        {albums.map((a) => (
          <div key={a.rank} style={{
            display: "flex",
            alignItems: "center",
            padding: "18px 64px",
            gap: 24,
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            background: a.rank === 1
              ? `linear-gradient(90deg, ${ACCENT}0a 0%, transparent 70%)`
              : "transparent",
            position: "relative",
          }}>
            {a.rank === 1 && (
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: 3,
                background: `linear-gradient(to bottom, transparent, ${ACCENT}, transparent)`,
                boxShadow: `2px 0 20px ${ACCENT}50`,
              }} />
            )}
            <AlbumFrame
              size={142}
              rank={a.rank}
              accent={ACCENT}
              src={a.imageUrl ?? undefined}
              round={isLive}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 27, fontWeight: 900,
                color: a.rank <= 2 ? "#fff" : "rgba(255,255,255,0.84)",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {a.title}
              </div>
              <div style={{ fontSize: 19, color: "rgba(255,255,255,0.34)", marginTop: 4 }}>
                {a.artist}
              </div>
              {!isLive && (
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
            {!isLive && a.stat && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  fontSize: 28, fontWeight: 900,
                  color: a.rank <= 2 ? ACCENT : "rgba(255,255,255,0.45)",
                  letterSpacing: "-0.02em",
                  textShadow: a.rank <= 2 ? `0 0 30px ${ACCENT}50` : "none",
                }}>
                  {a.stat}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4, marginBottom: 8 }}>
                  streams
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <MovementBadge movement={a.movement} isNew={a.isNew} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <AccentLine opacity={0.08} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
