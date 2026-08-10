import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

type PoolLike = InstanceType<typeof Pool>;
type ItemType = "track" | "album";

const ARTIST_METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";

interface ArtistRow {
  artist_key: string;
  artist_name: string;
  spotify_artist_id: string;
}

const CANONICAL_ARTIST_KEY_BY_ALIAS: Record<string, string> = {
  "banda el recodo de cruz lizarraga": "banda el recodo",
  "banda sinaloense ms de sergio lizarraga": "banda ms de sergio lizarraga",
  "banda tito y su torbellino": "tito torbellino",
  "ramon ayala y sus bravos del norte": "ramon ayala",
};

export interface MonitoringStreamItem {
  itemType: ItemType;
  itemKey: string;
  title: string;
  spotifyUrl: string | null;
  totalStreams: number;
  dailyStreams: number;
  compilation: boolean;
}

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  const artistKeys = (args.get("artistKeys") ?? args.get("artistKey") ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return {
    artistKeys,
    all: args.get("all") === "true",
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 529), 529)),
    snapshotDate: args.get("date") ?? new Date().toISOString().slice(0, 10),
    write: args.get("write") === "true",
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  row.push(field);
  rows.push(row);
  return rows.filter(cells => cells.some(cell => cell.trim()));
}

async function loadActiveArtistKeys(): Promise<string[]> {
  const response = await fetch(ARTIST_METADATA_URL, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Active artist catalog request failed: HTTP ${response.status}`);
  const rows = parseCsv(await response.text());
  const keyIndex = (rows[0] ?? []).findIndex(header => header.trim() === "artist_key");
  if (keyIndex < 0) throw new Error("Active artist catalog is missing artist_key.");
  return [...new Set(rows.slice(1).map(row => row[keyIndex]?.trim().toLowerCase()).filter((key): key is string => Boolean(key)))];
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseNumber(value: string): number {
  return Number(value.replaceAll(",", "")) || 0;
}

function fallbackKey(title: string): string {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeArtistKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

function compactArtistKey(value: string): string {
  return normalizeArtistKey(value).replace(/[^a-z0-9]/g, "");
}

function artistKeyCandidates(value: string): string[] {
  const normalized = normalizeArtistKey(value);
  const canonical = CANONICAL_ARTIST_KEY_BY_ALIAS[normalized] ?? normalized;
  return [...new Set([normalized, canonical, compactArtistKey(normalized), compactArtistKey(canonical)].filter(Boolean))];
}

export function parseMonitoringCatalog(html: string, itemType: ItemType): MonitoringStreamItem[] {
  const items: MonitoringStreamItem[] = [];
  const pattern = /<tr[^>]*><td class="text"><div>([\s\S]*?)<\/div><\/td><td>([\d,]+)<\/td><td>([\d,]+)<\/td><\/tr>/g;
  for (const match of html.matchAll(pattern)) {
    const rawCell = match[1];
    const spotifyUrl = rawCell.match(/href="([^"]+)"/)?.[1] ?? null;
    const rawTitle = decodeHtml(rawCell);
    const title = rawTitle.replace(/^\*\s*/, "").replace(/^\^\s*/, "");
    if (!title) continue;
    const resource = itemType === "track" ? "track" : "album";
    const spotifyId = spotifyUrl?.match(new RegExp(`/${resource}/([A-Za-z0-9]+)`))?.[1] ?? null;
    items.push({
      itemType,
      itemKey: spotifyId ?? fallbackKey(title),
      title,
      spotifyUrl,
      totalStreams: parseNumber(match[2]),
      dailyStreams: parseNumber(match[3]),
      compilation: itemType === "album" && rawTitle.startsWith("^"),
    });
  }
  return items;
}

async function ensureTables(pool: PoolLike) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monitoring_stream_items (
      artist_key text NOT NULL,
      item_type text NOT NULL CHECK (item_type IN ('track','album')),
      item_key text NOT NULL,
      title text NOT NULL,
      spotify_url text,
      compilation boolean NOT NULL DEFAULT false,
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (artist_key, item_type, item_key)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS monitoring_stream_daily_snapshots (
      artist_key text NOT NULL,
      item_type text NOT NULL CHECK (item_type IN ('track','album')),
      item_key text NOT NULL,
      snapshot_date date NOT NULL,
      total_streams bigint NOT NULL,
      daily_streams bigint NOT NULL,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (artist_key, item_type, item_key, snapshot_date)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS monitoring_stream_daily_artist_date_idx
    ON monitoring_stream_daily_snapshots (artist_key, snapshot_date DESC, item_type)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS monitoring_stream_daily_item_date_idx
    ON monitoring_stream_daily_snapshots (artist_key, item_type, item_key, snapshot_date DESC)
  `);
}

