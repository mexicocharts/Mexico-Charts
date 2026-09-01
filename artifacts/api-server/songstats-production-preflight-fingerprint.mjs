import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SONGSTATS_PRODUCTION_PREFLIGHT_FINGERPRINT_VERSION =
  "mexico-charts/songstats-production-preflight-source/v1";

export const SONGSTATS_PRODUCTION_PREFLIGHT_FINGERPRINT_INPUTS = Object.freeze([
  "build.mjs",
  "package.json",
  "songstats-production-preflight-fingerprint.mjs",
  "src/app.ts",
  "src/index.ts",
  "src/lib/songstats-history-preflight.ts",
  "src/lib/songstats-history-schema-contract.ts",
  "src/routes/index.ts",
  "src/routes/songstats-production-preflight.ts",
]);

export function computeSongstatsProductionPreflightFingerprint(entries) {
  const hash = createHash("sha256");
  hash.update(SONGSTATS_PRODUCTION_PREFLIGHT_FINGERPRINT_VERSION, "utf8");
  hash.update("\0");

  for (const [relativePath, content] of [...entries].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
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

export async function readSongstatsProductionPreflightFingerprintInputs(
  artifactDirectory = path.dirname(fileURLToPath(import.meta.url)),
) {
  return Promise.all(
    SONGSTATS_PRODUCTION_PREFLIGHT_FINGERPRINT_INPUTS.map(
      async (relativePath) => [
        relativePath,
        await readFile(path.resolve(artifactDirectory, relativePath)),
      ],
    ),
  );
}

export async function computePackagedSongstatsProductionPreflightFingerprint(
  artifactDirectory,
) {
  return computeSongstatsProductionPreflightFingerprint(
    await readSongstatsProductionPreflightFingerprintInputs(artifactDirectory),
  );
}
