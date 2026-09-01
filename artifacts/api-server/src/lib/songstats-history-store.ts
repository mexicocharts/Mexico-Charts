import { pool, type PoolClient } from "@workspace/db";
import {
  listSongstatsCatalogArtists,
  type SongstatsCatalogArtist,
} from "./songstats-snapshot-service";
import type {
  NormalizedSongstatsHistoricalObservation,
  SongstatsHistoryWindow,
  SongstatsIdentityValidationStatus,
} from "./songstats-history-model";
import {
  SONGSTATS_HISTORY_DEFINITION_VERSION,
  SONGSTATS_HISTORY_METRICS,
} from "./songstats-history-model";

export const SONGSTATS_HISTORY_SCHEMA_VERSION = 2;

export async function assertSongstatsHistoryCompactSchema(): Promise<void> {
  const tables = await pool.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema=current_schema()
      AND table_name = ANY($1::text[])
  `, [[
    "songstats_history_metric_definitions",
    "songstats_history_provider_identities",
    "songstats_history_import_runs",
    "songstats_history_import_chunks",
    "songstats_historical_observations",
  ]]);
  if (tables.rowCount !== 5) {
    throw new Error("Compact Songstats history schema is not deployed; run only the separately reviewed schema migration first");
  }
  const requiredColumns = await pool.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='songstats_historical_observations'
  `);
  const present = new Set(requiredColumns.rows.map(row => row.column_name));
  for (const column of ["provider_identity_id", "metric_definition_id", "import_chunk_id"]) {
    if (!present.has(column)) throw new Error("Legacy Songstats history schema detected; compact-schema migration is required");
  }
  const chunkColumns = await pool.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='songstats_history_import_chunks'
  `);
  const chunkPresent = new Set(chunkColumns.rows.map(row => row.column_name));
  for (const column of ["provider_identity_id", "parser_version", "schema_version", "acquisition_metadata"]) {
    if (!chunkPresent.has(column)) throw new Error("Legacy Songstats history chunk schema detected; compact-schema migration is required");
  }
}

export interface SongstatsHistoryRosterArtist extends SongstatsCatalogArtist {
  songstatsArtistId: string | null;
  identityValidationStatus: SongstatsIdentityValidationStatus;
  identityEvidence: Record<string, unknown>;
}

export async function ensureSongstatsHistoryTables(): Promise<void> {
  const existingObservationColumns = await pool.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='songstats_historical_observations'
  `);
  if (existingObservationColumns.rowCount) {
    const existing = new Set(existingObservationColumns.rows.map(row => row.column_name));
    if (!["provider_identity_id", "metric_definition_id", "import_chunk_id"].every(column => existing.has(column))) {
      throw new Error("Refusing implicit conversion of legacy Songstats history tables; use the reviewed shadow-table migration plan");
    }
  }
  const existingChunkColumns = await pool.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='songstats_history_import_chunks'
  `);
  if (existingChunkColumns.rowCount) {
    const existing = new Set(existingChunkColumns.rows.map(row => row.column_name));
    if (!["provider_identity_id", "parser_version", "schema_version", "acquisition_metadata"].every(column => existing.has(column))) {
      throw new Error("Refusing implicit conversion of legacy Songstats history chunk tables; use the reviewed shadow-table migration plan");
    }
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_history_import_runs (
      run_id text PRIMARY KEY,
      mode text NOT NULL CHECK (mode IN ('test', 'validation', 'full')),
      status text NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed', 'paused')),
      requested_start_date date NOT NULL,
      requested_end_date date NOT NULL,
      roster_size integer NOT NULL CHECK (roster_size >= 0),
      planned_request_count integer NOT NULL CHECK (planned_request_count >= 0),
      completed_request_count integer NOT NULL DEFAULT 0 CHECK (completed_request_count >= 0),
      failed_request_count integer NOT NULL DEFAULT 0 CHECK (failed_request_count >= 0),
      observation_count integer NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
      options jsonb NOT NULL DEFAULT '{}'::jsonb,
      summary jsonb NOT NULL DEFAULT '{}'::jsonb,
      started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS songstats_history_import_runs_status_started_idx
    ON songstats_history_import_runs (status, started_at)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_history_metric_definitions (
      id serial PRIMARY KEY,
      source text NOT NULL,
      provider_field text NOT NULL,
      metric_key text NOT NULL,
      label text NOT NULL,
      unit text NOT NULL,
      behavior text NOT NULL,
      commercial_endpoint text NOT NULL CHECK (commercial_endpoint = 'artist_historical_stats'),
      definition_version integer NOT NULL,
      ingestion_status text NOT NULL CHECK (ingestion_status IN ('active', 'quarantined')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT songstats_history_metric_source_field_version_unique
        UNIQUE (source, provider_field, definition_version),
      CONSTRAINT songstats_history_metric_key_version_unique
        UNIQUE (metric_key, definition_version)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_history_provider_identities (
      id serial PRIMARY KEY,
      artist_key text NOT NULL UNIQUE,
      spotify_artist_id text NOT NULL,
      songstats_artist_id text,
      validation_status text NOT NULL CHECK (validation_status IN ('verified', 'review', 'rejected')),
      identity_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
      validation_rule_version integer NOT NULL DEFAULT 1,
      verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS songstats_history_identity_songstats_idx
    ON songstats_history_provider_identities (songstats_artist_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_history_import_chunks (
      id serial PRIMARY KEY,
      run_id text NOT NULL REFERENCES songstats_history_import_runs(run_id),
      artist_key text NOT NULL,
      provider_identity_id integer NOT NULL REFERENCES songstats_history_provider_identities(id),
      request_identity_type text NOT NULL CHECK (request_identity_type IN ('spotify_artist_id', 'songstats_artist_id')),
      request_identity_value text NOT NULL,
      window_start_date date NOT NULL,
      window_end_date date NOT NULL,
      status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'identity_blocked', 'paused')),
      attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      response_hash text,
      parser_version integer NOT NULL,
      schema_version integer NOT NULL,
      acquisition_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      fetched_at timestamptz,
      observation_count integer NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
      duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
      error_code text,
      error_message text,
      started_at timestamptz,
      completed_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT songstats_history_chunks_artist_window_unique
        UNIQUE (artist_key, window_start_date, window_end_date)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS songstats_history_chunks_run_status_idx
    ON songstats_history_import_chunks (run_id, status)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS songstats_historical_observations (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      provider_identity_id integer NOT NULL REFERENCES songstats_history_provider_identities(id),
      metric_definition_id integer NOT NULL REFERENCES songstats_history_metric_definitions(id),
      provider_observation_date date NOT NULL,
      value numeric(30, 6) NOT NULL,
      granularity text NOT NULL DEFAULT 'daily' CHECK (granularity = 'daily'),
      acquisition_mode text NOT NULL DEFAULT 'songstats_historical' CHECK (acquisition_mode = 'songstats_historical'),
      fetched_at timestamptz NOT NULL,
      imported_at timestamptz NOT NULL DEFAULT now(),
      import_chunk_id integer NOT NULL REFERENCES songstats_history_import_chunks(id),
      CONSTRAINT songstats_history_observation_provenance_unique UNIQUE (
        artist_key, metric_definition_id, provider_observation_date, acquisition_mode
      )
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS songstats_history_observation_chunk_idx
    ON songstats_historical_observations (import_chunk_id)`);

  await assertSongstatsHistoryCompactSchema();

  for (const definition of SONGSTATS_HISTORY_METRICS) {
    await pool.query(`
      INSERT INTO songstats_history_metric_definitions (
        source, provider_field, metric_key, label, unit, behavior,
        commercial_endpoint, definition_version, ingestion_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (source, provider_field, definition_version) DO UPDATE SET
        metric_key=excluded.metric_key, label=excluded.label, unit=excluded.unit,
        behavior=excluded.behavior, commercial_endpoint=excluded.commercial_endpoint,
        ingestion_status=excluded.ingestion_status, updated_at=now()
    `, [
      definition.source, definition.providerField, definition.metricKey,
      definition.label, definition.unit, definition.behavior,
      definition.commercialEndpoint, SONGSTATS_HISTORY_DEFINITION_VERSION,
      definition.ingestionStatus,
    ]);
  }
}

