import test from 'node:test';
import assert from 'node:assert/strict';
import {HERO_ROTATION_INTERVAL,rotationState,nextHeroIndex,rotationIntent,selectedHero} from './heroRotation.mjs';
const initial={paused:false,hovered:false},normal={reduced:false,campaign:false};
test('normal cycling wraps and keeps five-second period',()=>{
  assert.equal(HERO_ROTATION_INTERVAL,5000);assert.equal(nextHeroIndex(0,3,initial,normal),1);assert.equal(nextHeroIndex(2,3,initial,normal),0);
});
test('reduced motion and campaign cannot be overridden by Resume',()=>{
  const resumed=rotationState(rotationState(initial,'pause'),'resume');
  assert.equal(nextHeroIndex(0,3,resumed,{...normal,reduced:true}),null);
  assert.equal(nextHeroIndex(0,3,resumed,{...normal,campaign:true}),null);
});
test('zero/one artists never advance and invalid indexes safely recover after shrinking',()=>{
  assert.equal(nextHeroIndex(0,0,initial,normal),null);assert.equal(nextHeroIndex(0,1,initial,normal),null);assert.equal(nextHeroIndex(4,2,initial,normal),1);
});
test('hover alone pauses temporarily',()=>{
  const hovering=rotationState(initial,'enter');assert.equal(nextHeroIndex(0,3,hovering,normal),null);
  assert.equal(nextHeroIndex(0,3,rotationState(hovering,'leave'),normal),1);
});
for(const action of ['pause','focus','select']) test(`${action} persists after hover leaves until explicit Resume`,()=>{
  const paused=rotationState(rotationState(rotationState(initial,action),'enter'),'leave');
  assert.equal(nextHeroIndex(0,3,paused,normal),null);assert.equal(nextHeroIndex(0,3,rotationState(paused,'resume'),normal),1);
});
test('Resume during hover remains inhibited and new focus pauses again',()=>{
  const resumed=rotationState(rotationState(rotationState(initial,'focus'),'enter'),'resume');
  assert.equal(nextHeroIndex(0,3,resumed,normal),null);
  assert.equal(nextHeroIndex(0,3,rotationState(rotationState(resumed,'leave'),'focus'),normal),null);
});
test('pointer Pause intent survives focus changing label to Resume',()=>{
  const intent=rotationIntent(initial);const focused=rotationState(initial,'focus');
  assert.equal(rotationIntent(focused,intent),'pause');assert.equal(rotationIntent(focused),'resume');
});
test('focused destination survives roster reorder/removal; releasing lock uses current list',()=>{
  const a={name:'A',href:'/artist/a'},b={name:'B',href:'/artist/b'};
  assert.equal(selectedHero([b],0,a),a);assert.equal(selectedHero([],0,a),a);
  assert.equal(selectedHero([b],3),b);assert.equal(selectedHero([],0),null);
});
