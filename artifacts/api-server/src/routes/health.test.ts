import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("API exposes both the platform artifact root and explicit health endpoint", async () => {
  const source = await readFile(new URL("./health.ts", import.meta.url), "utf8");
  assert.match(source, /router\.get\("\/", healthHandler\)/);
  assert.match(source, /router\.get\("\/healthz", healthHandler\)/);
});

test("kworb startup uses the actual verified-identity schema", async () => {
  const source = await readFile(new URL("./kworb.ts", import.meta.url), "utf8");
  const identityQuery = source.match(/SELECT artist_name\s+FROM mexican_artist_identity_candidates\s+WHERE status = 'verified'[^`]*`/s)?.[0] ?? "";
  assert.ok(identityQuery);
  assert.doesNotMatch(identityQuery, /nationality/);
});
