import { useQuery } from "@tanstack/react-query";

const CHUNK_SIZE = 20;

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

async function fetchChunk(
  names: string[],
  baseUrl: string
): Promise<Record<string, string | null>> {
  if (!baseUrl || names.length === 0) return {};
  const query = names.map(encodeURIComponent).join(",");
  const res = await fetch(`${baseUrl}/api/spotify/artist-images?names=${query}`);
  if (!res.ok) return {};
  return res.json() as Promise<Record<string, string | null>>;
}

async function fetchArtistImages(
  names: string[]
): Promise<Record<string, string | null>> {
  if (names.length === 0) return {};
  const baseUrl = getBaseUrl();
  if (!baseUrl) return Object.fromEntries(names.map((n) => [n, null]));

  const chunks: string[][] = [];
  for (let i = 0; i < names.length; i += CHUNK_SIZE) {
    chunks.push(names.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(chunks.map((c) => fetchChunk(c, baseUrl)));
  const merged: Record<string, string | null> = {};
  for (const r of results) Object.assign(merged, r);
  return merged;
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
