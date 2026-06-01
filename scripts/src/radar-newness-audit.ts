import { writeFile } from "node:fs/promises";
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
  spotify_followers_hint?: string;
  spotify_artist_id: string | null;
  spotify_followers: number | null;
  spotify_popularity: number | null;
  spotify_genres: string[] | null;
  mbid: string | null;
  musicbrainz_begin_date: string | null;
}

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
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

interface SpotifyAlbum {
  id: string;
  name: string;
  album_group?: string;
  album_type?: string;
  release_date?: string;
  release_date_precision?: "year" | "month" | "day";
}

interface SpotifyAlbumsResponse {
  items?: SpotifyAlbum[];
  total?: number;
  next?: string | null;
}

interface WikidataBindingValue {
  value?: string;
}

interface WikidataBinding {
  itemLabel?: WikidataBindingValue;
  inception?: WikidataBindingValue;
  start?: WikidataBindingValue;
  birth?: WikidataBindingValue;
}

interface WikidataResponse {
  results?: { bindings?: WikidataBinding[] };
}

interface SpotifyCareer {
  firstReleaseDate: string | null;
  firstReleaseTitle: string | null;
  firstReleaseType: string | null;
  releaseCount: number;
  oldCatalogBefore2020: boolean;
}

interface WikidataCareer {
  label: string | null;
  inceptionDate: string | null;
  startDate: string | null;
  birthDate: string | null;
}

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const WIKIDATA_SPARQL_URL = "https://query.wikidata.org/sparql";
const ARTIST_METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";
const MIN_SPOTIFY_SEARCH_SCORE = 72;

let tokenCache: { token: string; expiresAt: number } | null = null;
let lastWikidataRequestAt = 0;

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    artistKey: args.get("artistKey")?.trim().toLowerCase(),
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 600), 1000)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    wikidata: args.get("wikidata") === "true",
    out: args.get("out") ?? "radar-newness-candidates.csv",
    summaryOnly: args.get("summaryOnly") === "true",
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  return body
    .map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        obj[header.trim()] = row[index]?.trim() ?? "";
      });
      return {
        artist_key: obj["artist_key"] ?? "",
        artist_name: obj["artist_name"] ?? "",
        spotify_followers_hint: obj["spotify_followers"] ?? "",
        spotify_artist_id: null,
        spotify_followers: null,
        spotify_popularity: null,
        spotify_genres: null,
        mbid: null,
        musicbrainz_begin_date: null,
      } satisfies ArtistRow;
    })
    .filter(row => row.artist_key && row.artist_name);
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

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

function yearOf(value: string | null | undefined) {
  const normalized = normalizeDate(value);
  return normalized ? Number(normalized.slice(0, 4)) : null;
}

