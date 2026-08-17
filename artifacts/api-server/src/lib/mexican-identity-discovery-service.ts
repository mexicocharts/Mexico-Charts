import { pool } from "@workspace/db";
import { getOfficialChartArtistCredits, getVerifiedMexicanIdentityNorms } from "../routes/charts-hub";
import {
  decideMexicanIdentity,
  normalizeArtistIdentity,
  type IdentityEvidence,
} from "./mexican-identity-policy";

const USER_AGENT = "MexicoCharts/1.0 (https://mexicochart.com)";
const MEXICO_QID = "Q96";
let nextMusicBrainzRequestAt = 0;

type MusicBrainzArtist = {
  id?: string;
  name?: string;
  country?: string;
  area?: { name?: string; "iso-3166-1-codes"?: string[] };
  "begin-area"?: { name?: string; "iso-3166-1-codes"?: string[] };
  relations?: Array<{ type?: string; url?: { resource?: string } }>;
};

type WikidataEntity = {
  id?: string;
  label?: string;
  description?: string;
};

export interface MexicanIdentityDiscoverySummary {
  chartArtists: number;
  alreadyVerified: number;
  checked: number;
  verified: number;
  review: number;
}

export async function ensureMexicanIdentityTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mexican_artist_identity_candidates (
      id serial PRIMARY KEY,
      artist_name text NOT NULL,
      normalized_name text NOT NULL UNIQUE,
      aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
      evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
      confidence integer NOT NULL,
      status text NOT NULL DEFAULT 'review' CHECK (status IN ('verified', 'review', 'rejected')),
      discovery_date date NOT NULL DEFAULT CURRENT_DATE,
      verification_date date,
      last_checked_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS mexican_identity_status_idx ON mexican_artist_identity_candidates(status);
  `);
}

export async function loadVerifiedDiscoveredIdentityNorms(): Promise<Set<string>> {
  await ensureMexicanIdentityTables();
  const result = await pool.query<{ normalized_name: string; aliases: unknown }>(`
    SELECT normalized_name, aliases FROM mexican_artist_identity_candidates WHERE status = 'verified'
  `);
  const norms = new Set<string>();
  for (const row of result.rows) {
    norms.add(row.normalized_name);
    if (Array.isArray(row.aliases)) {
      for (const alias of row.aliases) if (typeof alias === "string") norms.add(normalizeArtistIdentity(alias));
    }
  }
  return norms;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function waitForMusicBrainzRateLimit(): Promise<void> {
  const waitMs = Math.max(0, nextMusicBrainzRequestAt - Date.now());
  if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
  nextMusicBrainzRequestAt = Date.now() + 1_100;
}

async function musicBrainzEvidence(name: string): Promise<{ evidence: IdentityEvidence; wikidataQid: string | null } | null> {
  const query = encodeURIComponent(`artist:\"${name.replace(/\"/g, "")}\"`);
  await waitForMusicBrainzRateLimit();
  const data = await fetchJson<{ artists?: MusicBrainzArtist[] }>(`https://musicbrainz.org/ws/2/artist/?query=${query}&fmt=json&limit=5`);
  const match = data.artists?.find(artist => normalizeArtistIdentity(artist.name ?? "") === normalizeArtistIdentity(name));
  if (!match?.id) return null;
  await waitForMusicBrainzRateLimit();
  const detail = await fetchJson<MusicBrainzArtist>(`https://musicbrainz.org/ws/2/artist/${match.id}?inc=url-rels&fmt=json`);
  const codes = [detail.country ?? match.country, ...(detail.area?.["iso-3166-1-codes"] ?? match.area?.["iso-3166-1-codes"] ?? []), ...(detail["begin-area"]?.["iso-3166-1-codes"] ?? match["begin-area"]?.["iso-3166-1-codes"] ?? [])];
  const supportsMexico = codes.includes("MX") || detail.area?.name === "Mexico" || detail["begin-area"]?.name === "Mexico";
  const wikidataUrl = detail.relations?.find(relation => relation.type === "wikidata")?.url?.resource ?? "";
  const wikidataQid = wikidataUrl.match(/\/wiki\/(Q\d+)$/)?.[1] ?? null;
  return {
    evidence: {
      source: "musicbrainz", url: `https://musicbrainz.org/artist/${match.id}`, supportsMexico,
      exactName: true, detail: supportsMexico ? "MusicBrainz country/area is Mexico" : "Exact MusicBrainz identity without Mexico country/area",
    },
    wikidataQid,
  };
}