export async function listSongstatsHistoryRoster(options: {
  limit: number;
  artistKeys?: string[];
}): Promise<SongstatsHistoryRosterArtist[]> {
  const artists = await listSongstatsCatalogArtists(options);
  if (!artists.length) return [];
  const linked = await pool.query<{
    artist_key: string;
    spotify_artist_id: string;
    songstats_artist_id: string | null;
    songstats_name: string | null;
  }>(
    `
      SELECT artist_key, spotify_artist_id, songstats_artist_id, songstats_name
      FROM songstats_artists
      WHERE artist_key = ANY($1::text[])
    `,
    [artists.map(artist => artist.artistKey)],
  );
  const byArtistKey = new Map(linked.rows.map(row => [row.artist_key, row]));
  return artists.map(artist => {
    const identity = byArtistKey.get(artist.artistKey);
    const spotifyMatches = identity?.spotify_artist_id === artist.spotifyArtistId;
    const songstatsArtistId = identity?.songstats_artist_id?.trim() || null;
    const identityValidationStatus: SongstatsIdentityValidationStatus =
      songstatsArtistId && spotifyMatches ? "verified" : "review";
    return {
      ...artist,
      songstatsArtistId,
      identityValidationStatus,
      identityEvidence: {
        rosterSpotifyArtistId: artist.spotifyArtistId,
        linkedSpotifyArtistId: identity?.spotify_artist_id ?? null,
        linkedSongstatsArtistId: songstatsArtistId,
        linkedSongstatsName: identity?.songstats_name ?? null,
        rule: "licensed_roster_spotify_id_matches_saved_songstats_link",
      },
    };
  });
}

