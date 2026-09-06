import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeMonitoringSourceFingerprint } from "../../monitoring-source-fingerprint.mjs";

test("native history helper changes alter the packaged Monitor Pro fingerprint without changing routes", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "monitoring-fingerprint-"));
  const artifact = path.join(temporary, "artifacts/api-server");
  const realArtifact = fileURLToPath(new URL("../../", import.meta.url));
  const staticInputs = [
    "artifacts/api-server/build.mjs", "artifacts/api-server/monitoring-source-fingerprint.mjs",
    "artifacts/api-server/src/routes/monitoring.ts", "artifacts/api-server/src/lib/artist-pro-entitlement.ts",
    "artifacts/api-server/src/lib/auth.ts", "artifacts/api-server/src/lib/request-database.ts",
    "artifacts/api-server/src/lib/songstats-artist-key.ts", "artifacts/api-server/src/lib/songstats-public-service.ts",
    "artifacts/api-server/src/lib/songstats-history-serving.ts", "lib/db/src/database-url.mjs",
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
    await writeFile(path.join(artifact, "src/lib/monitoring-youtube-native-history.test.ts"), "fixture-only change");
    assert.equal(await computeMonitoringSourceFingerprint(artifact), baseline, "fixture edits do not claim a different packaged implementation");
    assert.equal(await readFile(path.join(artifact, "src/routes/monitoring.ts"), "utf8"), "unchanged fixture input: artifacts/api-server/src/routes/monitoring.ts\n");
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
