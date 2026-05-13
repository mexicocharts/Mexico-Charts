import { Router } from "express";
import { db, pool, kworbCoverage, kworbSnapshots } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

/* ══════════════════════════════════════════════════════════════════════════
   KILL SWITCH
   Set KWORB_FETCHING_ENABLED=false to disable all outbound kworb scraping
   instantly, without breaking Mexico Charts (cached snapshots still served).
══════════════════════════════════════════════════════════════════════════ */
const FETCHING_ENABLED = (): boolean =>
  process.env["KWORB_FETCHING_ENABLED"] !== "false";

/* ══ Constants ════════════════════════════════════════════════════════════ */
const DAILY_CAP      = 1_800; // max outbound kworb HTTP requests per day (541 × 3 + margin)
const HOURLY_CAP     = 180;   // max per hour (~4.3 req/min headroom)
const MAX_ATTEMPTS   = 5;     // before marking artist as not_found

// Smooth pacing: target ~1 request every 25–60 s to avoid bursting kworb
// At the midpoint (42.5 s avg) → ~2,023 requests/day, within DAILY_CAP
const PACE_MIN_MS    = 25_000;  // minimum gap between individual kworb page fetches
const PACE_JITTER_MS = 35_000;  // extra random jitter (0–35 s) on top of min

// Tier refresh intervals (ms) — ±20% jitter is added at enqueue time
const TIER_INTERVAL_MS: Record<string, number> = {
  A: 24 * 3_600_000,         // daily
  B: 2.5 * 24 * 3_600_000,  // ~2.5 days
  C: 7 * 24 * 3_600_000,    // weekly
  D: 21 * 24 * 3_600_000,   // ~3 weeks (rare retry for not_found)
};

// Job priority — lower number = runs sooner
const TIER_PRIORITY: Record<string, number> = { A: 10, B: 30, C: 50, D: 80 };

// How long before a snapshot is considered stale (still served, flagged in admin)
const SNAPSHOT_TTL_MS: Record<string, number> = {
  A: 26 * 3_600_000,
  B: 3.5 * 24 * 3_600_000,
  C: 8 * 24 * 3_600_000,
  D: 30 * 24 * 3_600_000,
};

// Exponential backoff for failures (ms), indexed by 0-based attempt count
const BACKOFF_MS = [
  5 * 60_000,      // 5 min
  15 * 60_000,     // 15 min
  3_600_000,       // 1 h
  4 * 3_600_000,   // 4 h
  24 * 3_600_000,  // 24 h
];

/* ══ Tier / sentinel slugs ════════════════════════════════════════════════ */

// 10 sentinel artists used to detect whether kworb has published today's update
const SENTINEL_SLUGS = new Set([
  "pesopluma", "fuerzaregida", "grupofrontera", "juniorh", "natanaelcano",
  "carinleon", "eslabonarmado", "gabitoballesteros", "titodoublep", "xavi",
  "luismiguel",
]);

// Tier A = highest-traffic artists, refreshed daily
const TIER_A_SLUGS = new Set([
  "pesopluma", "fuerzaregida", "grupofrontera", "juniorh", "natanaelcano",
  "carinleon", "eslabonarmado", "gabitoballesteros", "titodoublep", "oscarmaydon",
  "xavi", "grupofirme", "ynglvcas", "luisrconriquez", "grupomarcaregistrada",
  "edenmunoz", "christiannodal", "angelaaguilar", "dannylux", "ivancornejo",
  "calle24", "leninramirez", "bandamsdesergiolizarraga", "chinopacas",
  "elbogueto", "gerardoortiz", "virlangarcia", "luismiguel",
]);

/* ══ Rate limiter ═════════════════════════════════════════════════════════ */
let requestsToday    = 0;
let requestsThisHour = 0;
const requestsByMetric: Record<string, number> = { spotify: 0, youtube: 0, itunes: 0 };

function nextDayMs():  number { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); }
function nextHourMs(): number { const d = new Date(); d.setMinutes(60, 0, 0);  return d.getTime(); }

let dailyResetAt  = nextDayMs();
let hourlyResetAt = nextHourMs();

function acquireSlot(metricType?: string): boolean {
  const now = Date.now();
  if (now >= dailyResetAt)  { requestsToday    = 0; dailyResetAt  = nextDayMs();  }
  if (now >= hourlyResetAt) { requestsThisHour = 0; hourlyResetAt = nextHourMs(); }
  if (requestsToday >= DAILY_CAP || requestsThisHour >= HOURLY_CAP) return false;
  requestsToday++;
  requestsThisHour++;
  if (metricType && metricType in requestsByMetric) {
    requestsByMetric[metricType] = (requestsByMetric[metricType] ?? 0) + 1;
  }
  return true;
}

/* ══ Micro helpers ════════════════════════════════════════════════════════ */
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

/* ══ Smooth pacer ═════════════════════════════════════════════════════════
   Ensures kworb HTTP requests are spaced PACE_MIN_MS–(PACE_MIN_MS+PACE_JITTER_MS)
   apart regardless of how many jobs are pending. This prevents bursting even
   when many artists are due simultaneously.
══════════════════════════════════════════════════════════════════════════ */
let lastRequestAt = 0;

