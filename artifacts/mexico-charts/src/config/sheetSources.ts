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

export const SHEET_SOURCES = {
  artistsWeekly: "", // artists_weekly_mx tab  ← paste CSV URL here
  artistsDaily:  "", // artists_daily_mx tab   ← paste CSV URL here
  songsWeekly:   "", // songs_weekly_mx tab    ← paste CSV URL here
  songsDaily:    "", // songs_daily_mx tab     ← paste CSV URL here
  albumsWeekly:  "", // albums_weekly_mx tab   ← paste CSV URL here
  viralDaily:    "", // songs_viral_mx tab     ← paste CSV URL here
} as const;

export type SheetKey = keyof typeof SHEET_SOURCES;

/** Returns true when at least the weekly artists URL has been configured */
export function hasAnySource(): boolean {
  return Object.values(SHEET_SOURCES).some(url => url.trim() !== "");
}
