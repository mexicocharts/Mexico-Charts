import { db, pool } from "@workspace/db";
import {
  songstatsArtistDailySnapshots,
  songstatsArtists,
} from "@workspace/db/schema";
import {
  getSongstatsArtistCurrentStats,
  type SongstatsCurrentStatsResponse,
  type SongstatsSourceStats,
} from "./songstats-client";
import { ensureSongstatsBillingUsageTable } from "./songstats-billing-guard";
import { logger } from "./logger";

export interface SongstatsSyncResult {
  artistKey: string;
  spotifyArtistId: string;
  songstatsArtistId?: string;
  songstatsName?: string;
  status: "saved" | "failed";
  sources?: string[];
  error?: string;
}

export interface SongstatsSyncSummary {
  snapshotDate: string;
  requested: number;
  saved: number;
  failed: number;
  results: SongstatsSyncResult[];
}

export interface SongstatsCatalogArtist {
  artistKey: string;
  spotifyArtistId: string;
  spotifyName: string | null;
}

const CANONICAL_ARTIST_KEY_BY_ALIAS: Record<string, string> = {
  "banda el recodo de cruz lizarraga": "banda el recodo",
  "banda sinaloense ms de sergio lizarraga": "banda ms de sergio lizarraga",
  "banda tito y su torbellino": "tito torbellino",
  "ramon ayala y sus bravos del norte": "ramon ayala",
};

function normalizeArtistKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function compactArtistKey(value: string): string {
  return normalizeArtistKey(value).replace(/[^a-z0-9]/g, "");
}

export function songstatsArtistKeyCandidates(value: string): string[] {
  const normalized = normalizeArtistKey(value);
  const canonical = CANONICAL_ARTIST_KEY_BY_ALIAS[normalized] ?? normalized;
  return [...new Set([
    normalized,
    canonical,
    compactArtistKey(normalized),
    compactArtistKey(canonical),
  ].filter(Boolean))];
}

export async function listSongstatsCatalogArtists(options: {
  limit: number;
  artistKeys?: string[];
  excludeSnapshotDate?: string;
  excludeBillingMonth?: string;
}): Promise<SongstatsCatalogArtist[]> {
  const limit = Math.max(1, Math.floor(options.limit));
  const requestedKeys = [...new Set(
    (options.artistKeys ?? []).flatMap(songstatsArtistKeyCandidates),
  )];
  const params: unknown[] = [limit];
  const requestedFilter = requestedKeys.length
    ? `AND lower(c.artist_key) = ANY($${params.push(requestedKeys)}::text[])`
    : "";
  const snapshotFilter = options.excludeSnapshotDate
    ? `
      AND NOT EXISTS (
        SELECT 1
        FROM songstats_artist_daily_snapshots existing_snapshot
        WHERE existing_snapshot.artist_key = c.artist_key
          AND existing_snapshot.snapshot_date = $${params.push(options.excludeSnapshotDate)}
      )
    `
    : "";
  const billingFilter = options.excludeBillingMonth
    ? `
      AND NOT EXISTS (
        SELECT 1
        FROM songstats_monthly_artist_usage existing_usage
        WHERE existing_usage.billing_month = $${params.push(options.excludeBillingMonth)}
          AND existing_usage.identifier_type = 'spotify_artist_id'
          AND existing_usage.identifier_value = COALESCE(c.spotify_id, s.spotify_artist_id)
      )
    `
    : "";

  const result = await pool.query<{
    artist_key: string;
    spotify_artist_id: string;
    spotify_name: string | null;
  }>(
    `
      SELECT
        c.artist_key,
        COALESCE(c.spotify_id, s.spotify_artist_id) AS spotify_artist_id,
        COALESCE(c.artist_name, s.spotify_name) AS spotify_name
      FROM kworb_coverage c
      LEFT JOIN spotify_artists s ON s.artist_key = c.artist_key
      WHERE COALESCE(c.spotify_id, s.spotify_artist_id) IS NOT NULL
        AND (COALESCE(c.has_spotify, false) = true OR s.spotify_artist_id IS NOT NULL)
        ${requestedFilter}
        ${snapshotFilter}
        ${billingFilter}
      ORDER BY c.tier, c.artist_key
      LIMIT $1
    `,
    params,
  );

  return result.rows.map(row => ({
    artistKey: row.artist_key,
    spotifyArtistId: row.spotify_artist_id,
    spotifyName: row.spotify_name,
  }));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/,/g, "");
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)\s*([KMB])?$/i);
  if (!match) return null;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const multiplier = match[2]?.toUpperCase() === "B"
    ? 1_000_000_000
    : match[2]?.toUpperCase() === "M"
      ? 1_000_000
      : match[2]?.toUpperCase() === "K"
        ? 1_000
        : 1;
  return Math.round(base * multiplier);
}

