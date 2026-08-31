# Songstats compact full-history architecture — controlled preflight

## Status and hard boundaries

Prepared in code; not deployed or executed. No production migration, Songstats historical request, full backfill, subscription, checkout, Replit billing control, R2 bucket, or schedule was changed.

The runner uses only the commercially scoped `GET /artists/historic_stats` endpoint. It does not use Artist Activities, track endpoints, playlist-event endpoints, or chart-event endpoints.

Product policy is explicit:

- ingest all 48 presently useful Artist Historical Stats definitions when returned and identity-verified;
- retain Spotify and Deezer playlist count/reach and Apple Music playlist count as launch-core;
- keep `spotifyStreamsCurrent / streams_current` quarantined;
- test mode may retain the quarantined series for comparison, but Paid Monitor queries join only `ingestion_status = 'active'`;
- promote it to the 49th active definition only after representative data proves it distinct and reliable.

## 1. Revised normalized schema

### `songstats_history_metric_definitions`

One immutable/versioned definition per Songstats source/field. It stores source, provider field, canonical metric key, label, unit, behavior, commercial endpoint, definition version, and `active`/`quarantined` status. There are 48 active records and one quarantined record in version 1.

### `songstats_history_provider_identities`

One normalized identity record per canonical Mexico Charts artist. It stores canonical artist key, licensed Spotify identity, Songstats identity, validation status, versioned validation rule, complete identity evidence, and verification timestamp. An identity mismatch updates this record and blocks its chunks; evidence is not repeated on every observation.

### `songstats_history_import_runs`

One operational run record with requested global range, roster/request counts, options, baseline database size, capacity policy, progress, final/paused status, and timestamps.

### `songstats_history_import_chunks`

One resumable checkpoint per artist/year request window. It references the normalized identity and records request identity/value, inclusive window, response hash, parser version, schema version, acquisition metadata, fetch time, status, attempts, observation/duplicate counts, errors, and timestamps.

### `songstats_historical_observations`

The compact point row contains only:

| Column | Purpose |
|---|---|
| `id` | Internal row identity |
| `artist_key` | Canonical Mexico Charts artist ID |
| `provider_identity_id` | Validated identity reference |
| `metric_definition_id` | Versioned metric-definition reference |
| `provider_observation_date` | Exact Songstats provider date |
| `value` | Exact numeric observation |
| `granularity` | `daily`; never relabeled hourly/native |
| `acquisition_mode` | `songstats_historical` |
| `fetched_at` | Provider acquisition timestamp |
| `imported_at` | Database import timestamp |
| `import_chunk_id` | Request window, response, parser, schema, and acquisition provenance reference |

Paid Monitor reconstructs complete provenance through joins to definition, identity, and chunk records. Provider history remains separate from Mexico Charts scheduled/native tables.

## 2. Old and new bytes per point

| Representation | Planning estimate | Reason |
|---|---:|---|
| Previous wide implemented row | **900–1,600 bytes/point all-in** | Repeated metric JSON, identity JSON, request data, response hash, large provenance JSON, repeated text keys, and six indexes |
| Previous optimistic planner constant | 220 bytes/point | Too low for the wide implementation; appropriate only as a lower-bound compact fact-row concept |
| Revised compact planner target | **320 bytes/point all-in** | Narrow fact row, normalized parent records, primary/unique indexes, and one audit index |
| Compact test acceptance range | **220–400 bytes/point all-in** | Must be measured with `pg_relation_size`, `pg_indexes_size`, and `pg_total_relation_size` |

The code planner now uses 320 bytes/point. It is a guard estimate, not a substitute for the 1–3 artist measurement.

## 3. Indexes and purpose

