import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

interface ArtistRow {
  artist_key: string;
  artist_name: string;
  source_country?: string;
}

interface MusicBrainzArtist {
  id: string;
  name: string;
  "sort-name"?: string;
  disambiguation?: string;
  type?: string;
  country?: string;
  area?: { name?: string };
  "life-span"?: { begin?: string; end?: string };
  aliases?: Array<{ name?: string; "sort-name"?: string; primary?: boolean }>;
  tags?: Array<{ name?: string; count?: number }>;
  relations?: Array<{ type?: string; url?: { resource?: string } }>;
  score?: number;
}

interface MusicBrainzSearchResponse {
  artists?: MusicBrainzArtist[];
}

const ARTIST_METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";
const MB_BASE = "https://musicbrainz.org/ws/2";
const USER_AGENT = "MexicoCharts/1.0 (https://mexicochart.com)";
let lastMusicBrainzRequestAt = 0;

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 25), 200)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    minAutoScore: Math.max(0, Math.min(Number(args.get("minAutoScore") ?? 85), 100)),
    write: args.get("write") === "true",
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") quoted = false;
      else field += char;
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  row.push(field);
  rows.push(row);
  return rows.filter(r => r.some(cell => cell.trim()));
}

function rowsToObjects(rows: string[][]): ArtistRow[] {
  const [headers = [], ...body] = rows;
  return body.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = row[index]?.trim() ?? "";
    });
    return obj as unknown as ArtistRow;
  }).filter(row => row.artist_key && row.artist_name);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function politeSlot() {
  const now = Date.now();
  const waitMs = Math.max(0, 1100 - (now - lastMusicBrainzRequestAt));
  if (waitMs > 0) await sleep(waitMs);
  lastMusicBrainzRequestAt = Date.now();
}

