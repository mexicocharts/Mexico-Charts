import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import test from "node:test";
import express from "express";
import type { SongstatsProductionPreflightResult } from "../lib/songstats-history-preflight";
import { createSongstatsProductionPreflightRouter } from "./songstats-production-preflight";

const ADMIN_KEY = "test-songstats-admin-key-at-least-32-characters";
const REVISION = "test-production-revision";
const FINGERPRINT = "a".repeat(64);
const BODY = {
  confirm: "production-preflight-read-only",
  artists: ["peso-pluma", "banda ms de sergio lizarraga", "neton-vega"],
};

function result(): SongstatsProductionPreflightResult {
  return {
    mode: "production-preflight",
    revision: REVISION,
    schema: {
      version: 2,
      tables: [],
      columnsChecked: 0,
      constraintsChecked: 0,
      indexesChecked: 0,
      compactRunnerWriteTargets: [],
      legacyWideTargets: [],
    },
    metricDefinitions: {
      total: 49,
      active: 48,
      quarantined: 1,
      streamsCurrentQuarantined: true,
      playlistDefinitionsPresent: [],
      duplicateCanonicalDefinitions: 0,
      duplicateProviderDefinitions: 0,
    },
    emptyHistory: {
      observations: 0,
      providerIdentities: 0,
      importRuns: 0,
      importChunks: 0,
    },
    identities: [],
    safety: {
      apiCalls: 0,
      writes: 0,
      schemaChanges: 0,
      importRunsCreated: 0,
      checkpointsCreated: 0,
      historicalObservationsInserted: 0,
      identityLinksMutated: 0,
      externalIdentityLookups: 0,
      databaseReads: 7,
      transactionMode: "repeatable_read_read_only",
    },
  };
}

async function withServer(
  options: Parameters<typeof createSongstatsProductionPreflightRouter>[0],
  callback: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use("/api", createSongstatsProductionPreflightRouter(options));
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function productionEnvironment() {
  return {
    NODE_ENV: "production",
    SONGSTATS_ADMIN_KEY: ADMIN_KEY,
    SONGSTATS_PRODUCTION_PREFLIGHT_HTTP_ENABLED: "true",
    SONGSTATS_PRODUCTION_PREFLIGHT_EXPECTED_SOURCE_FINGERPRINT: FINGERPRINT,
    SONGSTATS_PRODUCTION_PREFLIGHT_DEPLOY_REVISION: REVISION,
    REPLIT_GIT_COMMIT_SHA: REVISION,
  };
}

async function invoke(baseUrl: string, key = ADMIN_KEY) {
  return fetch(`${baseUrl}/api/admin/songstats/production-preflight`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-key": key,
    },
    body: JSON.stringify(BODY),
  });
}

function guardedOptions(
  options: Parameters<typeof createSongstatsProductionPreflightRouter>[0],
) {
  return { actualSourceFingerprint: FINGERPRINT, ...options };
}

test("disabled or unauthenticated production preflight cannot reach the runner", async () => {
  let calls = 0;
  const runPreflight = async () => {
    calls += 1;
    return result();
  };
  await withServer(
    guardedOptions({
      env: {
        ...productionEnvironment(),
        SONGSTATS_PRODUCTION_PREFLIGHT_HTTP_ENABLED: "false",
      },
      runPreflight,
    }),
    async (baseUrl) => assert.equal((await invoke(baseUrl)).status, 404),
  );
  await withServer(
    guardedOptions({ env: productionEnvironment(), runPreflight }),
    async (baseUrl) =>
      assert.equal((await invoke(baseUrl, "wrong-key")).status, 403),
  );
  assert.equal(calls, 0);
});
test("source fingerprint and exact request assertions fail closed before execution", async () => {
  let calls = 0;
  const runPreflight = async () => {
    calls += 1;
    return result();
  };
  await withServer(
    guardedOptions({
      env: {
        ...productionEnvironment(),
        SONGSTATS_PRODUCTION_PREFLIGHT_EXPECTED_SOURCE_FINGERPRINT:
          "b".repeat(64),
      },
      runPreflight,
    }),
    async (baseUrl) => assert.equal((await invoke(baseUrl)).status, 409),
  );
  await withServer(
    guardedOptions({ env: productionEnvironment(), runPreflight }),
    async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/admin/songstats/production-preflight`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-admin-key": ADMIN_KEY,
          },
          body: JSON.stringify({ confirm: "production-preflight-read-only" }),
        },
      );
      assert.equal(response.status, 400);
    },
  );
  assert.equal(calls, 0);
});

test("absent source fingerprints fail closed before execution", async () => {
  let calls = 0;
  const runPreflight = async () => {
    calls += 1;
    return result();
  };
  await withServer(
    {
      env: {
        ...productionEnvironment(),
        SONGSTATS_PRODUCTION_PREFLIGHT_EXPECTED_SOURCE_FINGERPRINT: undefined,
      },
      runPreflight,
    },
    async (baseUrl) => assert.equal((await invoke(baseUrl)).status, 409),
  );
  await withServer(
    guardedOptions({
      env: {
        ...productionEnvironment(),
        SONGSTATS_PRODUCTION_PREFLIGHT_EXPECTED_SOURCE_FINGERPRINT: undefined,
      },
      runPreflight,
    }),
    async (baseUrl) => assert.equal((await invoke(baseUrl)).status, 409),
  );
  assert.equal(calls, 0);
});

test("a Replit runtime SHA mismatch does not reject an approved package", async () => {
  let calls = 0;
  await withServer(
    guardedOptions({
      env: {
        ...productionEnvironment(),
        REPLIT_GIT_COMMIT_SHA: "publish-checkpoint",
      },
      runPreflight: async () => {
        calls += 1;
        return result();
      },
    }),
    async (baseUrl) => assert.equal((await invoke(baseUrl)).status, 200),
  );
  assert.equal(calls, 1);
});

test("authorized execution is one-attempt and preserves zero-mutation safety", async () => {
  let calls = 0;
  let received: unknown;
  await withServer(
    guardedOptions({
      env: productionEnvironment(),
      runPreflight: async (options) => {
        calls += 1;
        received = options;
        return result();
      },
    }),
    async (baseUrl) => {
      const first = await invoke(baseUrl);
      assert.equal(first.status, 200);
      const payload =
        (await first.json()) as SongstatsProductionPreflightResult;
      assert.equal(payload.safety.apiCalls, 0);
      assert.equal(payload.safety.writes, 0);
      assert.equal(payload.safety.schemaChanges, 0);
      assert.equal(payload.safety.importRunsCreated, 0);
      assert.equal(payload.safety.historicalObservationsInserted, 0);
      assert.equal((await invoke(baseUrl)).status, 410);
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(received, { artistKeys: BODY.artists, revision: REVISION });
});

test("the route cannot load Songstats API or mutation-capable history modules", () => {
  const source = readFileSync(
    new URL("./songstats-production-preflight.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /import\(\s*["']\.\.\/lib\/songstats-history-preflight["']\s*\)/m,
  );
  assert.doesNotMatch(
    source,
    /songstats-client|songstats-history-backfill|songstats-history-store|historic_stats/,
  );
  assert.ok(
    source.indexOf("validSha256(actualSourceFingerprint)") <
      source.indexOf("await runPreflight"),
  );
});

test("the application API router registers the guarded preflight router", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(
    source,
    /import songstatsProductionPreflightRouter from ["']\.\/songstats-production-preflight["'];/,
  );
  assert.match(source, /router\.use\(songstatsProductionPreflightRouter\);/);
});
