# Monitor Pro founder inspection and readiness rollout

This branch adds private inspection and source diagnostics to the approved shared Monitor Pro experience. It is a review branch, not evidence of a successful production rollout.

## Authorization

Clerk remains the identity authority. The existing exact `ARTIST_PRO_INTERNAL_USER_IDS` allowlist is the sole founder entitlement. No subscription is created and no public readiness flag is changed by founder inspection. Ordinary subscribers retain the existing artist-specific grant path.

The founder directory is `/monitoreo/founder`. Its data, inventory, and packaged-source identity are served by authenticated founder-only endpoints under `/api/monitoring/internal/`. `/api/monitoring/access` checks the signed-in viewer's existing internal entitlement without an account write. All private responses, including authorization failures, use `private, no-store`.

Artist URLs authorize directly. Identity resolution includes source-only artists and aliases, with provider conflicts isolated to the requested source identity. There is no redirect-based authorization or artist-specific page fork.

Paid grants resolve source aliases only after their artist-specific entitlement is established, using the granted key. Pending/rejected provider proposals never establish an identity bridge. Non-Latin aliases keep their exact normalized names; stripping them to empty keys or ASCII fragments would join unrelated artists.

## History

Metric history authorizes an artist grant and reads that metric; it no longer assembles the complete dashboard to authorize the request. Verified compact history is joined through actual source keys, with canonical-first daily deduplication and preserved source alternatives. Unverified identities and quarantined metrics do not contribute.

The existing 12-second server and 15-second client budgets are not increased. The request budget covers authorization, transport, and body decoding. Query stages do not start additional work after their deadline. The frontend distinguishes active loading, real history, successful empty history, authorization failure, backend failure, timeout, and partial coverage. Failed queries do not become successful empty arrays.

Raw per-item stream archives can supply a missing or stale summary using the original catalog sum semantics. The returned provenance identifies the source, date, and recovery reason. Provider-reported Spotify aggregate history remains a separate measure; it is never replaced with a raw track sum.

## Readiness and rollout gate

The directory inventories the union of known identity, catalog, artwork, and history sources. It exposes legacy public eligibility separately from complete-contract findings. Missing schema, unresolved identity, unknown import completeness, and unexamined existing evidence remain explicitly incomplete.

**Do not deploy the strict public filter before reviewing the actual complete production audit.** The branch's public discovery/checkout readiness path applies the stricter contract. Stored positive track and album counts do not prove full catalog completeness. If no approved completeness evidence exists, this filter may remove existing public candidates. That outcome requires investigation and a reviewed rollout decision, not an automatic mass eligibility change.

The audit does not verify that a report has actually rendered, that the founder has a working production session, or that a responsive browser view passed acceptance. Those are separate required checks. Touring and scheduled delivery remain explicitly optional under the current stored-data implementation; they are not fabricated.

## Production audit

Run `pnpm --filter @workspace/api-server audit:monitor-pro --output <private-json-path>` only in an authorized production-serving read environment with its existing database configuration. The runner imports no application startup, forces PostgreSQL read-only sessions, uses one audit connection, makes no provider calls, verifies the database name and read-only state, and saves incremental evidence. The private output includes every discovered candidate, counts, unknown findings, source evidence, repairs, revision, and query timing. Its default filename is ignored by Git and its file mode is restricted.

Where the platform exposes production only through a SELECT-only query interface, do not export production credentials. Execute the same schema inventory, candidate inventory, and bounded evidence SELECTs through that interface, preserving raw results and query timing. Apply the reviewed grouping and evaluator locally to those actual results. Document this execution mode separately; it is not a run of the one-connection CLI.

`src/lib/monitoring-candidate-policy.ts` is a database-free entrypoint for grouping and evaluation. It can be bundled as a browser IIFE for the query interface's orchestration runtime; it initializes no database or provider client. Run all inventory queries, including accepted alias relations, before grouping. Preserve one consistent audit timestamp and the complete schema findings. A query error or truncated result is unfinished evidence, never an empty source. Save results privately and verify each requested identity appears exactly once.

Large licensed payloads can exceed a query tool's output limit even when the SQL executes successfully. Start with one evidence row, evaluate it immediately, then use bounded batches appropriate to the measured response size. The evidence query references each exact legacy extended-data row rather than repeating its full JSON. If lossless chunking is necessary, check the complete length and a stable digest across all chunks before parsing. Do not truncate histories or catalog items to make an audit pass.

Before publishing:

1. Reconcile the currently serving source and the active protected-workstream checkout with this branch; do not replace unrelated changes.
2. Complete and review the production candidate audit, including all unclassified evidence. Compare public eligibility before and after.
3. Test founder, ordinary subscriber, ordinary non-subscriber, and signed-out sessions on direct URLs, `/monitoreo`, refresh, and profile navigation.
4. Inspect desktop, tablet, and mobile views and all history terminal states. Render the weekly report and verify its source-labelled contents.
5. Verify the packaged source fingerprint from the founder-only build endpoint and compare authenticated request traces before and after deployment.

No migration, index, collector cadence, validation allowance, provenance classification, protected comparator history, or YouTube safety-lock change is included.

## Local verification

Run workspace typechecks, the web test suite, API and web production builds, and the focused entitlement/readiness/history tests. Real PostgreSQL fixture tests are opt-in via `MONITOR_HISTORY_PGLITE_MODULE`, pointing at an installed `@electric-sql/pglite` module. They exercise the actual SQL with fixture data and must not be reported as production artist evidence or production latency.
