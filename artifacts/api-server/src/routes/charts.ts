import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

/* ── Cover cache (in-memory, survives requests) ──────────────────────────── */
const coverCache = new Map<string, string | null>();
let enrichmentRunning = false;

/* ── Album art via Deezer (free, no auth) ────────────────────────────────── */
function cleanCoverQuery(value: string): string {
  return value
    .replace(/\([^)]*(?:remix|version|visualizer|video|audio|official|deluxe)[^)]*\)/gi, "")
    .replace(/\[[^\]]*(?:remix|version|visualizer|video|audio|official|deluxe)[^\]]*\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchScore(expectedArtist: string, expectedTitle: string, foundArtist: string, foundTitle: string): number {
  const artist = normalizeForMatch(expectedArtist);
  const title = normalizeForMatch(cleanCoverQuery(expectedTitle));
  const foundArtistNorm = normalizeForMatch(foundArtist);
  const foundTitleNorm = normalizeForMatch(cleanCoverQuery(foundTitle));

  let score = 0;
  if (foundArtistNorm === artist) score += 55;
  else if (foundArtistNorm.includes(artist) || artist.includes(foundArtistNorm)) score += 34;
  else {
    const artistTokens = artist.split(" ").filter(Boolean);
    const matchedTokens = artistTokens.filter(token => foundArtistNorm.includes(token));
    score += Math.min(24, matchedTokens.length * 8);
  }

  if (foundTitleNorm === title) score += 55;
  else if (foundTitleNorm.includes(title) || title.includes(foundTitleNorm)) score += 36;
  else {
    const titleTokens = title.split(" ").filter(token => token.length > 2);
    const matchedTokens = titleTokens.filter(token => foundTitleNorm.includes(token));
    score += Math.min(30, matchedTokens.length * 10);
  }

  return score;
}

async function fetchCoverViaDeezer(artist: string, title: string): Promise<string | null> {
  const queries = [
    `${artist} ${title}`,
    `${artist} ${cleanCoverQuery(title)}`,
    `${cleanCoverQuery(title)} ${artist}`,
  ].filter((q, i, arr) => q.trim() && arr.indexOf(q) === i);

  try {
    for (const query of queries) {
      const q = encodeURIComponent(query);
      const resp = await fetch(`https://api.deezer.com/search/track?q=${q}&limit=5`, {
        signal: AbortSignal.timeout(6000),
      });
      if (!resp.ok) continue;
      const data = await resp.json() as {
        data?: Array<{
          title?: string;
          artist?: { name?: string };
          album: { cover?: string; cover_medium?: string; cover_big?: string; cover_xl?: string };
        }>;
      };
      const candidates = (data.data ?? [])
        .map(item => {
          const url = item.album.cover_xl || item.album.cover_big || item.album.cover_medium || item.album.cover;
          return {
            item,
            url,
            score: matchScore(artist, title, item.artist?.name ?? "", item.title ?? ""),
          };
        })
        .filter(candidate => candidate.url && !candidate.url.includes("/noimage/"))
        .sort((a, b) => b.score - a.score);
      const hit = candidates.find(candidate => candidate.score >= 45);
      const url = hit?.url;
      if (url) return url;
    }
    return null;
  } catch {
    return null;
  }
}

type ArtworkSource = "deezer" | "itunes";
type SocialArtworkType = "track" | "album" | "artist";
interface ArtworkResolution {
  url: string;
  source: ArtworkSource;
}

const SOCIAL_ARTWORK_ALLOWED_DOMAINS = new Set([
  "cdn-images.dzcdn.net",
  "cdns-images.dzcdn.net",
  "e-cdns-images.dzcdn.net",
  "is1-ssl.mzstatic.com",
  "is2-ssl.mzstatic.com",
  "is3-ssl.mzstatic.com",
  "is4-ssl.mzstatic.com",
  "is5-ssl.mzstatic.com",
  "a5.mzstatic.com",
]);

const SOCIAL_ARTWORK_MAX_BYTES = 8 * 1024 * 1024;

function localSocialArtworkUrl(templateKey: string, type: SocialArtworkType, entityKey: string): string {
  const params = new URLSearchParams({
    templateKey,
    type,
    entityKey,
  });
  return `/api/charts/social-artwork-image?${params.toString()}`;
}

