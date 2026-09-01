import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg");

function parseArgs() {
  const args = new Map(process.argv.slice(2).map(arg => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }));
  return {
    write: args.get("write") === "true",
  };
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function compactName(value) {
  return normalizeName(value).replace(/\s+/g, "");
}

function isExactCandidate(row, candidate) {
  if (!candidate) return false;
  return (
    normalizeName(row.artist_name) === normalizeName(candidate.spotifyName) ||
    compactName(row.artist_name) === compactName(candidate.spotifyName)
  );
}

async function saveArtist(pool, row, candidate) {
  const hasStats = candidate.followers != null || candidate.popularity != null || (candidate.genres?.length ?? 0) > 0;
  await pool.query(`
    INSERT INTO spotify_artists (
      artist_key, spotify_artist_id, spotify_name, spotify_followers,
      spotify_popularity, spotify_url, spotify_image_url, spotify_uri,
      spotify_genres, spotify_api_capability, notes,
      verified, verified_at, spotify_last_updated, linked_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,true,now(),now(),now())
    ON CONFLICT (artist_key) DO UPDATE SET
      spotify_artist_id = EXCLUDED.spotify_artist_id,
      spotify_name = EXCLUDED.spotify_name,
      spotify_followers = EXCLUDED.spotify_followers,
      spotify_popularity = EXCLUDED.spotify_popularity,
      spotify_url = EXCLUDED.spotify_url,
      spotify_image_url = EXCLUDED.spotify_image_url,
      spotify_uri = EXCLUDED.spotify_uri,
      spotify_genres = EXCLUDED.spotify_genres,
      spotify_api_capability = EXCLUDED.spotify_api_capability,
      notes = EXCLUDED.notes,
      verified = true,
      verified_at = now(),
      spotify_last_updated = now()
  `, [
    row.artist_key,
    candidate.spotifyArtistId,
    candidate.spotifyName,
    candidate.followers,
    candidate.popularity,
    candidate.spotifyUrl,
    candidate.imageUrl,
    candidate.uri ?? null,
    JSON.stringify(candidate.genres ?? []),
    hasStats ? "identity_profile_with_legacy_stats" : "identity_profile_only",
    hasStats ? null : "This Spotify app currently returns artist identity/profile fields only; followers, popularity, and genres are unavailable.",
  ]);
  await pool.query("DELETE FROM spotify_artist_candidates WHERE artist_key = $1", [row.artist_key]);
}

async function main() {
  const { write } = parseArgs();
  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  try {
    const { rows } = await pool.query(`
      SELECT artist_key, artist_name, candidates
      FROM spotify_artist_candidates
      ORDER BY artist_name
    `);
    const existingIds = new Set((await pool.query("SELECT spotify_artist_id FROM spotify_artists")).rows.map(row => row.spotify_artist_id));
    let promoted = 0;
    let duplicate = 0;
    let held = 0;
    for (const row of rows) {
      const candidate = row.candidates?.[0];
      if (!isExactCandidate(row, candidate)) {
        held += 1;
        continue;
      }
      if (existingIds.has(candidate.spotifyArtistId)) {
        duplicate += 1;
        console.log(`DUPLICATE,${row.artist_key},${row.artist_name},${candidate.spotifyArtistId},${candidate.spotifyName}`);
        continue;
      }
      console.log(`${write ? "SAVE" : "PROMOTE"},${row.artist_key},${row.artist_name},${candidate.spotifyArtistId},${candidate.spotifyName}`);
      if (write) {
        await saveArtist(pool, row, candidate);
        existingIds.add(candidate.spotifyArtistId);
      }
      promoted += 1;
    }
    const linked = await pool.query("SELECT COUNT(*)::int AS count FROM spotify_artists");
    const candidates = await pool.query("SELECT COUNT(*)::int AS count FROM spotify_artist_candidates");
    console.log(`Done. promoted=${promoted} duplicate=${duplicate} held=${held} db_spotify_artists=${linked.rows[0].count} candidate_rows=${candidates.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
