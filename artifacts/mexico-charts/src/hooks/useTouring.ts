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
  eventKind?: "concert" | "auxiliary";
  eventStatus?: string | null;
  publicSaleStart?: string | null;
  publicSaleEnd?: string | null;
  priceRanges?: { type: string | null; currency: string | null; min: number | null; max: number | null }[];
  seatMapUrl?: string | null;
  source?: "ticketmaster-discovery-v2";
}

export interface TouringLabTour {
  artistId: string; artistName: string; tourName: string;
  status: "upcoming" | "active" | "completed" | "unknown";
  concertCount: number; firstConcertDate: string | null; lastConcertDate: string | null;
  nextConcertDate: string | null; lastObservedAt: string;
  demandScore: null; demandConfidence: "unavailable"; demandLabel: string;
}

export interface TouringLabData {
  available: boolean; label: string; generatedAt?: string; source?: string; sourceNote?: string;
  demandScore: null; demandConfidence: "unavailable"; methodology?: string; message?: string;
  tours: TouringLabTour[];
  recentChanges: { eventId: string; artistName: string; eventName: string; observedAt: string; changedFields: string[] }[];
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
  const urls = import.meta.env.DEV
    ? ["/api/touring/concerts", LIVE_TOURING_API]
    : ["/api/touring/concerts"];
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Touring request failed (${res.status}) for ${url}`);
      }
      const data = await res.json();
      return cleanTouringArtists((data.artists ?? []) as ArtistTours[]);
    }),
  );
  const available = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  if (available.length === 0) {
    throw new Error("Failed to fetch touring data from every available source");
  }

  return available.reduce((best, artists) => {
    if (!hasAnyEvents(best) && hasAnyEvents(artists)) return artists;
    return countEvents(artists) > countEvents(best) ? artists : best;
  });
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
  const path = `/api/touring/concerts/${encodeURIComponent(artistId)}`;
  const urls = import.meta.env.DEV
    ? [path, `${LIVE_TOURING_API}/${encodeURIComponent(artistId)}`]
    : [path];
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Artist touring request failed (${res.status}) for ${url}`);
      }
      return cleanTouringArtist(await res.json() as ArtistTours);
    }),
  );
  const available = results.flatMap((result) =>
    result.status === "fulfilled" && result.value !== null ? [result.value] : [],
  );
  const artist = available.sort((a, b) => b.events.length - a.events.length)[0];
  if (artist) return artist;
  if (results.some((result) => result.status === "fulfilled")) return null;
  throw new Error("Failed to fetch artist touring data from every available source");
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

export function useTouringLab() {
  return useQuery<TouringLabData>({
    queryKey: ["touring", "lab"],
    queryFn: async () => {
      const response = await fetch("/api/touring/lab");
      if (!response.ok) throw new Error("Failed to fetch Touring Lab");
      return response.json() as Promise<TouringLabData>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
