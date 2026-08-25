import { useQuery } from "@tanstack/react-query";

export interface MobileIntelligenceTour {
  artistId:string;artistName:string;tourName:string;concertCount:number;nextConcertDate:string|null;
  appearanceType:"tour"|"festival"|"residency"|"standalone";featuredScore:number;demandScore:number;demandConfidence:"high"|"medium"|"limited"|"unavailable";
}
export interface MobileTouringIntelligence {generatedAt:string;tours:MobileIntelligenceTour[];recentChanges:Array<{eventId:string;artistName:string;eventName:string;observedAt:string;changedFields:string[]}>}

async function fetchIntelligence(){const domain=process.env.EXPO_PUBLIC_DOMAIN;if(!domain)return {generatedAt:new Date().toISOString(),tours:[],recentChanges:[]};const response=await fetch(`https://${domain}/api/touring/intelligence`);if(!response.ok)throw new Error(`touring/intelligence HTTP ${response.status}`);return response.json() as Promise<MobileTouringIntelligence>}
export function useTouringIntelligence(){return useQuery<MobileTouringIntelligence>({queryKey:["touring","intelligence"],queryFn:fetchIntelligence,staleTime:5*60*1000,retry:1});}
