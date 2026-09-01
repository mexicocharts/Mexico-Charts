import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg");

const ARTIST_METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);
  return rows.filter(cells => cells.some(cell => cell.trim()));
}

async function loadActiveArtists() {
  const response = await fetch(ARTIST_METADATA_URL);
  if (!response.ok) throw new Error(`artist metadata HTTP ${response.status}`);
  const rows = parseCsv(await response.text());
  const headers = rows[0].map(header => header.trim());
  const keyIdx = headers.indexOf("artist_key");
  const nameIdx = headers.indexOf("artist_name");
  if (keyIdx < 0 || nameIdx < 0) throw new Error("artist_key or artist_name column missing");
  return rows
    .slice(1)
    .map(row => ({ artist_key: row[keyIdx]?.trim(), artist_name: row[nameIdx]?.trim() }))
    .filter(artist => artist.artist_key && artist.artist_name);
}

async function main() {
  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  try {
    const active = await loadActiveArtists();
    const linkedRows = await pool.query("SELECT artist_key FROM spotify_artists");
    const candidateRows = await pool.query(`
      SELECT artist_key, artist_name, best_score, status
      FROM spotify_artist_candidates
      ORDER BY best_score DESC, artist_name
    `);

    const linked = new Set(linkedRows.rows.map(row => row.artist_key));
    const candidateKeys = new Set(candidateRows.rows.map(row => row.artist_key));
    const notLinked = active.filter(artist => !linked.has(artist.artist_key));
    const neverSearched = active.filter(artist => !linked.has(artist.artist_key) && !candidateKeys.has(artist.artist_key));
    const bySlug = new Map(active.map(artist => [artist.artist_key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(), artist]));
    const kworbRows = await pool.query(`
      SELECT artist_key, artist_name, spotify_id
      FROM kworb_coverage
      WHERE spotify_id IS NOT NULL
      ORDER BY artist_name
    `);
    const unlinkedWithKworbSpotifyId = kworbRows.rows
      .map(row => ({ ...row, sheet_artist: bySlug.get(row.artist_key) }))
      .filter(row => row.sheet_artist && !linked.has(row.sheet_artist.artist_key))
      .map(row => ({
        artist_key: row.sheet_artist.artist_key,
        artist_name: row.sheet_artist.artist_name,
        kworb_artist_key: row.artist_key,
        spotify_id: row.spotify_id,
      }));

    console.log(JSON.stringify({
      active: active.length,
      linked: linked.size,
      candidateRows: candidateRows.rows.length,
      notLinkedTotal: notLinked.length,
      neverSearched: neverSearched.length,
      unlinkedWithKworbSpotifyId: unlinkedWithKworbSpotifyId.length,
      sampleUnlinkedWithKworbSpotifyId: unlinkedWithKworbSpotifyId.slice(0, 25),
      topReview: candidateRows.rows.slice(0, 15),
      sampleNeverSearched: neverSearched.slice(0, 25),
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
