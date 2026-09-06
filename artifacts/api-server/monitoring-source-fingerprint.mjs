import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** Fingerprint packaged Monitor Pro source, not a manually supplied deploy SHA. */
export async function computeMonitoringSourceFingerprint(artifactDir) {
  const root = path.resolve(artifactDir, "../..");
  const files = [
    "artifacts/api-server/build.mjs", "artifacts/api-server/monitoring-source-fingerprint.mjs",
    "artifacts/api-server/src/routes/monitoring.ts", "artifacts/api-server/src/lib/artist-pro-entitlement.ts",
    "artifacts/api-server/src/lib/auth.ts", "artifacts/api-server/src/lib/request-database.ts",
    "artifacts/api-server/src/lib/songstats-artist-key.ts", "artifacts/api-server/src/lib/songstats-public-service.ts",
    "artifacts/api-server/src/lib/songstats-history-serving.ts", "lib/db/src/database-url.mjs",
    "artifacts/api-server/src/lib/supplemental-artist-data.ts",
    "artifacts/mexico-charts/scripts/artist-profile-routes.mjs", "artifacts/mexico-charts/scripts/supplemental-artist-routes.mjs",
    "lib/db/src/index.ts", "lib/db/src/pool-config.ts", "pnpm-lock.yaml",
  ];
  for (const file of await readdir(path.join(artifactDir, "src/lib"))) {
    if (file.startsWith("monitoring-") && file.endsWith(".ts") && !file.endsWith(".test.ts"))
      files.push(`artifacts/api-server/src/lib/${file}`);
  }
  const digest = createHash("sha256");
  for (const file of [...new Set(files)].sort()) digest.update(file).update("\0").update(await readFile(path.join(root, file))).update("\0");
  return digest.digest("hex");
}