async function downloadSocialArtworkImage(url: string): Promise<{ data: Buffer; contentType: string } | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!SOCIAL_ARTWORK_ALLOWED_DOMAINS.has(parsed.hostname)) return null;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MexicoCharts/1.0; +https://mexicochart.com)",
        "Accept": "image/webp,image/jpeg,image/png,image/*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength <= 0 || arrayBuffer.byteLength > SOCIAL_ARTWORK_MAX_BYTES) return null;
    return {
      data: Buffer.from(arrayBuffer),
      contentType,
    };
  } catch {
    return null;
  }
}

function artistMatchScore(expected: string, found: string): number {
  const expectedNorm = normalizeForMatch(expected);
  const foundNorm = normalizeForMatch(found);
  if (!expectedNorm || !foundNorm) return 0;
  if (expectedNorm === foundNorm) return 100;
  if (foundNorm.includes(expectedNorm) || expectedNorm.includes(foundNorm)) return 82;
  const tokens = expectedNorm.split(" ").filter(token => token.length > 1);
  if (!tokens.length) return 0;
  const matched = tokens.filter(token => foundNorm.includes(token)).length;
  return Math.round((matched / tokens.length) * 70);
}

async function fetchArtistImageViaDeezer(artist: string): Promise<string | null> {
  if (!artist.trim()) return null;
  try {
    const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}&limit=8`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;
    const data = await resp.json() as {
      data?: Array<{ name?: string; picture_xl?: string; picture_big?: string; picture_medium?: string }>;
    };
    const candidates = (data.data ?? [])
      .map(item => ({
        item,
        url: item.picture_xl || item.picture_big || item.picture_medium || null,
        score: artistMatchScore(artist, item.name ?? ""),
      }))
      .filter(candidate => candidate.url && !candidate.url.includes("/noimage/"))
      .sort((a, b) => b.score - a.score);
    const hit = candidates.find(candidate => candidate.score >= 82);
    return hit?.url ?? null;
  } catch {
    return null;
  }
}

async function fetchItunesArtwork(
  artist: string,
  title: string,
  entity: "song" | "album",
): Promise<string | null> {
  const term = `${artist} ${title}`.trim();
  if (!term) return null;
  try {
    const url = `https://itunes.apple.com/search?country=mx&media=music&entity=${entity}&limit=8&term=${encodeURIComponent(term)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) return null;
    const data = await resp.json() as {
      results?: Array<{
        artistName?: string;
        trackName?: string;
        collectionName?: string;
        artworkUrl100?: string;
      }>;
    };
    const candidates = (data.results ?? [])
      .map(item => ({
        item,
        score: matchScore(artist, title, item.artistName ?? "", item.collectionName ?? item.trackName ?? ""),
      }))
      .filter(candidate => candidate.item.artworkUrl100)
      .sort((a, b) => b.score - a.score);
    const hit = candidates.find(candidate => candidate.score >= 50);
    return hit?.item.artworkUrl100?.replace(/100x100bb\./, "1200x1200bb.") ?? null;
  } catch {
    return null;
  }
}

async function resolveTrackArtwork(artist: string, title: string): Promise<ArtworkResolution | null> {
  const deezer = await fetchCoverViaDeezer(artist, title);
  if (deezer) return { url: deezer, source: "deezer" };
  const itunes = await fetchItunesArtwork(artist, title, "song");
  if (itunes) return { url: itunes, source: "itunes" };
  return null;
}

async function resolveAlbumArtwork(artist: string, title: string): Promise<ArtworkResolution | null> {
  const itunes = await fetchItunesArtwork(artist, title, "album");
  if (itunes) return { url: itunes, source: "itunes" };
  const deezer = await fetchCoverViaDeezer(artist, title);
  if (deezer) return { url: deezer, source: "deezer" };
  return null;
}

async function resolveArtistArtwork(artist: string): Promise<ArtworkResolution | null> {
  const deezer = await fetchArtistImageViaDeezer(artist);
  if (deezer) return { url: deezer, source: "deezer" };
  return null;
}

/* ── Enrich entries that don't yet have a cover (background job) ─────────── */
async function enrichCovers(
  entries: Omit<ChartEntry, "coverUrl">[]
): Promise<void> {
  if (enrichmentRunning) return;
  enrichmentRunning = true;
  try {
    const todo = entries.filter(e => !coverCache.has(e.trackId) || coverCache.get(e.trackId) === null);
    for (let i = 0; i < todo.length; i += 4) {
      const batch = todo.slice(i, i + 4);
      await Promise.all(
        batch.map(async e => {
          if (coverCache.has(e.trackId)) return;
          const url = await fetchCoverViaDeezer(e.artist, e.title);
          coverCache.set(e.trackId, url);
        })
      );
      // Rate-limit: 300ms between batches
      if (i + 4 < todo.length) await new Promise(r => setTimeout(r, 300));
    }
  } finally {
    enrichmentRunning = false;
  }
}

