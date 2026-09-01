import {
  SONGSTATS_HISTORY_COMPACT_RUNNER_WRITE_TARGETS,
  SONGSTATS_HISTORY_COMPACT_TABLES,
  SONGSTATS_HISTORY_SCHEMA_VERSION,
} from "./songstats-history-schema-contract";

// Keep the production preflight independent from the history importer/model.
// These values describe the already-approved seed contract and do not expose
// any Songstats client or mutation-capable dependency to this read-only path.
const SONGSTATS_HISTORY_DEFINITION_VERSION = 1;
const SONGSTATS_HISTORY_EXPECTED_DEFINITION_COUNT = 49;

export const SONGSTATS_PRODUCTION_PREFLIGHT_SCHEMA_VERSION =
  SONGSTATS_HISTORY_SCHEMA_VERSION;
export const SONGSTATS_COMPACT_HISTORY_TABLES =
  SONGSTATS_HISTORY_COMPACT_TABLES;
export const SONGSTATS_COMPACT_RUNNER_WRITE_TARGETS =
  SONGSTATS_HISTORY_COMPACT_RUNNER_WRITE_TARGETS;

const LEGACY_HISTORY_TABLES = [
  "songstats_artist_daily_snapshots",
  "songstats_artist_extended_data",
] as const;

const DEFAULT_PREFLIGHT_ARTISTS = [
  "peso-pluma",
  "banda ms de sergio lizarraga",
  "neton-vega",
] as const;

export const PRODUCTION_PREFLIGHT_REQUIRED_COLUMNS: Record<
  (typeof SONGSTATS_COMPACT_HISTORY_TABLES)[number],
  readonly string[]
> = {
  songstats_history_metric_definitions: [
    "id",
    "source",
    "provider_field",
    "metric_key",
    "label",
    "unit",
    "behavior",
    "commercial_endpoint",
    "definition_version",
    "ingestion_status",
    "created_at",
    "updated_at",
  ],
  songstats_history_provider_identities: [
    "id",
    "artist_key",
    "spotify_artist_id",
    "songstats_artist_id",
    "validation_status",
    "identity_evidence",
    "validation_rule_version",
    "verified_at",
    "created_at",
    "updated_at",
  ],
  songstats_history_import_runs: [
    "run_id",
    "mode",
    "status",
    "requested_start_date",
    "requested_end_date",
    "roster_size",
    "planned_request_count",
    "completed_request_count",
    "failed_request_count",
    "observation_count",
    "options",
    "summary",
    "started_at",
    "completed_at",
    "updated_at",
  ],
  songstats_history_import_chunks: [
    "id",
    "run_id",
    "artist_key",
    "provider_identity_id",
    "request_identity_type",
    "request_identity_value",
    "window_start_date",
    "window_end_date",
    "status",
    "attempt_count",
    "response_hash",
    "parser_version",
    "schema_version",
    "acquisition_metadata",
    "fetched_at",
    "observation_count",
    "duplicate_count",
    "error_code",
    "error_message",
    "started_at",
    "completed_at",
    "updated_at",
  ],
  songstats_historical_observations: [
    "id",
    "artist_key",
    "provider_identity_id",
    "metric_definition_id",
    "provider_observation_date",
    "value",
    "granularity",
    "acquisition_mode",
    "fetched_at",
    "imported_at",
    "import_chunk_id",
  ],
};

export const PRODUCTION_PREFLIGHT_REQUIRED_CONSTRAINTS = [
  "songstats_history_import_runs_pkey",
  "songstats_history_import_runs_mode_check",
  "songstats_history_import_runs_status_check",
  "songstats_history_metric_definitions_pkey",
  "songstats_history_metric_source_field_version_unique",
  "songstats_history_metric_key_version_unique",
  "songstats_history_metric_definitions_commercial_endpoint_check",
  "songstats_history_metric_definitions_ingestion_status_check",
  "songstats_history_provider_identities_pkey",
  "songstats_history_provider_identities_artist_key_key",
  "songstats_history_provider_identities_validation_status_check",
  "songstats_history_import_chunks_pkey",
  "songstats_history_import_chunks_run_id_fkey",
  "songstats_history_import_chunks_provider_identity_id_fkey",
  "songstats_history_chunks_artist_window_unique",
  "songstats_historical_observations_pkey",
  "songstats_historical_observations_provider_identity_id_fkey",
  "songstats_historical_observations_metric_definition_id_fkey",
  "songstats_historical_observations_import_chunk_id_fkey",
  "songstats_history_observation_provenance_unique",
] as const;

