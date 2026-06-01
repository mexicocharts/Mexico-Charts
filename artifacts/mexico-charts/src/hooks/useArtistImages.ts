import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

type ArtistImageMap = Record<string, string | null>;

const CHUNK_SIZE = 20;

const CACHE_BUST = "v2";

async function fetchChunk(names: string[]): Promise<ArtistImageMap> {
  try {
    const resp = await fetch(
      `/api/spotify/artist-images?_=${CACHE_BUST}&names=${encodeURIComponent(names.join(","))}`
    );
    if (!resp.ok) return {};
    return resp.json() as Promise<ArtistImageMap>;
  } catch {
    return {};
  }
}

async function fetchArtistImages(names: string[]): Promise<ArtistImageMap> {
  const chunks: string[][] = [];
  for (let i = 0; i < names.length; i += CHUNK_SIZE) {
    chunks.push(names.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(chunks.map((chunk) => fetchChunk(chunk)));
  const merged: ArtistImageMap = {};
  for (const result of results) Object.assign(merged, result);
  return merged;
}

export function useArtistImages(names: readonly string[]): ArtistImageMap {
  const uniqueNames = useMemo(
    () => Array.from(new Set(names.map((name) => name?.trim()).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })),
    [names],
  );

  const { data } = useQuery({
    queryKey: ["artist-images", CACHE_BUST, uniqueNames],
    queryFn: () => fetchArtistImages(uniqueNames),
    enabled: uniqueNames.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return data ?? {};
}
