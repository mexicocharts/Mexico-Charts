import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("weekly report labels saved YouTube observations without claiming live freshness", () => {
  const source = readFileSync(new URL("./monitoring-weekly-report.ts", import.meta.url), "utf8");
  assert.match(source, /page\("YouTube · lecturas guardadas", 5,/);
  assert.doesNotMatch(source, /page\("YouTube en vivo"/);
  assert.match(source, /Fuente: YouTube Data API/);
  assert.match(source, /Cálculo de Mexico Charts/);
});