async function enrichCoversForExport(
  entries: Omit<ChartEntry, "coverUrl">[],
  limit = 10
): Promise<void> {
  const todo = entries.slice(0, limit).filter(e => !coverCache.has(e.trackId) || coverCache.get(e.trackId) === null);
  for (let i = 0; i < todo.length; i += 4) {
    const batch = todo.slice(i, i + 4);
    await Promise.all(
      batch.map(async e => {
        if (coverCache.has(e.trackId)) return;
        const url = await fetchCoverViaDeezer(e.artist, e.title);
        coverCache.set(e.trackId, url);
      })
    );
    if (i + 4 < todo.length) await new Promise(r => setTimeout(r, 300));
  }
}

/* ── Chart entry type ────────────────────────────────────────────────────── */
interface ChartEntry {
  pos: number;
  posChange: string;
  artist: string;
  title: string;
  features: string[];
  trackId: string;
  artistId: string;
  streams: string;
  totalStreams: string;
  coverUrl: string | null;
}

/* ── Parsed (un-enriched) chart cache ────────────────────────────────────── */
const CHART_TTL = 60 * 60 * 1000; // 1 hour
interface RawSlot { data: Omit<ChartEntry, "coverUrl">[]; fetchedAt: number }
const rawCache = new Map<string, RawSlot>();

/* ── Parse kworb HTML ───────────────────────────────────────────────────── */
function parseKworbChart(html: string): Omit<ChartEntry, "coverUrl">[] {
  const entries: Omit<ChartEntry, "coverUrl">[] = [];
  const rowRe = /<tr><td class="np">(\d+)<\/td>\s*<td class="np">([^<]*)<\/td>\s*<td class="text mp"><div>([\s\S]*?)<\/div><\/td>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const pos = parseInt(m[1]);
    const posChange = m[2].trim() || "=";
    const cellHtml = m[3];
    const restHtml = m[4];

    const artistM = cellHtml.match(/href="\.\.\/artist\/([A-Za-z0-9]+)\.html">([^<]+)<\/a>/);
    const trackM  = cellHtml.match(/href="\.\.\/track\/([A-Za-z0-9]+)\.html">([^<]+)<\/a>/);
    if (!artistM || !trackM) continue;

    const artistId = artistM[1];
    const artist   = artistM[2];
    const trackId  = trackM[1];
    const title    = trackM[2];

    const allArtists = [...cellHtml.matchAll(/href="\.\.\/artist\/[A-Za-z0-9]+\.html">([^<]+)<\/a>/g)];
    const features = allArtists.slice(1).map(a => a[1]);

    const tds = [...restHtml.matchAll(/<td[^>]*>([^<]*)<\/td>/g)];
    const streams     = tds[3]?.[1]?.trim() || "—";
    const totalStreams = tds[7]?.[1]?.trim() || "—";

    entries.push({ pos, posChange, artist, title, features, trackId, artistId, streams, totalStreams });
  }
  return entries;
}

/* ── Fetch kworb (fast, no Deezer wait) ──────────────────────────────────── */
async function fetchRawChart(period: "daily" | "weekly"): Promise<Omit<ChartEntry, "coverUrl">[]> {
  const cached = rawCache.get(period);
  if (cached && Date.now() - cached.fetchedAt < CHART_TTL) return cached.data;

  const url = `https://kworb.net/spotify/country/mx_${period}.html`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`kworb ${period}: HTTP ${resp.status}`);
  const html = await resp.text();
  const data = parseKworbChart(html);
  rawCache.set(period, { data, fetchedAt: Date.now() });
  return data;
}

/* ── Route: GET /api/charts/mx-spotify?period=daily|weekly ──────────────── */
router.get("/charts/mx-spotify", async (req, res) => {
  const period = req.query["period"] === "weekly" ? "weekly" : "daily";
  const withCovers = req.query["withCovers"] === "1" || req.query["social"] === "1";
  try {
    // 1. Get chart data fast (kworb only — no Deezer wait)
    const raw = await fetchRawChart(period);

    // Social exports need the image URLs in the first response, otherwise the
    // PNG captures placeholders before the background cover job finishes.
    if (withCovers) {
      await enrichCoversForExport(raw, 10);
    }

    // 2. Build response: attach whatever covers we already have cached
    const entries: ChartEntry[] = raw.map(e => ({
      ...e,
      coverUrl: coverCache.has(e.trackId) ? coverCache.get(e.trackId)! : null,
    }));

    // 3. Fire-and-forget: enrich covers in background for next request
    void enrichCovers(raw);

    const cached = rawCache.get(period)!;
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    res.json({ period, fetchedAt: new Date(cached.fetchedAt).toISOString(), entries });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch chart data", detail: String(err) });
  }
});

