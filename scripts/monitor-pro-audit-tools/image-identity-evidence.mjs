/** Audit-only corroboration. Never mutates population, grants an identity, or
 * converts image evidence into catalog/history completeness. Writer rule pinned
 * to artist-image-resolver.ts at the frozen audit source revision. */
export const IMAGE_WRITER_SHA256 = '5937b97e228574daa47581b5720c22c1bf3be2cc661dd02372c725b60d35fbd3';
export function imageWriterKey(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/\by\b/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const names = candidate => [candidate.artistName, ...candidate.sourceKeys, ...(candidate.declaredAliases ?? [])];
const reference = value => value && typeof value.reference === 'string' && value.reference.length > 0
  && /^[a-f0-9]{64}$/.test(value.sha256 ?? '') && Number.isFinite(Date.parse(value.capturedAt));
export function corroborateImageIdentity({ candidate, population, imageRows, providerCapture, writerSha256 }) {
  const base = { originalArtistKey: candidate.artistKey, classification: null, automaticMerge: false,
    catalogEvidenceApplied: false, historyEvidenceApplied: false };
  const unresolved = reason => ({ ...base, status: 'unresolved', reason });
  if (writerSha256 !== IMAGE_WRITER_SHA256) return unresolved('unverified_writer_rule');
  if (!candidate.candidateSources.length || candidate.candidateSources.some(source => source !== 'artist_images')
      || candidate.identityMappingStatus !== 'unverified' || candidate.spotifyIds.length || candidate.identityConflict)
    return unresolved('not_an_unverified_image_only_candidate');
  if (!reference(providerCapture) || providerCapture.source !== 'deezer_artist_search' || providerCapture.httpStatus !== 200)
    return unresolved('unverified_provider_capture');
  const keys = new Set(candidate.sourceKeys);
  const rows = imageRows.filter(row => keys.has(row.artist_key) && reference(row));
  if (rows.length !== keys.size || new Set(rows.map(row => row.artist_key)).size !== keys.size)
    return unresolved('missing_or_duplicate_original_image_rows');
  const matches = providerCapture.artists.filter(artist => Number.isSafeInteger(artist.id) && artist.id > 0
    && typeof artist.name === 'string' && typeof artist.picture_xl === 'string'
    && artist.picture_xl.startsWith('https://cdn-images.dzcdn.net/images/artist/')
    && rows.every(row => row.image_url === artist.picture_xl && imageWriterKey(row.artist_key) === imageWriterKey(artist.name)));
  if (matches.length !== 1) return unresolved('provider_match_not_unique');
  const provider = matches[0];
  const targets = population.filter(target => target.artistKey !== candidate.artistKey
    && names(target).some(name => imageWriterKey(name) === imageWriterKey(provider.name)));
  if (targets.length > 1 || targets.some(target => target.identityConflict
      || !['provider_id', 'accepted_registry'].includes(target.identityMappingStatus)))
    return unresolved('target_identity_ambiguous');
  return { ...base, status: targets.length ? 'corroborated_existing_identity' : 'corroborated_external_image_identity',
    provider: { source: 'deezer', artistId: String(provider.id), artistName: provider.name },
    targetArtistKey: targets[0]?.artistKey ?? null,
    evidence: { writerSha256, providerReference: providerCapture.reference, providerSha256: providerCapture.sha256,
      imageRows: rows.map(row => ({ artistKey: row.artist_key, imageUrl: row.image_url,
        reference: row.reference, sha256: row.sha256, capturedAt: row.capturedAt })) },
    limitation: 'Corroborates image-cache identity only. Apply separately reviewed provider/catalog evidence through the audit; never change the original population or product authorization.' };
}
