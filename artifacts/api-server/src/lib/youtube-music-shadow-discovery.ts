import { Innertube, UniversalCache } from "youtubei.js";
import {
  decideYoutubeMusicCandidate,
  normalizeYoutubeArtistName,
  type YoutubeMusicCredit,
  type YoutubeShadowStatus,
} from "./youtube-shadow-policy";
import { getYoutubeShadowManualReview } from "./youtube-shadow-manual-review";
import { youtubeShadowCanUseVerifiedChannelFallback } from "./youtube-shadow-bootstrap-policy";

type PgClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  release: () => void;
};

interface MusicItemLike {
  id?: string;
  item_type?: string;
  title?: string | { toString(): string };
  artists?: Array<{ name?: string; channel_id?: string }>;
  authors?: Array<{ name?: string; channel_id?: string }>;
  author?: { name?: string; channel_id?: string };
  thumbnails?: Array<{ url?: string }>;
}

interface DiscoveredCandidate {
  videoId: string;
  title: string;
  credits: YoutubeMusicCredit[];
  thumbnailUrl: string | null;
  sourceSections: Set<string>;
  releaseIds: Set<string>;
}

interface YoutubeChannelResponse {
  items?: Array<{
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
  error?: { message?: string };
}

interface YoutubePlaylistItemsResponse {
  nextPageToken?: string;
  items?: Array<{
    contentDetails?: { videoId?: string };
    snippet?: {
      title?: string;
      resourceId?: { videoId?: string };
      thumbnails?: Record<string, { url?: string }>;
    };
  }>;
  error?: { message?: string };
}

function decideCandidate(candidate: DiscoveredCandidate, artistKey: string, artistName: string, browseId: string) {
  const reviewed = getYoutubeShadowManualReview(artistKey, candidate.videoId);
  if (reviewed) {
    return {
      status: reviewed.status,
      confidence: reviewed.confidence,
      reason: reviewed.reason,
      manualReview: reviewed,
    };
  }
  return {
    ...decideYoutubeMusicCandidate({
      videoId: candidate.videoId,
      credits: candidate.credits,
      sourceSections: [...candidate.sourceSections],
    }, artistName, browseId),
    manualReview: null,
  };
}

export interface YoutubeMusicDiscoverySummary {
  artistKey: string;
  artistName: string;
  browseId: string | null;
  mappingEvidence: "exact_name_search" | "verified_youtube_channel" | null;
  mappingStatus: YoutubeShadowStatus | "not_found" | "ambiguous";
  releasesInspected: number;
  uniqueCandidates: number;
  reviewCandidates: number;
  rejectedCandidates: number;
  savedCandidates: number;
  candidates?: YoutubeMusicDiscoveryAuditCandidate[];
  error?: string;
}

export interface YoutubeMusicDiscoveryAuditCandidate {
  videoId: string;
  canonicalUrl: string;
  title: string;
  credits: YoutubeMusicCredit[];
  thumbnailUrl: string | null;
  sourceSections: string[];
  releaseIds: string[];
  status: YoutubeShadowStatus;
  confidence: number;
  decisionReason: string;
}

export async function ensureYoutubeShadowTables(client: PgClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_music_artist_candidates (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      artist_name text NOT NULL,
      browse_id text NOT NULL,
      canonical_url text NOT NULL,
      evidence_source text NOT NULL DEFAULT 'youtube_music_innertube',
      confidence_score integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'review' CHECK (status IN ('verified','review','rejected')),
      evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      discovered_at timestamptz NOT NULL DEFAULT now(),
      verified_at timestamptz,
      last_checked_at timestamptz NOT NULL DEFAULT now(),
      rejection_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_music_catalog_candidates (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      artist_name text NOT NULL,
      artist_browse_id text NOT NULL,
      video_id text NOT NULL REFERENCES youtube_tracked_videos(video_id) ON DELETE cascade,
      title text NOT NULL DEFAULT '',
      canonical_url text NOT NULL,
      evidence_source text NOT NULL DEFAULT 'youtube_music_innertube',
      evidence_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
      confidence_score integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'review' CHECK (status IN ('verified','review','rejected')),
      sampling_status text NOT NULL DEFAULT 'shadow' CHECK (sampling_status IN ('shadow','paused','disabled')),
      refresh_tier text NOT NULL DEFAULT 'baseline' CHECK (refresh_tier IN ('hot','warm','baseline')),
      evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      discovered_at timestamptz NOT NULL DEFAULT now(),
      verified_at timestamptz,
      last_checked_at timestamptz,
      last_observed_at timestamptz,
      rejection_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_music_shadow_runs (
      id serial PRIMARY KEY,
      run_type text NOT NULL,
      artist_key text,
      status text NOT NULL,
      summary jsonb NOT NULL DEFAULT '{}'::jsonb,
      started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz
    );
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS youtube_music_artist_candidates_artist_browse_unique ON youtube_music_artist_candidates(artist_key, browse_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_music_artist_candidates_status_idx ON youtube_music_artist_candidates(status, last_checked_at);`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS youtube_music_catalog_candidates_artist_video_unique ON youtube_music_catalog_candidates(artist_key, video_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_music_catalog_candidates_status_idx ON youtube_music_catalog_candidates(status, sampling_status, refresh_tier);`);
  await client.query(`CREATE INDEX IF NOT EXISTS youtube_music_catalog_candidates_video_idx ON youtube_music_catalog_candidates(video_id);`);
}

function itemTitle(item: MusicItemLike): string {
  if (typeof item.title === "string") return item.title;
  return item.title?.toString() ?? "";
}

function itemCredits(item: MusicItemLike): YoutubeMusicCredit[] {
  const credits = [...(item.artists ?? []), ...(item.authors ?? [])]
    .filter(artist => artist.name)
    .map(artist => ({ name: artist.name!, channelId: artist.channel_id }));
  if (item.author?.name) credits.push({ name: item.author.name, channelId: item.author.channel_id });
  return mergeCredits([], credits);
}

export function mergeCredits(
  current: YoutubeMusicCredit[],
  incoming: YoutubeMusicCredit[],
): YoutubeMusicCredit[] {
  const merged = new Map<string, YoutubeMusicCredit>();
  for (const credit of [...current, ...incoming]) {
    const key = credit.channelId
      ? `id:${credit.channelId}`
      : `name:${normalizeYoutubeArtistName(credit.name)}`;
    if (!merged.has(key)) merged.set(key, credit);
  }
  return [...merged.values()];
}

export function creditLineIncludesExactArtist(creditLine: string, artistName: string): boolean {
  const line = normalizeYoutubeArtistName(creditLine);
  const artist = normalizeYoutubeArtistName(artistName);
  return line === artist
    || line.startsWith(`${artist} and `)
    || line.endsWith(` and ${artist}`)
    || line.includes(` and ${artist} and `);
}

function addCandidate(
  candidates: Map<string, DiscoveredCandidate>,
  item: MusicItemLike,
  sourceSection: string,
  releaseId?: string,
  inheritedCredits: YoutubeMusicCredit[] = [],
) {
  if (!item.id || !["song", "video"].includes(item.item_type ?? "")) return;
  const explicitCredits = itemCredits(item);
  const resolvedCredits = explicitCredits.length ? explicitCredits : inheritedCredits;
  const existing = candidates.get(item.id) ?? {
    videoId: item.id,
    title: itemTitle(item),
    credits: resolvedCredits,
    thumbnailUrl: item.thumbnails?.at(-1)?.url ?? null,
    sourceSections: new Set<string>(),
    releaseIds: new Set<string>(),
  };
  existing.sourceSections.add(sourceSection);
  if (releaseId) existing.releaseIds.add(releaseId);
  if (!existing.title) existing.title = itemTitle(item);
  existing.credits = mergeCredits(existing.credits, resolvedCredits);
  if (!existing.thumbnailUrl) existing.thumbnailUrl = item.thumbnails?.at(-1)?.url ?? null;
  candidates.set(item.id, existing);
}

async function fetchYoutubeJson<T extends { error?: { message?: string } }>(url: URL): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json() as T;
  if (!response.ok) {
    throw new Error(payload.error?.message || `YouTube Data API request failed with status ${response.status}.`);
  }
  return payload;
}

async function discoverVerifiedChannelUploads(
  artistName: string,
  channelId: string,
): Promise<Map<string, DiscoveredCandidate>> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY for verified-channel fallback.");

  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "contentDetails");
  channelUrl.searchParams.set("id", channelId);
  channelUrl.searchParams.set("key", apiKey);
  const channel = await fetchYoutubeJson<YoutubeChannelResponse>(channelUrl);
  const uploadsPlaylistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error("Verified YouTube channel has no accessible uploads playlist.");

