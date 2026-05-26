import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg");

const ARTIST_METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

function parseArgs() {
  const args = new Map(process.argv.slice(2).map(arg => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }));
  return {
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 100), 500)),
    write: args.get("write") === "true",
  };
}

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

function toSlug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
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
    .map(row => ({
      artist_key: row[keyIdx]?.trim(),
      artist_name: row[nameIdx]?.trim(),
    }))
    .filter(artist => artist.artist_key && artist.artist_name);
}

async function spotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!response.ok) throw new Error(`Spotify token ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const json = await response.json();
  return json.access_token;
}

async function fetchSpotifyArtists(ids) {
  const token = await spotifyToken();
  const artists = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const response = await fetch(`${API_BASE}/artists?ids=${batch.join(",")}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Spotify artists ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const json = await response.json();
    artists.push(...(json.artists ?? []).filter(Boolean));
  }
  return artists;
}

function imageUrl(artist) {
  return artist.images?.[0]?.url ?? null;
}

function spotifyUrl(artist) {
  return artist.external_urls?.spotify ?? null;
}

async function saveArtist(pool, artist, spotify) {
  const hasStats = spotify.followers?.total != null || spotify.popularity != null || (spotify.genres?.length ?? 0) > 0;
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
    artist.artist_key,
    spotify.id,
    spotify.name,
    spotify.followers?.total ?? null,
    spotify.popularity ?? null,
    spotifyUrl(spotify),
    imageUrl(spotify),
    spotify.uri ?? null,
    JSON.stringify(spotify.genres ?? []),
    hasStats ? "identity_profile_with_legacy_stats" : "identity_profile_only",
    hasStats ? null : "This Spotify app currently returns artist identity/profile fields only; followers, popularity, and genres are unavailable.",
  ]);
  await pool.query("DELETE FROM spotify_artist_candidates WHERE artist_key = $1", [artist.artist_key]);
}

async function main() {
  const { limit, write } = parseArgs();
  if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const active = await loadActiveArtists();
    const activeBySlug = new Map(active.map(artist => [toSlug(artist.artist_key), artist]));
    const linkedRows = await pool.query("SELECT artist_key, spotify_artist_id FROM spotify_artists");
    const linkedKeys = new Set(linkedRows.rows.map(row => row.artist_key));
    const linkedSpotifyIds = new Set(linkedRows.rows.map(row => row.spotify_artist_id));
    const kworbRows = await pool.query(`
      SELECT artist_key, artist_name, spotify_id
      FROM kworb_coverage
      WHERE spotify_id IS NOT NULL
      ORDER BY artist_name
    `);

    const queue = [];
    const seenSpotifyIds = new Set();
    for (const row of kworbRows.rows) {
      const artist = activeBySlug.get(row.artist_key);
      if (!artist) continue;
      if (linkedKeys.has(artist.artist_key)) continue;
      if (linkedSpotifyIds.has(row.spotify_id)) continue;
      if (seenSpotifyIds.has(row.spotify_id)) continue;
      seenSpotifyIds.add(row.spotify_id);
      queue.push({ artist, spotify_id: row.spotify_id });
    }

    const selected = queue.slice(0, limit);
    console.log(`${write ? "Writing" : "Dry run"} Spotify links from Kworb IDs. queue=${queue.length} selected=${selected.length}`);
    if (selected.length === 0) return;

    const spotifyArtists = await fetchSpotifyArtists(selected.map(item => item.spotify_id));
    const spotifyById = new Map(spotifyArtists.map(artist => [artist.id, artist]));
    let saved = 0;
    let missing = 0;
    for (const item of selected) {
      const spotify = spotifyById.get(item.spotify_id);
      if (!spotify) {
        missing += 1;
        console.log(`MISSING,${item.artist.artist_key},${item.artist.artist_name},${item.spotify_id}`);
        continue;
      }
      console.log(`${write ? "SAVE" : "LINK"},${item.artist.artist_key},${item.artist.artist_name},${spotify.id},${spotify.name},followers=${spotify.followers?.total ?? ""},popularity=${spotify.popularity ?? ""}`);
      if (write) {
        await saveArtist(pool, item.artist, spotify);
        saved += 1;
      }
    }
    const linkedAfter = await pool.query("SELECT COUNT(*)::int AS count FROM spotify_artists");
    console.log(`Done. saved=${saved} missing=${missing} db_spotify_artists=${linkedAfter.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
