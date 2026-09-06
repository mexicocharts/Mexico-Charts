import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { transpileModule, ScriptTarget } from "typescript";
import { kworbSnapshots } from "../../../../lib/db/src/schema/kworb_snapshots";

const postgresModule = process.env["MONITOR_HISTORY_PGLITE_MODULE"];
const currentSource = readFileSync(new URL("./kworb.ts", import.meta.url), "utf8");
function routeHandler(source: string, database: ReturnType<typeof drizzle>) {
  const start = source.indexOf('router.get("/kworb/batch-streams",');
  const end = source.indexOf('/* GET /api/kworb/known-slugs */', start);
  const slugStart = source.indexOf("function toSlug(");
  const slugEnd = source.indexOf("function songKey(", slugStart);
  assert.ok(start > 0 && end > start && slugEnd > slugStart);
  const code = transpileModule(source.slice(slugStart, slugEnd) + source.slice(start, end), {
    compilerOptions: { target: ScriptTarget.ES2022 },
  }).outputText;
  let handler: (req: unknown, res: unknown) => Promise<void>;
  new Function("router", "db", "kworbSnapshots", "eq", "and", "inArray", "sql", code)(
    { get(_path: string, value: typeof handler) { handler = value; } }, database, kworbSnapshots, eq, and, inArray, sql,
  );
  return async (query: Record<string, unknown>) => {
    const response = { status: 200, headers: {} as Record<string, string>, body: undefined as unknown };
    const res = {
      status(value: number) { response.status = value; return res; },
      setHeader(name: string, value: string) { response.headers[name] = value; },
      json(value: unknown) { response.body = JSON.parse(JSON.stringify(value)); },
    };
    await handler!({ query }, res);
    return response;
  };
}
async function fixture() {
  const { PGlite } = await import(postgresModule!);
  const pg = new PGlite();
  await pg.exec("CREATE TABLE kworb_snapshots(artist_key text NOT NULL,metric_type text NOT NULL,value jsonb NOT NULL,fetched_at timestamptz,expires_at timestamptz,PRIMARY KEY(artist_key,metric_type))");
  const statements: Array<{ query: string; params: unknown[] }> = [];
  const client = { query: (query: { text: string; rowMode?: "array" }, params: unknown[]) => pg.query(query.text, params, { rowMode: query.rowMode }) };
  const database = drizzle(client as never, { logger: { logQuery(query, params) { statements.push({ query, params }); } } });
  const insert = async (key: string, metric: string, value: unknown) => pg.query("INSERT INTO kworb_snapshots(artist_key,metric_type,value) VALUES($1,$2,$3::jsonb)", [key, metric, JSON.stringify(value)]);
  return { pg, database, statements, insert, serve: routeHandler(currentSource, database) };
}

