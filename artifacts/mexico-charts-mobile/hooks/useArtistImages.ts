import { useQuery } from "@tanstack/react-query";

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) {
    if (__DEV__) {
      console.warn("[useArtistImages] EXPO_PUBLIC_DOMAIN is not set; artist images will not load.");
    }
    return "";
  }
  return `https://${domain}`;
}

async function fetchArtistImages(
  names: string[]
): Promise<Record<string, string | null>> {
  if (names.length === 0) return {};
  const baseUrl = getBaseUrl();
  if (!baseUrl) return Object.fromEntries(names.map((n) => [n, null]));
  const query = names.map(encodeURIComponent).join(",");
  const res = await fetch(`${baseUrl}/api/spotify/artist-images?names=${query}`);
  if (!res.ok) throw new Error(`Failed to fetch artist images: ${res.status}`);
  return res.json() as Promise<Record<string, string | null>>;
}

export function useArtistImages(names: string[]): Record<string, string | null> {
  const key = names.slice().sort().join(",");
  const { data } = useQuery<Record<string, string | null>>({
    queryKey: ["artistImages", key],
    queryFn: () => fetchArtistImages(names),
    staleTime: 1000 * 60 * 10,
    enabled: names.length > 0,
  });
  return data ?? {};
}

export function useArtistImage(name: string): string | null {
  const { data } = useQuery<Record<string, string | null>>({
    queryKey: ["artistImages", name],
    queryFn: () => fetchArtistImages([name]),
    staleTime: 1000 * 60 * 10,
    enabled: !!name,
  });
  return data?.[name] ?? null;
}