  const candidates = new Map<string, DiscoveredCandidate>();
  let pageToken: string | undefined;
  const maxVideos = Math.max(1, Math.min(5_000, Number(process.env["YOUTUBE_SHADOW_CHANNEL_UPLOAD_LIMIT"] ?? "1000") || 1_000));
  do {
    const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    playlistUrl.searchParams.set("part", "snippet,contentDetails");
    playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
    playlistUrl.searchParams.set("maxResults", "50");
    playlistUrl.searchParams.set("key", apiKey);
    if (pageToken) playlistUrl.searchParams.set("pageToken", pageToken);
    const page = await fetchYoutubeJson<YoutubePlaylistItemsResponse>(playlistUrl);
    for (const entry of page.items ?? []) {
      const videoId = entry.contentDetails?.videoId ?? entry.snippet?.resourceId?.videoId;
      if (!videoId || candidates.size >= maxVideos) break;
      addCandidate(candidates, {
        id: videoId,
        item_type: "video",
        title: entry.snippet?.title ?? "",
        artists: [{ name: artistName, channel_id: channelId }],
        thumbnails: Object.values(entry.snippet?.thumbnails ?? {}),
      }, "verified_official_channel_upload");
    }
    pageToken = candidates.size < maxVideos ? page.nextPageToken : undefined;
  } while (pageToken);