export const PRODUCTION_PREFLIGHT_REQUIRED_INDEXES = [
  "songstats_history_import_runs_pkey",
  "songstats_history_import_runs_status_started_idx",
  "songstats_history_metric_definitions_pkey",
  "songstats_history_metric_source_field_version_unique",
  "songstats_history_metric_key_version_unique",
  "songstats_history_provider_identities_pkey",
  "songstats_history_provider_identities_artist_key_key",
  "songstats_history_identity_songstats_idx",
  "songstats_history_import_chunks_pkey",
  "songstats_history_chunks_artist_window_unique",
  "songstats_history_chunks_run_status_idx",
  "songstats_historical_observations_pkey",
  "songstats_history_observation_provenance_unique",
  "songstats_history_observation_chunk_idx",
] as const;

const REQUIRED_PLAYLIST_METRICS = [
  ["spotify", "playlists_current", "spotifyPlaylists"],
  ["spotify", "playlist_reach_current", "spotifyPlaylistReach"],
  ["deezer", "playlists_current", "deezerPlaylists"],
  ["deezer", "playlist_reach_current", "deezerPlaylistReach"],
  ["apple_music", "playlists_current", "appleMusicPlaylists"],
] as const;

type QueryName =
  | "tables"
  | "columns"
  | "constraints"
  | "indexes"
  | "metric_definitions"
  | "compact_counts"
  | "identities";

export interface ReadOnlyPreflightQuery<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  name: QueryName;
  text: string;
  values?: readonly unknown[];
}
export interface ReadOnlyPreflightQueryResult<
  Row extends Record<string, unknown>,
> {
  rows: Row[];
  rowCount: number;
}

export type ReadOnlyPreflightExecutor = <Row extends Record<string, unknown>>(
  query: ReadOnlyPreflightQuery<Row>,
) => Promise<ReadOnlyPreflightQueryResult<Row>>;

export interface SongstatsProductionPreflightIdentity {
  requestedArtistKey: string;
  canonicalMexicoChartsArtistId: string | null;
  storedSongstatsArtistId: string | null;
  identifiersUsed: {
    requestedCandidates: string[];
    canonicalArtistKey: string | null;
    catalogSpotifyArtistId: string | null;
    storedSpotifyArtistId: string | null;
  };
  storedMappingEvidence: Record<string, unknown>;
  confidence: string | number | null;
  status: string | null;
  result: "PASS" | "REJECT";
  rejectionReason: string | null;
  manualOverride: false;
}

export interface SongstatsProductionPreflightResult {
  mode: "production-preflight";
  revision: string | null;
  schema: {
    version: 2;
    tables: string[];
    columnsChecked: number;
    constraintsChecked: number;
    indexesChecked: number;
    compactRunnerWriteTargets: readonly string[];
    legacyWideTargets: readonly string[];
  };
  metricDefinitions: {
    total: 49;
    active: 48;
    quarantined: 1;
    streamsCurrentQuarantined: true;
    playlistDefinitionsPresent: string[];
    duplicateCanonicalDefinitions: 0;
    duplicateProviderDefinitions: 0;
  };
  emptyHistory: {
    observations: 0;
    providerIdentities: 0;
    importRuns: 0;
    importChunks: 0;
  };
  identities: SongstatsProductionPreflightIdentity[];
  safety: {
    apiCalls: 0;
    writes: 0;
    schemaChanges: 0;
    importRunsCreated: 0;
    checkpointsCreated: 0;
    historicalObservationsInserted: 0;
    identityLinksMutated: 0;
    externalIdentityLookups: 0;
    databaseReads: number;
    transactionMode: "repeatable_read_read_only";
  };
}

function normalizeArtistKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function artistKeyCandidates(value: string): string[] {
  const normalized = normalizeArtistKey(value);
  const spaced = normalized.replace(/[-_]+/g, " ");
  const dashed = normalized.replace(/[\s_]+/g, "-");
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  return [...new Set([normalized, spaced, dashed, compact].filter(Boolean))];
}

function asCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error(`Invalid preflight count: ${String(value)}`);
  return count;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function assertProductionPreflightSqlIsReadOnly(text: string): void {
  const normalized = text.replace(/--.*$/gm, " ").replace(/\s+/g, " ").trim();
  if (!/^(SELECT|WITH)\b/i.test(normalized)) {
    throw new Error(
      "Production preflight rejected a non-read-only SQL statement",
    );
  }
  if (
    /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|COPY|CALL|DO|GRANT|REVOKE|VACUUM|ANALYZE|REFRESH|REINDEX|CLUSTER)\b/i.test(
      normalized,
    )
  ) {
    throw new Error(
      "Production preflight rejected a write-capable SQL statement",
    );
  }
}

function requireExactArtists(artistKeys: readonly string[]): string[] {
  const normalized = artistKeys.map(normalizeArtistKey);
  const expected = DEFAULT_PREFLIGHT_ARTISTS.map(normalizeArtistKey);
  if (
    normalized.length !== expected.length ||
    expected.some((key) => !normalized.includes(key))
  ) {
    throw new Error(
      `production-preflight is locked to: ${DEFAULT_PREFLIGHT_ARTISTS.join(", ")}`,
    );
  }
  return [...DEFAULT_PREFLIGHT_ARTISTS];
}