function earliestDate(values: Array<string | null | undefined>) {
  return values
    .map(normalizeDate)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(","),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function classifyCareer(params: {
  firstReleaseYear: number | null;
  releaseCount: number;
  musicbrainzYear: number | null;
  wikidataYear: number | null;
  spotifyPopularity: number | null;
}) {
  const earliestCareerYear = Math.min(
    ...[params.firstReleaseYear, params.musicbrainzYear, params.wikidataYear]
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  );
  const careerYear = Number.isFinite(earliestCareerYear) ? earliestCareerYear : params.firstReleaseYear;

  if (!careerYear) return "review";
  if (careerYear <= 2016 || params.releaseCount >= 80) return "legacy";
  if (careerYear <= 2021 || params.releaseCount >= 45) return "established";
  if (careerYear >= 2024 && params.releaseCount <= 25) return "new";
  if (careerYear >= 2022 && params.releaseCount <= 45) return "emerging";
  if ((params.spotifyPopularity ?? 0) >= 55 && params.releaseCount <= 35) return "emerging";
  return "review";
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

async function spotifyFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = await spotifyToken();
  const qs = new URLSearchParams(params);
  const res = await fetch(`${SPOTIFY_API_BASE}${path}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (res.status === 429) {
    const retryAfter = Math.max(1, Number(res.headers.get("retry-after") ?? "2"));
    await sleep(retryAfter * 1000);
    return spotifyFetch<T>(path, params);
  }
  if (!res.ok) throw new Error(`Spotify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

async function fetchArtistsByIds(ids: string[]): Promise<SpotifyArtist[]> {
  if (ids.length === 0) return [];
  const artists: SpotifyArtist[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await spotifyFetch<SpotifyArtistsResponse>("/artists", { ids: batch.join(",") });
    artists.push(...(data.artists ?? []).filter((artist): artist is SpotifyArtist => Boolean(artist)));
  }
  return artists;
}

function scoreSpotifyCandidate(artist: ArtistRow, candidate: SpotifyArtist) {
  const artistName = normalizeName(artist.artist_name);
  const spotifyName = normalizeName(candidate.name);
  const followers = candidate.followers?.total ?? null;
  const sheetFollowers = parseCount(artist.spotify_followers_hint);
  let score = 0;

  if (spotifyName === artistName) score += 45;
  else if (compactName(candidate.name) === compactName(artist.artist_name)) score += 38;
  else if (spotifyName.includes(artistName) || artistName.includes(spotifyName)) score += 25;
  else {
    const artistTokens = new Set(artistName.split(" ").filter(Boolean));
    const candidateTokens = new Set(spotifyName.split(" ").filter(Boolean));
    const overlap = [...artistTokens].filter(token => candidateTokens.has(token)).length;
    const ratio = artistTokens.size > 0 ? overlap / artistTokens.size : 0;
    if (ratio >= 0.75) score += 18;
    else if (ratio >= 0.5) score += 8;
  }

  if (sheetFollowers != null && followers != null && sheetFollowers > 0) {
    const ratio = followers / sheetFollowers;
    if (ratio >= 0.5 && ratio <= 2) score += 35;
    else if (ratio >= 0.25 && ratio <= 4) score += 22;
    else if (ratio >= 0.1 && ratio <= 10) score += 8;
    else score -= 25;
  } else if ((followers ?? 0) >= 100_000) score += 8;

  if ((candidate.popularity ?? 0) >= 40) score += 10;
  else if ((candidate.popularity ?? 0) >= 20) score += 4;

  return {
    artist: candidate,
    score: Math.max(0, Math.min(score, 100)),
  };
}

async function enrichWithSpotifySearch(artist: ArtistRow): Promise<ArtistRow> {
  if (artist.spotify_artist_id) return artist;
  const data = await spotifyFetch<SpotifySearchResponse>("/search", {
    type: "artist",
    q: artist.artist_name,
    limit: "5",
  });
  const ids = [...new Set((data.artists?.items ?? []).map(item => item.id).filter(Boolean))];
  const candidates = (await fetchArtistsByIds(ids))
    .map(candidate => scoreSpotifyCandidate(artist, candidate))
    .sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < MIN_SPOTIFY_SEARCH_SCORE) return artist;

  return {
    ...artist,
    spotify_artist_id: best.artist.id,
    spotify_followers: best.artist.followers?.total ?? null,
    spotify_popularity: best.artist.popularity,
    spotify_genres: best.artist.genres ?? [],
  };
}

async function loadSpotifyCareer(spotifyArtistId: string | null): Promise<SpotifyCareer> {
  if (!spotifyArtistId) {
    return { firstReleaseDate: null, firstReleaseTitle: null, firstReleaseType: null, releaseCount: 0, oldCatalogBefore2020: false };
  }

  const seen = new Set<string>();
  const albums: SpotifyAlbum[] = [];
  for (let offset = 0; offset < 300; offset += 50) {
    const page = await spotifyFetch<SpotifyAlbumsResponse>(`/artists/${spotifyArtistId}/albums`, {
      include_groups: "album,single",
      market: "MX",
      limit: "50",
      offset: String(offset),
    });

    for (const item of page.items ?? []) {
      if (!item.id || seen.has(item.id)) continue;
      seen.add(item.id);
      albums.push(item);
    }
    if (!page.next || albums.length >= (page.total ?? albums.length)) break;
  }

  const dated = albums
    .map(album => ({ album, date: normalizeDate(album.release_date) }))
    .filter((entry): entry is { album: SpotifyAlbum; date: string } => Boolean(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const first = dated[0] ?? null;

  return {
    firstReleaseDate: first?.date ?? null,
    firstReleaseTitle: first?.album.name ?? null,
    firstReleaseType: first?.album.album_group ?? first?.album.album_type ?? null,
    releaseCount: albums.length,
    oldCatalogBefore2020: dated.some(entry => Number(entry.date.slice(0, 4)) < 2020),
  };
}

async function loadWikidataCareer(mbid: string | null): Promise<WikidataCareer | null> {
  if (!mbid) return null;

  const waitMs = Math.max(0, 1100 - (Date.now() - lastWikidataRequestAt));
  if (waitMs) await sleep(waitMs);
  lastWikidataRequestAt = Date.now();

  const query = `
    SELECT ?item ?itemLabel ?inception ?start ?birth WHERE {
      ?item wdt:P434 "${mbid}".
      OPTIONAL { ?item wdt:P571 ?inception. }
      OPTIONAL { ?item wdt:P2031 ?start. }
      OPTIONAL { ?item wdt:P569 ?birth. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
    }
    LIMIT 1
  `;
  const qs = new URLSearchParams({ query, format: "json" });
  const res = await fetch(`${WIKIDATA_SPARQL_URL}?${qs.toString()}`, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "MexicoChartsBot/1.0 (https://mexicochart.com)",
    },
  });
  if (!res.ok) return null;
  const json = await res.json() as WikidataResponse;
  const binding = json.results?.bindings?.[0];
  if (!binding) return null;
  return {
    label: binding.itemLabel?.value ?? null,
    inceptionDate: normalizeDate(binding.inception?.value?.slice(0, 10)),
    startDate: normalizeDate(binding.start?.value?.slice(0, 10)),
    birthDate: normalizeDate(binding.birth?.value?.slice(0, 10)),
  };
}

async function main() {
  const args = parseArgs();

  const pool = process.env["DATABASE_URL"] ? new Pool({ connectionString: process.env["DATABASE_URL"] }) : null;
  try {
    let artists: ArtistRow[] = [];
    if (pool) {
      const query = args.artistKey
        ? `select s.artist_key, coalesce(s.spotify_name, s.artist_key) as artist_name, null as spotify_followers_hint,
                s.spotify_artist_id, s.spotify_followers, s.spotify_popularity, s.spotify_genres, m.mbid,
                m.begin_date as musicbrainz_begin_date
           from spotify_artists s
           left join musicbrainz_artists m on m.artist_key = s.artist_key
           where s.artist_key = $1
           limit 1`
        : `select s.artist_key, coalesce(s.spotify_name, s.artist_key) as artist_name, null as spotify_followers_hint,
                s.spotify_artist_id, s.spotify_followers, s.spotify_popularity, s.spotify_genres, m.mbid,
                m.begin_date as musicbrainz_begin_date
           from spotify_artists s
           left join musicbrainz_artists m on m.artist_key = s.artist_key
           order by s.spotify_popularity desc nulls last, s.spotify_followers desc nulls last, s.artist_key
           limit $1 offset $2`;
      const params = args.artistKey ? [args.artistKey] : [args.limit, args.offset];
      const result = await pool.query<ArtistRow>(query, params);
      artists = result.rows;
    }

    if (artists.length === 0) {
      const response = await fetch(ARTIST_METADATA_URL);
      if (!response.ok) throw new Error(`artist_metadata_active HTTP ${response.status}`);
      artists = rowsToObjects(parseCsv(await response.text()))
        .filter(row => !args.artistKey || row.artist_key === args.artistKey)
        .slice(args.offset, args.offset + args.limit);
      console.log(`Using artist_metadata_active fallback: artists=${artists.length}`);
    }

    const outputRows: Record<string, unknown>[] = [];
    const summary = {
      totalAudited: 0,
      qualified: 0,
      new: 0,
      emerging: 0,
      review: 0,
      established: 0,
      legacy: 0,
    };
    console.log(`Auditing Radar newness: artists=${artists.length} wikidata=${args.wikidata}`);
    for (const rawArtist of artists) {
      const artist = await enrichWithSpotifySearch(rawArtist);
      const spotify = await loadSpotifyCareer(artist.spotify_artist_id);
      const wikidata = args.wikidata ? await loadWikidataCareer(artist.mbid) : null;
      const firstExternalDate = earliestDate([
        spotify.firstReleaseDate,
        artist.musicbrainz_begin_date,
        wikidata?.inceptionDate,
        wikidata?.startDate,
      ]);
      const suggestedStage = classifyCareer({
        firstReleaseYear: yearOf(spotify.firstReleaseDate),
        releaseCount: spotify.releaseCount,
        musicbrainzYear: yearOf(artist.musicbrainz_begin_date),
        wikidataYear: yearOf(wikidata?.inceptionDate) ?? yearOf(wikidata?.startDate),
        spotifyPopularity: artist.spotify_popularity,
      });
      summary.totalAudited += 1;
      if (suggestedStage === "new" || suggestedStage === "emerging") summary.qualified += 1;
      if (suggestedStage in summary) {
        summary[suggestedStage as keyof typeof summary] += 1;
      }

      outputRows.push({
        artist_key: artist.artist_key,
        artist_name: artist.artist_name,
        suggested_stage: suggestedStage,
        first_external_date: firstExternalDate,
        spotify_first_release_date: spotify.firstReleaseDate,
        spotify_first_release_title: spotify.firstReleaseTitle,
        spotify_release_type: spotify.firstReleaseType,
        spotify_release_count: spotify.releaseCount,
        old_catalog_before_2020: spotify.oldCatalogBefore2020,
        spotify_popularity: artist.spotify_popularity ?? "",
        spotify_followers: artist.spotify_followers ?? "",
        musicbrainz_begin_date: artist.musicbrainz_begin_date ?? "",
        wikidata_label: wikidata?.label ?? "",
        wikidata_inception_date: wikidata?.inceptionDate ?? "",
        wikidata_start_date: wikidata?.startDate ?? "",
        wikidata_birth_date: wikidata?.birthDate ?? "",
        mbid: artist.mbid ?? "",
      });
      console.log(`${artist.artist_key},${suggestedStage},first=${firstExternalDate ?? ""},spotify=${spotify.firstReleaseDate ?? ""},releases=${spotify.releaseCount}`);
      await sleep(80);
    }

    console.log(`RADAR_SUMMARY total=${summary.totalAudited} qualified=${summary.qualified} new=${summary.new} emerging=${summary.emerging} review=${summary.review} established=${summary.established} legacy=${summary.legacy}`);
    if (!args.summaryOnly) {
      await writeFile(args.out, `${toCsv(outputRows)}\n`, "utf8");
      console.log(`Wrote ${outputRows.length} rows to ${args.out}`);
    }
  } finally {
    await pool?.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
