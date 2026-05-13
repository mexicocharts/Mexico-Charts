import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useArtistMetadata, ArtistMeta } from "./useArtistMetadata";

// ── Raw shape from /api/charts/hub ──────────────────────────────────────────

interface RawHubRow {
  Rank?: unknown;
  Prev?: unknown;
  Artist?: unknown;
  "Contains Mexican Artist"?: unknown;
  Streak?: unknown;
  Movement?: unknown;
}

interface RawYtRow {
  Rank?: unknown;
  "Artist Name"?: unknown;
  Artist?: unknown;
  Views?: unknown;
  "Contains Mexican Artist"?: unknown;
}

// ── Public typed interfaces ──────────────────────────────────────────────────

export interface HubRow {
  Rank: number;
  Prev: number;
  Artist: string;
  isMexican: boolean;
  Streak: number;
  Movement: string;
}

export interface AscensoItem {
  name: string;
  rank: number;
  gained: number;
  growth: string;
  bar: number;
  accent: string;
}

export interface TickerItem {
  name: string;
  display: string;
}

// ── Genre config (centralised here so all consumers share one source) ────────

interface GenreConfig {
  label: string;
  displayLabel: string;
  color: string;
  synonyms: string[];
  description: string;
}

const GENRE_CONFIG: GenreConfig[] = [
  { label: "corridos-tumbados", displayLabel: "CORRIDOS TUMBADOS", color: "#39FF14", synonyms: ["corridos tumbados", "corrido tumbado", "corridos"], description: "El género que redefinió la música mexicana" },
  { label: "regional-mexicano", displayLabel: "REGIONAL MEXICANO", color: "#4ade80", synonyms: ["regional mexicano", "regional", "reg. mexicano"], description: "Música que lleva las raíces de México al mundo" },
  { label: "norteno", displayLabel: "NORTEÑO", color: "#86efac", synonyms: ["norteño", "norteno", "nortena"], description: "El sonido clásico del norte de México" },
  { label: "banda", displayLabel: "BANDA", color: "#a3e635", synonyms: ["banda", "banda sinaloense"], description: "La banda que mueve masas en México y USA" },
  { label: "hip-hop", displayLabel: "HIP-HOP MEXICANO", color: "#facc15", synonyms: ["hip-hop", "hip hop mexicano", "hip hop", "rap mexicano"], description: "El nuevo rap hecho en México" },
  { label: "pop", displayLabel: "POP MEXICANO", color: "#fb923c", synonyms: ["pop", "pop mexicano", "pop latino"], description: "Pop hecho en México con alcance global" },
];

export interface GenreStat {
  label: string;
  displayLabel: string;
  color: string;
  description: string;
  artists: ArtistMeta[];
  totalStreams: number;
}

function matchesGenreConfig(meta: ArtistMeta, config: GenreConfig): boolean {
  const sub = (meta.subgenre ?? "").toLowerCase();
  const gen = (meta.genre ?? "").toLowerCase();
  return config.synonyms.some((s) => sub.includes(s) || gen.includes(s));
}

function buildGenreStats(artists: ArtistMeta[]): GenreStat[] {
  return GENRE_CONFIG.map((config) => {
    const matched = artists
      .filter((a) => matchesGenreConfig(a, config))
      .sort((a, b) => b.spotifyStreams - a.spotifyStreams);
    const totalStreams = matched.reduce((sum, a) => sum + a.spotifyStreams, 0);
    return {
      label: config.label,
      displayLabel: config.displayLabel,
      color: config.color,
      description: config.description,
      artists: matched,
      totalStreams,
    };
  });
}

export interface HubData {
  rows: HubRow[];
  mexicanRows: HubRow[];
  ascensoItems: AscensoItem[];
  tickerItems: TickerItem[];
  genreStats: GenreStat[];
  isLoading: boolean;
  hasError: boolean;
}

// ── Accent palette for EN ASCENSO ───────────────────────────────────────────

const ASCENSO_ACCENTS = [
  "#39FF14",
  "rgba(57,255,20,0.78)",
  "rgba(57,255,20,0.58)",
  "rgba(57,255,20,0.40)",
  "rgba(57,255,20,0.26)",
];

