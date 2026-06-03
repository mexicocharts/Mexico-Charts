import { useQuery } from "@tanstack/react-query";

export interface ChartEntry {
  pos: number;
  posChange: string;
  artist: string;
  title: string;
  features: string[];
  trackId: string;
  streams: string;
  totalStreams: string;
  coverUrl: string | null;
}

interface ChartResponse {
  period: string;
  fetchedAt: string;
  entries: ChartEntry[];
}

export type Row = Record<string, string>;
export interface SheetData { headers: string[]; rows: Row[] }
export interface HubData { lastUpdated: string; sheets: Record<string, SheetData> }

export function useSpotifyChart(period: "daily" | "weekly") {
  return useQuery<ChartResponse>({
    queryKey: ["social-mx-spotify", period],
    queryFn: async () => {
      const r = await fetch(`/api/charts/mx-spotify?period=${period}&withCovers=1`);
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

export function useChartsHub() {
  return useQuery<HubData>({
    queryKey: ["social-charts-hub"],
    queryFn: async () => {
      const r = await fetch("/api/charts/hub");
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

export function useArtistImageMap(names: string[]) {
  const key = [...names].sort().join(",");
  return useQuery<Record<string, string | null>>({
    queryKey: ["social-artist-images", key],
    queryFn: async () => {
      if (!names.length) return {};
      const r = await fetch(
        `/api/spotify/artist-images?names=${encodeURIComponent(names.join(","))}`
      );
      if (!r.ok) return {};
      return r.json();
    },
    staleTime: 60 * 60 * 1000,
    enabled: names.length > 0,
  });
}

export interface ArtworkLookupItem {
  id: string;
  title: string;
  artist: string;
}

export function useSocialArtwork(type: "track" | "album", items: ArtworkLookupItem[]) {
  const key = items.map(item => `${item.id}:${item.artist}:${item.title}`).join("|");
  return useQuery<Record<string, string | null>>({
    queryKey: ["social-artwork", type, key],
    queryFn: async () => {
      if (!items.length) return {};
      const r = await fetch("/api/charts/social-artwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, items }),
      });
      if (!r.ok) return {};
      const data = await r.json() as { results?: Record<string, string | null> };
      return data.results ?? {};
    },
    staleTime: 24 * 60 * 60 * 1000,
    enabled: items.length > 0,
    retry: 1,
  });
}

export function parseMovement(posChange: string): { movement?: number; isNew?: boolean } {
  if (posChange === "NEW") return { isNew: true };
  if (posChange === "=" || posChange === "") return { movement: 0 };
  const n = parseInt(posChange);
  return isNaN(n) ? { movement: 0 } : { movement: n };
}

export function fmtStreams(s: string): string {
  const n = parseInt(s.replace(/,/g, "").replace(/\./g, ""));
  if (isNaN(n)) return s;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function primaryArtist(credit: string): string {
  return credit.split(/[,&/]|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+/i)[0].trim();
}

export function artistImageUrl(
  images: Record<string, string | null> | undefined,
  name: string
): string | null {
  const clean = name.trim();
  if (!images || !clean) return null;
  return (
    images[clean] ??
    images[primaryArtist(clean)] ??
    images[clean.toLowerCase()] ??
    images[primaryArtist(clean).toLowerCase()] ??
    null
  );
}

/**
 * Convert an external CDN image URL into a same-origin proxied URL.
 * This makes it fetchable by html-to-image inside SVG foreignObject
 * without hitting cross-origin restrictions.
 * Local URLs (starting with /) are returned unchanged.
 */
export function proxyImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (url.startsWith("/") || !url.includes("://")) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export function suppressDuplicateImages(urls: Array<string | null | undefined>) {
  const usable = urls.filter((url): url is string => Boolean(url));
  if (usable.length < 2) return urls;
  const unique = new Set(usable);
  if (unique.size > 1) return urls;
  return urls.map(() => null);
}

export function imageFromRow(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) return value;
  }
  return null;
}
