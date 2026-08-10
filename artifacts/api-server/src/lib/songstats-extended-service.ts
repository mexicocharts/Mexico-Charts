import { pool } from "@workspace/db";
import {
  getSongstatsArtistAudience,
  getSongstatsArtistAudienceDetails,
  getSongstatsArtistCatalog,
  getSongstatsArtistHistoricStats,
  getSongstatsArtistInfo,
  type SongstatsArtistInfo,
  type SongstatsSource,
} from "./songstats-client";
import {
  configuredSongstatsMonthlyArtistLimit,
  ensureSongstatsBillingUsageTable,
} from "./songstats-billing-guard";
import {
  ensureSongstatsTables,
  listSongstatsCatalogArtists,
  type SongstatsCatalogArtist,
} from "./songstats-snapshot-service";
import { logger } from "./logger";
import {
  artistInfoFromPayload,
  sourceIdsFromInfoPayload,
} from "./songstats-info";

export type SongstatsExtendedEndpoint =
  | "info"
  | "historic"
  | "audience"
  | "audience_details"
  | "catalog";

export interface SongstatsExtendedSyncResult {
  artistKey: string;
  spotifyArtistId: string;
  songstatsArtistId?: string;
  status: "saved" | "partial" | "failed";
  savedEndpoints: SongstatsExtendedEndpoint[];
  errors: Record<string, string>;
}

export interface SongstatsExtendedSyncSummary {
  requested: number;
  saved: number;
  partial: number;
  failed: number;
  historyStartDate: string;
  historyEndDate: string;
  countryCode: string;
  endpoints: SongstatsExtendedEndpoint[];
  audienceDetailsSources: SongstatsSource[];
  results: SongstatsExtendedSyncResult[];
}

interface ExtendedPayloads {
  info?: Record<string, unknown>;
  historic?: Record<string, unknown>;
  audience?: Record<string, unknown>;
  audienceDetails?: Record<string, unknown>;
  catalog?: Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Songstats error";
}

function configuredExtendedConcurrency(): number {
  const parsed = Number(process.env["SONGSTATS_EXTENDED_SYNC_CONCURRENCY"] ?? "2");
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(5, Math.floor(parsed)))
    : 2;
}

function artistInfoFromPayloads(payloads: ExtendedPayloads): SongstatsArtistInfo | undefined {
  for (const payload of [
    payloads.info,
    payloads.historic,
    payloads.audience,
    payloads.catalog,
  ]) {
    const info = artistInfoFromPayload(payload);
    if (info) return info;
  }

  const detailSources = payloads.audienceDetails?.["sources"];
  if (detailSources && typeof detailSources === "object") {
    for (const payload of Object.values(detailSources)) {
      if (!payload || typeof payload !== "object") continue;
      const info = (payload as Record<string, unknown>)["artist_info"];
      if (info && typeof info === "object") {
        return info as SongstatsArtistInfo;
      }
    }
  }

  return undefined;
}

export async function ensureSongstatsExtendedTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_artist_extended_data (
      artist_key text PRIMARY KEY,
      spotify_artist_id text NOT NULL,
      songstats_artist_id text,
      artist_info jsonb,
      history_start_date text,
      history_end_date text,
      historic_stats jsonb,
      audience jsonb,
      audience_details jsonb,
      catalog jsonb,
      sync_errors jsonb NOT NULL DEFAULT '{}'::jsonb,
      historic_fetched_at timestamptz,
      audience_fetched_at timestamptz,
      audience_details_fetched_at timestamptz,
      catalog_fetched_at timestamptz,
      info_fetched_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    ALTER TABLE songstats_artist_extended_data
      ADD COLUMN IF NOT EXISTS artist_info jsonb,
      ADD COLUMN IF NOT EXISTS info_fetched_at timestamptz
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS songstats_artist_extended_data_spotify_idx
    ON songstats_artist_extended_data (spotify_artist_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS songstats_artist_extended_data_songstats_idx
    ON songstats_artist_extended_data (songstats_artist_id)
  `);
}

async function listExtendedSyncArtists(options: {
  limit: number;
  artistKeys?: string[];
  endpoints: SongstatsExtendedEndpoint[];
  historyStartDate: string;
  historyEndDate: string;
}): Promise<SongstatsCatalogArtist[]> {
  const explicitArtistKeys = options.artistKeys?.length
    ? options.artistKeys
    : undefined;
  const candidates = await listSongstatsCatalogArtists({
    limit: explicitArtistKeys
      ? options.limit
      : configuredSongstatsMonthlyArtistLimit(),
    artistKeys: explicitArtistKeys,
  });
  if (explicitArtistKeys || candidates.length === 0) {
    return candidates.slice(0, options.limit);
  }

  const params: unknown[] = [candidates.map(artist => artist.artistKey)];
  const completeConditions: string[] = [];
  if (options.endpoints.includes("info")) {
    completeConditions.push(`artist_info IS NOT NULL`);
  }
  if (options.endpoints.includes("historic")) {
    completeConditions.push(
      `historic_stats IS NOT NULL`,
      `history_start_date <= $${params.push(options.historyStartDate)}`,
      `history_end_date >= $${params.push(options.historyEndDate)}`,
    );
  }
  if (options.endpoints.includes("audience")) {
    completeConditions.push(`audience IS NOT NULL`);
  }
  if (options.endpoints.includes("audience_details")) {
    completeConditions.push(`audience_details IS NOT NULL`);
  }
  if (options.endpoints.includes("catalog")) {
    completeConditions.push(`catalog IS NOT NULL`);
  }

  const completed = await pool.query<{ artist_key: string }>(
    `
      SELECT artist_key
      FROM songstats_artist_extended_data
      WHERE artist_key = ANY($1::text[])
        AND ${completeConditions.length > 0
          ? completeConditions.join("\n        AND ")
          : "FALSE"}
    `,
    params,
  );
  const completedKeys = new Set(completed.rows.map(row => row.artist_key));
  return candidates
    .filter(artist => !completedKeys.has(artist.artistKey))
    .slice(0, options.limit);
}

async function fetchExtendedPayloads(
  artist: SongstatsCatalogArtist,
  options: {
    endpoints: SongstatsExtendedEndpoint[];
    historyStartDate: string;
    historyEndDate: string;
    countryCode: string;
    audienceDetailsSources: SongstatsSource[];
    catalogLimit: number;
  },
): Promise<{ payloads: ExtendedPayloads; errors: Record<string, string> }> {
  const identifier = { spotifyArtistId: artist.spotifyArtistId };
  const payloads: ExtendedPayloads = {};
  const errors: Record<string, string> = {};

  const requests = options.endpoints.map(async endpoint => {
    if (endpoint === "info") {
      return [endpoint, await getSongstatsArtistInfo(identifier)] as const;
    }
    if (endpoint === "historic") {
      return [
        endpoint,
        await getSongstatsArtistHistoricStats(identifier, {
          source: "all",
          startDate: options.historyStartDate,
          endDate: options.historyEndDate,
          withAggregates: true,
        }),
      ] as const;
    }
    if (endpoint === "audience") {
      return [endpoint, await getSongstatsArtistAudience(identifier, "all")] as const;
    }
    if (endpoint === "catalog") {
      return [
        endpoint,
        await getSongstatsArtistCatalog(identifier, {
          limit: options.catalogLimit,
          offset: 0,
          withLinks: true,
        }),
      ] as const;
    }

    const detailResults = await Promise.allSettled(
      options.audienceDetailsSources.map(async source => [
        source,
        await getSongstatsArtistAudienceDetails(
          identifier,
          options.countryCode,
          source,
        ),
      ] as const),
    );
    const sources: Record<string, unknown> = {};
    for (const [index, result] of detailResults.entries()) {
      const source = options.audienceDetailsSources[index]!;
      if (result.status === "fulfilled") {
        sources[source] = result.value[1];
      } else {
        errors[`audience_details:${source}`] = errorMessage(result.reason);
      }
    }
    return [
      endpoint,
      {
        country_code: options.countryCode,
        sources,
      },
    ] as const;
  });

  const settled = await Promise.allSettled(requests);
  for (const [index, result] of settled.entries()) {
    const endpoint = options.endpoints[index]!;
    if (result.status === "rejected") {
      errors[endpoint] = errorMessage(result.reason);
      continue;
    }
    const payload = result.value[1] as Record<string, unknown>;
    if (endpoint === "info") payloads.info = payload;
    if (endpoint === "historic") payloads.historic = payload;
    if (endpoint === "audience") payloads.audience = payload;
    if (endpoint === "audience_details") {
      const sources = payload["sources"];
      if (sources && typeof sources === "object" && Object.keys(sources).length > 0) {
        payloads.audienceDetails = payload;
      } else if (!errors["audience_details"]) {
        errors["audience_details"] = "No audience-detail source returned data";
      }
    }
    if (endpoint === "catalog") payloads.catalog = payload;
  }

  return { payloads, errors };
}

async function saveExtendedPayloads(
  artist: SongstatsCatalogArtist,
  payloads: ExtendedPayloads,
  errors: Record<string, string>,
  options: {
    endpoints: SongstatsExtendedEndpoint[];
    historyStartDate: string;
    historyEndDate: string;
  },
): Promise<SongstatsExtendedSyncResult> {
  const fetchedAt = new Date();
  const artistInfo = artistInfoFromPayloads(payloads);
  const songstatsArtistId = artistInfo?.songstats_artist_id;
  const savedEndpoints = options.endpoints.filter(endpoint => {
    if (endpoint === "info") return payloads.info != null;
    if (endpoint === "historic") return payloads.historic != null;
    if (endpoint === "audience") return payloads.audience != null;
    if (endpoint === "audience_details") return payloads.audienceDetails != null;
    return payloads.catalog != null;
  });

  await pool.query(
    `
      INSERT INTO songstats_artist_extended_data (
        artist_key,
        spotify_artist_id,
        songstats_artist_id,
        artist_info,
        history_start_date,
        history_end_date,
        historic_stats,
        audience,
        audience_details,
        catalog,
        sync_errors,
        historic_fetched_at,
        audience_fetched_at,
        audience_details_fetched_at,
        catalog_fetched_at,
        info_fetched_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4::jsonb, $5, $6,
        $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb,
        $12, $13, $14, $15, $16, $17
      )
      ON CONFLICT (artist_key) DO UPDATE SET
        spotify_artist_id = EXCLUDED.spotify_artist_id,
        songstats_artist_id = COALESCE(
          EXCLUDED.songstats_artist_id,
          songstats_artist_extended_data.songstats_artist_id
        ),
        artist_info = COALESCE(
          EXCLUDED.artist_info,
          songstats_artist_extended_data.artist_info
        ),
        history_start_date = CASE
          WHEN EXCLUDED.historic_stats IS NOT NULL THEN EXCLUDED.history_start_date
          ELSE songstats_artist_extended_data.history_start_date
        END,
        history_end_date = CASE
          WHEN EXCLUDED.historic_stats IS NOT NULL THEN EXCLUDED.history_end_date
          ELSE songstats_artist_extended_data.history_end_date
        END,
        historic_stats = COALESCE(
          EXCLUDED.historic_stats,
          songstats_artist_extended_data.historic_stats
        ),
        audience = COALESCE(
          EXCLUDED.audience,
          songstats_artist_extended_data.audience
        ),
        audience_details = COALESCE(
          EXCLUDED.audience_details,
          songstats_artist_extended_data.audience_details
        ),
        catalog = COALESCE(
          EXCLUDED.catalog,
          songstats_artist_extended_data.catalog
        ),
        sync_errors = EXCLUDED.sync_errors,
        historic_fetched_at = COALESCE(
          EXCLUDED.historic_fetched_at,
          songstats_artist_extended_data.historic_fetched_at
        ),
        audience_fetched_at = COALESCE(
          EXCLUDED.audience_fetched_at,
          songstats_artist_extended_data.audience_fetched_at
        ),
        audience_details_fetched_at = COALESCE(
          EXCLUDED.audience_details_fetched_at,
          songstats_artist_extended_data.audience_details_fetched_at
        ),
        catalog_fetched_at = COALESCE(
          EXCLUDED.catalog_fetched_at,
          songstats_artist_extended_data.catalog_fetched_at
        ),
        info_fetched_at = COALESCE(
          EXCLUDED.info_fetched_at,
          songstats_artist_extended_data.info_fetched_at
        ),
        updated_at = EXCLUDED.updated_at
    `,
    [
      artist.artistKey,
      artist.spotifyArtistId,
      songstatsArtistId ?? null,
      payloads.info ? JSON.stringify(payloads.info) : null,
      options.historyStartDate,
      options.historyEndDate,
      payloads.historic ? JSON.stringify(payloads.historic) : null,
      payloads.audience ? JSON.stringify(payloads.audience) : null,
      payloads.audienceDetails ? JSON.stringify(payloads.audienceDetails) : null,
      payloads.catalog ? JSON.stringify(payloads.catalog) : null,
      JSON.stringify(errors),
      payloads.historic ? fetchedAt : null,
      payloads.audience ? fetchedAt : null,
      payloads.audienceDetails ? fetchedAt : null,
      payloads.catalog ? fetchedAt : null,
      payloads.info ? fetchedAt : null,
      fetchedAt,
    ],
  );

  if (payloads.info) {
    const sourceIds = sourceIdsFromInfoPayload(payloads.info);
    await pool.query(
      `
        UPDATE songstats_artists
        SET
          songstats_artist_id = COALESCE($2, songstats_artist_id),
          songstats_name = COALESCE($3, songstats_name),
          avatar_url = COALESCE($4, avatar_url),
          site_url = COALESCE($5, site_url),
          source_ids = CASE
            WHEN cardinality($6::text[]) > 0 THEN to_jsonb($6::text[])
            ELSE source_ids
          END,
          last_synced_at = $7
        WHERE artist_key = $1
      `,
      [
        artist.artistKey,
        songstatsArtistId ?? null,
        artistInfo?.name ?? null,
        artistInfo?.avatar ?? null,
        artistInfo?.site_url ?? null,
        sourceIds,
        fetchedAt,
      ],
    );
  }

  const status = savedEndpoints.length === 0
    ? "failed"
    : Object.keys(errors).length > 0 || savedEndpoints.length < options.endpoints.length
      ? "partial"
      : "saved";

  return {
    artistKey: artist.artistKey,
    spotifyArtistId: artist.spotifyArtistId,
    songstatsArtistId,
    status,
    savedEndpoints,
    errors,
  };
}

export async function syncSongstatsExtendedData(options: {
  limit: number;
  artistKeys?: string[];
  endpoints: SongstatsExtendedEndpoint[];
  historyStartDate: string;
  historyEndDate: string;
  countryCode: string;
  audienceDetailsSources: SongstatsSource[];
  catalogLimit: number;
}): Promise<SongstatsExtendedSyncSummary> {
  await Promise.all([
    ensureSongstatsTables(),
    ensureSongstatsExtendedTable(),
    ensureSongstatsBillingUsageTable(),
  ]);

  const limit = Math.max(1, Math.floor(options.limit));
  const artists = await listExtendedSyncArtists({
    limit,
    artistKeys: options.artistKeys,
    endpoints: options.endpoints,
    historyStartDate: options.historyStartDate,
    historyEndDate: options.historyEndDate,
  });
  const results = new Array<SongstatsExtendedSyncResult>(artists.length);
  let nextArtistIndex = 0;
  const workers = Array.from({
    length: Math.min(configuredExtendedConcurrency(), artists.length),
  }, async () => {
    while (nextArtistIndex < artists.length) {
      const index = nextArtistIndex++;
      const artist = artists[index]!;
      try {
        const { payloads, errors } = await fetchExtendedPayloads(artist, options);
        results[index] = await saveExtendedPayloads(artist, payloads, errors, options);
      } catch (error) {
        const message = errorMessage(error);
        logger.warn(
          {
            artistKey: artist.artistKey,
            spotifyArtistId: artist.spotifyArtistId,
            error: message,
          },
          "[songstats] extended artist sync failed",
        );
        results[index] = {
          artistKey: artist.artistKey,
          spotifyArtistId: artist.spotifyArtistId,
          status: "failed",
          savedEndpoints: [],
          errors: { request: message },
        };
      }

      if (artists.length > 1) await sleep(125);
    }
  });
  await Promise.all(workers);

  return {
    requested: artists.length,
    saved: results.filter(result => result.status === "saved").length,
    partial: results.filter(result => result.status === "partial").length,
    failed: results.filter(result => result.status === "failed").length,
    historyStartDate: options.historyStartDate,
    historyEndDate: options.historyEndDate,
    countryCode: options.countryCode,
    endpoints: options.endpoints,
    audienceDetailsSources: options.audienceDetailsSources,
    results,
  };
}

export async function getSongstatsExtendedCoverage() {
  await ensureSongstatsExtendedTable();
  const result = await pool.query<{
    total: string;
    with_historic: string;
    with_audience: string;
    with_audience_details: string;
    with_catalog: string;
    with_info: string;
    stored_bytes: string;
  }>(`
    SELECT
      count(*)::text AS total,
      count(historic_stats)::text AS with_historic,
      count(audience)::text AS with_audience,
      count(audience_details)::text AS with_audience_details,
      count(catalog)::text AS with_catalog,
      count(artist_info)::text AS with_info,
      COALESCE(sum(pg_column_size(row_value)), 0)::text AS stored_bytes
    FROM songstats_artist_extended_data row_value
  `);
  const row = result.rows[0]!;
  return {
    total: Number(row.total),
    withHistoric: Number(row.with_historic),
    withAudience: Number(row.with_audience),
    withAudienceDetails: Number(row.with_audience_details),
    withCatalog: Number(row.with_catalog),
    withInfo: Number(row.with_info),
    storedBytes: Number(row.stored_bytes),
  };
}
