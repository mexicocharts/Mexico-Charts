import { useQuery } from "@tanstack/react-query";

// ── Types (mirrors API server) ───────────────────────────────────────────────

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

// ── Base URL ─────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) {
    if (__DEV__) console.warn("[useTouring] EXPO_PUBLIC_DOMAIN not set");
    return "";
  }
  return `https://${domain}`;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchConcerts(): Promise<ArtistTours[]> {
  const base = getBaseUrl();
  if (!base) return [];
  const res = await fetch(`${base}/api/touring/concerts`);
  if (!res.ok) throw new Error(`touring/concerts HTTP ${res.status}`);
  const data = (await res.json()) as { artists: ArtistTours[] };
  return data.artists ?? [];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface TouringResult {
  artists: ArtistTours[];
  totalShows: number;
  artistsOnTour: number;
  isLoading: boolean;
  hasError: boolean;
}

export function useTouring(): TouringResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ["touring", "concerts"],
    queryFn: fetchConcerts,
    staleTime: 1000 * 60 * 8,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const artists = data
    ? [...data].sort((a, b) => b.events.length - a.events.length)
    : [];
  const totalShows = artists.reduce((s, a) => s + a.events.length, 0);
  const artistsOnTour = artists.filter((a) => a.events.length > 0).length;

  return { artists, totalShows, artistsOnTour, isLoading, hasError: !!error };
}
