import { useState, useEffect } from "react";

export interface ItunesArtistResult {
  appleId: string;
  appleUrl: string;
  artworkUrlHd: string | null;
  primaryGenre: string | null;
}

export interface ItunesArtistStatus {
  data: ItunesArtistResult | null;
  isLoading: boolean;
  isFetched: boolean;
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

export function useItunesArtistWithStatus(name: string, enabled = true): ItunesArtistStatus {
  const [state, setState] = useState<ItunesArtistStatus>({
    data: null,
    isLoading: enabled && Boolean(name),
    isFetched: false,
  });

  useEffect(() => {
    if (!name || !enabled) {
      setState({ data: null, isLoading: false, isFetched: !enabled });
      return;
    }
    let cancelled = false;
    setState({ data: null, isLoading: true, isFetched: false });

    const params = new URLSearchParams({
      entity: "musicArtist",
      term: name,
      country: "mx",
      limit: "5",
    });

    fetch(`/api/providers/itunes/search?${params.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: { results?: NormalizedResult[] } | null) => {
        if (cancelled) return;
        setState({
          data: data?.results ? pickBestMatch(name, data.results) : null,
          isLoading: false,
          isFetched: true,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, isLoading: false, isFetched: true });
      });

    return () => {
      cancelled = true;
    };
  }, [name, enabled]);

  return state;
}

export function useItunesArtist(name: string, enabled = true): ItunesArtistResult | null {
  return useItunesArtistWithStatus(name, enabled).data;
}
