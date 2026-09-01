import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";
import { ensureYoutubeVideoTrackerTables } from "./youtube-video-tracker-create-tables";

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
  artist_name: string | null;
  channel_id: string;
}

interface ChannelApiItem {
  id: string;
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}

interface PlaylistVideo {
  videoId: string;
  channelId: string | null;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 100), 1000)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    // The uploads playlist is paginated in 50-item pages. Keep walking until
    // YouTube returns no nextPageToken so a channel is never silently treated
    // as complete after a small first-page sample.
    videosPerChannel: Math.max(1, Math.min(Number(args.get("videosPerChannel") ?? 10_000), 10_000)),
    write: args.get("write") === "true",
  };
}

function batch<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

async function fetchJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY.");

  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  url.searchParams.set("key", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 240)}`);
  }
  return await res.json() as T;
}

async function uploadsPlaylistByChannel(channelIds: string[]) {
  const data = await fetchJson<{ items?: ChannelApiItem[] }>("channels", {
    part: "contentDetails",
    id: channelIds.join(","),
    maxResults: String(channelIds.length),
  });
  const map = new Map<string, string>();
  for (const item of data.items ?? []) {
    const uploads = item.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) map.set(item.id, uploads);
  }
  return map;
}

async function fetchPlaylistVideos(playlistId: string, limit: number): Promise<PlaylistVideo[]> {
  const videos: PlaylistVideo[] = [];
  let pageToken: string | undefined;

  while (videos.length < limit) {
    const data = await fetchJson<{
      nextPageToken?: string;
      items?: Array<{
        snippet?: {
          title?: string;
          channelId?: string;
          publishedAt?: string;
          thumbnails?: Record<string, { url?: string }>;
          resourceId?: { videoId?: string };
        };
      }>;
    }>("playlistItems", {
      part: "snippet",
      playlistId,
      maxResults: String(Math.min(50, limit - videos.length)),
      ...(pageToken ? { pageToken } : {}),
    });

    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      const thumbnails = item.snippet?.thumbnails ?? {};
      videos.push({
        videoId,
        channelId: item.snippet?.channelId ?? null,
        title: item.snippet?.title ?? "",
        thumbnailUrl: thumbnails.maxres?.url ?? thumbnails.standard?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
        publishedAt: item.snippet?.publishedAt ?? null,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return videos;
}

async function saveVideo(pool: PoolLike, artist: ChannelRow, video: PlaylistVideo) {
  await pool.query(
    `
      INSERT INTO youtube_tracked_videos (
        video_id, channel_id, title, thumbnail_url, published_at, metadata, last_seen_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,now(),now())
      ON CONFLICT (video_id) DO UPDATE SET
        channel_id = COALESCE(excluded.channel_id, youtube_tracked_videos.channel_id),
        title = COALESCE(NULLIF(excluded.title, ''), youtube_tracked_videos.title),
        thumbnail_url = COALESCE(excluded.thumbnail_url, youtube_tracked_videos.thumbnail_url),
        published_at = COALESCE(excluded.published_at, youtube_tracked_videos.published_at),
        metadata = youtube_tracked_videos.metadata || excluded.metadata,
        last_seen_at = now(),
        updated_at = now()
    `,
    [
      video.videoId,
      video.channelId ?? artist.channel_id,
      video.title,
      video.thumbnailUrl,
      video.publishedAt ? new Date(video.publishedAt) : null,
      JSON.stringify({ seedSource: "youtube_uploads_playlist" }),
    ],
  );

  await pool.query(
    `
      INSERT INTO youtube_artist_video_links (
        artist_key, artist_name, video_id, source_type, confidence_score, priority, active, metadata, updated_at
      )
      VALUES ($1,$2,$3,'youtube_uploads',82,60,true,$4::jsonb,now())
      ON CONFLICT (artist_key, video_id) DO UPDATE SET
        artist_name = COALESCE(NULLIF(excluded.artist_name, ''), youtube_artist_video_links.artist_name),
        confidence_score = GREATEST(youtube_artist_video_links.confidence_score, excluded.confidence_score),
        priority = GREATEST(youtube_artist_video_links.priority, excluded.priority),
        active = true,
        metadata = youtube_artist_video_links.metadata || excluded.metadata,
        updated_at = now()
    `,
    [
      artist.artist_key,
      artist.artist_name ?? artist.artist_key,
      video.videoId,
      JSON.stringify({ seedSource: "youtube_uploads_playlist", channelId: artist.channel_id }),
    ],
  );
}

async function main() {
  const { limit, offset, videosPerChannel, write } = parseArgs();
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await ensureYoutubeVideoTrackerTables(pool);
    const channelRows = await pool.query<ChannelRow>(
      `
        SELECT yc.artist_key, c.artist_name, yc.channel_id
        FROM youtube_channels yc
        LEFT JOIN kworb_coverage c ON c.artist_key = yc.artist_key
        WHERE yc.channel_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM kworb_coverage roster
            WHERE roster.status='active'
              AND regexp_replace(
                translate(lower(roster.artist_key), 'áéíóúüñ', 'aeiouun'),
                '[^a-z0-9]', '', 'g'
              ) = regexp_replace(
                translate(lower(yc.artist_key), 'áéíóúüñ', 'aeiouun'),
                '[^a-z0-9]', '', 'g'
              )
          )
        ORDER BY yc.artist_key
        OFFSET $1
        LIMIT $2
      `,
      [offset, limit],
    );

    let fetchedChannels = 0;
    let savedVideos = 0;
    let missingUploads = 0;

    console.log(`${write ? "Writing" : "Dry run"} YouTube upload playlist seed: channels=${channelRows.rows.length} videosPerChannel=${videosPerChannel}`);

    for (const group of batch(channelRows.rows, 50)) {
      const uploadsByChannel = await uploadsPlaylistByChannel(group.map(channel => channel.channel_id));
      for (const artist of group) {
        const uploadsPlaylist = uploadsByChannel.get(artist.channel_id);
        if (!uploadsPlaylist) {
          missingUploads += 1;
          console.log(`MISSING_UPLOADS,${artist.artist_key},${artist.channel_id}`);
          continue;
        }

        const videos = await fetchPlaylistVideos(uploadsPlaylist, videosPerChannel);
        fetchedChannels += 1;
        for (const video of videos) {
          if (write) {
            await saveVideo(pool, artist, video);
            savedVideos += 1;
          } else {
            console.log(`VIDEO,${artist.artist_key},${video.videoId},${video.title}`);
          }
        }
        console.log(`${write ? "SAVE" : "FETCH"},${artist.artist_key},videos=${videos.length}`);
      }
    }

    console.log(`Done. fetched_channels=${fetchedChannels} saved_videos=${savedVideos} missing_uploads=${missingUploads}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
