import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SONGSTATS_HISTORY_VALIDATION_FINGERPRINT_VERSION =
  "mexico-charts/songstats-three-artist-history-validation/v1";

export const SONGSTATS_HISTORY_VALIDATION_FINGERPRINT_INPUTS = Object.freeze([
  "build.mjs",
  "package.json",
  "songstats-history-validation-fingerprint.mjs",
  "src/app.ts",
  "src/index.ts",
  "src/lib/monitoring-history.ts",
  "src/lib/monitoring-history-compact.ts",
  "src/lib/songstats-history-backfill.ts",
  "src/lib/songstats-history-capacity.ts",
  "src/lib/songstats-history-client.ts",
  "src/lib/songstats-history-model.ts",
  "src/lib/songstats-history-schema-contract.ts",
  "src/lib/songstats-history-store.ts",
  "src/lib/songstats-history-serving.ts",
  "src/lib/songstats-history-serving-validation.ts",
  "src/lib/songstats-history-validation-report.ts",
  "src/lib/songstats-info.ts",
  "src/lib/songstats-snapshot-service.ts",
  "src/routes/index.ts",
  "src/routes/monitoring.ts",
  "src/routes/songstats-history-validation.ts",
]);

export function computeSongstatsHistoryValidationFingerprint(entries) {
  const hash = createHash("sha256");
  hash.update(SONGSTATS_HISTORY_VALIDATION_FINGERPRINT_VERSION, "utf8");
  hash.update("\0");
  for (const [relativePath, content] of [...entries].sort(([left], [right]) =>
    left.localeCompare(right))) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    hash.update(relativePath, "utf8");
    hash.update("\0");
    hash.update(String(bytes.byteLength), "utf8");
    hash.update("\0");
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function computePackagedSongstatsHistoryValidationFingerprint(
  artifactDirectory = path.dirname(fileURLToPath(import.meta.url)),
) {
  return computeSongstatsHistoryValidationFingerprint(
    await readSongstatsHistoryValidationFingerprintInputs(artifactDirectory),
  );
}

export async function readSongstatsHistoryValidationFingerprintInputs(
  artifactDirectory = path.dirname(fileURLToPath(import.meta.url)),
) {
  return Promise.all(
    SONGSTATS_HISTORY_VALIDATION_FINGERPRINT_INPUTS.map(async relativePath => [
      relativePath,
      await readFile(path.resolve(artifactDirectory, relativePath)),
    ]),
  );
}
