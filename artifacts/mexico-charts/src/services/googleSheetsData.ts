/* ─────────────────────────────────────────────────────────────────────────────
   GOOGLE SHEETS CSV FETCH SERVICE
   Fetches and parses a published Google Sheets CSV URL using PapaParse.
   - Skips the fetch and returns [] when url is empty (not yet configured)
   - Handles network errors gracefully (returns [] and logs to console)
   - Strips BOM and trims whitespace from headers automatically
   To replace this with a real API later, only this file changes.
───────────────────────────────────────────────────────────────────────────── */

import Papa from "papaparse";

export interface ParseResult<T> {
  rows: T[];
  configured: boolean; // false when URL was empty / not set up yet
  error: string | null;
}

/** Fetches a Google Sheets published CSV and returns typed rows. */
export async function fetchSheetCSV<T extends Record<string, string | undefined>>(
  url: string
): Promise<ParseResult<T>> {
  if (!url || url.trim() === "") {
    return { rows: [], configured: false, error: null };
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const csvText = await response.text();

    return new Promise<ParseResult<T>>((resolve) => {
      Papa.parse<T>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) =>
          h
            .trim()
            .replace(/^\uFEFF/, "") // strip BOM from first header
            .replace(/\r/g, ""),
        transform: (value) => value?.trim() ?? "",
        complete: (results) => {
          resolve({ rows: results.data, configured: true, error: null });
        },
        error: (err: Error) => {
          console.error("[Mexico Charts] CSV parse error:", err.message);
          resolve({ rows: [], configured: true, error: err.message });
        },
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Mexico Charts] CSV fetch error:", message);
    return { rows: [], configured: true, error: message };
  }
}