test("batch snapshots retain composite-key uniqueness and exact slug/response/cache behavior", { skip: !postgresModule }, async () => {
  const f = await fixture();
  try {
    await f.insert("josejose", "spotify", { totalStreams: 0, dailyStreams: "42", tracks: [{ ignored: true }] });
    await f.insert("josejose", "youtube", { totalViews: 123, dailyAvg: 0 });
    await f.insert("", "spotify", { totalStreams: 7 });
    await f.insert("unrequested", "spotify", { totalStreams: 999 });
    await assert.rejects(f.insert("josejose", "spotify", { totalStreams: 1 }), /duplicate key/);
    const response = await f.serve({ names: " José José,JOSE-JOSE,José José,unknown,東京 ", details: "true" });
    assert.deepEqual(response, { status: 200, headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" }, body: {
      "José José": { totalStreams: 0, dailyStreams: "42", totalViews: 123, dailyAvg: 0 },
      "JOSE-JOSE": { totalStreams: 0, dailyStreams: "42", totalViews: 123, dailyAvg: 0 },
      unknown: { totalStreams: null, dailyStreams: null, totalViews: null, dailyAvg: null },
      "東京": { totalStreams: 7, dailyStreams: null, totalViews: null, dailyAvg: null },
    } });
    assert.equal(f.statements.length, 2);
    for (const statement of f.statements) {
      assert.deepEqual(statement.params.slice(1), ["josejose", "unknown", ""]);
      assert.match(statement.query, /jsonb_build_object/);
      assert.match(statement.query, /"artist_key" in/);
    }
    f.statements.length = 0;
    assert.deepEqual((await f.serve({ names: "José José,unknown", details: "false" })).body, { "José José": 0, unknown: null });
    assert.equal(f.statements.length, 1);
    assert.ok(!f.statements[0]!.query.includes("dailyStreams"));
    assert.deepEqual(await f.serve({}), { status: 400, headers: {}, body: { error: "names query parameter required" } });
    f.statements.length = 0;
    assert.deepEqual((await f.serve({ names: " , , " })).body, {});
    assert.equal(f.statements.length, 0);
    const names = Array.from({ length: 151 }, (_, i) => "unknown" + i);
    assert.equal(Object.keys((await f.serve({ names: names.join(",") })).body as object).length, 150);
    assert.equal(f.statements[0]!.params.length, 151, "one metric plus at most 150 requested keys");
    await f.pg.exec("DROP TABLE kworb_snapshots");
    await assert.rejects(f.serve({ names: "José José" }), /Failed query/, "source failures cannot become a successful empty response");
  } finally { await f.pg.close(); }
});

test("JSON projection preserves existing null, scalar, string and malformed nested values without coercion", { skip: !postgresModule }, async () => {
  const f = await fixture();
  try {
    const values = [null, false, 42, "root string", [1, 2], {}, { totalStreams: null },
      { totalStreams: "0", dailyStreams: false }, { totalStreams: [0, "x"], dailyStreams: { malformed: 2 } },
      { totalStreams: { nested: [null, 0, "東京"] }, dailyStreams: -5 }];
    for (const [i, value] of values.entries()) {
      await f.insert("case" + i, "spotify", value);
      await f.insert("case" + i, "youtube", value && typeof value === "object" && !Array.isArray(value)
        ? { totalViews: (value as Record<string, unknown>).totalStreams, dailyAvg: (value as Record<string, unknown>).dailyStreams } : value);
    }
    const names = values.map((_, i) => "case" + i).join(",");
    const details = (await f.serve({ names, details: "1" })).body as Record<string, unknown>;
    const totals = (await f.serve({ names })).body as Record<string, unknown>;
    for (const [i, value] of values.entries()) {
      const original = value as { totalStreams?: unknown; dailyStreams?: unknown } | null;
      const total = original?.totalStreams ?? null, daily = original?.dailyStreams ?? null;
      assert.deepEqual(details["case" + i], { totalStreams: total, dailyStreams: daily, totalViews: total, dailyAvg: daily });
      assert.deepEqual(totals["case" + i], total);
    }
  } finally { await f.pg.close(); }
});

