export type Observation = {date: string; dailyViews?: number|null; dailyStreams?: number|null; value?: number|null};
export function observationValue(point: Omit<Observation,'date'>): number|null;
export function recentObservations<T extends Observation>(points:T[],limit?:number):T[];
export function observationCoordinates(points:Observation[],left:number,width:number):Array<{date:string;value:number|null;x:number;startsSegment:boolean}>;
