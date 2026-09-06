# Private Monitor Pro audit tools

Generate the reviewed evaluator and SQL manifest locally after fetching a Git revision. No generated bundle, production evidence, or credential belongs in this directory. This is a small offline utility, not an application startup path.

From any working directory, run the script by its checkout path:

```sh
node /path/to/checkout/scripts/monitor-pro-audit-tools/generate.mjs \
  --output /path/to/checkout/.local/monitor-pro-audit-tools
```

The workspace's existing `tsx` and `esbuild` dependencies must already be installed. No package or lockfile changes are required. The CLI discovers its repository root, records the actual checkout HEAD, and creates the explicitly supplied private directory with0700 permissions and artifacts with0600. It rejects symlink artifact roots, descendants, and files. It generates:

- Browser IIFEs `MonitorAudit`, `MonitorAuditReplay`, and `MonitorAuditManifest`, plus their esbuild metadata.
- `monitor-audit-sql-manifest.json`: source schemas, all three population SELECTs, evidence SQL, typed missing-source substitutions, per-capture and fixed-clock variants, and framing.
- The separate private filesystem storage adapter, fixed-clock SQL, and a revision/size/SHA256 artifact index.

Only an isolated child imports SQL/schema definitions. The child gets a dummy database URL and an environment containing no production database/provider configuration. Every PostgreSQL query/connect and network attempt is blocked and counted. It does not import application startup, execute a query, or alter the parent process's environment. Generation uses the existing esbuild browser/IIFE/es2022/minify settings. The helper entries explicitly disable inherited `alwaysStrict` emission to preserve their previous bundle behavior.

## Execute through the existing SELECT-only tool

The generator itself never runs a production audit. In the already authorized orchestration environment, load the trusted IIFEs and parsed SQL manifest. Supply `execute(sql)` using the existing SELECT-only tool, and `read(key)`/`persist(key,value)` using the private persistent project directory. The supplied `storage.mjs` is a Node-host implementation with atomic writes; keep it outside browser V8.

```javascript
const metadata = {
  runId, revision, sourceHash, evaluatorHash, databaseName,
  now: savedDatabaseRunStartIso,
  clockMode: 'evidence_transaction_timestamp',
};
const replay = MonitorAuditReplay.createAuditReplay({
  evaluator:MonitorAudit, metadata, execute, read, persist,
});
const queries = MonitorAuditManifest.prepareAuditQueries(manifest, {
  missingTables, now:metadata.now, clockMode:metadata.clockMode,
});
```

Use an explicit clock mode. For production, each evidence row supplies `audit_captured_at` from PostgreSQL transaction_timestamp(), the same clock as its original now() range expressions. The evaluator receives that captured clock; run-start `metadata.now` is metadata only. Fixed clocks are available explicitly for offline replay fixtures. No orchestration helper reads Date.now or assumes Buffer/TextEncoder/network globals.

Capture and validate the schema inventory first, then exact source counts. For conclusive population coverage, use **one immutable full frame per source**:

```javascript
const population = await replay.collectPopulation({
  missingSchemaTables:missingTables,
  bundledPopulation:queries.bundledPopulation,
  sources:[
    {id:'population',capture:'whole',totalRows:counts.population,selectAll:()=>queries.population},
    {id:'accepted_aliases',capture:'whole',totalRows:counts.accepted_aliases,selectAll:()=>queries.acceptedAliases},
    {id:'discovery',capture:'whole',totalRows:counts.discovery,selectAll:()=>queries.discovery},
  ],
});
const report = await replay.auditNext({population,evidenceSql:queries.evidence,maximumArtists:25});
```

Current manifests also contain `bundledPopulation`: exact identity-only rows from the repository's public profile routes and supplemental artist data. The generator verifies those imported source files against its own Git HEAD before extraction and records file hashes, revision, inventory counts and a canonical row checksum. Pass this object explicitly as shown. Replay saves it separately under `bundled/population.json`, verifies its checksum/provenance and groups it with the captured database rows without another SQL query. It never asserts provider identities from a bundled lead. Its rows are part of the new manifest/source version; never inject them into a historical run.

For this scope, `databasePopulationComplete` records coverage of the reviewed database sources; overall `populationComplete` remains false, with `populationScope:'database_and_bundled_rosters'` and the two external roster limitations. Bundled revision proves source identity, not current external sheet/cache freshness. Reports retain those limits even after every captured candidate is evaluated. Historical manifests without bundled inputs keep their prior source scope unchanged.

If a full population response fails but a bounded frame succeeds, start a fresh run using the current generated revision/hashes and use `capture:'digest_chunks'` for that source, with the same `selectAll` and independently checked total. Keep the failed full raw artifact in its original run. The default chunk size is24,000 PostgreSQL Unicode characters. Each request still reads and hashes the **entire source SELECT**; only its returned payload substring is bounded. This performs more database work than a single response, so use it only for a demonstrated transport limit.