async function mbFetch<T>(path: string, params: Record<string, string>, attempt = 0): Promise<T> {
  await politeSlot();
  const qs = new URLSearchParams({ ...params, fmt: "json" });
  const res = await fetch(`${MB_BASE}${path}?${qs.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (res.status === 503 && attempt < 3) {
    const waitMs = 5_000 * (attempt + 1);
    console.error(`MUSICBRAINZ_THROTTLED,wait_ms=${waitMs}`);
    await sleep(waitMs);
    return mbFetch<T>(path, params, attempt + 1);
  }

  if (!res.ok) throw new Error(`MusicBrainz ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function compactName(value: string): string {
  return normalizeName(value).replace(/\s+/g, "");
}

function scoreCandidate(artist: ArtistRow, candidate: MusicBrainzArtist) {
  const artistName = normalizeName(artist.artist_name);
  const candidateName = normalizeName(candidate.name);
  const aliases = (candidate.aliases ?? [])
    .map(alias => alias.name)
    .filter((name): name is string => Boolean(name));
  const normalizedAliases = aliases.map(normalizeName);
  const reasons: string[] = [];
  let score = 0;

  if (candidateName === artistName) {
    score += 55;
    reasons.push("name exact");
  } else if (compactName(candidate.name) === compactName(artist.artist_name)) {
    score += 48;
    reasons.push("compact name match");
  } else if (normalizedAliases.includes(artistName)) {
    score += 45;
    reasons.push("alias exact");
  } else if (candidateName.includes(artistName) || artistName.includes(candidateName)) {
    score += 25;
    reasons.push("name contains");
  } else {
    const artistTokens = new Set(artistName.split(" ").filter(Boolean));
    const candidateTokens = new Set(candidateName.split(" ").filter(Boolean));
    const overlap = [...artistTokens].filter(token => candidateTokens.has(token)).length;
    const ratio = artistTokens.size > 0 ? overlap / artistTokens.size : 0;
    if (ratio >= 0.75) {
      score += 18;
      reasons.push("strong token overlap");
    } else if (ratio >= 0.5) {
      score += 8;
      reasons.push("partial token overlap");
    }
  }

  if (candidate.type === "Person" || candidate.type === "Group") {
    score += 12;
    reasons.push(`type ${candidate.type}`);
  }

  if (artist.source_country?.toLowerCase() === "mexico" && candidate.country === "MX") {
    score += 10;
    reasons.push("country MX");
  } else if (artist.source_country?.toLowerCase() === "mexico" && candidate.country && candidate.country !== "MX") {
    score -= 20;
    reasons.push(`country mismatch ${candidate.country}`);
  } else if (candidate.country) {
    score += 3;
    reasons.push(`country ${candidate.country}`);
  }

  const latinMusicCountries = new Set(["MX", "US", "CO", "PR", "ES", "AR", "CL", "DO", "VE", "CU", "GT", "HN", "SV", "NI", "CR", "PA"]);
  if (candidate.country && !latinMusicCountries.has(candidate.country)) {
    score -= 35;
    reasons.push(`unlikely country ${candidate.country}`);
  }

  if ((candidate.score ?? 0) >= 90) {
    score += 10;
    reasons.push("search score high");
  } else if ((candidate.score ?? 0) >= 70) {
    score += 5;
    reasons.push("search score medium");
  }

  return {
    mbid: candidate.id,
    name: candidate.name,
    score: Math.max(0, Math.min(score, 100)),
    type: candidate.type ?? null,
    country: candidate.country ?? null,
    areaName: candidate.area?.name ?? null,
    disambiguation: candidate.disambiguation ?? null,
    reasons,
    raw: candidate,
  };
}

function relationRows(artist: MusicBrainzArtist) {
  return (artist.relations ?? [])
    .map(rel => ({ type: rel.type ?? "", url: rel.url?.resource ?? "" }))
    .filter(rel => rel.type && rel.url)
    .slice(0, 25);
}

async function saveArtist(pool: InstanceType<typeof Pool>, artist: ArtistRow, best: ReturnType<typeof scoreCandidate>) {
  const raw = best.raw;
  await pool.query(
    `insert into musicbrainz_artists (
      artist_key, mbid, name, sort_name, disambiguation, type, country,
      area_name, begin_date, end_date, aliases, tags, relations,
      verified, last_updated, linked_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'auto',now(),now())
    on conflict (artist_key) do nothing`,
    [
      artist.artist_key,
      raw.id,
      raw.name,
      raw["sort-name"] ?? null,
      raw.disambiguation ?? null,
      raw.type ?? null,
      raw.country ?? null,
      raw.area?.name ?? null,
      raw["life-span"]?.begin ?? null,
      raw["life-span"]?.end ?? null,
      JSON.stringify((raw.aliases ?? []).map(alias => alias.name).filter(Boolean).slice(0, 25)),
      JSON.stringify((raw.tags ?? []).map(tag => tag.name).filter(Boolean).slice(0, 25)),
      JSON.stringify(relationRows(raw)),
    ],
  );
}

async function saveCandidate(pool: InstanceType<typeof Pool>, artist: ArtistRow, candidates: Array<ReturnType<typeof scoreCandidate>>, status: string) {
  await pool.query(
    `insert into musicbrainz_artist_candidates (
      artist_key, artist_name, candidates, best_score, status, searched_at
    ) values ($1,$2,$3,$4,$5,now())
    on conflict (artist_key) do update set
      artist_name = excluded.artist_name,
      candidates = excluded.candidates,
      best_score = excluded.best_score,
      status = excluded.status,
      searched_at = excluded.searched_at`,
    [
      artist.artist_key,
      artist.artist_name,
      JSON.stringify(candidates.map(({ raw: _raw, ...candidate }) => candidate)),
      candidates[0]?.score ?? 0,
      status,
    ],
  );
}

async function main() {
  const { limit, offset, minAutoScore, write } = parseArgs();
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const csv = await fetch(ARTIST_METADATA_URL).then(res => {
      if (!res.ok) throw new Error(`artist metadata HTTP ${res.status}`);
      return res.text();
    });
    const artists = rowsToObjects(parseCsv(csv));
    const linked = await pool.query<{ artist_key: string }>("select artist_key from musicbrainz_artists");
    const linkedKeys = new Set(linked.rows.map(row => row.artist_key));
    const reviewed = await pool.query<{ artist_key: string }>("select artist_key from musicbrainz_artist_candidates");
    const reviewedKeys = new Set(reviewed.rows.map(row => row.artist_key));
    const queue = artists
      .filter(artist => !linkedKeys.has(artist.artist_key) && !reviewedKeys.has(artist.artist_key))
      .slice(offset, offset + limit);

    let auto = 0;
    let review = 0;
    let noResult = 0;
    console.log(`${write ? "Writing" : "Dry run"} MusicBrainz backfill for ${queue.length} artists. Existing linked: ${linkedKeys.size}. minAutoScore=${minAutoScore}.`);

    for (const artist of queue) {
      const data = await mbFetch<MusicBrainzSearchResponse>("/artist", {
        query: `artist:"${artist.artist_name.replace(/"/g, "")}"`,
        limit: "5",
        inc: "aliases+tags+url-rels",
      });
      const candidates = (data.artists ?? [])
        .map(candidate => scoreCandidate(artist, candidate))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];

      if (!best) {
        noResult += 1;
        console.log(`NO_RESULT,${artist.artist_key},${artist.artist_name}`);
        if (write) await saveCandidate(pool, artist, [], "no_result");
      } else if (best.score >= minAutoScore) {
        auto += 1;
        console.log(`${write ? "SAVE" : "AUTO"},${artist.artist_key},${artist.artist_name},score=${best.score},${best.mbid},${best.name},${best.type ?? ""},${best.country ?? ""},${best.reasons.join("+")}`);
        if (write) {
          await saveArtist(pool, artist, best);
          await pool.query("delete from musicbrainz_artist_candidates where artist_key = $1", [artist.artist_key]);
        }
      } else {
        review += 1;
        console.log(`REVIEW,${artist.artist_key},${artist.artist_name},score=${best.score},${best.mbid},${best.name},${best.type ?? ""},${best.country ?? ""},${best.reasons.join("+")}`);
        if (write) await saveCandidate(pool, artist, candidates, "review");
      }
    }

    const count = await pool.query<{ count: number }>("select count(*)::int as count from musicbrainz_artists");
    const candidateCount = await pool.query<{ count: number }>("select count(*)::int as count from musicbrainz_artist_candidates");
    console.log(`Done. auto=${auto} review=${review} no_result=${noResult} db_musicbrainz_artists=${count.rows[0].count} candidate_rows=${candidateCount.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
