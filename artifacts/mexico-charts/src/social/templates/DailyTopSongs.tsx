import {
  TemplateCanvas, LogoBar, AccentLine, ChartRow, CTAFooter,
  SectionLabel, PlatformBadge, ACCENT,
} from "../components";
import type { ChartRowData } from "../components";
import { useSpotifyChart, parseMovement, fmtStreams, proxyImageUrl, suppressDuplicateImages, useSocialArtwork } from "../useChartData";

const FALLBACK: ChartRowData[] = [
  { rank: 1,  title: "Ella Baila Sola",      subtitle: "Peso Pluma · Eslabon Armado",  stat: "3.2M",  movement: 0  },
  { rank: 2,  title: "LALA",                 subtitle: "Myke Towers",                  stat: "2.9M",  movement: 2  },
  { rank: 3,  title: "Cupido",               subtitle: "TINI · Myke Towers",           stat: "2.6M",  movement: -1 },
  { rank: 4,  title: "La Bebe (Remix)",       subtitle: "Peso Pluma · Yng Lvcas",      stat: "2.3M",  movement: 1  },
  { rank: 5,  title: "Chanel",               subtitle: "Bizarrap · Peso Pluma",         stat: "2.1M",  movement: 0  },
  { rank: 6,  title: "Cayó La Noche",        subtitle: "Junior H · Peso Pluma",         stat: "1.9M",  movement: -2 },
  { rank: 7,  title: "Un Fin de Semana",     subtitle: "Carin León",                   stat: "1.7M",  movement: 3  },
  { rank: 8,  title: "Según Quién",          subtitle: "Carin León",                   stat: "1.6M",  movement: 0  },
  { rank: 9,  title: "El Azul",              subtitle: "Fuerza Regida · Peso Pluma",   stat: "1.5M",  isNew: true  },
  { rank: 10, title: "La Noche de Anoche",   subtitle: "Bad Bunny · Rosalía",          stat: "1.4M",  movement: -3 },
];

export default function DailyTopSongs() {
  const { data } = useSpotifyChart("daily");
  const entries = data?.entries?.slice(0, 10) ?? [];
  const artworkItems = entries.map(e => ({
    id: e.trackId,
    title: e.title,
    artist: [e.artist, ...e.features].join(" "),
  }));
  const { data: artwork, isFetching: artworkFetching } = useSocialArtwork("track", artworkItems, "daily-top-songs");
  const exportLoading = entries.length > 0 && (artworkFetching || artwork === undefined);
  const imageUrls = suppressDuplicateImages(
    entries.map(e => proxyImageUrl(artwork?.[e.trackId] ?? e.coverUrl))
  );

  const rows: ChartRowData[] = entries.length > 0
    ? entries.map((e, i) => ({
        rank: e.pos,
        title: e.title,
        subtitle: [e.artist, ...e.features].join(" · "),
        stat: fmtStreams(e.streams),
        ...parseMovement(e.posChange),
        imageUrl: imageUrls[i],
        imageFallbackLabel: e.title,
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
        position: "absolute", bottom: 0, left: -80,
        width: 480, height: 480,
        background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 70%)`,
        filter: "blur(60px)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        right: -20, bottom: 120,
        fontSize: 560,
        fontWeight: 900,
        color: "rgba(57,255,20,0.03)",
        letterSpacing: "-0.07em",
        lineHeight: 1,
        pointerEvents: "none",
        userSelect: "none",
      }}>10</div>

      <LogoBar date={data ? new Date(data.fetchedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "13 Mayo 2026"} />
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
        {data && <div style={{ width: 44 }} />}
        <div style={{ flex: 1, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.16)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Canción · Artista</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.16)", letterSpacing: "0.2em", textTransform: "uppercase" }}>Streams</div>
      </div>

      <AccentLine opacity={0.1} />

      <div>{rows.map(s => <ChartRow key={s.rank} row={s} compact />)}</div>

      <div style={{ flex: 1 }} />
      <AccentLine opacity={0.08} />
      <CTAFooter compact />
    </TemplateCanvas>
  );
}
