import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_TOURING_ROSTER,
  CANONICAL_TOURING_ROSTER_SIZE,
  failedCanonicalRun,
  nextCanonicalRunAt,
  persistCanonicalNextRun,
  persistCanonicalRunOutcome,
} from "./ticketmaster-touring-shadow";

test("uses exactly the canonical ten-artist touring roster", () => {
  assert.equal(CANONICAL_TOURING_ROSTER_SIZE, 10);
  assert.deepEqual(
    CANONICAL_TOURING_ROSTER.map((artist) => artist.artistId),
    [
      "fuerza-regida",
      "carin-leon",
      "natanael-cano",
      "yuridia",
      "eslabon-armado",
      "banda-ms",
      "los-tigres-del-norte",
      "xavi",
      "jorge-medina",
      "josi-cuen",
    ],
  );
});

test("calculates next_run_at with JavaScript timestamp arithmetic", () => {
  assert.equal(
    nextCanonicalRunAt(new Date("2026-08-27T12:00:00.000Z"), 6).toISOString(),
    "2026-08-27T18:00:00.000Z",
  );
});

test("persists next_run_at as an ISO timestamp without interval SQL", async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  await persistCanonicalNextRun(
    {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return { rows: [] };
      },
    },
    "42",
    new Date("2026-08-27T18:00:00.000Z"),
  );
  assert.equal(calls[0]?.sql, "UPDATE touring_tm_shadow_runs SET next_run_at=$2 WHERE id=$1");
  assert.deepEqual(calls[0]?.params, ["42", "2026-08-27T18:00:00.000Z"]);
  assert.equal(calls[0]?.sql.includes("interval"), false);
});

test("turns next_run_at persistence failures into an unhealthy run", () => {
  const summary = failedCanonicalRun({
    status: "complete",
    startedAt: "2026-08-27T12:00:00.000Z",
    finishedAt: "2026-08-27T12:05:00.000Z",
    fetchedArtists: 10,
    failedArtists: 0,
    eventsObserved: 3,
    snapshotsSaved: 3,
    errors: [],
  }, new Error("next_run_at update failed"));
  assert.equal(summary.status, "failed");
  assert.match(summary.errors.at(-1) ?? "", /next_run_at update failed/);
});

test("completed run persistence stores a future next_run_at", async () => {
  const insertedRun = { id: "99", status: "running", next_run_at: null as string | null };
  const finishedAt = new Date("2026-08-27T12:00:00.000Z");
  const nextRunAt = nextCanonicalRunAt(finishedAt, 1);
  await persistCanonicalRunOutcome(
    {
      query: async (sql, params) => {
        assert.match(sql, /finished_at=\$8,next_run_at=\$9/);
        assert.equal(params?.[0], insertedRun.id);
        insertedRun.status = String(params?.[1]);
        insertedRun.next_run_at = String(params?.[8]);
        return { rows: [], rowCount: 1 };
      },
    },
    insertedRun.id,
    {
      status: "complete",
      startedAt: "2026-08-27T11:59:00.000Z",
      finishedAt: finishedAt.toISOString(),
      fetchedArtists: 10,
      failedArtists: 0,
      eventsObserved: 3,
      snapshotsSaved: 3,
      errors: [],
    },
    nextRunAt,
  );
  assert.equal(insertedRun.status, "complete");
  assert.ok(insertedRun.next_run_at);
  assert.ok(new Date(insertedRun.next_run_at).getTime() > finishedAt.getTime());
});