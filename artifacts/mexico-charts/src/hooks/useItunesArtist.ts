import { useState, useEffect } from "react";

export interface ItunesArtistResult {
  appleId: string;
  appleUrl: string;
  artworkUrlHd: string | null;
  primaryGenre: string | null;
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

interface NormalizedResult {
  appleId: string | null;
  appleUrl: string | null;
  artistName: string | null;
  artworkUrlHd: string | null;
  primaryGenreName: string | null;
}

function pickBestMatch(name: string, results: NormalizedResult[]): ItunesArtistResult | null {
  const target = normalize(name);
  const match = results.find(r => r.artistName != null && normalize(r.artistName) === target);
  if (!match || !match.appleId || !match.appleUrl) return null;
  return {
    appleId: match.appleId,
    appleUrl: match.appleUrl,
    artworkUrlHd: match.artworkUrlHd ?? null,
    primaryGenre: match.primaryGenreName ?? null,
  };
}

export function useItunesArtist(name: string, enabled = true): ItunesArtistResult | null {
  const [result, setResult] = useState<ItunesArtistResult | null>(null);

  useEffect(() => {
    if (!name || !enabled) {
      if (!enabled) setResult(null);
      return;
    }
    let cancelled = false;

    const params = new URLSearchParams({
      entity: "musicArtist",
      term: name,
      country: "mx",
      limit: "5",
    });

    fetch(`/api/providers/itunes/search?${params.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: { results?: NormalizedResult[] } | null) => {
        if (cancelled || !data?.results) return;
        setResult(pickBestMatch(name, data.results));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [name, enabled]);

  return result;
}