function statsBySource(stats: SongstatsSourceStats[] | undefined) {
  return new Map((stats ?? []).map(item => [item.source.toLowerCase(), item.data]));
}

function metric(
  sources: Map<string, Record<string, unknown>>,
  source: string,
  ...fields: string[]
): number | null {
  const data = sources.get(source);
  if (!data) return null;
  for (const field of fields) {
    const value = numericValue(data[field]);
    if (value != null) return value;
  }
  return null;
}

export async function ensureSongstatsTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_artists (
      artist_key text PRIMARY KEY,
      spotify_artist_id text NOT NULL UNIQUE,
      songstats_artist_id text UNIQUE,
      songstats_name text,
      avatar_url text,
      site_url text,
      source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      last_synced_at timestamptz NOT NULL DEFAULT now(),
      linked_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_artist_daily_snapshots (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      spotify_artist_id text NOT NULL,
      songstats_artist_id text,
      snapshot_date text NOT NULL,
      spotify_followers bigint,
      spotify_monthly_listeners bigint,
      spotify_popularity integer,
      youtube_subscribers bigint,
      youtube_channel_views bigint,
      instagram_followers bigint,
      tiktok_followers bigint,
      facebook_followers bigint,
      twitter_followers bigint,
      soundcloud_followers bigint,
      deezer_followers bigint,
      stats jsonb NOT NULL,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS songstats_artist_daily_snapshots_artist_date_unique
    ON songstats_artist_daily_snapshots (artist_key, snapshot_date)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS songstats_artist_daily_snapshots_spotify_date_idx
    ON songstats_artist_daily_snapshots (spotify_artist_id, snapshot_date)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS songstats_artist_daily_snapshots_songstats_date_idx
    ON songstats_artist_daily_snapshots (songstats_artist_id, snapshot_date)
  `);
}

async function saveCurrentStats(
  artist: SongstatsCatalogArtist,
  response: SongstatsCurrentStatsResponse,
  snapshotDate: string,
): Promise<SongstatsSyncResult> {
  const artistInfo = response.artist_info;
  const songstatsArtistId = artistInfo?.songstats_artist_id;
  const sourceIds = response.source_ids ?? [];
  const fetchedAt = new Date();
  const sources = statsBySource(response.stats);

  await db.insert(songstatsArtists).values({
    artistKey: artist.artistKey,
    spotifyArtistId: artist.spotifyArtistId,
    songstatsArtistId: songstatsArtistId ?? null,
    songstatsName: artistInfo?.name ?? artist.spotifyName,
    avatarUrl: artistInfo?.avatar ?? null,
    siteUrl: artistInfo?.site_url ?? null,
    sourceIds,
    lastSyncedAt: fetchedAt,
  }).onConflictDoUpdate({
    target: songstatsArtists.artistKey,
    set: {
      spotifyArtistId: artist.spotifyArtistId,
      songstatsArtistId: songstatsArtistId ?? null,
      songstatsName: artistInfo?.name ?? artist.spotifyName,
      avatarUrl: artistInfo?.avatar ?? null,
      siteUrl: artistInfo?.site_url ?? null,
      sourceIds,
      lastSyncedAt: fetchedAt,
    },
  });

  await db.insert(songstatsArtistDailySnapshots).values({
    artistKey: artist.artistKey,
    spotifyArtistId: artist.spotifyArtistId,
    songstatsArtistId: songstatsArtistId ?? null,
    snapshotDate,
    spotifyFollowers: metric(sources, "spotify", "followers_total"),
    spotifyMonthlyListeners: metric(sources, "spotify", "monthly_listeners_current"),
    spotifyPopularity: metric(sources, "spotify", "popularity_current"),
    youtubeSubscribers: metric(sources, "youtube", "subscribers_total", "followers_total"),
    youtubeChannelViews: metric(sources, "youtube", "channel_views_total"),
    instagramFollowers: metric(sources, "instagram", "followers_total"),
    tiktokFollowers: metric(sources, "tiktok", "followers_total"),
    facebookFollowers: metric(sources, "facebook", "followers_total"),
    twitterFollowers: metric(sources, "twitter", "followers_total"),
    soundcloudFollowers: metric(sources, "soundcloud", "followers_total"),
    deezerFollowers: metric(sources, "deezer", "followers_total", "fans_total"),
    stats: response,
    fetchedAt,
    updatedAt: fetchedAt,
  }).onConflictDoUpdate({
    target: [
      songstatsArtistDailySnapshots.artistKey,
      songstatsArtistDailySnapshots.snapshotDate,
    ],
    set: {
      spotifyArtistId: artist.spotifyArtistId,
      songstatsArtistId: songstatsArtistId ?? null,
      spotifyFollowers: metric(sources, "spotify", "followers_total"),
      spotifyMonthlyListeners: metric(sources, "spotify", "monthly_listeners_current"),
      spotifyPopularity: metric(sources, "spotify", "popularity_current"),
      youtubeSubscribers: metric(sources, "youtube", "subscribers_total", "followers_total"),
      youtubeChannelViews: metric(sources, "youtube", "channel_views_total"),
      instagramFollowers: metric(sources, "instagram", "followers_total"),
      tiktokFollowers: metric(sources, "tiktok", "followers_total"),
      facebookFollowers: metric(sources, "facebook", "followers_total"),
      twitterFollowers: metric(sources, "twitter", "followers_total"),
      soundcloudFollowers: metric(sources, "soundcloud", "followers_total"),
      deezerFollowers: metric(sources, "deezer", "followers_total", "fans_total"),
      stats: response,
      fetchedAt,
      updatedAt: fetchedAt,
    },
  });

  return {
    artistKey: artist.artistKey,
    spotifyArtistId: artist.spotifyArtistId,
    songstatsArtistId,
    songstatsName: artistInfo?.name ?? artist.spotifyName ?? undefined,
    status: "saved",
    sources: [...sources.keys()],
  };
}

export async function syncSongstatsCurrentStats(options: {
  limit: number;
  artistKeys?: string[];
  snapshotDate?: string;
}): Promise<SongstatsSyncSummary> {
  await Promise.all([
    ensureSongstatsTables(),
    ensureSongstatsBillingUsageTable(),
  ]);

  const limit = Math.max(1, Math.floor(options.limit));
  const snapshotDate = options.snapshotDate ?? todayIso();
  const artists = await listSongstatsCatalogArtists({
    limit,
    artistKeys: options.artistKeys,
    excludeSnapshotDate: options.artistKeys?.length ? undefined : snapshotDate,
    excludeBillingMonth: options.artistKeys?.length
      ? undefined
      : new Date().toISOString().slice(0, 7),
  });
  const results: SongstatsSyncResult[] = [];

  for (const artist of artists) {
    try {
      const response = await getSongstatsArtistCurrentStats({
        spotifyArtistId: artist.spotifyArtistId,
      });
      results.push(await saveCurrentStats(artist, response, snapshotDate));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Songstats error";
      logger.warn(
        { artistKey: artist.artistKey, spotifyArtistId: artist.spotifyArtistId, error: message },
        "[songstats] artist current stats sync failed",
      );
      results.push({
        artistKey: artist.artistKey,
        spotifyArtistId: artist.spotifyArtistId,
        status: "failed",
        error: message,
      });
    }

    if (artists.length > 1) await sleep(125);
  }

  return {
    snapshotDate,
    requested: artists.length,
    saved: results.filter(result => result.status === "saved").length,
    failed: results.filter(result => result.status === "failed").length,
    results,
  };
}
