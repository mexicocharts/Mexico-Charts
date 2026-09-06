import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeMonitoringSourceFingerprint } from "../../monitoring-source-fingerprint.mjs";

test("native history helpers and nested roster source changes alter the packaged Monitor Pro fingerprint without changing routes", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "monitoring-fingerprint-"));
  const artifact = path.join(temporary, "artifacts/api-server");
  const realArtifact = fileURLToPath(new URL("../../", import.meta.url));
  const staticInputs = [
    "artifacts/api-server/build.mjs", "artifacts/api-server/monitoring-source-fingerprint.mjs",
    "artifacts/api-server/src/routes/monitoring.ts", "artifacts/api-server/src/lib/artist-pro-entitlement.ts",
    "artifacts/api-server/src/lib/auth.ts", "artifacts/api-server/src/lib/request-database.ts",
    "artifacts/api-server/src/lib/songstats-artist-key.ts", "artifacts/api-server/src/lib/songstats-public-service.ts",
    "artifacts/api-server/src/lib/songstats-history-serving.ts", "lib/db/src/database-url.mjs",
    "artifacts/api-server/src/lib/supplemental-artist-data.ts",
    "artifacts/mexico-charts/scripts/artist-profile-routes.mjs", "artifacts/mexico-charts/scripts/supplemental-artist-routes.mjs",
    "lib/db/src/index.ts", "lib/db/src/pool-config.ts", "pnpm-lock.yaml",
  ];
  const helpers = ["monitoring-youtube-native-history.ts", "monitoring-youtube-history-request.ts"];
  try {
    for (const file of staticInputs) {
      const target = path.join(temporary, file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, `unchanged fixture input: ${file}\n`);
    }
    const originals = new Map();
    for (const helper of helpers) {
      const content = await readFile(path.join(realArtifact, "src/lib", helper));
      originals.set(helper, content);
      await writeFile(path.join(artifact, "src/lib", helper), content);
    }
    const baseline = await computeMonitoringSourceFingerprint(artifact);
    assert.match(baseline, /^[a-f0-9]{64}$/);
    assert.equal(await computeMonitoringSourceFingerprint(artifact), baseline);
    for (const helper of helpers) {
      const target = path.join(artifact, "src/lib", helper);
      await writeFile(target, Buffer.concat([originals.get(helper), Buffer.from("\n// native-history mutation proof\n")]));
      assert.notEqual(await computeMonitoringSourceFingerprint(artifact), baseline, `${helper} must be covered independently of its route import`);
      await writeFile(target, originals.get(helper));
      assert.equal(await computeMonitoringSourceFingerprint(artifact), baseline);
    }
    for (const file of ["artifacts/api-server/src/lib/supplemental-artist-data.ts",
      "artifacts/mexico-charts/scripts/artist-profile-routes.mjs", "artifacts/mexico-charts/scripts/supplemental-artist-routes.mjs"]) {
      const target = path.join(temporary, file);
      const original = await readFile(target);
      await writeFile(target, Buffer.concat([original, Buffer.from("\n// roster source mutation proof\n")]));
      assert.notEqual(await computeMonitoringSourceFingerprint(artifact), baseline, `${file} must be fingerprinted independently of the adapter import`);
      await writeFile(target, original);
      assert.equal(await computeMonitoringSourceFingerprint(artifact), baseline);
    }
    await writeFile(path.join(artifact, "src/lib/monitoring-youtube-native-history.test.ts"), "fixture-only change");
    assert.equal(await computeMonitoringSourceFingerprint(artifact), baseline, "fixture edits do not claim a different packaged implementation");
    assert.equal(await readFile(path.join(artifact, "src/routes/monitoring.ts"), "utf8"), "unchanged fixture input: artifacts/api-server/src/routes/monitoring.ts\n");
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
