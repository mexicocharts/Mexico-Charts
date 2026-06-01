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
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 100), 600)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    wikidata: args.get("wikidata") === "true",
    out: args.get("out") ?? "radar-newness-candidates.csv",
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  if (!process.env["DATABASE_URL"]) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
  try {
    const query = args.artistKey
      ? `select s.artist_key, coalesce(s.spotify_name, s.artist_key) as artist_name, s.spotify_artist_id,
              s.spotify_followers, s.spotify_popularity, s.spotify_genres, m.mbid,
              m.begin_date as musicbrainz_begin_date
         from spotify_artists s
         left join musicbrainz_artists m on m.artist_key = s.artist_key
         where s.artist_key = $1
         limit 1`
      : `select s.artist_key, coalesce(s.spotify_name, s.artist_key) as artist_name, s.spotify_artist_id,
              s.spotify_followers, s.spotify_popularity, s.spotify_genres, m.mbid,
              m.begin_date as musicbrainz_begin_date
         from spotify_artists s
         left join musicbrainz_artists m on m.artist_key = s.artist_key
         order by s.spotify_popularity desc nulls last, s.spotify_followers desc nulls last, s.artist_key
         limit $1 offset $2`;
    const params = args.artistKey ? [args.artistKey] : [args.limit, args.offset];
    const { rows: artists } = await pool.query<ArtistRow>(query, params);

    const outputRows: Record<string, unknown>[] = [];
    console.log(`Auditing Radar newness: artists=${artists.length} wikidata=${args.wikidata}`);
    for (const artist of artists) {
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

    await writeFile(args.out, `${toCsv(outputRows)}\n`, "utf8");
    console.log(`Wrote ${outputRows.length} rows to ${args.out}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
