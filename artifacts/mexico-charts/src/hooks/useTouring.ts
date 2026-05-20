import { useQuery } from "@tanstack/react-query";

export interface TmEvent {
  eventId: string;
  name: string;
  date: string;
  time: string | null;
  venue: string;
  city: string;
  state: string;
  country: string;
  url: string;
  img: string | null;
}

export interface ArtistTours {
  id: string;
  name: string;
  events: TmEvent[];
  fetchedAt: number;
}

const LIVE_TOURING_API = "https://mexicochart.com/api/touring/concerts";

function hasAnyEvents(artists: ArtistTours[]) {
  return artists.some((artist) => artist.events.length > 0);
}

function countEvents(artists: ArtistTours[]) {
  return artists.reduce((total, artist) => total + artist.events.length, 0);
}

async function fetchAllConcerts(): Promise<ArtistTours[]> {
  const res = await fetch("/api/touring/concerts");
  if (!res.ok) throw new Error("Failed to fetch touring data");
  const data = await res.json();
  const localArtists = data.artists as ArtistTours[];

  if (import.meta.env.DEV) {
    const liveRes = await fetch(LIVE_TOURING_API);
    if (liveRes.ok) {
      const liveData = await liveRes.json();
      const liveArtists = liveData.artists as ArtistTours[];
      if (hasAnyEvents(liveArtists) && countEvents(liveArtists) > countEvents(localArtists)) {
        return liveArtists;
      }
    }
  }

  return localArtists;
}

export function useTouring() {
  return useQuery<ArtistTours[]>({
    queryKey: ["touring", "concerts"],
    queryFn: fetchAllConcerts,
    staleTime: 8 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

async function fetchArtistConcerts(artistId: string): Promise<ArtistTours | null> {
  if (!artistId) return null;
  const res = await fetch(`/api/touring/concerts/${encodeURIComponent(artistId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch artist touring data");
  return res.json();
}

export function useArtistTouring(artistId: string | null | undefined) {
  return useQuery<ArtistTours | null>({
    queryKey: ["touring", "artist", artistId],
    queryFn: () => fetchArtistConcerts(artistId ?? ""),
    enabled: Boolean(artistId),
    staleTime: 8 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