async function pacedSlot(metricType: string): Promise<boolean> {
  if (!acquireSlot(metricType)) return false;
  const now      = Date.now();
  const elapsed  = now - lastRequestAt;
  const minGap   = PACE_MIN_MS;
  if (elapsed < minGap) await sleep(minGap - elapsed);
  await sleep(Math.random() * PACE_JITTER_MS); // 0–35 s extra jitter
  lastRequestAt = Date.now();
  return true;
}

/* ══ Slug utility ═════════════════════════════════════════════════════════ */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/* ══ SPOTIFY_ID_SEED (109 confirmed slug → SpotifyID pairs) ══════════════ */
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
  lostucanesdetijuana:              "014WIDx7H4BRCHB1faiisK",
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
  losinvasioresdenuevoleon:         "5CGtBYmVPeLhI1kM2Fn9Gv",
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
  panterbelico:                     "7pESOE4dEq8Yk4OKlJa3pS",
  elcoyoteysubandatierrasanta:      "7sQ3Q6yYyg0SdpEezJN8UT",
  gerardocoronel:                   "6JoYL9QYbdgPb6EuE5J2pC",
  bellakath:                        "4yjm4SvYqC5FFuLbB6TyHr",
  grupoarriesgado:                  "5NUPPRjsbXHNyVDrUESYeh",
  edwinlunaylatrakalosademonterrey: "4LFOoXhMhnq9U8VsZkSwxl",
  t3relemenro:                      "34nbQa7Hug9DYkRJpfKNFv",
  angelaaguilar:                    "3abT87tqQ4Q5PA5nw6CYyH",
  chalinosanchez:                   "7u9m43vPVTERaALXXOzrRq",
  losalegredelbarranco:             "2TSslwx9J30KElgEr68sdv",
  panchobarraza:                    "5dmU7FrmtbQaSzIvGsE4Jp",
  carlosrivera:                     "39yVoqm6sYFvvqF1RciUVf",
  losangelesdecharly:               "01pQZzNIPRiVaCozNUrnyL",
  alejandraguzman:                  "7Hf9AwMO37bSdxHb0FBGmO",
  elbebeto:                         "1YhMWppPt9RVODKD1KCs7W",
  grupobryndis:                     "44WCHvwXBOMz6nm7Mu2ReO",
  dannylux:                         "6ElqtIfQsAkEYypgfJIjeK",
  marisela:                         "73c2MjCAFNyKYIs7nBlqG2",
  codigofn:                         "4A4qYy2jK9DDN1OHV0nLkH",
};

/* ══ In-memory slug → Spotify ID map ═════════════════════════════════════ */
const spotifyIdMap = new Map<string, string>(Object.entries(SPOTIFY_ID_SEED));

/* ══ Startup: ingest kworb artists index (lightweight — 1 HTTP request) ══ */
async function ingestKworbArtistsIndex(): Promise<void> {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const resp  = await fetch("https://kworb.net/spotify/artists.html", {
      signal:  ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)", "Accept": "text/html" },
    });
    clearTimeout(timer);
    if (!resp.ok) return;
    const html = await resp.text();

    const RE = /href="\/spotify\/artist\/([A-Za-z0-9]{22})_songs\.html"[^>]*>([^<]+)<\/a>/g;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = RE.exec(html)) !== null) {
      const spotifyId  = match[1];
      const artistName = match[2].trim();
      if (!artistName || !spotifyId) continue;
      const slug = toSlug(artistName);
      if (slug && !spotifyIdMap.has(slug)) {
        spotifyIdMap.set(slug, spotifyId);
        count++;
      }
    }
    if (count > 0) console.log(`[kworb] Ingested ${count} new slug→SpotifyID pairs (total: ${spotifyIdMap.size})`);
  } catch {
    // Silently fall back to seed map — non-fatal
  }
}

/* ══ Types ════════════════════════════════════════════════════════════════ */
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

// Raw postgres row shape for jobs (snake_case from pg driver)
interface KworbJobRow {
  id: number;
  artist_key: string;
  metric_type: string;
  priority: number;
  due_at: Date;
  attempts: number;
  status: string;
}

/* ══ Number helpers ═══════════════════════════════════════════════════════ */
function parseCommaNum(s: string): number {
  if (!s) return 0;
  return parseInt(s.replace(/,/g, "").trim(), 10) || 0;
}

