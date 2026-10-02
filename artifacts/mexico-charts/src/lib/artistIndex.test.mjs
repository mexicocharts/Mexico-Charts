import test from 'node:test';
import assert from 'node:assert/strict';
import {artistIndexEntries,renderArtistIndex} from './artistIndex.mjs';
import {canonicalArtistCatalog,canonicalArtistHref} from './artistRoutes.mjs';

test('every canonical profile has one named anchor without filters, metadata or click state',()=>{
  const expected=canonicalArtistCatalog.map(a=>canonicalArtistHref(a.path));
  const actual=artistIndexEntries.map(a=>a.href);
  assert.equal(actual.length,expected.length);assert.equal(new Set(actual).size,actual.length);
  assert.deepEqual([...actual].sort(),[...expected].sort());
  assert(artistIndexEntries.every(a=>a.name.trim()));
  const html=renderArtistIndex();
  assert.equal((html.match(/<a /g)||[]).length,expected.length);
  assert(!html.includes('onclick'));assert(!html.includes(' hidden'));assert(html.includes('<summary'));
});
test('names are sorted for navigation without changing canonical paths',()=>{
  const names=artistIndexEntries.map(a=>a.name);
  assert.deepEqual(names,[...names].sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'})));
  for(const a of artistIndexEntries) assert.equal(canonicalArtistHref(a.href),a.href);
});
test('the same complete navigation is available with either language',()=>{
  const es=renderArtistIndex('es'),en=renderArtistIndex('en');
  assert(es.includes('Índice de artistas'));assert(en.includes('Artist index'));
  assert.deepEqual(es.match(/href="[^"]+"/g),en.match(/href="[^"]+"/g));
});
