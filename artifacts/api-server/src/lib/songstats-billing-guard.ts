import { pool } from "@workspace/db";

export const SONGSTATS_CONTRACT_UNIQUE_ARTIST_LIMIT = 529;

const BILLING_LOCK_KEY = 831_905_225;

export interface SongstatsBillableIdentifier {
  songstatsArtistId?: string;
  spotifyArtistId?: string;
  appleMusicArtistId?: number;
}

export interface SongstatsMonthlyUsage {
  billingMonth: string;
  limit: number;
  used: number;
  remaining: number;
}

export class SongstatsBillingLimitError extends Error {
  constructor(
    readonly billingMonth: string,
    readonly limit: number,
  ) {
    super(
      `Songstats monthly unique-artist safety limit reached for ${billingMonth} (${limit})`,
    );
    this.name = "SongstatsBillingLimitError";
  }
}

export function configuredSongstatsMonthlyArtistLimit(): number {
  const parsed = Number(
    process.env["SONGSTATS_MONTHLY_UNIQUE_ARTIST_LIMIT"]
      ?? SONGSTATS_CONTRACT_UNIQUE_ARTIST_LIMIT,
  );
  if (!Number.isFinite(parsed)) return SONGSTATS_CONTRACT_UNIQUE_ARTIST_LIMIT;
  return Math.max(
    1,
    Math.min(SONGSTATS_CONTRACT_UNIQUE_ARTIST_LIMIT, Math.floor(parsed)),
  );
}

function billingMonth(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function billableIdentity(identifier: SongstatsBillableIdentifier): {
  type: string;
  value: string;
  identity: string;
} {
  const supplied = [
    identifier.songstatsArtistId
      ? ["songstats_artist_id", identifier.songstatsArtistId]
      : null,
    identifier.spotifyArtistId
      ? ["spotify_artist_id", identifier.spotifyArtistId]
      : null,
    identifier.appleMusicArtistId != null
      ? ["apple_music_artist_id", String(identifier.appleMusicArtistId)]
      : null,
  ].filter((entry): entry is string[] => entry !== null);

  if (supplied.length !== 1) {
    throw new Error(
      "Provide exactly one Songstats, Spotify, or Apple Music artist ID for billing",
    );
  }

  const [type, value] = supplied[0]!;
  return {
    type,
    value,
    identity: `${type}:${value}`,
  };
}

export async function ensureSongstatsBillingUsageTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_monthly_artist_usage (
      billing_month text NOT NULL,
      artist_identity text NOT NULL,
      identifier_type text NOT NULL,
      identifier_value text NOT NULL,
      first_endpoint text NOT NULL,
      last_endpoint text NOT NULL,
      request_count bigint NOT NULL DEFAULT 1,
      first_requested_at timestamptz NOT NULL DEFAULT now(),
      last_requested_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (billing_month, artist_identity)
    )
  `);
}

export async function claimSongstatsMonthlyArtist(
  identifier: SongstatsBillableIdentifier,
  endpoint: string,
): Promise<void> {
  const artist = billableIdentity(identifier);
  const month = billingMonth();
  const limit = configuredSongstatsMonthlyArtistLimit();
  await ensureSongstatsBillingUsageTable();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [BILLING_LOCK_KEY]);

    const existing = await client.query(
      `
        SELECT 1
        FROM songstats_monthly_artist_usage
        WHERE billing_month = $1
          AND artist_identity = $2
      `,
      [month, artist.identity],
    );

    if (existing.rowCount) {
      await client.query(
        `
          UPDATE songstats_monthly_artist_usage
          SET
            last_endpoint = $3,
            request_count = request_count + 1,
            last_requested_at = now()
          WHERE billing_month = $1
            AND artist_identity = $2
        `,
        [month, artist.identity, endpoint],
      );
      await client.query("COMMIT");
      return;
    }

    const usage = await client.query<{ used: number }>(
      `
        SELECT count(*)::int AS used
        FROM songstats_monthly_artist_usage
        WHERE billing_month = $1
      `,
      [month],
    );
    if ((usage.rows[0]?.used ?? 0) >= limit) {
      throw new SongstatsBillingLimitError(month, limit);
    }

    await client.query(
      `
        INSERT INTO songstats_monthly_artist_usage (
          billing_month,
          artist_identity,
          identifier_type,
          identifier_value,
          first_endpoint,
          last_endpoint
        )
        VALUES ($1, $2, $3, $4, $5, $5)
      `,
      [month, artist.identity, artist.type, artist.value, endpoint],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getSongstatsMonthlyUsage(
  date = new Date(),
): Promise<SongstatsMonthlyUsage> {
  await ensureSongstatsBillingUsageTable();
  const month = billingMonth(date);
  const limit = configuredSongstatsMonthlyArtistLimit();
  const result = await pool.query<{ used: number }>(
    `
      SELECT count(*)::int AS used
      FROM songstats_monthly_artist_usage
      WHERE billing_month = $1
    `,
    [month],
  );
  const used = result.rows[0]?.used ?? 0;
  return {
    billingMonth: month,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}
