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

const VERIFIED_OVERRIDES = [
  { artistKey: "banda ms de sergio lizarraga", artistName: "Banda MS de Sergio Lizárraga", handle: "BandaMS" },
  { artistKey: "julion alvarez and su norteno banda", artistName: "Julión Álvarez & Su Norteño Banda", handle: "LosPasosdeJulionOficial" },
  { artistKey: "jesse and joy", artistName: "Jesse & Joy", handle: "jesseyjoyoficial" },
  { artistKey: "danna paola", artistName: "Danna Paola", handle: "dannapaolaVEVO" },
  { artistKey: "edicion especial", artistName: "Edición Especial", handle: "edicionespecial" },
  { artistKey: "la original banda el limon de salvador lizarraga", artistName: "La Original Banda El Limón de Salvador Lizárraga", handle: "LaOriginalBandaElLimon" },
  { artistKey: "los rehenes", artistName: "Los Rehenes", handle: "LosRehenesOficial" },
  { artistKey: "banda el recodo de cruz lizarraga", artistName: "Banda El Recodo De Cruz Lizárraga", handle: "bandaelrecodooficial" },
  { artistKey: "el duelo", artistName: "EL DUELO", handle: "thegroupduelo" },
  { artistKey: "el coyote y su banda tierra santa", artistName: "El Coyote Y Su Banda Tierra Santa", handle: "ElCoyoteYBandaTVEVO" },
  { artistKey: "industria del amor", artistName: "Industria del Amor", handle: "IndustriaDelAmorOficial" },
  { artistKey: "javier rosas y su artilleria pesada", artistName: "Javier Rosas Y Su Artillería Pesada", handle: "JavierRosasap" },
  { artistKey: "jose maria napoleon", artistName: "José Maria Napoleón", handle: "josenapoleonoficial" },
  { artistKey: "tito torbellino", artistName: "Tito Torbellino", handle: "TitoTorbellinoOficial" },
];

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
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

async function channelByHandle(handle: string): Promise<ChannelItem | null> {
  const data = await ytFetch<{ items?: ChannelItem[] }>("/channels", {
    part: "snippet,statistics",
    forHandle: `@${handle}`,
  });
  return data.items?.[0] ?? null;
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

async function clearCandidate(pool: InstanceType<typeof Pool>, artistKey: string) {
  await pool.query("delete from youtube_channel_candidates where artist_key = $1", [artistKey]).catch(() => undefined);
}

async function main() {
  const { write } = parseArgs();
  if (!process.env["DATABASE_URL"]) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
  try {
    const linkedRows = await pool.query<{ artist_key: string }>("select artist_key from youtube_channels");
    const linked = new Set(linkedRows.rows.map(row => row.artist_key));
    const queue = VERIFIED_OVERRIDES.filter(override => !linked.has(override.artistKey));
    console.log(`${write ? "Writing" : "Dry run"} verified YouTube overrides. pending=${queue.length} alreadyLinked=${VERIFIED_OVERRIDES.length - queue.length}.`);

    let saved = 0;
    let skipped = 0;
    for (const override of queue) {
      const channel = await channelByHandle(override.handle);
      if (!channel) {
        skipped += 1;
        console.log(`NO_RESULT,${override.artistKey},${override.artistName},@${override.handle}`);
        continue;
      }
      const subscribers = channel.statistics?.hiddenSubscriberCount ? null : Number(channel.statistics?.subscriberCount ?? 0);
      console.log(`${write ? "SAVE" : "MATCH"},${override.artistKey},${override.artistName},${channel.id},${channel.snippet.title},${fmtCount(subscribers)},@${override.handle}`);
      if (write) {
        await saveChannel(pool, override.artistKey, channel);
        await clearCandidate(pool, override.artistKey);
        saved += 1;
      }
      await new Promise(resolve => setTimeout(resolve, 125));
    }

    const finalCount = await pool.query("select count(*)::int as count from youtube_channels");
    console.log(`Done. saved=${saved} skipped=${skipped} db_channels=${finalCount.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
