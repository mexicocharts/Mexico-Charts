import assert from "node:assert/strict";
import test from "node:test";
import { safeErrorDetails } from "./safe-error";

test("serializes useful error context while redacting API credentials", () => {
  const details = safeErrorDetails(new TypeError("fetch failed https://example.test?key=AIza123456789012345678901234567890"), { job: "collector" });
  assert.equal(details["job"], "collector");
  assert.equal(details.error.name, "TypeError");
  assert.match(details.error.message, /\[REDACTED\]/);
  assert.doesNotMatch(details.error.message, /AIza123/);
});
