import { Router } from "express";

const router = Router();

/* ── Slug utility — matches kworb's URL scheme ─────────────────────────────
   kworb uses: lowercase + strip NFD diacritics + strip all non-alphanumeric
────────────────────────────────────────────────────────────────────────── */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/* ── Hardcoded seed: 109 confirmed slug → Spotify ID pairs ─────────────── */
const SPOTIFY_ID_SEED: Record<string, string> = {
  fuerzaregida:                     "0ys2OFYzWYB5hRDLCsBqxt",
  pesopluma:                        "12GqGscKJx3aE4t07u7eVZ",
  grupofrontera:                    "6XkjpgcEsYab502Vr1bBeW",
  beckyg:                           "4obzFoKoKRHIphyHzJ35G3",
  juniorh:                          "7Gi6gjaWy3DxyilpF1a8Is",
  netonvega:                        "6pV5zH2LzjOUHaAvENdMMa",
  carinleon:                        "66ihevNkSYNzRAl44dx6jJ",
  titodoublep:                      "5eumcnUkdmGvkvcsx1WFNG",
  elbogueto:                        "3S9Hg7sRKhmtWunFZ2yAYP",
  oscarmaydon:                      "3l9G1G9MxH6DaRhwLklaf5",
  natanaelcano:                     "0elWFr7TW8piilVRYJUe4P",
  luismiguel:                       "2nszmSgqreHSdJA3zWPyrW",
  luisrconriquez:                   "0pePYDrJGk8gqMRbXrLJC8",
  grupofirme:                       "1dKdetem2xEmjgvyymzytS",
  gabitoballesteros:                "6Sbl0NT50roqWvy746MfVf",
  christiannodal:                   "0XwVARXT135rw8lyw1EeWP",
  xavi:                             "3Me35AWHCGqW4sZ7bWWJt1",
  reik:                             "0vR2qb8m9WHeZ5ByCbimq2",
  marcoantoniosolis:                "3tJnB0s6c3oXPq1SCCavnd",
  calle24:                          "6dLuQ5qXxIuWc5urxfIiZR",
  bandamsdesergiolizarraga:         "2C6i0I5RiGzDKN9IAF8reh",
  chinopacas:                       "2rmkQLzj0k4nZdQehOUByO",
  julietavenegas:                   "2QWIScpFDNxmS6ZEMIUvgm",
  losangelesazules:                 "0ZCO8oVkMj897cKgFH7fRW",
  victormendivil:                   "5YqI7p8zYsOpKJtjxYdOce",
  monlaferte:                       "4boI7bJtmB1L3b1cuL75Zr",
  grupomarcaregistrada:             "1gW6pz5n1aK249L0GvfQCC",
  alejandrofernandez:               "6sq1yF0OZEWA4xoXVKW1L9",
  leninramirez:                     "3hTffafUYLLgO4yuPAxb5U",
  joansebastian:                    "7FsRH5bw8iWpSbMX1G7xf1",
  calibre50:                        "4jogXSSvlyMkODGSZ2wc2P",
  eslabonarmado:                    "0XeEobZplHxzM9QzFQWLiF",
  edenmunoz:                        "1gJdf4Yybu4X5A2xYV3NMV",
  jessejoy:                         "1mX1TWKpNxDSAH16LgDfiR",
  losdareyesdelasierrra:            "1ZMJSCQw8DIefcLb1FIpY0",
  alfredoolivas:                    "5xYNmNkaWRqu3e5F4UXME8",
  vicentefernandez:                 "4PPoI9LuYeFX8V674Z1R6l",
  herenciadebrandes:                "0ocHleb3SllGNQQcDH35Xz",
  cristiancastro:                   "2AZOALDIBORfbzKTuliwdJ",
  lostigresdelrtonne:               "3hYtANQYrE6pd2PbtEyTIy",
  edgardonunez:                     "0mA4dkNGiN4fqTBi2SLlAv",
  juangabriel:                      "2MRBDr0crHWE5JwPceFncq",
  lostucanesdetijuana:               "014WIDx7H4BRCHB1faiisK",
  claveespecial:                    "0NlNru2YcUz6RbnpYGQz26",
  josejose:                         "4mN0qcMxWX8oToqfDPM5yV",
  cardenalesdenuevoleon:            "0GpuSge5ffZ053NhXxgQkV",
  virlangarcia:                     "0vjeBgTzYTwmYoVySJzXGD",
  camila:                           "2gRP1Ezbtj3qrERnd0XasU",
  bandaelrecodo:                    "6AcOTCYBMvjKYy4zms0kaC",
  belinda:                          "5LeiVcEnsZcwc133TUhJNW",
  ynglvcas:                         "1NNRWkhwmcXRimFYSBpB1y",
  jasielunez:                       "0T8Ix53aIN4F7aEKj4EnKy",
  gerardoortiz:                     "4J13m9IZh03PEhoxAxRhXO",
  yahritzaysuseencia:               "51ZSh80McCt7vbqHouzW0A",
  laadictiva:                       "49EE6lVLgU8sp7dFgPshgM",
  selena:                           "6IE6z7DcZIT4Ml3Fh5Ivch",
  belanova:                         "3oNy8cjBtJzLC07I70sklp",
  carlamorrison:                    "0XK6kT7xcZAlcYrNjOgzJe",
  intocable:                        "108moq3rq6bm1M4Ypz0J02",
  anagabriel:                       "41ESHLayJ5sDKjAOv6cMhe",
  thalia:                           "23wEWD21D4TPYiJugoXmYb",
  losgemellosdesinaloa:             "1Zkxm1dM3HI3QkTmxUEVQA",
  losplebesdeleranchodecarielamacho: "6cnl6Jz97730GUS8zEAK77",
  losbukis:                         "16kOCiqZ1auY4sokSeZuKf",
  conjuntoprimavera:                "3nFB4eMP5gdqee2eQb8nZb",
  bandalosrecoditos:                "4bPiOPI4V99cepEftvBYak",
  ivancornejo:                      "6PH3FLQAxtqYy46Zv08bpV",
  pesado:                           "4BwiodzEp9Hwes5HeFjMVK",
  espinozapaz:                      "01rgao9OzfBm2BOHWJpi1Y",
  remmyvalenzuela:                  "4stSxe6AbpXw3x7nRDsYVX",
  lostemerarios:                    "3YbOSxo85kla7RID8ugnW3",
  haash:                            "5xd2Tg7Zo8755eCy8Gxkp8",
  emmanuel:                         "2DmYtFBKcxb3ajwWWgA576",
  elmalilla:                        "6BV37tKh6pY97mnNdTCzly",
  gloriatrevi:                      "1Db5GsIoVWYktPoD2nnPZZ",
  sinbandera:                       "7xeM7V59cA1X8GKyKKQV87",
  pepeaguilar:                      "03Yb3iBy9GCifXiATEFcit",
  arielcamachoylosplebes:           "2Lxa3SFNEW0alfRvtdXOul",
  yuridia:                          "5B8ApeENp4bE4EE3LI8jK2",
  losinvasioresdenuevoleon:          "5CGtBYmVPeLhI1kM2Fn9Gv",
  keniaos:                          "31VFEohvhOUKrtAONEBhMG",
  elfantasma:                       "0my6Pg4I28dVcZLSpAkqhv",
  humbe:                            "1b7AEdUSudOQoZF5ebUxCL",
  bronco:                           "0VKh7CQDi9MkUvaBMoK1V0",
  losdoscarnales:                   "25UNJbwGZSQKvz5cPLWlv3",
  diegoverdaguer:                   "2UFqwY8A3PLcx8pAkg9g5P",
  edicionespecial:                  "7DkseLyOZrdRjCuoWFtqFi",
  valentinelizalde:                 "3CAhiUHkUYT1mFtVHM9SHA",
  paulinarubio:                     "1d6dwipPrsFSJVmFTTdFSS",
  elkomander:                       "2wC90WSKQd0BvdxJZ0mObr",
  panterbelico:                      "7pESOE4dEq8Yk4OKlJa3pS",
  elcoyoteysubandatierrasanta:      "7sQ3Q6yYyg0SdpEezJN8UT",
  gerardocoronel:                   "6JoYL9QYbdgPb6EuE5J2pC",
  bellakath:                        "4yjm4SvYqC5FFuLbB6TyHr",
  grupoarriesgado:                  "5NUPPRjsbXHNyVDrUESYeh",
  edwinlunaylatrakalosademonterrey:  "4LFOoXhMhnq9U8VsZkSwxl",
  t3relemenro:                      "34nbQa7Hug9DYkRJpfKNFv",
  angelaaguilar:                    "3abT87tqQ4Q5PA5nw6CYyH",
  chalinosanchez:                   "7u9m43vPVTERaALXXOzrRq",
  losalegredelbarranco:              "2TSslwx9J30KElgEr68sdv",
  panchobarraza:                    "5dmU7FrmtbQaSzIvGsE4Jp",
  carlosrivera:                     "39yVoqm6sYFvvqF1RciUVf",
  losangelesdecharly:                "01pQZzNIPRiVaCozNUrnyL",
  alejandraguzman:                  "7Hf9AwMO37bSdxHb0FBGmO",
  elbebeto:                         "1YhMWppPt9RVODKD1KCs7W",
  grupobryndis:                     "44WCHvwXBOMz6nm7Mu2ReO",
  dannylux:                         "6ElqtIfQsAkEYypgfJIjeK",
  marisela:                         "73c2MjCAFNyKYIs7nBlqG2",
  codigofn:                         "4A4qYy2jK9DDN1OHV0nLkH",
};

