import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type Confidence = "high" | "medium" | "limited" | "unavailable";
export interface IntelligenceTour {
  artistId: string; artistName: string; tourName: string; status: string; concertCount: number;
  nextConcertDate: string | null; appearanceType: "tour" | "festival" | "residency" | "standalone";
  featuredScore: number; demandScore: number; demandConfidence: Confidence; demandLabel: string;
}
export interface EventEconomics {
  eventId: string; venue: { id: string | null; name: string | null };
  capacity: { low: number; high: number; configuration: string; confidence: Confidence; sourceUrl: string } | null;
  standardPrimaryPrice: { currency: "USD"; min: number; max: number } | null;
  estimatedGrossUsd: { low: number; high: number; confidence: Confidence } | null;
}
export interface TouringIntelligence {
  generatedAt: string; tours: IntelligenceTour[]; events: EventEconomics[];
  recentChanges: Array<{ eventId: string; artistName: string; eventName: string; observedAt: string; changedFields: string[] }>;
  rules: { inventory: string; gross: string };
}
export interface WatchArtist {
  artist_id: string; artist_name: string; urgent_alerts: boolean; daily_digest: boolean;
  announcement_alerts: boolean; onsale_alerts: boolean; change_alerts: boolean;
}

export function useTouringIntelligence() {
  return useQuery<TouringIntelligence>({ queryKey: ["touring","intelligence"], queryFn: async () => {
    const response=await fetch("/api/touring/intelligence"); if(!response.ok) throw new Error("Touring intelligence unavailable"); return response.json();
  }, staleTime: 5*60*1000, retry: 1 });
}

export function useTouringEventHistory(eventId: string) {
  return useQuery<{ eventId: string; observations: Array<{ observed_at: string; event_status: string | null; public_sale_start: string | null; public_sale_end: string | null; price_ranges: unknown[] }> }>({
    queryKey:["touring","history",eventId], enabled:Boolean(eventId), queryFn:async()=>{
      const response=await fetch(`/api/touring/events/${encodeURIComponent(eventId)}/history`); if(!response.ok) throw new Error("Event history unavailable"); return response.json();
    }, staleTime: 5*60*1000,
  });
}

export function useTouringWatchlist() {
  return useQuery<{ artists: WatchArtist[] }>({ queryKey:["account","touring","watchlist"], queryFn:async()=>{
    const response=await fetch("/api/account/touring/watchlist"); if(response.status===401||response.status===503) return {artists:[]}; if(!response.ok) throw new Error("Watchlist unavailable"); return response.json();
  }, retry:false });
}

export function useSaveTouringWatch() {
  const client=useQueryClient();
  return useMutation({ mutationFn:async(input:{artistId:string;artistName:string;urgentAlerts?:boolean;dailyDigest?:boolean;announcementAlerts?:boolean;onsaleAlerts?:boolean;changeAlerts?:boolean})=>{
    const response=await fetch(`/api/account/touring/watchlist/${encodeURIComponent(input.artistId)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}); if(!response.ok) throw new Error(response.status===401?"Inicia sesión para seguir artistas":"No se pudo guardar"); return response.json();
  },onSuccess:()=>client.invalidateQueries({queryKey:["account","touring","watchlist"]}) });
}

export function useRemoveTouringWatch() {
  const client=useQueryClient();
  return useMutation({ mutationFn:async(artistId:string)=>{const response=await fetch(`/api/account/touring/watchlist/${encodeURIComponent(artistId)}`,{method:"DELETE"});if(!response.ok)throw new Error("No se pudo eliminar");},onSuccess:()=>client.invalidateQueries({queryKey:["account","touring","watchlist"]}) });
}
