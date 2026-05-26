import { Router } from "express";
import { db } from "@workspace/db";
import {
  deezerTrackCovers,
  musicbrainzArtistCandidates,
  musicbrainzArtists,
  spotifyArtistCandidates,
  spotifyArtists,
  youtubeChannels,
} from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";

const BLOCKED_ARTIST_KEYS = new Set([
  "jesse", "banda toro", "jonathan caro", "baektowo", "jose mejia",
  "el frizian", "los 2 primos", "el gerry oficial", "lupe borbon y su blindaje 7",
  "juanchito", "meloleon", "badguychapo",
]);

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const ADMIN_KEY = () => (
  process.env["NEWSLETTER_ADMIN_KEY"] ||
  process.env["YOUTUBE_ADMIN_KEY"] ||
  process.env["SPOTIFY_ADMIN_KEY"] ||
  ""
).trim();

/* ── Subgenre fallback (mirrors web artistMetadata.ts SUBGENRE_BY_KEY) ────────
   Applied when the sheet's subgenre column is blank.
   Sheet value always wins — this is only a fallback.
───────────────────────────────────────────────────────────────────────────── */
const SUBGENRE_BY_KEY: Record<string, string> = {
  /* Corridos Tumbados */
  "fuerza regida":                          "corridos tumbados",
  "peso pluma":                             "corridos tumbados",
  "junior h":                               "corridos tumbados",
  "neton vega":                             "corridos tumbados",
  "tito double p":                          "corridos tumbados",
  "el bogueto":                             "corridos tumbados",
  "oscar maydon":                           "corridos tumbados",
  "natanael cano":                          "corridos tumbados",
  "luis r conriquez":                       "corridos tumbados",
  "gabito ballesteros":                     "corridos tumbados",
  "calle 24":                               "corridos tumbados",
  "chino pacas":                            "corridos tumbados",
  "chuyin":                                 "corridos tumbados",
  "virlan garcia":                          "corridos tumbados",
  "gael valenzuela":                        "corridos tumbados",
  "emmanuellcortess":                       "corridos tumbados",
  "jasiel nunez":                           "corridos tumbados",
  "jorsshh":                                "corridos tumbados",
  "lencho":                                 "corridos tumbados",
  "los dos de tamaulipas":                  "corridos tumbados",
  "jr torres":                              "corridos tumbados",
  "ian cordova":                            "corridos tumbados",
  "el fantasma":                            "corridos tumbados",
  "estevan plazola":                        "corridos tumbados",
  "panter belico":                          "corridos tumbados",
  "el de las r s":                          "corridos tumbados",
  "gerardo coronel":                        "corridos tumbados",
  "esau ortiz":                             "corridos tumbados",
  "kane rodriguez":                         "corridos tumbados",
  "codiciado":                              "corridos tumbados",
  "los alegres del barranco":               "corridos tumbados",
  "dannylux":                               "corridos tumbados",
  "codigo fn":                              "corridos tumbados",
  "moy bobadilla":                          "corridos tumbados",
  "los dos carnales":                       "corridos tumbados",
  "grupo arriesgado":                       "corridos tumbados",

  /* Regional Mexicano */
  "grupo frontera":                         "regional mexicano",
  "carin leon":                             "regional mexicano",
  "christian nodal":                        "regional mexicano",
  "xavi":                                   "regional mexicano",
  "grupo firme":                            "regional mexicano",
  "victor mendivil":                        "regional mexicano",
  "grupo marca registrada":                 "regional mexicano",
  "alejandro fernandez":                    "regional mexicano",
  "lenin ramirez":                          "regional mexicano",
  "joan sebastian":                         "regional mexicano",
  "eslabon armado":                         "regional mexicano",
  "eden munoz":                             "regional mexicano",
  "los dareyes de la sierra":               "regional mexicano",
  "alfredo olivas":                         "regional mexicano",
  "vicente fernandez":                      "regional mexicano",
  "herencia de grandes":                    "regional mexicano",
  "omar camacho":                           "regional mexicano",
  "edgardo nunez":                          "regional mexicano",
  "juan gabriel":                           "regional mexicano",
  "clave especial":                         "regional mexicano",
  "los angeles azules":                     "regional mexicano",
  "gerardo ortiz":                          "regional mexicano",
  "yahritza y su esencia":                  "regional mexicano",
  "la adictiva":                            "regional mexicano",
  "los plebes del rancho de ariel camacho": "regional mexicano",
  "los bukis":                              "regional mexicano",
  "espinoza paz":                           "regional mexicano",
  "pepe aguilar":                           "regional mexicano",
  "ariel camacho y los plebes del rancho":  "regional mexicano",
  "ivan cornejo":                           "regional mexicano",
  "los temrarios":                          "regional mexicano",
  "bronco":                                 "regional mexicano",
  "el chapo de sinaloa":                    "regional mexicano",
  "edicion especial":                       "regional mexicano",
  "jr":                                     "regional mexicano",
  "grupo mojado":                           "regional mexicano",
  "valentin elizalde":                      "regional mexicano",
  "el komander":                            "regional mexicano",
  "sergio vega el shaka":                   "regional mexicano",
  "t3r elemento":                           "regional mexicano",
  "angela aguilar":                         "regional mexicano",
  "grupo canaveral":                        "regional mexicano",
  "chalino sanchez":                        "regional mexicano",
  "pancho barraza":                         "regional mexicano",
  "los angeles de charly":                  "regional mexicano",
  "el bebeto":                              "regional mexicano",
  "luis mexia":                             "regional mexicano",
  "grupo bryndis":                          "regional mexicano",
  "los gemelos de sinaloa":                 "regional mexicano",
  "regulo molina":                          "regional mexicano",
  "edwin luna y la trakalosa de monterrey": "regional mexicano",
  "ana gabriel":                            "regional mexicano",

  /* Norteño */
  "julion alvarez and su norteno banda":    "norteño",
  "calibre 50":                             "norteño",
  "los tigres del norte":                   "norteño",
  "los tucanes de tijuana":                 "norteño",
  "conjunto primavera":                     "norteño",
  "pesado":                                 "norteño",
  "los invasores de nuevo leon":            "norteño",
  "cardenales de nuevo leon":               "norteño",
  "bobby pulido":                           "norteño",
  "el duelo":                               "norteño",
  "intocable":                              "norteño",
  "hermanos espinoza":                      "norteño",

  /* Banda */
  "banda ms de sergio lizarraga":           "banda",
  "la arrolladora banda el limon":          "banda",
  "banda el recodo":                        "banda",
  "banda el recodo de cruz lizarraga":      "banda",
  "banda los recoditos":                    "banda",
  "el coyote y su banda tierra santa":      "banda",
  "remmy valenzuela":                       "banda",

  /* Hip-Hop */
  "yng lvcas":                              "hip-hop",
  "el malilla":                             "hip-hop",

  /* Pop */
  "luis miguel":                            "pop",
  "reik":                                   "pop",
  "marco antonio solis":                    "pop",
  "julieta venegas":                        "pop",
  "mon laferte":                            "pop",
  "jesse and joy":                          "pop",
  "cristian castro":                        "pop",
  "jose jose":                              "pop",
  "camila":                                 "pop",
  "belinda":                                "pop",
  "selena":                                 "pop",
  "belanova":                               "pop",
  "carla morrison":                         "pop",
  "thalia":                                 "pop",
  "ha ash":                                 "pop",
  "emmanuel":                               "pop",
  "gloria trevi":                           "pop",
  "sin bandera":                            "pop",
  "yurdia":                                 "pop",
  "kenia os":                               "pop",
  "humbe":                                  "pop",
  "diego verdaguer":                        "pop",
  "paulina rubio":                          "pop",
  "reyli barba":                            "pop",
  "alan arrieta":                           "pop",
  "kevin amf":                              "pop",
  "amanda miguel":                          "pop",
  "hupe$":                                  "pop",
  "angel almaguer":                         "pop",
  "yeri mua":                               "pop",
  "carlos rivera":                          "pop",
  "alejandra guzman":                       "pop",
  "marisela":                               "pop",
  "becky g":                                "pop",
  "bellakath":                              "pop",
  "armenta":                                "pop",
};

