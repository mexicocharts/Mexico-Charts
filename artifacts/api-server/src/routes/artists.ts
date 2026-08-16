import { Router } from "express";
import { db, pool } from "@workspace/db";
import {
  deezerTrackCovers,
  artistSocialAccountCandidates,
  musicbrainzArtistCandidates,
  musicbrainzArtists,
  spotifyArtistCandidates,
  spotifyArtists,
  youtubeChannels,
} from "@workspace/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { ensureDailySnapshotRunLogTable } from "../lib/daily-snapshot-run-log";
import { runDailySpotifyKworbSnapshots } from "../lib/spotify-kworb-snapshot-scheduler";
import { runDailyYoutubeChannelSnapshots } from "../lib/youtube-channel-snapshot-scheduler";
import { ensureYoutubeVideoTrackerTables, runDailyYoutubeVideoSnapshots } from "../lib/youtube-video-tracker-scheduler";

const router = Router();

const METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";

const BLOCKED_ARTIST_KEYS = new Set([
  "jesse", "banda toro", "jonathan caro", "baektowo", "jose mejia",
  "el frizian", "los 2 primos", "el gerry oficial", "lupe borbon y su blindaje 7",
  "juanchito", "meloleon", "badguychapo",
]);

const CANONICAL_ARTIST_KEY_BY_ALIAS: Record<string, string> = {
  "banda el recodo de cruz lizarraga": "banda el recodo",
  "banda sinaloense ms de sergio lizarraga": "banda ms de sergio lizarraga",
  "banda tito y su torbellino": "tito torbellino",
  "ramon ayala y sus bravos del norte": "ramon ayala",
};

function normalizeArtistKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function canonicalArtistKey(value: string | null | undefined) {
  const key = normalizeArtistKey(value);
  return CANONICAL_ARTIST_KEY_BY_ALIAS[key] ?? key;
}

function artistLookupKeys(value: string) {
  const key = normalizeArtistKey(value);
  const canonical = canonicalArtistKey(key);
  return key === canonical ? [key] : [key, canonical];
}

function pickArtistRow<T extends { artistKey: string }>(rows: T[], requestedKey: string) {
  const key = normalizeArtistKey(requestedKey);
  const canonical = canonicalArtistKey(key);
  return rows.find(row => normalizeArtistKey(row.artistKey) === key)
    ?? rows.find(row => normalizeArtistKey(row.artistKey) === canonical)
    ?? null;
}

function hasLinkedArtist(linkedKeys: Set<string>, artistKey: string | null | undefined) {
  const key = normalizeArtistKey(artistKey);
  return Boolean(key && (linkedKeys.has(key) || linkedKeys.has(canonicalArtistKey(key))));
}

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

