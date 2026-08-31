# Songstats full-history implementation and preflight

> **Compact-schema revision:** The original wide per-observation design documented below has been superseded by `SONGSTATS_COMPACT_HISTORY_PREFLIGHT.md`. The current implementation uses normalized metric definitions, provider identities, and import chunks; observations contain compact references. Use the compact preflight for schema, index, storage, validation, migration, rollback, guardrail, and R2 decisions. This file remains as historical implementation context only.

## Status

The architecture is implemented but not deployed or executed. Checkout and subscriptions remain unchanged. No Songstats request was made while implementing or validating this work.

The only Songstats endpoint used by the runner is:

```text
GET /artists/historic_stats
```

The runner explicitly excludes Artist Activities, track history/stats, playlist-event endpoints, and chart-event endpoints. Those endpoints are not part of the currently documented commercial scope.

## Schema

### `songstats_history_import_runs`

One row per test/full execution. It records mode, requested global window, roster size, planned/completed/failed requests, observation count, options, progress summary, and run timestamps.

### `songstats_history_import_chunks`

One checkpoint per canonical artist/year window. It records:

- canonical artist key;
- Spotify and Songstats identities;
- request identity type/value;
- inclusive request dates;
- pending/running/completed/failed/identity-blocked state;
- attempt count;
- identity status/evidence;
- response hash;
- inserted/duplicate counts;
- error code/message and timestamps.

Completed chunks are not claimed again, including under a new run ID. Failed chunks can be resumed. Identity-blocked chunks cannot import observations until the saved identity is corrected and verified.

### `songstats_historical_observations`

The normalized provider-history table preserves:

- canonical Mexico Charts artist ID;
- Songstats artist ID;
- identity used for the request;
- platform/source;
- canonical metric key and original provider field;
- versioned metric definition;
- provider observation date;
- null provider timestamp when Songstats supplies only a date;
- exact numeric value and unit;
- `granularity = daily`;
- `acquisition_mode = songstats_historical`;
- fetched/imported timestamps;
- requested window bounds;
- verified identity status/evidence;
- import run, response hash, endpoint, parser version, and provenance JSON.

The table is separate from `songstats_artist_daily_snapshots`. No historical Songstats date is rewritten as an hourly or Mexico Charts-native observation.

## Indexes and duplicate protection

```text
UNIQUE artist_key, window_start_date, window_end_date
  on songstats_history_import_chunks

UNIQUE artist_key, songstats_artist_id, source, metric_key,
       provider_observation_date, acquisition_mode
  on songstats_historical_observations

INDEX artist_key, metric_key, provider_observation_date
INDEX source, metric_key, provider_observation_date
INDEX songstats_artist_id, provider_observation_date
INDEX import_run_id
INDEX run_id, status
INDEX artist_key, status
```

Inserts use `ON CONFLICT DO NOTHING`; inserted and duplicate counts are checkpointed. Conflicting duplicate values within one provider response fail the chunk instead of selecting a value silently.

## Dry-run mode

Dry run is the default. It queries the licensed roster and saved identity links, but it creates no tables/rows and makes no Songstats call:

```bash
pnpm --filter @workspace/api-server songstats-history-backfill -- \
  --mode=dry-run \
  --start-date=2020-01-01 \
  --end-date=2026-08-31 \
  --limit=529
```

The returned JSON includes selected/verified/blocked artists, blocked identity evidence, every yearly window, request count, storage upper bound, billing estimate, endpoint allow-list, and confirmation that API calls/writes are zero.

The production-roster dry run was not executed in this workspace because no production `DATABASE_URL` was available. The pure planner produced:

```json
{
  "artistCount": 529,
  "startDate": "2020-01-01",
  "endDate": "2026-08-31",
  "requestsPerArtist": 7,
  "plannedRequestCount": 3703,
  "endpoint": "/artists/historic_stats",
  "commercialEndpoint": "artist_historical_stats",
  "outsideScopeEndpointsUsed": [],
  "billingMaximumEuro": 211.60
}
```

The actual dry run must be captured and reviewed before any licensed request. In particular, `identityBlocked` must be resolved or accepted as quarantined; the configured 529 ceiling must not be substituted for the actual selected count.

## Representative test-artist path

Test execution is restricted to one to three explicit artist keys and requires an execution flag:

```bash
pnpm --filter @workspace/api-server songstats-history-backfill -- \
  --mode=test \
  --execute=true \
  --artist-key=EXPLICIT_TEST_ARTIST \
  --start-date=2020-01-01 \
  --end-date=2026-08-31 \
  --limit=1 \
  --concurrency=1
```

