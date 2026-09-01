import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";
import { ensureArtistDiscoveryTables } from "./artist-discovery-create-tables";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

type PoolLike = InstanceType<typeof Pool>;

interface CandidateRow {
  id: number;
  artist_name: string;
  normalized_name: string;
  status: string;
}

interface WikidataSearchResult {
  id: string;
  label?: string;
  description?: string;
  aliases?: string[];
}

interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, Array<{ value: string }>>;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>>;
}

interface MusicBrainzArtist {
  id: string;
  name?: string;
  type?: string;
  country?: string;
  area?: { name?: string };
  "begin-area"?: { name?: string };
  aliases?: Array<{ name?: string }>;
  disambiguation?: string;
}

const PRESERVED_STATUSES = new Set(["approved", "rejected", "linked_existing_artist", "not_mexican"]);

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 150), 500)),
    write: args.get("write") === "true",
    wikidata: args.get("wikidata") !== "false",
    musicbrainz: args.get("musicbrainz") !== "false",
  };
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(e|y)\b/gi, " and ")
    .replace(/\b(con|feat|ft|featuring|colabora(?:ndo)?\s+con|junto\s+a)\b/gi, " ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactName(value: string | null | undefined): string {
  return normalizeName(value).replace(/[^a-z0-9]/g, "");
}

