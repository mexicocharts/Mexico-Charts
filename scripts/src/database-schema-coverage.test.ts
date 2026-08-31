import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(entryPath);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    }),
  );
  return files.flat();
}

async function collectMatches(
  directories: string[],
  pattern: RegExp,
): Promise<Set<string>> {
  const matches = new Set<string>();
  for (const directory of directories) {
    for (const file of await sourceFiles(directory)) {
      const contents = await readFile(file, "utf8");
      for (const match of contents.matchAll(pattern)) matches.add(match[1]);
    }
  }
  return matches;
}

test("every runtime-created table is declared in the Drizzle schema", async () => {
  const runtimeTables = await collectMatches(
    [
      path.join(repoRoot, "artifacts/api-server/src"),
      path.join(repoRoot, "scripts/src"),
    ],
    /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+["']?([a-z_][a-z0-9_]*)["']?/gi,
  );
  const schemaTables = await collectMatches(
    [path.join(repoRoot, "lib/db/src/schema")],
    /pgTable\s*\(\s*["']([^"']+)["']/g,
  );

  const missing = [...runtimeTables]
    .filter((table) => !schemaTables.has(table))
    .sort();

  assert.deepEqual(
    missing,
    [],
    `Runtime-created tables missing from the formal Drizzle schema: ${missing.join(", ")}`,
  );
});

test("production constraint names remain stable in the Drizzle schema", async () => {
  const schemaDirectory = path.join(repoRoot, "lib/db/src/schema");
  const schemaSource = (
    await Promise.all((await sourceFiles(schemaDirectory)).map(file => readFile(file, "utf8")))
  ).join("\n");
  const productionConstraintNames = [
    "artist_candidate_audit_entries_candidate_id_fkey",
    "artist_candidate_events_candidate_id_fkey",
    "artist_candidate_signals_candidate_id_fkey",
    "artist_social_account_candida_artist_key_platform_canonical_key",
    "artist_social_account_candidates_status_check",
    "chart_snapshot_rows_snapshot_id_fkey",
    "fan_profiles_username_key",
    "mexican_artist_identity_candidates_normalized_name_key",
    "mexican_artist_identity_candidates_status_check",
    "monitoring_stream_archive_manifests_pkey",
    "monitoring_stream_daily_artist_summaries_pkey",
    "monitoring_stream_daily_snapshots_pkey",
    "monitoring_stream_items_pkey",
    "official_artists_discovery_candidate_id_fkey",
    "official_chart_snapshots_pkey",
    "proprietary_chart_snapshots_pkey",
    "saved_artists_pkey",
    "social_template_artwork_pkey",
    "songstats_monthly_artist_usage_pkey",
    "user_listening_events_pkey",
    "user_music_connections_pkey",
    "youtube_artist_video_links_video_id_fkey",
    "youtube_music_catalog_candidates_video_id_fkey",
    "youtube_video_daily_snapshots_video_id_fkey",
    "youtube_video_intraday_latest_observations_video_id_fkey",
    "youtube_video_intraday_shadow_snapshots_video_id_fkey",
  ];

  const missing = productionConstraintNames.filter(name => !schemaSource.includes(`"${name}"`));
  assert.deepEqual(
    missing,
    [],
    `Production constraint names missing from the formal Drizzle schema: ${missing.join(", ")}`,
  );
});
