import assert from "node:assert/strict";
import test from "node:test";

import {
  readSafeDatabaseRuntimeIdentity,
  youtubeCollectorRunLogLevel,
  youtubeValidationRunLogLevel,
} from "./youtube-runtime-observability";

test("collector log severity cannot describe failed or skipped work as successful", () => {
  assert.equal(youtubeCollectorRunLogLevel("complete"), "info");
  assert.equal(youtubeCollectorRunLogLevel("failed"), "error");
  assert.equal(youtubeCollectorRunLogLevel("locked"), "warn");
  assert.equal(youtubeCollectorRunLogLevel("quota_exhausted"), "warn");
  assert.equal(youtubeCollectorRunLogLevel("disabled"), "warn");
});

test("validation log severity distinguishes a skipped run", () => {
  assert.equal(youtubeValidationRunLogLevel("running"), "info");
  assert.equal(youtubeValidationRunLogLevel("complete"), "info");
  assert.equal(youtubeValidationRunLogLevel("skipped"), "warn");
});

test("database identity returns safe target evidence without a connection URL", async () => {
  const identity = await readSafeDatabaseRuntimeIdentity({
    async query<T>() {
      return { rows: [{
        database_name: "neondb",
        database_user: "service_owner",
        server_address: "192.0.2.10/32",
        server_port: 5432,
        observed_at: "2026-09-03 05:00:00+00",
        application_name: "mexico-charts-youtube-collector",
      } as T] };
    },
  });
  assert.equal(identity.databaseName, "neondb");
  assert.equal(identity.applicationName, "mexico-charts-youtube-collector");
  assert.doesNotMatch(JSON.stringify(identity), /postgres(?:ql)?:\/\//);
});
