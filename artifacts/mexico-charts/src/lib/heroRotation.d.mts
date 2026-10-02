export const HERO_ROTATION_INTERVAL: number;
export interface RotationState {paused:boolean; hovered:boolean}
export type RotationAction = 'pause'|'resume'|'focus'|'select'|'enter'|'leave';
export function rotationState(state:RotationState, action:RotationAction):RotationState;
export function nextHeroIndex(index:number, count:number, state:RotationState, guards:{reduced:boolean|null; campaign:boolean}):number|null;
export function rotationIntent(state:RotationState, pointerIntent?:'pause'|'resume'|null):'pause'|'resume';
export function selectedHero<T>(artists:T[], index:number, focusLock?:T|null):T|null;
