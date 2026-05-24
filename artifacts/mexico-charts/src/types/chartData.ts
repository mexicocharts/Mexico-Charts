/* ─────────────────────────────────────────────────────────────────────────────
   CHART DATA TYPES
   Raw types match Google Sheets column names exactly.
   Normalized types are what the UI consumes.
   When Chartmetric API access is granted, only dataProvider.ts needs updating.
───────────────────────────────────────────────────────────────────────────── */

/* ── Raw sheet row types (column names must match your Google Sheet headers) ── */

export interface RawChartArtist {
  mexico_charts_rank: string;        // Filtered rank shown on Mexico Charts
  source_chart_rank: string;         // Original Spotify chart rank
  artist: string;                    // Display name (artists_weekly_mx / artists_daily_mx)
  artist_type?: string;              // e.g. "Mexican-American / Regional Mexican" (weekly tab)
  eligibility_type?: string;         // e.g. "Mexican / Regional Mexican" (daily tab)
  status?: string;                   // "APPROVED" | "EXCLUDED" | "REVIEW" (daily tab)
  include_on_site?: string;          // "True" | "False" (daily tab)
  // Listener / growth stats come from artist_metadata_active sheet, not chart tabs
  monthly_listeners?: string;
  listeners_change_pct?: string;
  genre?: string;
  subgenre?: string;
  country_count?: string;
  eligibility_status?: string;
  [key: string]: string | undefined;
}

export interface RawChartSong {
  mexico_charts_rank: string;
  source_chart_rank: string;
  display_artist_names_mexico_only: string; // Public display (filtered)
  artist_names_source: string;              // Original Spotify credit (internal)
  track_name: string;
  streams?: string;
  streams_change_pct?: string;
  genre?: string;
  include_on_site?: string;          // "TRUE" | "FALSE"
  eligibility_status?: string;
  [key: string]: string | undefined;
}

export interface RawChartAlbum {
  mexico_charts_rank: string;
  source_chart_rank: string;
  primary_artist: string;            // Primary artist name (albums_weekly_mx)
  artist_credit?: string;            // Full credit string (may include features)
  artist_name?: string;              // Fallback if sheet uses this column
  album: string;                     // Album title (albums_weekly_mx)
  album_name?: string;               // Fallback if sheet uses this column
  streams?: string;
  genre?: string;
  eligibility_category?: string;     // e.g. "Mexican"
  include_on_site?: string;          // "TRUE" | "FALSE"
  eligibility_status?: string;
  [key: string]: string | undefined;
}

/* ── Normalized types consumed by the UI ── */

export interface ChartArtist {
  mexicoRank: number;
  sourceRank: number;
  name: string;
  listeners: string;        // Formatted, e.g. "32.4M"
  listenersRaw: number;     // Raw number for sorting/charts
  growth: string;           // e.g. "+18%"
  growthRaw: number;        // Raw number for sorting
  genre: string;
  subgenre: string;
  countries: string;        // e.g. "60+"
  countriesRaw: number;
  accent: string;           // Color derived from rank
}

export interface ChartSong {
  mexicoRank: number;
  sourceRank: number;
  displayArtist: string;    // display_artist_names_mexico_only
  sourceArtist: string;     // artist_names_source (not shown publicly)
  title: string;
  streams: string;
  genre: string;
}

export interface ChartAlbum {
  mexicoRank: number;
  sourceRank: number;
  artist: string;
  title: string;
  streams: string;
  genre: string;
}

export type FetchStatus = "idle" | "loading" | "success" | "error";

export interface ChartResult<T> {
  data: T[];
  status: FetchStatus;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean; // true when URL is not configured yet
}

/*
 * NOTE: Artist metadata types (RawArtistMetadata, ArtistMetadata, ArtistMetadataMap)
 * live in src/services/artistMetadata.ts because they are tightly coupled to the
 * fetch/normalize/lookup logic of that module.
 * Import them from there: import type { ArtistMetadata } from "@/services/artistMetadata";
 */