Before running it, review the dry-run identity evidence. After running it, capture:

1. seven chunk rows and their statuses;
2. earliest/latest dates and counts by source/metric;
3. duplicate and missing-interval counts;
4. response sizes and latencies;
5. `pg_relation_size`, `pg_indexes_size`, and total relation size;
6. dashboard earliest-date/provenance output;
7. Songstats monthly unique-artist usage.

No live test-artist API request was made in this implementation pass. Fixture validation covered two provider sources, eight normalized observations, identity acceptance/rejection, exact daily provenance, yearly planning, duplicate precedence, long growth windows, gap rejection, historical peaks, multi-year detection, and conditional Release Impact. All seven automated tests passed.

## Full-run safety lock

A full run requires all of the following:

1. explicit `--mode=full`;
2. explicit `--execute=true`;
3. `SONGSTATS_FULL_HISTORY_BACKFILL_APPROVED=true` in the controlled run environment;
4. a database connection and Songstats API key;
5. prior schema deployment, dry-run review, and representative test-artist approval.

Without the environment lock, full mode exits before creating the run or calling Songstats.

Do not set the lock until the user explicitly approves the full backfill.

## Retry, resume, and failure behavior

- Default concurrency: 2; hard maximum: 5.
- Default attempts: 3; hard maximum: 5.
- Retries: HTTP 408/429/500/502/503/504 and transient fetch failures.
- Backoff: exponential from 750 ms plus jitter.
- Non-transient authorization, identity, and invalid-request failures are not retried blindly.
- Progress is checkpointed after every artist/year task.
- Per-artist/window failures remain queryable with error code/message.
- A restarted run skips completed artist/year chunks and retries failed ones.
- Empty valid responses complete with zero observations; missing dates are not synthesized.

## Storage and index estimate

January 1, 2020 through August 31, 2026 contains 2,435 inclusive days.

| Scope | Maximum observations | Estimated row/index input at 220 bytes/point | Planning interpretation |
|---|---:|---:|---|
| 529 artists × 10 core metrics | 12,881,150 | 2.64 GiB | Plan roughly 3-6 GB including practical indexes/headroom |
| 529 artists × 25 metrics | 32,202,875 | 6.60 GiB | Plan roughly 8-12 GB including indexes/headroom |
| 529 artists × all 49 allow-listed definitions | 63,117,635 | 12.93 GiB | Extreme upper bound; plan 18-25 GB if every field existed daily |

The 49-metric case is deliberately conservative. Sources have different start dates and many fields/platforms are absent, so real storage should be lower. The representative test must measure actual bytes per point before the full run. Raw API payloads are not copied into the historical observation table; every normalized point retains a response hash and the existing extended-data store remains separate.

## Billing and request estimate

- Seven yearly requests per artist for 2020 through 2026 year-to-date.
- Full 529 ceiling: 3,703 base historical requests.
- Maximum contracted monthly artist amount: 529 × €0.40 = **€211.60**.
- Repeated included-endpoint requests for the same unique artist in the same month do not add another unique-artist charge.
- If all selected artists were already requested in that billing month, expected incremental artist billing is zero; verify the production account usage record before execution.
- Keep the one-time run within one billing month where practical.

## Paid Monitor assembly

The new assembler accepts four evidence classes:

1. `songstats_historical` daily provider observations;
2. `scheduled_current_snapshot` daily Mexico Charts captures of Songstats current values;
3. `mexico_charts_direct` native/live observations;
4. Mexico Charts-derived metrics calculated from the provenance-aware series.

For the same metric/date, direct observations outrank scheduled captures, which outrank historical backfill points. Lower-precedence values remain attached as alternatives with full provenance; they are not deleted. Only identity-verified points enter subscriber series.

The API now prepares:

- full available series and per-point provenance;
- actual earliest/latest available dates and observation counts per metric;
- 7/30/90-day, 182-day, one-year, and YoY changes with baseline dates;
- peak in available history;
- multi-year status and represented calendar years;
- conditional release comparisons only when valid before/after points exist.

The UI reads the selected metric's full available series and displays its actual earliest date. It uses “Available history” rather than claiming a universal or lifetime start date.

## Required approval sequence

1. Deploy schema/code to a non-production environment.
2. Run the 529-roster dry run; review identity blocks, request/storage/billing estimates.
3. Run one explicit test artist.
4. Review actual rows, indexes, payload timings, earliest dates, gaps, and UI provenance.
5. Optionally test two more representative artists with different depth/platform coverage.
6. Present the outputs for approval.
7. Only then unlock and execute the full run.

Subscriptions, checkout, deployment, and the full backfill are outside this implementation step.