async function fetchPage(spotifyArtistId: string, itemType: ItemType): Promise<string> {
  const suffix = itemType === "track" ? "songs" : "albums";
  const response = await fetch(`https://kworb.net/spotify/artist/${spotifyArtistId}_${suffix}.html`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsMonitor/1.0)",
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Catalog request failed: HTTP ${response.status}`);
  return response.text();
}

async function fetchPageWithRetry(spotifyArtistId: string, itemType: ItemType): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchPage(spotifyArtistId, itemType);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 1_500));
    }
  }
  throw lastError;
}

async function saveItems(pool: PoolLike, artistKey: string, snapshotDate: string, items: MonitoringStreamItem[]) {
  if (!items.length) return;
  const payload = JSON.stringify(items.map(item => ({
    item_type: item.itemType,
    item_key: item.itemKey,
    title: item.title,
    spotify_url: item.spotifyUrl,
    compilation: item.compilation,
    total_streams: item.totalStreams,
    daily_streams: item.dailyStreams,
  })));
  await pool.query(
    `WITH incoming AS (
       SELECT * FROM jsonb_to_recordset($2::jsonb) AS x(
         item_type text, item_key text, title text, spotify_url text,
         compilation boolean, total_streams bigint, daily_streams bigint
       )
     )
     INSERT INTO monitoring_stream_items (
       artist_key, item_type, item_key, title, spotify_url, compilation, last_seen_at
     )
     SELECT $1, item_type, item_key, title, spotify_url, compilation, now() FROM incoming
     ON CONFLICT (artist_key, item_type, item_key) DO UPDATE SET
       title=excluded.title,
       spotify_url=COALESCE(excluded.spotify_url, monitoring_stream_items.spotify_url),
       compilation=excluded.compilation,
       last_seen_at=now()`,
    [artistKey, payload],
  );
  await pool.query(
    `WITH incoming AS (
       SELECT * FROM jsonb_to_recordset($3::jsonb) AS x(
         item_type text, item_key text, title text, spotify_url text,
         compilation boolean, total_streams bigint, daily_streams bigint
       )
     )
     INSERT INTO monitoring_stream_daily_snapshots (
       artist_key, item_type, item_key, snapshot_date, total_streams, daily_streams, fetched_at
     )
     SELECT $1, item_type, item_key, $2::date, total_streams, daily_streams, now() FROM incoming
     ON CONFLICT (artist_key, item_type, item_key, snapshot_date) DO UPDATE SET
       total_streams=excluded.total_streams,
       daily_streams=excluded.daily_streams,
       fetched_at=excluded.fetched_at`,
    [artistKey, snapshotDate, payload],
  );
}

async function main() {
  const { artistKeys: requestedArtistKeys, all, offset, limit, snapshotDate, write } = parseArgs();
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("Missing DATABASE_URL.");
  if (!all && !requestedArtistKeys.length) throw new Error("Provide --artistKey/--artistKeys or --all=true.");

  const activeArtistKeys = all ? await loadActiveArtistKeys() : requestedArtistKeys;
  if (all && activeArtistKeys.length !== 529) {
    throw new Error(`Expected exactly 529 active catalog artists, received ${activeArtistKeys.length}. Refusing to continue.`);
  }
  const artistKeys = activeArtistKeys.slice(offset, offset + limit);

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    if (write) await ensureTables(pool);
    const requestedByCandidate = new Map<string, string>();
    for (const artistKey of artistKeys) {
      for (const candidate of artistKeyCandidates(artistKey)) requestedByCandidate.set(candidate, artistKey);
    }
    const artists = await pool.query<ArtistRow>(
      `SELECT c.artist_key, c.artist_name,
              COALESCE(c.spotify_id, s.spotify_artist_id) AS spotify_artist_id
       FROM kworb_coverage c
       LEFT JOIN spotify_artists s ON s.artist_key = c.artist_key
       WHERE lower(c.artist_key) = ANY($1::text[])
         AND COALESCE(c.spotify_id, s.spotify_artist_id) IS NOT NULL
       ORDER BY c.artist_key`,
      [[...requestedByCandidate.keys()]],
    );

    const resolved = new Map<string, ArtistRow>();
    for (const artist of artists.rows) {
      const activeKey = artistKeyCandidates(artist.artist_key)
        .map(candidate => requestedByCandidate.get(candidate))
        .find((candidate): candidate is string => Boolean(candidate));
      if (activeKey && !resolved.has(activeKey)) resolved.set(activeKey, artist);
    }
    const failures: string[] = [];
    let savedItems = 0;
    for (const [index, artistKey] of artistKeys.entries()) {
      const artist = resolved.get(artistKey);
      if (!artist) {
        failures.push(`${artistKey}:missing_spotify_mapping`);
        console.warn(`SKIPPED,${artistKey},reason=missing_spotify_mapping`);
        continue;
      }
      try {
        const [tracksHtml, albumsHtml] = await Promise.all([
          fetchPageWithRetry(artist.spotify_artist_id, "track"),
          fetchPageWithRetry(artist.spotify_artist_id, "album"),
        ]);
        const tracks = parseMonitoringCatalog(tracksHtml, "track");
        const albums = parseMonitoringCatalog(albumsHtml, "album");
        if (!tracks.length && !albums.length) throw new Error("empty_catalog");
        if (write) await saveItems(pool, artist.artist_key, snapshotDate, [...tracks, ...albums]);
        savedItems += tracks.length + albums.length;
        console.log(`${write ? "SAVED" : "PREVIEW"},${index + 1}/${artistKeys.length},${artist.artist_key},date=${snapshotDate},tracks=${tracks.length},albums=${albums.length}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`${artistKey}:${reason}`);
        console.error(`FAILED,${index + 1}/${artistKeys.length},${artistKey},reason=${reason}`);
      }
    }
    console.log(`SUMMARY,date=${snapshotDate},requested=${artistKeys.length},resolved=${artists.rows.length},items=${savedItems},failures=${failures.length}`);
    if (failures.length) console.log(`RETRY_KEYS=${failures.map(value => value.split(":")[0]).join(",")}`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
