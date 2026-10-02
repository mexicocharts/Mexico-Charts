export const HERO_ROTATION_INTERVAL = 5000;

export function rotationState(state, action) {
  if (action === 'pause' || action === 'focus' || action === 'select') return {...state, paused:true};
  if (action === 'resume') return {...state, paused:false};
  if (action === 'enter') return {...state, hovered:true};
  if (action === 'leave') return {...state, hovered:false};
  return state;
}

export function nextHeroIndex(index, count, state, guards) {
  if (guards.reduced || guards.campaign || state.paused || state.hovered || count < 2) return null;
  const current = Number.isInteger(index) && index >= 0 && index < count ? index : 0;
  return (current + 1) % count;
}

export function rotationIntent(state, pointerIntent = null) {
  return pointerIntent ?? (state.paused ? 'resume' : 'pause');
}

export function selectedHero(artists, index, focusLock = null) {
  return focusLock ?? artists[index] ?? artists[0] ?? null;
}
