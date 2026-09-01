import assert from "node:assert/strict";
import test from "node:test";
import {
  SONGSTATS_HISTORY_VALIDATION_FINGERPRINT_INPUTS,
  computePackagedSongstatsHistoryValidationFingerprint,
  computeSongstatsHistoryValidationFingerprint,
  readSongstatsHistoryValidationFingerprintInputs,
} from "../../songstats-history-validation-fingerprint.mjs";

test("controlled import source fingerprint is deterministic and complete", async () => {
  const entries = await readSongstatsHistoryValidationFingerprintInputs();
  const first = computeSongstatsHistoryValidationFingerprint(entries);
  const second = await computePackagedSongstatsHistoryValidationFingerprint();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.deepEqual(
    entries.map(([relativePath]) => relativePath),
    SONGSTATS_HISTORY_VALIDATION_FINGERPRINT_INPUTS,
  );
});

test("changing any protected import source changes the fingerprint", async () => {
  const entries = await readSongstatsHistoryValidationFingerprintInputs();
  const approved = computeSongstatsHistoryValidationFingerprint(entries);
  for (const [changedPath] of entries) {
    const changed = entries.map(([relativePath, content]) => [
      relativePath,
      relativePath === changedPath
        ? Buffer.concat([content, Buffer.from("\nmutation-proof")])
        : content,
    ]);
    assert.notEqual(
      computeSongstatsHistoryValidationFingerprint(changed),
      approved,
      changedPath,
    );
  }
});
