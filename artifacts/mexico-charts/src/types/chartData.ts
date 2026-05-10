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
  artist_name: string;               // Display name
  monthly_listeners?: string;        // e.g. "32400000" or "32.4M"
  listeners_change_pct?: string;     // e.g. "+18%" or "18"
  genre?: string;                    // e.g. "Corridos Tumbados"
  subgenre?: string;                 // e.g. "Regional Mexicano"
  country_count?: string;            // e.g. "60"
  eligibility_status?: string;       // "approved" | "excluded" | "review"
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
  eligibility_status?: string;
  [key: string]: string | undefined;
}

export interface RawChartAlbum {
  mexico_charts_rank: string;
  source_chart_rank: string;
  artist_name: string;
  album_name: string;
  streams?: string;
  genre?: string;
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
