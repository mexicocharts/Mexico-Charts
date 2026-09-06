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
  sources:[
    {id:'population',capture:'whole',totalRows:counts.population,selectAll:()=>queries.population},
    {id:'accepted_aliases',capture:'whole',totalRows:counts.accepted_aliases,selectAll:()=>queries.acceptedAliases},
    {id:'discovery',capture:'whole',totalRows:counts.discovery,selectAll:()=>queries.discovery},
  ],
});
const report = await replay.auditNext({population,evidenceSql:queries.evidence,maximumArtists:25});
```

If a full population response fails but a bounded frame succeeds, start a fresh run using the current generated revision/hashes and use `capture:'digest_chunks'` for that source, with the same `selectAll` and independently checked total. Keep the failed full raw artifact in its original run. The default chunk size is24,000 PostgreSQL Unicode characters. Each request still reads and hashes the **entire source SELECT**; only its returned payload substring is bounded. This performs more database work than a single response, so use it only for a demonstrated transport limit.

```javascript
{id:'population',capture:'digest_chunks',totalRows:counts.population,selectAll:()=>queries.population}
```

This mode orders top-level rows by their complete JSONB text with PostgreSQL `COLLATE "C"`, retaining duplicates and every array inside each row. It uses fresh `_digest_chunks` capture IDs. Every chunk must report the same full row count, character length and MD5; offsets must be contiguous, and complete reassembly must match that digest and decode to exactly the expected object rows. A missing, truncated or changed chunk fails without a complete population checkpoint. Restart reuses valid raw checkpoints; changed content requires a new run/capture identity, never overwriting failed evidence. The saved `contentProof` records protocol, source SQL MD5, full payload MD5/length/count, validated chunk count and row-order method. This is content consistency evidence for the full source, not an eligibility finding or a shared database transaction snapshot.

An optional paged source uses `selectPage({offset,limit})` and pageSize, but separate OFFSET reads cannot prove an immutable population even when every count matches. Every limited/paged capture remains `populationComplete:false`. Only whole-source frames or completely verified full-source digest chunks prove source coverage. Different sources remain independently captured; `sourceSnapshotScope:'independent_source_contents'` states this machine-readable boundary.

The existing pure identity grouper retains input order for rows tied on source priority and artist key. Deterministic transport sorting can therefore select a different stored display name in such ties; incidental diagnostic relation order can also differ. Conflicting accepted discovery targets remain conflicts, and their tied canonical label is not a verified resolution. No source value or alias array is rewritten. Mixed-source fixtures verify semantic grouping, canonical key/name, and source/bundle parity across40 permutations where the existing ranking distinguishes the rows; a separate fixture records the tied-name limitation explicitly.

Evidence reads are sequential, one whole response per artist. The transport wrapper begins with SELECT while keeping the source query materialized; both SELECT- and WITH-leading sources are supported. Raw output is durably saved before parsing; strict RFC4180/JSON decoding, row counts, Unicode lengths, MD5 and exact artist matching reject incomplete or mixed captures. A model/log preview truncation is not raw-tool truncation. Transaction-clock mode rejects repeated chunk queries because they change capture time. Preserve actual incomplete transport as a blocker.

Resume with the same metadata and saved population order. Completed raw/decoded/result files are reused; the compact JSON/CSV report advances without duplicate rows. Prioritize artists once before the first evidence result, then preserve that order. `auditComplete` requires complete source coverage, every candidate audited, and no incomplete evidence. C can still have other unresolved findings; count incomplete evidence separately from unclassified rows.

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
