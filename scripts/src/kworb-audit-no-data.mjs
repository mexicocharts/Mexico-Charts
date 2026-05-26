import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg");

const STOP_TOKENS = new Set([
  "banda", "grupo", "los", "las", "del", "de", "el", "la", "y", "su", "sus",
  "the", "and",
]);

const REJECTED_SPOTIFY_ALIASES = new Set([
  "adanchalinosanchez:chalinosanchez",
]);

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function tokens(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_TOKENS.has(token));
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").trim();
}

function parseCommaNum(value) {
  return parseInt(String(value).replace(/,/g, "").trim(), 10) || 0;
}

function parseSpotifyPage(html) {
  let totalStreams = 0;
  let dailyStreams = 0;
  for (const rowMatch of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(match => stripTags(match[1]));
    if (cells[0] === "Streams") totalStreams = parseCommaNum(cells[1]);
    if (cells[0] === "Daily") dailyStreams = parseCommaNum(cells[1]);
  }
  if (!totalStreams) return null;
  return { totalStreams, dailyStreams };
}

function parseYouTubePage(html) {
  let totalViews = 0;
  let dailyAvg = 0;
  for (const rowMatch of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(match => stripTags(match[1]));
    if (cells[0] === "Total views:") totalViews = parseCommaNum(cells[1]);
    if (cells[0] === "Current daily avg:") dailyAvg = parseCommaNum(cells[1]);
  }
  if (!totalViews) return null;
  return { totalViews, dailyAvg };
}

function parseItunesPage(html) {
  return /#\d+\s*Mexico/.test(stripTags(html));
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return response.text();
}

async function loadSpotifyIndex() {
  const html = await fetchPage("https://kworb.net/spotify/artists.html");
  const index = [];
  if (!html) return index;
  const re = /href="\/spotify\/artist\/([A-Za-z0-9]{22})_songs\.html"[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    const name = match[2].trim();
    const slug = toSlug(name);
    if (slug.length < 5) continue;
    index.push({ id: match[1], name, slug, tokens: tokens(name) });
  }
  return index;
}

function spotifyScore(artist, candidate) {
  const artistTokens = tokens(artist.artist_name);
  const common = artistTokens.filter(token => candidate.tokens.includes(token));
  if (common.length < 2 && artist.artist_key !== candidate.slug) return 0;
  const tokenScore = common.length / Math.max(1, Math.min(artistTokens.length, candidate.tokens.length));
  let slugScore = 0;
  if (artist.artist_key === candidate.slug) slugScore = 1;
  else if (
    artist.artist_key.length > 8 &&
    candidate.slug.length > 8 &&
    (artist.artist_key.includes(candidate.slug) || candidate.slug.includes(artist.artist_key))
  ) slugScore = 0.82;
  return Math.max(tokenScore, slugScore);
}

function slugVariants(artistName) {
  const rawTokens = artistName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const variants = new Set([toSlug(artistName)]);
  variants.add(toSlug(rawTokens.filter(token => !["banda", "grupo"].includes(token)).join(" ")));
  variants.add(toSlug(rawTokens.filter(token => !["banda", "grupo", "de", "del", "la", "el", "los", "las", "y", "su", "sus"].includes(token)).join(" ")));
  if (rawTokens.length > 2) variants.add(toSlug(rawTokens.slice(0, 2).join(" ")));
  if (rawTokens.length > 3) variants.add(toSlug(rawTokens.slice(0, 3).join(" ")));
  return [...variants].filter(slug => slug.length >= 5);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows: artists } = await pool.query(`
    SELECT artist_key, artist_name
    FROM kworb_coverage
    WHERE NOT has_spotify AND NOT has_youtube AND NOT has_itunes
    ORDER BY artist_name
  `);
  await pool.end();

  const spotifyIndex = await loadSpotifyIndex();
  const spotifyMatches = [];
  const directMatches = [];
  const suspicious = [];
  const rejected = [];

  for (const artist of artists) {
    const candidates = spotifyIndex
      .map(candidate => ({ ...candidate, score: spotifyScore(artist, candidate) }))
      .filter(candidate => candidate.score >= 0.82)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    for (const candidate of candidates) {
      const html = await fetchPage(`https://kworb.net/spotify/artist/${candidate.id}_songs.html`);
      const data = html ? parseSpotifyPage(html) : null;
      if (!data) continue;
      if (REJECTED_SPOTIFY_ALIASES.has(`${artist.artist_key}:${candidate.slug}`)) {
        rejected.push({ artist, candidate, data });
        continue;
      }
      if (
        candidate.score === 1 ||
        candidate.slug.includes(artist.artist_key) ||
        artist.artist_key.includes(candidate.slug)
      ) {
        spotifyMatches.push({ artist, candidate, data });
      } else {
        suspicious.push({ artist, candidate, data });
      }
    }

    for (const slug of slugVariants(artist.artist_name)) {
      const [youtubeHtml, itunesHtml] = await Promise.all([
        fetchPage(`https://kworb.net/youtube/artist/${slug}.html`),
        fetchPage(`https://kworb.net/itunes/artist/${slug}.html`),
      ]);
      const youtube = youtubeHtml ? parseYouTubePage(youtubeHtml) : null;
      const itunes = itunesHtml ? parseItunesPage(itunesHtml) : null;
      if (youtube || itunes) directMatches.push({ artist, slug, youtube, itunes });
    }
  }

  console.log(JSON.stringify({
    checked: artists.length,
    spotifyMatches,
    directMatches,
    suspicious,
    rejected,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