interface CacheSlot {
  rows: Record<string, string>[];
  fetchedAt: number;
}
let cache: CacheSlot | null = null;

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] };

  function splitRow(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        fields.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  const headers = splitRow(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitRow(lines[i]);
    if (vals.every((v) => !v.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] ?? "").trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function applySubgenreFallback(row: Record<string, string>): Record<string, string> {
  const existing = row.subgenre?.trim() ?? "";
  if (existing) return row; // sheet value wins

  const artistKey = (row.artist_key?.trim() || row.artist_name?.trim() || "").toLowerCase();
  const fallback = SUBGENRE_BY_KEY[artistKey] ?? "";
  if (!fallback) return row;

  return { ...row, subgenre: fallback };
}

/* Strip stray quote characters that Google Sheets CSV export sometimes leaves
   at the start or end of field values (e.g. `Sergio Vega El Shaka""` → `Sergio Vega El Shaka`). */
function sanitizeRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v.replace(/^"+|"+$/g, "").trim();
  }
  return out;
}

function isAdminAuthed(req: { headers: Record<string, string | string[] | undefined>; query: Record<string, unknown> }): boolean {
  const key = ADMIN_KEY();
  if (!key) return false;
  const header = req.headers["x-admin-key"];
  const qkey = req.query["adminKey"];
  return header === key || qkey === key;
}