/* ── In-memory maps ────────────────────────────────────────────────────── */
// slug → spotifyId — seeded from hardcoded 109 pairs, expanded at startup
const spotifyIdMap = new Map<string, string>(Object.entries(SPOTIFY_ID_SEED));

/* ── Startup ingestion: parse kworb Spotify artists index ──────────────────
   kworb.net/spotify/artists.html contains ~3000 rows with hrefs like:
     /spotify/artist/12GqGscKJx3aE4t07u7eVZ_songs.html
   We derive the artist slug from the link text and map it to the Spotify ID.
   Runs once at process start; falls back silently to hardcoded seed if it fails.
────────────────────────────────────────────────────────────────────────── */
async function ingestKworbArtistsIndex(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const resp = await fetch("https://kworb.net/spotify/artists.html", {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)",
        "Accept": "text/html",
      },
    });
    clearTimeout(timer);
    if (!resp.ok) return;
    const html = await resp.text();

    // Each row: <a href="/spotify/artist/{ID}_songs.html">{Artist Name}</a>
    const RE = /href="\/spotify\/artist\/([A-Za-z0-9]{22})_songs\.html"[^>]*>([^<]+)<\/a>/g;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = RE.exec(html)) !== null) {
      const spotifyId = match[1];
      const artistName = match[2].trim();
      if (!artistName || !spotifyId) continue;
      const slug = toSlug(artistName);
      if (slug && !spotifyIdMap.has(slug)) {
        spotifyIdMap.set(slug, spotifyId);
        count++;
      }
    }
    if (count > 0) {
      console.log(`[kworb] Ingested ${count} new slug→SpotifyID pairs from artists index (total: ${spotifyIdMap.size})`);
    }
  } catch {
    // Silently fall back to seed map — non-fatal
  }
}