  return candidates;
}

async function resolveBrowseId(yt: Innertube, artistName: string): Promise<{ browseId: string | null; ambiguous: boolean }> {
  const results = await yt.music.search(artistName, { type: "artist" });
  const exact = (results.artists?.contents ?? [])
    .filter(item => normalizeYoutubeArtistName(item.name ?? "") === normalizeYoutubeArtistName(artistName));
  const ids = [...new Set(exact.map(item => item.id).filter((id): id is string => Boolean(id)))];
  return { browseId: ids.length === 1 ? ids[0]! : null, ambiguous: ids.length > 1 };
}

async function persistDiscovery(
  client: PgClient,
  summary: YoutubeMusicDiscoverySummary,
  candidates: Map<string, DiscoveredCandidate>,
) {
  if (!summary.browseId) return;
  await client.query(
    `
      INSERT INTO youtube_music_artist_candidates (
        artist_key, artist_name, browse_id, canonical_url, confidence_score, status, evidence, last_checked_at, updated_at
      ) VALUES ($1,$2,$3,$4,85,'review',$5::jsonb,now(),now())
      ON CONFLICT (artist_key, browse_id) DO UPDATE SET
        artist_name = excluded.artist_name,
        canonical_url = excluded.canonical_url,
        confidence_score = GREATEST(youtube_music_artist_candidates.confidence_score, excluded.confidence_score),
        evidence = youtube_music_artist_candidates.evidence || excluded.evidence,
        last_checked_at = now(),
        updated_at = now()
    `,
    [
      summary.artistKey,
      summary.artistName,
      summary.browseId,
      `https://music.youtube.com/channel/${summary.browseId}`,
      JSON.stringify({
        exactNormalizedName: summary.mappingEvidence === "exact_name_search",
        verifiedYoutubeChannelMapping: summary.mappingEvidence === "verified_youtube_channel",
      }),
    ],
  );

  for (const candidate of candidates.values()) {
    const decision = decideCandidate(candidate, summary.artistKey, summary.artistName, summary.browseId);
    await client.query(
      `
        INSERT INTO youtube_tracked_videos (video_id, title, thumbnail_url, metadata, last_seen_at, updated_at)
        VALUES ($1,$2,$3,$4::jsonb,now(),now())
        ON CONFLICT (video_id) DO UPDATE SET
          title = COALESCE(NULLIF(excluded.title, ''), youtube_tracked_videos.title),
          thumbnail_url = COALESCE(excluded.thumbnail_url, youtube_tracked_videos.thumbnail_url),
          metadata = youtube_tracked_videos.metadata || excluded.metadata,
          last_seen_at = now(),
          updated_at = now()
      `,
      [candidate.videoId, candidate.title, candidate.thumbnailUrl, JSON.stringify({ youtubeMusicShadowCandidate: true })],
    );
    await client.query(
      `
        INSERT INTO youtube_music_catalog_candidates (
          artist_key, artist_name, artist_browse_id, video_id, title, canonical_url,
          evidence_sources, confidence_score, status, evidence, last_checked_at, rejection_reason, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10::jsonb,now(),$11,now())
        ON CONFLICT (artist_key, video_id) DO UPDATE SET
          title = COALESCE(NULLIF(excluded.title, ''), youtube_music_catalog_candidates.title),
          evidence_sources = excluded.evidence_sources,
          confidence_score = GREATEST(youtube_music_catalog_candidates.confidence_score, excluded.confidence_score),
          status = CASE
            WHEN $12::boolean THEN excluded.status
            WHEN youtube_music_catalog_candidates.status = 'verified' THEN 'verified'
            ELSE excluded.status
          END,
          evidence = youtube_music_catalog_candidates.evidence || excluded.evidence,
          last_checked_at = now(),
          rejection_reason = excluded.rejection_reason,
          updated_at = now()
      `,
      [
        summary.artistKey,
        summary.artistName,
        summary.browseId,
        candidate.videoId,
        candidate.title,
        `https://music.youtube.com/watch?v=${candidate.videoId}`,
        JSON.stringify([...candidate.sourceSections]),
        decision.confidence,
        decision.status,
        JSON.stringify({
          credits: candidate.credits,
          releaseIds: [...candidate.releaseIds],
          decisionReason: decision.reason,
          manualReview: decision.manualReview,
        }),
        decision.status === "rejected" ? decision.reason : null,
        decision.manualReview != null,
      ],
    );
    summary.savedCandidates += 1;
  }
}

