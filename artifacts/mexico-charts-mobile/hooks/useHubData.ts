import { useQuery } from "@tanstack/react-query";
import { TOP_ARTISTS } from "@/data/chartData";

// ── Raw shape from /api/charts/hub ──────────────────────────────────────────

interface RawHubRow {
  Rank?: unknown;
  Prev?: unknown;
  Artist?: unknown;
  "Contains Mexican Artist"?: unknown;
  Streak?: unknown;
  Movement?: unknown;
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

export interface HubData {
  rows: HubRow[];
  mexicanRows: HubRow[];
  ascensoItems: AscensoItem[];
  tickerItems: TickerItem[];
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

function computeTickerItems(rows: HubRow[]): TickerItem[] {
  return rows.slice(0, 20).map((r) => {
    const st = TOP_ARTISTS.find(
      (a) => a.name.toLowerCase() === r.Artist.toLowerCase()
    );
    const display = st?.streams ? `${st.streams} OYENTES` : `#${r.Rank}`;
    return { name: r.Artist, display };
  });
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
  const rawRows: unknown[] =
    (data as Record<string, Record<string, Record<string, unknown[]>>>)
      ?.sheets?.["Spotify_Artists_Daily"]?.rows ?? [];

  const rows = (rawRows as RawHubRow[])
    .map(parseRow)
    .filter((r): r is HubRow => r !== null)
    .sort((a, b) => a.Rank - b.Rank);

  const mexicanRows = rows.filter((r) => r.isMexican);
  const ascensoItems = computeAscenso(mexicanRows);
  const tickerItems = computeTickerItems(rows);

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

  return {
    rows: data?.rows ?? [],
    mexicanRows: data?.mexicanRows ?? [],
    ascensoItems: data?.ascensoItems ?? [],
    tickerItems: data?.tickerItems ?? [],
    isLoading,
    hasError: !!error,
  };
}
