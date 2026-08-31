import { Innertube, UniversalCache } from "youtubei.js";
import { pool } from "@workspace/db";
import {
  decideYoutubeMusicCandidate,
  normalizeYoutubeArtistName,
  type YoutubeMusicCredit,
  type YoutubeShadowStatus,
} from "./youtube-shadow-policy";
import { reserveYoutubeApiUsage } from "./youtube-api-budget";
import { getYoutubeShadowManualReview } from "./youtube-shadow-manual-review";
import {
  youtubeShadowCanUseVerifiedChannelFallback,
  youtubeShadowCanonicalChannelId,
} from "./youtube-shadow-bootstrap-policy";

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
  channel_id?: string;
  channelId?: string;
  uploader?: { channel_id?: string; channelId?: string };
  thumbnails?: Array<{ url?: string }>;
}

interface DiscoveredCandidate {
  videoId: string;
  title: string;
  credits: YoutubeMusicCredit[];
  thumbnailUrl: string | null;
  uploaderChannelId: string | null;
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
      uploaderChannelId: candidate.uploaderChannelId,
    }, artistName, browseId),
    manualReview: null,
  };
}

export interface YoutubeMusicDiscoverySummary {
  artistKey: string;
  artistName: string;
  browseId: string | null;
  mappingEvidence: "exact_name_search" | "verified_youtube_channel" | null;
  mappingStatus: YoutubeShadowStatus | "not_found" | "ambiguous" | "retryable";
  releasesInspected: number;
  uniqueCandidates: number;
  reviewCandidates: number;
  rejectedCandidates: number;
  verifiedCandidates: number;
  savedCandidates: number;
  retryAttempts?: number;
  parserWarnings?: string[];
  identityMatches?: YoutubeArtistIdentityMatch[];
  candidates?: YoutubeMusicDiscoveryAuditCandidate[];
  error?: string;
  sourceChannelId?: string;
}

export interface YoutubeArtistIdentityMatch {
  browseId: string;
  name: string;
}

export interface TrustedYoutubeIdentity {
  browseId: string;
  source: "youtube_channel" | "verified_youtube_music_mapping";
}

export interface TrustedYoutubeIdentityResolution {
  identity: TrustedYoutubeIdentity | null;
  ambiguous: boolean;
  candidates: YoutubeArtistIdentityMatch[];
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

export class YoutubeRetryableError extends Error {
  readonly attempts: number;
  readonly statusCode: number | null;
  readonly retryAfterMs: number | null;

  constructor(message: string, options: {
    attempts: number;
    statusCode: number | null;
    retryAfterMs: number | null;
  }) {
    super(message);
    this.name = "YoutubeRetryableError";
    this.attempts = options.attempts;
    this.statusCode = options.statusCode;
    this.retryAfterMs = options.retryAfterMs;
  }
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    const match = String(error).match(/\b(403|429|5\d{2})\b/);
    return match ? Number(match[1]) : null;
  }
  const record = error as Record<string, unknown>;
  const direct = [record.status, record.statusCode, (record.response as Record<string, unknown> | undefined)?.status]
    .find(value => typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value)));
  if (direct != null) return Number(direct);
  const match = String(record.message ?? error).match(/\b(403|429|5\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function errorRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const response = record.response as Record<string, unknown> | undefined;
  const headers = response?.headers ?? record.headers;
  let value: unknown;
  if (headers && typeof (headers as { get?: unknown }).get === "function") {
    value = (headers as { get(name: string): unknown }).get("retry-after");
  } else if (headers && typeof headers === "object") {
    const headerRecord = headers as Record<string, unknown>;
    value = headerRecord["retry-after"] ?? headerRecord["Retry-After"];
  }
  value ??= record.retryAfter ?? record.retryAfterMs;
  if (typeof value === "number" && Number.isFinite(value)) {
    return record.retryAfterMs != null ? Math.max(0, value) : Math.max(0, value * 1000);
  }
  if (typeof value === "string") {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  return null;
}

export function isRetryableYoutubeError(error: unknown): boolean {
  const status = errorStatus(error);
  return status === 403 || status === 429 || (status != null && status >= 500 && status <= 599);
}

export async function withYoutubeInnertubeRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    random?: () => number;
    sleep?: (delayMs: number) => Promise<void>;
    onRetry?: (attempt: number, delayMs: number, statusCode: number | null) => void;
  } = {},
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(5, options.maxAttempts ?? 4));
  const baseDelayMs = Math.max(1, options.baseDelayMs ?? 500);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 8_000);
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? ((delayMs: number) => new Promise<void>(resolve => setTimeout(resolve, delayMs)));
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableYoutubeError(error) || attempt === maxAttempts) {
        if (isRetryableYoutubeError(error)) {
          throw new YoutubeRetryableError(
            `YouTube Music transient failure after ${attempt} attempts: ${error instanceof Error ? error.message : String(error)}`,
            { attempts: attempt, statusCode: errorStatus(error), retryAfterMs: errorRetryAfterMs(error) },
          );
        }
        throw error;
      }
      const retryAfterMs = errorRetryAfterMs(error);
      const backoffMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const delayMs = Math.min(maxDelayMs, Math.max(retryAfterMs ?? 0, backoffMs + Math.floor(random() * 250)));
      options.onRetry?.(attempt, delayMs, errorStatus(error));
      await sleep(delayMs);
    }
  }
  throw lastError;
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

