import { useEffect, useState } from "react";

export interface ArtistEnrichment {
  artistKey: string;
  canonicalArtistKey?: string;
  spotify: {
    artistId: string;
    name: string | null;
    url: string | null;
    imageUrl: string | null;
    uri: string | null;
    followers: number | null;
    followersFmt: string | null;
    popularity: number | null;
    genres: string[];
    capability: string;
    notes: string | null;
    verified: boolean;
    lastUpdated: string;
  } | null;
  musicbrainz: {
    mbid: string;
    name: string | null;
    sortName: string | null;
    disambiguation: string | null;
    type: string | null;
    country: string | null;
    areaName: string | null;
    beginDate: string | null;
    tags: string[];
    relations: Array<{ type: string; url: string }>;
    verified: string;
    lastUpdated: string;
    url: string;
  } | null;
  youtube: {
    channelId: string;
    title: string | null;
    thumbnailUrl: string | null;
    subscribers: number | null;
    subscribersFmt: string | null;
    views: number | null;
    viewsFmt: string | null;
    videoCount: number | null;
    customUrl: string | null;
    channelUrl: string;
    cachedAt: string;
  } | null;
}

export interface VerifiedArtistSummary {
  artistKey: string;
  sources: Array<"spotify" | "youtube" | "musicbrainz">;
}

export function useArtistEnrichment(artistKey: string): ArtistEnrichment | null {
  const [result, setResult] = useState<ArtistEnrichment | null>(null);

  useEffect(() => {
    if (!artistKey) return;
    let cancelled = false;
    setResult(null);

    fetch(`/api/artists/enrichment/${encodeURIComponent(artistKey)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: ArtistEnrichment | null) => {
        if (cancelled || !data?.artistKey) return;
        setResult(data);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [artistKey]);

  return result;
}

export function useVerifiedArtistKeys(): Set<string> {
  const [keys, setKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    fetch("/api/artists/verified")
      .then(r => (r.ok ? r.json() : null))
      .then((data: { artists?: VerifiedArtistSummary[] } | null) => {
        if (cancelled || !Array.isArray(data?.artists)) return;
        setKeys(new Set(data.artists.map(artist => artist.artistKey.trim().toLowerCase()).filter(Boolean)));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  return keys;
}
