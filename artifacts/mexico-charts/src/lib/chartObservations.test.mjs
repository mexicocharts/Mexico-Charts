import test from 'node:test';
import assert from 'node:assert/strict';
import {observationValue,recentObservations,observationCoordinates} from './chartObservations.mjs';
test('preserves real zero, distinguishes null, and breaks date gaps',()=>{
  const points=[{date:'2026-09-12',dailyStreams:10},{date:'2026-09-13',dailyStreams:0},{date:'2026-09-14',dailyStreams:null},{date:'2026-09-18',dailyStreams:20},{date:'2026-09-19',dailyStreams:536191}];
  assert.equal(observationValue(points[1]),0);assert.equal(observationValue(points[2]),null);
  const coords=observationCoordinates(points,0,70);
  assert.equal(coords[1].x,10);assert.equal(coords[3].x,60);assert.equal(coords[3].startsSegment,true);
  assert.equal(coords[4].startsSegment,false);assert.equal(coords[4].value,536191);
  assert.deepEqual(recentObservations(points,4),points);
});
test('observation limit keeps intervening missing values rather than converting to days',()=>{
  const points=[{date:'2026-01-01',dailyViews:1},{date:'2026-01-02',dailyViews:2},{date:'2026-01-03',dailyViews:null},{date:'2026-01-06',dailyViews:0}];
  assert.deepEqual(recentObservations(points,2),points.slice(1));
});