async function ensureSocialArtworkTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_template_artwork (
      template_key text NOT NULL,
      entity_type text NOT NULL,
      entity_key text NOT NULL,
      display_title text NOT NULL,
      display_artist text DEFAULT '' NOT NULL,
      image_url text NOT NULL,
      image_data bytea,
      image_content_type text,
      source text NOT NULL,
      first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
      last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,
      PRIMARY KEY (template_key, entity_type, entity_key)
    );
  `);
  await pool.query(`ALTER TABLE social_template_artwork ADD COLUMN IF NOT EXISTS image_data bytea;`);
  await pool.query(`ALTER TABLE social_template_artwork ADD COLUMN IF NOT EXISTS image_content_type text;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS social_template_artwork_entity_idx ON social_template_artwork (entity_type, entity_key);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS social_template_artwork_seen_idx ON social_template_artwork (template_key, last_seen_at);`);
}

function socialArtworkKey(value: string): string {
  return normalizeForMatch(value).replace(/\s+/g, "-") || "unknown";
}

function requestEntityKey(item: { id?: string; title?: string; artist?: string }, type: string): string {
  if (item.id?.trim()) return socialArtworkKey(item.id);
  return socialArtworkKey(`${type}:${item.artist ?? ""}:${item.title ?? ""}`);
}

router.get("/charts/social-artwork-image", async (req, res) => {
  const templateKey = socialArtworkKey(String(req.query["templateKey"] || ""));
  const type: SocialArtworkType = req.query["type"] === "album" ? "album" : req.query["type"] === "artist" ? "artist" : "track";
  const entityKey = socialArtworkKey(String(req.query["entityKey"] || ""));

  if (!templateKey || !entityKey) {
    res.status(400).json({ error: "templateKey and entityKey are required" });
    return;
  }

  try {
    await ensureSocialArtworkTable();
    const cached = await pool.query<{ image_data: Buffer | null; image_content_type: string | null }>(
      `
      SELECT image_data, image_content_type
      FROM social_template_artwork
      WHERE template_key = $1
        AND entity_type = $2
        AND entity_key = $3
        AND image_data IS NOT NULL
      `,
      [templateKey, type, entityKey],
    );
    const row = cached.rows[0];
    if (!row?.image_data) {
      res.status(404).json({ error: "artwork image not cached" });
      return;
    }
    res.setHeader("Content-Type", row.image_content_type || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(row.image_data);
  } catch (err) {
    res.status(502).json({ error: "Failed to serve social artwork image", detail: String(err) });
  }
});

router.post("/charts/social-artwork", async (req, res) => {
  const body = req.body as {
    templateKey?: string;
    type?: SocialArtworkType;
    items?: Array<{ id?: string; title?: string; artist?: string }>;
  };
  const type: SocialArtworkType = body.type === "album" ? "album" : body.type === "artist" ? "artist" : "track";
  const templateKey = socialArtworkKey(body.templateKey || `social-${type}`);
  const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];

  try {
    await ensureSocialArtworkTable();

    const keys = items.map(item => requestEntityKey(item, type));
    const cache = keys.length
      ? await pool.query<{ entity_key: string; image_url: string; image_data: Buffer | null; image_content_type: string | null; source: string }>(
          `
          SELECT entity_key, image_url, image_data, image_content_type, source
          FROM social_template_artwork
          WHERE template_key = $1
            AND entity_type = $2
            AND entity_key = ANY($3::text[])
          `,
          [templateKey, type, keys],
        )
      : { rows: [] };
    const cached = new Map(cache.rows.map(row => [row.entity_key, row]));
    const results: Record<string, string | null> = Object.fromEntries(items.map(item => [item.id || `${item.artist ?? ""}::${item.title ?? ""}`, null]));
    const resultEntityKeys: Record<string, string> = {};
    const sourceUrlsByResult: Record<string, string> = {};
    const pending = items
      .map((item, index) => ({ item, index, key: keys[index] }))
      .filter(entry => {
        const resultKey = entry.item.id || `${entry.item.artist ?? ""}::${entry.item.title ?? ""}`;
        resultEntityKeys[resultKey] = entry.key;
        const cachedRow = cached.get(entry.key);
        if (cachedRow?.image_data) {
          results[resultKey] = localSocialArtworkUrl(templateKey, type, entry.key);
          sourceUrlsByResult[resultKey] = cachedRow.image_url;
          return false;
        }
        return true;
      });

    const resolved: Array<{ entry: typeof pending[number]; artwork: ArtworkResolution | null; image: { data: Buffer; contentType: string } | null }> = [];
    for (let i = 0; i < pending.length; i += 4) {
      const batch = pending.slice(i, i + 4);
      const found = await Promise.all(batch.map(async item => {
        const artist = item.item.artist?.trim() ?? "";
        const title = item.item.title?.trim() ?? "";
        if (!artist || (type !== "artist" && !title)) return { entry: item, artwork: null, image: null };
        const artwork = type === "album"
          ? await resolveAlbumArtwork(artist, title)
          : type === "artist"
            ? await resolveArtistArtwork(artist)
            : await resolveTrackArtwork(artist, title);
        const image = artwork?.url ? await downloadSocialArtworkImage(artwork.url) : null;
        return { entry: item, artwork, image };
      }));
      resolved.push(...found);
      if (i + 4 < pending.length) await new Promise(r => setTimeout(r, 250));
    }

    const urlCounts = new Map<string, number>();
    for (const item of resolved) {
      if (item.artwork?.url) urlCounts.set(item.artwork.url, (urlCounts.get(item.artwork.url) ?? 0) + 1);
    }

    for (const item of resolved) {
      const resultKey = item.entry.item.id || `${item.entry.item.artist ?? ""}::${item.entry.item.title ?? ""}`;
      resultEntityKeys[resultKey] = item.entry.key;
      const artwork = item.artwork;
      if (!artwork?.url || !item.image || (urlCounts.get(artwork.url) ?? 0) > 1) {
        results[resultKey] = null;
        continue;
      }

      results[resultKey] = localSocialArtworkUrl(templateKey, type, item.entry.key);
      sourceUrlsByResult[resultKey] = artwork.url;
      await pool.query(
        `
        INSERT INTO social_template_artwork (
          template_key, entity_type, entity_key, display_title, display_artist, image_url, image_data, image_content_type, source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (template_key, entity_type, entity_key)
        DO UPDATE SET
          display_title = EXCLUDED.display_title,
          display_artist = EXCLUDED.display_artist,
          image_url = EXCLUDED.image_url,
          image_data = EXCLUDED.image_data,
          image_content_type = EXCLUDED.image_content_type,
          source = EXCLUDED.source,
          last_seen_at = now(),
          updated_at = now()
        `,
        [
          templateKey,
          type,
          item.entry.key,
          item.entry.item.title ?? "",
          item.entry.item.artist ?? "",
          artwork.url,
          item.image.data,
          item.image.contentType,
          artwork.source,
        ],
      );
    }

    const finalSourceUrlCounts = new Map<string, number>();
    for (const url of Object.values(sourceUrlsByResult)) {
      if (url) finalSourceUrlCounts.set(url, (finalSourceUrlCounts.get(url) ?? 0) + 1);
    }
    const duplicateEntityKeys = Object.entries(results)
      .filter(([resultKey, url]) => url && (finalSourceUrlCounts.get(sourceUrlsByResult[resultKey]) ?? 0) > 1)
      .map(([resultKey]) => resultEntityKeys[resultKey])
      .filter((key): key is string => Boolean(key));

    for (const resultKey of Object.keys(results)) {
      const url = results[resultKey];
      if (url && (finalSourceUrlCounts.get(sourceUrlsByResult[resultKey]) ?? 0) > 1) {
        results[resultKey] = null;
      }
    }

    if (duplicateEntityKeys.length) {
      await pool.query(
        `
        DELETE FROM social_template_artwork
        WHERE template_key = $1
          AND entity_type = $2
          AND entity_key = ANY($3::text[])
        `,
        [templateKey, type, duplicateEntityKeys],
      );
    }

    res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.json({
      templateKey,
      type,
      cached: cached.size,
      resolved: resolved.length,
      blockedDuplicates: duplicateEntityKeys.length,
      results,
    });
  } catch (err) {
    res.status(502).json({ error: "Failed to fetch social artwork", detail: String(err) });
  }
});

export default router;