function fmtNum(n: number): string {
  if (!n || n <= 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/* ══ HTML helpers ═════════════════════════════════════════════════════════ */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

function parseTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowMatches = html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs);
  for (const rm of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rm[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs);
    for (const cm of cellMatches) cells.push(stripTags(cm[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/* ══ HTTP fetch with timeout ══════════════════════════════════════════════ */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const resp  = await fetch(url, {
      signal:  ctrl.signal,
      headers: {
        "User-Agent":      "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)",
        "Accept":          "text/html",
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

/* ══ Parsers ══════════════════════════════════════════════════════════════ */
function parseSpotifyPage(html: string): KworbStats["spotify"] {
  const rows = parseTableRows(html);
  let totalStreams = 0, dailyStreams = 0, trackCount = 0;
  const topTracks: TrackEntry[] = [];

  for (const cells of rows) {
    if (!cells.length) continue;
    const first = cells[0];
    if      (first === "Streams" && cells[1]) totalStreams = parseCommaNum(cells[1]);
    else if (first === "Daily"   && cells[1]) dailyStreams = parseCommaNum(cells[1]);
    else if (first === "Tracks"  && cells[1]) trackCount   = parseCommaNum(cells[1]);
    else if (
      topTracks.length < 10 && cells.length >= 2 &&
      first && cells[1] && /^\d[\d,]+$/.test(cells[1])
    ) {
      const streams = parseCommaNum(cells[1]);
      const daily   = cells[2] ? parseCommaNum(cells[2]) : 0;
      topTracks.push({ title: first.replace(/^\* /, ""), streams, streamsFmt: fmtNum(streams), daily, dailyFmt: fmtNum(daily) });
    }
  }

  if (!totalStreams) return null;
  return { totalStreams, totalStreamsFmt: fmtNum(totalStreams), dailyStreams, dailyStreamsFmt: fmtNum(dailyStreams), trackCount, topTracks };
}

function parseYouTubePage(html: string): KworbStats["youtube"] {
  const rows = parseTableRows(html);
  let totalViews = 0, dailyAvg = 0;
  const topVideos: VideoEntry[] = [];

  for (const cells of rows) {
    if (!cells.length) continue;
    if      (cells[0] === "Total views:"       && cells[1]) totalViews = parseCommaNum(cells[1]);
    else if (cells[0] === "Current daily avg:" && cells[1]) dailyAvg   = parseCommaNum(cells[1]);
    else if (
      topVideos.length < 10 && cells.length >= 2 &&
      cells[0] && cells[1] && /^\d[\d,]+$/.test(cells[1])
    ) {
      const views = parseCommaNum(cells[1]);
      const daily = cells[2] ? parseCommaNum(cells[2]) : 0;
      topVideos.push({ title: cells[0], views, viewsFmt: fmtNum(views), daily, dailyFmt: fmtNum(daily), published: cells[3] ?? "" });
    }
  }

  if (!totalViews) return null;
  return { totalViews, totalViewsFmt: fmtNum(totalViews), dailyAvg, dailyAvgFmt: fmtNum(dailyAvg), topVideos };
}

const PLATFORM_MARKERS: { key: string; field: keyof ChartPosition }[] = [
  { key: "Spotify:",      field: "spotifyMx"     },
  { key: "Apple Music:",  field: "appleMusicMx"  },
  { key: "YouTube:",      field: "youtubeMx"     },
  { key: "iTunes:",       field: "itunesMx"      },
  { key: "Deezer:",       field: "deezerMx"      },
];

function parseItunesPage(html: string): KworbStats["chartPositions"] {
  const cellMatches = [...html.matchAll(/<td[^>]*>(.*?)<\/td>/gs)];
  const positions: ChartPosition[] = [];

  for (const cm of cellMatches) {
    const raw = cm[1]
      .replace(/<br\s*\/?>/gi, "\n").replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim();
    if (!raw) continue;

    const firstPlatformIdx = PLATFORM_MARKERS.reduce((min, p) => {
      const idx = raw.indexOf(p.key);
      return idx >= 0 && idx < min ? idx : min;
    }, raw.length);

    const song = raw.slice(0, firstPlatformIdx).replace(/\n/g, " ").trim();
    if (!song || song.length > 80 || song.length < 1) continue;
    if (/^Album:/i.test(song) || /^Álbum:/i.test(song)) continue;

    const entry: ChartPosition = { song };
    let hasMexico = false;

    for (const { key, field } of PLATFORM_MARKERS) {
      const start = raw.indexOf(key);
      if (start < 0) continue;
      let end = raw.length;
      for (const { key: k2 } of PLATFORM_MARKERS) {
        const idx2 = raw.indexOf(k2, start + key.length);
        if (idx2 >= 0 && idx2 < end) end = idx2;
      }
      const section = raw.slice(start, end);
      const mxMatch = section.match(/#(\d+)\s*Mexico/);
      if (mxMatch) {
        const pos = parseInt(mxMatch[1], 10);
        if      (field === "spotifyMx")     entry.spotifyMx     = pos;
        else if (field === "appleMusicMx")  entry.appleMusicMx  = pos;
        else if (field === "youtubeMx")     entry.youtubeMx     = pos;
        else if (field === "itunesMx")      entry.itunesMx      = pos;
        else if (field === "deezerMx")      entry.deezerMx      = pos;
        hasMexico = true;
      }
    }
    if (hasMexico) positions.push(entry);
  }

  const seen = new Set<string>();
  const deduped = positions.filter(p => {
    const key = p.song.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.length > 0 ? deduped.slice(0, 10) : null;
}

/* ══ ALL_ARTIST_SLUGS (for /known-slugs endpoint) ════════════════════════ */
let ALL_ARTIST_SLUGS: string[] = [...Object.keys(SPOTIFY_ID_SEED)];

async function loadSlugListFromCoverage(): Promise<void> {
  try {
    const rows = await db.select({ slug: kworbCoverage.artistKey }).from(kworbCoverage);
    if (rows.length > 0) ALL_ARTIST_SLUGS = rows.map(r => r.slug);
  } catch { /* fall back to seed list */ }
}

/* ══ DB helpers ═══════════════════════════════════════════════════════════ */
async function getSnapshot(artistKey: string, metricType: string): Promise<unknown | null> {
  const rows = await db
    .select({ value: kworbSnapshots.value })
    .from(kworbSnapshots)
    .where(and(eq(kworbSnapshots.artistKey, artistKey), eq(kworbSnapshots.metricType, metricType)))
    .limit(1);
  return rows[0]?.value ?? null;
}

async function saveSnapshot(
  artistKey: string, metricType: string, value: unknown, tier: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + (SNAPSHOT_TTL_MS[tier] ?? SNAPSHOT_TTL_MS.B));
  await db
    .insert(kworbSnapshots)
    .values({ artistKey, metricType, value: value as Record<string, unknown>, expiresAt })
    .onConflictDoUpdate({
      target: [kworbSnapshots.artistKey, kworbSnapshots.metricType],
      set: {
        value:     sql`EXCLUDED.value`,
        fetchedAt: sql`now()`,
        expiresAt: sql`EXCLUDED.expires_at`,
      },
    });
}

/* ══ Job queue ════════════════════════════════════════════════════════════ */
async function claimNextJob(): Promise<KworbJobRow | null> {
  const r = await pool.query<KworbJobRow>(`
    UPDATE kworb_jobs
    SET  status       = 'running',
         locked_until = now() + interval '20 minutes',
         attempts     = attempts + 1,
         updated_at   = now()
    WHERE id = (
      SELECT id FROM kworb_jobs
      WHERE  status = 'pending' AND due_at <= now()
      ORDER  BY priority ASC, due_at ASC
      LIMIT  1
      FOR    UPDATE SKIP LOCKED
    )
    RETURNING id, artist_key, metric_type, priority, due_at, attempts, status
  `);
  return r.rows[0] ?? null;
}

async function enqueueJob(
  artistKey: string, metricType: string, priority: number, dueAt: Date,
): Promise<void> {
  // Skip if a pending or running job already exists for this artist+metric
  await pool.query(`
    INSERT INTO kworb_jobs (artist_key, metric_type, priority, due_at, status)
    SELECT $1, $2, $3, $4, 'pending'
    WHERE  NOT EXISTS (
      SELECT 1 FROM kworb_jobs
      WHERE  artist_key = $1 AND metric_type = $2 AND status IN ('pending','running')
    )
  `, [artistKey, metricType, priority, dueAt]);
}

/* ══ Core fetch & store ═══════════════════════════════════════════════════ */
async function fetchAndStore(
  slug: string, metricType: string, tier: string, spotifyId: string | null,
): Promise<"success" | "not_found" | "rate_limited" | "error"> {
  if (!FETCHING_ENABLED()) return "rate_limited";

  const doAll = metricType === "all";
  let spotify: ReturnType<typeof parseSpotifyPage> = null;
  let youtube: ReturnType<typeof parseYouTubePage> = null;
  let itunes:  ReturnType<typeof parseItunesPage>  = null;

  // Spotify
  if ((doAll || metricType === "spotify") && spotifyId) {
    if (!await pacedSlot("spotify")) return "rate_limited";
    const html = await fetchPage(`https://kworb.net/spotify/artist/${spotifyId}_songs.html`);
    if (html) spotify = parseSpotifyPage(html);
  }

  // YouTube
  if (doAll || metricType === "youtube") {
    if (!await pacedSlot("youtube")) return "rate_limited";
    const html = await fetchPage(`https://kworb.net/youtube/artist/${slug}.html`);
    if (html) youtube = parseYouTubePage(html);
  }

  // iTunes / chart positions
  if (doAll || metricType === "itunes") {
    if (!await pacedSlot("itunes")) return "rate_limited";
    const html = await fetchPage(`https://kworb.net/itunes/artist/${slug}.html`);
    if (html) itunes = parseItunesPage(html);
  }

  if (!spotify && !youtube && !itunes) return "not_found";

  if (spotify) await saveSnapshot(slug, "spotify", spotify, tier);
  if (youtube) await saveSnapshot(slug, "youtube", youtube, tier);
  if (itunes)  await saveSnapshot(slug, "itunes",  itunes,  tier);

  // Upsert coverage record
  await db
    .insert(kworbCoverage)
    .values({
      artistKey:           slug,
      artistName:          slug,
      spotifyId:           spotifyId ?? undefined,
      hasSpotify:          !!spotify,
      hasYoutube:          !!youtube,
      hasItunes:           !!itunes,
      tier,
      status:              "active",
      consecutiveFailures: 0,
      lastFetchAt:         new Date(),
      lastDiscoveredAt:    new Date(),
    })
    .onConflictDoUpdate({
      target: kworbCoverage.artistKey,
      set: {
        spotifyId:           spotifyId !== null ? spotifyId : sql`kworb_coverage.spotify_id`,
        hasSpotify:          !!spotify,
        hasYoutube:          !!youtube,
        hasItunes:           !!itunes,
        status:              "active",
        consecutiveFailures: 0,
        lastFetchAt:         new Date(),
        lastDiscoveredAt:    new Date(),
      },
    });

  return "success";
}

/* ══════════════════════════════════════════════════════════════════════════
   BACKGROUND WORKER
   Single worker, rate-limited, with jitter between requests.
   Never started in bulk at startup — picks up pending DB jobs organically.
══════════════════════════════════════════════════════════════════════════ */
let workerActive = false;

async function runWorker(): Promise<void> {
  if (workerActive) return;
  workerActive = true;
  console.log("[kworb:worker] Started");
  console.log(`[kworb:worker] Fetching: ${FETCHING_ENABLED() ? "ENABLED" : "DISABLED (kill switch)"}`);

  while (true) {
    try {
      if (!FETCHING_ENABLED()) { await sleep(30_000); continue; }

      const job = await claimNextJob();
      if (!job) { await sleep(60_000); continue; } // no pending jobs

      const [cov] = await db.select()
        .from(kworbCoverage)
        .where(eq(kworbCoverage.artistKey, job.artist_key))
        .limit(1);

      const tier      = cov?.tier      ?? (TIER_A_SLUGS.has(job.artist_key) ? "A" : "B");
      const spotifyId = cov?.spotifyId ?? spotifyIdMap.get(job.artist_key)  ?? null;

      const result = await fetchAndStore(job.artist_key, job.metric_type, tier, spotifyId);

      if (result === "rate_limited") {
        // Release the job without consuming the attempt
        await pool.query(`
          UPDATE kworb_jobs
          SET  status       = 'pending',
               locked_until = null,
               attempts     = GREATEST(0, attempts - 1),
               updated_at   = now()
          WHERE id = $1
        `, [job.id]);
        await sleep(5 * 60_000); // 5 min cooldown when rate-limited
        continue;
      }

      if (result === "success") {
        await pool.query(
          `UPDATE kworb_jobs SET status='done', updated_at=now() WHERE id=$1`,
          [job.id],
        );
        // Schedule next refresh with ±10% jitter
        const base    = TIER_INTERVAL_MS[tier] ?? TIER_INTERVAL_MS.B;
        const drift   = base * 0.1 * (Math.random() - 0.5);
        const nextDue = new Date(Date.now() + base + drift);
        // Urgency escalation: if this artist was already overdue by >1 interval,
        // schedule with boosted priority (lower number = runs sooner) so
        // consistently late artists self-correct without skipping lower tiers.
        const wasOverdue = job.due_at < new Date(Date.now() - base);
        const basePriority = TIER_PRIORITY[tier] ?? 30;
        const nextPriority = wasOverdue ? Math.max(1, basePriority - 15) : basePriority;
        await enqueueJob(job.artist_key, "all", nextPriority, nextDue);

      } else {
        // not_found | error — apply exponential backoff
        const failures = job.attempts; // already incremented by claimNextJob

        await db.update(kworbCoverage)
          .set({ consecutiveFailures: failures, lastFailedAt: new Date() })
          .where(eq(kworbCoverage.artistKey, job.artist_key));

        if (failures >= MAX_ATTEMPTS) {
          await pool.query(
            `UPDATE kworb_jobs SET status='done', updated_at=now() WHERE id=$1`,
            [job.id],
          );
          await db.update(kworbCoverage)
            .set({ status: "not_found" })
            .where(eq(kworbCoverage.artistKey, job.artist_key));
          // Rare retry ~3 weeks out with random spread
          const retryDue = new Date(
            Date.now() + 21 * 24 * 3_600_000 + Math.random() * 7 * 24 * 3_600_000,
          );
          await enqueueJob(job.artist_key, "all", TIER_PRIORITY.D, retryDue);
          console.log(`[kworb:worker] ${job.artist_key}: not found after ${failures} attempts — retry in ~3w`);
        } else {
          const backoffMs = BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[4];
          const nextDue   = new Date(Date.now() + backoffMs);
          await pool.query(`
            UPDATE kworb_jobs
            SET  status='pending', due_at=$2, locked_until=null, updated_at=now()
            WHERE id=$1
          `, [job.id, nextDue]);
        }
      }

      await sleep(2_000); // brief pause between jobs

    } catch (err) {
      console.error("[kworb:worker] Unhandled error:", err);
      await sleep(30_000);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   SENTINEL DETECTOR
   Checks 10 major artists to detect when kworb publishes today's update.
   Runs every 15 min but enforces a 1h minimum gap between actual enqueues.
   Only active during 12pm–9pm ET (kworb's known update window).
══════════════════════════════════════════════════════════════════════════ */
let sentinelLastAt = 0;
const SENTINEL_INTERVAL_MS = 60 * 60_000; // 1 h between actual checks

function etHour(): number {
  return +new Date().toLocaleString("en-US", {
    timeZone: "America/New_York", hour: "numeric", hour12: false,
  });
}

async function runSentinel(): Promise<void> {
  const now = Date.now();
  const hour = etHour();
  if (hour < 12 || hour >= 21) return; // outside kworb update window
  if (now - sentinelLastAt < SENTINEL_INTERVAL_MS) return;
  sentinelLastAt = now;

  try {
    // Check if sentinel artists' snapshots are older than 20 h
    const rows = await db
      .select({ artistKey: kworbSnapshots.artistKey, fetchedAt: kworbSnapshots.fetchedAt })
      .from(kworbSnapshots)
      .where(eq(kworbSnapshots.metricType, "spotify"));

    const staleThreshold = new Date(now - 20 * 3_600_000);
    const freshCount = rows.filter(
      r => SENTINEL_SLUGS.has(r.artistKey) && r.fetchedAt > staleThreshold,
    ).length;

    if (freshCount >= SENTINEL_SLUGS.size) {
      console.log("[kworb:sentinel] All sentinels fresh — skipping enqueue");
      return;
    }

    console.log(`[kworb:sentinel] ${SENTINEL_SLUGS.size - freshCount} sentinel(s) stale — enqueuing Tier A`);

    // Immediately enqueue Tier A artists
    const tierARows = await db
      .select({ artistKey: kworbCoverage.artistKey })
      .from(kworbCoverage)
      .where(eq(kworbCoverage.tier, "A"));

    for (const { artistKey } of tierARows) {
      await enqueueJob(artistKey, "all", TIER_PRIORITY.A, new Date());
    }

    // Enqueue Tier B with 0–4h spread to avoid a burst
    const tierBRows = await db
      .select({ artistKey: kworbCoverage.artistKey })
      .from(kworbCoverage)
      .where(eq(kworbCoverage.tier, "B"));

    for (const { artistKey } of tierBRows) {
      const dueAt = new Date(Date.now() + Math.random() * 4 * 3_600_000);
      await enqueueJob(artistKey, "all", TIER_PRIORITY.B, dueAt);
    }

  } catch (err) {
    console.error("[kworb:sentinel] Error:", err);
  }
}

async function startSentinelLoop(): Promise<void> {
  while (true) {
    await runSentinel().catch(() => {});
    await sleep(15 * 60_000);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   SEED COVERAGE
   Populates kworb_coverage from the 541-artist metadata sheet.
   Called via POST /api/kworb/admin/seed-coverage.
   Spreads initial job due_at over hours/days to avoid a startup burst.
══════════════════════════════════════════════════════════════════════════ */
const METADATA_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata";

async function seedCoverage(
  enqueueInitialJobs = true,
): Promise<{ upserted: number; queued: number }> {
  const resp = await fetch(METADATA_SHEET_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) throw new Error(`Metadata sheet HTTP ${resp.status}`);

  const csv   = await resp.text();
  const lines = csv.split("\n").filter(Boolean);
  const hdrs  = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").toLowerCase().trim());
  const nameIdx = hdrs.indexOf("artist_name");
  if (nameIdx < 0) throw new Error("artist_name column not found in metadata sheet");

  const artists: { name: string; slug: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].match(/"([^"]*)"/g);
    const name  = parts?.[nameIdx]?.replace(/^"|"$/g, "").trim();
    if (name) artists.push({ name, slug: toSlug(name) });
  }

  let upserted = 0;
  let queued   = 0;

  for (const { name, slug } of artists) {
    if (!slug) continue;
    const tier      = TIER_A_SLUGS.has(slug) ? "A" : "B";
    const spotifyId = spotifyIdMap.get(slug) ?? null;

    await db
      .insert(kworbCoverage)
      .values({ artistKey: slug, artistName: name, spotifyId: spotifyId ?? undefined, tier, status: "pending" })
      .onConflictDoUpdate({
        target: kworbCoverage.artistKey,
        set: {
          artistName: name,
          spotifyId:  spotifyId !== null ? spotifyId : sql`kworb_coverage.spotify_id`,
          tier,
        },
      });
    upserted++;

    if (enqueueInitialJobs) {
      // Tier A = fetch immediately; Tier B = spread over 0–48h
      const spreadMs = tier === "A" ? 0 : Math.random() * 48 * 3_600_000;
      await enqueueJob(slug, "all", TIER_PRIORITY[tier] ?? 30, new Date(Date.now() + spreadMs));
      queued++;
    }
  }

  ALL_ARTIST_SLUGS = artists.map(a => a.slug).filter(Boolean);
  console.log(`[kworb:seed] ${upserted} artists upserted, ${queued} jobs queued`);
  return { upserted, queued };
}

/* ══════════════════════════════════════════════════════════════════════════
   STARTUP
   1. Ingest Spotify ID map from kworb's artists index (1 HTTP request)
   2. Load slug list from coverage table
   3. Start worker — resumes any existing pending jobs from DB
   4. Start sentinel loop
   Does NOT warm up all 541 artists at boot.
══════════════════════════════════════════════════════════════════════════ */
async function startup(): Promise<void> {
  await ingestKworbArtistsIndex();
  await loadSlugListFromCoverage();
  void runWorker();
  void startSentinelLoop();
  console.log("[kworb] Startup complete — worker running, sentinel active");
  console.log(`[kworb] Kill switch: KWORB_FETCHING_ENABLED=${FETCHING_ENABLED()}`);
  console.log(`[kworb] Daily cap: ${DAILY_CAP}  Hourly cap: ${HOURLY_CAP}`);
}

setTimeout(() => void startup(), 3_000);

/* ══════════════════════════════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════════════════════════════ */

/* GET /api/kworb/artist-stats?name=X  — cache-first, never scrapes live */
router.get("/kworb/artist-stats", async (req, res) => {
  const name = (req.query.name as string | undefined)?.trim();
  if (!name) { res.status(400).json({ error: "name query parameter required" }); return; }

  const slug = toSlug(name);

  const [cov] = await db.select().from(kworbCoverage).where(eq(kworbCoverage.artistKey, slug)).limit(1);
  const tier      = cov?.tier      ?? (TIER_A_SLUGS.has(slug) ? "A" : "B");
  const spotifyId = cov?.spotifyId ?? spotifyIdMap.get(slug) ?? null;

  const snaps = await db
    .select({ metricType: kworbSnapshots.metricType, value: kworbSnapshots.value })
    .from(kworbSnapshots)
    .where(eq(kworbSnapshots.artistKey, slug));

  const snapMap = new Map(snaps.map(s => [s.metricType, s.value]));

  const stats: KworbStats = {
    slug,
    spotifyId,
    spotify:        (snapMap.get("spotify") as KworbStats["spotify"])        ?? null,
    youtube:        (snapMap.get("youtube") as KworbStats["youtube"])        ?? null,
    chartPositions: (snapMap.get("itunes")  as KworbStats["chartPositions"]) ?? null,
  };

  const hasCachedData = !!(stats.spotify || stats.youtube || stats.chartPositions);

  // No cached data → enqueue a normal-priority background job so the worker
  // will fetch it on its next cycle. We do NOT scrape live from public routes.
  // Priority 20 = above Tier B defaults (30) but well below admin-triggered (5).
  if (!hasCachedData && FETCHING_ENABLED()) {
    await db.insert(kworbCoverage)
      .values({ artistKey: slug, artistName: name, spotifyId: spotifyId ?? undefined, tier, status: "pending" })
      .onConflictDoNothing();
    await enqueueJob(slug, "all", 20, new Date());
  }

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.setHeader("X-Cache", hasCachedData ? "HIT" : "MISS");
  res.setHeader("X-Data-Status", hasCachedData ? "cached" : "pending");
  res.json({ ...stats, _status: hasCachedData ? "cached" : "pending" });
});

/* GET /api/kworb/batch-streams?names=A,B,C  — cache-first, single DB query */
router.get("/kworb/batch-streams", async (req, res) => {
  const namesParam = (req.query.names as string | undefined)?.trim();
  if (!namesParam) { res.status(400).json({ error: "names query parameter required" }); return; }

  const names = namesParam.split(",").map(n => n.trim()).filter(Boolean).slice(0, 150);

  // Single DB read for all Spotify snapshots
  const rows = await db
    .select({ artistKey: kworbSnapshots.artistKey, value: kworbSnapshots.value })
    .from(kworbSnapshots)
    .where(eq(kworbSnapshots.metricType, "spotify"));

  const snapMap = new Map(rows.map(r => [r.artistKey, r.value as { totalStreams?: number } | null]));

  const result: Record<string, number | null> = {};
  for (const name of names) {
    result[name] = snapMap.get(toSlug(name))?.totalStreams ?? null;
  }

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.json(result);
});

/* GET /api/kworb/known-slugs */
router.get("/kworb/known-slugs", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  res.json({ slugs: ALL_ARTIST_SLUGS });
});

/* GET /api/kworb/refresh-status */
router.get("/kworb/refresh-status", async (_req, res) => {
  const qr = await pool.query<{ pending: string; running: string; done: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE status='pending') AS pending,
      COUNT(*) FILTER (WHERE status='running') AS running,
      COUNT(*) FILTER (WHERE status='done')    AS done
    FROM kworb_jobs
  `);
  res.json({
    workerActive,
    fetchingEnabled:  FETCHING_ENABLED(),
    requestsToday,
    requestsThisHour,
    caps:             { daily: DAILY_CAP, hourly: HOURLY_CAP },
    jobs:             qr.rows[0] ?? {},
    totalArtists:     ALL_ARTIST_SLUGS.length,
    sentinelLastAt:   sentinelLastAt ? new Date(sentinelLastAt).toISOString() : null,
  });
});

/* GET /api/kworb/admin/stats */
router.get("/kworb/admin/stats", async (_req, res) => {
  const [jobRow, covRow, snapRow, refreshedTodayRow, oldestStaleRow, noSnapshotRow, etaRow] = await Promise.all([
    // Queue status
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='pending') AS pending,
        COUNT(*) FILTER (WHERE status='running') AS running,
        COUNT(*) FILTER (WHERE status='done')    AS done,
        COUNT(*) FILTER (WHERE status='failed')  AS failed
      FROM kworb_jobs
    `).then(r => r.rows[0]),

    // Coverage by tier
    pool.query(`
      SELECT
        COUNT(*)                                                            AS total,
        COUNT(*) FILTER (WHERE tier='A')                                   AS tier_a,
        COUNT(*) FILTER (WHERE tier='B')                                   AS tier_b,
        COUNT(*) FILTER (WHERE tier='C')                                   AS tier_c,
        COUNT(*) FILTER (WHERE tier='D')                                   AS tier_d,
        COUNT(*) FILTER (WHERE status='active')                            AS active,
        COUNT(*) FILTER (WHERE status='not_found')                         AS not_found,
        COUNT(*) FILTER (WHERE has_spotify)                                AS has_spotify,
        COUNT(*) FILTER (WHERE has_youtube)                                AS has_youtube,
        COUNT(*) FILTER (WHERE has_itunes)                                 AS has_itunes,
        COUNT(*) FILTER (WHERE NOT has_spotify AND NOT has_youtube AND NOT has_itunes) AS no_coverage
      FROM kworb_coverage
    `).then(r => r.rows[0]),

    // Snapshot freshness
    pool.query(`
      SELECT
        COUNT(DISTINCT artist_key)                          AS artists_with_snapshots,
        COUNT(*) FILTER (WHERE expires_at < now())          AS stale_snapshots
      FROM kworb_snapshots
    `).then(r => r.rows[0]),

    // Artists refreshed today, broken down by tier
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE tier='A') AS tier_a,
        COUNT(*) FILTER (WHERE tier='B') AS tier_b,
        COUNT(*) FILTER (WHERE tier='C') AS tier_c,
        COUNT(*) FILTER (WHERE tier='D') AS tier_d,
        COUNT(*)                         AS total
      FROM kworb_coverage
      WHERE last_fetch_at >= date_trunc('day', now())
    `).then(r => r.rows[0]),

    // Oldest un-refreshed artist per tier (no-starvation audit)
    pool.query(`
      SELECT tier,
             MIN(last_fetch_at)  AS oldest_fetch,
             MIN(artist_key)     AS oldest_artist
      FROM kworb_coverage
      WHERE status != 'not_found'
      GROUP BY tier
      ORDER BY tier
    `).then(r => r.rows),

    // Artists in coverage but with zero snapshots (never successfully fetched)
    pool.query(`
      SELECT COUNT(*) AS count
      FROM kworb_coverage c
      WHERE NOT EXISTS (
        SELECT 1 FROM kworb_snapshots s WHERE s.artist_key = c.artist_key
      )
    `).then(r => r.rows[0]),

    // Estimated days to full coverage based on pending jobs + today's request rate
    pool.query(`
      SELECT COUNT(*) AS pending_jobs FROM kworb_jobs WHERE status = 'pending'
    `).then(r => r.rows[0]),
  ]);

  // Estimate days to full coverage: pending jobs × avg pages per job ÷ remaining daily budget
  const pendingJobs         = parseInt(etaRow?.pending_jobs ?? "0", 10);
  const remainingBudget     = Math.max(1, DAILY_CAP - requestsToday);
  const pagesPerJob         = 3; // spotify + youtube + itunes
  const estimatedDays       = pendingJobs > 0
    ? ((pendingJobs * pagesPerJob) / remainingBudget).toFixed(1)
    : "0";

  res.json({
    fetchingEnabled:     FETCHING_ENABLED(),
    requestBudget: {
      today:             requestsToday,
      thisHour:          requestsThisHour,
      caps:              { daily: DAILY_CAP, hourly: HOURLY_CAP },
      remainingToday:    Math.max(0, DAILY_CAP - requestsToday),
      byMetric:          requestsByMetric,
    },
    queue:               jobRow           ?? {},
    coverage:            covRow           ?? {},
    snapshots:           snapRow          ?? {},
    refreshedToday:      refreshedTodayRow ?? {},
    oldestStaleByTier:   oldestStaleRow   ?? [],
    noSnapshotCount:     parseInt(noSnapshotRow?.count ?? "0", 10),
    estimatedDaysToFull: estimatedDays,
    workerActive,
    sentinelLastAt:      sentinelLastAt ? new Date(sentinelLastAt).toISOString() : null,
  });
});

/* POST /api/kworb/admin/seed-coverage  — populate coverage + queue initial jobs */
router.post("/kworb/admin/seed-coverage", async (_req, res) => {
  try {
    const result = await seedCoverage(true);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/* POST /api/kworb/admin/enqueue?name=X&priority=5  — manual enqueue */
router.post("/kworb/admin/enqueue", async (req, res) => {
  const name     = (req.query.name as string | undefined)?.trim();
  const priority = parseInt((req.query.priority as string | undefined) ?? "5", 10);
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const slug = toSlug(name);
  await enqueueJob(slug, "all", isNaN(priority) ? 5 : priority, new Date());
  res.json({ ok: true, slug, priority: isNaN(priority) ? 5 : priority });
});

export default router;