export async function runSongstatsProductionPreflightWithExecutor(options: {
  query: ReadOnlyPreflightExecutor;
  artistKeys?: readonly string[];
  revision?: string | null;
}): Promise<SongstatsProductionPreflightResult> {
  if (SONGSTATS_PRODUCTION_PREFLIGHT_SCHEMA_VERSION !== 2) {
    throw new Error(
      "Production preflight requires compact Songstats history schema version 2",
    );
  }
  const artistKeys = requireExactArtists(
    options.artistKeys ?? DEFAULT_PREFLIGHT_ARTISTS,
  );

  const tableResult = await options.query<{ table_name: string }>({
    name: "tables",
    text: `SELECT table_name FROM information_schema.tables
      WHERE table_schema=current_schema() AND table_name = ANY($1::text[])
      ORDER BY table_name`,
    values: [SONGSTATS_COMPACT_HISTORY_TABLES],
  });
  const tables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = SONGSTATS_COMPACT_HISTORY_TABLES.filter(
    (table) => !tables.has(table),
  );
  if (
    missingTables.length ||
    tables.size !== SONGSTATS_COMPACT_HISTORY_TABLES.length
  ) {
    throw new Error(
      `Compact Songstats schema assertion failed; missing tables: ${missingTables.join(", ") || "unknown"}`,
    );
  }

  const columnResult = await options.query<{
    table_name: string;
    column_name: string;
  }>({
    name: "columns",
    text: `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position`,
    values: [SONGSTATS_COMPACT_HISTORY_TABLES],
  });
  const columns = new Set(
    columnResult.rows.map((row) => `${row.table_name}.${row.column_name}`),
  );
  const missingColumns = Object.entries(
    PRODUCTION_PREFLIGHT_REQUIRED_COLUMNS,
  ).flatMap(([table, required]) =>
    required
      .filter((column) => !columns.has(`${table}.${column}`))
      .map((column) => `${table}.${column}`),
  );
  if (missingColumns.length)
    throw new Error(
      `Compact Songstats schema is missing columns: ${missingColumns.join(", ")}`,
    );

  const constraintResult = await options.query<{ constraint_name: string }>({
    name: "constraints",
    text: `SELECT con.conname AS constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid=con.conrelid
      JOIN pg_namespace nsp ON nsp.oid=rel.relnamespace
      WHERE nsp.nspname=current_schema() AND rel.relname = ANY($1::text[])
      ORDER BY con.conname`,
    values: [SONGSTATS_COMPACT_HISTORY_TABLES],
  });
  const constraints = new Set(
    constraintResult.rows.map((row) => row.constraint_name),
  );
  const missingConstraints = PRODUCTION_PREFLIGHT_REQUIRED_CONSTRAINTS.filter(
    (name) => !constraints.has(name),
  );
  if (missingConstraints.length)
    throw new Error(
      `Compact Songstats schema is missing constraints: ${missingConstraints.join(", ")}`,
    );

  const indexResult = await options.query<{ indexname: string }>({
    name: "indexes",
    text: `SELECT indexname FROM pg_indexes
      WHERE schemaname=current_schema() AND tablename = ANY($1::text[])
      ORDER BY indexname`,
    values: [SONGSTATS_COMPACT_HISTORY_TABLES],
  });
  const indexes = new Set(indexResult.rows.map((row) => row.indexname));
  const missingIndexes = PRODUCTION_PREFLIGHT_REQUIRED_INDEXES.filter(
    (name) => !indexes.has(name),
  );
  if (missingIndexes.length)
    throw new Error(
      `Compact Songstats schema is missing indexes: ${missingIndexes.join(", ")}`,
    );

  const legacyWideTargets = SONGSTATS_COMPACT_RUNNER_WRITE_TARGETS.filter(
    (target) => (LEGACY_HISTORY_TABLES as readonly string[]).includes(target),
  );
  if (legacyWideTargets.length)
    throw new Error(
      `Compact runner targets legacy history tables: ${legacyWideTargets.join(", ")}`,
    );

  const metricResult = await options.query<{
    source: string;
    provider_field: string;
    metric_key: string;
    definition_version: number;
    ingestion_status: string;
  }>({
    name: "metric_definitions",
    text: `SELECT source, provider_field, metric_key, definition_version, ingestion_status
      FROM songstats_history_metric_definitions
      WHERE definition_version=$1
      ORDER BY source, provider_field, metric_key`,
    values: [SONGSTATS_HISTORY_DEFINITION_VERSION],
  });
  const active = metricResult.rows.filter(
    (row) => row.ingestion_status === "active",
  );
  const quarantined = metricResult.rows.filter(
    (row) => row.ingestion_status === "quarantined",
  );
  const providerKeys = metricResult.rows.map(
    (row) => `${row.source}:${row.provider_field}:${row.definition_version}`,
  );
  const canonicalKeys = metricResult.rows.map(
    (row) => `${row.metric_key}:${row.definition_version}`,
  );
  const duplicateProviderDefinitions =
    providerKeys.length - new Set(providerKeys).size;
  const duplicateCanonicalDefinitions =
    canonicalKeys.length - new Set(canonicalKeys).size;
  const streamsCurrent = metricResult.rows.find(
    (row) =>
      row.source === "spotify" &&
      row.provider_field === "streams_current" &&
      row.metric_key === "spotifyStreamsCurrent",
  );
  const playlistDefinitionsPresent = REQUIRED_PLAYLIST_METRICS.filter(
    ([source, providerField, metricKey]) =>
      metricResult.rows.some(
        (row) =>
          row.source === source &&
          row.provider_field === providerField &&
          row.metric_key === metricKey &&
          row.ingestion_status === "active",
      ),
  ).map(([, , metricKey]) => metricKey);
  if (
    metricResult.rows.length !== SONGSTATS_HISTORY_EXPECTED_DEFINITION_COUNT ||
    active.length !== 48 ||
    quarantined.length !== 1 ||
    streamsCurrent?.ingestion_status !== "quarantined" ||
    playlistDefinitionsPresent.length !== REQUIRED_PLAYLIST_METRICS.length ||
    duplicateProviderDefinitions !== 0 ||
    duplicateCanonicalDefinitions !== 0
  ) {
    throw new Error(
      "Songstats history metric-definition seed assertion failed",
    );
  }

  const countResult = await options.query<{
    observations: string | number;
    provider_identities: string | number;
    import_runs: string | number;
    import_chunks: string | number;
  }>({
    name: "compact_counts",
    text: `SELECT
      (SELECT count(*) FROM songstats_historical_observations) AS observations,
      (SELECT count(*) FROM songstats_history_provider_identities) AS provider_identities,
      (SELECT count(*) FROM songstats_history_import_runs) AS import_runs,
      (SELECT count(*) FROM songstats_history_import_chunks) AS import_chunks`,
  });
  const countRow = countResult.rows[0];
  if (!countRow)
    throw new Error(
      "Compact Songstats history empty-state assertion returned no result",
    );
  const emptyHistory = {
    observations: asCount(countRow.observations),
    providerIdentities: asCount(countRow.provider_identities),
    importRuns: asCount(countRow.import_runs),
    importChunks: asCount(countRow.import_chunks),
  };
  if (Object.values(emptyHistory).some((count) => count !== 0)) {
    throw new Error(
      `Compact Songstats history is not empty: ${JSON.stringify(emptyHistory)}`,
    );
  }
  const assertedEmptyHistory = {
    observations: 0 as const,
    providerIdentities: 0 as const,
    importRuns: 0 as const,
    importChunks: 0 as const,
  };

  const candidateMap = new Map(
    artistKeys.map((key) => [key, artistKeyCandidates(key)]),
  );
  const compactCandidates = [
    ...new Set(
      [...candidateMap.values()]
        .flat()
        .map((value) => value.replace(/[^a-z0-9]/g, "")),
    ),
  ];
  const identityResult = await options.query<{
    canonical_artist_id: string;
    catalog_spotify_artist_id: string | null;
    mapping_record: Record<string, unknown> | null;
  }>({
    name: "identities",
    text: `SELECT
      c.artist_key AS canonical_artist_id,
      COALESCE(c.spotify_id, spotify.spotify_artist_id) AS catalog_spotify_artist_id,
      to_jsonb(mapping) AS mapping_record
    FROM kworb_coverage c
    LEFT JOIN spotify_artists spotify ON spotify.artist_key=c.artist_key
    LEFT JOIN songstats_artists mapping ON mapping.artist_key=c.artist_key
    WHERE regexp_replace(lower(c.artist_key), '[^a-z0-9]', '', 'g') = ANY($1::text[])
    ORDER BY c.artist_key`,
    values: [compactCandidates],
  });
  const identityByCompactKey = new Map(
    identityResult.rows.map((row) => [
      normalizeArtistKey(row.canonical_artist_id).replace(/[^a-z0-9]/g, ""),
      row,
    ]),
  );
  const identities = artistKeys.map((requestedArtistKey) => {
    const candidates = candidateMap.get(requestedArtistKey)!;
    const row = candidates
      .map((candidate) =>
        identityByCompactKey.get(candidate.replace(/[^a-z0-9]/g, "")),
      )
      .find(Boolean);
    const mapping = objectValue(row?.mapping_record);
    const storedSongstatsArtistId = optionalText(
      mapping["songstats_artist_id"],
    );
    const catalogSpotifyArtistId = optionalText(row?.catalog_spotify_artist_id);
    const storedSpotifyArtistId = optionalText(mapping["spotify_artist_id"]);
    const canonicalArtistId = optionalText(row?.canonical_artist_id);
    const confidence =
      mapping["identity_confidence"] ??
      mapping["match_confidence"] ??
      mapping["confidence"] ??
      null;
    const status = optionalText(
      mapping["identity_status"] ??
        mapping["validation_status"] ??
        mapping["status"],
    );
    const reasons: string[] = [];
    if (!row) reasons.push("canonical_artist_not_found");
    if (row && !catalogSpotifyArtistId)
      reasons.push("catalog_spotify_id_missing");
    if (row && !storedSongstatsArtistId)
      reasons.push("stored_songstats_artist_id_missing");
    if (row && !storedSpotifyArtistId)
      reasons.push("stored_spotify_artist_id_missing");
    if (
      catalogSpotifyArtistId &&
      storedSpotifyArtistId &&
      catalogSpotifyArtistId !== storedSpotifyArtistId
    ) {
      reasons.push("stored_spotify_artist_id_mismatch");
    }
    const pass = reasons.length === 0;
    return {
      requestedArtistKey,
      canonicalMexicoChartsArtistId: canonicalArtistId,
      storedSongstatsArtistId,
      identifiersUsed: {
        requestedCandidates: candidates,
        canonicalArtistKey: canonicalArtistId,
        catalogSpotifyArtistId,
        storedSpotifyArtistId,
      },
      storedMappingEvidence: {
        songstatsName: mapping["songstats_name"] ?? null,
        mappingSource: mapping["mapping_source"] ?? mapping["source"] ?? null,
        matchMethod:
          mapping["match_method"] ?? mapping["identity_method"] ?? null,
        verifiedAt: mapping["verified_at"] ?? null,
        updatedAt: mapping["updated_at"] ?? null,
        rule: "catalog_spotify_id_matches_stored_songstats_mapping",
      },
      confidence:
        typeof confidence === "string" || typeof confidence === "number"
          ? confidence
          : null,
      status,
      result: pass ? ("PASS" as const) : ("REJECT" as const),
      rejectionReason: pass ? null : reasons.join(","),
      manualOverride: false as const,
    };
  });

  return {
    mode: "production-preflight",
    revision: options.revision ?? null,
    schema: {
      version: 2,
      tables: [...SONGSTATS_COMPACT_HISTORY_TABLES],
      columnsChecked: Object.values(
        PRODUCTION_PREFLIGHT_REQUIRED_COLUMNS,
      ).reduce((sum, value) => sum + value.length, 0),
      constraintsChecked: PRODUCTION_PREFLIGHT_REQUIRED_CONSTRAINTS.length,
      indexesChecked: PRODUCTION_PREFLIGHT_REQUIRED_INDEXES.length,
      compactRunnerWriteTargets: SONGSTATS_COMPACT_RUNNER_WRITE_TARGETS,
      legacyWideTargets,
    },
    metricDefinitions: {
      total: 49,
      active: 48,
      quarantined: 1,
      streamsCurrentQuarantined: true,
      playlistDefinitionsPresent,
      duplicateCanonicalDefinitions: 0,
      duplicateProviderDefinitions: 0,
    },
    emptyHistory: assertedEmptyHistory,
    identities,
    safety: {
      apiCalls: 0,
      writes: 0,
      schemaChanges: 0,
      importRunsCreated: 0,
      checkpointsCreated: 0,
      historicalObservationsInserted: 0,
      identityLinksMutated: 0,
      externalIdentityLookups: 0,
      databaseReads: 7,
      transactionMode: "repeatable_read_read_only",
    },
  };
}

export async function runSongstatsProductionPreflight(
  options: {
    artistKeys?: readonly string[];
    revision?: string | null;
  } = {},
): Promise<SongstatsProductionPreflightResult> {
  // Keep the database adapter out of the pure preflight import graph. Tests and
  // callers of the executor-based core cannot initialize or reach a database.
  const { pool } = await import("@workspace/db");
  const client = await pool.connect();
  let reads = 0;
  try {
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const result = await runSongstatsProductionPreflightWithExecutor({
      ...options,
      query: async <Row extends Record<string, unknown>>(
        query: ReadOnlyPreflightQuery<Row>,
      ) => {
        assertProductionPreflightSqlIsReadOnly(query.text);
        reads += 1;
        const response = await client.query<Row>(
          query.text,
          query.values as unknown[] | undefined,
        );
        return {
          rows: response.rows,
          rowCount: response.rowCount ?? response.rows.length,
        };
      },
    });
    await client.query("ROLLBACK");
    return { ...result, safety: { ...result.safety, databaseReads: reads } };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the assertion error; a read-only validation job must fail closed.
    }
    throw error;
  } finally {
    client.release();
  }
}
