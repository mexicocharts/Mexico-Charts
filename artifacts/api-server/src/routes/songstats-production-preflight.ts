import { timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import type { SongstatsProductionPreflightResult } from "../lib/songstats-history-preflight";

const APPROVED_ARTISTS = [
  "peso-pluma",
  "banda ms de sergio lizarraga",
  "neton-vega",
] as const;

const ENABLE_FLAG = "SONGSTATS_PRODUCTION_PREFLIGHT_HTTP_ENABLED";
const EXPECTED_FINGERPRINT_ENV =
  "SONGSTATS_PRODUCTION_PREFLIGHT_EXPECTED_SOURCE_FINGERPRINT";
const INFORMATIONAL_REVISION_ENV =
  "SONGSTATS_PRODUCTION_PREFLIGHT_DEPLOY_REVISION";
const ADMIN_KEY_ENV = "SONGSTATS_ADMIN_KEY";

declare const __SONGSTATS_PRODUCTION_PREFLIGHT_FINGERPRINT__: string;

const BAKED_SOURCE_FINGERPRINT =
  typeof __SONGSTATS_PRODUCTION_PREFLIGHT_FINGERPRINT__ === "string"
    ? __SONGSTATS_PRODUCTION_PREFLIGHT_FINGERPRINT__
    : "";

type PreflightRunner = (options: {
  artistKeys: readonly string[];
  revision: string | null;
}) => Promise<SongstatsProductionPreflightResult>;

type Environment = NodeJS.ProcessEnv;

function secureEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function validSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function authorized(req: Request, env: Environment): boolean {
  const expected = env[ADMIN_KEY_ENV]?.trim() ?? "";
  const supplied = req.header("x-admin-key")?.trim() ?? "";
  return expected.length >= 32 && secureEqual(supplied, expected);
}

function exactRequestBody(body: unknown): boolean {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  const record = body as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "artists,confirm" ||
    record["confirm"] !== "production-preflight-read-only" ||
    !Array.isArray(record["artists"])
  ) {
    return false;
  }
  const artists = record["artists"] as unknown[];
  return (
    artists.length === APPROVED_ARTISTS.length &&
    APPROVED_ARTISTS.every((artist, index) => artists[index] === artist)
  );
}

function assertZeroMutationResult(
  result: SongstatsProductionPreflightResult,
): void {
  const { safety } = result;
  if (
    safety.apiCalls !== 0 ||
    safety.writes !== 0 ||
    safety.schemaChanges !== 0 ||
    safety.importRunsCreated !== 0 ||
    safety.checkpointsCreated !== 0 ||
    safety.historicalObservationsInserted !== 0 ||
    safety.identityLinksMutated !== 0 ||
    safety.externalIdentityLookups !== 0 ||
    safety.transactionMode !== "repeatable_read_read_only"
  ) {
    throw new Error("Production preflight safety invariant failed");
  }
}

export function createSongstatsProductionPreflightRouter(
  options: {
    env?: Environment;
    runPreflight?: PreflightRunner;
    actualSourceFingerprint?: string;
  } = {},
) {
  const env = options.env ?? process.env;
  const actualSourceFingerprint =
    options.actualSourceFingerprint ?? BAKED_SOURCE_FINGERPRINT;
  const runPreflight: PreflightRunner =
    options.runPreflight ??
    (async (runOptions) => {
      const { runSongstatsProductionPreflight } =
        await import("../lib/songstats-history-preflight");
      return runSongstatsProductionPreflight(runOptions);
    });
  const router = Router();
  let attempted = false;

  router.post("/admin/songstats/production-preflight", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    if (
      env["NODE_ENV"] !== "production" ||
      env[ENABLE_FLAG]?.trim().toLowerCase() !== "true"
    ) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (!authorized(req, env)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const expectedSourceFingerprint =
      env[EXPECTED_FINGERPRINT_ENV]?.trim() ?? "";
    if (
      !validSha256(actualSourceFingerprint) ||
      !validSha256(expectedSourceFingerprint) ||
      !secureEqual(actualSourceFingerprint, expectedSourceFingerprint)
    ) {
      res
        .status(409)
        .json({ error: "Production preflight source fingerprint mismatch" });
      return;
    }

    if (!exactRequestBody(req.body)) {
      res.status(400).json({ error: "Invalid production preflight request" });
      return;
    }

    if (attempted) {
      res.status(410).json({ error: "Production preflight already attempted" });
      return;
    }
    attempted = true;

    try {
      const informationalRevision =
        env[INFORMATIONAL_REVISION_ENV]?.trim() ||
        env["REPLIT_GIT_COMMIT_SHA"]?.trim() ||
        null;
      const result = await runPreflight({
        artistKeys: APPROVED_ARTISTS,
        revision: informationalRevision,
      });
      assertZeroMutationResult(result);
      res.status(200).json(result);
    } catch (error) {
      req.log?.error(
        { error },
        "[songstats-production-preflight] read-only validation failed",
      );
      res.status(500).json({ error: "Production preflight failed closed" });
    }
  });

  return router;
}

export default createSongstatsProductionPreflightRouter();
