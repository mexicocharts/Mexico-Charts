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

async function fetchAllConcerts(): Promise<ArtistTours[]> {
  const res = await fetch("/api/touring/concerts");
  if (!res.ok) throw new Error("Failed to fetch touring data");
  const data = await res.json();
  return data.artists as ArtistTours[];
}

export function useTouring() {
  return useQuery<ArtistTours[]>({
    queryKey: ["touring", "concerts"],
    queryFn: fetchAllConcerts,
    staleTime: 8 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
