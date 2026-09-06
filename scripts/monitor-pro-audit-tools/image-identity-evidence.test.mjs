import test from 'node:test';
import assert from 'node:assert/strict';
import { corroborateImageIdentity, imageWriterKey, IMAGE_WRITER_SHA256 } from './image-identity-evidence.mjs';
const proof = { reference: 'fixture:original', sha256: 'a'.repeat(64), capturedAt: '2026-09-06T17:00:00Z' };
function fixture() {
 const candidate = { artistKey: 'example and band', artistName: 'example and band', sourceKeys: ['example and band'],
  candidateSources: ['artist_images'], spotifyIds: [], identityMappingStatus: 'unverified', identityConflict: false };
 const target = { artistKey: 'exampleyband', artistName: 'Example y Band', sourceKeys: ['example y band'],
  spotifyIds: ['fixture-id'], identityMappingStatus: 'provider_id', identityConflict: false };
 const image = 'https://cdn-images.dzcdn.net/images/artist/example/1000.jpg';
 return { candidate, population: [candidate, target], writerSha256: IMAGE_WRITER_SHA256,
  imageRows: [{ ...proof, artist_key: candidate.artistKey, image_url: image }],
  providerCapture: { ...proof, source: 'deezer_artist_search', httpStatus: 200,
   artists: [{ id: 123, name: 'Example y Band', picture_xl: image }] } };
}
test('writer normalization, not general artist alias normalization', () => {
 assert.equal(imageWriterKey('Aarón y su Grupo Ilusión'), 'aaron and su grupo ilusion');
 assert.equal(imageWriterKey('a-ha'), 'a ha');
});
test('corroborates unique provider plus exact image and writer mapping; input immutable', () => {
 const input = fixture(), before = JSON.stringify(input), result = corroborateImageIdentity(input);
 assert.equal(result.status, 'corroborated_existing_identity'); assert.equal(result.targetArtistKey, 'exampleyband');
 assert.equal(JSON.stringify(input), before); assert.equal(result.classification, null); assert.equal(result.automaticMerge, false);
 assert.equal(result.catalogEvidenceApplied, false); assert.equal(result.historyEvidenceApplied, false);
});
test('external image identity does not invent Spotify identity or target', () => {
 const input = fixture(); input.population = [input.candidate]; const result = corroborateImageIdentity(input);
 assert.equal(result.status, 'corroborated_external_image_identity'); assert.equal(result.targetArtistKey, null);
 assert.equal(result.spotifyIds, undefined);
});
test('name similarity alone cannot corroborate', () => {
 const input = fixture(); input.providerCapture.artists[0].picture_xl += 'other';
 assert.equal(corroborateImageIdentity(input).status, 'unresolved');
});
test('shared image alone cannot corroborate', () => {
 const input = fixture(); input.providerCapture.artists[0].name = 'Unrelated';
 assert.equal(corroborateImageIdentity(input).status, 'unresolved');
});
test('colliding provider IDs and target groups remain unresolved', () => {
 for (const mode of ['provider', 'target']) {
  const input = fixture();
  if (mode === 'provider') input.providerCapture.artists.push({ ...input.providerCapture.artists[0], id: 124 });
  else input.population.push({ ...input.population[1], artistKey: 'different' });
  assert.equal(corroborateImageIdentity(input).status, 'unresolved');
 }
});
test('missing provenance, changed writer and missing source row reject', () => {
 for (const mutate of [x => x.providerCapture.sha256 = '', x => x.writerSha256 = '', x => x.imageRows = []]) {
  const input = fixture(); mutate(input); assert.equal(corroborateImageIdentity(input).status, 'unresolved');
 }
});
test('conflicting or non-image candidate cannot be reassigned', () => {
 for (const mutate of [x => x.candidate.identityConflict = true, x => x.candidate.candidateSources.push('spotify_artists'),
  x => x.population[1].identityConflict = true]) {
  const input = fixture(); mutate(input); assert.equal(corroborateImageIdentity(input).status, 'unresolved');
 }
});
