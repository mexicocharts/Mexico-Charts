import { useQuery } from "@tanstack/react-query";

export interface HubRow {
  Rank: number;
  Prev: number;
  Artist: string;
  isMexican: boolean;
  Streak: number;
  Movement: string;
}

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return `https://${domain}`;
}

async function fetchHubData(): Promise<HubRow[]> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return [];
  try {
    const res = await fetch(`${baseUrl}/api/charts/hub`);
    if (!res.ok) return [];
    const data = await res.json();
    const rows: any[] = data?.sheets?.["Spotify_Artists_Daily"]?.rows ?? [];
    return rows
      .map((r: any) => ({
        Rank: parseInt(r["Rank"] ?? "", 10) || 0,
        Prev: parseInt(r["Prev"] ?? "", 10) || 0,
        Artist: (r["Artist"] ?? "").trim(),
        isMexican: (r["Contains Mexican Artist"] ?? "").toUpperCase() === "TRUE",
        Streak: parseInt(r["Streak"] ?? "", 10) || 0,
        Movement: r["Movement"] ?? "",
      }))
      .filter((r) => r.Artist && r.Rank > 0)
      .sort((a, b) => a.Rank - b.Rank);
  } catch {
    return [];
  }
}

export function useHubData() {
  const { data, isLoading, error } = useQuery<HubRow[]>({
    queryKey: ["hubData"],
    queryFn: fetchHubData,
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });
  return { rows: data ?? [], isLoading, hasError: !!error };
}
