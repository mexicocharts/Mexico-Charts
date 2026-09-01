import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertProductionPreflightSqlIsReadOnly,
  PRODUCTION_PREFLIGHT_REQUIRED_COLUMNS,
  PRODUCTION_PREFLIGHT_REQUIRED_CONSTRAINTS,
  PRODUCTION_PREFLIGHT_REQUIRED_INDEXES,
  runSongstatsProductionPreflightWithExecutor,
  SONGSTATS_COMPACT_HISTORY_TABLES,
  type ReadOnlyPreflightExecutor,
  type ReadOnlyPreflightQuery,
} from "./songstats-history-preflight";

const SONGSTATS_HISTORY_DEFINITION_VERSION = 1;
const SONGSTATS_HISTORY_METRICS = [
  {
    source: "spotify",
    providerField: "playlists_current",
    metricKey: "spotifyPlaylists",
    ingestionStatus: "active",
  },
  {
    source: "spotify",
    providerField: "playlist_reach_current",
    metricKey: "spotifyPlaylistReach",
    ingestionStatus: "active",
  },
  {
    source: "deezer",
    providerField: "playlists_current",
    metricKey: "deezerPlaylists",
    ingestionStatus: "active",
  },
  {
    source: "deezer",
    providerField: "playlist_reach_current",
    metricKey: "deezerPlaylistReach",
    ingestionStatus: "active",
  },
  {
    source: "apple_music",
    providerField: "playlists_current",
    metricKey: "appleMusicPlaylists",
    ingestionStatus: "active",
  },
  ...Array.from({ length: 43 }, (_, index) => ({
    source: `fixture_source_${index}`,
    providerField: `fixture_field_${index}`,
    metricKey: `fixtureMetric${index}`,
    ingestionStatus: "active",
  })),
  {
    source: "spotify",
    providerField: "streams_current",
    metricKey: "spotifyStreamsCurrent",
    ingestionStatus: "quarantined",
  },
] as const;

type FixtureOverrides = {
  missingTable?: string;
  omitMetricKey?: string;
  identities?: Array<Record<string, unknown>>;
  counts?: Partial<
    Record<
      "observations" | "provider_identities" | "import_runs" | "import_chunks",
      number
    >
  >;
};

function identityRows() {
  return [
    {
      canonical_artist_id: "peso-pluma",
      catalog_spotify_artist_id: "spotify-peso",
      mapping_record: {
        spotify_artist_id: "spotify-peso",
        songstats_artist_id: "songstats-peso",
        songstats_name: "Peso Pluma",
        match_confidence: 100,
        validation_status: "verified",
      },
    },
    {
      canonical_artist_id: "banda ms de sergio lizarraga",
      catalog_spotify_artist_id: "spotify-banda-ms",
      mapping_record: {
        spotify_artist_id: "spotify-banda-ms",
        songstats_artist_id: "songstats-banda-ms",
        songstats_name: "Banda MS de Sergio Lizárraga",
        match_method: "saved_spotify_link",
      },
    },
    {
      canonical_artist_id: "neton-vega",
      catalog_spotify_artist_id: "spotify-neton",
      mapping_record: {
        spotify_artist_id: "spotify-neton",
        songstats_artist_id: null,
        songstats_name: "Netón Vega",
      },
    },
  ];
}

function fixtureExecutor(overrides: FixtureOverrides = {}) {
  const calls: ReadOnlyPreflightQuery[] = [];
  const executor: ReadOnlyPreflightExecutor = async <
    Row extends Record<string, unknown>,
  >(
    query: ReadOnlyPreflightQuery<Row>,
  ) => {
    calls.push(query);
    assertProductionPreflightSqlIsReadOnly(query.text);
    let rows: Array<Record<string, unknown>>;
    switch (query.name) {
      case "tables":
        rows = SONGSTATS_COMPACT_HISTORY_TABLES.filter(
          (table) => table !== overrides.missingTable,
        ).map((table_name) => ({ table_name }));
        break;
      case "columns":
        rows = Object.entries(PRODUCTION_PREFLIGHT_REQUIRED_COLUMNS).flatMap(
          ([table_name, columns]) =>
            columns.map((column_name) => ({ table_name, column_name })),
        );
        break;
      case "constraints":
        rows = PRODUCTION_PREFLIGHT_REQUIRED_CONSTRAINTS.map(
          (constraint_name) => ({ constraint_name }),
        );
        break;
      case "indexes":
        rows = PRODUCTION_PREFLIGHT_REQUIRED_INDEXES.map((indexname) => ({
          indexname,
        }));
        break;
      case "metric_definitions":
        rows = SONGSTATS_HISTORY_METRICS.filter(
          (metric) => metric.metricKey !== overrides.omitMetricKey,
        ).map((metric) => ({
          source: metric.source,
          provider_field: metric.providerField,
          metric_key: metric.metricKey,
          definition_version: SONGSTATS_HISTORY_DEFINITION_VERSION,
          ingestion_status: metric.ingestionStatus,
        }));
        break;
      case "compact_counts":
        rows = [
          {
            observations: overrides.counts?.observations ?? 0,
            provider_identities: overrides.counts?.provider_identities ?? 0,
            import_runs: overrides.counts?.import_runs ?? 0,
            import_chunks: overrides.counts?.import_chunks ?? 0,
          },
        ];
        break;
      case "identities":
        rows = overrides.identities ?? identityRows();
        break;
    }
    return { rows: rows as Row[], rowCount: rows.length };
  };
  return { executor, calls };
}

