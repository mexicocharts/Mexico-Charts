import {
  TemplateCanvas, LogoBar, AccentLine, ChartRow, CTAFooter,
  SectionLabel, PlatformBadge, ACCENT,
} from "../components";
import type { ChartRowData } from "../components";
import { useChartsHub, proxyImageUrl, parseMovement, suppressDuplicateImages, useSocialArtwork, artworkCoverage } from "../useChartData";

const FALLBACK: ChartRowData[] = [
  { rank: 1,  title: "Peso Pluma",     subtitle: "Racha en chart",  movement: 0  },
  { rank: 2,  title: "Grupo Frontera", subtitle: "Racha en chart",  movement: 1  },
  { rank: 3,  title: "Fuerza Regida",  subtitle: "Racha en chart",  movement: -1 },
  { rank: 4,  title: "Natanael Cano",  subtitle: "Racha en chart",  movement: 0  },
  { rank: 5,  title: "Junior H",       subtitle: "Racha en chart",  movement: 2  },
  { rank: 6,  title: "Carin León",     subtitle: "Racha en chart",  movement: -1 },
  { rank: 7,  title: "Banda MS",       subtitle: "Racha en chart",  movement: 1  },
  { rank: 8,  title: "Eslabon Armado", subtitle: "Racha en chart",  isNew: true  },
  { rank: 9,  title: "Grupo Firme",    subtitle: "Racha en chart",  movement: -2 },
  { rank: 10, title: "Luis Miguel",    subtitle: "Racha en chart",  movement: 0  },
];

export default function DailyTopArtists() {
  const { data: hub } = useChartsHub();
  const hubRows = hub?.sheets?.Spotify_Artists_Daily?.rows?.slice(0, 10) ?? [];
  const artworkItems = hubRows.map((r, i) => ({
    id: r["Artist ID"] || r["artist_id"] || `${i}-${r["Artist"]}`,
    title: r["Artist"] ?? "",
    artist: r["Artist"] ?? "",
  }));
  const { data: artwork, isFetching: artworkFetching } = useSocialArtwork("artist", artworkItems, "daily-top-artists");
  const artworkReady = artworkCoverage(artworkItems, artwork).complete;
  const exportLoading = hubRows.length > 0 && (artworkFetching || artwork === undefined || !artworkReady);
  const imageUrls = suppressDuplicateImages(
    hubRows.map((r, i) => proxyImageUrl(artwork?.[r["Artist ID"] || r["artist_id"] || `${i}-${r["Artist"]}`]))
  );

  const rows: ChartRowData[] = hubRows.length > 0
    ? hubRows.map((r, i) => ({
        rank: i + 1,
        title: r["Artist"] ?? "",
        subtitle: r["Streak"] ? `${r["Streak"]} días en chart` : r["Chart Date"] ?? "",
        stat: r["Peak"] ? `#${r["Peak"]}` : undefined,
        statLabel: r["Peak"] ? "Pico" : undefined,
        ...parseMovement(r["Movement"] ?? "="),
        imageUrl: imageUrls[i],
        imageFallbackLabel: r["Artist"] ?? "",
        roundImage: true,
      }))
    : FALLBACK;

  return (
    <TemplateCanvas exportLoading={exportLoading}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 650,
        background: `radial-gradient(ellipse 80% 85% at 50% -8%, ${ACCENT}0f 0%, ${ACCENT}06 40%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -50, right: -80,
        width: 460, height: 460,
        background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 70%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        right: -20, bottom: 110,
        fontSize: 560,
        fontWeight: 900,
        color: "rgba(57,255,20,0.03)",
        letterSpacing: "-0.07em",
        lineHeight: 1,
        pointerEvents: "none",
        userSelect: "none",
      }}>10</div>

      <LogoBar date={hub ? new Date(hub.lastUpdated).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "13 Mayo 2026"} />
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
        {hubRows.length > 0 && <div style={{ width: 44 }} />}
        <div style={{ flex: 1, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.16)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Artista · Racha</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.16)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Pico</div>
      </div>

      <AccentLine opacity={0.1} />

      <div>{rows.map(a => <ChartRow key={a.rank} row={a} compact />)}</div>

      <AccentLine opacity={0.08} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