async function safeArtistNameMap(): Promise<Map<string, string>> {
  try {
    const rows = await fetchMetadata();
    const entries: Array<[string, string]> = [];
    for (const row of rows) {
      const key = normalizeArtistKey(row.artist_key);
      const name = row.artist_name?.trim();
      if (key && name) entries.push([key, name]);
    }
    return new Map(entries);
  } catch {
    return new Map();
  }
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
    const lookupKeys = artistLookupKeys(artistKey);
    const [spotifyRows, musicbrainzRows, youtubeRows, socialRows] = await Promise.all([
      db.select().from(spotifyArtists).where(inArray(spotifyArtists.artistKey, lookupKeys)),
      db.select().from(musicbrainzArtists).where(inArray(musicbrainzArtists.artistKey, lookupKeys)),
      db.select().from(youtubeChannels).where(inArray(youtubeChannels.artistKey, lookupKeys)),
      db.select({
        platform: artistSocialAccountCandidates.platform,
        url: artistSocialAccountCandidates.canonicalUrl,
        confidence: artistSocialAccountCandidates.confidence,
        verifiedAt: artistSocialAccountCandidates.verifiedAt,
      }).from(artistSocialAccountCandidates).where(inArray(artistSocialAccountCandidates.artistKey, lookupKeys)),
    ]);
    const spotify = pickArtistRow(spotifyRows, artistKey);
    const musicbrainz = pickArtistRow(musicbrainzRows, artistKey);
    const youtube = pickArtistRow(youtubeRows, artistKey);

    res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=3600");
    res.json({
      artistKey,
      canonicalArtistKey: canonicalArtistKey(artistKey),
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
      socialAccounts: socialRows
        .filter(row => row.confidence >= 90 && row.verifiedAt != null)
        .sort((a, b) => a.platform.localeCompare(b.platform))
        .map(row => ({
          platform: row.platform,
          url: row.url,
          confidence: row.confidence,
          verifiedAt: row.verifiedAt!.toISOString(),
        })),
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
    Object.entries(CANONICAL_ARTIST_KEY_BY_ALIAS).forEach(([aliasKey, canonicalKey]) => {
      const canonicalSources = verified.get(canonicalKey);
      if (!canonicalSources) return;
      canonicalSources.forEach(source => addSource(aliasKey, source));
    });

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
    const linkedCount = (linkedKeys: Set<string>) => artists
      .filter(row => row.artist_key && hasLinkedArtist(linkedKeys, row.artist_key))
      .length;
    const spotifyLinked = linkedCount(linkedSpotify);
    const musicbrainzLinked = linkedCount(linkedMusicbrainz);
    const youtubeLinked = linkedCount(linkedYoutube);
    const deezerLinked = linkedCount(linkedDeezerCovers);

    const spotifyReview = spotifyCandidates.filter(row => row.status === "review");
    const musicbrainzReview = musicbrainzCandidates.filter(row => row.status === "review");
    const spotifyRejected = spotifyCandidates.filter(row => row.status === "rejected");
    const musicbrainzRejected = musicbrainzCandidates.filter(row => row.status === "rejected");

    const missingPreview = (linkedKeys: Set<string>) => artists
      .filter(row => row.artist_key && !hasLinkedArtist(linkedKeys, row.artist_key))
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
          linked: spotifyLinked,
          missing: Math.max(0, artistKeys.size - spotifyLinked),
          review: spotifyReview.length,
          rejected: spotifyRejected.length,
          coveragePct: artistKeys.size ? Number(((spotifyLinked / artistKeys.size) * 100).toFixed(1)) : 0,
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
          linked: youtubeLinked,
          missing: Math.max(0, artistKeys.size - youtubeLinked),
          review: 0,
          rejected: 0,
          coveragePct: artistKeys.size ? Number(((youtubeLinked / artistKeys.size) * 100).toFixed(1)) : 0,
          newestUpdatedAt: newestDate(youtubeRows.map(row => row.cachedAt)),
          oldestUpdatedAt: oldestDate(youtubeRows.map(row => row.cachedAt)),
          missingPreview: missingPreview(linkedYoutube),
        },
        musicbrainz: {
          linked: musicbrainzLinked,
          missing: Math.max(0, artistKeys.size - musicbrainzLinked),
          review: musicbrainzReview.length,
          rejected: musicbrainzRejected.length,
          coveragePct: artistKeys.size ? Number(((musicbrainzLinked / artistKeys.size) * 100).toFixed(1)) : 0,
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
          linked: deezerLinked,
          missing: Math.max(0, artistKeys.size - deezerLinked),
          review: 0,
          rejected: 0,
          coveragePct: artistKeys.size ? Number(((deezerLinked / artistKeys.size) * 100).toFixed(1)) : 0,
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

router.get("/admin/artists/daily-snapshots/status", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const snapshotDate = (req.query["date"] as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const rawDetails = parseInt((req.query["details"] as string | undefined) ?? "80", 10);
  const maxDetails = Math.min(Number.isFinite(rawDetails) && rawDetails > 0 ? rawDetails : 80, 300);

  try {
    await ensureDailySnapshotRunLogTable();
    const ensureClient = await pool.connect();
    try {
      await ensureYoutubeVideoTrackerTables(ensureClient);
    } finally {
      ensureClient.release();
    }

    const [artistNames, youtubeRows, spotifyRows, youtubeVideoRows, youtubeMissingRows, spotifyMissingRows, youtubeVideoMissingRows, runRows] = await Promise.all([
      safeArtistNameMap(),
      pool.query<{
        total: number;
        date_rows: number;
        latest_fetched_at: string | null;
        total_daily_views: string | number | null;
      }>(
        `
          SELECT
            (SELECT count(*)::int FROM youtube_channels WHERE channel_id IS NOT NULL) AS total,
            (SELECT count(*)::int FROM youtube_channel_daily_snapshots WHERE snapshot_date = $1) AS date_rows,
            (SELECT max(fetched_at)::text FROM youtube_channel_daily_snapshots WHERE snapshot_date = $1) AS latest_fetched_at,
            (SELECT COALESCE(sum(daily_view_delta), 0) FROM youtube_channel_daily_snapshots WHERE snapshot_date = $1) AS total_daily_views
        `,
        [snapshotDate],
      ),
      pool.query<{
        total: number;
        date_rows: number;
        latest_fetched_at: string | null;
        total_daily_streams: string | number | null;
      }>(
        `
          SELECT
            (
              SELECT count(*)::int
              FROM kworb_coverage c
              LEFT JOIN spotify_artists s ON s.artist_key = c.artist_key
              WHERE COALESCE(c.spotify_id, s.spotify_artist_id) IS NOT NULL
                AND COALESCE(c.has_spotify, false) = true
            ) AS total,
            (SELECT count(*)::int FROM spotify_kworb_daily_snapshots WHERE snapshot_date = $1) AS date_rows,
            (SELECT max(fetched_at)::text FROM spotify_kworb_daily_snapshots WHERE snapshot_date = $1) AS latest_fetched_at,
            (SELECT COALESCE(sum(daily_streams), 0) FROM spotify_kworb_daily_snapshots WHERE snapshot_date = $1) AS total_daily_streams
        `,
        [snapshotDate],
      ),
      pool.query<{
        total_videos: number;
        total_artists: number;
        active_links: number;
        date_rows: number;
        rollup_rows: number;
        latest_fetched_at: string | null;
        total_daily_views: string | number | null;
        frozen_videos: number;
      }>(
        `
          SELECT
            (SELECT count(DISTINCT video_id)::int FROM youtube_artist_video_links WHERE active = true) AS total_videos,
            (SELECT count(DISTINCT artist_key)::int FROM youtube_artist_video_links WHERE active = true) AS total_artists,
            (SELECT count(*)::int FROM youtube_artist_video_links WHERE active = true) AS active_links,
            (SELECT count(*)::int FROM youtube_video_daily_snapshots WHERE snapshot_date = $1) AS date_rows,
            (SELECT count(*)::int FROM youtube_artist_video_daily_rollups WHERE snapshot_date = $1) AS rollup_rows,
            (SELECT max(fetched_at)::text FROM youtube_video_daily_snapshots WHERE snapshot_date = $1) AS latest_fetched_at,
            (SELECT COALESCE(sum(daily_view_delta), 0) FROM youtube_video_daily_snapshots WHERE snapshot_date = $1) AS total_daily_views,
            (SELECT count(*)::int FROM youtube_video_daily_snapshots WHERE snapshot_date = $1 AND daily_view_delta = 0) AS frozen_videos
        `,
        [snapshotDate],
      ),
      pool.query<{
        artist_key: string;
        channel_id: string;
        title: string | null;
        cached_at: string | null;
        last_snapshot_date: string | null;
        last_fetched_at: string | null;
        reason_bucket: string;
      }>(
        `
          SELECT
            yc.artist_key,
            yc.channel_id,
            yc.title,
            yc.cached_at::text,
            latest.snapshot_date AS last_snapshot_date,
            latest.fetched_at::text AS last_fetched_at,
            CASE
              WHEN latest.snapshot_date IS NULL THEN 'never_measured'
              ELSE 'not_measured_today'
            END AS reason_bucket
          FROM youtube_channels yc
          LEFT JOIN youtube_channel_daily_snapshots today
            ON today.artist_key = yc.artist_key
           AND today.snapshot_date = $1
          LEFT JOIN LATERAL (
            SELECT snapshot_date, fetched_at
            FROM youtube_channel_daily_snapshots ys
            WHERE ys.artist_key = yc.artist_key
            ORDER BY snapshot_date DESC
            LIMIT 1
          ) latest ON true
          WHERE yc.channel_id IS NOT NULL
            AND today.id IS NULL
          ORDER BY latest.snapshot_date ASC NULLS FIRST, yc.artist_key ASC
          LIMIT $2
        `,
        [snapshotDate, maxDetails],
      ),
      pool.query<{
        artist_key: string;
        artist_name: string | null;
        spotify_artist_id: string | null;
        last_snapshot_date: string | null;
        last_fetched_at: string | null;
        reason_bucket: string;
      }>(
        `
          SELECT
            c.artist_key,
            c.artist_name,
            COALESCE(c.spotify_id, s.spotify_artist_id) AS spotify_artist_id,
            latest.snapshot_date AS last_snapshot_date,
            latest.fetched_at::text AS last_fetched_at,
            CASE
              WHEN latest.snapshot_date IS NULL THEN 'never_measured'
              ELSE 'not_measured_today'
            END AS reason_bucket
          FROM kworb_coverage c
          LEFT JOIN spotify_artists s ON s.artist_key = c.artist_key
          LEFT JOIN spotify_kworb_daily_snapshots today
            ON today.artist_key = c.artist_key
           AND today.snapshot_date = $1
          LEFT JOIN LATERAL (
            SELECT snapshot_date, fetched_at
            FROM spotify_kworb_daily_snapshots ss
            WHERE ss.artist_key = c.artist_key
            ORDER BY snapshot_date DESC
            LIMIT 1
          ) latest ON true
          WHERE COALESCE(c.spotify_id, s.spotify_artist_id) IS NOT NULL
            AND COALESCE(c.has_spotify, false) = true
            AND today.id IS NULL
          ORDER BY latest.snapshot_date ASC NULLS FIRST, c.artist_key ASC
          LIMIT $2
        `,
        [snapshotDate, maxDetails],
      ),
      pool.query<{
        artist_key: string;
        artist_name: string | null;
        video_id: string;
        title: string | null;
        last_snapshot_date: string | null;
        last_fetched_at: string | null;
        reason_bucket: string;
      }>(
        `
          SELECT
            l.artist_key,
            l.artist_name,
            l.video_id,
            v.title,
            latest.snapshot_date AS last_snapshot_date,
            latest.fetched_at::text AS last_fetched_at,
            CASE
              WHEN latest.snapshot_date IS NULL THEN 'never_measured'
              ELSE 'not_measured_today'
            END AS reason_bucket
          FROM youtube_artist_video_links l
          LEFT JOIN youtube_tracked_videos v ON v.video_id = l.video_id
          LEFT JOIN youtube_video_daily_snapshots today
            ON today.video_id = l.video_id
           AND today.snapshot_date = $1
          LEFT JOIN LATERAL (
            SELECT snapshot_date, fetched_at
            FROM youtube_video_daily_snapshots ys
            WHERE ys.video_id = l.video_id
            ORDER BY snapshot_date DESC
            LIMIT 1
          ) latest ON true
          WHERE l.active = true
            AND today.id IS NULL
          ORDER BY latest.snapshot_date ASC NULLS FIRST, l.artist_key ASC, l.priority DESC
          LIMIT $2
        `,
        [snapshotDate, maxDetails],
      ),
      pool.query<{
        id: number;
        provider: string;
        snapshot_date: string;
        reason: string;
        status: string;
        expected_count: number;
        fetched_count: number;
        saved_count: number;
        missing_count: number;
        date_rows: number;
        total_daily_value: string | number;
        error: string | null;
        started_at: string;
        finished_at: string | null;
      }>(`
        SELECT
          id,
          provider,
          snapshot_date,
          reason,
          status,
          expected_count,
          fetched_count,
          saved_count,
          missing_count,
          date_rows,
          total_daily_value,
          error,
          started_at::text,
          finished_at::text
        FROM daily_snapshot_run_logs
        ORDER BY started_at DESC
        LIMIT 14
      `),
    ]);

    const youtube = youtubeRows.rows[0] ?? { total: 0, date_rows: 0, latest_fetched_at: null, total_daily_views: 0 };
    const spotify = spotifyRows.rows[0] ?? { total: 0, date_rows: 0, latest_fetched_at: null, total_daily_streams: 0 };
    const youtubeVideo = youtubeVideoRows.rows[0] ?? {
      total_videos: 0,
      total_artists: 0,
      active_links: 0,
      date_rows: 0,
      rollup_rows: 0,
      latest_fetched_at: null,
      total_daily_views: 0,
      frozen_videos: 0,
    };
    const reasonCounts = (rows: Array<{ reason_bucket: string }>) => rows.reduce<Record<string, number>>((counts, row) => {
      counts[row.reason_bucket] = (counts[row.reason_bucket] ?? 0) + 1;
      return counts;
    }, {});

    res.setHeader("Cache-Control", "no-store");
    res.json({
      snapshotDate,
      generatedAt: new Date().toISOString(),
      youtube: {
        total: Number(youtube.total ?? 0),
        dateRows: Number(youtube.date_rows ?? 0),
        missing: Math.max(0, Number(youtube.total ?? 0) - Number(youtube.date_rows ?? 0)),
        latestFetchedAt: youtube.latest_fetched_at,
        totalDailyViews: Number(youtube.total_daily_views ?? 0),
        missingPreview: youtubeMissingRows.rows.map(row => ({
          artistKey: row.artist_key,
          artistName: artistNames.get(normalizeArtistKey(row.artist_key)) ?? row.artist_key,
          linkedId: row.channel_id,
          linkedLabel: row.title,
          lastSnapshotDate: row.last_snapshot_date,
          lastFetchedAt: row.last_fetched_at,
          reason: row.reason_bucket,
        })),
        missingReasonCounts: reasonCounts(youtubeMissingRows.rows),
      },
      youtubeVideoTracker: {
        total: Number(youtubeVideo.total_videos ?? 0),
        artists: Number(youtubeVideo.total_artists ?? 0),
        activeLinks: Number(youtubeVideo.active_links ?? 0),
        dateRows: Number(youtubeVideo.date_rows ?? 0),
        rollupRows: Number(youtubeVideo.rollup_rows ?? 0),
        missing: Math.max(0, Number(youtubeVideo.total_videos ?? 0) - Number(youtubeVideo.date_rows ?? 0)),
        frozenVideos: Number(youtubeVideo.frozen_videos ?? 0),
        latestFetchedAt: youtubeVideo.latest_fetched_at,
        totalDailyViews: Number(youtubeVideo.total_daily_views ?? 0),
        missingPreview: youtubeVideoMissingRows.rows.map(row => ({
          artistKey: row.artist_key,
          artistName: row.artist_name ?? artistNames.get(normalizeArtistKey(row.artist_key)) ?? row.artist_key,
          linkedId: row.video_id,
          linkedLabel: row.title,
          lastSnapshotDate: row.last_snapshot_date,
          lastFetchedAt: row.last_fetched_at,
          reason: row.reason_bucket,
        })),
        missingReasonCounts: reasonCounts(youtubeVideoMissingRows.rows),
      },
      spotifyKworb: {
        total: Number(spotify.total ?? 0),
        dateRows: Number(spotify.date_rows ?? 0),
        missing: Math.max(0, Number(spotify.total ?? 0) - Number(spotify.date_rows ?? 0)),
        latestFetchedAt: spotify.latest_fetched_at,
        totalDailyStreams: Number(spotify.total_daily_streams ?? 0),
        missingPreview: spotifyMissingRows.rows.map(row => ({
          artistKey: row.artist_key,
          artistName: row.artist_name ?? artistNames.get(normalizeArtistKey(row.artist_key)) ?? row.artist_key,
          linkedId: row.spotify_artist_id,
          linkedLabel: "Spotify",
          lastSnapshotDate: row.last_snapshot_date,
          lastFetchedAt: row.last_fetched_at,
          reason: row.reason_bucket,
        })),
        missingReasonCounts: reasonCounts(spotifyMissingRows.rows),
      },
      recentRuns: runRows.rows.map(row => ({
        id: row.id,
        provider: row.provider,
        snapshotDate: row.snapshot_date,
        reason: row.reason,
        status: row.status,
        expectedCount: Number(row.expected_count ?? 0),
        fetchedCount: Number(row.fetched_count ?? 0),
        savedCount: Number(row.saved_count ?? 0),
        missingCount: Number(row.missing_count ?? 0),
        dateRows: Number(row.date_rows ?? 0),
        totalDailyValue: Number(row.total_daily_value ?? 0),
        error: row.error,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[artists] daily snapshot status unavailable");
    res.status(500).json({ error: "Daily snapshot status unavailable" });
  }
});

router.post("/admin/artists/daily-snapshots/run", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const provider = (req.query["provider"] as string | undefined)?.trim().toLowerCase();

  try {
    if (provider === "youtube") {
      res.json({ provider, result: await runDailyYoutubeChannelSnapshots("admin-coverage-run-now") });
      return;
    }
    if (provider === "spotify" || provider === "spotify-kworb") {
      res.json({ provider: "spotifyKworb", result: await runDailySpotifyKworbSnapshots("admin-coverage-run-now") });
      return;
    }
    if (provider === "youtube-video" || provider === "youtube-video-tracker") {
      res.json({ provider: "youtubeVideoTracker", result: await runDailyYoutubeVideoSnapshots("admin-coverage-run-now") });
      return;
    }

    res.status(400).json({ error: "provider must be youtube, spotify, or youtube-video" });
  } catch (err) {
    logger.error({ err, provider }, "[artists] daily snapshot run failed");
    res.status(500).json({ error: "Daily snapshot run failed" });
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