test("production preflight is deterministic and reports zero API calls and writes", async () => {
  const { executor, calls } = fixtureExecutor();
  const first = await runSongstatsProductionPreflightWithExecutor({
    query: executor,
    revision: "test-revision",
  });
  const second = await runSongstatsProductionPreflightWithExecutor({
    query: fixtureExecutor().executor,
    revision: "test-revision",
  });
  assert.deepEqual(first, second);
  assert.equal(first.safety.apiCalls, 0);
  assert.equal(first.safety.writes, 0);
  assert.equal(first.safety.schemaChanges, 0);
  assert.equal(first.safety.importRunsCreated, 0);
  assert.equal(first.safety.checkpointsCreated, 0);
  assert.equal(first.safety.historicalObservationsInserted, 0);
  assert.equal(first.safety.identityLinksMutated, 0);
  assert.equal(first.safety.externalIdentityLookups, 0);
  assert.deepEqual(
    first.identities.map((identity) => identity.result),
    ["PASS", "PASS", "REJECT"],
  );
  assert.equal(
    first.identities[2]?.rejectionReason,
    "stored_songstats_artist_id_missing",
  );
  assert.ok(
    calls.every(
      (call) =>
        !/\b(insert|update|delete|create|alter|drop)\b/i.test(call.text),
    ),
  );
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "tables",
      "columns",
      "constraints",
      "indexes",
      "metric_definitions",
      "compact_counts",
      "identities",
    ],
  );
});
test("schema failure aborts before seed, identity, or import state access", async () => {
  const { executor, calls } = fixtureExecutor({
    missingTable: "songstats_historical_observations",
  });
  await assert.rejects(
    runSongstatsProductionPreflightWithExecutor({ query: executor }),
    /missing tables/,
  );
  assert.deepEqual(
    calls.map((call) => call.name),
    ["tables"],
  );
});

test("incomplete metric seed aborts and streams_current remains quarantined", async () => {
  const { executor } = fixtureExecutor({
    omitMetricKey: "spotifyPlaylistReach",
  });
  await assert.rejects(
    runSongstatsProductionPreflightWithExecutor({ query: executor }),
    /metric-definition seed assertion failed/,
  );
  const valid = await runSongstatsProductionPreflightWithExecutor({
    query: fixtureExecutor().executor,
  });
  assert.equal(valid.metricDefinitions.active, 48);
  assert.equal(valid.metricDefinitions.quarantined, 1);
  assert.equal(valid.metricDefinitions.streamsCurrentQuarantined, true);
  assert.ok(
    valid.metricDefinitions.playlistDefinitionsPresent.includes(
      "spotifyPlaylistReach",
    ),
  );
  assert.ok(
    !valid.metricDefinitions.playlistDefinitionsPresent.includes(
      "spotifyStreamsCurrent",
    ),
  );
});

test("non-empty compact history fails closed without creating a run or checkpoint", async () => {
  const { executor, calls } = fixtureExecutor({ counts: { import_runs: 1 } });
  await assert.rejects(
    runSongstatsProductionPreflightWithExecutor({ query: executor }),
    /history is not empty/,
  );
  assert.ok(!calls.some((call) => call.name === "identities"));
  assert.ok(
    calls.every(
      (call) => !/songstats_history_import_runs\s*\(/i.test(call.text),
    ),
  );
});

test("missing identity evidence rejects without any external lookup or override", async () => {
  const { executor, calls } = fixtureExecutor({
    identities: identityRows().map((row, index) =>
      index === 0 ? { ...row, mapping_record: null } : row,
    ),
  });
  const result = await runSongstatsProductionPreflightWithExecutor({
    query: executor,
  });
  assert.equal(result.identities[0]?.result, "REJECT");
  assert.match(
    result.identities[0]?.rejectionReason ?? "",
    /stored_songstats_artist_id_missing/,
  );
  assert.equal(result.identities[0]?.manualOverride, false);
  assert.equal(result.safety.externalIdentityLookups, 0);
  assert.equal(calls.filter((call) => call.name === "identities").length, 1);
});

test("SQL guard rejects every write-capable dependency", () => {
  assert.doesNotThrow(() => assertProductionPreflightSqlIsReadOnly("SELECT 1"));
  assert.throws(
    () =>
      assertProductionPreflightSqlIsReadOnly(
        "WITH changed AS (UPDATE x SET y=1 RETURNING *) SELECT * FROM changed",
      ),
    /write-capable/,
  );
  assert.throws(
    () => assertProductionPreflightSqlIsReadOnly("CREATE TABLE x(id int)"),
    /non-read-only/,
  );
});

test("the preflight core cannot load API or mutation-capable modules", () => {
  const preflight = readFileSync(
    new URL("./songstats-history-preflight.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    preflight,
    /songstats-client|songstats-history-backfill|songstats-history-store|songstats-history-model|historic_stats/,
  );
});