// Fire ingestion in background — does not block server startup
ingestKworbArtistsIndex();

/* ── Types ─────────────────────────────────────────────────────────────── */
interface TrackEntry {
  title: string;
  streams: number;
  streamsFmt: string;
  daily: number;
  dailyFmt: string;
}

interface VideoEntry {
  title: string;
  views: number;
  viewsFmt: string;
  daily: number;
  dailyFmt: string;
  published: string;
}

interface ChartPosition {
  song: string;
  spotifyMx?: number;
  appleMusicMx?: number;
  youtubeMx?: number;
  itunesMx?: number;
  deezerMx?: number;
}

interface KworbStats {
  slug: string;
  spotifyId: string | null;
  spotify: {
    totalStreams: number;
    totalStreamsFmt: string;
    dailyStreams: number;
    dailyStreamsFmt: string;
    trackCount: number;
    topTracks: TrackEntry[];
  } | null;
  youtube: {
    totalViews: number;
    totalViewsFmt: string;
    dailyAvg: number;
    dailyAvgFmt: string;
    topVideos: VideoEntry[];
  } | null;
  chartPositions: ChartPosition[] | null;
}

/* ── Cache ─────────────────────────────────────────────────────────────── */
const statsCache = new Map<string, { data: KworbStats; cachedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCachedStats(slug: string): KworbStats | undefined {
  const entry = statsCache.get(slug);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    statsCache.delete(slug);
    return undefined;
  }
  return entry.data;
}