async function finalizeDiscovery(
  summary: YoutubeMusicDiscoverySummary,
  candidates: Map<string, DiscoveredCandidate>,
  input: { artistKey: string; artistName: string; write?: boolean; includeCandidates?: boolean },
  client: PgClient | null,
) {
  summary.uniqueCandidates = candidates.size;
  for (const candidate of candidates.values()) {
    const decision = decideCandidate(candidate, summary.artistKey, summary.artistName, summary.browseId!);
    if (decision.status === "review") summary.reviewCandidates += 1;
    else summary.rejectedCandidates += 1;
  }

  if (input.includeCandidates) {
    summary.candidates = [...candidates.values()].map(candidate => {
      const decision = decideCandidate(candidate, summary.artistKey, summary.artistName, summary.browseId!);
      return {
        videoId: candidate.videoId,
        canonicalUrl: `https://music.youtube.com/watch?v=${candidate.videoId}`,
        title: candidate.title,
        credits: candidate.credits,
        thumbnailUrl: candidate.thumbnailUrl,
        sourceSections: [...candidate.sourceSections],
        releaseIds: [...candidate.releaseIds],
        status: decision.status,
        confidence: decision.confidence,
        decisionReason: decision.reason,
      };
    });
  }

  if (input.write && client) await persistDiscovery(client, summary, candidates);
  if (summary.reviewCandidates === 0) {
    summary.error = summary.uniqueCandidates > 0
      ? "Discovery returned no eligible review candidates. Rejected evidence was retained for audit."
      : "Discovery returned no catalog videos for this artist.";
  }
}

