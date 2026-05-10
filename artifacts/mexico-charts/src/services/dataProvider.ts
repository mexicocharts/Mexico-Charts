/* ─────────────────────────────────────────────────────────────────────────────
   DATA PROVIDER
   Transforms raw sheet rows into normalized chart objects.
   Exports React Query hooks consumed by the UI.
   To swap Google Sheets for the Chartmetric API, replace the fetchSheetCSV
   calls at the bottom — the hooks and normalized types stay the same.
───────────────────────────────────────────────────────────────────────────── */

import { useQuery } from "@tanstack/react-query";
import { fetchSheetCSV } from "./googleSheetsData";
import { SHEET_SOURCES } from "@/config/sheetSources";
import type {
  RawChartArtist,
  RawChartSong,
  RawChartAlbum,
  ChartArtist,
  ChartSong,
  ChartAlbum,
  ChartResult,
} from "@/types/chartData";

/* ── Rank-based accent colors (matches existing design) ── */
const RANK_ACCENTS = [
  "#39FF14",
  "rgba(57,255,20,0.62)",
  "rgba(57,255,20,0.48)",
  "rgba(255,255,255,0.42)",
  "rgba(255,255,255,0.35)",
  "rgba(255,255,255,0.28)",
  "rgba(255,255,255,0.23)",
  "rgba(255,255,255,0.20)",
  "rgba(255,255,255,0.18)",
  "rgba(255,255,255,0.15)",
];

function rankAccent(rank: number): string {
  return RANK_ACCENTS[rank - 1] ?? RANK_ACCENTS[RANK_ACCENTS.length - 1];
}

/* ── Number parsing helpers ── */

/** Parses a raw listener string like "32400000", "32.4M", "32,400,000" → 32400000 */
function parseListeners(raw: string | undefined): number {
  if (!raw) return 0;
  const s = raw.trim().toUpperCase();
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
}

/** Formats a raw listener number to a display string like "32.4M" */
function formatListeners(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Parses a growth string like "+18%", "18.5", "-5%" → 18.5 */
function parseGrowthPct(raw: string | undefined): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[^0-9.\-]/g, "")) || 0;
}