```javascript
{id:'population',capture:'digest_chunks',totalRows:counts.population,selectAll:()=>queries.population}
```

This mode orders top-level rows by their complete JSONB text with PostgreSQL `COLLATE "C"`, retaining duplicates and every array inside each row. It uses fresh `_digest_chunks` capture IDs. Every chunk must report the same full row count, character length and MD5; offsets must be contiguous, and complete reassembly must match that digest and decode to exactly the expected object rows. A missing, truncated or changed chunk fails without a complete population checkpoint. Restart reuses valid raw checkpoints; changed content requires a new run/capture identity, never overwriting failed evidence. The saved `contentProof` records protocol, source SQL MD5, full payload MD5/length/count, validated chunk count and row-order method. This is content consistency evidence for the full source, not an eligibility finding or a shared database transaction snapshot.

An optional paged source uses `selectPage({offset,limit})` and pageSize, but separate OFFSET reads cannot prove an immutable population even when every count matches. Every limited/paged capture remains `populationComplete:false`. Only whole-source frames or completely verified full-source digest chunks prove source coverage. Different sources remain independently captured; `sourceSnapshotScope:'independent_source_contents'` states this machine-readable boundary.

The existing pure identity grouper retains input order for rows tied on source priority and artist key. Deterministic transport sorting can therefore select a different stored display name in such ties; incidental diagnostic relation order can also differ. Conflicting accepted discovery targets remain conflicts, and their tied canonical label is not a verified resolution. No source value or alias array is rewritten. Mixed-source fixtures verify semantic grouping, canonical key/name, and source/bundle parity across40 permutations where the existing ranking distinguishes the rows; a separate fixture records the tied-name limitation explicitly.

Evidence reads are sequential, one whole response per artist. The transport wrapper begins with SELECT while keeping the source query materialized; both SELECT- and WITH-leading sources are supported. Raw output is durably saved before parsing; strict RFC4180/JSON decoding, row counts, Unicode lengths, MD5 and exact artist matching reject incomplete or mixed captures. A model/log preview truncation is not raw-tool truncation. Transaction-clock mode rejects repeated chunk queries because they change capture time. Preserve actual incomplete transport as a blocker.

Resume with the same metadata and saved population order. Completed raw/decoded/result files are reused; the compact JSON/CSV report advances without duplicate rows. Preserve the captured candidate order exactly. Priority artists may use separate indexed evidence captures; never sort or rewrite the population checkpoint in place. `auditComplete` requires complete source coverage, every candidate audited, and no incomplete evidence. C can still have other unresolved findings; count incomplete evidence separately from unclassified rows.

## Explicit inheritance of a verified population cohort

When only evidence/diagnostic logic changes, `inheritPopulation` can establish a **separate new run** over the complete original cohort without another population SQL read. It does not capture the population again, prove current schema freshness, copy old evidence/results, or turn the inherited cohort into a complete current global inventory. Original metadata, source proofs and files stay immutable.

This opt-in path requires the exact original manifest text, metadata/population file SHA256 pins and ordered candidate canonical MD5. SHA256 is computed over the original UTF8 text bytes; the host `readText` rejects malformed UTF8 and uses the same no-follow path guards as `read`. Canonical object-key MD5 is separately labelled `json_sorted_object_keys_v1`; it is never described as a file hash. Load the intended original metadata/candidate pins from retained, independently reviewed artifacts. Do not manufacture new original metadata to satisfy these checks.

```javascript
const parent = {
  runId: originalRunId,
  metadataSha256: verifiedOriginalMetadataFileSha256,
  populationSha256: verifiedOriginalPopulationFileSha256,
  candidatesMd5: verifiedOrderedCandidateCanonicalMd5,
  manifestText: exactOriginalSqlManifestUtf8,
  chunkSize: originalChunkSize, // e.g. the original capture's 100000; never guess
};
const metadata = {
  ...newRunMetadata, // new runId/revision/sourceHash/evaluatorHash/clock metadata
  populationBasis: {
    kind: 'inherited_verified_cohort',
    parentRunId: parent.runId,
    parentMetadataSha256: parent.metadataSha256,
    parentPopulationSha256: parent.populationSha256,
    parentCandidatesMd5: parent.candidatesMd5,
    parentSourceHash: originalMetadata.sourceHash,
    parentEvaluatorHash: originalMetadata.evaluatorHash,
  },
};
const replay = MonitorAuditReplay.createAuditReplay({
  evaluator: CurrentMonitorAudit, metadata, execute, read, persist, readText,
});
const population = await replay.inheritPopulation({
  parent, manifestText: exactCurrentSqlManifestUtf8,
});
const queries = MonitorAuditManifest.prepareAuditQueries(
  JSON.parse(exactCurrentSqlManifestUtf8),
  {missingTables: population.missingSchemaTables, now: metadata.now, clockMode: metadata.clockMode},
);
const report = await replay.auditNext({population, evidenceSql: queries.evidence, maximumArtists: 25});
```

