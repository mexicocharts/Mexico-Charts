import { Router } from "express";
import { db } from "@workspace/db";
import { spotifyArtistCandidates, spotifyArtists } from "@workspace/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const CLIENT_ID = () => process.env["SPOTIFY_CLIENT_ID"] ?? "";
const CLIENT_SECRET = () => process.env["SPOTIFY_CLIENT_SECRET"] ?? "";
const ADMIN_KEY = () => process.env["SPOTIFY_ADMIN_KEY"] ?? process.env["YOUTUBE_ADMIN_KEY"] ?? "";
const MAX_SPOTIFY_RETRIES = 3;

interface ArtistMetadataRow {
  artist_key: string;
  artist_name: string;
  spotify_followers?: string;
}

interface SpotifyArtistApi {
  id: string;
  name: string;
  uri?: string;
  popularity: number | null;
  followers?: { total?: number };
  external_urls?: { spotify?: string };
  images?: Array<{ url: string; height?: number; width?: number }>;
  genres?: string[];
}

interface SpotifySearchResponse {
  artists?: {
    items?: SpotifyArtistApi[];
  };
}

interface SpotifyArtistsResponse {
  artists?: Array<SpotifyArtistApi | null>;
}

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

function requireAdmin(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): boolean {
  const key = ADMIN_KEY();
  const header = req.headers["x-admin-key"];
  const qkey = req.query["adminKey"];
  if (!key || (header !== key && qkey !== key)) {
    res.status(403).json({ error: "Forbidden — provide X-Admin-Key header" });
    return false;
  }
  return true;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchArtistMetadataRows(): Promise<ArtistMetadataRow[]> {
  const PORT = process.env["PORT"] ?? "8080";
  const metaRes = await fetch(`http://localhost:${PORT}/api/artists/metadata`);
  if (!metaRes.ok) throw new Error(`metadata fetch failed: ${metaRes.status}`);
  const metaJson = await metaRes.json() as { artists?: ArtistMetadataRow[] };
  return metaJson.artists ?? [];
}

async function getSpotifyToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token;

  const clientId = CLIENT_ID();
  const clientSecret = CLIENT_SECRET();
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set");
  }

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json() as SpotifyTokenResponse;
  tokenCache = {
    token: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return json.access_token;
}