function requireAdmin(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): boolean {
  if (!isAdminAuthed(req as Parameters<typeof isAdminAuthed>[0])) {
    res.status(403).json({ error: "Forbidden — provide X-Admin-Key header" });
    return false;
  }
  return true;
}

function fmtCount(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

type SpotifyCandidate = {
  spotifyArtistId?: string;
  spotifyName?: string;
  followers?: number | null;
  popularity?: number | null;
  spotifyUrl?: string | null;
  imageUrl?: string | null;
  uri?: string | null;
  genres?: string[];
  capability?: string;
  notes?: string | null;
};

type MusicbrainzCandidate = {
  mbid?: string;
  name?: string;
  type?: string | null;
  country?: string | null;
  areaName?: string | null;
  disambiguation?: string | null;
};

async function fetchMetadata(): Promise<Record<string, string>[]> {
  const resp = await fetch(METADATA_URL, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`artist_metadata_active: HTTP ${resp.status}`);
  const { rows } = parseCSV(await resp.text());
  return rows
    .map(sanitizeRow)
    .map(applySubgenreFallback)
    .filter((r) => !BLOCKED_ARTIST_KEYS.has((r.artist_key ?? r.artist_name ?? "").toLowerCase().trim()));
}

router.get("/artists/metadata", async (_req, res) => {
  try {
    if (!cache || Date.now() - cache.fetchedAt > CACHE_TTL) {
      try {
        const rows = await fetchMetadata();
        cache = { rows, fetchedAt: Date.now() };
        logger.info({ count: rows.length }, "[artists] metadata refreshed");
      } catch (err) {
        if (cache) {
          res.setHeader("X-Cache-Stale", "true");
          logger.warn({ err }, "[artists] metadata refresh failed, serving stale cache");
        } else {
          throw err;
        }
      }
    }
    res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
    res.json({ artists: cache!.rows, fetchedAt: cache!.fetchedAt });
  } catch (err) {
    logger.error({ err }, "[artists] metadata unavailable");
    res.status(502).json({ error: "Artist metadata unavailable", detail: String(err) });
  }
});

router.get("/artists/enrichment/:artistKey", async (req, res) => {
  const artistKey = req.params["artistKey"]?.trim().toLowerCase();
  if (!artistKey) {
    res.status(400).json({ error: "artistKey is required" });
    return;
  }

  try {
    const [spotify] = await db.select().from(spotifyArtists).where(eq(spotifyArtists.artistKey, artistKey));
    const [musicbrainz] = await db.select().from(musicbrainzArtists).where(eq(musicbrainzArtists.artistKey, artistKey));
    const [youtube] = await db.select().from(youtubeChannels).where(eq(youtubeChannels.artistKey, artistKey));

    res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
    res.json({
      artistKey,
      spotify: spotify ? {
        artistId: spotify.spotifyArtistId,
        name: spotify.spotifyName,
        url: spotify.spotifyUrl,
        imageUrl: spotify.spotifyImageUrl,
        uri: spotify.spotifyUri,
        followers: spotify.spotifyFollowers,
        followersFmt: fmtCount(spotify.spotifyFollowers),
        popularity: spotify.spotifyPopularity,
        genres: spotify.spotifyGenres,
        capability: spotify.spotifyApiCapability,
        notes: spotify.notes,
        verified: spotify.verified,
        lastUpdated: spotify.spotifyLastUpdated.toISOString(),
      } : null,
      musicbrainz: musicbrainz ? {
        mbid: musicbrainz.mbid,
        name: musicbrainz.name,
        sortName: musicbrainz.sortName,
        disambiguation: musicbrainz.disambiguation,
        type: musicbrainz.type,
        country: musicbrainz.country,
        areaName: musicbrainz.areaName,
        beginDate: musicbrainz.beginDate,
        tags: musicbrainz.tags,
        relations: musicbrainz.relations,
        verified: musicbrainz.verified,
        lastUpdated: musicbrainz.lastUpdated.toISOString(),
        url: `https://musicbrainz.org/artist/${musicbrainz.mbid}`,
      } : null,
      youtube: youtube ? {
        channelId: youtube.channelId,
        title: youtube.title,
        thumbnailUrl: youtube.thumbnailUrl,
        subscribers: youtube.subscriberCount,
        subscribersFmt: fmtCount(youtube.subscriberCount),
        views: youtube.viewCount,
        viewsFmt: fmtCount(youtube.viewCount),
        videoCount: youtube.videoCount,
        customUrl: youtube.customUrl,
        channelUrl: `https://www.youtube.com/channel/${youtube.channelId}`,
        cachedAt: youtube.cachedAt.toISOString(),
      } : null,
    });
  } catch (err) {
    logger.error({ err, artistKey }, "[artists] enrichment unavailable");
    res.status(500).json({ error: "Artist enrichment unavailable" });
  }
});

router.get("/artists/verified", async (_req, res) => {
  try {
    const [spotifyRows, musicbrainzRows, youtubeRows] = await Promise.all([
      db.select({ artistKey: spotifyArtists.artistKey }).from(spotifyArtists),
      db.select({ artistKey: musicbrainzArtists.artistKey }).from(musicbrainzArtists),
      db.select({ artistKey: youtubeChannels.artistKey }).from(youtubeChannels),
    ]);

    const verified = new Map<string, Set<"spotify" | "youtube" | "musicbrainz">>();
    const addSource = (artistKey: string | null | undefined, source: "spotify" | "youtube" | "musicbrainz") => {
      const key = artistKey?.trim().toLowerCase();
      if (!key) return;
      const sources = verified.get(key) ?? new Set<"spotify" | "youtube" | "musicbrainz">();
      sources.add(source);
      verified.set(key, sources);
    };

    spotifyRows.forEach(row => addSource(row.artistKey, "spotify"));
    musicbrainzRows.forEach(row => addSource(row.artistKey, "musicbrainz"));
    youtubeRows.forEach(row => addSource(row.artistKey, "youtube"));

    res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
    res.json({
      artists: Array.from(verified.entries())
        .sort(([a], [b]) => a.localeCompare(b, "es", { sensitivity: "base" }))
        .map(([artistKey, sources]) => ({ artistKey, sources: Array.from(sources).sort() })),
    });
  } catch (err) {
    logger.error({ err }, "[artists] verified list unavailable");
    res.status(500).json({ error: "Artist verification list unavailable" });
  }
});

router.get("/admin/artists/enrichment-candidates", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const limit = Math.min(parseInt((req.query["limit"] as string | undefined) ?? "100", 10), 300);
    const [spotifyRows, musicbrainzRows] = await Promise.all([
      db.select().from(spotifyArtistCandidates).orderBy(asc(spotifyArtistCandidates.searchedAt)),
      db.select().from(musicbrainzArtistCandidates).orderBy(asc(musicbrainzArtistCandidates.searchedAt)),
    ]);

    const spotifyReview = spotifyRows.filter(row => row.status === "review").slice(0, limit);
    const musicbrainzReview = musicbrainzRows.filter(row => row.status === "review").slice(0, limit);

    res.setHeader("Cache-Control", "no-store");
    res.json({
      totals: {
        spotify: spotifyRows.length,
        spotifyReview: spotifyRows.filter(row => row.status === "review").length,
        musicbrainz: musicbrainzRows.length,
        musicbrainzReview: musicbrainzRows.filter(row => row.status === "review").length,
      },
      spotify: spotifyReview.map(row => ({
        provider: "spotify",
        artistKey: row.artistKey,
        artistName: row.artistName,
        bestScore: row.bestScore,
        status: row.status,
        searchedAt: row.searchedAt.toISOString(),
        candidates: row.candidates,
      })),
      musicbrainz: musicbrainzReview.map(row => ({
        provider: "musicbrainz",
        artistKey: row.artistKey,
        artistName: row.artistName,
        bestScore: row.bestScore,
        status: row.status,
        searchedAt: row.searchedAt.toISOString(),
        candidates: row.candidates,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[artists] enrichment candidates unavailable");
    res.status(500).json({ error: "Artist enrichment candidates unavailable" });
  }
});

router.get("/admin/artists/api-coverage", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const [artists, spotifyRows, spotifyCandidates, musicbrainzRows, musicbrainzCandidates, youtubeRows, deezerRows] = await Promise.all([
      fetchMetadata(),
      db.select().from(spotifyArtists),
      db.select().from(spotifyArtistCandidates),
      db.select().from(musicbrainzArtists),
      db.select().from(musicbrainzArtistCandidates),
      db.select().from(youtubeChannels),
      db.select().from(deezerTrackCovers),
    ]);

    const artistKeys = new Set(artists.map(row => row.artist_key).filter(Boolean));
    const linkedSpotify = new Set(spotifyRows.map(row => row.artistKey));
    const linkedMusicbrainz = new Set(musicbrainzRows.map(row => row.artistKey));
    const linkedYoutube = new Set(youtubeRows.map(row => row.artistKey));
    const linkedDeezerCovers = new Set(deezerRows.map(row => row.artistKey));

    const spotifyReview = spotifyCandidates.filter(row => row.status === "review");
    const musicbrainzReview = musicbrainzCandidates.filter(row => row.status === "review");
    const spotifyRejected = spotifyCandidates.filter(row => row.status === "rejected");
    const musicbrainzRejected = musicbrainzCandidates.filter(row => row.status === "rejected");

    const missingPreview = (linkedKeys: Set<string>) => artists
      .filter(row => row.artist_key && !linkedKeys.has(row.artist_key))
      .slice(0, 150)
      .map(row => ({ artistKey: row.artist_key, artistName: row.artist_name }));

    const newestDate = (dates: Date[]) => {
      const newest = dates.filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0];
      return newest?.toISOString() ?? null;
    };
    const oldestDate = (dates: Date[]) => {
      const oldest = dates.filter(Boolean).sort((a, b) => a.getTime() - b.getTime())[0];
      return oldest?.toISOString() ?? null;
    };

    res.setHeader("Cache-Control", "no-store");
    res.json({
      source: "artist_metadata_active",
      totalArtists: artistKeys.size,
      generatedAt: new Date().toISOString(),
      providers: {
        spotify: {
          linked: linkedSpotify.size,
          missing: Math.max(0, artistKeys.size - linkedSpotify.size),
          review: spotifyReview.length,
          rejected: spotifyRejected.length,
          coveragePct: artistKeys.size ? Number(((linkedSpotify.size / artistKeys.size) * 100).toFixed(1)) : 0,
          newestUpdatedAt: newestDate(spotifyRows.map(row => row.spotifyLastUpdated)),
          oldestUpdatedAt: oldestDate(spotifyRows.map(row => row.spotifyLastUpdated)),
          missingPreview: missingPreview(linkedSpotify),
          reviewPreview: spotifyReview.slice(0, 12).map(row => ({
            artistKey: row.artistKey,
            artistName: row.artistName,
            bestScore: row.bestScore,
          })),
        },
        youtube: {
          linked: linkedYoutube.size,
          missing: Math.max(0, artistKeys.size - linkedYoutube.size),
          review: 0,
          rejected: 0,
          coveragePct: artistKeys.size ? Number(((linkedYoutube.size / artistKeys.size) * 100).toFixed(1)) : 0,
          newestUpdatedAt: newestDate(youtubeRows.map(row => row.cachedAt)),
          oldestUpdatedAt: oldestDate(youtubeRows.map(row => row.cachedAt)),
          missingPreview: missingPreview(linkedYoutube),
        },
        musicbrainz: {
          linked: linkedMusicbrainz.size,
          missing: Math.max(0, artistKeys.size - linkedMusicbrainz.size),
          review: musicbrainzReview.length,
          rejected: musicbrainzRejected.length,
          coveragePct: artistKeys.size ? Number(((linkedMusicbrainz.size / artistKeys.size) * 100).toFixed(1)) : 0,
          newestUpdatedAt: newestDate(musicbrainzRows.map(row => row.lastUpdated)),
          oldestUpdatedAt: oldestDate(musicbrainzRows.map(row => row.lastUpdated)),
          missingPreview: missingPreview(linkedMusicbrainz),
          reviewPreview: musicbrainzReview.slice(0, 12).map(row => ({
            artistKey: row.artistKey,
            artistName: row.artistName,
            bestScore: row.bestScore,
          })),
        },
        deezer: {
          linked: linkedDeezerCovers.size,
          missing: Math.max(0, artistKeys.size - linkedDeezerCovers.size),
          review: 0,
          rejected: 0,
          coveragePct: artistKeys.size ? Number(((linkedDeezerCovers.size / artistKeys.size) * 100).toFixed(1)) : 0,
          newestUpdatedAt: newestDate(deezerRows.map(row => row.updatedAt)),
          oldestUpdatedAt: oldestDate(deezerRows.map(row => row.updatedAt)),
          missingPreview: missingPreview(linkedDeezerCovers),
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "[artists] api coverage unavailable");
    res.status(500).json({ error: "API coverage unavailable" });
  }
});

router.post("/admin/artists/enrichment-candidates/:provider/:artistKey/approve", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const provider = req.params["provider"];
  const artistKey = req.params["artistKey"]?.trim().toLowerCase();
  const candidateIndex = Math.max(0, Number((req.body as { candidateIndex?: number })?.candidateIndex ?? 0));
  if (!artistKey || (provider !== "spotify" && provider !== "musicbrainz")) {
    res.status(400).json({ error: "provider and artistKey are required" });
    return;
  }

  try {
    if (provider === "spotify") {
      const [candidateRow] = await db.select().from(spotifyArtistCandidates).where(eq(spotifyArtistCandidates.artistKey, artistKey));
      if (!candidateRow) {
        res.status(404).json({ error: "Spotify candidate not found" });
        return;
      }

      const candidate = candidateRow.candidates[candidateIndex] as SpotifyCandidate | undefined;
      if (!candidate?.spotifyArtistId) {
        res.status(400).json({ error: "Spotify candidate is missing spotifyArtistId" });
        return;
      }

      await db.insert(spotifyArtists).values({
        artistKey,
        spotifyArtistId: candidate.spotifyArtistId,
        spotifyName: candidate.spotifyName ?? candidateRow.artistName,
        spotifyFollowers: candidate.followers ?? null,
        spotifyPopularity: candidate.popularity ?? null,
        spotifyUrl: candidate.spotifyUrl ?? null,
        spotifyImageUrl: candidate.imageUrl ?? null,
        spotifyUri: candidate.uri ?? null,
        spotifyGenres: candidate.genres ?? [],
        spotifyApiCapability: candidate.capability ?? "identity_profile",
        notes: candidate.notes ?? "Approved from Mexico Charts review queue.",
        verified: true,
        verifiedAt: new Date(),
        spotifyLastUpdated: new Date(),
        linkedAt: new Date(),
      }).onConflictDoNothing({ target: spotifyArtists.artistKey });

      await db.delete(spotifyArtistCandidates).where(eq(spotifyArtistCandidates.artistKey, artistKey));
      res.json({ ok: true, provider, artistKey, approved: candidate });
      return;
    }

    const [candidateRow] = await db.select().from(musicbrainzArtistCandidates).where(eq(musicbrainzArtistCandidates.artistKey, artistKey));
    if (!candidateRow) {
      res.status(404).json({ error: "MusicBrainz candidate not found" });
      return;
    }

    const candidate = candidateRow.candidates[candidateIndex] as MusicbrainzCandidate | undefined;
    if (!candidate?.mbid) {
      res.status(400).json({ error: "MusicBrainz candidate is missing mbid" });
      return;
    }

    await db.insert(musicbrainzArtists).values({
      artistKey,
      mbid: candidate.mbid,
      name: candidate.name ?? candidateRow.artistName,
      sortName: null,
      disambiguation: candidate.disambiguation ?? null,
      type: candidate.type ?? null,
      country: candidate.country ?? null,
      areaName: candidate.areaName ?? null,
      beginDate: null,
      endDate: null,
      aliases: [],
      tags: [],
      relations: [],
      verified: "manual_review_accepted",
      lastUpdated: new Date(),
      linkedAt: new Date(),
    }).onConflictDoNothing({ target: musicbrainzArtists.artistKey });

    await db.delete(musicbrainzArtistCandidates).where(eq(musicbrainzArtistCandidates.artistKey, artistKey));
    res.json({ ok: true, provider, artistKey, approved: candidate });
  } catch (err) {
    logger.error({ err, provider, artistKey }, "[artists] enrichment candidate approve failed");
    res.status(500).json({ error: "Could not approve enrichment candidate" });
  }
});

router.post("/admin/artists/enrichment-candidates/:provider/:artistKey/reject", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const provider = req.params["provider"];
  const artistKey = req.params["artistKey"]?.trim().toLowerCase();
  if (!artistKey || (provider !== "spotify" && provider !== "musicbrainz")) {
    res.status(400).json({ error: "provider and artistKey are required" });
    return;
  }

  try {
    if (provider === "spotify") {
      await db.update(spotifyArtistCandidates)
        .set({ status: "rejected", searchedAt: new Date() })
        .where(eq(spotifyArtistCandidates.artistKey, artistKey));
    } else {
      await db.update(musicbrainzArtistCandidates)
        .set({ status: "rejected", searchedAt: new Date() })
        .where(eq(musicbrainzArtistCandidates.artistKey, artistKey));
    }

    res.json({ ok: true, provider, artistKey, status: "rejected" });
  } catch (err) {
    logger.error({ err, provider, artistKey }, "[artists] enrichment candidate reject failed");
    res.status(500).json({ error: "Could not reject enrichment candidate" });
  }
});

export default router;