Use caller adapters which route old run keys to the original private storage and new run keys to their separate storage. Both `read` and `readText` must refer to the same artifacts; `readText` returns exact durable file text, not JSON serialization of `read`. The utility's exported `sha256Utf8` can calculate UTF8 SHA256 in the browser isolate; an independently verified host digest is also suitable for establishing the input pins. The current `metadata.sourceHash` and original source hash must match SHA256 calculated from the two exact supplied manifest texts.

The inherited path requires the original `schema_inventory` and `source_counts` full captures, then the three ordered source plans `population`, `accepted_aliases`, `discovery`. Every source must have a complete whole frame or validated digest chunks. It reconstructs **all original raw frames**, including retained retry attempts, verifies SQL/row counts/MD5/offsets/decoded values, reconciles independently captured schema/counts, and verifies any bundled identity artifact. Paged, incomplete, missing-schema or already-inherited populations are rejected. The original chunk size is required for byte-identical request validation. No parent SQL or parent persistence is available in this verifier.

Original and current population, accepted-alias, discovery and schema SQL, source-table inventory, typed empty-source CTEs, bundled rows/order/checksums/source-file hashes/inventory/limitations must match exactly; only the bundled revision label may differ. Evidence SQL and evaluator version may change. The current evaluator must regroup all verified original DB and bundled rows into the **exact original candidate array**, including full order and nested array order. Object property order alone is canonically equivalent. A grouping change, identity input change, manually sorted candidate array or new source inventory requires a separately captured population.

New-run `population-lineage.json` retains exact manifest texts and SHA256/byte inventory for the original metadata, population, prerequisite captures, full source frames and bundled artifact. `population.json` explicitly includes `populationBasis.kind:'inherited_verified_cohort'`, original parent metadata, current evidence version, original coverage and unchanged source proofs. Its `populationComplete` and `databasePopulationComplete` remain **false**; `originalCaptureCoverage.databasePopulationComplete` describes only the verified historical capture. The original run-start clock is preserved as metadata, not advertised as a population capture timestamp. Digest chunks and separate sources still represent independent source contents; no common snapshot timestamp is invented.

Every inherited `auditNext` rechecks the pinned durable child and original artifacts, complete original raw proof, source-input equality and candidate order before evidence. Removing the caller's basis cannot disable verification: inherited mode is pinned in the immutable child run metadata. Coherent child-lineage rewrites which omit raw artifacts, changed original bytes, and SQL which differs from the current manifest fail closed. New evidence remains one transaction-clock response per artist; no old rows/results are copied. Each child result and JSON report carries the basis checksum. Inherited CSVs add explicit parent run, lineage artifact and cohort freshness columns; ordinary CSV output stays unchanged.

These checks reread/hash the complete original artifacts on each bounded batch, adding local private-storage work but no database queries. A caller may preload byte-verbatim artifacts from durable storage for that invocation; do not substitute an unverified cross-resume cache. Keep the original capture and new evidence clocks/provenance separate. Even after all inherited candidates are audited, global `auditComplete` remains false and the report states `requires_further_investigation` because it is not a fresh all-source population scan.

## Explicit retry of a failed SQL-tool envelope

The default makes no extra attempts. If the caller explicitly authorizes a bounded retry, supply:

```javascript
const replay = MonitorAuditReplay.createAuditReplay({
  evaluator:MonitorAudit, metadata, execute, read, persist,
  failedToolRetries:1,
  replayImplementation:{revision:reviewedRetryUtilityCommit,sha256:verifiedRetryBundleHash},
});
```

Only a complete failure envelope (`success:false`, nonzero integer exitCode, string output and string/null exitReason) may trigger another attempt. A successful malformed/truncated frame, mismatched artist/count, changed payload digest or mismatched saved request never retries automatically. Every retry must use byte-identical SQL and the same capture ID. The original `<offset>.json` or `full.json` stays unchanged; extra attempts are saved as `<offset>.retry-1.json`, etc. A successful saved retry is reused on resume with the same opt-in; no earlier successful chunk is rerun. Exhausted saved failures cause no new SQL on another invocation. The explicit limit is0..3 retries per request, including saved retry attempts; increasing it requires a new explicit caller choice and creates a separate immutable retry-policy record.

