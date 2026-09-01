import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

type PoolLike = InstanceType<typeof Pool>;

interface ChannelRow {
  artist_key: string;
  channel_id: string;
}

interface YoutubeChannelItem {
  id: string;
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

interface SnapshotStats {
  channelId: string;
  viewCount: number | null;
  subscriberCount: number | null;
  videoCount: number | null;
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }

  const snapshotDate = args.get("date") ?? new Date().toISOString().slice(0, 10);
  const rawLimit = args.get("limit");
  const limit = rawLimit == null || rawLimit === "all"
    ? null
    : Math.max(1, Number(rawLimit));

  return {
    snapshotDate,
    limit,
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    write: args.get("write") === "true",
  };
}

function parseNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function ensureTables(pool: PoolLike) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS youtube_channel_daily_snapshots (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      channel_id text NOT NULL,
      snapshot_date text NOT NULL,
      source_type text NOT NULL DEFAULT 'official_artist_channel',
      view_count bigint,
      subscriber_count bigint,
      video_count integer,
      daily_view_delta bigint,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS youtube_channel_daily_snapshots_artist_date_unique
    ON youtube_channel_daily_snapshots (artist_key, snapshot_date);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS youtube_channel_daily_snapshots_channel_date_idx
    ON youtube_channel_daily_snapshots (channel_id, snapshot_date);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS youtube_channel_daily_snapshots_artist_date_idx
    ON youtube_channel_daily_snapshots (artist_key, snapshot_date);
  `);
}

async function youtubeFetchChannels(channelIds: string[]): Promise<SnapshotStats[]> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");

  const params = new URLSearchParams({
    key: apiKey,
    part: "statistics",
    id: channelIds.join(","),
    maxResults: String(channelIds.length),
  });

  const res = await fetch(`${YOUTUBE_API_BASE}/channels?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 240)}`);
  }

  const data = await res.json() as { items?: YoutubeChannelItem[] };
  return (data.items ?? []).map(item => ({
    channelId: item.id,
    viewCount: parseNumber(item.statistics?.viewCount),
    subscriberCount: item.statistics?.hiddenSubscriberCount ? null : parseNumber(item.statistics?.subscriberCount),
    videoCount: parseNumber(item.statistics?.videoCount),
  }));
}

async function previousViewCount(pool: PoolLike, artistKey: string, snapshotDate: string): Promise<number | null> {
  const prev = await pool.query<{ view_count: string | number | null }>(
    `
      SELECT view_count
      FROM youtube_channel_daily_snapshots
      WHERE artist_key = $1
        AND snapshot_date < $2
        AND view_count IS NOT NULL
      ORDER BY snapshot_date DESC
      LIMIT 1
    `,
    [artistKey, snapshotDate],
  );
  const value = prev.rows[0]?.view_count;
  return value == null ? null : Number(value);
}

async function saveSnapshot(pool: PoolLike, channel: ChannelRow, stats: SnapshotStats, snapshotDate: string) {
  const prevViews = stats.viewCount == null ? null : await previousViewCount(pool, channel.artist_key, snapshotDate);
  const dailyDelta = stats.viewCount == null || prevViews == null ? null : Math.max(0, stats.viewCount - prevViews);

  await pool.query(
    `
      INSERT INTO youtube_channel_daily_snapshots (
        artist_key, channel_id, snapshot_date, source_type, view_count,
        subscriber_count, video_count, daily_view_delta, fetched_at, updated_at
      )
      VALUES ($1,$2,$3,'official_artist_channel',$4,$5,$6,$7,now(),now())
      ON CONFLICT (artist_key, snapshot_date) DO UPDATE SET
        channel_id = excluded.channel_id,
        view_count = excluded.view_count,
        subscriber_count = excluded.subscriber_count,
        video_count = excluded.video_count,
        daily_view_delta = excluded.daily_view_delta,
        fetched_at = excluded.fetched_at,
        updated_at = now()
    `,
    [
      channel.artist_key,
      channel.channel_id,
      snapshotDate,
      stats.viewCount,
      stats.subscriberCount,
      stats.videoCount,
      dailyDelta,
    ],
  );

  await pool.query(
    `
      UPDATE youtube_channels
      SET view_count = $2,
          subscriber_count = $3,
          video_count = $4,
          cached_at = now()
      WHERE artist_key = $1
    `,
    [channel.artist_key, stats.viewCount, stats.subscriberCount, stats.videoCount],
  );

  return dailyDelta;
}

function batch<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function main() {
  const { snapshotDate, limit, offset, write } = parseArgs();
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await ensureTables(pool);

    const totalChannels = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM youtube_channels WHERE channel_id IS NOT NULL",
    );
    const totalLinkedChannels = totalChannels.rows[0]?.count ?? 0;
    const channelSql = `
        SELECT artist_key, channel_id
        FROM youtube_channels
        WHERE channel_id IS NOT NULL
        ORDER BY artist_key
        OFFSET $1
        ${limit == null ? "" : "LIMIT $2"}
      `;
    const channelParams = limit == null ? [offset] : [offset, limit];
    const channelRows = await pool.query<ChannelRow>(channelSql, channelParams);
    const channels = channelRows.rows;

    let fetched = 0;
    let saved = 0;
    let missing = 0;
    let deltaTotal = 0;

    console.log(`${write ? "Writing" : "Dry run"} YouTube channel snapshots: date=${snapshotDate} linked=${totalLinkedChannels} processing=${channels.length} offset=${offset} limit=${limit ?? "all"}`);

    for (const group of batch(channels, 50)) {
      const statsRows = await youtubeFetchChannels(group.map(channel => channel.channel_id));
      fetched += statsRows.length;
      const statsById = new Map(statsRows.map(stats => [stats.channelId, stats]));

      for (const channel of group) {
        const stats = statsById.get(channel.channel_id);
        if (!stats) {
          missing += 1;
          console.log(`MISSING,${channel.artist_key},${channel.channel_id}`);
          continue;
        }

        if (write) {
          const delta = await saveSnapshot(pool, channel, stats, snapshotDate);
          saved += 1;
          deltaTotal += delta ?? 0;
          console.log(`SAVE,${channel.artist_key},${channel.channel_id},views=${stats.viewCount ?? ""},daily=${delta ?? ""},subs=${stats.subscriberCount ?? ""}`);
        } else {
          console.log(`SNAPSHOT,${channel.artist_key},${channel.channel_id},views=${stats.viewCount ?? ""},subs=${stats.subscriberCount ?? ""}`);
        }
      }
    }

    const snapshotCount = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM youtube_channel_daily_snapshots WHERE snapshot_date = $1",
      [snapshotDate],
    );

    console.log(`Done. linked=${totalLinkedChannels} processing=${channels.length} fetched=${fetched} saved=${saved} missing=${missing} date_rows=${snapshotCount.rows[0]?.count ?? 0} daily_views_total=${deltaTotal}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