export async function discoverYoutubeMusicArtist(input: {
  artistKey: string;
  artistName: string;
  browseId?: string | null;
  trustedBrowseId?: boolean;
  write?: boolean;
  includeCandidates?: boolean;
}): Promise<YoutubeMusicDiscoverySummary> {
  const summary: YoutubeMusicDiscoverySummary = {
    artistKey: input.artistKey,
    artistName: input.artistName,
    browseId: input.browseId ?? null,
    mappingEvidence: input.browseId && input.trustedBrowseId ? "verified_youtube_channel" : null,
    mappingStatus: "not_found",
    releasesInspected: 0,
    uniqueCandidates: 0,
    reviewCandidates: 0,
    rejectedCandidates: 0,
    savedCandidates: 0,
  };
  let client: PgClient | null = null;
  let runId: number | null = null;
  try {
    if (input.write) {
      const { pool } = await import("@workspace/db");
      const { ensureYoutubeVideoTrackerTables } = await import("./youtube-video-tracker-scheduler");
      client = await pool.connect();
      await ensureYoutubeVideoTrackerTables(client);
      await ensureYoutubeShadowTables(client);
      const run = await client.query<{ id: number }>(
        `INSERT INTO youtube_music_shadow_runs (run_type, artist_key, status) VALUES ('discovery',$1,'running') RETURNING id`,
        [input.artistKey],
      );
      runId = run.rows[0]?.id ?? null;
    }

    if (youtubeShadowCanUseVerifiedChannelFallback({
      browseId: summary.browseId,
      trustedBrowseId: input.trustedBrowseId,
    })) {
      const candidates = await discoverVerifiedChannelUploads(input.artistName, summary.browseId!);
      summary.mappingStatus = "review";
      await finalizeDiscovery(summary, candidates, input, client);
      return summary;
    }

    const yt = await Innertube.create({ cache: new UniversalCache(false), lang: "en", location: "MX" });
    if (!summary.browseId) {
      const resolved = await resolveBrowseId(yt, input.artistName);
      if (resolved.ambiguous) {
        summary.mappingStatus = "ambiguous";
        summary.error = "Multiple exact YouTube Music artist matches were returned.";
        return summary;
      }
      summary.browseId = resolved.browseId;
      if (resolved.browseId) summary.mappingEvidence = "exact_name_search";
    }
    if (!summary.browseId) {
      summary.error = "No exact YouTube Music artist match was found.";
      return summary;
    }

    let artist;
    try {
      artist = await yt.music.getArtist(summary.browseId);
    } catch (musicBrowseError) {
      if (!youtubeShadowCanUseVerifiedChannelFallback({
        browseId: summary.browseId,
        trustedBrowseId: input.trustedBrowseId,
      })) throw musicBrowseError;
      const candidates = await discoverVerifiedChannelUploads(input.artistName, summary.browseId);
      summary.mappingStatus = "review";
      await finalizeDiscovery(summary, candidates, input, client);
      return summary;
    }
    const resolvedName = artist.header && "title" in artist.header ? artist.header.title?.toString() : "";
    if (
      !input.trustedBrowseId
      && normalizeYoutubeArtistName(resolvedName ?? "") !== normalizeYoutubeArtistName(input.artistName)
    ) {
      summary.mappingStatus = "ambiguous";
      summary.error = `Resolved artist name did not match: ${resolvedName ?? "unknown"}`;
      return summary;
    }
    summary.mappingStatus = "review";

    const candidates = new Map<string, DiscoveredCandidate>();
    const songs = await artist.getAllSongs();
    for (const item of songs?.contents ?? []) addCandidate(candidates, item as MusicItemLike, "all_songs");

    const releases = new Map<string, MusicItemLike>();
    for (const section of artist.sections) {
      const sectionTitle = "header" in section
        ? section.header?.title?.toString() ?? "section"
        : section.title?.toString() ?? "section";
      for (const rawItem of section.contents ?? []) {
        const item = rawItem as MusicItemLike;
        addCandidate(candidates, item, sectionTitle);
        if (
          item.item_type === "album"
          && item.id?.startsWith("MPRE")
        ) {
          releases.set(item.id, item);
        }
      }
    }

    for (const release of releases.values()) {
      const album = await yt.music.getAlbum(release.id!);
      summary.releasesInspected += 1;
      const headerCredits = album.header && "author" in album.header
        ? itemCredits({ author: album.header.author })
        : [];
      const headerCreditLine = album.header && "strapline_text_one" in album.header
        ? album.header.strapline_text_one?.toString() ?? ""
        : "";
      const explicitHeaderArtistCredit = creditLineIncludesExactArtist(headerCreditLine, summary.artistName)
        ? [{ name: summary.artistName }]
        : [];
      const releaseCredits = mergeCredits(
        itemCredits(release),
        mergeCredits(headerCredits, explicitHeaderArtistCredit),
      );
      const releaseConfirmsArtist = releaseCredits.some(credit =>
        credit.channelId === summary.browseId
        || normalizeYoutubeArtistName(credit.name) === normalizeYoutubeArtistName(summary.artistName),
      );
      if (!releaseConfirmsArtist) continue;
      for (const item of album.contents) {
        addCandidate(candidates, item as MusicItemLike, "release_track", release.id, releaseCredits);
      }
    }

    await finalizeDiscovery(summary, candidates, input, client);
    return summary;
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    return summary;
  } finally {
    if (runId != null && client) {
      await client.query(
        `UPDATE youtube_music_shadow_runs SET status=$2, summary=$3::jsonb, finished_at=now() WHERE id=$1`,
        [runId, summary.error || summary.mappingStatus !== "review" || summary.reviewCandidates === 0 ? "failed" : "complete", JSON.stringify(summary)],
      ).catch(() => {});
    }
    client?.release();
  }
}
