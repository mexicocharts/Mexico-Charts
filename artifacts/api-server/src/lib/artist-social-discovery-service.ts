import { canonicalizeSocialUrl, mergeSocialEvidence, type SocialEvidence } from "./artist-social-discovery-policy";
import verifiedSocialAccountsCsv from "../../../../scripts/data/verified-artist-social-accounts.csv";

type LinkRecord = { type?: unknown; source?: unknown; url?: unknown };
type ArtistRow = {
  artist_key: string;
  spotify_artist_id: string | null;
  spotify_url: string | null;
  youtube_channel_id: string | null;
  youtube_custom_url: string | null;
  artist_info: Record<string, unknown> | null;
  relations: LinkRecord[] | null;
};

export interface ArtistSocialDiscoverySummary {
  artists: number;
  candidates: number;
  verified: number;
  review: number;
  chartingArtists: number;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

export async function seedVerifiedArtistSocialAccounts(): Promise<number> {
  const { pool } = await import("@workspace/db");
  await ensureArtistSocialDiscoveryTable();
  const lines = verifiedSocialAccountsCsv.trim().split(/\r?\n/);
  const columns = parseCsvLine(lines.shift() ?? "");
  const rows = lines
    .map(line => {
      const values = parseCsvLine(line);
      return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? ""]));
    })
    .filter(row => row["status"] === "verified" && Number(row["confidence"]) >= 90)
    .map(row => ({
      artistKey: row["artist_key"],
      platform: row["platform"],
      canonicalUrl: row["canonical_url"],
      evidenceSources: String(row["evidence_sources"] ?? "").split("+").filter(Boolean),
      confidence: Number(row["confidence"]),
      discoveredAt: row["discovery_date"],
      verifiedAt: row["verification_date"] || row["discovery_date"],
    }));
  await pool.query(`
    INSERT INTO artist_social_account_candidates (
      artist_key, platform, canonical_url, evidence_sources, confidence, status,
      discovered_at, verified_at, last_checked_at, created_at, updated_at
    )
    SELECT artist_key, platform, canonical_url, evidence_sources, confidence, 'verified',
      discovered_at::date, verified_at::date, now(), now(), now()
    FROM jsonb_to_recordset($1::jsonb) AS seed(
      artist_key text, platform text, canonical_url text, evidence_sources jsonb,
      confidence integer, discovered_at text, verified_at text
    )
    ON CONFLICT (artist_key, platform, canonical_url) DO UPDATE SET
      evidence_sources = excluded.evidence_sources,
      confidence = excluded.confidence,
      status = CASE WHEN artist_social_account_candidates.status = 'rejected' THEN 'rejected' ELSE 'verified' END,
      verified_at = CASE WHEN artist_social_account_candidates.status = 'rejected' THEN artist_social_account_candidates.verified_at ELSE excluded.verified_at END,
      last_checked_at = now(), updated_at = now()
  `, [JSON.stringify(rows.map(row => ({
    artist_key: row.artistKey,
    platform: row.platform,
    canonical_url: row.canonicalUrl,
    evidence_sources: row.evidenceSources,
    confidence: row.confidence,
    discovered_at: row.discoveredAt,
    verified_at: row.verifiedAt,
  })))]);
  return rows.length;
}

function linksFrom(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const links = (value as Record<string, unknown>)["links"];
  if (!Array.isArray(links)) return [];
  return links.flatMap(link => {
    if (typeof link === "string") return [link];
    if (!link || typeof link !== "object") return [];
    const url = (link as LinkRecord).url;
    return typeof url === "string" ? [url] : [];
  });
}

export function evidenceForArtist(row: ArtistRow): SocialEvidence[] {
  const evidence: SocialEvidence[] = [];
  const add = (raw: string | null | undefined, source: SocialEvidence["source"], exactProviderMapping = false) => {
    if (!raw) return;
    const parsed = canonicalizeSocialUrl(raw);
    if (parsed) evidence.push({ ...parsed, source, exactProviderMapping });
  };
  if (row.spotify_artist_id) {
    add(row.spotify_url ?? `https://open.spotify.com/artist/${row.spotify_artist_id}`, "spotify_verified_mapping", true);
  }
  if (row.youtube_channel_id) {
    add(`https://youtube.com/channel/${row.youtube_channel_id}`, "youtube_verified_channel", true);
    add(row.youtube_custom_url?.startsWith("http") ? row.youtube_custom_url : row.youtube_custom_url ? `https://youtube.com/${row.youtube_custom_url}` : null, "youtube_verified_channel", true);
  }
  for (const url of linksFrom(row.artist_info)) add(url, "songstats_artist_info");
  for (const relation of row.relations ?? []) add(typeof relation.url === "string" ? relation.url : null, "musicbrainz_url_relation");
  return evidence;
}

