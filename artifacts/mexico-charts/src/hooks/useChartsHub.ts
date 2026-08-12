import { useQuery } from "@tanstack/react-query";

export type HubRow = Record<string, string>;

export interface HubSheetData {
  headers: string[];
  rows: HubRow[];
  chartDate?: string | null;
}

export interface ChartsHubData {
  lastUpdated: string;
  sheets: Record<string, HubSheetData>;
}

const EMPTY_CHARTS_HUB: ChartsHubData = {
  lastUpdated: "",
  sheets: {},
};

async function fetchChartsHub(): Promise<ChartsHubData> {
  try {
    const resp = await fetch("/api/charts/hub", { cache: "no-store" });
    if (!resp.ok) return EMPTY_CHARTS_HUB;
    return await resp.json() as ChartsHubData;
  } catch {
    return EMPTY_CHARTS_HUB;
  }
}

export function useChartsHub({ enabled = true, retry = 1 }: { enabled?: boolean; retry?: number } = {}) {
  return useQuery<ChartsHubData>({
    queryKey: ["charts-hub"],
    queryFn: fetchChartsHub,
    enabled,
    staleTime: 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry,
  });
}
