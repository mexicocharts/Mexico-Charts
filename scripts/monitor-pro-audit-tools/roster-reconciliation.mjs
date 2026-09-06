import assert from 'node:assert/strict';
import { imageWriterKey } from './image-identity-evidence.mjs';

// A routing correspondence is audit scope, never a provider-identity merge or eligibility grant.
export function reconcileRoster({ roster, population, resolveRoute }) {
  assert(Array.isArray(roster) && roster.length > 0);
  assert(Array.isArray(population.candidates));
  const byRoute = new Map();
  for (const row of roster) {
    assert(row.canonicalRoute && Number.isSafeInteger(row.sourceRow));
    if (!byRoute.has(row.canonicalRoute)) byRoute.set(row.canonicalRoute, []);
    byRoute.get(row.canonicalRoute).push(row);
  }
  const groups = population.candidates.map((candidate, artistIndex) => {
    const matches = [];
    for (const field of ['artistKey', 'artistName', 'sourceKeys', 'matchKeys', 'declaredAliases']) {
      for (const value of [candidate[field]].flat().filter(value => typeof value === 'string' && value)) {
        const route = resolveRoute(value);
        if (route) matches.push({ field, value, route, approvedRoster: byRoute.has(route) });
      }
    }
    const routes = [...new Set(matches.map(match => match.route))];
    const approvedRoutes = routes.filter(route => byRoute.has(route));
    const imageOnly = candidate.candidateSources?.length === 1 && candidate.candidateSources[0] === 'artist_images';
    const imageAliasLeads = imageOnly && !approvedRoutes.length ? [...byRoute].filter(([, rows]) => rows.some(row =>
      [row.artistKey, row.artistName].some(name => [candidate.artistKey, candidate.artistName, ...(candidate.sourceKeys ?? [])]
        .some(key => typeof key === 'string' && imageWriterKey(key) === imageWriterKey(name)))))
      .map(([route]) => route) : [];
    return { artistIndex, candidate, matches, approvedRoutes, imageAliasLeads,
      status: imageAliasLeads.length ? 'unresolved_image_alias' : approvedRoutes.length === 0 ? 'outside_approved_roster' :
        routes.length !== 1 || candidate.identityConflict ? 'mapping_conflict' : 'roster_route_correspondence',
      providerIdentityMerged: false };
  });
  const artists = [...byRoute].map(([canonicalRoute, rosterRows]) => {
    const candidates = groups.filter(group => group.approvedRoutes.includes(canonicalRoute));
    const providerIds = [...new Set(candidates.flatMap(group => group.candidate.spotifyIds ?? []))];
    return { canonicalRoute, rosterRows, candidateIndices: candidates.map(group => group.artistIndex),
      providerIds, unresolvedImageAliasIndices: groups.filter(group => group.imageAliasLeads.includes(canonicalRoute)).map(group => group.artistIndex), mappingIssues: [
        ...(candidates.length ? [] : ['no_captured_candidate_route_correspondence']),
        ...(candidates.some(group => group.status === 'mapping_conflict') ? ['candidate_identity_or_route_conflict'] : []),
        ...(providerIds.length > 1 ? ['multiple_spotify_ids_under_route_require_review'] : []),
      ], classification: null, readinessStatus: 'not_evaluated',
      // Never union candidate keys into the evaluator: each original boundary is preserved.
      evaluateCandidateIndices: candidates.filter(group => group.status === 'roster_route_correspondence').map(group => group.artistIndex) };
  });
  const providerRoutes = new Map();
  for (const artist of artists) for (const id of artist.providerIds) {
    if (!providerRoutes.has(id)) providerRoutes.set(id, new Set());
    providerRoutes.get(id).add(artist.canonicalRoute);
  }
  const sharedProviderConflicts = [...providerRoutes].filter(([, routes]) => routes.size > 1)
    .map(([spotifyId, routes]) => ({ spotifyId, routes: [...routes] }));
  for (const artist of artists) {
    artist.sharedProviderConflicts = sharedProviderConflicts.filter(conflict => conflict.routes.includes(artist.canonicalRoute));
    if (artist.sharedProviderConflicts.length) artist.mappingIssues.push('provider_id_shared_across_roster_routes');
  }
  return { schemaVersion: 1, scope: 'approved_roster_only', providerIdentityMerged: false,
    rosterRows: roster.length, distinctRoutes: artists.length, auxiliaryCandidates: groups.length,
    duplicateRosterRoutes: artists.filter(artist => artist.rosterRows.length > 1).map(artist => ({ canonicalRoute: artist.canonicalRoute, rosterRows: artist.rosterRows })),
    artists, groups, sharedProviderConflicts, outsideCandidateIndices: groups.filter(group => group.status === 'outside_approved_roster').map(group => group.artistIndex),
    conflictingCandidateIndices: groups.filter(group => group.status === 'mapping_conflict').map(group => group.artistIndex) };
}