function claimEntityIds(entity: Record<string, unknown>, property: string): string[] {
  const claims = (entity["claims"] as Record<string, unknown[]> | undefined)?.[property] ?? [];
  return claims.flatMap(claim => {
    const value = (((claim as Record<string, unknown>)["mainsnak"] as Record<string, unknown> | undefined)?.["datavalue"] as Record<string, unknown> | undefined)?.["value"];
    const id = value && typeof value === "object" ? (value as Record<string, unknown>)["id"] : null;
    return typeof id === "string" ? [id] : [];
  });
}

async function wikidataEvidence(name: string, linkedQid: string | null): Promise<IdentityEvidence | null> {
  let qid = linkedQid;
  if (!qid) {
    const search = await fetchJson<{ search?: WikidataEntity[] }>(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&format=json&limit=5&origin=*`);
    qid = search.search?.find(entity => normalizeArtistIdentity(entity.label ?? "") === normalizeArtistIdentity(name))?.id ?? null;
  }
  if (!qid) return null;
  const document = await fetchJson<{ entities?: Record<string, Record<string, unknown>> }>(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  const entity = document.entities?.[qid];
  if (!entity) return null;
  const supportsMexico = [...claimEntityIds(entity, "P27"), ...claimEntityIds(entity, "P495")].includes(MEXICO_QID);
  return {
    source: "wikidata", url: `https://www.wikidata.org/wiki/${qid}`, supportsMexico,
    exactName: true, sameIdentityConfirmed: linkedQid === qid, detail: supportsMexico
      ? `Wikidata citizenship/country of origin is Mexico${linkedQid ? "; entity linked by MusicBrainz" : ""}`
      : "Exact Wikidata identity without a Mexico citizenship/origin claim",
  };
}

async function upsertCandidate(name: string, evidence: IdentityEvidence[]): Promise<"verified" | "review" | "rejected"> {
  const decision = decideMexicanIdentity(evidence);
  await pool.query(`
    INSERT INTO mexican_artist_identity_candidates (
      artist_name, normalized_name, evidence, confidence, status, verification_date, last_checked_at, updated_at
    ) VALUES ($1,$2,$3::jsonb,$4,$5,CASE WHEN $5 = 'verified' THEN CURRENT_DATE ELSE NULL END,now(),now())
    ON CONFLICT (normalized_name) DO UPDATE SET
      artist_name = excluded.artist_name,
      evidence = excluded.evidence,
      confidence = excluded.confidence,
      status = CASE WHEN mexican_artist_identity_candidates.status = 'rejected' THEN 'rejected' ELSE excluded.status END,
      verification_date = CASE
        WHEN mexican_artist_identity_candidates.status = 'rejected' THEN mexican_artist_identity_candidates.verification_date
        WHEN excluded.status = 'verified' THEN COALESCE(mexican_artist_identity_candidates.verification_date, CURRENT_DATE)
        ELSE mexican_artist_identity_candidates.verification_date
      END,
      last_checked_at = now(), updated_at = now()
  `, [name, normalizeArtistIdentity(name), JSON.stringify({ sources: evidence, reason: decision.reason }), decision.confidence, decision.status]);
  return decision.status;
}

export async function runMexicanIdentityDiscovery(limit = 40): Promise<MexicanIdentityDiscoverySummary> {
  await ensureMexicanIdentityTables();
  const credits = await getOfficialChartArtistCredits();
  const verifiedNorms = await getVerifiedMexicanIdentityNorms();
  const prior = await pool.query<{ normalized_name: string }>(`
    SELECT normalized_name
    FROM mexican_artist_identity_candidates
    WHERE status IN ('verified', 'rejected')
       OR last_checked_at >= now() - interval '7 days'
  `);
  const recentlyOrFinallyChecked = new Set(prior.rows.map(row => row.normalized_name));
  const pending = credits.filter(name => {
    const norm = normalizeArtistIdentity(name);
    return norm && !verifiedNorms.has(norm) && !recentlyOrFinallyChecked.has(norm);
  }).slice(0, Math.max(0, limit));
  let verified = 0;
  let review = 0;
  for (const name of pending) {
    const evidence: IdentityEvidence[] = [];
    const mb = await musicBrainzEvidence(name).catch(() => null);
    const wd = await wikidataEvidence(name, mb?.wikidataQid ?? null).catch(() => null);
    if (mb) evidence.push(mb.evidence);
    if (wd) evidence.push(wd);
    const status = await upsertCandidate(name, evidence);
    status === "verified" ? verified += 1 : review += 1;
  }
  const alreadyVerified = credits.filter(name => verifiedNorms.has(normalizeArtistIdentity(name))).length;
  return { chartArtists: credits.length, alreadyVerified, checked: pending.length, verified, review };
}