// ── Base URL ─────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) {
    if (__DEV__) {
      console.warn(
        "[useHubData] EXPO_PUBLIC_DOMAIN is not set; live data will not load."
      );
    }
    return "";
  }
  return `https://${domain}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseRow(raw: RawHubRow): HubRow | null {
  const rank = parseInt(String(raw.Rank ?? ""), 10);
  const artist = String(raw.Artist ?? "").trim();
  if (!artist || !rank || rank <= 0) return null;
  return {
    Rank: rank,
    Prev: parseInt(String(raw.Prev ?? ""), 10) || 0,
    Artist: artist,
    isMexican:
      String(raw["Contains Mexican Artist"] ?? "").toUpperCase() === "TRUE",
    Streak: parseInt(String(raw.Streak ?? ""), 10) || 0,
    Movement: String(raw.Movement ?? ""),
  };
}

function fmtViews(raw: unknown): string {
  const n = parseInt(String(raw ?? "").replace(/,/g, ""), 10);
  if (isNaN(n) || n === 0) return "";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B VIEWS`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M VIEWS`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K VIEWS`;
  return `${n} VIEWS`;
}

function computeAscenso(mexicanRows: HubRow[]): AscensoItem[] {
  const climbers = mexicanRows
    .map((r) => {
      const gained = r.Prev > 0 && r.Rank > 0 ? r.Prev - r.Rank : 0;
      return { name: r.Artist, rank: r.Rank, gained };
    })
    .filter((a) => a.gained > 0)
    .sort((a, b) => b.gained - a.gained)
    .slice(0, 5);

  if (climbers.length < 3) return [];

  const maxGained = climbers[0].gained;
  return climbers.map((a, i) => ({
    name: a.name,
    rank: a.rank,
    gained: a.gained,
    growth: `+${a.gained} pos · #${a.rank}`,
    bar: maxGained > 0 ? Math.round((a.gained / maxGained) * 100) : 0,
    accent: ASCENSO_ACCENTS[i] ?? ASCENSO_ACCENTS[ASCENSO_ACCENTS.length - 1],
  }));
}

// Build ticker from YouTube Artists Weekly rows (matches web — artist name + view count)
function computeTickerFromYt(ytRows: RawYtRow[]): TickerItem[] {
  return ytRows.slice(0, 20).map((r) => {
    const name = String(r["Artist Name"] ?? r.Artist ?? "").trim();
    const views = fmtViews(r.Views);
    return { name, display: views || `#${r.Rank}` };
  });
}

// Fallback ticker from Spotify Daily rows (rank-based display)
function computeTickerFromSpotify(rows: HubRow[]): TickerItem[] {
  return rows.slice(0, 20).map((r) => ({
    name: r.Artist,
    display: `#${r.Rank}`,
  }));
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchHubData(): Promise<{
  rows: HubRow[];
  mexicanRows: HubRow[];
  ascensoItems: AscensoItem[];
  tickerItems: TickerItem[];
}> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return { rows: [], mexicanRows: [], ascensoItems: [], tickerItems: [] };
  }

  const res = await fetch(`${baseUrl}/api/charts/hub`);
  if (!res.ok) {
    throw new Error(`Hub API returned ${res.status}`);
  }

  const data: unknown = await res.json();
  const sheets = (data as Record<string, Record<string, Record<string, unknown[]>>>)
    ?.sheets ?? {};

  // Spotify Artists Daily — Mexican filter + ascenso
  const spotifyRawRows: unknown[] = sheets?.["Spotify_Artists_Daily"]?.rows ?? [];
  const rows = (spotifyRawRows as RawHubRow[])
    .map(parseRow)
    .filter((r): r is HubRow => r !== null)
    .sort((a, b) => a.Rank - b.Rank);

  const mexicanRows = rows.filter((r) => r.isMexican);
  const ascensoItems = computeAscenso(mexicanRows);

  // YouTube Artists Weekly — ticker (matches web)
  const ytRawRows: unknown[] = sheets?.["YT_Artists_Weekly"]?.rows ?? [];
  const ytRows = ytRawRows as RawYtRow[];
  const tickerItems =
    ytRows.length > 0
      ? computeTickerFromYt(ytRows)
      : computeTickerFromSpotify(rows);

  return { rows, mexicanRows, ascensoItems, tickerItems };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useHubData(): HubData {
  const { data, isLoading, error } = useQuery({
    queryKey: ["hubData"],
    queryFn: fetchHubData,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  // Artist metadata powers genre stats — sourced from /api/artists/metadata
  const { artists, isLoading: metaLoading } = useArtistMetadata();

  const genreStats = useMemo(() => buildGenreStats(artists), [artists]);

  return {
    rows: data?.rows ?? [],
    mexicanRows: data?.mexicanRows ?? [],
    ascensoItems: data?.ascensoItems ?? [],
    tickerItems: data?.tickerItems ?? [],
    genreStats,
    isLoading: isLoading || metaLoading,
    hasError: !!error,
  };
}
