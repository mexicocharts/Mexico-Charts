import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Request, Response } from "express";
import { authorizeMonitoringArtist, monitoringAuthorizedSourceKeys } from "./monitoring-authorization";
import { groupMonitoringCandidateIdentities, monitoringIdentityKeyCandidates } from "./monitoring-candidate-policy";
import { createMonitoringHistoryHandler } from "./monitoring-history-request";
import { createMonitoringYoutubeHistoryHandler } from "./monitoring-youtube-history-request";
import { MonitoringYoutubeVideoAccessError } from "./monitoring-youtube-native-history";

const postgresModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];

test("dashboard and both history consumers keep unrelated display-name data outside the granted scope", { skip: !postgresModule }, async () => {
  const { PGlite } = await import(postgresModule!);
  const { transpileModule, ScriptTarget } = await import("typescript");
  const db = new PGlite();
  const candidates = groupMonitoringCandidateIdentities([
    { artist_key: "ownedartist", artist_name: "Owned Artist", spotify_id: "1111111111111111111111", source: "kworb_coverage" },
    { artist_key: "ownedartist", artist_name: "Owned Artist", spotify_id: null, source: "musicbrainz_artists",
      mbid: "accepted-owned-id", verified: "auto_review_accepted", declared_aliases: ["accepted alias"] },
    { artist_key: "ownedartist", artist_name: "Unrelated Artist", spotify_id: null, source: "monitoring_subscriptions" },
    { artist_key: "unrelatedartist", artist_name: "Unrelated Artist", spotify_id: "2222222222222222222222", source: "kworb_coverage" },
  ]);
  assert.equal(candidates.length, 2, "subscription display names do not establish identity edges");
  const owned = candidates.find(candidate => candidate.artistKey === "ownedartist")!;
  assert.ok(!owned.matchKeys.includes("unrelatedartist"));
  const route = readFileSync(new URL("../routes/monitoring.ts", import.meta.url), "utf8");
  const start = route.indexOf("async function loadAuthorizedMonitoring(");
  const end = route.indexOf("  const sectionStatus", start);
  assert.ok(start >= 0 && end > start);
  const dashboardScope = transpileModule(`${route.slice(start, end)}\nreturn activeKeys;\n}`, {
    compilerOptions: { target: ScriptTarget.ES2022 },
  }).outputText;
  try {
    await db.exec(`CREATE TABLE scoped_history (artist_key text, video_id text, value integer);
      INSERT INTO scoped_history VALUES ('ownedartist','ownedvid001',1),('accepted alias','ownedvid001',2),
        ('unrelatedartist','othervid001',99),('untrusted-route','othervid001',100);`);
    for (const viewer of ["paid", "founder"] as const) {
      const access = await authorizeMonitoringArtist({
        userId: viewer, requestedArtistKey: "accepted-alias", internalUserIds: "founder",
        findActiveSubscription: async () => ({ artist_key: "ownedartist", artist_name: "Unrelated Artist", status: "active", created_at: null }),
        findExistingArtist: async () => ({ artist_key: owned.artistKey, artist_name: "Unrelated Artist", status: "internal", created_at: null,
          match_keys: owned.matchKeys, identity_conflict: owned.identityConflict }),
      });
      assert.equal(access.grant?.artist_name, "Unrelated Artist", "grant display name remains unchanged");
      const scope = new Function("resolveMonitoringAccess", "monitoringAuthorizedSourceKeys", "monitoringIdentityKeyCandidates",
        `${dashboardScope}\nreturn loadAuthorizedMonitoring;`)(async () => access, monitoringAuthorizedSourceKeys, monitoringIdentityKeyCandidates);
      const keys = await scope(viewer, "untrusted-route");
      assert.ok(keys.includes("accepted alias"), "verified display-name alias survives through match_keys");
      const dashboardRows = await db.query("SELECT value FROM scoped_history WHERE artist_key=ANY($1::text[]) ORDER BY value", [keys]);
      assert.deepEqual(dashboardRows.rows, [{ value: 1 }, { value: 2 }]);
      for (const kind of ["metric", "video"] as const) {
        let status = 0;
        let body: any;
        const res = { setHeader() {}, status(code: number) { status = code; return this; }, json(value: unknown) { body = value; return this; } } as unknown as Response;
        const shared = { userId: () => viewer, authorize: async () => access, aliases: monitoringIdentityKeyCandidates,
          failure: () => ({ status: 500, code: "fixture_failure" }) };
        const handler = kind === "metric" ? createMonitoringHistoryHandler({ ...shared,
          read: async input => (await db.query("SELECT value FROM scoped_history WHERE artist_key=ANY($1::text[]) ORDER BY value", [input.artistKeys])).rows,
        }) : createMonitoringYoutubeHistoryHandler({ ...shared,
          read: async input => {
            assert.equal(input.includeCandidateOnly, viewer === "founder");
            const rows = await db.query("SELECT value FROM scoped_history WHERE artist_key=ANY($1::text[]) AND video_id=$2 ORDER BY value", [input.artistKeys, input.videoId]);
            if (!rows.rows.length) throw new MonitoringYoutubeVideoAccessError();
            return rows.rows;
          },
        });
        const req = { params: { artistKey: "untrusted-route", metricKey: "spotifyFollowers", videoId: "ownedvid001" }, query: {} } as unknown as Request;
        await handler(req, res, () => {});
        assert.equal(status, 200);
        assert.deepEqual(body, [{ value: 1 }, { value: 2 }], `${viewer} ${kind}: no display-name or route expansion`);
        if (kind === "video") {
          req.params.videoId = "othervid001";
          await handler(req, res, () => {});
          assert.equal(status, 403, "an unrelated artist's video cannot satisfy membership");
          assert.equal((body as { code?: string }).code, "monitoring_video_access_denied");
        }
      }
    }
  } finally { await db.close(); }
});