// Opt-in retained benchmark compares the actual frozen pre-change route with
// the actual new handler, using the same synthetic PostgreSQL data and schema.
test("bounded batch response equals the prior route while omitting unrequested full catalogs", { skip: !postgresModule || !process.env["KWORB_BATCH_PERFORMANCE_OUTPUT"] }, async () => {
  const f = await fixture();
  try {
    await f.pg.exec(`INSERT INTO kworb_snapshots(artist_key,metric_type,value)
      SELECT 'fixture' || artist, 'spotify', jsonb_build_object('totalStreams',artist*1000000,'dailyStreams',artist*1000,
        'topTracks',(SELECT jsonb_agg(jsonb_build_object('title','Synthetic track '||track,'streams',track*10000,'daily',track*10,
          'url','https://example.invalid/fixture-track-'||track,'cover','https://example.invalid/fixture-cover-'||track)) FROM generate_series(1,40+artist%450) track),
        'albums',(SELECT jsonb_agg(jsonb_build_object('title','Synthetic album '||album,'streams',album*10000)) FROM generate_series(1,5+artist%30) album))
      FROM generate_series(0,577) artist;
      INSERT INTO kworb_snapshots(artist_key,metric_type,value)
      SELECT 'fixture'||artist,'youtube',jsonb_build_object('totalViews',artist*2000000,'dailyAvg',artist*2000,
        'videos',(SELECT jsonb_agg(jsonb_build_object('title','Synthetic video '||video,'views',video*10000,'dailyAvg',video*10,
          'videoId','fixture'||video,'thumbnail','https://example.invalid/fixture-thumb-'||video)) FROM generate_series(1,40+artist%210) video))
      FROM generate_series(0,429) artist`);
    const baselineSource = execFileSync("git", ["show", "d5dda0310b1896f6780e5b0efb6e6d39ec605dd1:artifacts/api-server/src/routes/kworb.ts"], { encoding: "utf8", maxBuffer: 400_000 });
    const before = routeHandler(baselineSource, f.database);
    const query = { names: "Fixture 2,Fixture-317,Fixture429,Fixture 2,unknown", details: "true" };
    const baselineRows = await f.pg.query("SELECT artist_key,value FROM kworb_snapshots WHERE metric_type IN ('spotify','youtube')");
    const projectedRows = await f.pg.query("SELECT artist_key,CASE WHEN metric_type='spotify' THEN jsonb_build_object('totalStreams',value->'totalStreams','dailyStreams',value->'dailyStreams') ELSE jsonb_build_object('totalViews',value->'totalViews','dailyAvg',value->'dailyAvg') END value FROM kworb_snapshots WHERE metric_type IN ('spotify','youtube') AND artist_key=ANY($1::text[])", [["fixture2", "fixture317", "fixture429", "unknown"]]);
    const expected = await before(query);assert.deepEqual(await f.serve(query), expected);
    for (const details of [undefined, "false", "1", "true"]) assert.deepEqual(await f.serve({ ...query, details }), await before({ ...query, details }));
    const timings: { before: number[]; after: number[] } = { before: [], after: [] };
    for (let i = 0; i < 6; i++) for (const label of i % 2 ? ["after", "before"] as const : ["before", "after"] as const) {
      const start = performance.now();const response = await (label === "before" ? before : f.serve)(query);
      timings[label].push(performance.now() - start);assert.deepEqual(response, expected);
    }
    const median = (values: number[]) => { const sorted = [...values].sort((a,b)=>a-b);return (sorted[2]! + sorted[3]!) / 2; };
    const evidence = { scope: "Local PostgreSQL/PGlite synthetic fixture; not production query latency or actual catalog coverage.", baselineRevision: "d5dda0310b1896f6780e5b0efb6e6d39ec605dd1",
      fixture: { spotifySnapshots: 578, youtubeSnapshots: 430, spotifyTracksPerArtist: "40..489", youtubeVideosPerArtist: "40..249", catalogDataSynthetic: true },
      payloadMeasurement: "UTF-8 JSON serialization of PostgreSQL result rows, not PostgreSQL wire bytes",
      queryTiming: "Actual route handler including awaited Drizzle reads, parsing and response assembly; network excluded",
      requestedUniqueKeys: 4, returnedMatchedRows: projectedRows.rows.length, wholeRows: baselineRows.rows.length,
      fullPayloadJsonBytes: Buffer.byteLength(JSON.stringify(baselineRows.rows)), projectedPayloadJsonBytes: Buffer.byteLength(JSON.stringify(projectedRows.rows)),
      warmedAlternatingRuns: timings, medianMs: { before: median(timings.before), after: median(timings.after) }, exactResponsesEqual: true,
      cacheHeader: expected.headers["Cache-Control"], collectorsOrProvidersInvoked: false };
    assert.equal(projectedRows.rows.length, 6);assert.ok(evidence.projectedPayloadJsonBytes < evidence.fullPayloadJsonBytes / 1000);
    writeFileSync(process.env["KWORB_BATCH_PERFORMANCE_OUTPUT"]!, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
  } finally { await f.pg.close(); }
});
