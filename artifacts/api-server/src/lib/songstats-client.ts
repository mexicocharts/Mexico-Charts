import {
  claimSongstatsMonthlyArtist,
  type SongstatsBillableIdentifier,
} from "./songstats-billing-guard";

const DEFAULT_API_BASE_URL = "https://api.songstats.com/enterprise/v1";
// Historic and audience responses can be several megabytes for established
// artists, so their successful responses need more room than a typical API call.
const DEFAULT_TIMEOUT_MS = 60_000;

export type SongstatsSource =
  | "all"
  | "amazon"
  | "apple_music"
  | "bandsintown"
  | "beatport"
  | "deezer"
  | "facebook"
  | "instagram"
  | "itunes"
  | "pandora"
  | "shazam"
  | "songkick"
  | "soundcloud"
  | "spotify"
  | "tiktok"
  | "tidal"
  | "tracklist"
  | "traxsource"
  | "twitter"
  | "youtube";

export interface SongstatsArtistIdentifier extends SongstatsBillableIdentifier {}

export interface SongstatsArtistInfo {
  songstats_artist_id?: string;
  avatar?: string | null;
  name?: string | null;
  site_url?: string | null;
  links?: unknown[];
}

export interface SongstatsSourceStats {
  source: string;
  data: Record<string, unknown>;
}

export interface SongstatsCurrentStatsResponse {
  result?: string;
  message?: string;
  stats?: SongstatsSourceStats[];
  artist_info?: SongstatsArtistInfo;
  source_ids?: string[] | null;
  [key: string]: unknown;
}

export interface SongstatsHistoricStatsResponse {
  result?: string;
  message?: string;
  stats?: SongstatsSourceStats[];
  artist_info?: SongstatsArtistInfo;
  source_ids?: string[] | null;
  [key: string]: unknown;
}

export interface SongstatsAudienceResponse {
  result?: string;
  message?: string;
  audience?: unknown;
  artist_info?: SongstatsArtistInfo;
  source_ids?: string[] | null;
  [key: string]: unknown;
}

export interface SongstatsCatalogResponse {
  result?: string;
  message?: string;
  catalog?: unknown[];
  artist_info?: SongstatsArtistInfo;
  tracks_total?: number;
  next_url?: string | null;
  [key: string]: unknown;
}

export class SongstatsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = "SongstatsApiError";
  }
}

function apiKey(): string {
  const key = process.env["SONGSTATS_API_KEY"]?.trim();
  if (!key) {
    throw new Error("SONGSTATS_API_KEY must be set");
  }
  return key;
}

function apiBaseUrl(): string {
  return (process.env["SONGSTATS_API_BASE_URL"] ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function identifierParams(identifier: SongstatsArtistIdentifier): Record<string, string> {
  const supplied = [
    identifier.songstatsArtistId ? ["songstats_artist_id", identifier.songstatsArtistId] : null,
    identifier.spotifyArtistId ? ["spotify_artist_id", identifier.spotifyArtistId] : null,
    identifier.appleMusicArtistId != null
      ? ["apple_music_artist_id", String(identifier.appleMusicArtistId)]
      : null,
  ].filter((entry): entry is string[] => entry !== null);

  if (supplied.length !== 1) {
    throw new Error("Provide exactly one Songstats, Spotify, or Apple Music artist ID");
  }

  return Object.fromEntries(supplied);
}

function addOptionalParam(
  params: URLSearchParams,
  name: string,
  value: string | number | boolean | undefined,
) {
  if (value !== undefined) {
    params.set(name, String(value));
  }
}

async function songstatsGet<T>(
  endpoint: string,
  params: Record<string, string>,
  identifier: SongstatsArtistIdentifier,
): Promise<T> {
  await claimSongstatsMonthlyArtist(identifier, endpoint);

  const url = new URL(`${apiBaseUrl()}${endpoint}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  const controller = new AbortController();
  const rawTimeout = Number(process.env["SONGSTATS_API_TIMEOUT_MS"] ?? DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        apikey: apiKey(),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      const detail = body.replace(/\s+/g, " ").trim().slice(0, 300);
      throw new SongstatsApiError(
        `Songstats API ${response.status}${detail ? `: ${detail}` : ""}`,
        response.status,
        endpoint,
      );
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof SongstatsApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SongstatsApiError(
        `Songstats request timed out after ${timeoutMs}ms`,
        504,
        endpoint,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSongstatsArtistCurrentStats(
  identifier: SongstatsArtistIdentifier,
  source: SongstatsSource = "all",
): Promise<SongstatsCurrentStatsResponse> {
  return songstatsGet<SongstatsCurrentStatsResponse>("/artists/stats", {
    ...identifierParams(identifier),
    source,
  }, identifier);
}

export async function getSongstatsArtistHistoricStats(
  identifier: SongstatsArtistIdentifier,
  options: {
    source?: SongstatsSource;
    startDate?: string;
    endDate?: string;
    withAggregates?: boolean;
  } = {},
): Promise<SongstatsHistoricStatsResponse> {
  const params = new URLSearchParams({
    ...identifierParams(identifier),
    source: options.source ?? "all",
  });
  addOptionalParam(params, "start_date", options.startDate);
  addOptionalParam(params, "end_date", options.endDate);
  addOptionalParam(params, "with_aggregates", options.withAggregates);
  return songstatsGet<SongstatsHistoricStatsResponse>(
    "/artists/historic_stats",
    Object.fromEntries(params),
    identifier,
  );
}

export async function getSongstatsArtistAudience(
  identifier: SongstatsArtistIdentifier,
  source: SongstatsSource = "all",
): Promise<SongstatsAudienceResponse> {
  return songstatsGet<SongstatsAudienceResponse>("/artists/audience", {
    ...identifierParams(identifier),
    source,
  }, identifier);
}

export async function getSongstatsArtistAudienceDetails(
  identifier: SongstatsArtistIdentifier,
  countryCode: string,
  source: SongstatsSource = "all",
): Promise<SongstatsAudienceResponse> {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCountryCode)) {
    throw new Error("countryCode must be a two-letter country code");
  }

  return songstatsGet<SongstatsAudienceResponse>("/artists/audience/details", {
    ...identifierParams(identifier),
    source,
    country_code: normalizedCountryCode,
  }, identifier);
}

export async function getSongstatsArtistCatalog(
  identifier: SongstatsArtistIdentifier,
  options: { limit?: number; offset?: number; withLinks?: boolean } = {},
): Promise<SongstatsCatalogResponse> {
  const params = new URLSearchParams(identifierParams(identifier));
  addOptionalParam(params, "limit", options.limit);
  addOptionalParam(params, "offset", options.offset);
  addOptionalParam(params, "with_links", options.withLinks);
  return songstatsGet<SongstatsCatalogResponse>(
    "/artists/catalog",
    Object.fromEntries(params),
    identifier,
  );
}