export async function ensureArtistSocialDiscoveryTable(): Promise<void> {
  const { pool } = await import("@workspace/db");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_social_account_candidates (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      platform text NOT NULL,
      canonical_url text NOT NULL,
      evidence_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
      confidence integer NOT NULL,
      status text NOT NULL DEFAULT 'review' CHECK (status IN ('verified', 'review', 'rejected')),
      discovered_at timestamptz NOT NULL DEFAULT now(),
      verified_at timestamptz,
      last_checked_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (artist_key, platform, canonical_url)
    );
    CREATE INDEX IF NOT EXISTS artist_social_candidates_status_idx ON artist_social_account_candidates(status);
    CREATE INDEX IF NOT EXISTS artist_social_candidates_artist_idx ON artist_social_account_candidates(artist_key);
  `);
}

export async function runArtistSocialDiscovery(): Promise<ArtistSocialDiscoverySummary> {
  const { pool } = await import("@workspace/db");
  await ensureArtistSocialDiscoveryTable();
  // Generic Facebook shells are not artist accounts. Preserve the audit row,
  // but make the editorial decision explicit and permanent.
  await pool.query(`
    UPDATE artist_social_account_candidates
    SET status='rejected', confidence=0, verified_at=NULL,
      last_checked_at=now(), updated_at=now()
    WHERE platform='facebook'
      AND canonical_url ~* 'facebook\\.com/(profile\\.php|share|watch|groups)(/|\\?|$)'
  `);
  const result = await pool.query<ArtistRow>(`
    SELECT c.artist_key,
      COALESCE(s.spotify_artist_id, c.spotify_id) AS spotify_artist_id,
      s.spotify_url,
      y.channel_id AS youtube_channel_id,
      y.custom_url AS youtube_custom_url,
      se.artist_info,
      mb.relations
    FROM kworb_coverage c
    LEFT JOIN spotify_artists s ON regexp_replace(lower(s.artist_key), '[^a-z0-9]', '', 'g') = c.artist_key
    LEFT JOIN youtube_channels y ON regexp_replace(lower(y.artist_key), '[^a-z0-9]', '', 'g') = c.artist_key
    LEFT JOIN songstats_artist_extended_data se ON regexp_replace(lower(se.artist_key), '[^a-z0-9]', '', 'g') = c.artist_key
    LEFT JOIN musicbrainz_artists mb ON regexp_replace(lower(mb.artist_key), '[^a-z0-9]', '', 'g') = c.artist_key
    WHERE c.status = 'active'
    ORDER BY c.artist_key
  `);
  const { getCurrentMexicanChartArtists } = await import("../routes/charts-hub");
  const chartingKeys = new Set((await getCurrentMexicanChartArtists()).map(artist => artist.artistKey));
  result.rows.sort((a, b) => Number(chartingKeys.has(b.artist_key)) - Number(chartingKeys.has(a.artist_key)) || a.artist_key.localeCompare(b.artist_key));
  let candidates = 0;
  let verified = 0;
  let review = 0;
  for (const artist of result.rows) {
    for (const candidate of mergeSocialEvidence(evidenceForArtist(artist))) {
      candidates += 1;
      candidate.status === "verified" ? verified += 1 : review += 1;
      await pool.query(`
        INSERT INTO artist_social_account_candidates (
          artist_key, platform, canonical_url, evidence_sources, confidence, status,
          discovered_at, verified_at, last_checked_at, updated_at
        ) VALUES ($1,$2,$3,$4::jsonb,$5,$6,now(),CASE WHEN $6 = 'verified' THEN now() ELSE NULL END,now(),now())
        ON CONFLICT (artist_key, platform, canonical_url) DO UPDATE SET
          evidence_sources = excluded.evidence_sources,
          confidence = excluded.confidence,
          status = CASE
            WHEN artist_social_account_candidates.status = 'rejected' THEN 'rejected'
            ELSE excluded.status
          END,
          verified_at = CASE
            WHEN artist_social_account_candidates.status = 'rejected' THEN artist_social_account_candidates.verified_at
            WHEN excluded.status = 'verified' THEN COALESCE(artist_social_account_candidates.verified_at, now())
            ELSE NULL
          END,
          last_checked_at = now(), updated_at = now()
      `, [artist.artist_key, candidate.platform, candidate.canonicalUrl, JSON.stringify(candidate.evidenceSources), candidate.confidence, candidate.status]);
    }
  }
  return { artists: result.rows.length, candidates, verified, review, chartingArtists: result.rows.filter(row => chartingKeys.has(row.artist_key)).length };
}
