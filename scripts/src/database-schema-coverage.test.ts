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
