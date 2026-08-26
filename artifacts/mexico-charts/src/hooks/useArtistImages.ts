import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { normalizeArtistName } from "@/utils/normalizeArtistName";

type ArtistImageMap = Record<string, string | null>;

const CHUNK_SIZE = 20;

const CACHE_BUST = "v3";

export function normalizeArtistImageKey(name: string): string {
  return normalizeArtistName(name) || name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isValidArtistImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    const path = url.pathname.toLowerCase();
    return (url.protocol === "http:" || url.protocol === "https:")
      && !path.includes("/artist//")
      && !path.includes("/noimage/")
      && !path.includes("d41d8cd98f00b204e9800998ecf8427e");
  } catch {
    return false;
  }
}

export function proxyArtistImageUrl(url: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

export function getArtistImageUrl(images: ArtistImageMap, ...names: readonly string[]): string | null {
  for (const name of names) {
    const normalized = normalizeArtistImageKey(name);
    const candidate = images[normalized] ?? images[name];
    if (isValidArtistImageUrl(candidate)) return candidate;
  }
  return null;
}

function uniqueArtistImageNames(names: readonly string[]): string[] {
  return Array.from(
    new Map(
      names
        .map((name) => name?.trim())
        .filter(Boolean)
        .map((name) => [name!.toLowerCase().replace(/\s+/g, " "), name!] as const)
    ).values()
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

async function fetchChunk(names: string[]): Promise<ArtistImageMap> {
  try {
    const resp = await fetch(
      `/api/spotify/artist-images?_=${CACHE_BUST}&names=${encodeURIComponent(names.join(","))}`
    );
    if (!resp.ok) return {};
    const result = await resp.json() as ArtistImageMap;
    const normalized: ArtistImageMap = {};
    for (const [name, url] of Object.entries(result)) {
      const validUrl = isValidArtistImageUrl(url) ? url : null;
      if (validUrl || !isValidArtistImageUrl(normalized[name])) {
        normalized[name] = validUrl;
      }
      const normalizedKey = normalizeArtistImageKey(name);
      if (validUrl || !isValidArtistImageUrl(normalized[normalizedKey])) {
        normalized[normalizedKey] = validUrl;
      }
    }
    return normalized;
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
  for (const result of results) {
    for (const [key, url] of Object.entries(result)) {
      if (isValidArtistImageUrl(url) || !isValidArtistImageUrl(merged[key])) {
        merged[key] = url;
      }
    }
  }
  return merged;
}

export function useArtistImagesQuery(names: readonly string[]) {
  const uniqueNames = useMemo(() => uniqueArtistImageNames(names), [names]);
  return useQuery({
    queryKey: ["artist-images", CACHE_BUST, uniqueNames],
    queryFn: () => fetchArtistImages(uniqueNames),
    enabled: uniqueNames.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });
}

export function useArtistImagesWithStatus(names: readonly string[]): {
  images: ArtistImageMap;
  isFetched: boolean;
} {
  const { data, isFetched } = useArtistImagesQuery(names);
  return { images: data ?? {}, isFetched };
}

export function useArtistImages(names: readonly string[]): ArtistImageMap {
  const { data } = useArtistImagesQuery(names);

  return data ?? {};
}