function itemUploaderChannelId(item: MusicItemLike): string | null {
  return item.channel_id
    ?? item.channelId
    ?? item.uploader?.channel_id
    ?? item.uploader?.channelId
    ?? null;
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
    uploaderChannelId: itemUploaderChannelId(item),
    sourceSections: new Set<string>(),
    releaseIds: new Set<string>(),
  };
  existing.sourceSections.add(sourceSection);
  if (releaseId) existing.releaseIds.add(releaseId);
  if (!existing.title) existing.title = itemTitle(item);
  existing.credits = mergeCredits(existing.credits, resolvedCredits);
  if (!existing.thumbnailUrl) existing.thumbnailUrl = item.thumbnails?.at(-1)?.url ?? null;
  if (!existing.uploaderChannelId) existing.uploaderChannelId = itemUploaderChannelId(item);
  candidates.set(item.id, existing);
}

function collectionContents(value: unknown): MusicItemLike[] {
  if (Array.isArray(value)) return value as MusicItemLike[];
  if (!value || typeof value !== "object") return [];
  const contents = (value as { contents?: unknown }).contents;
  return Array.isArray(contents) ? contents as MusicItemLike[] : [];
}

export function collectYoutubeMusicArtistItems(artist: unknown): Array<{ item: MusicItemLike; sourceSection: string }> {
  if (!artist || typeof artist !== "object") return [];
  const record = artist as Record<string, unknown>;
  const items: Array<{ item: MusicItemLike; sourceSection: string }> = [];
  for (const [key, value] of Object.entries(record)) {
    if (!["albums", "singles", "videos", "songs"].includes(key)) continue;
    for (const item of collectionContents(value)) items.push({ item, sourceSection: key });
  }
  const sections = Array.isArray(record.sections) ? record.sections : [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const sectionRecord = section as Record<string, unknown>;
    const header = sectionRecord.header;
    const headerTitle = header && typeof header === "object"
      ? (header as { title?: unknown }).title
      : undefined;
    const sectionTitle = String(headerTitle ?? sectionRecord.title ?? "section");
    for (const item of collectionContents(sectionRecord.contents)) {
      items.push({ item, sourceSection: sectionTitle });
    }
  }
  return items;
}

