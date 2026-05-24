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
  youtube_views?: string;
}

interface SearchItem {
  id: { channelId?: string };
  snippet: { title: string };
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

function isYouTubeRateLimit(message: string) {
  const normalized = message.toLowerCase();
  return (
    message.includes("YouTube API 429") ||
    normalized.includes("quota exceeded") ||
    normalized.includes("exceeded your quota")
  );
}

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 25), 50)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    minScore: Math.max(0, Math.min(Number(args.get("minScore") ?? 80), 100)),
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
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function compactName(value: string): string {
  return normalizeName(value).replace(/\s+/g, "");
}

function parseCount(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
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

async function searchChannels(artistName: string): Promise<string[]> {
  const data = await ytFetch<{ items?: SearchItem[] }>("/search", {
    part: "snippet",
    type: "channel",
    q: `${artistName} oficial`,
    maxResults: "5",
    regionCode: "MX",
  });
  return [...new Set((data.items ?? []).map(item => item.id.channelId).filter((id): id is string => Boolean(id)))];
}

async function fetchChannels(channelIds: string[]): Promise<ChannelItem[]> {
  if (channelIds.length === 0) return [];
  const data = await ytFetch<{ items?: ChannelItem[] }>("/channels", {
    part: "snippet,statistics",
    id: channelIds.join(","),
    maxResults: String(channelIds.length),
  });
  return data.items ?? [];
}

function scoreChannel(artist: ArtistRow, channel: ChannelItem): { score: number; reasons: string[] } {
  const artistName = normalizeName(artist.artist_name);
  const title = normalizeName(channel.snippet.title);
  const titleCompact = compactName(channel.snippet.title);
  const customUrl = compactName(channel.snippet.customUrl ?? "");
  const artistCompact = compactName(artist.artist_name);
  const titleCompactLoose = titleCompact.replace(/and|y/g, "");
  const artistCompactLoose = artistCompact.replace(/and|y/g, "");
  const subscribers = channel.statistics?.hiddenSubscriberCount ? null : Number(channel.statistics?.subscriberCount ?? 0);
  const views = channel.statistics?.viewCount != null ? Number(channel.statistics.viewCount) : null;
  const sheetSubscribers = parseCount(artist.youtube_subscribers);
  const sheetViews = parseCount(artist.youtube_views);
  const reasons: string[] = [];
  let score = 0;

  if (title.includes(" topic")) {
    return { score: 0, reasons: ["topic channel"] };
  }

  if (title === artistName) {
    score += 45;
    reasons.push("title exact");
  } else if (title === `${artistName} oficial` || title === `${artistName} official`) {
    score += 42;
    reasons.push("official title");
  } else if (titleCompact === artistCompact) {
    score += 42;
    reasons.push("compact title exact");
  } else if (titleCompact === `oficial${artistCompact}` || titleCompact === `${artistCompact}oficial` || titleCompact === `official${artistCompact}` || titleCompact === `${artistCompact}official`) {
    score += 40;
    reasons.push("compact official title");
  } else if (artistCompactLoose.length >= 6 && (titleCompactLoose === artistCompactLoose || titleCompactLoose === `oficial${artistCompactLoose}` || titleCompactLoose === `${artistCompactLoose}oficial` || titleCompactLoose === `official${artistCompactLoose}` || titleCompactLoose === `${artistCompactLoose}official`)) {
    score += 38;
    reasons.push("loose compact title");
  } else if (artistCompactLoose.length >= 6 && titleCompactLoose.includes(artistCompactLoose)) {
    score += 32;
    reasons.push("loose compact title contains artist");
  } else if (titleCompact.includes(artistCompact) && artistCompact.length >= 6) {
    score += 34;
    reasons.push("compact title contains artist");
  } else if (title.includes(artistName)) {
    score += 32;
    reasons.push("title contains artist");
  } else {
    const artistTokens = new Set(artistName.split(" ").filter(Boolean));
    const titleTokens = new Set(title.split(" ").filter(Boolean));
    const overlap = [...artistTokens].filter(token => titleTokens.has(token)).length;
    const ratio = artistTokens.size > 0 ? overlap / artistTokens.size : 0;
    if (ratio >= 0.75) {
      score += 22;
      reasons.push("strong token overlap");
    } else if (ratio >= 0.5) {
      score += 12;
      reasons.push("partial token overlap");
    }
  }

  if (customUrl && artistCompact && customUrl.includes(artistCompact)) {
    score += 15;
    reasons.push("handle match");
  }

  if (sheetSubscribers != null && subscribers != null && sheetSubscribers > 0) {
    const ratio = subscribers / sheetSubscribers;
    if (ratio >= 0.5 && ratio <= 2) {
      score += 30;
      reasons.push("subs close");
    } else if (ratio >= 0.25 && ratio <= 4) {
      score += 20;
      reasons.push("subs reasonable");
    } else if (ratio >= 0.1 && ratio <= 10) {
      score += 5;
      reasons.push("subs loose");
    } else {
      score -= 25;
      reasons.push("subs mismatch");
    }
  } else if ((subscribers ?? 0) >= 100_000) {
    score += 8;
    reasons.push("substantial subs");
  }

  if (sheetViews != null && views != null && sheetViews > 0) {
    const ratio = views / sheetViews;
    if (ratio >= 0.4 && ratio <= 2.5) {
      score += 10;
      reasons.push("views close");
    } else if (ratio >= 0.15 && ratio <= 6) {
      score += 4;
      reasons.push("views loose");
    }
  }

  return { score: Math.max(0, Math.min(score, 100)), reasons };
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

async function ensureCandidateTable(pool: InstanceType<typeof Pool>) {
  await pool.query(`
    create table if not exists youtube_channel_candidates (
      artist_key text primary key,
      artist_name text not null,
      status text not null,
      best_channel_id text,
      best_title text,
      best_score integer,
      subscriber_count text,
      reasons jsonb,
      error text,
      reviewed_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
}

async function saveCandidate(
  pool: InstanceType<typeof Pool>,
  artist: ArtistRow,
  status: "review" | "no_result" | "error",
  best?: { channel: ChannelItem; score: number; reasons: string[] },
  error?: string,
) {
  const subscribers = best?.channel.statistics?.hiddenSubscriberCount
    ? null
    : best?.channel.statistics?.subscriberCount != null
      ? Number(best.channel.statistics.subscriberCount)
      : null;

  await pool.query(
    `insert into youtube_channel_candidates (
      artist_key, artist_name, status, best_channel_id, best_title, best_score,
      subscriber_count, reasons, error, reviewed_at, updated_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
    on conflict (artist_key) do update set
      artist_name = excluded.artist_name,
      status = excluded.status,
      best_channel_id = excluded.best_channel_id,
      best_title = excluded.best_title,
      best_score = excluded.best_score,
      subscriber_count = excluded.subscriber_count,
      reasons = excluded.reasons,
      error = excluded.error,
      updated_at = excluded.updated_at`,
    [
      artist.artist_key,
      artist.artist_name,
      status,
      best?.channel.id ?? null,
      best?.channel.snippet.title ?? null,
      best?.score ?? null,
      subscribers != null ? fmtCount(subscribers) : null,
      JSON.stringify(best?.reasons ?? []),
      error ?? null,
    ],
  );
}

async function main() {
  const { limit, offset, minScore, skipReviewed, write } = parseArgs();
  if (!process.env["DATABASE_URL"]) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
  try {
    await ensureCandidateTable(pool);
    const csv = await fetch(ARTIST_METADATA_URL).then(res => {
      if (!res.ok) throw new Error(`artist metadata HTTP ${res.status}`);
      return res.text();
    });
    const artists = rowsToObjects(parseCsv(csv));
    const existing = await pool.query<{ artist_key: string }>("select artist_key from youtube_channels");
    const linked = new Set(existing.rows.map(row => row.artist_key));
    const reviewedRows = skipReviewed
      ? await pool.query<{ artist_key: string }>("select artist_key from youtube_channel_candidates where status in ('review','no_result','error')")
      : { rows: [] };
    const reviewed = new Set(reviewedRows.rows.map(row => row.artist_key));
    const queue = artists
      .filter(artist => !linked.has(artist.artist_key))
      .filter(artist => !skipReviewed || !reviewed.has(artist.artist_key))
      .slice(offset, offset + limit);

    let autoSaved = 0;
    let suggested = 0;
    let skipped = 0;
    console.log(`${write ? "Writing" : "Dry run"} search backfill for ${queue.length} artists. Existing linked: ${linked.size}. Existing reviewed: ${reviewed.size}. minScore=${minScore}. skipReviewed=${skipReviewed}.`);

    for (const artist of queue) {
      try {
        const ids = await searchChannels(artist.artist_name);
        const channels = await fetchChannels(ids);
        const ranked = channels
          .map(channel => ({ channel, ...scoreChannel(artist, channel) }))
          .sort((a, b) => b.score - a.score);
        const best = ranked[0];

        if (!best) {
          skipped += 1;
          console.log(`NO_RESULT,${artist.artist_key},${artist.artist_name}`);
          if (write) await saveCandidate(pool, artist, "no_result");
        } else if (best.score >= minScore) {
          autoSaved += 1;
          const subscribers = best.channel.statistics?.hiddenSubscriberCount ? null : Number(best.channel.statistics?.subscriberCount ?? 0);
          console.log(`${write ? "SAVE" : "AUTO"},${artist.artist_key},${artist.artist_name},score=${best.score},${best.channel.id},${best.channel.snippet.title},${fmtCount(subscribers)},${best.reasons.join("+")}`);
          if (write) await saveChannel(pool, artist, best.channel);
        } else {
          suggested += 1;
          const subscribers = best.channel.statistics?.hiddenSubscriberCount ? null : Number(best.channel.statistics?.subscriberCount ?? 0);
          console.log(`REVIEW,${artist.artist_key},${artist.artist_name},score=${best.score},${best.channel.id},${best.channel.snippet.title},${fmtCount(subscribers)},${best.reasons.join("+")}`);
          if (write) await saveCandidate(pool, artist, "review", best);
        }
      } catch (err) {
        const message = (err as Error).message;
        if (isYouTubeRateLimit(message)) {
          console.error(`RATE_LIMIT,${artist.artist_key},${artist.artist_name},${message}`);
          process.exitCode = 2;
          break;
        }
        skipped += 1;
        console.error(`ERROR,${artist.artist_key},${artist.artist_name},${message}`);
        if (write) await saveCandidate(pool, artist, "error", undefined, message);
      }
      await new Promise(resolve => setTimeout(resolve, 125));
    }

    const finalCount = await pool.query("select count(*)::int as count from youtube_channels");
    console.log(`Done. auto=${autoSaved} review=${suggested} skipped=${skipped} db_channels=${finalCount.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
