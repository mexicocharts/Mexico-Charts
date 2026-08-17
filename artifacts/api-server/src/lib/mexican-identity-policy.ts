export type IdentityEvidenceSource = "existing_verified_registry" | "musicbrainz" | "wikidata";

export interface IdentityEvidence {
  source: IdentityEvidenceSource;
  url: string;
  supportsMexico: boolean;
  exactName: boolean;
  sameIdentityConfirmed?: boolean;
  detail: string;
}

export type IdentityStatus = "verified" | "review" | "rejected";

export interface IdentityDecision {
  status: IdentityStatus;
  confidence: number;
  reason: string;
}

export function normalizeArtistIdentity(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function decideMexicanIdentity(evidence: IdentityEvidence[]): IdentityDecision {
  if (evidence.some(item => item.source === "existing_verified_registry" && item.exactName && item.supportsMexico)) {
    return { status: "verified", confidence: 100, reason: "Exact match in the existing verified registry" };
  }

  const corroborating = new Set(
    evidence
      .filter(item => item.exactName && item.supportsMexico && (item.source !== "wikidata" || item.sameIdentityConfirmed === true))
      .map(item => item.source),
  );
  if (corroborating.has("musicbrainz") && corroborating.has("wikidata")) {
    return { status: "verified", confidence: 95, reason: "Exact identity independently corroborated by MusicBrainz and Wikidata" };
  }
  if (corroborating.size === 1) {
    return { status: "review", confidence: 70, reason: "Mexico evidence found in only one independent source" };
  }
  return { status: "review", confidence: evidence.length ? 35 : 10, reason: "No independently corroborated Mexico identity" };
}