| Table/index | Purpose | Decision |
|---|---|---|
| Runs primary key | Resume/audit one run | Retain |
| Runs `(status, started_at)` | Operator lookup for running/paused/recent runs | Retain |
| Metric definition primary key | Compact observation reference | Retain |
| Metric `(source, provider_field, definition_version)` unique | Exact provider-field/version identity and idempotent seed | Retain |
| Metric `(metric_key, definition_version)` unique | Canonical metric/version uniqueness | Retain |
| Identity primary key | Compact point/chunk reference | Retain |
| Identity `artist_key` unique | One current validated identity per canonical artist | Retain |
| Identity `songstats_artist_id` | Identity audit/provider lookup | Retain |
| Chunk primary key | Point provenance and resume reference | Retain |
| Chunk `(artist_key, window_start_date, window_end_date)` unique | Idempotent yearly checkpoint across restarts/runs | Retain |
| Chunk `(run_id, status)` | Progress counts and failure/paused reporting | Retain |
| Observation primary key | Stable internal/audit identity | Retain |
| Observation `(artist_key, metric_definition_id, provider_observation_date, acquisition_mode)` unique | Duplicate protection and Paid Monitor's artist/metric/date range access path | Retain |
| Observation `import_chunk_id` | Chunk audit, verification, and controlled rollback/delete of one imported chunk | Retain |

Removed from the wide design:

- separate artist/metric/date index, because the unique index already has that useful prefix;
- global source/metric/date index, because no launch query scans every artist by provider metric/date;
- Songstats ID/date index on every point, because identity lookups belong in the identity table;
- import-run index on every point, because observations reference chunks and chunks have `(run_id,status)`.

## 4. Expected all-48 production footprint

Maximum theoretical observations from 2020-01-01 through 2026-08-31:

`529 × 2,435 daily dates × 48 active definitions = 61,829,520 points`

| Model | Maximum footprint |
|---|---:|
| Revised 320-byte planning target | **18.43 GiB** |
| Compact acceptance range, 220–400 bytes | **12.67–23.03 GiB** |
| Previous wide design, 900–1,600 bytes | **51.82–92.13 GiB** |

Actual storage should be lower than the theoretical maximum because artist/source/metric coverage begins on different dates and contains gaps. Parent definition/identity/chunk records add little relative to 61.8 million points. WAL/PITR is separately monitored because bulk writes can temporarily exceed final relation growth.

At 18.43 GiB added, the assessment's observed-PITR cost model is roughly $7.08/month incremental; the conservative logical + full PITR + one-backup allowance is roughly $11.80/month. These are planning estimates using the already observed Replit rates, not a billing guarantee.

## 5. Proposed representative real-history validation

The exact keys and saved Songstats identities must pass the 529-roster dry run before any request.

| Candidate | Why proposed | Expected yearly requests |
|---|---|---:|
| `peso-pluma` | Existing Paid Monitor demo; high-volume, multi-platform contemporary artist | 7 |
| `banda ms de sergio lizarraga` | Legacy catalog candidate for deeper history and playlist coverage | 7 |
| `neton-vega` | Newer artist expected to exercise shallow/partial coverage and earliest-date disclosure | 7 |

Controlled sequence:

1. Deploy schema/code only to an isolated non-production database after approval.
2. Run dry-run for each proposed key; require exact roster identity evidence and `verified` status.
3. Start with one artist and concurrency 1; review all seven yearly chunks before adding artist two or three.
   Test execution also requires `SONGSTATS_HISTORY_TARGET_ENVIRONMENT=nonproduction` and the separately approved `SONGSTATS_HISTORY_TEST_APPROVED=true` lock.
4. Maximum expected requests: 7 for one artist, 14 for two, 21 for three.
5. Maximum unique-artist billing under the negotiated model: €0.40, €0.80, or €1.20 if those artists have not already been counted that billing month.
6. Capture actual earliest/latest dates, missing intervals, fields returned, response sizes, retries, request latency, heap/index/total bytes, WAL amplification, and query plans.
7. Compare `streams_current` with `streams_total` for equality, gaps, divergence, monotonicity, and definition stability. It remains quarantined regardless of one isolated differing point until the representative review is approved.
8. Verify that Paid Monitor returns only active definitions while audit queries can inspect the quarantined test series.

No test request has been executed.

## 6. Migration safety

The runner no longer creates or migrates tables implicitly. It performs a read-only compact-schema assertion and exits before a Songstats request if the required tables/columns are absent or if it detects the legacy wide schema.

Production migration plan:

1. Capture `to_regclass`, column/index definitions, relation sizes, row counts, and a pre-migration backup/PITR checkpoint.
2. If the history tables do not exist, apply the additive compact schema and seed 49 definitions (48 active, one quarantined).
3. If an old empty development/test schema exists, preserve it under explicit backup names, create the compact schema, verify, and only later remove backups with separate approval.
4. If old observation rows exist, create compact shadow tables, seed definitions/identities/chunks, copy in bounded batches, compare row counts and deterministic keys, then swap names in a short transaction. Do not alter the wide table in place.
5. Run schema assertion, foreign-key checks, metric counts, identity counts, index definitions, and zero-row Paid Monitor queries before any licensed request.
6. Do not use `drizzle-kit push --force`; review generated SQL and reject destructive proposals.

## 7. Rollback procedure

Before a backfill:

1. Set `SONGSTATS_HISTORY_EMERGENCY_STOP=true` or stop the runner process; it stops claiming new chunks and preserves checkpoints.
2. For a code-only rollback, redeploy the prior application build while leaving additive compact tables untouched.
3. For a schema-cutover rollback, atomically restore the prior table names/views from the preserved wide-schema tables. Do not delete compact tables during the incident.
4. If only one imported chunk is invalid, use the `import_chunk_id` index to identify its points, verify the response hash/identity, and prepare a separately reviewed transactional cleanup. The current runner performs no automatic deletion.
5. If database-wide recovery is necessary, use the verified pre-backfill backup/PITR point. Confirm restoration in isolation before redirecting production.
6. Remove backup/legacy tables only after a completed validation period and separate destructive-action approval.

## 8. Prepared runner safeguards

| Safeguard | Prepared behavior |
|---|---|
| 60 GiB warning | Emits one structured warning while continuing |
| 70 GiB pause | Marks the run paused and claims no new chunks |
| 80 GiB approval boundary | Explicit hard reason; cannot be treated as ordinary continuation |
| $25/month incremental storage | Pauses using live database growth from the run baseline and configured storage/PITR rates |
| $60/month total DB resource | Pauses using the approved compute baseline plus current size-based storage estimate |
| PITR/write anomaly | Measures WAL bytes per chunk; full mode requires an approved test ratio and pauses above 2× that ratio |
| Emergency stop | Checks `SONGSTATS_HISTORY_EMERGENCY_STOP=true` before every new chunk |
| Test-environment lock | Refuses representative requests unless the target is explicitly labeled `nonproduction` and the test approval lock is present |
| Resume | Unique artist/year chunks; completed chunks are skipped and failed chunks can be retried |
| Identity rejection | Mismatch updates normalized identity status/evidence and blocks the chunk |
| Idempotency | Unique point key plus `ON CONFLICT DO NOTHING` |
| Checkpoints | Updates run/chunk counts and errors after every task |

Replit account-wide shutdown limits are intentionally not configured by this implementation.

## 9. Future R2/Parquet addition without changing Paid Monitor serving

PostgreSQL remains the serving contract. Paid Monitor reads compact observations and derived/materialized summaries exactly as it does after this refactor.

R2 can later be added behind the ingestion pipeline:

1. export completed, identity-verified chunks to immutable Parquet partitioned by provider/source/year and bounded object size;
2. include deterministic observation keys, metric-definition/schema versions, chunk/request metadata, response hash, and file checksum in an immutable manifest;
3. upload through the repository's existing optional S3-compatible R2 path after bucket, credentials, retention, encryption/access policy, budget, alerts, and restore tests are approved;
4. mark archive verification on the chunk/manifest layer, not on every observation;
5. retain PostgreSQL facts needed for interactive charts and common calculations; use R2 for durable full-fidelity archive, reprocessing, audits, and recovery;
6. rebuild PostgreSQL serving facts from verified Parquet manifests when needed, without teaching the Paid Monitor request path to scan object storage.

No R2 configuration or upload is performed here.

## 10. Approval gates still required

1. Review this schema, index set, footprint model, artists, migration, and rollback.
2. Approve isolated non-production schema deployment.
3. Review actual roster dry-run output.
4. Approve one artist's licensed real-history test.
5. Review bytes/point, WAL ratio, identity, field semantics, gaps, costs, and Paid Monitor output.
6. Optionally approve artists two and three.
7. Revise thresholds from measured results.
8. Separately approve production schema migration.
9. Separately approve the 529-artist full backfill.
