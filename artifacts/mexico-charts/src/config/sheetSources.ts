/* ─────────────────────────────────────────────────────────────────────────────
   GOOGLE SHEETS CSV SOURCES
   ─────────────────────────────────────────────────────────────────────────────

   HOW TO SET UP:
   1. Open your Google Sheets workbook (mexico_charts_master_replit_fetch_workbook)
   2. For each chart tab, go to: File → Share → Publish to web
   3. Select the tab name (e.g. "artists_weekly_mx")
   4. Choose format: "Comma-separated values (.csv)"
   5. Click "Publish" and copy the URL
   6. Paste that URL as the value below for the matching key
   7. Save this file — the site will start fetching real data immediately

   LEAVE A VALUE AS "" if that tab isn't published yet.
   The site will fall back to placeholder data for any empty URL.

   EXAMPLE URL FORMAT:
   "https://docs.google.com/spreadsheets/d/SHEET_ID/pub?gid=SHEET_GID&single=true&output=csv"
───────────────────────────────────────────────────────────────────────────── */

const MASTER_SHEET_ID = "1lnqsIqI3mi3eC7iD6H7QThS-tzZ4thyyHcYNfX3Vdts";
const gvizCSV = (sheet: string) =>
  `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheet}`;

export const SHEET_SOURCES = {
  // ── Spotify chart rankings (mexico_charts_master_replit_fetch_workbook) ──
  artistsWeekly: gvizCSV("artists_weekly_mx"),
  artistsDaily:  gvizCSV("artists_daily_mx"),
  songsWeekly:   gvizCSV("songs_weekly_mx"),
  songsDaily:    gvizCSV("songs_daily_mx"),
  albumsWeekly:  gvizCSV("albums_weekly_mx"),
  viralDaily:    gvizCSV("songs_viral_mx"),

  // ── Artist metadata / stats database (mexico_charts_artist_metadata_database) ──
  // Publish the "artist_metadata" tab as CSV and paste the URL below.
  // This is NOT a chart — it adds extra stats (social, streams, label, etc.)
  // to chart artists. Ranks always come from the Spotify chart tabs above.
  artistMetadata: "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active",
} as const;

export type SheetKey = keyof typeof SHEET_SOURCES;

/** Returns true when at least the weekly artists URL has been configured */
export function hasAnySource(): boolean {
  return Object.values(SHEET_SOURCES).some(url => url.trim() !== "");
}
