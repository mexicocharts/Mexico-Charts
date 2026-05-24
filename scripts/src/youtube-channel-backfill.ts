import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

interface ArtistRow {
  artist_key: string;
  artist_name: string;
  youtube_subscribers?: string;
}

interface ChannelItem {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    publishedAt?: string;
    thumbnails?: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

const ARTIST_METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 50), 200)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    minSubscribers: Math.max(0, Number(args.get("minSubscribers") ?? 500)),
    skipReviewed: args.get("skipReviewed") !== "false",
    write: args.get("write") === "true",
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  row.push(field);
  rows.push(row);
  return rows.filter(r => r.some(cell => cell.trim()));
}

function rowsToObjects(rows: string[][]): ArtistRow[] {
  const [headers = [], ...body] = rows;
  return body.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = row[index]?.trim() ?? "";
    });
    return obj as unknown as ArtistRow;
  }).filter(row => row.artist_key && row.artist_name);
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function handleCandidates(name: string): string[] {
  const clean = name.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9 ]/g, "").trim();
  const withoutAccents = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);
  const camel = words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  const lower = words.join("").toLowerCase();
  return [...new Set([camel, withoutAccents(camel), lower, withoutAccents(lower)])].filter(Boolean);
}

function confidenceFor(artistName: string, channelTitle: string): "alta" | "media" | "baja" {
  const artist = normalizeName(artistName);
  const title = normalizeName(channelTitle);
  if (title === artist) return "alta";
  if (title === `${artist} oficial` || title === `${artist} official`) return "alta";
  if (title.includes(artist)) return "media";
  return "baja";
}

function fmtCount(value: number | null): string {
  if (value == null) return "";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

function parseCount(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function passesSheetSanityCheck(artist: ArtistRow, subscribers: number | null): boolean {
  const sheetSubscribers = parseCount(artist.youtube_subscribers);
  if (sheetSubscribers == null || subscribers == null) return true;
  if (sheetSubscribers < 100_000) return true;
  return subscribers >= sheetSubscribers * 0.25;
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env["YOUTUBE_API_KEY"];
  if (!key) throw new Error("Missing YOUTUBE_API_KEY.");
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${YOUTUBE_API_BASE}${path}?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function channelByHandle(handle: string): Promise<ChannelItem | null> {
  const data = await ytFetch<{ items?: ChannelItem[] }>("/channels", {
    part: "snippet,statistics",
    forHandle: `@${handle}`,
  });
  return data.items?.[0] ?? null;
}

async function findByHandle(artist: ArtistRow, minSubscribers: number): Promise<{ channel: ChannelItem; confidence: "alta" | "media" | "baja"; handle: string } | null> {
  for (const handle of handleCandidates(artist.artist_name)) {
    const channel = await channelByHandle(handle);
    if (!channel) continue;

    const subscribers = channel.statistics?.hiddenSubscriberCount ? null : Number(channel.statistics?.subscriberCount ?? 0);
    const confidence = confidenceFor(artist.artist_name, channel.snippet.title);
    if ((subscribers ?? 0) >= minSubscribers && confidence !== "baja" && passesSheetSanityCheck(artist, subscribers)) {
      return { channel, confidence, handle };
    }
  }
  return null;
}

async function saveChannel(pool: InstanceType<typeof Pool>, artist: ArtistRow, channel: ChannelItem) {
  const thumbnail =
    channel.snippet.thumbnails?.high?.url ??
    channel.snippet.thumbnails?.medium?.url ??
    channel.snippet.thumbnails?.default?.url ??
    null;
  const subscriberCount = channel.statistics?.hiddenSubscriberCount
    ? null
    : channel.statistics?.subscriberCount != null
      ? Number(channel.statistics.subscriberCount)
      : null;

  await pool.query(
    `insert into youtube_channels (
      artist_key, channel_id, title, thumbnail_url, subscriber_count,
      view_count, video_count, custom_url, published_at, cached_at, linked_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
    on conflict (artist_key) do update set
      channel_id = excluded.channel_id,
      title = excluded.title,
      thumbnail_url = excluded.thumbnail_url,
      subscriber_count = excluded.subscriber_count,
      view_count = excluded.view_count,
      video_count = excluded.video_count,
      custom_url = excluded.custom_url,
      published_at = excluded.published_at,
      cached_at = excluded.cached_at`,
    [
      artist.artist_key,
      channel.id,
      channel.snippet.title,
      thumbnail,
      subscriberCount,
      channel.statistics?.viewCount != null ? Number(channel.statistics.viewCount) : null,
      channel.statistics?.videoCount != null ? Number(channel.statistics.videoCount) : null,
      channel.snippet.customUrl ?? null,
      channel.snippet.publishedAt ? new Date(channel.snippet.publishedAt) : null,
    ],
  );
}

async function main() {
  const { limit, offset, minSubscribers, skipReviewed, write } = parseArgs();
  if (!process.env["DATABASE_URL"]) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
  try {
    const csv = await fetch(ARTIST_METADATA_URL).then(res => {
      if (!res.ok) throw new Error(`artist metadata HTTP ${res.status}`);
      return res.text();
    });
    const artists = rowsToObjects(parseCsv(csv));
    const existing = await pool.query<{ artist_key: string }>("select artist_key from youtube_channels");
    const linked = new Set(existing.rows.map(row => row.artist_key));
    const candidateTable = await pool.query<{ exists: boolean }>(
      "select to_regclass('public.youtube_channel_candidates') is not null as exists",
    );
    const reviewedRows = skipReviewed && candidateTable.rows[0]?.exists
      ? await pool.query<{ artist_key: string }>("select artist_key from youtube_channel_candidates where status in ('review','no_result','error')")
      : { rows: [] };
    const reviewed = new Set(reviewedRows.rows.map(row => row.artist_key));
    const queue = artists
      .filter(artist => !linked.has(artist.artist_key))
      .filter(artist => !skipReviewed || !reviewed.has(artist.artist_key))
      .slice(offset, offset + limit);

    let matched = 0;
    let saved = 0;
    let skipped = 0;

    console.log(`${write ? "Writing" : "Dry run"} handle backfill for ${queue.length} artists. Existing linked: ${linked.size}. Existing reviewed: ${reviewed.size}. skipReviewed=${skipReviewed}.`);

    for (const artist of queue) {
      try {
        const result = await findByHandle(artist, minSubscribers);
        if (!result) {
          skipped += 1;
          console.log(`SKIP,${artist.artist_key},${artist.artist_name}`);
        } else {
          matched += 1;
          const subscribers = result.channel.statistics?.hiddenSubscriberCount
            ? null
            : Number(result.channel.statistics?.subscriberCount ?? 0);
          console.log(`${write ? "SAVE" : "MATCH"},${artist.artist_key},${artist.artist_name},${result.confidence},${result.channel.id},${result.channel.snippet.title},${fmtCount(subscribers)},@${result.handle}`);
          if (write) {
            await saveChannel(pool, artist, result.channel);
            saved += 1;
          }
        }
      } catch (err) {
        skipped += 1;
        console.error(`ERROR,${artist.artist_key},${artist.artist_name},${(err as Error).message}`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const finalCount = await pool.query("select count(*)::int as count from youtube_channels");
    console.log(`Done. matched=${matched} saved=${saved} skipped=${skipped} db_channels=${finalCount.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
