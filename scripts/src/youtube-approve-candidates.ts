import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

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

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    keys: (args.get("keys") ?? "").split(",").map(key => key.trim()).filter(Boolean),
    write: args.get("write") === "true",
  };
}

function fmtCount(value: number | null): string {
  if (value == null) return "";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
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

async function fetchChannels(channelIds: string[]): Promise<Map<string, ChannelItem>> {
  if (channelIds.length === 0) return new Map();
  const data = await ytFetch<{ items?: ChannelItem[] }>("/channels", {
    part: "snippet,statistics",
    id: channelIds.join(","),
    maxResults: String(channelIds.length),
  });
  return new Map((data.items ?? []).map(channel => [channel.id, channel]));
}

async function saveChannel(pool: InstanceType<typeof Pool>, artistKey: string, channel: ChannelItem) {
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
      cached_at = excluded.cached_at,
      linked_at = excluded.linked_at`,
    [
      artistKey,
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
  const { keys, write } = parseArgs();
  if (!keys.length) throw new Error("Pass --keys=artist_key,artist_key");
  if (!process.env["DATABASE_URL"]) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
  try {
    const rows = await pool.query<{
      artist_key: string;
      artist_name: string;
      best_channel_id: string | null;
      best_title: string | null;
    }>(
      `select artist_key, artist_name, best_channel_id, best_title
       from youtube_channel_candidates
       where artist_key = any($1) and status = 'review'`,
      [keys],
    );
    const missing = keys.filter(key => !rows.rows.some(row => row.artist_key === key));
    for (const key of missing) console.log(`MISSING_REVIEW,${key}`);

    const channelIds = rows.rows.map(row => row.best_channel_id).filter((id): id is string => Boolean(id));
    const channels = await fetchChannels(channelIds);
    let saved = 0;

    for (const row of rows.rows) {
      if (!row.best_channel_id) {
        console.log(`NO_CHANNEL,${row.artist_key},${row.artist_name}`);
        continue;
      }
    const channel = channels.get(row.best_channel_id);
    if (!channel) {
      console.log(`CHANNEL_NOT_FOUND,${row.artist_key},${row.artist_name},${row.best_channel_id}`);
      continue;
    }
    const existingOwner = await pool.query<{ artist_key: string }>(
      "select artist_key from youtube_channels where channel_id = $1 and artist_key <> $2",
      [channel.id, row.artist_key],
    );
    if (existingOwner.rows.length > 0) {
      console.log(`DUPLICATE_CHANNEL,${row.artist_key},${row.artist_name},${channel.id},owned_by=${existingOwner.rows[0].artist_key}`);
      continue;
    }
    const subscribers = channel.statistics?.hiddenSubscriberCount ? null : Number(channel.statistics?.subscriberCount ?? 0);
      console.log(`${write ? "APPROVE" : "WOULD_APPROVE"},${row.artist_key},${row.artist_name},${channel.id},${channel.snippet.title},${fmtCount(subscribers)}`);
      if (write) {
        await saveChannel(pool, row.artist_key, channel);
        await pool.query("delete from youtube_channel_candidates where artist_key = $1", [row.artist_key]);
        saved += 1;
      }
    }

    const finalCount = await pool.query("select count(*)::int as count from youtube_channels");
    console.log(`Done. saved=${saved} db_channels=${finalCount.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
