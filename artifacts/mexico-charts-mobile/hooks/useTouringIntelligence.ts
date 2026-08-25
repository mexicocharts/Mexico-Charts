import { useQuery } from "@tanstack/react-query";

export interface MobileIntelligenceTour {
  artistId:string;artistName:string;tourName:string;concertCount:number;nextConcertDate:string|null;
  appearanceType:"tour"|"festival"|"residency"|"standalone";featuredScore:number;demandScore:number;demandConfidence:"high"|"medium"|"limited"|"unavailable";
}
export interface MobileTouringComparison {
  artist_id:string;artist_name:string;market:string|null;venue_scale:string;shows:number;
  estimated_gross_usd:number|null;confidence?:string|null;
}
export interface MobileTouringEvent {
  eventId:string;venue:{id:string|null;name:string|null};
  capacity:{low:number;high:number;configuration:string|null;confidence:string|null;sourceUrl:string}|null;
  standardPrimaryPrice:{currency:string;min:number;max:number}|null;
  estimatedGrossUsd:{low:number;high:number;confidence:string}|null;
}
export interface MobileTouringAttention {
  missing_capacity:number;missing_currency:number;missing_tour_grouping:number;low_confidence:number;
}
export interface MobileTouringReview {
  id:string|number;review_type:string;artist_name:string;title:string;event_id:string|null;
  source_url:string|null;created_at:string;
}
export interface MobileTouringOperations {
  attention:MobileTouringAttention;reviewQueue:MobileTouringReview[];
}
export interface MobileTouringIntelligence {
  generatedAt:string;tours:MobileIntelligenceTour[];
  recentChanges:Array<{eventId:string;artistName:string;eventName:string;observedAt:string;changedFields:string[]}>;
  comparisons:MobileTouringComparison[];events:MobileTouringEvent[];
  operations?:MobileTouringOperations;
}

async function fetchIntelligence(){
  const domain=process.env.EXPO_PUBLIC_DOMAIN;
  if(!domain)return {generatedAt:new Date().toISOString(),tours:[],recentChanges:[],comparisons:[],events:[]};
  const response=await fetch(`https://${domain}/api/touring/intelligence`);
  if(!response.ok)throw new Error(`touring/intelligence HTTP ${response.status}`);
  const data=await response.json() as MobileTouringIntelligence;
  const adminKey=process.env.EXPO_PUBLIC_TOURING_ADMIN_KEY?.trim();
  if(!adminKey)return data;
  const operations=await fetch(`https://${domain}/api/admin/touring/operations`,{headers:{"X-Admin-Key":adminKey}});
  if(!operations.ok)return data;
  return {...data,operations:await operations.json() as MobileTouringOperations};
}
export function useTouringIntelligence(){return useQuery<MobileTouringIntelligence>({queryKey:["touring","intelligence"],queryFn:fetchIntelligence,staleTime:5*60*1000,retry:1});}
