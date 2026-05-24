import { writeFile } from "node:fs/promises";

interface ArtistRow {
  artist_key: string;
  artist_name: string;
  youtube_subscribers?: string;
  youtube_views?: string;
}

interface SearchItem {
  id: { channelId?: string };
  snippet: {
    title: string;
    description?: string;
    channelTitle?: string;
    thumbnails?: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
  };
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
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 25), 100)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    minSubscribers: Math.max(0, Number(args.get("minSubscribers") ?? 500)),
    out: args.get("out") ?? "",
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

    if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
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

function fmtCount(value: number | null): string {
  if (value == null) return "";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .toLowerCase()
    .trim();
}

function confidenceFor(artistName: string, channelTitle: string, subscribers: number | null): "alta" | "media" | "baja" {
  const artist = normalizeName(artistName);
  const title = normalizeName(channelTitle);
  if (artist && title === artist) return "alta";
  if (artist && title.includes(artist) && (subscribers ?? 0) >= 1_000) return "media";
  return "baja";
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env["YOUTUBE_API_KEY"];
  if (!key) throw new Error("Missing YOUTUBE_API_KEY environment variable.");
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${YOUTUBE_API_BASE}${path}?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function searchChannel(artistName: string): Promise<SearchItem[]> {
  const data = await ytFetch<{ items?: SearchItem[] }>("/search", {
    part: "snippet",
    type: "channel",
    q: `${artistName} oficial`,
    maxResults: "5",
    regionCode: "MX",
  });
  return data.items ?? [];
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

async function main() {
  const { limit, offset, minSubscribers, out } = parseArgs();
  const csv = await fetch(ARTIST_METADATA_URL).then(res => {
    if (!res.ok) throw new Error(`artist metadata HTTP ${res.status}`);
    return res.text();
  });
  const artists = rowsToObjects(parseCsv(csv)).slice(offset, offset + limit);

  const output: string[] = [
    [
      "artist_key",
      "artist_name",
      "confidence",
      "channel_id",
      "channel_title",
      "subscribers",
      "views",
      "videos",
      "custom_url",
      "channel_url",
      "sheet_subscribers",
      "sheet_views",
    ].map(csvCell).join(","),
  ];

  for (const artist of artists) {
    try {
      const hits = await searchChannel(artist.artist_name);
      const channelIds = hits.map(hit => hit.id.channelId).filter((id): id is string => Boolean(id));
      const channels = await fetchChannels(channelIds);
      const candidates = channels
        .map(channel => {
          const subscribers = channel.statistics?.hiddenSubscriberCount
            ? null
            : Number(channel.statistics?.subscriberCount ?? 0);
          return {
            channel,
            subscribers,
            confidence: confidenceFor(artist.artist_name, channel.snippet.title, subscribers),
          };
        })
        .filter(candidate => (candidate.subscribers ?? 0) >= minSubscribers)
        .sort((a, b) => {
          const rank = { alta: 3, media: 2, baja: 1 };
          return rank[b.confidence] - rank[a.confidence] || (b.subscribers ?? 0) - (a.subscribers ?? 0);
        });

      const best = candidates[0];
      if (!best) {
        output.push([
          artist.artist_key,
          artist.artist_name,
          "sin_resultado",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          artist.youtube_subscribers ?? "",
          artist.youtube_views ?? "",
        ].map(csvCell).join(","));
      } else {
        const channel = best.channel;
        output.push([
          artist.artist_key,
          artist.artist_name,
          best.confidence,
          channel.id,
          channel.snippet.title,
          fmtCount(best.subscribers),
          fmtCount(Number(channel.statistics?.viewCount ?? 0)),
          channel.statistics?.videoCount ?? "",
          channel.snippet.customUrl ?? "",
          `https://www.youtube.com/channel/${channel.id}`,
          artist.youtube_subscribers ?? "",
          artist.youtube_views ?? "",
        ].map(csvCell).join(","));
      }
    } catch (err) {
      output.push([
        artist.artist_key,
        artist.artist_name,
        "error",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        artist.youtube_subscribers ?? "",
        artist.youtube_views ?? "",
      ].map(csvCell).join(","));
      console.error(`[youtube-candidates] ${artist.artist_name}: ${(err as Error).message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  const outputCsv = output.join("\n");
  if (out) {
    await writeFile(out, outputCsv);
    console.log(`Wrote ${artists.length} artist candidates to ${out}`);
  } else {
    console.log(outputCsv);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