export function isMissingMusicShelfError(error: unknown): boolean {
  return /music\s*shelf|musicshelf|missing.*shelf|no.*shelf/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

export async function resolveTrustedYoutubeIdentity(
  client: PgClient,
  artistKey: string,
  artistName: string,
): Promise<TrustedYoutubeIdentityResolution> {
  const normalizedKey = artistKey
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const rows = await client.query<{
    browse_id: string;
    source: TrustedYoutubeIdentity["source"];
    exact_key: boolean;
    artist_key: string;
    artist_name: string | null;
  }>(`
    SELECT channel_id AS browse_id, 'youtube_channel' AS source,
           (artist_key = $1) AS exact_key, artist_key, NULL::text AS artist_name
    FROM youtube_channels
    WHERE channel_id IS NOT NULL
      AND (
        artist_key = $1
        OR regexp_replace(translate(lower(artist_key), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g') = $2
      )
    UNION ALL
    SELECT browse_id, 'verified_youtube_music_mapping' AS source,
           false AS exact_key, artist_key, artist_name
    FROM youtube_music_artist_candidates
    WHERE status = 'verified'
      AND artist_key = $1
    ORDER BY exact_key DESC, source ASC, browse_id
  `, [artistKey, normalizedKey]);

  const unique = new Map<string, TrustedYoutubeIdentity>();
  const exactKeys = new Set<string>();
  for (const row of rows.rows) {
    if (row.source === "verified_youtube_music_mapping" && row.artist_key !== artistKey) continue;
    const browseId = row.source === "youtube_channel"
      ? youtubeShadowCanonicalChannelId(row.browse_id)
      : row.browse_id?.trim();
    if (!browseId) continue;
    if (row.exact_key) exactKeys.add(browseId);
    if (!unique.has(browseId)) {
      unique.set(browseId, { browseId, source: row.source });
    }
  }
  const candidates = [...unique.keys()].map(browseId => ({ browseId, name: artistName }));
  const exactKey = [...exactKeys];
  const selected = exactKey.length === 1
    ? unique.get(exactKey[0]!)
    : unique.size === 1
      ? unique.values().next().value
      : null;
  return {
    identity: selected ?? null,
    ambiguous: !selected && unique.size > 1,
    candidates,
  };
}

async function fetchYoutubeJson<T extends { error?: { message?: string } }>(url: URL): Promise<T> {
  const resource = url.pathname.split("/").at(-1) ?? "unknown";
  const quotaClient = await pool.connect();
  try {
    await reserveYoutubeApiUsage(quotaClient, {
      consumer: "official_shadow_discovery",
      method: `${resource}.list`,
    });
  } finally {
    quotaClient.release();
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) {
    const error = new Error(payload.error?.message || `YouTube Data API request failed with status ${response.status}.`) as Error & {
      status?: number;
      headers?: Headers;
    };
    error.status = response.status;
    error.headers = response.headers;
    throw error;
  }
  return payload;
}

async function discoverVerifiedChannelUploads(
  artistName: string,
  channelId: string,
  onRetry?: (attempt: number, delayMs: number, statusCode: number | null) => void,
): Promise<Map<string, DiscoveredCandidate>> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY for verified-channel fallback.");

  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "contentDetails");
  channelUrl.searchParams.set("id", channelId);
  channelUrl.searchParams.set("key", apiKey);
  const channel = await withYoutubeInnertubeRetry(
    () => fetchYoutubeJson<YoutubeChannelResponse>(channelUrl),
    { onRetry },
  );
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
    const page = await withYoutubeInnertubeRetry(
      () => fetchYoutubeJson<YoutubePlaylistItemsResponse>(playlistUrl),
      { onRetry },
    );
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

export function titleHasExactLeadingArtistCredit(title: string, artistName: string): boolean {
  const artistPattern = artistName
    .trim()
    .split(/\s+/)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  if (!artistPattern) return false;
  return new RegExp(`^\\s*${artistPattern}\\s*(?:[-–—:|]|$)`, "iu").test(title);
}

