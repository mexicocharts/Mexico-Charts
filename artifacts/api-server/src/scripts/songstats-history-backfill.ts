export {};

function flags(argv: string[]) {
  const parsed = new Map<string, string[]>();
  for (const argument of argv) {
    if (!argument.startsWith("--")) continue;
    const [rawName, ...rawValue] = argument.slice(2).split("=");
    const value = rawValue.join("=") || "true";
    parsed.set(rawName!, [...(parsed.get(rawName!) ?? []), value]);
  }
  return parsed;
}

function integerFlag(
  values: Map<string, string[]>,
  name: string,
  fallback: number,
) {
  const value = Number(values.get(name)?.at(-1) ?? fallback);
  if (!Number.isInteger(value) || value < 1)
    throw new Error(`--${name} must be a positive integer`);
  return value;
}

const values = flags(process.argv.slice(2));
const mode = values.get("mode")?.at(-1) ?? "dry-run";
const artistKeys = values
  .get("artist-key")
  ?.map((value) => value.trim())
  .filter(Boolean);

if (mode === "production-preflight") {
  const allowedFlags = new Set(["mode", "artist-key", "revision"]);
  const unsupported = [...values.keys()].filter(
    (name) => !allowedFlags.has(name),
  );
  if (unsupported.length) {
    throw new Error(
      `production-preflight rejected unsupported flags: ${unsupported.join(", ")}`,
    );
  }
  const { runSongstatsProductionPreflight } =
    await import("../lib/songstats-history-preflight");
  const result = await runSongstatsProductionPreflight({
    artistKeys,
    revision:
      values.get("revision")?.at(-1) ??
      process.env["REPLIT_GIT_COMMIT_SHA"] ??
      null,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

const { buildSongstatsHistoryDryRun, runSongstatsHistoryBackfill } =
  await import("../lib/songstats-history-backfill");
const startDate = values.get("start-date")?.at(-1) ?? "2020-01-01";
const endDate =
  values.get("end-date")?.at(-1) ?? new Date().toISOString().slice(0, 10);
const limit = integerFlag(
  values,
  "limit",
  mode === "test" || mode === "validation" ? 3 : 529,
);

if (mode === "dry-run") {
  const result = await buildSongstatsHistoryDryRun({
    limit,
    artistKeys,
    startDate,
    endDate,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(0);
}

if (mode !== "test" && mode !== "validation" && mode !== "full") {
  throw new Error(
    "--mode must be production-preflight, dry-run, test, validation, or full",
  );
}
if (values.get("execute")?.at(-1) !== "true") {
  throw new Error(
    "API execution is locked; pass --execute=true after reviewing the dry run",
  );
}

const result = await runSongstatsHistoryBackfill({
  mode,
  limit,
  artistKeys,
  startDate,
  endDate,
  concurrency: integerFlag(
    values,
    "concurrency",
    mode === "validation" ? 1 : 2,
  ),
  maxAttempts: integerFlag(values, "max-attempts", 3),
  runId: values.get("run-id")?.at(-1),
  onProgress(progress) {
    process.stderr.write(
      `${JSON.stringify({ event: "songstats_history_progress", ...progress })}\n`,
    );
  },
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
