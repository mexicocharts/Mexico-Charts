import test from 'node:test';
import assert from 'node:assert/strict';
import { monitorVideoPage } from './monitorVideoPage.mjs';

test('all 16,273 observed records remain reachable in unchanged order', () => {
  const videos = Array.from({length: 16273}, (_, id) => ({id, views: id * 7}));
  const first = monitorVideoPage(videos, 0);
  assert.equal(first.items.length, 60);
  assert.equal(first.pageCount, 272);
  const reconstructed = Array.from({length: first.pageCount}, (_, page) => {
    const result = monitorVideoPage(videos, page);
    assert.ok(result.items.length <= 60);
    assert.equal(result.total, videos.length);
    return result.items;
  }).flat();
  assert.deepEqual(reconstructed, videos);
  assert.equal(monitorVideoPage(videos, 271).items.length, 13);
  assert.equal(videos.length, 16273);
});
test('smaller, empty and changed collections clamp page without dropping items', () => {
  assert.deepEqual(monitorVideoPage([], 99).items, []);
  for (const requested of [-1, NaN, Infinity, 99]) {
    const result = monitorVideoPage(['a', 'b'], requested);
    assert.equal(result.page, 0);
    assert.deepEqual(result.items, ['a', 'b']);
  }
});