async function discoverTrustedSharedChannelUploads(
  artistName: string,
  channelId: string,
  evidenceSource: string,
  onRetry?: (attempt: number, delayMs: number, statusCode: number | null) => void,
): Promise<Map<string, DiscoveredCandidate>> {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY for trusted shared-channel discovery.");

  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "contentDetails");
  channelUrl.searchParams.set("id", channelId);
  channelUrl.searchParams.set("key", apiKey);
  const channel = await withYoutubeInnertubeRetry(
    () => fetchYoutubeJson<YoutubeChannelResponse>(channelUrl),
    { onRetry },
  );
  const uploadsPlaylistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error("Trusted shared YouTube channel has no accessible uploads playlist.");

  const candidates = new Map<string, DiscoveredCandidate>();
  let pageToken: string | undefined;
  let inspected = 0;
  const maxVideos = Math.max(1, Math.min(5_000, Number(process.env["YOUTUBE_SHADOW_SHARED_CHANNEL_UPLOAD_LIMIT"] ?? "5000") || 5_000));
  do {
    const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    playlistUrl.searchParams.set("part", "snippet,contentDetails");
    playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
    playlistUrl.searchParams.set("maxResults", "50");
    playlistUrl.searchParams.set("key", apiKey);
    if (pageToken) playlistUrl.searchParams.set("pageToken", pageToken);
    const page = await withYoutubeInnertubeRetry(
      () => fetchYoutubeJson<YoutubePlaylistItemsResponse>(playlistUrl),
      { onRetry },
    );
    for (const entry of page.items ?? []) {
      if (inspected >= maxVideos) break;
      inspected += 1;
      const videoId = entry.contentDetails?.videoId ?? entry.snippet?.resourceId?.videoId;
      const title = entry.snippet?.title ?? "";
      if (!videoId || !titleHasExactLeadingArtistCredit(title, artistName)) continue;
      addCandidate(candidates, {
        id: videoId,
        item_type: "video",
        title,
        artists: [{ name: artistName }],
        thumbnails: Object.values(entry.snippet?.thumbnails ?? {}),
      }, evidenceSource);
    }
    pageToken = inspected < maxVideos ? page.nextPageToken : undefined;
  } while (pageToken);

  return candidates;
}

export function chooseExactYoutubeArtistMatch(
  artistName: string,
  matches: YoutubeArtistIdentityMatch[],
  trustedBrowseIds: string[] = [],
): { browseId: string | null; ambiguous: boolean } {
  const exact = matches.filter(match =>
    normalizeYoutubeArtistName(match.name) === normalizeYoutubeArtistName(artistName),
  );
  const ids = [...new Set(exact.map(match => match.browseId))];
  const trustedMatches = ids.filter(id => trustedBrowseIds.includes(id));
  if (trustedMatches.length === 1) return { browseId: trustedMatches[0]!, ambiguous: false };
  return { browseId: ids.length === 1 ? ids[0]! : null, ambiguous: ids.length > 1 };
}

async function resolveBrowseId(
  yt: Innertube,
  artistName: string,
  trustedBrowseIds: string[] = [],
  onRetry?: (attempt: number, delayMs: number, statusCode: number | null) => void,
): Promise<{ browseId: string | null; ambiguous: boolean; matches: YoutubeArtistIdentityMatch[] }> {
  const results = await withYoutubeInnertubeRetry(
    () => yt.music.search(artistName, { type: "artist" }),
    { onRetry },
  );
  const matches = (results.artists?.contents ?? [])
    .map(item => ({ browseId: item.id, name: item.name?.toString() ?? "" }))
    .filter((item): item is YoutubeArtistIdentityMatch => Boolean(item.browseId && item.name));
  return { ...chooseExactYoutubeArtistMatch(artistName, matches, trustedBrowseIds), matches };
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
          uploaderChannelId: candidate.uploaderChannelId,
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
    if (decision.status === "verified") summary.verifiedCandidates += 1;
    else if (decision.status === "review") summary.reviewCandidates += 1;
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
  if (summary.reviewCandidates + summary.verifiedCandidates === 0) {
    summary.error = summary.uniqueCandidates > 0
      ? "Discovery returned no eligible shadow candidates. Rejected evidence was retained for audit."
      : "Discovery returned no catalog videos for this artist.";
  }
}

function discoveryRunStatus(summary: YoutubeMusicDiscoverySummary): "complete" | "failed" | "retryable" {
  if (summary.mappingStatus === "retryable") return "retryable";
  if (summary.error || !["review", "verified"].includes(summary.mappingStatus)) return "failed";
  return summary.reviewCandidates + summary.verifiedCandidates > 0 ? "complete" : "failed";
}

