import { useEffect, useState } from "react";

export interface DeezerArtistResult {
  deezerId: string;
  deezerUrl: string;
  artistName: string;
}

export function useDeezerArtist(name: string): DeezerArtistResult | null {
  const [result, setResult] = useState<DeezerArtistResult | null>(null);

  useEffect(() => {
    setResult(null);
    if (!name) return;
    let cancelled = false;

    fetch(`/api/providers/deezer/artist?name=${encodeURIComponent(name)}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then((data: { result?: DeezerArtistResult | null } | null) => {
        if (!cancelled) setResult(data?.result ?? null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [name]);

  return result;
}