async function spotifyFetch<T>(path: string, params: Record<string, string> = {}, attempt = 0): Promise<T> {
  const token = await getSpotifyToken();
  const qs = new URLSearchParams(params);
  const url = `${API_BASE}${path}${qs.size ? `?${qs.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401 && attempt === 0) {
    tokenCache = null;
    return spotifyFetch<T>(path, params, attempt + 1);
  }

  if (res.status === 429 && attempt < MAX_SPOTIFY_RETRIES) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "1");
    const waitMs = Math.max(1, retryAfter) * 1000;
    logger.warn({ path, retryAfter, attempt }, "[spotify] rate limited, waiting before retry");
    await sleep(waitMs);
    return spotifyFetch<T>(path, params, attempt + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function compactName(value: string): string {
  return normalizeName(value).replace(/\s+/g, "");
}

function parseCount(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function imageUrl(artist: SpotifyArtistApi): string | null {
  return artist.images?.[0]?.url ?? null;
}

function spotifyUrl(artist: SpotifyArtistApi): string | null {
  return artist.external_urls?.spotify ?? null;
}

function spotifyRow(artistKey: string, artist: SpotifyArtistApi) {
  const hasStats = artist.followers?.total != null || artist.popularity != null || (artist.genres?.length ?? 0) > 0;
  return {
    artistKey,
    spotifyArtistId: artist.id,
    spotifyName: artist.name,
    spotifyFollowers: artist.followers?.total ?? null,
    spotifyPopularity: artist.popularity ?? null,
    spotifyUrl: spotifyUrl(artist),
    spotifyImageUrl: imageUrl(artist),
    spotifyUri: artist.uri ?? null,
    spotifyGenres: artist.genres ?? [],
    spotifyApiCapability: hasStats ? "identity_profile_with_legacy_stats" : "identity_profile_only",
    notes: hasStats ? null : "This Spotify app currently returns artist identity/profile fields only; followers, popularity, and genres are unavailable.",
    verified: true,
    verifiedAt: new Date(),
    spotifyLastUpdated: new Date(),
  };
}

function spotifyDbToResponse(row: typeof spotifyArtists.$inferSelect) {
  return {
    artistKey: row.artistKey,
    spotifyArtistId: row.spotifyArtistId,
    spotifyName: row.spotifyName,
    spotifyFollowers: row.spotifyFollowers,
    spotifyPopularity: row.spotifyPopularity,
    spotifyUrl: row.spotifyUrl,
    spotifyImageUrl: row.spotifyImageUrl,
    spotifyUri: row.spotifyUri,
    spotifyGenres: row.spotifyGenres,
    spotifyApiCapability: row.spotifyApiCapability,
    notes: row.notes,
    verified: row.verified,
    verifiedAt: row.verifiedAt.toISOString(),
    spotifyLastUpdated: row.spotifyLastUpdated.toISOString(),
    linkedAt: row.linkedAt.toISOString(),
  };
}

function scoreCandidate(artist: ArtistMetadataRow, candidate: SpotifyArtistApi) {
  const artistName = normalizeName(artist.artist_name);
  const spotifyName = normalizeName(candidate.name);
  const followers = candidate.followers?.total ?? null;
  const sheetFollowers = parseCount(artist.spotify_followers);
  const reasons: string[] = [];
  let score = 0;

  if (spotifyName === artistName) {
    score += 45;
    reasons.push("name exact");
  } else if (compactName(candidate.name) === compactName(artist.artist_name)) {
    score += 38;
    reasons.push("compact name match");
  } else if (spotifyName.includes(artistName) || artistName.includes(spotifyName)) {
    score += 25;
    reasons.push("name contains");
  } else {
    const artistTokens = new Set(artistName.split(" ").filter(Boolean));
    const candidateTokens = new Set(spotifyName.split(" ").filter(Boolean));
    const overlap = [...artistTokens].filter(token => candidateTokens.has(token)).length;
    const ratio = artistTokens.size > 0 ? overlap / artistTokens.size : 0;
    if (ratio >= 0.75) {
      score += 18;
      reasons.push("strong token overlap");
    } else if (ratio >= 0.5) {
      score += 8;
      reasons.push("partial token overlap");
    }
  }

  if (sheetFollowers != null && followers != null && sheetFollowers > 0) {
    const ratio = followers / sheetFollowers;
    if (ratio >= 0.5 && ratio <= 2) {
      score += 35;
      reasons.push("followers close");
    } else if (ratio >= 0.25 && ratio <= 4) {
      score += 22;
      reasons.push("followers reasonable");
    } else if (ratio >= 0.1 && ratio <= 10) {
      score += 8;
      reasons.push("followers loose");
    } else {
      score -= 25;
      reasons.push("followers mismatch");
    }
  } else if ((followers ?? 0) >= 100_000) {
    score += 8;
    reasons.push("substantial followers");
  }

  if ((candidate.popularity ?? 0) >= 40) {
    score += 10;
    reasons.push("strong popularity");
  } else if ((candidate.popularity ?? 0) >= 20) {
    score += 4;
    reasons.push("some popularity");
  }

  return {
    spotifyArtistId: candidate.id,
    spotifyName: candidate.name,
    score: Math.max(0, Math.min(score, 100)),
    followers,
    popularity: candidate.popularity,
    spotifyUrl: spotifyUrl(candidate),
    imageUrl: imageUrl(candidate),
    genres: candidate.genres ?? [],
    reasons,
  };
}

async function fetchArtistsByIds(ids: string[]): Promise<SpotifyArtistApi[]> {
  const artists: SpotifyArtistApi[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    try {
      const data = await spotifyFetch<SpotifyArtistsResponse>("/artists", { ids: batch.join(",") });
      artists.push(...(data.artists ?? []).filter((artist): artist is SpotifyArtistApi => Boolean(artist)));
    } catch (err) {
      if (!(err as Error).message.includes("Spotify API 403")) throw err;
      logger.warn({ batchSize: batch.length }, "[spotify] batch artists endpoint forbidden, falling back to single artist lookup");
      for (const id of batch) {
        const artist = await spotifyFetch<SpotifyArtistApi>(`/artists/${id}`);
        artists.push(artist);
        await sleep(75);
      }
    }
  }
  return artists;
}

// PUBLIC: GET /api/providers/spotify/artist?artistKey=peso+pluma
router.get("/providers/spotify/artist", async (req, res) => {
  const artistKey = (req.query["artistKey"] as string | undefined)?.trim().toLowerCase();
  if (!artistKey) { res.status(400).json({ error: "artistKey is required" }); return; }

  const [row] = await db.select().from(spotifyArtists).where(eq(spotifyArtists.artistKey, artistKey));
  if (!row) { res.status(404).json({ error: "No verified Spotify artist linked for this artist" }); return; }

  res.json(spotifyDbToResponse(row));
});

// ADMIN: GET /api/admin/spotify/artists
router.get("/admin/spotify/artists", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.select().from(spotifyArtists).orderBy(asc(spotifyArtists.artistKey));
  res.json({ artists: rows.map(spotifyDbToResponse) });
});

// ADMIN: GET /api/admin/spotify/candidates
router.get("/admin/spotify/candidates", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await db.select().from(spotifyArtistCandidates).orderBy(asc(spotifyArtistCandidates.searchedAt));
  res.json({ candidates: rows });
});