function similarity(left: string, right: string) {
  const a = new Set(normalizeName(left).split(" ").filter(Boolean));
  const b = new Set(normalizeName(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const common = [...a].filter(token => b.has(token)).length;
  return common / Math.max(a.size, b.size);
}

function isGoodNameMatch(candidateName: string, sourceName: string | undefined) {
  if (!sourceName) return false;
  const candidate = compactName(candidateName);
  const source = compactName(sourceName);
  return candidate === source || candidate.includes(source) || source.includes(candidate) || similarity(candidateName, sourceName) >= 0.65;
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, {
    headers: { "User-Agent": "MexicoChartsDiscovery/1.1 (admin review)" },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
  return resp.json() as Promise<T>;
}

async function fetchWikidataLabels(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (!unique.length) return new Map<string, string>();
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("props", "labels");
  url.searchParams.set("languages", "es|en");
  url.searchParams.set("ids", unique.join("|"));
  const json = await fetchJson<{ entities?: Record<string, { labels?: Record<string, { value: string }> }> }>(url.toString());
  const labels = new Map<string, string>();
  for (const [id, entity] of Object.entries(json.entities ?? {})) {
    labels.set(id, entity.labels?.["es"]?.value ?? entity.labels?.["en"]?.value ?? id);
  }
  return labels;
}

function claimIds(entity: WikidataEntity, property: string) {
  return (entity.claims?.[property] ?? [])
    .map(claim => claim.mainsnak?.datavalue?.value?.id)
    .filter((id): id is string => Boolean(id));
}

async function wikidataSignals(candidate: CandidateRow) {
  const searchUrl = new URL("https://www.wikidata.org/w/api.php");
  searchUrl.searchParams.set("action", "wbsearchentities");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("language", "es");
  searchUrl.searchParams.set("uselang", "es");
  searchUrl.searchParams.set("type", "item");
  searchUrl.searchParams.set("limit", "5");
  searchUrl.searchParams.set("search", candidate.artist_name);
  const search = await fetchJson<{ search?: WikidataSearchResult[] }>(searchUrl.toString());
  const best = (search.search ?? []).find(item => isGoodNameMatch(candidate.artist_name, item.label));
  if (!best) return [];

  const entityUrl = new URL("https://www.wikidata.org/wiki/Special:EntityData/" + encodeURIComponent(best.id) + ".json");
  const entityJson = await fetchJson<{ entities?: Record<string, WikidataEntity> }>(entityUrl.toString());
  const entity = entityJson.entities?.[best.id];
  if (!entity) return [];

  const countryIds = claimIds(entity, "P27");
  const birthPlaceIds = claimIds(entity, "P19");
  const originIds = claimIds(entity, "P495");
  const labelMap = await fetchWikidataLabels([...countryIds, ...birthPlaceIds, ...originIds]);
  const aliases = [
    ...(best.aliases ?? []),
    ...(entity.aliases?.["es"] ?? []).map(alias => alias.value),
    ...(entity.aliases?.["en"] ?? []).map(alias => alias.value),
  ];

  return [
    { signalType: "external_id", source: "wikidata", value: best.id, confidenceWeight: 15 },
    ...countryIds.map(id => ({ signalType: "country_of_citizenship", source: "wikidata", value: labelMap.get(id) ?? id, confidenceWeight: labelMap.get(id)?.toLowerCase().includes("mex") ? 45 : 20 })),
    ...birthPlaceIds.map(id => ({ signalType: "place_of_birth", source: "wikidata", value: labelMap.get(id) ?? id, confidenceWeight: labelMap.get(id)?.toLowerCase().includes("mex") ? 35 : 12 })),
    ...originIds.map(id => ({ signalType: "country_of_origin", source: "wikidata", value: labelMap.get(id) ?? id, confidenceWeight: labelMap.get(id)?.toLowerCase().includes("mex") ? 35 : 12 })),
    ...aliases.filter(alias => isGoodNameMatch(candidate.artist_name, alias)).slice(0, 8).map(alias => ({ signalType: "alias", source: "wikidata", value: alias, confidenceWeight: 5 })),
  ];
}

async function musicBrainzSignals(candidate: CandidateRow) {
  const url = new URL("https://musicbrainz.org/ws/2/artist");
  url.searchParams.set("query", `artist:"${candidate.artist_name.replace(/"/g, "")}"`);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "5");
  const json = await fetchJson<{ artists?: MusicBrainzArtist[] }>(url.toString());
  const best = (json.artists ?? []).find(artist => isGoodNameMatch(candidate.artist_name, artist.name));
  if (!best) return [];
  const aliases = (best.aliases ?? []).map(alias => alias.name).filter((name): name is string => Boolean(name));
  return [
    { signalType: "external_id", source: "musicbrainz", value: best.id, confidenceWeight: 15 },
    ...(best.country ? [{ signalType: "country_of_origin", source: "musicbrainz", value: best.country, confidenceWeight: best.country === "MX" ? 40 : 12 }] : []),
    ...(best.area?.name ? [{ signalType: "musicbrainz_area", source: "musicbrainz", value: best.area.name, confidenceWeight: best.area.name.toLowerCase().includes("mex") ? 35 : 12 }] : []),
    ...(best["begin-area"]?.name ? [{ signalType: "musicbrainz_begin_area", source: "musicbrainz", value: best["begin-area"].name, confidenceWeight: best["begin-area"].name.toLowerCase().includes("mex") ? 35 : 12 }] : []),
    ...aliases.filter(alias => isGoodNameMatch(candidate.artist_name, alias)).slice(0, 8).map(alias => ({ signalType: "alias", source: "musicbrainz", value: alias, confidenceWeight: 5 })),
  ];
}

async function saveSignal(
  pool: PoolLike,
  candidateId: number,
  signal: { signalType: string; source: string; value: string; confidenceWeight: number },
) {
  await pool.query(
    `
      INSERT INTO artist_candidate_signals (
        candidate_id,
        signal_type,
        source,
        value,
        confidence_weight
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (candidate_id, signal_type, source, value)
      DO UPDATE SET confidence_weight = EXCLUDED.confidence_weight;
    `,
    [candidateId, signal.signalType, signal.source, signal.value, signal.confidenceWeight],
  );
}

async function recalculateCandidate(pool: PoolLike, candidateId: number) {
  const result = await pool.query<{
    total_appearances: string;
    source_count: string;
    first_seen_date: string | null;
    last_seen_date: string | null;
    signal_weight: string;
    mexican_signal_count: string;
    identity_signal_count: string;
  }>(
    `
      WITH event_stats AS (
        SELECT
          candidate_id,
          COUNT(id)::integer AS total_appearances,
          COUNT(DISTINCT source)::integer AS source_count,
          MIN(chart_date) AS first_seen_date,
          MAX(chart_date) AS last_seen_date
        FROM artist_candidate_events
        WHERE candidate_id = $1
        GROUP BY candidate_id
      ),
      signal_stats AS (
        SELECT
          candidate_id,
          COALESCE(SUM(confidence_weight), 0)::integer AS signal_weight,
          COUNT(*) FILTER (
            WHERE signal_type IN (
              'country_of_citizenship',
              'country_of_origin',
              'place_of_birth',
              'musicbrainz_area',
              'musicbrainz_begin_area'
            )
            AND confidence_weight >= 25
          )::integer AS mexican_signal_count,
          COUNT(*) FILTER (
            WHERE signal_type IN ('external_id', 'alias')
            AND confidence_weight > 0
          )::integer AS identity_signal_count
        FROM artist_candidate_signals
        WHERE candidate_id = $1
        GROUP BY candidate_id
      )
      SELECT
        COALESCE(e.total_appearances, 0)::text AS total_appearances,
        COALESCE(e.source_count, 0)::text AS source_count,
        e.first_seen_date,
        e.last_seen_date,
        COALESCE(s.signal_weight, 0)::text AS signal_weight,
        COALESCE(s.mexican_signal_count, 0)::text AS mexican_signal_count,
        COALESCE(s.identity_signal_count, 0)::text AS identity_signal_count
      FROM artist_candidates c
      LEFT JOIN event_stats e ON e.candidate_id = c.id
      LEFT JOIN signal_stats s ON s.candidate_id = c.id
      WHERE c.id = $1;
    `,
    [candidateId],
  );
  const stats = result.rows[0];
  if (!stats) return;

  const totalAppearances = Number(stats.total_appearances);
  const sourceCount = Number(stats.source_count);
  const signalWeight = Number(stats.signal_weight);
  const identitySignals = Number(stats.identity_signal_count);
  const mexicanSignals = Number(stats.mexican_signal_count);
  const confidenceScore = Math.min(100, signalWeight + Math.min(totalAppearances, 20) * 2 + sourceCount * 10 + Math.min(identitySignals, 4) * 3);
  const nextStatus = mexicanSignals > 0 && confidenceScore >= 55
    ? "likely_mexican"
    : confidenceScore >= 25
      ? "needs_review"
      : "pending";

  await pool.query(
    `
      UPDATE artist_candidates
      SET first_seen_date = $2,
          last_seen_date = $3,
          total_appearances = $4,
          source_count = $5,
          confidence_score = $6,
          status = CASE
            WHEN status = ANY($8::text[]) THEN status
            ELSE $7
          END,
          updated_at = now()
      WHERE id = $1;
    `,
    [
      candidateId,
      stats.first_seen_date,
      stats.last_seen_date,
      totalAppearances,
      sourceCount,
      confidenceScore,
      nextStatus,
      [...PRESERVED_STATUSES],
    ],
  );
}

export async function runArtistDiscoveryReverify(options = parseArgs()) {
  const databaseUrl = resolveDatabaseUrl();
  const pool = new Pool({ connectionString: databaseUrl });
  let scanned = 0;
  let signals = 0;
  let errors = 0;
  try {
    await ensureArtistDiscoveryTables(pool);
    const candidates = await pool.query<CandidateRow>(
      `
        SELECT id, artist_name, normalized_name, status
        FROM artist_candidates
        WHERE status IN ('pending', 'needs_review')
        ORDER BY confidence_score DESC, total_appearances DESC, source_count DESC, artist_name ASC
        LIMIT $1;
      `,
      [options.limit],
    );

    for (const candidate of candidates.rows) {
      scanned += 1;
      try {
        const found = [
          ...(options.wikidata ? await wikidataSignals(candidate) : []),
          ...(options.musicbrainz ? await musicBrainzSignals(candidate) : []),
        ];
        if (options.write) {
          for (const signal of found) {
            await saveSignal(pool, candidate.id, signal);
            signals += 1;
          }
          await recalculateCandidate(pool, candidate.id);
        } else signals += found.length;
        console.log(`${options.write ? "VERIFY" : "DRY_VERIFY"},${candidate.id},${candidate.artist_name},signals=${found.length}`);
      } catch (err) {
        errors += 1;
        console.warn(`VERIFY_ERROR,${candidate.id},${candidate.artist_name},${String(err).slice(0, 180)}`);
      }
      await new Promise(resolve => setTimeout(resolve, 350));
    }
    console.log(`Artist discovery reverify ${options.write ? "wrote" : "dry-run"} scanned=${scanned} signals=${signals} errors=${errors}`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runArtistDiscoveryReverify().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export {};
