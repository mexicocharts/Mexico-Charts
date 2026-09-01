import type {
  SongstatsHistoricStatsResponse,
  SongstatsSource,
} from "./songstats-client";

const API_BASE_URL = "https://api.songstats.com/enterprise/v1";
const ALLOWED_ENDPOINT = "/artists/historic_stats";

export class SongstatsHistoryHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SongstatsHistoryHttpError";
  }
}

function apiKey(): string {
  const key = process.env["SONGSTATS_API_KEY"]?.trim();
  if (!key) throw new Error("SONGSTATS_API_KEY must be set");
  return key;
}

export async function fetchLicensedSongstatsArtistHistory(input: {
  songstatsArtistId: string;
  source?: SongstatsSource;
  startDate: string;
  endDate: string;
  withAggregates?: boolean;
  timeoutMs?: number;
}): Promise<SongstatsHistoricStatsResponse> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) ||
      input.startDate > input.endDate) {
    throw new Error("Invalid Songstats historical request window");
  }
  const baseUrl = (process.env["SONGSTATS_API_BASE_URL"] ?? API_BASE_URL)
    .replace(/\/+$/, "");
  const url = new URL(`${baseUrl}${ALLOWED_ENDPOINT}`);
  url.searchParams.set("songstats_artist_id", input.songstatsArtistId);
  url.searchParams.set("source", input.source ?? "all");
  url.searchParams.set("start_date", input.startDate);
  url.searchParams.set("end_date", input.endDate);
  url.searchParams.set("with_aggregates", String(input.withAggregates ?? true));

  const timeoutMs = Math.max(1_000, Math.min(120_000, input.timeoutMs ?? 60_000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", apikey: apiKey() },
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 300);
      throw new SongstatsHistoryHttpError(
        `Songstats API ${response.status}${detail ? `: ${detail}` : ""}`,
        response.status,
      );
    }
    return await response.json() as SongstatsHistoricStatsResponse;
  } catch (error) {
    if (error instanceof SongstatsHistoryHttpError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SongstatsHistoryHttpError(
        `Songstats historical request timed out after ${timeoutMs}ms`,
        504,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const SONGSTATS_HISTORY_ONLY_ENDPOINT = ALLOWED_ENDPOINT;