export async function discoverYoutubeMusicArtist(input: {
  artistKey: string;
  artistName: string;
  browseId?: string | null;
  trustedBrowseId?: boolean;
  trustedIdentityCandidates?: YoutubeArtistIdentityMatch[];
  write?: boolean;
  includeCandidates?: boolean;
  dbClient?: PgClient;
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
    verifiedCandidates: 0,
    savedCandidates: 0,
    parserWarnings: [],
  };
  let client: PgClient | null = null;
  let ownsClient = false;
  let runId: number | null = null;
  let retryAttempts = 0;
  const onRetry = () => { retryAttempts += 1; };
  const openWriteClient = async (): Promise<PgClient | null> => {
    if (!input.write || client) return client;
    if (input.dbClient) {
      client = input.dbClient;
    } else {
      const { pool } = await import("@workspace/db");
      client = await pool.connect();
      ownsClient = true;
    }
    const { ensureYoutubeVideoTrackerTables } = await import("./youtube-video-tracker-scheduler");
    await ensureYoutubeVideoTrackerTables(client);
    await ensureYoutubeShadowTables(client);
    const run = await client.query<{ id: number }>(
      `INSERT INTO youtube_music_shadow_runs (run_type, artist_key, status) VALUES ('discovery',$1,'running') RETURNING id`,
      [input.artistKey],
    );
    runId = run.rows[0]?.id ?? null;
    return client;
  };
  try {
    if (input.trustedIdentityCandidates?.length && !summary.browseId) {
      summary.identityMatches = input.trustedIdentityCandidates;
      summary.mappingStatus = "ambiguous";
      summary.error = "Multiple verified YouTube identities are stored; manual review is required.";
      return summary;
    }

    if (youtubeShadowCanUseVerifiedChannelFallback({
      browseId: summary.browseId,
      trustedBrowseId: input.trustedBrowseId,
    })) {
      const candidates = await discoverVerifiedChannelUploads(input.artistName, summary.browseId!, onRetry);
      summary.mappingStatus = "review";
      summary.retryAttempts = retryAttempts;
      await openWriteClient();
      await finalizeDiscovery(summary, candidates, input, client);
      return summary;
    }

    const yt = await withYoutubeInnertubeRetry(
      () => Innertube.create({ cache: new UniversalCache(false), lang: "en", location: "MX" }),
      { onRetry },
    );
    if (!summary.browseId) {
      const resolved = await resolveBrowseId(yt, input.artistName, [], onRetry);
      summary.identityMatches = resolved.matches;
      if (resolved.ambiguous) {
        summary.mappingStatus = "ambiguous";
        summary.error = "Multiple exact YouTube Music artist matches were returned; manual review is required.";
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
       artist = await withYoutubeInnertubeRetry(
         () => yt.music.getArtist(summary.browseId!),
         { onRetry },
       );
    } catch (musicBrowseError) {
      if (!youtubeShadowCanUseVerifiedChannelFallback({
        browseId: summary.browseId,
        trustedBrowseId: input.trustedBrowseId,
      })) throw musicBrowseError;
      const candidates = await discoverVerifiedChannelUploads(input.artistName, summary.browseId, onRetry);
      summary.mappingStatus = "review";
      summary.retryAttempts = retryAttempts;
      await openWriteClient();
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
    try {
      const songs = await withYoutubeInnertubeRetry(
        () => artist.getAllSongs(),
        { onRetry },
      );
      for (const item of songs?.contents ?? []) addCandidate(candidates, item as MusicItemLike, "all_songs");
    } catch (error) {
      if (!isMissingMusicShelfError(error)) throw error;
      summary.parserWarnings?.push("The artist MusicShelf was unavailable; section discovery continued.");
    }

    const releases = new Map<string, MusicItemLike>();
    for (const { item, sourceSection } of collectYoutubeMusicArtistItems(artist)) {
      addCandidate(candidates, item, sourceSection);
      if (item.item_type === "album" && item.id?.startsWith("MPRE")) {
        releases.set(item.id, item);
      }
    }

    for (const release of releases.values()) {
      let album;
      try {
        album = await withYoutubeInnertubeRetry(
          () => yt.music.getAlbum(release.id!),
          { onRetry },
        );
      } catch (error) {
        if (!isMissingMusicShelfError(error)) throw error;
        summary.parserWarnings?.push(`Release ${release.id} did not include a MusicShelf; release tracks were skipped.`);
        continue;
      }
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
      for (const item of album.contents ?? []) {
        addCandidate(candidates, item as MusicItemLike, "release_track", release.id, releaseCredits);
      }
    }

    summary.retryAttempts = retryAttempts;
    await openWriteClient();
    await finalizeDiscovery(summary, candidates, input, client);
    return summary;
  } catch (error) {
    if (error instanceof YoutubeRetryableError) {
      summary.mappingStatus = "retryable";
      summary.retryAttempts = error.attempts;
      summary.error = error.message;
    } else {
      summary.error = error instanceof Error ? error.message : String(error);
    }
    return summary;
  } finally {
    const writeClient = await openWriteClient().catch(() => null);
    if (runId != null && writeClient) {
      await writeClient.query(
        `UPDATE youtube_music_shadow_runs SET status=$2, summary=$3::jsonb, finished_at=now() WHERE id=$1`,
         [runId, discoveryRunStatus(summary), JSON.stringify(summary)],
      ).catch(() => {});
    }
    if (ownsClient) writeClient?.release();
  }
}

export async function discoverYoutubeTrustedSharedChannel(input: {
  artistKey: string;
  artistName: string;
  artistBrowseId: string;
  sourceChannelId: string;
  evidenceSource: string;
  write?: boolean;
  dbClient?: PgClient;
}): Promise<YoutubeMusicDiscoverySummary> {
  const summary: YoutubeMusicDiscoverySummary = {
    artistKey: input.artistKey,
    artistName: input.artistName,
    browseId: input.artistBrowseId,
    sourceChannelId: input.sourceChannelId,
    mappingEvidence: "verified_youtube_channel",
    mappingStatus: "review",
    releasesInspected: 0,
    uniqueCandidates: 0,
    reviewCandidates: 0,
    rejectedCandidates: 0,
    verifiedCandidates: 0,
    savedCandidates: 0,
  };
  let client: PgClient | null = null;
  let ownsClient = false;
  let runId: number | null = null;
  let retryAttempts = 0;
  const onRetry = () => { retryAttempts += 1; };
  const openWriteClient = async (): Promise<PgClient | null> => {
    if (!input.write || client) return client;
    if (input.dbClient) client = input.dbClient;
    else {
      const { pool } = await import("@workspace/db");
      client = await pool.connect();
      ownsClient = true;
    }
    const { ensureYoutubeVideoTrackerTables } = await import("./youtube-video-tracker-scheduler");
    await ensureYoutubeVideoTrackerTables(client);
    await ensureYoutubeShadowTables(client);
    const run = await client.query<{ id: number }>(
      `INSERT INTO youtube_music_shadow_runs (run_type, artist_key, status, summary)
       VALUES ('shared-channel-discovery',$1,'running',$2::jsonb) RETURNING id`,
      [input.artistKey, JSON.stringify({ sourceChannelId: input.sourceChannelId, evidenceSource: input.evidenceSource })],
    );
    runId = run.rows[0]?.id ?? null;
    return client;
  };
  try {
    const candidates = await discoverTrustedSharedChannelUploads(
      input.artistName,
      input.sourceChannelId,
      input.evidenceSource,
      onRetry,
    );
    summary.retryAttempts = retryAttempts;
    await openWriteClient();
    await finalizeDiscovery(summary, candidates, { ...input, includeCandidates: false }, client);
    return summary;
  } catch (error) {
    if (error instanceof YoutubeRetryableError) {
      summary.mappingStatus = "retryable";
      summary.retryAttempts = error.attempts;
      summary.error = error.message;
    } else {
      summary.error = error instanceof Error ? error.message : String(error);
    }
    return summary;
  } finally {
    const writeClient = await openWriteClient().catch(() => null);
    if (runId != null && writeClient) {
      await writeClient.query(
        `UPDATE youtube_music_shadow_runs SET status=$2, summary=$3::jsonb, finished_at=now() WHERE id=$1`,
         [runId, discoveryRunStatus(summary), JSON.stringify(summary)],
      ).catch(() => {});
    }
    if (ownsClient) writeClient?.release();
  }
}
