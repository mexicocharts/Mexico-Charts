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

function pickBestMatch(
  name: string,
  results: { artistId: number; artistName: string; artistLinkUrl: string; artworkUrl: string | null; artworkUrlHd: string | null; primaryGenreName: string | null }[]
): ItunesArtistResult | null {
  const target = normalize(name);
  const exact = results.find(r => normalize(r.artistName) === target);
  const match = exact ?? null;
  if (!match) return null;
  return {
    appleId: String(match.artistId),
    appleUrl: match.artistLinkUrl,
    artworkUrlHd: match.artworkUrlHd ?? match.artworkUrl ?? null,
    primaryGenre: match.primaryGenreName ?? null,
  };
}

export function useItunesArtist(name: string): ItunesArtistResult | null {
  const [result, setResult] = useState<ItunesArtistResult | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;

    const params = new URLSearchParams({
      entity: "musicArtist",
      term: name,
      country: "mx",
      limit: "5",
    });

    fetch(`/api/providers/itunes/search?${params.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: { results?: unknown[] } | null) => {
        if (cancelled || !data?.results) return;
        const match = pickBestMatch(name, data.results as Parameters<typeof pickBestMatch>[1]);
        setResult(match);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [name]);

  return result;
}