/* ── Number helpers ────────────────────────────────────────────────────── */
function parseCommaNum(s: string): number {
  if (!s) return 0;
  return parseInt(s.replace(/,/g, "").trim(), 10) || 0;
}

function fmtNum(n: number): string {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/* ── HTML helpers ──────────────────────────────────────────────────────── */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

function parseTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowMatches = html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs);
  for (const rm of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rm[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs);
    for (const cm of cellMatches) {
      cells.push(stripTags(cm[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/* ── HTTP fetch with timeout ───────────────────────────────────────────── */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const resp = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)",
        "Accept": "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

/* ── Parsers ───────────────────────────────────────────────────────────── */

function parseSpotifyPage(html: string): KworbStats["spotify"] {
  const rows = parseTableRows(html);
  let totalStreams = 0;
  let dailyStreams = 0;
  let trackCount = 0;
  const topTracks: TrackEntry[] = [];

  for (const cells of rows) {
    if (!cells.length) continue;
    const first = cells[0];
    if (first === "Streams" && cells[1]) {
      totalStreams = parseCommaNum(cells[1]);
    } else if (first === "Daily" && cells[1]) {
      dailyStreams = parseCommaNum(cells[1]);
    } else if (first === "Tracks" && cells[1]) {
      trackCount = parseCommaNum(cells[1]);
    } else if (
      topTracks.length < 10 &&
      cells.length >= 2 &&
      first &&
      cells[1] &&
      /^\d[\d,]+$/.test(cells[1])
    ) {
      const streams = parseCommaNum(cells[1]);
      const daily = cells[2] ? parseCommaNum(cells[2]) : 0;
      topTracks.push({
        title: first.replace(/^\* /, ""),
        streams,
        streamsFmt: fmtNum(streams),
        daily,
        dailyFmt: fmtNum(daily),
      });
    }
  }

  if (!totalStreams) return null;
  return {
    totalStreams,
    totalStreamsFmt: fmtNum(totalStreams),
    dailyStreams,
    dailyStreamsFmt: fmtNum(dailyStreams),
    trackCount,
    topTracks,
  };
}

function parseYouTubePage(html: string): KworbStats["youtube"] {
  const rows = parseTableRows(html);
  let totalViews = 0;
  let dailyAvg = 0;
  const topVideos: VideoEntry[] = [];

  for (const cells of rows) {
    if (!cells.length) continue;
    if (cells[0] === "Total views:" && cells[1]) {
      totalViews = parseCommaNum(cells[1]);
    } else if (cells[0] === "Current daily avg:" && cells[1]) {
      dailyAvg = parseCommaNum(cells[1]);
    } else if (
      topVideos.length < 10 &&
      cells.length >= 2 &&
      cells[0] &&
      cells[1] &&
      /^\d[\d,]+$/.test(cells[1])
    ) {
      const views = parseCommaNum(cells[1]);
      const daily = cells[2] ? parseCommaNum(cells[2]) : 0;
      topVideos.push({
        title: cells[0],
        views,
        viewsFmt: fmtNum(views),
        daily,
        dailyFmt: fmtNum(daily),
        published: cells[3] ?? "",
      });
    }
  }

  if (!totalViews) return null;
  return {
    totalViews,
    totalViewsFmt: fmtNum(totalViews),
    dailyAvg,
    dailyAvgFmt: fmtNum(dailyAvg),
    topVideos,
  };
}

// Platform section markers in the iTunes page cell text
const PLATFORM_MARKERS: { key: string; field: keyof ChartPosition }[] = [
  { key: "Spotify:",     field: "spotifyMx" },
  { key: "Apple Music:", field: "appleMusicMx" },
  { key: "YouTube:",     field: "youtubeMx" },
  { key: "iTunes:",      field: "itunesMx" },
  { key: "Deezer:",      field: "deezerMx" },
];

function parseItunesPage(html: string): KworbStats["chartPositions"] {
  // Each table cell contains an entire song block: song name + platform chart positions
  const cellMatches = [...html.matchAll(/<td[^>]*>(.*?)<\/td>/gs)];
  const positions: ChartPosition[] = [];

  for (const cm of cellMatches) {
    // Replace <br>, </div>, newlines → space-separated text for easier regex
    const raw = cm[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();

    if (!raw) continue;

    // Song name is everything before the first platform keyword
    const firstPlatformIdx = PLATFORM_MARKERS.reduce((min, p) => {
      const idx = raw.indexOf(p.key);
      return idx >= 0 && idx < min ? idx : min;
    }, raw.length);

    const song = raw.slice(0, firstPlatformIdx).replace(/\n/g, " ").trim();
    if (!song || song.length > 80 || song.length < 1) continue;
    // Filter out album/compilation entries (kworb labels them "Album: X")
    if (/^Album:/i.test(song) || /^Álbum:/i.test(song)) continue;

    const entry: ChartPosition = { song };
    let hasMexico = false;

    // For each platform section, find "#N Mexico" pattern
    for (const { key, field } of PLATFORM_MARKERS) {
      const start = raw.indexOf(key);
      if (start < 0) continue;
      // Platform section ends at the next platform keyword or end of string
      let end = raw.length;
      for (const { key: k2 } of PLATFORM_MARKERS) {
        const idx2 = raw.indexOf(k2, start + key.length);
        if (idx2 >= 0 && idx2 < end) end = idx2;
      }
      const section = raw.slice(start, end);
      const mxMatch = section.match(/#(\d+)\s*Mexico/);
      if (mxMatch) {
        const pos = parseInt(mxMatch[1], 10);
        if (field === "spotifyMx")         entry.spotifyMx     = pos;
        else if (field === "appleMusicMx") entry.appleMusicMx  = pos;
        else if (field === "youtubeMx")    entry.youtubeMx     = pos;
        else if (field === "itunesMx")     entry.itunesMx      = pos;
        else if (field === "deezerMx")     entry.deezerMx      = pos;
        hasMexico = true;
      }
    }

    if (hasMexico) {
      positions.push(entry);
    }
  }

  // Deduplicate by normalized song title (kworb sometimes repeats entries)
  const seen = new Set<string>();
  const deduped = positions.filter(p => {
    const key = p.song.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.length > 0 ? deduped.slice(0, 10) : null;
}

/* ── Fetch full stats for one artist ───────────────────────────────────── */
async function fetchArtistStats(slug: string): Promise<KworbStats> {
  const spotifyId = spotifyIdMap.get(slug) ?? null;

  // Fan out all three fetches in parallel
  const [spotifyHtml, youtubeHtml, itunesHtml] = await Promise.all([
    spotifyId
      ? fetchPage(`https://kworb.net/spotify/artist/${spotifyId}_songs.html`)
      : Promise.resolve(null),
    fetchPage(`https://kworb.net/youtube/artist/${slug}.html`),
    fetchPage(`https://kworb.net/itunes/artist/${slug}.html`),
  ]);

  const spotify   = spotifyHtml  ? parseSpotifyPage(spotifyHtml)   : null;
  const youtube   = youtubeHtml  ? parseYouTubePage(youtubeHtml)   : null;
  const chartPositions = itunesHtml ? parseItunesPage(itunesHtml) : null;

  return { slug, spotifyId, spotify, youtube, chartPositions };
}

/* ── Route: GET /api/kworb/artist-stats?name=ARTIST_NAME ───────────────── */
router.get("/kworb/artist-stats", async (req, res) => {
  const name = (req.query.name as string | undefined)?.trim();
  if (!name) {
    res.status(400).json({ error: "name query parameter required" });
    return;
  }

  const slug = toSlug(name);

  const cached = getCachedStats(slug);
  if (cached) {
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "HIT");
    res.json(cached);
    return;
  }

  try {
    const stats = await fetchArtistStats(slug);
    // Only cache for full 24h when at least one platform parse succeeded;
    // cache all-null results for 1h so transient failures self-heal quickly.
    const hasData = !!(stats.spotify || stats.youtube || stats.chartPositions);
    const ttl = hasData ? CACHE_TTL : 60 * 60 * 1000; // 24h vs 1h
    statsCache.set(slug, { data: stats, cachedAt: Date.now() - (CACHE_TTL - ttl) });
    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.setHeader("X-Cache", "MISS");
    res.json(stats);
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch kworb data", detail: String(err) });
  }
});

/* ── Route: GET /api/kworb/batch-streams?names=A,B,C ───────────────────── */
// Returns { [artistName]: totalSpotifyStreams | null } for roster usage.
// Server-side concurrency is capped at 10 parallel kworb fetches.
router.get("/kworb/batch-streams", async (req, res) => {
  const namesParam = (req.query.names as string | undefined)?.trim();
  if (!namesParam) {
    res.status(400).json({ error: "names query parameter required" });
    return;
  }

  const names = namesParam.split(",").map(n => n.trim()).filter(Boolean).slice(0, 150);
  const result: Record<string, number | null> = {};

  // Process in batches of 10 parallel requests to avoid hammering kworb
  for (let i = 0; i < names.length; i += 10) {
    const batch = names.slice(i, i + 10);
    await Promise.all(
      batch.map(async (name) => {
        const slug = toSlug(name);
        let stats = getCachedStats(slug);
        if (!stats) {
          try {
            stats = await fetchArtistStats(slug);
            // Mirror artist-stats cache policy: 24h for real data, 1h for all-null
            const hasData = !!(stats.spotify || stats.youtube || stats.chartPositions);
            const ttl = hasData ? CACHE_TTL : 60 * 60 * 1000;
            statsCache.set(slug, { data: stats, cachedAt: Date.now() - (CACHE_TTL - ttl) });
          } catch {
            result[name] = null;
            return;
          }
        }
        result[name] = stats.spotify?.totalStreams ?? null;
      })
    );
  }

  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.json(result);
});

/* ── Route: GET /api/kworb/known-slugs ──────────────────────────────────── */
// Returns the list of artist slugs that have profile pages on this site.
// Used by the Charts frontend to decide whether to link an artist name.
router.get("/kworb/known-slugs", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.json({ slugs: ALL_ARTIST_SLUGS });
});

/* ══════════════════════════════════════════════════════════════════════════
   DAILY REFRESH SCHEDULER
   Polls kworb every 60 min during their update window (12pm–9pm ET).
   Stops as soon as a change is detected, then waits for next day's 12pm ET.
   If no change detected by 9:15pm ET, runs one final forced refresh.
══════════════════════════════════════════════════════════════════════════ */

const METADATA_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata";

// All artist slugs covered by the scheduler; starts from the 109 seeds,
// then expanded to all 145+ artists loaded from the metadata sheet at startup.
let ALL_ARTIST_SLUGS: string[] = Object.keys(SPOTIFY_ID_SEED);

async function loadAllArtistSlugs(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const resp = await fetch(METADATA_SHEET_URL, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)" },
    });
    clearTimeout(timer);
    if (!resp.ok) return;
    const csv = await resp.text();
    const lines = csv.split("\n").filter(Boolean);
    if (lines.length < 2) return;

    // Header line — find artist_name column index
    const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").toLowerCase().trim());
    const nameIdx = headers.indexOf("artist_name");
    if (nameIdx < 0) return;

    const slugSet = new Set<string>(Object.keys(SPOTIFY_ID_SEED));
    for (let i = 1; i < lines.length; i++) {
      // Simple quoted-CSV split for the name column
      const parts = lines[i].match(/"([^"]*)"/g);
      const name = parts?.[nameIdx]?.replace(/^"|"$/g, "").trim();
      if (name) slugSet.add(toSlug(name));
    }
    ALL_ARTIST_SLUGS = [...slugSet].filter(Boolean);
    console.log(`[kworb:scheduler] Loaded ${ALL_ARTIST_SLUGS.length} artist slugs for daily refresh`);
  } catch {
    console.log(`[kworb:scheduler] Could not load artist list from sheet — using ${ALL_ARTIST_SLUGS.length} seed slugs`);
  }
}

/* ── Change-detection snapshot ─────────────────────────────────────────── */
// Maps slug → most recently observed stream/view count for delta detection
const streamSnapshot = new Map<string, number>();

/* ── Refresh state ─────────────────────────────────────────────────────── */
const refreshStatus = {
  lastRefreshedAt:  null as number | null,
  artistsUpdated:   0,
  todayUpdated:     false,
  inProgress:       false,
  nextPollAt:       null as number | null,
};

/* ── ET timezone helper ────────────────────────────────────────────────── */
function msUntilNextETTime(targetHour: number, targetMin: number): number {
  // Use the toLocaleString trick to get current wall-clock time in ET
  const etNow  = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const target = new Date(etNow);
  target.setHours(targetHour, targetMin, 0, 0);
  if (target <= etNow) target.setDate(target.getDate() + 1);
  return target.getTime() - etNow.getTime();
}

function currentETHourMin(): { hour: number; min: number } {
  const etNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  return { hour: etNow.getHours(), min: etNow.getMinutes() };
}

/* ── Core refresh cycle ────────────────────────────────────────────────── */
// forced=true  → always update cache, do NOT trigger change-detection stop
// forced=false → compare against snapshot; stop polling for the day if changed
async function runRefreshCycle(forced: boolean): Promise<number> {
  refreshStatus.inProgress = true;
  const label = forced ? "forced" : "poll";
  console.log(`[kworb:scheduler] ${label} started — ${ALL_ARTIST_SLUGS.length} artists`);

  let changedCount = 0;
  const BATCH = 10;
  const DELAY = 2000; // ms between batches

  for (let i = 0; i < ALL_ARTIST_SLUGS.length; i += BATCH) {
    const batch = ALL_ARTIST_SLUGS.slice(i, i + BATCH);
    await Promise.all(batch.map(async (slug) => {
      try {
        const stats     = await fetchArtistStats(slug);
        const hasData   = !!(stats.spotify || stats.youtube || stats.chartPositions);
        const ttl       = hasData ? CACHE_TTL : 60 * 60 * 1000;
        const newVal    = stats.spotify?.totalStreams ?? stats.youtube?.totalViews ?? null;
        const prevVal   = streamSnapshot.get(slug) ?? null;

        // Detect a real numeric change (ignore null→null or first-run nulls)
        if (!forced && newVal !== null && prevVal !== null && newVal !== prevVal) {
          changedCount++;
        }
        if (newVal !== null) streamSnapshot.set(slug, newVal);

        statsCache.set(slug, { data: stats, cachedAt: Date.now() - (CACHE_TTL - ttl) });
      } catch { /* skip individual artist errors */ }
    }));

    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(ALL_ARTIST_SLUGS.length / BATCH);
    if (i + BATCH < ALL_ARTIST_SLUGS.length) {
      console.log(`[kworb:scheduler] batch ${batchNum}/${totalBatches} done`);
      await new Promise(r => setTimeout(r, DELAY));
    }
  }

  refreshStatus.lastRefreshedAt = Date.now();
  refreshStatus.inProgress      = false;
  console.log(`[kworb:scheduler] ${label} complete — ${changedCount} artist(s) changed`);
  return changedCount;
}

/* ── Scheduler state ───────────────────────────────────────────────────── */
let pollTimer:     NodeJS.Timeout | null = null;
let endOfDayTimer: NodeJS.Timeout | null = null;

function clearSchedulerTimers() {
  if (pollTimer)     { clearTimeout(pollTimer);     pollTimer     = null; }
  if (endOfDayTimer) { clearTimeout(endOfDayTimer); endOfDayTimer = null; }
}

function scheduleNextWindow() {
  clearSchedulerTimers();
  // NOTE: do NOT reset todayUpdated here — it must stay true until the next
  // polling window actually opens so /refresh-status reflects it all day.
  const ms = msUntilNextETTime(12, 0);
  refreshStatus.nextPollAt   = Date.now() + ms;
  const hrs = (ms / 3_600_000).toFixed(1);
  console.log(`[kworb:scheduler] Next polling window in ${hrs}h (12pm ET)`);
  pollTimer = setTimeout(() => void startPollingWindow(), ms);
}

async function doPoll(): Promise<void> {
  if (refreshStatus.todayUpdated || refreshStatus.inProgress) return;

  const changed = await runRefreshCycle(false);
  refreshStatus.artistsUpdated = changed;

  if (changed > 0) {
    console.log(`[kworb:scheduler] ✓ Update detected (${changed} artists) — polls done for today`);
    refreshStatus.todayUpdated = true;
    clearSchedulerTimers();
    scheduleNextWindow();
    return;
  }

  // Schedule next hourly poll
  const ms = 60 * 60 * 1000;
  refreshStatus.nextPollAt = Date.now() + ms;
  console.log(`[kworb:scheduler] No changes yet — next poll in 60 min`);
  pollTimer = setTimeout(() => void doPoll(), ms);
}

function startPollingWindow() {
  clearSchedulerTimers();
  refreshStatus.todayUpdated = false; // reset at the start of each new day's window
  console.log(`[kworb:scheduler] Polling window open (12pm–9:15pm ET)`);

  // Final forced refresh at 9:15pm ET regardless of whether we already detected a change
  const msToEnd = msUntilNextETTime(21, 15);
  endOfDayTimer = setTimeout(async () => {
    clearSchedulerTimers();
    if (!refreshStatus.todayUpdated) {
      console.log(`[kworb:scheduler] 9:15pm ET — no change detected today, running final forced refresh`);
      await runRefreshCycle(true);
    }
    scheduleNextWindow();
  }, msToEnd);

  // Start hourly polling immediately
  void doPoll();
}

async function initScheduler(): Promise<void> {
  // Load full artist list from metadata sheet before starting
  await loadAllArtistSlugs();

  // Warm the cache and populate the snapshot before polling begins
  console.log(`[kworb:scheduler] Startup refresh — warming cache and populating snapshot`);
  await runRefreshCycle(true);

  // Determine where we are relative to the ET polling window
  const { hour, min } = currentETHourMin();
  const totalMin      = hour * 60 + min;
  const windowStart   = 12 * 60;       // 12:00 ET
  const windowEnd     = 21 * 60 + 15;  // 21:15 ET

  if (totalMin >= windowStart && totalMin < windowEnd) {
    console.log(`[kworb:scheduler] Started inside polling window (${hour}:${String(min).padStart(2, "0")} ET)`);
    startPollingWindow();
  } else if (totalMin >= windowEnd) {
    console.log(`[kworb:scheduler] Past today's window — waiting for tomorrow 12pm ET`);
    scheduleNextWindow();
  } else {
    console.log(`[kworb:scheduler] Before today's window — waiting for 12pm ET`);
    scheduleNextWindow();
  }
}

// Kick off scheduler 3 s after startup (lets the server bind and kworb index ingest first)
setTimeout(() => void initScheduler(), 3000);

/* ── Route: GET /api/kworb/refresh-status ─────────────────────────────── */
router.get("/kworb/refresh-status", (_req, res) => {
  res.json({
    lastRefreshedAt:  refreshStatus.lastRefreshedAt,
    lastRefreshedFmt: refreshStatus.lastRefreshedAt
      ? new Date(refreshStatus.lastRefreshedAt).toISOString()
      : null,
    nextPollAt:       refreshStatus.nextPollAt,
    nextPollFmt:      refreshStatus.nextPollAt
      ? new Date(refreshStatus.nextPollAt).toISOString()
      : null,
    todayUpdated:     refreshStatus.todayUpdated,
    artistsUpdated:   refreshStatus.artistsUpdated,
    inProgress:       refreshStatus.inProgress,
    totalArtists:     ALL_ARTIST_SLUGS.length,
  });
});

export default router;
