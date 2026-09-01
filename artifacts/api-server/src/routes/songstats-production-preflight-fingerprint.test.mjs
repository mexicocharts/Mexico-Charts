import assert from "node:assert/strict";
import test from "node:test";
import {
  SONGSTATS_PRODUCTION_PREFLIGHT_FINGERPRINT_INPUTS,
  computePackagedSongstatsProductionPreflightFingerprint,
  computeSongstatsProductionPreflightFingerprint,
  readSongstatsProductionPreflightFingerprintInputs,
} from "../../songstats-production-preflight-fingerprint.mjs";

test("the protected source fingerprint is deterministic and complete", async () => {
  const entries = await readSongstatsProductionPreflightFingerprintInputs();
  const first = computeSongstatsProductionPreflightFingerprint(entries);
  const second =
    await computePackagedSongstatsProductionPreflightFingerprint();

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.deepEqual(
    entries.map(([relativePath]) => relativePath),
    SONGSTATS_PRODUCTION_PREFLIGHT_FINGERPRINT_INPUTS,
  );
});

test("modifying any protected source input changes the fingerprint", async () => {
  const entries = await readSongstatsProductionPreflightFingerprintInputs();
  const approved = computeSongstatsProductionPreflightFingerprint(entries);

  for (const [changedPath] of entries) {
    const changedEntries = entries.map(([relativePath, content]) => [
      relativePath,
      relativePath === changedPath
        ? Buffer.concat([content, Buffer.from("\nmutation-proof")])
        : content,
    ]);
    assert.notEqual(
      computeSongstatsProductionPreflightFingerprint(changedEntries),
      approved,
      changedPath,
    );
  }
});
