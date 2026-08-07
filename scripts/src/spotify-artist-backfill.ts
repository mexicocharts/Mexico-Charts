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
  spotify_followers?: string;
}

interface SpotifyArtist {
  id: string;
  name: string;
  uri?: string;
  popularity: number | null;
  followers?: { total?: number };
  external_urls?: { spotify?: string };
  images?: Array<{ url: string; height?: number; width?: number }>;
  genres?: string[];
}

interface SpotifySearchResponse {
  artists?: { items?: SpotifyArtist[] };
}

interface SpotifyArtistsResponse {
  artists?: Array<SpotifyArtist | null>;
}

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

const ARTIST_METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const MAX_RETRIES = 3;

let tokenCache: { token: string; expiresAt: number } | null = null;

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 25), 100)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    minAutoScore: Math.max(0, Math.min(Number(args.get("minAutoScore") ?? 90), 100)),
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
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
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

function parseCount(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtCount(value: number | null): string {
  if (value == null) return "";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

async function spotifyToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const clientId = process.env["SPOTIFY_CLIENT_ID"];
  const clientSecret = process.env["SPOTIFY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET.");

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Spotify token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json() as SpotifyTokenResponse;
  tokenCache = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
  return json.access_token;
}

async function spotifyFetch<T>(path: string, params: Record<string, string>, attempt = 0): Promise<T> {
  const token = await spotifyToken();
  const qs = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}${path}${qs.size ? `?${qs.toString()}` : ""}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (res.status === 401 && attempt === 0) {
    tokenCache = null;
    return spotifyFetch<T>(path, params, attempt + 1);
  }

  if (res.status === 429 && attempt < MAX_RETRIES) {
    const retryAfter = Math.max(1, Number(res.headers.get("retry-after") ?? "1"));
    console.error(`RATE_LIMIT,retry_after=${retryAfter}s,path=${path}`);
    await sleep(retryAfter * 1000);
    return spotifyFetch<T>(path, params, attempt + 1);
  }

  if (!res.ok) throw new Error(`Spotify API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

async function fetchArtistsByIds(ids: string[]): Promise<SpotifyArtist[]> {
  if (ids.length === 0) return [];
  const artists: SpotifyArtist[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    try {
      const data = await spotifyFetch<SpotifyArtistsResponse>("/artists", { ids: batch.join(",") });
      artists.push(...(data.artists ?? []).filter((artist): artist is SpotifyArtist => Boolean(artist)));
    } catch (err) {
      if (!(err as Error).message.includes("Spotify API 403")) throw err;
      console.error("BATCH_FORBIDDEN,fallback=single_artist_lookup");
      for (const id of batch) {
        const artist = await spotifyFetch<SpotifyArtist>(`/artists/${id}`, {});
        artists.push(artist);
        await sleep(75);
      }
    }
  }
  return artists;
}

function scoreCandidate(artist: ArtistRow, candidate: SpotifyArtist) {
  const artistName = normalizeName(artist.artist_name);
  const spotifyName = normalizeName(candidate.name);
  const followers = candidate.followers?.total ?? null;
  const sheetFollowers = parseCount(artist.spotify_followers);
  const reasons: string[] = [];
  const hasStats = candidate.followers?.total != null || candidate.popularity != null || (candidate.genres?.length ?? 0) > 0;
  let score = 0;

  if (spotifyName === artistName) {
    score += 45;
    reasons.push("name exact");
  } else if (compactName(candidate.name) === compactName(artist.artist_name)) {
    score += 38;
    reasons.push("compact name match");
  } else if (spotifyName.includes(artistName) || artistName.includes(spotifyName)) {
    score += 25;
    reasons.push("name contains");
  } else {
    const artistTokens = new Set(artistName.split(" ").filter(Boolean));
    const candidateTokens = new Set(spotifyName.split(" ").filter(Boolean));
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

  if (sheetFollowers != null && followers != null && sheetFollowers > 0) {
    const ratio = followers / sheetFollowers;
    if (ratio >= 0.5 && ratio <= 2) {
      score += 35;
      reasons.push("followers close");
    } else if (ratio >= 0.25 && ratio <= 4) {
      score += 22;
      reasons.push("followers reasonable");
    } else if (ratio >= 0.1 && ratio <= 10) {
      score += 8;
      reasons.push("followers loose");
    } else {
      score -= 25;
      reasons.push("followers mismatch");
    }
  } else if ((followers ?? 0) >= 100_000) {
    score += 8;
    reasons.push("substantial followers");
  }

  if ((candidate.popularity ?? 0) >= 40) {
    score += 10;
    reasons.push("strong popularity");
  } else if ((candidate.popularity ?? 0) >= 20) {
    score += 4;
    reasons.push("some popularity");
  }

  return {
    spotifyArtistId: candidate.id,
    spotifyName: candidate.name,
    score: Math.max(0, Math.min(score, 100)),
    followers,
    popularity: candidate.popularity,
    spotifyUrl: candidate.external_urls?.spotify ?? null,
    imageUrl: candidate.images?.[0]?.url ?? null,
    uri: candidate.uri ?? null,
    genres: candidate.genres ?? [],
    capability: hasStats ? "identity_profile_with_legacy_stats" : "identity_profile_only",
    notes: hasStats ? null : "This Spotify app currently returns artist identity/profile fields only; followers, popularity, and genres are unavailable.",
    reasons,
  };
}

async function saveArtist(pool: InstanceType<typeof Pool>, artist: ArtistRow, candidate: ReturnType<typeof scoreCandidate>) {
  await pool.query(
    `insert into spotify_artists (
      artist_key, spotify_artist_id, spotify_name, spotify_followers,
      spotify_popularity, spotify_url, spotify_image_url, spotify_genres,
      spotify_uri, spotify_api_capability, notes,
      verified, verified_at, spotify_last_updated, linked_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,now(),now(),now())
    on conflict (artist_key) do nothing`,
    [
      artist.artist_key,
      candidate.spotifyArtistId,
      candidate.spotifyName,
      candidate.followers,
      candidate.popularity,
      candidate.spotifyUrl,
      candidate.imageUrl,
      JSON.stringify(candidate.genres),
      candidate.uri,
      candidate.capability,
      candidate.notes,
    ],
  );
}

async function saveCandidate(pool: InstanceType<typeof Pool>, artist: ArtistRow, candidates: Array<ReturnType<typeof scoreCandidate>>, status: string) {
  await pool.query(
    `insert into spotify_artist_candidates (
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
      JSON.stringify(candidates),
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
    const linked = await pool.query<{ artist_key: string }>("select artist_key from spotify_artists");
    const linkedKeys = new Set(linked.rows.flatMap(row => [
      row.artist_key,
      compactName(row.artist_key),
    ]));
    const reviewed = await pool.query<{ artist_key: string }>("select artist_key from spotify_artist_candidates");
    const reviewedKeys = new Set(reviewed.rows.flatMap(row => [
      row.artist_key,
      compactName(row.artist_key),
    ]));
    const queue = artists
      .filter(artist => {
        const compactKey = compactName(artist.artist_key);
        return !linkedKeys.has(artist.artist_key)
          && !linkedKeys.has(compactKey)
          && !reviewedKeys.has(artist.artist_key)
          && !reviewedKeys.has(compactKey);
      })
      .slice(offset, offset + limit);

    let auto = 0;
    let review = 0;
    let noResult = 0;
    console.log(`${write ? "Writing" : "Dry run"} Spotify artist backfill for ${queue.length} artists. Existing linked: ${linkedKeys.size}. Existing review/no-result: ${reviewedKeys.size}. minAutoScore=${minAutoScore}.`);

    for (const artist of queue) {
      const data = await spotifyFetch<SpotifySearchResponse>("/search", {
        type: "artist",
        q: artist.artist_name,
        limit: "5",
      });
      const ids = [...new Set((data.artists?.items ?? []).map(item => item.id).filter(Boolean))];
      const fullArtists = await fetchArtistsByIds(ids);
      const candidates = fullArtists
        .map(candidate => scoreCandidate(artist, candidate))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];

      if (!best) {
        noResult += 1;
        console.log(`NO_RESULT,${artist.artist_key},${artist.artist_name}`);
      } else if (best.score >= minAutoScore) {
        auto += 1;
        console.log(`${write ? "SAVE" : "AUTO"},${artist.artist_key},${artist.artist_name},score=${best.score},${best.spotifyArtistId},${best.spotifyName},followers=${fmtCount(best.followers)},popularity=${best.popularity ?? ""},${best.reasons.join("+")}`);
        if (write) {
          await saveArtist(pool, artist, best);
          await pool.query("delete from spotify_artist_candidates where artist_key = $1", [artist.artist_key]);
        }
      } else {
        review += 1;
        console.log(`REVIEW,${artist.artist_key},${artist.artist_name},score=${best.score},${best.spotifyArtistId},${best.spotifyName},followers=${fmtCount(best.followers)},popularity=${best.popularity ?? ""},${best.reasons.join("+")}`);
        if (write) await saveCandidate(pool, artist, candidates, "review");
      }

      await sleep(125);
    }

    const count = await pool.query<{ count: number }>("select count(*)::int as count from spotify_artists");
    const candidateCount = await pool.query<{ count: number }>("select count(*)::int as count from spotify_artist_candidates");
    console.log(`Done. auto=${auto} review=${review} no_result=${noResult} db_spotify_artists=${count.rows[0].count} candidate_rows=${candidateCount.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
