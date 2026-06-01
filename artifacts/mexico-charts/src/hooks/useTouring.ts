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

function normalizedEventPart(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isNonConcertListing(event: TmEvent) {
  const name = normalizedEventPart(event.name);
  return (
    name.includes("premium club seats") ||
    name.includes("parking") ||
    name.includes("vip package")
  );
}

function cleanTouringArtist(artist: ArtistTours): ArtistTours {
  const seen = new Set<string>();
  const events = (artist.events ?? []).filter((event) => {
    if (isNonConcertListing(event)) return false;
    const key = [
      normalizedEventPart(event.date),
      normalizedEventPart(event.venue),
      normalizedEventPart(event.city),
      normalizedEventPart(event.state),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ...artist, events };
}

function cleanTouringArtists(artists: ArtistTours[]) {
  return artists.map(cleanTouringArtist);
}

async function fetchAllConcerts(): Promise<ArtistTours[]> {
  const res = await fetch("/api/touring/concerts");
  if (!res.ok) throw new Error("Failed to fetch touring data");
  const data = await res.json();
  const localArtists = cleanTouringArtists((data.artists ?? []) as ArtistTours[]);

  if (import.meta.env.DEV) {
    const liveRes = await fetch(LIVE_TOURING_API);
    if (liveRes.ok) {
      const liveData = await liveRes.json();
      const liveArtists = cleanTouringArtists((liveData.artists ?? []) as ArtistTours[]);
      if (hasAnyEvents(liveArtists) && countEvents(liveArtists) > countEvents(localArtists)) {
        return liveArtists;
      }
    }
  }

  return localArtists;
}

export function useTouring({ enabled = true, retry = 1 }: { enabled?: boolean; retry?: number } = {}) {
  return useQuery<ArtistTours[]>({
    queryKey: ["touring", "concerts"],
    queryFn: fetchAllConcerts,
    enabled,
    staleTime: 8 * 60 * 1000,
    retry,
    refetchOnWindowFocus: false,
  });
}

async function fetchArtistConcerts(artistId: string): Promise<ArtistTours | null> {
  if (!artistId) return null;
  const res = await fetch(`/api/touring/concerts/${encodeURIComponent(artistId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch artist touring data");
  const artist = await res.json() as ArtistTours;
  return cleanTouringArtist(artist);
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