For a compatible transport-only upgrade, preserve the exact parsed original run metadata, original SQL manifest/queries and original evaluator. Do not replace the run's sourceHash, evaluatorHash, replayHash or revision with new artifact hashes. Verify and load the reviewed replacement replay bundle separately, passing its actual revision/SHA256 above. The helper writes a `replay-implementations/<hash>.retries-<limit>.json` sidecar containing the original source/evaluator hashes and the explicit retry policy. Every existing raw request still must match exactly. New transport proofs include all raw attempt references and their outcomes; the prior successful full-payload digest still governs all subsequent chunks. This upgrade records the implementation change without relabeling existing evidence. Source query or evaluator changes require their own audit run; they are not a compatible retry upgrade.

## Object-key ordering across the persistence bridge

Some host bridges reserialize JSON object keys. Internal checkpoint comparisons and hashes use the explicit `json_sorted_object_keys_v1` method: recursively sort object keys, retaining array order, exact strings, JSON value types and absent-versus-null fields. Metadata and replay-implementation comparisons use the same method. Sparse arrays, nonfinite numbers, dates and non-JSON values are rejected. This never changes the raw SQL payload string, its PostgreSQL MD5, its Unicode length or any source row/alias array order.

New decoded checkpoints declare `normalizedRowsHashVersion`; result checkpoints declare `candidateHashVersion` and include a result checksum; reports declare `populationHashVersion` and include a checksum of their artist entries. Unknown versions fail closed. Key reordering is not permission to change values, queries, source keys, artifact references or clocks.

A legacy decoded checksum is not waived or overwritten. On first recovery, the helper loads every required original raw frame and validates exact SQL/id/attempt links, count, contiguous offsets, character lengths and full payload digest. The reconstructed parsed rows must reproduce the old insertion-order `JSON.stringify` checksum and match the saved decoded rows semantically. Missing, truncated, mismatched or substantively changed evidence rejects **without any production SQL**. The caller must retain the original chunk size (24,000 for the retained production run); another size fails exact request matching rather than guessing. Original raw and decoded files remain unchanged. A separate immutable successor and recovery proof are saved under `canonical-checkpoints/json_sorted_object_keys_v1/decoded/`; subsequent reads verify its checksum and binding to the original checkpoint before reuse.

Legacy result/report migration similarly reconstructs candidate hashes from the complete original population source frames, checks source proofs and candidate semantics, and reevaluates legacy results against their saved original evidence and explicit capture clocks. It uses the original run's evaluator, not a newer policy. Changed candidate values, result facts, report entries or missing evidence fail closed. Original population, result and legacy report files remain intact during this migration; recovered result proofs and the continuing report live under the same versioned directory. The returned `checkpointArtifact` identifies the report to inspect, and its CSV sits beside it. New runs without legacy reports continue using their ordinary `report.json`/`report.csv` paths.

## Verification

```sh
MONITOR_HISTORY_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js \
  node --test /path/to/checkout/scripts/monitor-pro-audit-tools/*.test.mjs
```

The tests cover strict nested CSV/JSON, empty aliases, corruption/truncation, restart checkpoints, explicit/per-capture clocks, symlink containment, population drift, and offline generation from another directory. With PGlite set they also execute real PostgreSQL framing and the entire generated SQL manifest. Without it, the standalone PostgreSQL fixture is skipped.

To verify a retained artifact directory separately:

```sh
node --import /path/to/checkout/scripts/node_modules/tsx/dist/loader.mjs \
  /path/to/checkout/scripts/monitor-pro-audit-tools/verify-evaluator.mjs --output /private/output
MONITOR_HISTORY_PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js \
  node /path/to/checkout/scripts/monitor-pro-audit-tools/verify-manifest.mjs --output /private/output
```

The pure verifier checks14 A/B/C/unclassified scenarios with implicit Date construction and Date.now forbidden. Fixtures remain synthetic; verification never claims production artists are eligible. Generated metadata records the current source revision, so historical population totals must not be reused as a fresh audit result.

## Approved-roster audit helpers

`roster-reconciliation.mjs` preserves original roster rows and candidate groups, using an injected existing route resolver. Route correspondence never grants provider identity or public eligibility. Conflicting routes/provider identities remain explicit; image-writer spelling matches are only unresolved leads. Outside groups do not enter the scoped evaluation selection.

`roster-probe-batch.mjs` is **currently blocked for continued capture**. The first real scoped run exposed a budget-admission boundary that the six orchestration fixtures did not cover: the wrapper admitted a probe with 41,788 ms remaining, but approximately 3,498 ms of pre-query verification and reservation work consumed the margin required by the unchanged driver's pre-connection guard (38,500 ms). The probe stopped before connecting or querying. Its failed reserved statement remains immutable, so blindly rerunning the batch cannot safely advance it.

Do not treat this as missing artist data or bypass the driver's deadlines, read-only checks, or no-retry protection. Continuation requires reviewed orchestration that accounts for pre-query verification before admitting another probe, plus a separately identified evidence attempt for the preserved failed reservation. Keep the total batch/query bounds and all original evidence. The successful population capture and completed artist results do not need recapture.
