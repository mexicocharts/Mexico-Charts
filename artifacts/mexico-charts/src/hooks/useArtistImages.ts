import { useState, useEffect } from "react";

type ArtistImageMap = Record<string, string | null>;

export function useArtistImages(names: readonly string[]): ArtistImageMap {
  const [images, setImages] = useState<ArtistImageMap>({});
  const key = [...names].sort().join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    fetch(`/api/spotify/artist-images?names=${encodeURIComponent(names.join(","))}`)
      .then((r) => (r.ok ? (r.json() as Promise<ArtistImageMap>) : Promise.reject()))
      .then((data) => {
        if (!cancelled) setImages(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return images;
}
