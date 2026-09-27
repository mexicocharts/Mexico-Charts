import { createHash } from "node:crypto";
import type { MonitoringCandidateIdentity } from "./monitoring-candidate-policy";
import { isSongstatsArtistExcluded } from "./songstats-artist-exclusions";

/** Owner-approved reference set recovered on 2026-09-27. Never use the current
 * month or a LIMIT to define membership. This is inspection scope, not paid
 * product eligibility and not a change to any provider's billing accounting. */
export const FOUNDER_ROSTER_MONTH = "2026-09";
export const FOUNDER_ROSTER_SHA256 = "f00bf6ab415601449fcc0a593f35ecabb1944e1b2e81801a3c2c75da1200f920";
export const FOUNDER_ROSTER_SQL = `SELECT identifier_value AS spotify_id
  FROM songstats_monthly_artist_usage
  WHERE billing_month = $1 AND identifier_type = 'spotify_artist_id'
  ORDER BY identifier_value`;

export function verifiedFounderRosterIds(rows: Array<{ spotify_id: string }>): Set<string> {
  const ids = rows.map(row => row.spotify_id).sort();
  const hash = createHash("sha256").update(ids.join("\n") + "\n").digest("hex");
  if (ids.length !== 529 || new Set(ids).size !== 529 || hash !== FOUNDER_ROSTER_SHA256) {
    throw new Error("Founder reference roster unavailable or changed; refusing broad inventory fallback");
  }
  return new Set(ids.filter(spotifyArtistId => !isSongstatsArtistExcluded({ spotifyArtistId })));
}

export function filterFounderRoster(population: MonitoringCandidateIdentity[], allowed: ReadonlySet<string>) {
  const artists = population.filter(artist =>
    artist.spotifyIds.some(id => allowed.has(id)) &&
    !artist.spotifyIds.some(spotifyArtistId => isSongstatsArtistExcluded({ spotifyArtistId })));
  const represented = new Set(artists.flatMap(artist => artist.spotifyIds.filter(id => allowed.has(id))));
  if (represented.size !== allowed.size) {
    throw new Error("Founder roster identity mapping incomplete; refusing a silently partial directory");
  }
  return artists;
}

export const FOUNDER_ROSTER_SCOPE = Object.freeze({
  referenceMonth: FOUNDER_ROSTER_MONTH,
  referenceFingerprint: FOUNDER_ROSTER_SHA256,
  historicalLedgerIds: 529,
  excludedIds: 1,
  includedSpotifyIds: 528,
  referenceSongstatsIdentities: 527,
  membershipGrantsEligibility: false,
  identityReviewPending: true,
});
