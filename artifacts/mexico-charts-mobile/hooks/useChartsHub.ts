import { useQuery } from "@tanstack/react-query";

// ── Types ────────────────────────────────────────────────────────────────────

export type Row = Record<string, string>;

export interface SheetData {
  headers: string[];
  rows: Row[];
}

export type SheetName =
  | "YT_Artists_Weekly"
  | "YT_Songs_Weekly"
  | "YT_Videos_Daily"
  | "YT_Shorts_Daily"
  | "Spotify_Artists_Daily"
  | "Spotify_Regional_Daily"
  | "Spotify_Regional_Weekly"
  | "Spotify_Viral_Daily"
  | "Apple_Songs"
  | "Apple_Albums"
  | "Deezer_Top_Mexico";

export interface HubPayload {
  lastUpdated: string;
  sheets: Partial<Record<SheetName, SheetData>>;
}

export interface ChartsHubResult {
  data: HubPayload | null;
  isLoading: boolean;
  hasError: boolean;
  lastUpdated: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return `https://${domain}`;
}

function rankOf(row: Row): string {
  return row["Rank"] ?? row["rank"] ?? "";
}

function prevOf(row: Row): string {
  return row["Previous Rank"] ?? row["previous_rank"] ?? row["Prev"] ?? "";
}

function movOf(row: Row): string {
  return row["Movement"] ?? "";
}

function isMexican(row: Row): boolean {
  return (row["Contains Mexican Artist"] ?? "").toUpperCase() === "TRUE";
}

export { rankOf, prevOf, movOf, isMexican };

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchHub(): Promise<HubPayload> {
  const base = getBaseUrl();
  if (!base) {
    return { lastUpdated: "", sheets: {} };
  }
  const res = await fetch(`${base}/api/charts/hub`);
  if (!res.ok) throw new Error(`charts/hub HTTP ${res.status}`);
  return res.json() as Promise<HubPayload>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChartsHub(): ChartsHubResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ["chartsHub"],
    queryFn: fetchHub,
    staleTime: 1000 * 60 * 30,
    retry: 2,
  });
  return {
    data: data ?? null,
    isLoading,
    hasError: !!error,
    lastUpdated: data?.lastUpdated ?? null,
  };
}
