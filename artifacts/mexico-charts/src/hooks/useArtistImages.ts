import { useState, useEffect } from "react";

type ArtistImageMap = Record<string, string | null>;

const CHUNK_SIZE = 20;

async function fetchChunk(names: string[]): Promise<ArtistImageMap> {
  const resp = await fetch(
    `/api/spotify/artist-images?names=${encodeURIComponent(names.join(","))}`
  );
  if (!resp.ok) return {};
  return resp.json() as Promise<ArtistImageMap>;
}

export function useArtistImages(names: readonly string[]): ArtistImageMap {
  const [images, setImages] = useState<ArtistImageMap>({});
  const key = [...names].sort().join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    const chunks: string[][] = [];
    for (let i = 0; i < names.length; i += CHUNK_SIZE) {
      chunks.push(names.slice(i, i + CHUNK_SIZE) as string[]);
    }

    // Fire all chunks in parallel; merge results as each resolves
    Promise.all(chunks.map((chunk) => fetchChunk(chunk))).then((results) => {
      if (cancelled) return;
      const merged: ArtistImageMap = {};
      for (const r of results) Object.assign(merged, r);
      setImages(merged);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return images;
}