export async function createSongstatsHistoryImportRun(input: {
  runId: string;
  mode: "test" | "validation" | "full";
  startDate: string;
  endDate: string;
  rosterSize: number;
  plannedRequestCount: number;
  options: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO songstats_history_import_runs (
        run_id, mode, status, requested_start_date, requested_end_date,
        roster_size, planned_request_count, options
      ) VALUES ($1, $2, 'running', $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (run_id) DO NOTHING
    `,
    [
      input.runId,
      input.mode,
      input.startDate,
      input.endDate,
      input.rosterSize,
      input.plannedRequestCount,
      JSON.stringify(input.options),
    ],
  );
}

export async function claimSongstatsHistoryChunk(input: {
  runId: string;
  artist: SongstatsHistoryRosterArtist;
  window: SongstatsHistoryWindow;
}): Promise<
  | { status: "completed" }
  | { status: "busy" }
  | { status: "identity_blocked" }
  | { status: "claimed"; chunkId: number; providerIdentityId: number; priorAttemptCount: number }
> {
  const identity = await pool.query<{ id: number }>(`
    INSERT INTO songstats_history_provider_identities (
      artist_key, spotify_artist_id, songstats_artist_id, validation_status,
      identity_evidence, validation_rule_version, verified_at
    ) VALUES ($1,$2,$3,$4,$5::jsonb,1,CASE WHEN $4='verified' THEN now() ELSE NULL END)
    ON CONFLICT (artist_key) DO UPDATE SET
      spotify_artist_id=excluded.spotify_artist_id,
      songstats_artist_id=excluded.songstats_artist_id,
      validation_status=excluded.validation_status,
      identity_evidence=excluded.identity_evidence,
      validation_rule_version=excluded.validation_rule_version,
      verified_at=CASE WHEN excluded.validation_status='verified' THEN now() ELSE NULL END,
      updated_at=now()
    RETURNING id
  `, [
    input.artist.artistKey,
    input.artist.spotifyArtistId,
    input.artist.songstatsArtistId,
    input.artist.identityValidationStatus,
    JSON.stringify(input.artist.identityEvidence),
  ]);
  const providerIdentityId = identity.rows[0]!.id;
  const requestIdentityType = input.artist.songstatsArtistId
    ? "songstats_artist_id"
    : "spotify_artist_id";
  const requestIdentityValue = input.artist.songstatsArtistId ?? input.artist.spotifyArtistId;
  const acquisitionMetadata = JSON.stringify({
    provider: "songstats",
    endpoint: "/artists/historic_stats",
    commercialEndpoint: "artist_historical_stats",
    source: "all",
    withAggregates: true,
  });
  if (input.artist.identityValidationStatus !== "verified" || !input.artist.songstatsArtistId) {
    await pool.query(
      `
        INSERT INTO songstats_history_import_chunks (
          run_id, artist_key, provider_identity_id,
          request_identity_type, request_identity_value,
          window_start_date, window_end_date, status,
          parser_version, schema_version, acquisition_metadata,
          error_code, error_message, completed_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, 'identity_blocked', $8, $9, $10::jsonb,
          'identity_not_verified', 'Saved Songstats identity is missing or does not match the licensed Spotify identity', now()
        )
        ON CONFLICT (artist_key, window_start_date, window_end_date) DO UPDATE SET
          run_id = EXCLUDED.run_id,
          provider_identity_id = EXCLUDED.provider_identity_id,
          status = 'identity_blocked',
          error_code = EXCLUDED.error_code,
          error_message = EXCLUDED.error_message,
          completed_at = now(),
          updated_at = now()
        WHERE songstats_history_import_chunks.status <> 'completed'
      `,
      [
        input.runId,
        input.artist.artistKey,
        providerIdentityId,
        requestIdentityType,
        requestIdentityValue,
        input.window.startDate,
        input.window.endDate,
        SONGSTATS_HISTORY_DEFINITION_VERSION,
        SONGSTATS_HISTORY_SCHEMA_VERSION,
        acquisitionMetadata,
      ],
    );
    return { status: "identity_blocked" };
  }

  const result = await pool.query<{ id: number; status: string; attempt_count: number }>(
    `
      INSERT INTO songstats_history_import_chunks (
        run_id, artist_key, provider_identity_id,
        request_identity_type, request_identity_value,
        window_start_date, window_end_date, status, attempt_count,
        parser_version, schema_version, acquisition_metadata, started_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, 'running', 0, $8, $9, $10::jsonb, now()
      )
      ON CONFLICT (artist_key, window_start_date, window_end_date) DO UPDATE SET
        run_id = EXCLUDED.run_id,
        provider_identity_id = EXCLUDED.provider_identity_id,
        request_identity_type = EXCLUDED.request_identity_type,
        request_identity_value = EXCLUDED.request_identity_value,
        status = 'running',
        attempt_count = songstats_history_import_chunks.attempt_count,
        parser_version = EXCLUDED.parser_version,
        schema_version = EXCLUDED.schema_version,
        acquisition_metadata = EXCLUDED.acquisition_metadata || jsonb_build_object(
          'requestAttempts',
          COALESCE(songstats_history_import_chunks.acquisition_metadata->'requestAttempts', '[]'::jsonb)
        ),
        error_code = NULL,
        error_message = NULL,
        started_at = now(),
        completed_at = NULL,
        updated_at = now()
      WHERE songstats_history_import_chunks.status <> 'completed'
        AND (
          songstats_history_import_chunks.status <> 'running'
          OR songstats_history_import_chunks.updated_at < now() - interval '15 minutes'
        )
      RETURNING id, status, attempt_count
    `,
    [
      input.runId,
      input.artist.artistKey,
      providerIdentityId,
      requestIdentityType,
      requestIdentityValue,
      input.window.startDate,
      input.window.endDate,
      SONGSTATS_HISTORY_DEFINITION_VERSION,
      SONGSTATS_HISTORY_SCHEMA_VERSION,
      acquisitionMetadata,
    ],
  );
  if (result.rowCount) {
    return {
      status: "claimed",
      chunkId: result.rows[0]!.id,
      providerIdentityId,
      priorAttemptCount: result.rows[0]!.attempt_count,
    };
  }
  const existing = await pool.query<{ status: string }>(
    `
      SELECT status FROM songstats_history_import_chunks
      WHERE artist_key=$1 AND window_start_date=$2 AND window_end_date=$3
    `,
    [input.artist.artistKey, input.window.startDate, input.window.endDate],
  );
  return existing.rows[0]?.status === "running"
    ? { status: "busy" }
    : { status: "completed" };
}

async function insertObservationBatch(
  client: PoolClient,
  observations: NormalizedSongstatsHistoricalObservation[],
  refs: {
    chunkId: number;
    providerIdentityId: number;
    metricDefinitionIds: Map<string, number>;
  },
): Promise<number> {
  if (!observations.length) return 0;
  const columnsPerRow = 9;
  const values: unknown[] = [];
  const placeholders = observations.map((observation, rowIndex) => {
    const offset = rowIndex * columnsPerRow;
    values.push(
      observation.artistKey,
      refs.providerIdentityId,
      refs.metricDefinitionIds.get(`${observation.metricDefinition.source}:${observation.metricDefinition.providerField}`),
      observation.providerObservationDate,
      observation.value,
      observation.granularity,
      observation.acquisitionMode,
      observation.fetchedAt,
      refs.chunkId,
    );
    return `(${Array.from({ length: columnsPerRow }, (_, index) => `$${offset + index + 1}`).join(", ")})`;
  });
  const result = await client.query(
    `
      INSERT INTO songstats_historical_observations (
        artist_key, provider_identity_id, metric_definition_id,
        provider_observation_date, value, granularity, acquisition_mode,
        fetched_at, import_chunk_id
      ) VALUES ${placeholders.join(",\n")}
      ON CONFLICT (
        artist_key, metric_definition_id, provider_observation_date, acquisition_mode
      ) DO NOTHING
    `,
    values,
  );
  return result.rowCount ?? 0;
}

export async function completeSongstatsHistoryChunk(input: {
  runId: string;
  artistKey: string;
  window: SongstatsHistoryWindow;
  responseHash: string;
  fetchedAt: Date;
  chunkId: number;
  providerIdentityId: number;
  observations: NormalizedSongstatsHistoricalObservation[];
  parserDuplicateCount: number;
}): Promise<{ inserted: number; duplicates: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const metricRows = await client.query<{
      id: number;
      source: string;
      provider_field: string;
    }>(`
      SELECT id, source, provider_field
      FROM songstats_history_metric_definitions
      WHERE definition_version = $1
    `, [SONGSTATS_HISTORY_DEFINITION_VERSION]);
    const metricDefinitionIds = new Map(metricRows.rows.map(row => [
      `${row.source}:${row.provider_field}`,
      row.id,
    ]));
    for (const observation of input.observations) {
      const key = `${observation.metricDefinition.source}:${observation.metricDefinition.providerField}`;
      if (!metricDefinitionIds.has(key)) throw new Error(`Missing metric definition reference for ${key}`);
    }
    let inserted = 0;
    for (let index = 0; index < input.observations.length; index += 250) {
      inserted += await insertObservationBatch(
        client,
        input.observations.slice(index, index + 250),
        {
          chunkId: input.chunkId,
          providerIdentityId: input.providerIdentityId,
          metricDefinitionIds,
        },
      );
    }
    const duplicates = input.parserDuplicateCount + input.observations.length - inserted;
    await client.query(
      `
        UPDATE songstats_history_import_chunks
        SET status = 'completed', response_hash = $4, fetched_at = $5,
            observation_count = $6, duplicate_count = $7,
            error_code = NULL, error_message = NULL,
            completed_at = now(), updated_at = now()
        WHERE artist_key = $1
          AND window_start_date = $2
          AND window_end_date = $3
      `,
      [
        input.artistKey,
        input.window.startDate,
        input.window.endDate,
        input.responseHash,
        input.fetchedAt,
        inserted,
        duplicates,
      ],
    );
    await client.query("COMMIT");
    return { inserted, duplicates };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordSongstatsHistoryRequestAttempt(input: {
  chunkId: number;
  attempt: number;
  outcome: "started" | "failed";
  error?: string;
}): Promise<void> {
  const event = {
    attempt: input.attempt,
    outcome: input.outcome,
    at: new Date().toISOString(),
    error: input.error?.slice(0, 500) ?? null,
  };
  await pool.query(
    `
      UPDATE songstats_history_import_chunks
      SET attempt_count = GREATEST(attempt_count, $2),
          acquisition_metadata = jsonb_set(
            acquisition_metadata,
            '{requestAttempts}',
            COALESCE(acquisition_metadata->'requestAttempts', '[]'::jsonb) || $3::jsonb,
            true
          ),
          updated_at = now()
      WHERE id = $1
    `,
    [input.chunkId, input.attempt, JSON.stringify([event])],
  );
}

export async function failSongstatsHistoryChunk(input: {
  artistKey: string;
  window: SongstatsHistoryWindow;
  errorCode: string;
  errorMessage: string;
  identityValidationStatus?: SongstatsIdentityValidationStatus;
  identityEvidence?: Record<string, unknown>;
}): Promise<void> {
  if (input.identityValidationStatus || input.identityEvidence) {
    await pool.query(`
      UPDATE songstats_history_provider_identities
      SET validation_status = COALESCE($2, validation_status),
          identity_evidence = COALESCE($3::jsonb, identity_evidence),
          verified_at = CASE WHEN COALESCE($2, validation_status)='verified' THEN verified_at ELSE NULL END,
          updated_at = now()
      WHERE artist_key = $1
    `, [
      input.artistKey,
      input.identityValidationStatus ?? null,
      input.identityEvidence ? JSON.stringify(input.identityEvidence) : null,
    ]);
  }
  await pool.query(
    `
      UPDATE songstats_history_import_chunks
      SET status = CASE WHEN $6 = 'verified' THEN 'failed' ELSE 'identity_blocked' END,
          error_code = $4,
          error_message = $5,
          completed_at = now(),
          updated_at = now()
      WHERE artist_key = $1
        AND window_start_date = $2
        AND window_end_date = $3
    `,
    [
      input.artistKey,
      input.window.startDate,
      input.window.endDate,
      input.errorCode,
      input.errorMessage.slice(0, 2_000),
      input.identityValidationStatus ?? "verified",
    ],
  );
}

export async function checkpointSongstatsHistoryImportRun(runId: string): Promise<void> {
  await pool.query(
    `
      UPDATE songstats_history_import_runs run
      SET
        completed_request_count = progress.completed,
        failed_request_count = progress.failed + progress.blocked,
        observation_count = progress.observations,
        summary = jsonb_build_object(
          'completed', progress.completed,
          'failed', progress.failed,
          'identityBlocked', progress.blocked,
          'observations', progress.observations,
          'duplicates', progress.duplicates
        ),
        updated_at = now()
      FROM (
        SELECT
          count(*) FILTER (WHERE status = 'completed')::integer completed,
          count(*) FILTER (WHERE status = 'failed')::integer failed,
          count(*) FILTER (WHERE status = 'identity_blocked')::integer blocked,
          COALESCE(sum(observation_count), 0)::integer observations,
          COALESCE(sum(duplicate_count), 0)::integer duplicates
        FROM songstats_history_import_chunks
        WHERE run_id = $1
      ) progress
      WHERE run.run_id = $1
    `,
    [runId],
  );
}

export async function finalizeSongstatsHistoryImportRun(runId: string): Promise<Record<string, unknown>> {
  const result = await pool.query<{
    completed: string;
    failed: string;
    blocked: string;
    observations: string;
    duplicates: string;
  }>(
    `
      SELECT
        count(*) FILTER (WHERE status = 'completed')::text completed,
        count(*) FILTER (WHERE status = 'failed')::text failed,
        count(*) FILTER (WHERE status = 'identity_blocked')::text blocked,
        COALESCE(sum(observation_count), 0)::text observations,
        COALESCE(sum(duplicate_count), 0)::text duplicates
      FROM songstats_history_import_chunks
      WHERE run_id = $1
    `,
    [runId],
  );
  const row = result.rows[0]!;
  const summary = {
    completed: Number(row.completed),
    failed: Number(row.failed),
    identityBlocked: Number(row.blocked),
    observations: Number(row.observations),
    duplicates: Number(row.duplicates),
  };
  const status = summary.failed > 0 || summary.identityBlocked > 0 ? "partial" : "completed";
  await pool.query(
    `
      UPDATE songstats_history_import_runs
      SET status = $2,
          completed_request_count = $3,
          failed_request_count = $4,
          observation_count = $5,
          summary = $6::jsonb,
          completed_at = now(),
          updated_at = now()
      WHERE run_id = $1
    `,
    [
      runId,
      status,
      summary.completed,
      summary.failed + summary.identityBlocked,
      summary.observations,
      JSON.stringify(summary),
    ],
  );
  return { runId, status, ...summary };
}

export async function pauseSongstatsHistoryImportRun(input: {
  runId: string;
  reason: string;
  capacity: Record<string, unknown>;
}): Promise<void> {
  await pool.query(`
    UPDATE songstats_history_import_runs
    SET status='paused',
        summary=COALESCE(summary, '{}'::jsonb) || jsonb_build_object(
          'pauseReason', $2::text,
          'capacity', $3::jsonb,
          'pausedAt', now()
        ),
        updated_at=now()
    WHERE run_id=$1
  `, [input.runId, input.reason, JSON.stringify(input.capacity)]);
}

export async function songstatsHistoryCapacitySnapshot() {
  const result = await pool.query<{
    database_bytes: string;
    wal_lsn: string;
  }>(`
    SELECT pg_database_size(current_database())::text AS database_bytes,
           pg_current_wal_lsn()::text AS wal_lsn
  `);
  const row = result.rows[0]!;
  return { databaseBytes: Number(row.database_bytes), walLsn: row.wal_lsn };
}

export async function songstatsHistoryWalBytesSince(walLsn: string): Promise<number> {
  const result = await pool.query<{ wal_bytes: string }>(`
    SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), $1::pg_lsn)::text AS wal_bytes
  `, [walLsn]);
  return Number(result.rows[0]?.wal_bytes ?? 0);
}

export interface StoredHistoricalObservationRow {
  artist_key: string;
  songstats_artist_id: string;
  source: string;
  metric_key: string;
  provider_observation_date: string;
  provider_observation_at: string | null;
  value: string;
  unit: string;
  granularity: "daily";
  acquisition_mode: "songstats_historical";
  fetched_at: string;
  request_window_start_date: string;
  request_window_end_date: string;
  identity_validation_status: "verified";
  provenance: Record<string, unknown>;
}

export async function loadSongstatsHistoricalObservations(
  artistKeys: string[],
  options: { includeQuarantined?: boolean } = {},
): Promise<StoredHistoricalObservationRow[]> {
  if (!artistKeys.length) return [];
  const result = await pool.query<StoredHistoricalObservationRow>(
    `
      SELECT
        observation.artist_key,
        identity.songstats_artist_id,
        definition.source,
        definition.metric_key,
        observation.provider_observation_date::text,
        NULL::text AS provider_observation_at,
        observation.value::text,
        definition.unit,
        observation.granularity,
        observation.acquisition_mode,
        observation.fetched_at::text,
        chunk.window_start_date::text AS request_window_start_date,
        chunk.window_end_date::text AS request_window_end_date,
        identity.validation_status AS identity_validation_status,
        jsonb_build_object(
          'provider', 'songstats',
          'endpoint', chunk.acquisition_metadata->>'endpoint',
          'commercialEndpoint', definition.commercial_endpoint,
          'source', definition.source,
          'providerField', definition.provider_field,
          'ingestionStatus', definition.ingestion_status,
          'providerObservationDate', observation.provider_observation_date,
          'providerObservationAt', NULL,
          'requestWindowStartDate', chunk.window_start_date,
          'requestWindowEndDate', chunk.window_end_date,
          'importRunId', chunk.run_id,
          'fetchedAt', observation.fetched_at,
          'importedAt', observation.imported_at,
          'responseHash', chunk.response_hash,
          'parserVersion', chunk.parser_version,
          'schemaVersion', chunk.schema_version,
          'importChunkId', chunk.id,
          'providerIdentityId', identity.id,
          'identityEvidence', identity.identity_evidence,
          'acquisitionMetadata', chunk.acquisition_metadata
        ) AS provenance
      FROM songstats_historical_observations observation
      JOIN songstats_history_metric_definitions definition
        ON definition.id = observation.metric_definition_id
      JOIN songstats_history_provider_identities identity
        ON identity.id = observation.provider_identity_id
      JOIN songstats_history_import_chunks chunk
        ON chunk.id = observation.import_chunk_id
      WHERE lower(observation.artist_key) = ANY($1::text[])
        AND identity.validation_status = 'verified'
        AND ($2::boolean OR definition.ingestion_status = 'active')
      ORDER BY definition.metric_key, observation.provider_observation_date
    `,
    [artistKeys, options.includeQuarantined === true],
  );
  return result.rows;
}

export async function songstatsHistoryStorageImpact() {
  await assertSongstatsHistoryCompactSchema();
  const result = await pool.query<{
    observations: string;
    table_bytes: string;
    index_bytes: string;
    total_bytes: string;
  }>(`
    SELECT
      (SELECT count(*)::text FROM songstats_historical_observations) observations,
      pg_relation_size('songstats_historical_observations')::text table_bytes,
      pg_indexes_size('songstats_historical_observations')::text index_bytes,
      pg_total_relation_size('songstats_historical_observations')::text total_bytes
  `);
  const row = result.rows[0]!;
  return {
    observations: Number(row.observations),
    tableBytes: Number(row.table_bytes),
    indexBytes: Number(row.index_bytes),
    totalBytes: Number(row.total_bytes),
  };
}