/** Formats a growth number to "+18%" or "-5%" */
function formatGrowth(n: number): string {
  if (n === 0) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

/** Parses a country count string like "60+", "60" → 60 */
function parseCountries(raw: string | undefined): number {
  if (!raw) return 0;
  return parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0;
}

/** Formats a country count to "60+" */
function formatCountries(n: number): string {
  if (n === 0) return "—";
  return `${n}+`;
}

/* ── Eligibility filter ── */
/** Returns true for rows that should be shown publicly */
function isEligible(row: { eligibility_status?: string }): boolean {
  const status = (row.eligibility_status ?? "").toLowerCase().trim();
  return status !== "excluded" && status !== "review";
}

/* ── Normalizers ── */

function normalizeArtist(raw: RawChartArtist): ChartArtist | null {
  const mexicoRank = parseInt(raw.mexico_charts_rank, 10);
  if (!mexicoRank || !raw.artist_name?.trim()) return null;

  const listenersRaw = parseListeners(raw.monthly_listeners);
  const growthRaw = parseGrowthPct(raw.listeners_change_pct);
  const countriesRaw = parseCountries(raw.country_count);

  return {
    mexicoRank,
    sourceRank: parseInt(raw.source_chart_rank, 10) || mexicoRank,
    name: raw.artist_name.trim(),
    listeners: formatListeners(listenersRaw),
    listenersRaw,
    growth: formatGrowth(growthRaw),
    growthRaw,
    genre: raw.genre?.trim() ?? "Regional Mexicano",
    subgenre: raw.subgenre?.trim() ?? "",
    countries: formatCountries(countriesRaw),
    countriesRaw,
    accent: rankAccent(mexicoRank),
  };
}

function normalizeSong(raw: RawChartSong): ChartSong | null {
  const mexicoRank = parseInt(raw.mexico_charts_rank, 10);
  if (!mexicoRank || !raw.track_name?.trim()) return null;

  const streamsRaw = parseListeners(raw.streams);

  return {
    mexicoRank,
    sourceRank: parseInt(raw.source_chart_rank, 10) || mexicoRank,
    displayArtist: raw.display_artist_names_mexico_only?.trim() ?? raw.artist_names_source?.trim() ?? "—",
    sourceArtist: raw.artist_names_source?.trim() ?? "",
    title: raw.track_name.trim(),
    streams: formatListeners(streamsRaw),
    genre: raw.genre?.trim() ?? "",
  };
}

function normalizeAlbum(raw: RawChartAlbum): ChartAlbum | null {
  const mexicoRank = parseInt(raw.mexico_charts_rank, 10);
  if (!mexicoRank || !raw.album_name?.trim()) return null;

  const streamsRaw = parseListeners(raw.streams);

  return {
    mexicoRank,
    sourceRank: parseInt(raw.source_chart_rank, 10) || mexicoRank,
    artist: raw.artist_name?.trim() ?? "—",
    title: raw.album_name.trim(),
    streams: formatListeners(streamsRaw),
    genre: raw.genre?.trim() ?? "",
  };
}

/* ── Fetch + normalize helpers ── */

async function fetchArtists(url: string): Promise<{ artists: ChartArtist[]; configured: boolean }> {
  const result = await fetchSheetCSV<RawChartArtist>(url);
  const artists = result.rows
    .filter(isEligible)
    .map(normalizeArtist)
    .filter((a): a is ChartArtist => a !== null)
    .sort((a, b) => a.mexicoRank - b.mexicoRank);
  return { artists, configured: result.configured };
}

async function fetchSongs(url: string): Promise<{ songs: ChartSong[]; configured: boolean }> {
  const result = await fetchSheetCSV<RawChartSong>(url);
  const songs = result.rows
    .filter(isEligible)
    .map(normalizeSong)
    .filter((s): s is ChartSong => s !== null)
    .sort((a, b) => a.mexicoRank - b.mexicoRank);
  return { songs, configured: result.configured };
}

async function fetchAlbums(url: string): Promise<{ albums: ChartAlbum[]; configured: boolean }> {
  const result = await fetchSheetCSV<RawChartAlbum>(url);
  const albums = result.rows
    .filter(isEligible)
    .map(normalizeAlbum)
    .filter((a): a is ChartAlbum => a !== null)
    .sort((a, b) => a.mexicoRank - b.mexicoRank);
  return { albums, configured: result.configured };
}

/* ── React Query Hooks ── */

function toResult<T>(
  data: { data: T[]; configured: boolean } | undefined,
  isLoading: boolean,
  isError: boolean,
  key: string
): ChartResult<T> {
  const items = data?.data ?? [];
  return {
    data: items,
    status: isLoading ? "loading" : isError ? "error" : "success",
    isLoading,
    isError,
    isEmpty: !(data?.configured ?? false),
  };
}

export function useArtistsWeekly(): ChartResult<ChartArtist> {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["artists", "weekly", SHEET_SOURCES.artistsWeekly],
    queryFn: async () => {
      const { artists, configured } = await fetchArtists(SHEET_SOURCES.artistsWeekly);
      return { data: artists, configured };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return toResult(data, isLoading, isError, "artistsWeekly");
}

export function useArtistsDaily(): ChartResult<ChartArtist> {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["artists", "daily", SHEET_SOURCES.artistsDaily],
    queryFn: async () => {
      const { artists, configured } = await fetchArtists(SHEET_SOURCES.artistsDaily);
      return { data: artists, configured };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return toResult(data, isLoading, isError, "artistsDaily");
}

export function useSongsWeekly(): ChartResult<ChartSong> {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["songs", "weekly", SHEET_SOURCES.songsWeekly],
    queryFn: async () => {
      const { songs, configured } = await fetchSongs(SHEET_SOURCES.songsWeekly);
      return { data: songs, configured };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return toResult(data, isLoading, isError, "songsWeekly");
}

export function useSongsDaily(): ChartResult<ChartSong> {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["songs", "daily", SHEET_SOURCES.songsDaily],
    queryFn: async () => {
      const { songs, configured } = await fetchSongs(SHEET_SOURCES.songsDaily);
      return { data: songs, configured };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return toResult(data, isLoading, isError, "songsDaily");
}

export function useAlbumsWeekly(): ChartResult<ChartAlbum> {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["albums", "weekly", SHEET_SOURCES.albumsWeekly],
    queryFn: async () => {
      const { albums, configured } = await fetchAlbums(SHEET_SOURCES.albumsWeekly);
      return { data: albums, configured };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return toResult(data, isLoading, isError, "albumsWeekly");
}

export function useViralDaily(): ChartResult<ChartSong> {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["viral", "daily", SHEET_SOURCES.viralDaily],
    queryFn: async () => {
      const { songs, configured } = await fetchSongs(SHEET_SOURCES.viralDaily);
      return { data: songs, configured };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return toResult(data, isLoading, isError, "viralDaily");
}

/* ── Utility: look up an artist by name or slug ── */
export function findArtistBySlug(
  artists: ChartArtist[],
  slug: string
): ChartArtist | undefined {
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  return artists.find((a) => slugify(a.name) === slug);
}

/* ── Re-export accent helper for use in components ── */
export { rankAccent, formatListeners, formatGrowth, formatCountries };