// ADMIN: GET /api/admin/spotify/coverage
router.get("/admin/spotify/coverage", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [artists, linkedRows, candidateRows] = await Promise.all([
      fetchArtistMetadataRows(),
      db.select().from(spotifyArtists),
      db.select().from(spotifyArtistCandidates),
    ]);
    const linkedKeys = new Set(linkedRows.map(row => row.artistKey));
    const missing = artists.filter(artist => artist.artist_key && !linkedKeys.has(artist.artist_key));
    res.json({
      totalArtists: artists.length,
      verifiedSpotifyArtists: linkedRows.length,
      missingSpotifyArtists: missing.length,
      candidateRows: candidateRows.length,
      coveragePct: artists.length > 0 ? Number(((linkedRows.length / artists.length) * 100).toFixed(1)) : 0,
      missingPreview: missing.slice(0, 25).map(artist => ({
        artistKey: artist.artist_key,
        artistName: artist.artist_name,
        hasSheetFollowers: Boolean(artist.spotify_followers?.trim()),
      })),
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "[spotify:coverage] failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ADMIN: POST /api/admin/spotify/link/artist
// Body: { artistKey: string, spotifyArtistId: string, force?: boolean }
router.post("/admin/spotify/link/artist", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { artistKey, spotifyArtistId, force } = req.body as { artistKey?: string; spotifyArtistId?: string; force?: boolean };
  if (!artistKey?.trim() || !spotifyArtistId?.trim()) {
    res.status(400).json({ error: "artistKey and spotifyArtistId are required" });
    return;
  }

  const key = artistKey.trim().toLowerCase();
  const id = spotifyArtistId.trim();
  const [existing] = await db.select().from(spotifyArtists).where(eq(spotifyArtists.artistKey, key));
  if (existing?.verified && existing.spotifyArtistId !== id && !force) {
    res.status(409).json({
      error: "Verified Spotify artist ID already exists. Pass force=true to replace it manually.",
      existing: spotifyDbToResponse(existing),
    });
    return;
  }

  try {
    const [artist] = await fetchArtistsByIds([id]);
    if (!artist) { res.status(404).json({ error: "Spotify artist not found" }); return; }
    const row = spotifyRow(key, artist);
    await db.insert(spotifyArtists).values(row).onConflictDoUpdate({
      target: spotifyArtists.artistKey,
      set: force ? row : {
        spotifyName: row.spotifyName,
        spotifyFollowers: row.spotifyFollowers,
        spotifyPopularity: row.spotifyPopularity,
        spotifyUrl: row.spotifyUrl,
        spotifyImageUrl: row.spotifyImageUrl,
        spotifyGenres: row.spotifyGenres,
        spotifyUri: row.spotifyUri,
        spotifyApiCapability: row.spotifyApiCapability,
        notes: row.notes,
        spotifyLastUpdated: row.spotifyLastUpdated,
      },
    });
    await db.delete(spotifyArtistCandidates).where(eq(spotifyArtistCandidates.artistKey, key));
    const [saved] = await db.select().from(spotifyArtists).where(eq(spotifyArtists.artistKey, key));
    res.json(spotifyDbToResponse(saved!));
  } catch (err) {
    logger.error({ err: (err as Error).message, artistKey: key, spotifyArtistId: id }, "[spotify] link artist failed");
    res.status(502).json({ error: (err as Error).message });
  }
});

// ADMIN: POST /api/admin/spotify/refresh-artists?limit=200&dryRun=false
router.post("/admin/spotify/refresh-artists", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "200", 10), 500);
  const dryRun = (req.query["dryRun"] as string) === "true";

  try {
    const rows = (await db.select().from(spotifyArtists).orderBy(asc(spotifyArtists.spotifyLastUpdated))).slice(0, limit);
    if (dryRun) {
      res.json({
        totalLinked: rows.length,
        wouldRefresh: rows.length,
        batches: Math.ceil(rows.length / 50),
        preview: rows.slice(0, 25).map(row => ({
          artistKey: row.artistKey,
          spotifyArtistId: row.spotifyArtistId,
          spotifyName: row.spotifyName,
          spotifyLastUpdated: row.spotifyLastUpdated.toISOString(),
        })),
      });
      return;
    }

    const byId = new Map(rows.map(row => [row.spotifyArtistId, row]));
    const fetched = await fetchArtistsByIds(rows.map(row => row.spotifyArtistId));
    const results: Array<{ artistKey: string; spotifyArtistId: string; status: string; spotifyName?: string; error?: string }> = [];

    for (const artist of fetched) {
      const existing = byId.get(artist.id);
      if (!existing) continue;
      const row = spotifyRow(existing.artistKey, artist);
      await db.update(spotifyArtists).set({
        spotifyName: row.spotifyName,
        spotifyFollowers: row.spotifyFollowers,
        spotifyPopularity: row.spotifyPopularity,
        spotifyUrl: row.spotifyUrl,
        spotifyImageUrl: row.spotifyImageUrl,
        spotifyGenres: row.spotifyGenres,
        spotifyUri: row.spotifyUri,
        spotifyApiCapability: row.spotifyApiCapability,
        notes: row.notes,
        spotifyLastUpdated: row.spotifyLastUpdated,
      }).where(eq(spotifyArtists.artistKey, existing.artistKey));
      results.push({ artistKey: existing.artistKey, spotifyArtistId: artist.id, status: "refreshed", spotifyName: artist.name });
    }

    res.json({
      processed: rows.length,
      refreshed: results.length,
      batches: Math.ceil(rows.length / 50),
      results,
    });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "[spotify:refresh-artists] failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ADMIN: POST /api/admin/spotify/find-candidates?limit=25&minAutoScore=90&dryRun=false
// Searches only missing artists, stores review candidates, and never overwrites
// verified Spotify IDs automatically.
router.post("/admin/spotify/find-candidates", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "25", 10), 50);
  const minAutoScore = Math.max(0, Math.min(parseInt((req.query["minAutoScore"] as string) ?? "90", 10), 100));
  const dryRun = (req.query["dryRun"] as string) === "true";

  try {
    const [artists, linkedRows] = await Promise.all([
      fetchArtistMetadataRows(),
      db.select().from(spotifyArtists),
    ]);
    const linkedKeys = new Set(linkedRows.map(row => row.artistKey));
    const queue = artists.filter(artist => artist.artist_key && !linkedKeys.has(artist.artist_key)).slice(0, limit);

    const results: Array<{ artistKey: string; artistName: string; status: string; bestScore?: number; spotifyArtistId?: string; spotifyName?: string; reasons?: string[] }> = [];

    for (const artist of queue) {
      const data = await spotifyFetch<SpotifySearchResponse>("/search", {
        type: "artist",
        q: artist.artist_name,
        limit: "5",
      });
      const ids = [...new Set((data.artists?.items ?? []).map(item => item.id).filter(Boolean))];
      const fullArtists = await fetchArtistsByIds(ids);
      const candidates = fullArtists
        .map(candidate => scoreCandidate(artist, candidate))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];

      if (!dryRun) {
        await db.insert(spotifyArtistCandidates).values({
          artistKey: artist.artist_key,
          artistName: artist.artist_name,
          candidates,
          bestScore: best?.score ?? 0,
          status: best && best.score >= minAutoScore ? "auto_ready" : "review",
          searchedAt: new Date(),
        }).onConflictDoUpdate({
          target: spotifyArtistCandidates.artistKey,
          set: {
            artistName: artist.artist_name,
            candidates,
            bestScore: best?.score ?? 0,
            status: best && best.score >= minAutoScore ? "auto_ready" : "review",
            searchedAt: new Date(),
          },
        });
      }

      if (best && best.score >= minAutoScore && !dryRun) {
        const [fullArtist] = await fetchArtistsByIds([best.spotifyArtistId]);
        if (fullArtist) {
          await db.insert(spotifyArtists).values(spotifyRow(artist.artist_key, fullArtist)).onConflictDoNothing();
          await db.delete(spotifyArtistCandidates).where(eq(spotifyArtistCandidates.artistKey, artist.artist_key));
        }
      }

      results.push({
        artistKey: artist.artist_key,
        artistName: artist.artist_name,
        status: best ? (best.score >= minAutoScore ? (dryRun ? "auto_ready" : "auto_saved") : "review") : "no_result",
        bestScore: best?.score ?? 0,
        spotifyArtistId: best?.spotifyArtistId,
        spotifyName: best?.spotifyName,
        reasons: best?.reasons,
      });

      await sleep(125);
    }

    const [count] = await db.select().from(spotifyArtists);
    res.json({ processed: queue.length, results, sampleLinkedRow: count ? spotifyDbToResponse(count) : null });
  } catch (err) {
    logger.error({ err: (err as Error).message }, "[spotify:find-candidates] failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ADMIN: DELETE /api/admin/spotify/link/artist/:artistKey
router.delete("/admin/spotify/link/artist/:artistKey", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const key = req.params["artistKey"]?.toLowerCase();
  if (!key) { res.status(400).json({ error: "artistKey is required" }); return; }
  await db.delete(spotifyArtists).where(eq(spotifyArtists.artistKey, key));
  res.json({ ok: true });
});

// Keep inArray imported for route bundles that tree-shake less aggressively.
void inArray;

export default router;
